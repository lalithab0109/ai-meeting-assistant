import ast
import json
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

import httpx
from fastapi.testclient import TestClient
from google.genai import errors
from google.genai._gaos.lib.compat_errors import APIError as InteractionsAPIError, RateLimitError, InternalServerError

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from main import app
from meeting_models import MeetingAnalysis, MeetingResult


def analysis_fixture(title='Project planning'):
    return {'title': title, 'summary': 'Discussed testing.', 'key_points': ['Testing proposed.'], 'decisions': [], 'action_items': [{'task': 'Test audio', 'owner': None, 'deadline': None}]}


def compatibility_error(code):
    response = httpx.Response(code, request=httpx.Request('POST', 'https://example.invalid'))
    cls = RateLimitError if code == 429 else InternalServerError
    return cls('secret SDK details', response=response, body={})


class MeetingProcessingTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.refine_patch = patch('meeting_processor.refine_transcript', return_value='Refined transcript')
        self.analyze_patch = patch('meeting_processor.analyze_meeting', return_value=analysis_fixture())
        self.refine = self.refine_patch.start()
        self.analyze = self.analyze_patch.start()
        self.addCleanup(self.refine_patch.stop)
        self.addCleanup(self.analyze_patch.stop)

    def test_stage_order_and_schema(self):
        calls = Mock()
        calls.attach_mock(self.refine, 'refine')
        calls.attach_mock(self.analyze, 'analyze')
        response = self.client.post('/api/process', json={'transcript': 'Raw transcript'})
        self.assertEqual(response.status_code, 200)
        self.refine.assert_called_once_with('Raw transcript')
        self.analyze.assert_called_once_with('Refined transcript')
        self.assertEqual([call[0] for call in calls.mock_calls], ['refine', 'analyze'])
        result = response.json()
        self.assertEqual(set(result), {'title', 'summary', 'key_points', 'decisions', 'action_items', 'refined_transcript'})
        self.assertEqual(MeetingResult.model_validate(result).model_dump(), result)
        self.assertEqual(result['refined_transcript'], 'Refined transcript')
        self.assertIsNone(result['action_items'][0]['owner'])
        self.assertIsNone(result['action_items'][0]['deadline'])

    def test_transcript_dependent_results(self):
        self.refine.side_effect = lambda raw: 'Refined ' + raw
        self.analyze.side_effect = lambda refined: analysis_fixture(refined)
        first = self.client.post('/api/process', json={'transcript': 'Alpha'}).json()
        second = self.client.post('/api/process', json={'transcript': 'Beta'}).json()
        self.assertNotEqual(first, second)
        self.assertEqual(first['title'], 'Refined Alpha')
        self.assertEqual(second['title'], 'Refined Beta')

    def test_invalid_transcripts(self):
        for payload in ({'transcript': ''}, {'transcript': ' \n\t'}, {}, {'transcript': None}, {'transcript': 123}, {'transcript': 'Valid', 'extra': True}):
            self.assertEqual(self.client.post('/api/process', json=payload).status_code, 422)
        self.refine.assert_not_called()
        self.analyze.assert_not_called()

    def test_invalid_model_output_is_safe(self):
        for output in ({}, [], {'title': 'secret'}, {**analysis_fixture(), 'decisions': [{'decision': 'legacy'}]}, {**analysis_fixture(), 'action_items': [{'task': 'Test'}]}):
            self.analyze.return_value = output
            with patch('main.logger.exception') as log:
                response = self.client.post('/api/process', json={'transcript': 'Valid'})
                self.assertEqual(response.status_code, 500)
                self.assertNotIn('secret', response.text)
                log.assert_called_once()
        self.analyze.reset_mock()
        self.refine.return_value = ' '
        with patch('main.logger.exception'):
            self.assertEqual(self.client.post('/api/process', json={'transcript': 'Valid'}).status_code, 500)
        self.analyze.assert_not_called()

    def test_quota_and_service_failures_for_both_stages(self):
        for stage in (self.refine, self.analyze):
            for cause in (errors.ClientError(429, {}), compatibility_error(429), *(errors.ServerError(code, {}) for code in (500, 502, 503, 504)), compatibility_error(503)):
                error = RuntimeError('secret stage details')
                error.__cause__ = cause
                stage.side_effect = error
                with patch('main.logger.exception'):
                    response = self.client.post('/api/process', json={'transcript': 'Valid'})
                status = cause.code if isinstance(cause, errors.APIError) else cause.status_code
                self.assertEqual(response.status_code, 429 if status == 429 else 503)
                self.assertEqual(response.json()['detail'], 'AI service usage limit reached. Please try again later.' if status == 429 else 'AI processing is temporarily unavailable. Please try again.')
                self.assertNotIn('secret', response.text)
                stage.side_effect = None

    def test_unexpected_error_and_no_llm_initialization(self):
        self.refine.side_effect = ValueError('secret')
        with patch('main.logger.exception'):
            response = self.client.post('/api/process', json={'transcript': 'Valid'})
        self.assertEqual(response.status_code, 500)
        self.assertNotIn('secret', response.text)
        self.analyze.assert_not_called()
        self.assertNotIn('refinement', sys.modules)
        self.assertNotIn('analysis', sys.modules)


