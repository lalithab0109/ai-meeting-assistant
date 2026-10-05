import json

from transcription import TranscriptionError, transcribe_audio
from refinement import refine_transcript
from analysis import analyze_meeting


def process_meeting(audio_path):
    """Transcribe, refine, and analyze meeting audio."""
    try:
        raw_transcript = transcribe_audio(audio_path)
    except Exception as exc:
        raise TranscriptionError("The recording could not be transcribed.") from exc
    if not raw_transcript.strip():
        raise TranscriptionError("The recording contains no transcribable speech.")
    refined_transcript = refine_transcript(raw_transcript)
    analysis = analyze_meeting(refined_transcript)

    return {
        "raw_transcript": raw_transcript,
        "refined_transcript": refined_transcript,
        "analysis": analysis,
    }


if __name__ == "__main__":
    result = process_meeting("test_audio/test_meeting.mp4")

    print("\n--- RAW TRANSCRIPT ---\n")
    print(result["raw_transcript"])

    print("\n--- REFINED TRANSCRIPT ---\n")
    print(result["refined_transcript"])

    print("\n--- MEETING ANALYSIS ---\n")
    print(json.dumps(result["analysis"], indent=2))
