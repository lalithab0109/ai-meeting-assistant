import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import main
import transcription


class TranscriptionAPITests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(main.app)
        self.paths = []

    def transcribe(self, path):
        recording = Path(path)
        self.paths.append(recording)
        self.assertTrue(recording.exists())
        self.assertEqual(recording.read_bytes(), b'recording')
        return 'Actual service result'

    def assert_cleaned(self):
        for path in self.paths:
            self.assertFalse(path.exists())
            self.assertFalse(path.parent.exists())

    def test_success_and_formats(self):
        with patch.object(main, 'transcribe_audio', side_effect=self.transcribe):
            for suffix in ('.mp3', '.wav', '.m4a', '.mp4', '.webm', '.WAV'):
                response = self.client.post('/api/transcribe', files={'file': ('meeting' + suffix, b'recording')})
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.json(), {'success': True, 'rawTranscript': 'Actual service result', 'metadata': {'filename': 'meeting' + suffix, 'language': 'en'}})
                self.assertEqual(self.paths[-1].suffix, suffix.lower())
                self.assert_cleaned()

    def test_invalid_uploads(self):
        with patch.object(main, 'transcribe_audio') as service:
            for args in ({}, {'data': {'file': 'not a recording'}}, {'files': {'file': ('meeting.wav', b'')}}, {'files': {'file': ('meeting.txt', b'recording')}}):
                response = self.client.post('/api/transcribe', **args)
                self.assertEqual(response.status_code, 400)
                self.assertFalse(response.json()['success'])
                self.assertTrue(response.json()['error'])
            service.assert_not_called()

    def test_failures_and_cleanup(self):
        for exception, status in ((transcription.InvalidRecordingError('secret'), 400), (transcription.TranscriptionError('secret'), 500), (OSError('secret'), 500)):
            def fail(path):
                self.transcribe(path)
                raise exception
            with patch.object(main, 'transcribe_audio', side_effect=fail), patch.object(main.logger, 'exception'):
                response = self.client.post('/api/transcribe', files={'file': ('meeting.wav', b'recording')})
                self.assertEqual(response.status_code, status)
                self.assertFalse(response.json()['success'])
                self.assertNotIn('secret', response.text)
                self.assert_cleaned()

    def test_file_copy_failure_cleanup(self):
        def fail_copy(source, target):
            self.paths.append(Path(target.name))
            raise OSError('secret')
        with patch.object(main.shutil, 'copyfileobj', side_effect=fail_copy), patch.object(main, 'transcribe_audio') as service, patch.object(main.logger, 'exception'):
            response = self.client.post('/api/transcribe', files={'file': ('meeting.wav', b'recording')})
            self.assertEqual(response.status_code, 500)
            service.assert_not_called()
            self.assert_cleaned()

    def test_health_and_no_gemini_initialization(self):
        self.assertEqual(self.client.get('/health').json(), {'status': 'ok'})
        self.assertNotIn('refinement', sys.modules)
        self.assertNotIn('analysis', sys.modules)


class TranscriptionServiceTests(unittest.TestCase):
    def test_model_reuse_and_english(self):
        model = Mock()
        model.transcribe.return_value = {'text': ' hello '}
        audio = SimpleNamespace(size=100)
        whisper = SimpleNamespace(load_audio=Mock(return_value=audio), load_model=Mock(return_value=model))
        with patch.dict(sys.modules, {'whisper': whisper}), patch.object(transcription, '_model', None):
            self.assertEqual(transcription.transcribe_audio('first.wav'), 'hello')
            self.assertEqual(transcription.transcribe_audio('second.wav'), 'hello')
            whisper.load_model.assert_called_once_with('small')
            model.transcribe.assert_called_with(audio, language='en', fp16=False)

    def test_corrupt_audio_and_model_failure(self):
        whisper = SimpleNamespace(load_audio=Mock(side_effect=RuntimeError('decoder details')), load_model=Mock())
        with patch.dict(sys.modules, {'whisper': whisper}):
            with self.assertRaises(transcription.InvalidRecordingError):
                transcription.transcribe_audio('broken.mp4')
            whisper.load_model.assert_not_called()
        whisper.load_audio = Mock(return_value=SimpleNamespace(size=100))
        whisper.load_model.side_effect = RuntimeError('model details')
        with patch.dict(sys.modules, {'whisper': whisper}), patch.object(transcription, '_model', None):
            with self.assertRaises(transcription.TranscriptionError):
                transcription.transcribe_audio('meeting.wav')

    def test_empty_audio_and_empty_transcript(self):
        model = Mock()
        model.transcribe.return_value = {'text': ' '}
        whisper = SimpleNamespace(load_audio=Mock(return_value=SimpleNamespace(size=0)), load_model=Mock(return_value=model))
        with patch.dict(sys.modules, {'whisper': whisper}), patch.object(transcription, '_model', None):
            with self.assertRaises(transcription.InvalidRecordingError):
                transcription.transcribe_audio('empty.wav')
            whisper.load_audio.return_value = SimpleNamespace(size=100)
            with self.assertRaises(transcription.InvalidRecordingError):
                transcription.transcribe_audio('silent.wav')


if __name__ == '__main__':
    unittest.main()
