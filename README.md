# MeetingAI

MeetingAI converts English meeting recordings into raw and refined transcripts
and structured meeting documentation. It presents summaries, key points,
decisions, and action items, with Markdown and JSON downloads.

## Architecture

Audio upload → local Whisper Small transcription → Gemini 3.5 Flash-Lite
transcript refinement → separate Gemini 3.5 Flash-Lite meeting-analysis stage
→ structured meeting record + Markdown/JSON exports.

## Key features

- English recording upload: MP3, WAV, M4A, MP4, and WEBM.
- Raw transcript and domain-aware refined transcript, available for comparison.
- Summary, key points, decisions, and action items. Prompts require owners and
  deadlines to be supported by the transcript; missing values remain unspecified.
- Markdown and JSON downloads containing both transcripts and the meeting record.
- Clear processing/error states and manual retry for meeting analysis.

Review generated results against the recording; model output can contain errors.

## Tech stack

Next.js / React / TypeScript · FastAPI / Python · OpenAI Whisper Small ·
Gemini 3.5 Flash-Lite · FFmpeg.

## Setup and running

### Prerequisites

- Python **3.12**.
- Node.js **20.9+** and npm.
- FFmpeg available on **PATH**. On macOS with Homebrew:

  ```bash
  brew install ffmpeg
  ```

- A Gemini API key with access and available quota for `gemini-3.5-flash-lite`.
- Internet access for dependency installation, the initial Whisper model
  download, Gemini requests, and Google Fonts used by the frontend.

### Clone

```bash
git clone https://github.com/lalithab0109/ai-meeting-assistant.git
cd ai-meeting-assistant
```

### Backend

From the repository root, create and activate the virtual environment and
install dependencies (macOS/Linux):

```bash
python3.12 -m venv backend/venv
source backend/venv/bin/activate
python -m pip install -r backend/requirements.txt
cp backend/.env.example backend/.env
```

Edit `backend/.env` and replace the `GEMINI_API_KEY` placeholder with your own
key. Keep this file private. Then start FastAPI in the same terminal:

```bash
cd backend
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

The backend runs at http://localhost:8000; API documentation is available at
http://localhost:8000/docs. The first transcription downloads and loads Whisper
Small, so it may take longer.

### Frontend

In a separate terminal, from the repository root:

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:3000**. Keep both servers running. The backend allows
this frontend origin, and the frontend defaults to http://localhost:8000, so no
frontend environment file is needed for this setup.

## Usage

Upload a recording → **Process meeting** → review the raw transcript →
**Continue to meeting analysis** → inspect results → **Download Markdown** or
**Download JSON**.

## Example outputs

[examples/submission_example/](examples/submission_example/) contains an example
meeting recording (`meeting_recording.mp4`) and its generated Markdown
(`meeting_record.md`) and JSON (`meeting_record.json`) outputs.
[examples/test_recordings/](examples/test_recordings/) contains additional test
recordings.

## Technical documentation

See [TECHNICAL_DESCRIPTION.md](TECHNICAL_DESCRIPTION.md) for architecture,
model-choice, reliability, and validation details.


## Testing

After setup, run from the repository root:

```bash
backend/venv/bin/python -m pip install -r backend/requirements-dev.txt
backend/venv/bin/python -m unittest discover -s backend/tests -v
node --test frontend/tests/workflow.test.cjs
npm run typecheck --prefix frontend -- --incremental false
```
