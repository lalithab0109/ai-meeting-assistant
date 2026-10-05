# MeetingAI

MeetingAI is an AI-powered meeting assistant. It accepts an English meeting
recording and produces a raw transcript, refined transcript, summary, key points,
decisions, and action items. The results UI provides transcript comparison and
Markdown/JSON downloads.

## Architecture

```text
Recording
  → local OpenAI Whisper small
  → raw transcript
  → Gemini 3.5 Flash-Lite Stage 1: conservative transcript refinement
  → refined transcript
  → Gemini 3.5 Flash-Lite Stage 2: meeting analysis
  → validated structured result
  → Next.js results UI
  → Markdown / JSON export
```

The two Gemini roles are separate stages, with separate prompts and separate
Interactions API calls. Both use model ID `gemini-3.5-flash-lite`.

The frontend first uploads to `/api/transcribe`. After viewing the raw transcript,
the user explicitly chooses **Continue to meeting analysis**, which sends the
transcript to `/api/process`. `backend/meeting_processor.py` orchestrates refinement
and analysis without repeating transcription. The original transcript remains in
frontend state; the backend returns the refined version with the meeting result.

## Tech stack

- Next.js, React, TypeScript, Tailwind CSS, and Lucide icons
- Python and FastAPI
- OpenAI Whisper `small`, running locally
- Gemini 3.5 Flash-Lite through `google-genai`
- Pydantic schema validation
- FFmpeg for decoding audio from supported recordings

## Prerequisites

- Python **3.12**
- Node.js **20.9+** and npm
- FFmpeg installed separately and available on PATH:
  - macOS: `brew install ffmpeg`
  - Ubuntu/Debian: `sudo apt install ffmpeg`
- A Gemini API key with access/quota for the configured model
- Internet access for dependency installation, the initial Whisper model
  download, Gemini requests, and potentially Google Fonts during frontend builds

Whisper loads lazily on the first transcription request and reuses the model.
Weights are cached outside the repository; local inference is serialized to avoid
concurrent model work on a development laptop. Supported formats are MP3, WAV,
M4A, MP4, and WEBM. Temporary uploads are removed after success or failure.

## Setup and development servers

Run from the repository root:

```bash
# Create only if backend/venv does not already exist.
python3.12 -m venv backend/venv
backend/venv/bin/python -m pip install -r backend/requirements.txt

# Copy only if backend/.env does not already exist.
cp backend/.env.example backend/.env
```

Edit `backend/.env` locally and replace the placeholder with your own
`GEMINI_API_KEY`. Never commit this file or a real key. `/health` and
`/api/transcribe` do not require Gemini credentials; meeting analysis does.

Start FastAPI:

