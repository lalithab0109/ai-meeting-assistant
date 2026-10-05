const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const root = path.resolve(__dirname, '..');
const fixture = { refined_transcript: 'Refined Whisper transcript', title: 'Planning', summary: 'Concise summary', key_points: ['Important discussion'], decisions: ['Confirmed decision'], action_items: [{ task: 'Test audio', owner: null, deadline: null }] };

function loader(overrides = {}, globals = {}) {
  const cache = new Map();
  function load(name) {
    if (name in overrides) return overrides[name];
    if (!name.startsWith('@/')) return require(name);
    if (cache.has(name)) return cache.get(name);
    const base = path.join(root, name.slice(2));
    const file = ['.ts', '.tsx'].map(ext => base + ext).find(fs.existsSync);
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
    const module = { exports: {} };
    vm.runInNewContext(code, { module, exports: module.exports, require: load, console, process, AbortController, FormData, window: { setTimeout, clearTimeout }, ...globals }, { filename: file });
    cache.set(name, module.exports);
    return module.exports;
  }
  return load;
}

function hookHarness(globals = {}) {
  let slots = [], cursor = 0, cleanups = [];
  const react = {
    useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = initial; return [slots[index], value => { slots[index] = value; }]; },
    useRef(initial) { const index = cursor++; if (!(index in slots)) slots[index] = { current: initial }; return slots[index]; },
    useCallback: fn => fn,
    useEffect: fn => { if (!cleanups.length) cleanups.push(fn()); },
  };
  const hook = loader({ react }, globals)('@/hooks/useMeetingProcessing').useMeetingProcessing;
  return { render(transcript = 'Original Whisper transcript') { cursor = 0; return hook(transcript); }, cleanup() { cleanups.forEach(fn => fn?.()); } };
}

test('raw transcript and explicit continue action render and invoke callback', () => {
  const { RawTranscriptView } = loader()('@/components/RawTranscriptView');
  let continued = false;
  const tree = RawTranscriptView({ transcript: 'Original Whisper transcript', onBack() {}, onContinue() { continued = true; } });
  const html = renderToStaticMarkup(tree);
  assert.match(html, /Original Whisper transcript/);
  assert.match(html, /Continue to meeting analysis/);
  tree.props.children.find(child => child?.type === 'button' && child.props.children === 'Continue to meeting analysis').props.onClick();
  assert.equal(continued, true);
});

test('results render all sections, graceful nulls, expandable original transcript and empty states', () => {
  const { MeetingResults } = loader()('@/components/MeetingResults');
  const html = renderToStaticMarkup(React.createElement(MeetingResults, { result: fixture, transcript: 'Original Whisper transcript', onTranscript() {}, onStartOver() {} }));
  for (const text of ['Planning', 'Summary', 'Concise summary', 'Key points', 'Important discussion', 'Decisions', 'Confirmed decision', 'Action items', 'Test audio', 'Unassigned', 'No deadline', 'Original Whisper transcript', 'Back to transcript']) assert.ok(html.includes(text), text);
  assert.match(html, /<details/);
  const empty = renderToStaticMarkup(React.createElement(MeetingResults, { result: { ...fixture, decisions: [], key_points: [], action_items: [] }, transcript: 'Original', onTranscript() {}, onStartOver() {} }));
  assert.match(empty, /No decisions recorded/);
  assert.match(empty, /No action items recorded/);
});

test('meeting hook posts correct transcript, prevents duplicate requests, exposes loading and result', async () => {
  let calls = [], resolve;
  const harness = hookHarness({ fetch: (...args) => { calls.push(args); return new Promise(done => { resolve = done; }); } });
  const first = harness.render();
  const request = first.start();
  await first.start();
  assert.equal(calls.length, 1);
  assert.equal(harness.render().loading, true);
  assert.match(calls[0][0], /\/api\/process$/);
  assert.equal(calls[0][1].method, 'POST');
  assert.equal(JSON.parse(calls[0][1].body).transcript, 'Original Whisper transcript');
  resolve({ ok: true, json: async () => fixture });
  await request;
  assert.equal(harness.render().result.title, fixture.title);
  assert.equal(harness.render().loading, false);
  harness.cleanup();
});

