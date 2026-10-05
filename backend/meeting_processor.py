from meeting_models import MeetingAnalysis, MeetingResult


def refine_transcript(raw_transcript):
    # Lazy imports keep health/transcription usable without Gemini credentials.
    from refinement import refine_transcript as refine
    return refine(raw_transcript)


def analyze_meeting(refined_transcript):
    from analysis import analyze_meeting as analyze
    return analyze(refined_transcript)


def process_transcript(transcript: str) -> MeetingResult:
    """Run distinct refinement and analysis stages behind the stable API."""
    if not transcript.strip():
        raise ValueError("Transcript must not be empty.")
    refined = refine_transcript(transcript)
    if not isinstance(refined, str) or not refined.strip():
        raise ValueError("Refinement returned an empty or invalid transcript.")
    analysis = MeetingAnalysis.model_validate(analyze_meeting(refined))
    return MeetingResult(**analysis.model_dump(), refined_transcript=refined)
