from threading import Lock


class TranscriptionError(RuntimeError):
    """The transcription model could not produce usable text."""


class InvalidRecordingError(TranscriptionError):
    """The recording cannot be decoded or contains no transcribable speech."""


_model = None
_model_lock = Lock()


def transcribe_audio(audio_path):
    """Transcribe English audio locally, reusing one Whisper small model."""
    import whisper

    try:
        audio = whisper.load_audio(audio_path)
    except (RuntimeError, ValueError) as exc:
        raise InvalidRecordingError("The recording could not be decoded.") from exc
    if audio.size == 0:
        raise InvalidRecordingError("The recording contains no audio.")

    # Serialize model loading/inference to avoid duplicate weights and overlapping
    # CPU-heavy requests on a development laptop.
    global _model
    try:
        with _model_lock:
            if _model is None:
                _model = whisper.load_model("small")
            result = _model.transcribe(audio, language="en", fp16=False)
        transcript = result["text"].strip()
    except Exception as exc:
        raise TranscriptionError("Local transcription failed.") from exc
    if not transcript:
        raise InvalidRecordingError("The recording contains no transcribable speech.")
    return transcript


if __name__ == "__main__":
    transcript = transcribe_audio(
        "test_audio/test_meeting.mp4"
    )

    print("\n--- RAW TRANSCRIPT ---\n")
    print(transcript)