test('failure allows retry with same transcript; malformed responses and network errors are safe', async () => {
  let calls = 0;
  const bodies = [];
  const harness = hookHarness({ fetch: async (url, options) => { bodies.push(JSON.parse(options.body)); return ++calls === 1 ? { ok: false, status: 500 } : { ok: true, json: async () => fixture }; } });
  await harness.render().start();
  assert.match(harness.render().error, /Please try again/);
  await harness.render().retry();
  assert.equal(harness.render().result.title, 'Planning');
  assert.equal(bodies[0].transcript, bodies[1].transcript);
  for (const fetch of [async () => ({ ok: true, json: async () => ({ title: 'broken' }) }), async () => ({ ok: true, json: async () => { throw new SyntaxError('secret response'); } }), async () => { throw new TypeError('network'); }]) {
    const h = hookHarness({ fetch }); await h.render().start();
    assert.ok(h.render().error); assert.equal(h.render().result, null); assert.ok(!h.render().error.includes('secret'));
  }
});

test('empty input, cancellation and timeout do not leave loading stuck', async () => {
  const empty = hookHarness({ fetch: () => { throw Error('Should not call'); } });
  await empty.render(' ').start(); assert.match(empty.render(' ').error, /non-empty/);
  let signal, resolve;
  const cancelled = hookHarness({ fetch: (url, options) => { signal = options.signal; return new Promise(done => { resolve = done; }); } });
  const request = cancelled.render().start(); cancelled.render().cancel();
  assert.equal(signal.aborted, true); assert.equal(cancelled.render().loading, false);
  resolve({ ok: true, json: async () => fixture }); await request; assert.equal(cancelled.render().result, null);
  let timeout;
  const h = hookHarness({ window: { setTimeout: fn => { timeout = fn; return 1; }, clearTimeout() {} }, fetch: (url, options) => new Promise((resolve, reject) => options.signal.addEventListener('abort', () => reject(new Error('aborted')))) });
  const timed = h.render().start(); timeout(); await timed; assert.match(h.render().error, /timed out/); assert.equal(h.render().loading, false);
});

test('processing view retains transcript on analysis failure and renders retry/back controls', () => {
  let show = false, starts = 0, retries = 0;
  const meeting = { loading: false, result: null, error: '', start: () => { starts++; }, retry: () => { retries++; }, cancel() {} };
  const load = loader({ react: { useState: () => [show, value => { show = value; }], useRef: () => ({ current: null }), useEffect() {} }, '@/hooks/useTranscription': { useTranscription: () => ({ phase: 'complete', transcript: 'Original Whisper transcript', error: '' }) }, '@/hooks/useMeetingProcessing': { useMeetingProcessing: transcript => { assert.equal(transcript, 'Original Whisper transcript'); return meeting; } } });
  const { ProcessingView } = load('@/components/ProcessingView');
  const props = { file: { name: 'meeting.wav', size: 100 }, onBack() {} };
  let html = renderToStaticMarkup(ProcessingView(props));
  assert.match(html, /Original Whisper transcript/); assert.equal(starts, 0);
  function find(node, predicate) { if (!node || typeof node !== 'object') return null; if (predicate(node)) return node; for (const child of [node.props?.children].flat(Infinity)) { const found = find(child, predicate); if (found) return found; } return null; }
  const raw = find(ProcessingView(props), node => typeof node.props?.onContinue === 'function'); raw.props.onContinue(); assert.equal(starts, 1);
  meeting.loading = true; html = renderToStaticMarkup(ProcessingView(props)); assert.match(html, /In progress/);
  meeting.loading = false; meeting.error = 'Try again'; const errorTree = ProcessingView(props); html = renderToStaticMarkup(errorTree); assert.match(html, /Retry/); assert.match(html, /Back to transcript/);
  find(errorTree, node => node.type === 'button' && node.props.children === 'Retry').props.onClick(); assert.equal(retries, 1);
  find(errorTree, node => node.type === 'button' && node.props.children === 'Back to transcript').props.onClick(); html = renderToStaticMarkup(ProcessingView(props)); assert.match(html, /Original Whisper transcript/);
  show = true; meeting.error = ''; meeting.result = fixture; html = renderToStaticMarkup(ProcessingView(props)); assert.match(html, /Concise summary/); assert.ok(!html.includes('Meeting processing stages')); assert.match(html, /Processing complete/); assert.ok(!html.includes('Development mock'));
});

test('existing transcription request lifecycle still sends multipart and handles completion/errors/cancellation', () => {
  let state, effect, xhr;
  class XHR { constructor() { xhr = this; this.upload = {}; } open(method, url) { this.method = method; this.url = url; } send(body) { this.body = body; } abort() { this.onabort(); } }
  const hook = loader({ react: { useState: initial => [state = initial, value => { state = value; }], useEffect: fn => { effect = fn; } } }, { XMLHttpRequest: XHR })('@/hooks/useTranscription').useTranscription;
  hook(new File(['audio'], 'meeting.wav')); const cleanup = effect();
  assert.match(xhr.url, /\/api\/transcribe$/); assert.equal(xhr.body.get('file').name, 'meeting.wav');
  xhr.upload.onload(); assert.equal(state.phase, 'transcribing');
  xhr.status = 200; xhr.response = { success: true, rawTranscript: 'Real text' }; xhr.onload(); assert.equal(state.transcript, 'Real text');
  xhr.onerror(); assert.equal(state.phase, 'error'); xhr.ontimeout(); assert.match(state.error, /timed out/);
  const before = state; cleanup(); xhr.onload(); assert.equal(state, before);
});