```bash
cd backend
venv/bin/python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

In another terminal, from the repository root:

```bash
npm install --prefix frontend
npm run dev --prefix frontend
```

Open http://localhost:3000. The backend is at http://localhost:8000, with API docs
at http://localhost:8000/docs. Development CORS allows http://localhost:3000.

The frontend defaults to http://localhost:8000. To override it, copy
`frontend/.env.example` to `frontend/.env.local`, set `NEXT_PUBLIC_API_BASE_URL`,
and restart Next.js. The example contains no secret.

## API

| Endpoint | Input | Behavior |
|---|---|---|
| `GET /health` | None | Returns `{ "status": "ok" }` |
| `POST /api/transcribe` | One multipart file, field `file` | Runs local Whisper and returns `success`, `rawTranscript`, and filename/language metadata |
| `POST /api/process` | JSON `{ "transcript": "non-empty raw transcript" }` | Refines, analyzes, validates, and returns the structured meeting result |
| `POST /api/meetings/process` | One multipart file, field `file` | Retained one-shot/legacy-compatible route: transcription, refinement, and analysis in one request |

The frontend uses the separate transcription and processing endpoints. The
legacy route returns `{ "raw_transcript": "...", "refined_transcript": "...",
"analysis": { ... } }`, with canonical analysis fields nested under `analysis`.

## Result contract

`POST /api/process` returns:

```json
{
  "title": "Meeting title",
  "summary": "Concise meeting summary",
  "key_points": ["Discussion point"],
  "decisions": ["Confirmed decision"],
  "action_items": [
    { "task": "Actionable task", "owner": null, "deadline": null }
  ],
  "refined_transcript": "Refined transcript text"
}
```

All lists may be empty. Action-item owner/deadline values are strings or `null`
when not explicitly stated. Pydantic validates the model output; malformed
results are rejected rather than replaced with fabricated content.

## UI and exports

The UI presents upload, transcription, analysis, completion, and error states.
Results include summary, key points, decisions, and action-item metadata.
Expandable raw/refined transcript comparison is side by side on desktop and
stacked on smaller screens. Analysis failures preserve the raw transcript and
provide Retry/Back controls without requiring transcription again.

**Download Markdown** and **Download JSON** use the displayed result and raw
transcript locally, without further model or API calls. Both include raw and
refined transcripts. JSON preserves null owners/deadlines and adds `raw_transcript`
to the result fields. Markdown presents missing owners/deadlines as
“Unspecified.” Filenames are sanitized from the meeting title.

## Model behavior

- Stage 1 conservatively corrects plausible transcription and technical
  terminology errors without intentionally changing meaning or summarizing.
- Stage 2 extracts meeting information from the refined transcript.
- Proposals and tentative language must not be promoted to confirmed decisions.
- Names, numbers, negations, and commitments should be preserved.
- Owners and deadlines must not be invented; actionable tasks can be unassigned.
- Relative deadlines are preserved rather than converted to guessed dates.

These are prompt constraints, not a guarantee that every model output is correct.
Review generated results against the recording/transcripts.

## Error handling

- Missing, empty, unsupported, or unreadable recordings receive clear errors.
- Local model/transcription failures receive safe server-error responses.
- Empty, whitespace-only, malformed, or extra `/api/process` request fields are
  rejected with HTTP 422.
- Gemini quota/rate-limit errors return HTTP 429 with a usage-limit message.
- Gemini HTTP 500/502/503/504 failures map to HTTP 503.
- Unexpected failures and malformed model output return safe HTTP 500 responses;
  diagnostic details are logged on the server rather than sent to clients.

Each Gemini stage performs **one request per invocation**. There are no automatic
application retries, SDK retries for these calls, or automatic model fallbacks.
A successful analysis uses two Gemini requests: one refinement and one analysis.
The frontend Retry action starts a new processing invocation.

The frontend handles unavailable backend, invalid responses, and cancellation.
Transcription requests time out after ten minutes; meeting processing requests
after 30 seconds. Leaving a view aborts the browser request but does not stop
inference or Gemini processing already running on the server. Upload status
reflects browser transfer completion; server stage progress is not streamed.

## Testing and validation

From the repository root:

```bash
backend/venv/bin/python -m pip install -r backend/requirements-dev.txt
backend/venv/bin/python -m unittest discover -s backend/tests -v
node --test frontend/tests/workflow.test.cjs
npm run typecheck --prefix frontend -- --incremental false
npm run build --prefix frontend -- --webpack
```

The current automated suite has **19 backend tests** and **15 frontend tests**.
Backend tests mock model calls and HTTP transport; no Gemini credits or Whisper
model downloads are required. Frontend checks cover rendering, request
lifecycles/errors, transcript comparison, exports, and layout assertions using
Node's test runner. They are not full browser automation.

The webpack production build is used because Turbopack encountered an execution
environment permission issue during development. Geist font bundling may require
Google Fonts access on a cold build.

## Limitations

- English-focused transcription and processing
- Local Whisper speed and memory requirements depend on the machine and recording
- No speaker diarization
- Gemini requires network/API availability, configured credentials, and quota
- No persistent meeting history/database; refreshing loses in-memory results
- Relative deadlines are not resolved to calendar dates
- Generated semantic accuracy still requires human review
- Local development configuration; backend CORS/origins require review for hosting
