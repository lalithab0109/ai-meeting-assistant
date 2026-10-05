import logging
import shutil
import tempfile
from pathlib import Path
from typing import Annotated

from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.exception_handlers import request_validation_exception_handler
from fastapi.middleware.cors import CORSMiddleware
from google.genai import errors
from google.genai._gaos.lib.compat_errors import APIError as InteractionsAPIError

from transcription import InvalidRecordingError, TranscriptionError, transcribe_audio
from fastapi.responses import JSONResponse


from meeting_models import MeetingProcessRequest, MeetingResult
from meeting_processor import process_transcript


logger = logging.getLogger(__name__)


app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

@app.exception_handler(RequestValidationError)
async def invalid_request(request: Request, exc: RequestValidationError):
    if request.url.path == "/api/transcribe":
        return JSONResponse(status_code=400, content={"success": False, "error": "Provide one recording as a multipart file using the 'file' field."})
    return await request_validation_exception_handler(request, exc)


SUPPORTED_EXTENSIONS = {".mp3", ".wav", ".m4a", ".mp4", ".webm"}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/api/meetings/process")
def process_recording(file: Annotated[UploadFile | None, File()] = None):
    # Optional at the framework level so a missing file returns 400, not 422.
    if file is None:
        raise HTTPException(status_code=400, detail="Upload a recording using the 'file' field.")

    try:
        if not file.filename:
            raise HTTPException(status_code=400, detail="The recording must have a filename.")
        extension = Path(file.filename).suffix.lower()
        if extension not in SUPPORTED_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail="Unsupported recording format. Use .mp3, .wav, .m4a, .mp4, or .webm.",
            )
        if not file.file.read(1):
            raise HTTPException(status_code=400, detail="The uploaded recording is empty.")
        file.file.seek(0)

        # The directory context deletes the recording on success and failure.
        # Close the file before Whisper/FFmpeg opens it, including on Windows.
        with tempfile.TemporaryDirectory(prefix="meeting-") as directory:
            with tempfile.NamedTemporaryFile(
                dir=directory, suffix=extension, delete=False
            ) as recording:
                shutil.copyfileobj(file.file, recording)
                audio_path = recording.name
            from pipeline import process_meeting

            return process_meeting(audio_path)
    except HTTPException:
        raise
    except TranscriptionError as exc:
        raise HTTPException(
            status_code=400,
            detail="The recording could not be transcribed. Upload readable audio containing speech.",
        ) from exc
    except RuntimeError as exc:
        # Stage failures retain the original Gemini exception as their cause.
        cause = exc.__cause__
        status_code = None
        if isinstance(cause, errors.APIError):
            status_code = cause.code
        elif isinstance(cause, InteractionsAPIError):
            status_code = cause.status_code
        if status_code == 429:
            raise HTTPException(
                status_code=429,
                detail="AI service usage limit reached. Please try again later.",
            ) from exc
        if status_code in (500, 502, 503, 504):
            raise HTTPException(
                status_code=503,
                detail="AI processing is temporarily unavailable. Please try again.",
            ) from exc
        logger.exception("Runtime error while processing meeting")
        raise HTTPException(
            status_code=500, detail="The meeting could not be processed. Please try again."
        ) from exc
    except Exception as exc:
        logger.exception("Unexpected error while processing meeting")
        raise HTTPException(
            status_code=500, detail="The meeting could not be processed. Please try again."
        ) from exc
    finally:
        file.file.close()


@app.post("/api/transcribe")
def transcribe_recording(file: Annotated[UploadFile | None, File()] = None):
    """Stage 1 only: no Gemini client or pipeline imports are needed."""
    if file is None:
        return JSONResponse(status_code=400, content={"success": False, "error": "Upload a recording using the 'file' field."})
    try:
        if not file.filename:
            return JSONResponse(status_code=400, content={"success": False, "error": "The recording must have a filename."})
        extension = Path(file.filename).suffix.lower()
        if extension not in SUPPORTED_EXTENSIONS:
            return JSONResponse(status_code=400, content={"success": False, "error": "Unsupported recording format. Use .mp3, .wav, .m4a, .mp4, or .webm."})
        if not file.file.read(1):
            return JSONResponse(status_code=400, content={"success": False, "error": "The uploaded recording is empty."})
        file.file.seek(0)
        with tempfile.TemporaryDirectory(prefix="transcription-") as directory:
            with tempfile.NamedTemporaryFile(dir=directory, suffix=extension, delete=False) as recording:
                shutil.copyfileobj(file.file, recording)
                audio_path = recording.name
            transcript = transcribe_audio(audio_path)
        return {
            "success": True,
            "rawTranscript": transcript,
            "metadata": {"filename": file.filename, "language": "en"},
        }
    except InvalidRecordingError:
        return JSONResponse(status_code=400, content={"success": False, "error": "The recording is unreadable or contains no transcribable speech. Please choose another recording."})
    except Exception:
        logger.exception("Local transcription failed")
        return JSONResponse(status_code=500, content={"success": False, "error": "Local transcription failed. Please check the server setup and try again."})
    finally:
        file.file.close()


@app.post("/api/process", response_model=MeetingResult)
def process_transcript_record(request: MeetingProcessRequest):
    try:
        return process_transcript(request.transcript)
    except Exception as exc:
        logger.exception("Meeting processor failed")
        cause = exc.__cause__ if isinstance(exc, RuntimeError) else exc
        status_code = None
        if isinstance(cause, errors.APIError):
            status_code = cause.code
        elif isinstance(cause, InteractionsAPIError):
            status_code = cause.status_code
        if status_code == 429:
            raise HTTPException(status_code=429, detail="AI service usage limit reached. Please try again later.") from exc
        if status_code in (500, 502, 503, 504):
            raise HTTPException(status_code=503, detail="AI processing is temporarily unavailable. Please try again.") from exc
        raise HTTPException(status_code=500, detail="Meeting processing failed. Please try again.") from exc