test('Gemini quota/service errors are clear and refined transcript is required by the contract', async () => {
  for (const [status, message] of [[429, 'AI service usage limit reached. Please try again later.'], [503, 'AI processing is temporarily unavailable. Please try again.']]) {
    const h = hookHarness({ fetch: async () => ({ ok: false, status }) });
    await h.render().start();
    assert.equal(h.render().error, message);
    assert.equal(h.render().result, null);
  }
  const { isMeetingResult } = loader()('@/types/meeting');
  assert.equal(isMeetingResult(fixture), true);
  assert.equal(isMeetingResult({ ...fixture, refined_transcript: undefined }), false);
  assert.equal(isMeetingResult({ ...fixture, refined_transcript: ' ' }), false);
});

test('results compare actual raw/refined values with distinct labels and preserve navigation', () => {
  const { MeetingResults } = loader()('@/components/MeetingResults');
  let back = 0, newRecording = 0;
  const raw = 'Original words from selected recording, not a fixture fallback.';
  const refined = 'Corrected terms returned by the meeting processing response.';
  const tree = MeetingResults({ result: { ...fixture, refined_transcript: refined }, transcript: raw, onTranscript() { back++; }, onStartOver() { newRecording++; } });
  const html = renderToStaticMarkup(tree);
  for (const value of [raw, refined, 'Raw Transcript', 'Refined Transcript', 'Raw &amp; refined transcripts']) assert.ok(html.includes(value), value);
  assert.match(html, /<details/);
  assert.match(html, /md:grid-cols-2/);
  function buttons(node) {
    if (!node || typeof node !== 'object') return [];
    return (node.type === 'button' ? [node] : []).concat([node.props?.children].flat(Infinity).flatMap(buttons));
  }
  const controls = buttons(tree);
  controls.find(button => [button.props.children].flat().includes('Back to transcript')).props.onClick();
  controls.find(button => button.props.children === 'New recording').props.onClick();
  assert.equal(back, 1); assert.equal(newRecording, 1);
});

test('comparison safely handles absent/invalid refined text without substituting content', () => {
  const { TranscriptComparison } = loader()('@/components/TranscriptComparison');
  for (const refinedTranscript of [undefined, null, '', '  ', 123, {}]) {
    const html = renderToStaticMarkup(React.createElement(TranscriptComparison, { rawTranscript: 'Actual raw text', refinedTranscript }));
    assert.match(html, /Actual raw text/);
    assert.match(html, /Refined transcript unavailable/);
    assert.match(html, /Refined Transcript/);
  }
  const source = fs.readFileSync(path.join(root, 'components/TranscriptComparison.tsx'), 'utf8');
  assert.ok(!source.includes(fixture.refined_transcript));
  assert.ok(!source.includes('fast API'));
  assert.ok(!source.includes('posture SQL'));
  const html = renderToStaticMarkup(React.createElement(TranscriptComparison, { rawTranscript: 'a'.repeat(1000), refinedTranscript: 'b'.repeat(1000) }));
  assert.match(html, /overflow-wrap:anywhere/);
});

test('Markdown/JSON exports reflect displayed data, preserve transcripts and handle null/empty sections', () => {
  const { meetingMarkdown, meetingJSON } = loader()('@/lib/meetingExport');
  const raw = 'Original raw recording text\nWith a second line and ``` backticks.';
  const refined = 'Actual refined text';
  const result = { ...fixture, refined_transcript: refined };
  const md = meetingMarkdown(result, raw);
  for (const value of [fixture.title, fixture.summary, fixture.key_points[0], fixture.decisions[0], fixture.action_items[0].task, raw, refined, 'Owner: Unspecified', 'Deadline: Unspecified']) assert.ok(md.includes(value), value);
  assert.match(md, /````text/);
  assert.equal(JSON.stringify(JSON.parse(meetingJSON(result, raw))), JSON.stringify({ title: result.title, summary: result.summary, key_points: result.key_points, decisions: result.decisions, action_items: result.action_items, refined_transcript: refined, raw_transcript: raw }));
  const json = JSON.parse(meetingJSON(result, raw));
  assert.equal(json.action_items[0].owner, null); assert.equal(json.action_items[0].deadline, null);
  const empty = meetingMarkdown({ ...result, key_points: [], decisions: [], action_items: [] }, raw);
  for (const message of ['No key points recorded.', 'No decisions recorded.', 'No action items recorded.']) assert.ok(empty.includes(message));
  const assigned = meetingMarkdown({ ...result, action_items: [{ task: 'Review', owner: 'Taylor', deadline: 'Friday' }] }, raw);
  assert.match(assigned, /Owner: Taylor/); assert.match(assigned, /Deadline: Friday/);
});