class GeminiStageTests(unittest.TestCase):
    def stage_function(self, filename, create):
        # Extract the actual function without importing a credential-bound client.
        tree = ast.parse((Path(__file__).resolve().parents[1] / filename).read_text())
        fn = next(node for node in tree.body if isinstance(node, ast.FunctionDef))
        namespace = {'json': json, 'MeetingAnalysis': MeetingAnalysis, 'errors': errors, 'InteractionsAPIError': InteractionsAPIError, 'client': SimpleNamespace(interactions=SimpleNamespace(create=create))}
        exec(compile(ast.Module(body=[fn], type_ignores=[]), filename, 'exec'), namespace)
        return namespace[fn.name]

    def test_single_attempt_quota_service_and_configuration_errors(self):
        for filename in ('refinement.py', 'analysis.py'):
            for cause in (errors.ClientError(429, {}), compatibility_error(429), *(errors.ServerError(code, {}) for code in (500, 502, 503, 504)), compatibility_error(503), errors.ClientError(401, {})):
                create = Mock(side_effect=cause)
                fn = self.stage_function(filename, create)
                status = cause.code if isinstance(cause, errors.APIError) else cause.status_code
                with self.assertRaises(RuntimeError if status != 401 else errors.ClientError) as caught:
                    fn('Input transcript')
                if status != 401:
                    self.assertIs(caught.exception.__cause__, cause)
                self.assertEqual(create.call_count, 1)

    def test_successful_single_attempt_and_analysis_contract(self):
        for filename, text in (('refinement.py', 'Refined transcript'), ('analysis.py', json.dumps(analysis_fixture()))):
            create = Mock(return_value=SimpleNamespace(output_text=text))
            result = self.stage_function(filename, create)('Input transcript')
            self.assertEqual(result, 'Refined transcript' if filename == 'refinement.py' else analysis_fixture())
            self.assertEqual(create.call_count, 1)
            self.assertEqual(create.call_args.kwargs['model'], 'gemini-3.5-flash-lite')
            self.assertIn('Input transcript', create.call_args.kwargs['input'])

    def test_successful_endpoint_makes_exactly_two_model_calls(self):
        refine_create = Mock(return_value=SimpleNamespace(output_text='Refined transcript'))
        analyze_create = Mock(return_value=SimpleNamespace(output_text=json.dumps(analysis_fixture())))
        refine = self.stage_function('refinement.py', refine_create)
        analyze = self.stage_function('analysis.py', analyze_create)
        with patch('meeting_processor.refine_transcript', side_effect=refine), patch('meeting_processor.analyze_meeting', side_effect=analyze):
            response = TestClient(app).post('/api/process', json={'transcript': 'Raw transcript'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(refine_create.call_count, 1)
        self.assertEqual(analyze_create.call_count, 1)
        self.assertIn('Raw transcript', refine_create.call_args.kwargs['input'])
        self.assertIn('Refined transcript', analyze_create.call_args.kwargs['input'])

    def test_sdk_transport_does_not_retry(self):
        from google import genai
        from google.genai._gaos.utils.retries import RetryConfig
        for filename in ('refinement.py', 'analysis.py'):
            tree = ast.parse((Path(__file__).resolve().parents[1] / filename).read_text())
            # Execute only the production client configuration with a mock HTTP
            # transport. No sockets, credentials, models, or network are used.
            assignments = [node for node in tree.body if isinstance(node, ast.Assign) and (
                isinstance(node.targets[0], ast.Name) and node.targets[0].id == 'client'
                or isinstance(node.targets[0], ast.Attribute) and node.targets[0].attr == 'retry_config'
            )]
            for code in (429, 500, 502, 503, 504, 'connection'):
                requests = []
                def handle(request):
                    requests.append(request)
                    if code == 'connection':
                        raise httpx.ConnectError('mock connection failure', request=request)
                    return httpx.Response(code, json={'error': {'code': code, 'message': 'mock service error'}})
                def configured_client(**kwargs):
                    kwargs['http_options']['client_args'] = {'transport': httpx.MockTransport(handle)}
                    return genai.Client(**kwargs)
                ns = {'genai': SimpleNamespace(Client=configured_client), 'os': SimpleNamespace(getenv=lambda key: 'test-key'), 'RetryConfig': RetryConfig}
                exec(compile(ast.Module(body=assignments, type_ignores=[]), filename, 'exec'), ns)
                client = ns['client']
                try:
                    with self.assertRaises(Exception):
                        self.stage_function(filename, client.interactions.create)('Transcript')
                    self.assertEqual(len(requests), 1)
                finally:
                    client.close()

    def test_malformed_json_and_wrong_structure_are_not_retried(self):
        for text in ('not JSON', '[]', '{}', json.dumps({**analysis_fixture(), 'action_items': [{'task': 'test', 'owner': 123, 'deadline': None}]})):
            create = Mock(return_value=SimpleNamespace(output_text=text))
            with self.assertRaises(ValueError):
                self.stage_function('analysis.py', create)('Transcript')
            self.assertEqual(create.call_count, 1)



if __name__ == '__main__':
    unittest.main()