test('export filenames sanitize path/control/punctuation, reserved names and missing usable titles', () => {
  const { meetingFilename } = loader()('@/lib/meetingExport');
  assert.equal(meetingFilename('Backend Architecture Meeting', 'md'), 'backend-architecture-meeting.md');
  assert.equal(meetingFilename('../../API: planning\\notes?\n<>|*', 'json'), 'api-planning-notes.json');
  assert.equal(meetingFilename('  ***  ', 'md'), 'meeting-record.md');
  assert.equal(meetingFilename('CON', 'json'), 'meeting-con.json');
  assert.equal(meetingFilename('Café Review', 'md'), 'cafe-review.md');
  assert.ok(meetingFilename('a'.repeat(300), 'json').length <= 105);
});

test('export buttons use current result/raw state with no processing calls', () => {
  const downloads = [];
  const { MeetingExportControls } = loader({ '@/lib/meetingExport': { downloadMeeting: (...args) => downloads.push(args) } }, { fetch: () => { throw Error('Network forbidden'); } })('@/components/MeetingExportControls');
  const tree = MeetingExportControls({ result: fixture, rawTranscript: 'Actual raw text' });
  const html = renderToStaticMarkup(tree);
  assert.match(html, /Download Markdown/); assert.match(html, /Download JSON/);
  tree.props.children[0].props.onClick(); tree.props.children[1].props.onClick();
  assert.equal(downloads.length, 2);
  assert.equal(downloads[0][0], fixture); assert.equal(downloads[0][1], 'Actual raw text'); assert.equal(downloads[0][2], 'md');
  assert.equal(downloads[1][2], 'json');
});

test('browser download uses correct Blob and cleans up link and object URL', async () => {
  for (const format of ['md', 'json']) {
    let blob, clicked = false, removed = false, revoked = false, callback;
    const link = { click() { clicked = true; }, remove() { removed = true; } };
    const globals = {
      Blob,
      URL: { createObjectURL(value) { blob = value; return 'blob:local-export'; }, revokeObjectURL(url) { assert.equal(url, 'blob:local-export'); revoked = true; } },
      document: { createElement(name) { assert.equal(name, 'a'); return link; }, body: { appendChild(value) { assert.equal(value, link); } } },
      window: { setTimeout(fn) { callback = fn; } },
      fetch() { throw Error('No API call allowed'); },
    };
    const { downloadMeeting } = loader({}, globals)('@/lib/meetingExport');
    downloadMeeting(fixture, 'Original state text', format);
    assert.ok(clicked && removed); assert.equal(link.download, `planning.${format}`);
    assert.equal(revoked, false); callback(); assert.equal(revoked, true);
    const content = await blob.text();
    if (format === 'json') assert.equal(JSON.parse(content).raw_transcript, 'Original state text');
    else assert.ok(content.includes('Original state text'));
  }
});

test('results use independent responsive grids and a constrained single decision', () => {
  const { MeetingResults } = loader()('@/components/MeetingResults');
  const props = { result: { ...fixture, key_points: ['One', 'Two', 'Three', 'Four', 'Five'], decisions: ['Only decision'] }, transcript: 'Raw', onTranscript() {}, onStartOver() {} };
  const single = renderToStaticMarkup(React.createElement(MeetingResults, props));
  assert.match(single, /data-meeting-results/);
  assert.match(single, /max-w-prose/);
  assert.match(single, /grid items-stretch gap-2.5 lg:grid-cols-2/);
  assert.match(single, /grid items-stretch gap-3 lg:grid-cols-2/);
  const multiple = renderToStaticMarkup(React.createElement(MeetingResults, { ...props, result: { ...props.result, decisions: ['First decision', 'Second decision'] } }));
  assert.ok(!multiple.includes('max-w-prose'));
  assert.match(multiple, /grid items-stretch gap-3 lg:grid-cols-2/);
  const page = fs.readFileSync(path.join(root, 'app/page.tsx'), 'utf8');
  assert.ok(page.includes('max-w-3xl has-[[data-meeting-results]]:max-w-6xl'));
});
