import os
from dotenv import load_dotenv
from google import genai
from google.genai import errors
from google.genai._gaos.utils.retries import RetryConfig
from google.genai._gaos.lib.compat_errors import APIError as InteractionsAPIError

# Load variables from .env
load_dotenv()

# Create Gemini client
# Make one request only; disable both parent-client and Interactions retries.
client = genai.Client(
    api_key=os.getenv("GEMINI_API_KEY"),
    http_options={"retry_options": {"attempts": 1}},
)
client.interactions.sdk_configuration.retry_config = RetryConfig("none", None, False)


def refine_transcript(raw_transcript):
    """
    Correct plausible speech-recognition errors without changing
    the meaning of the meeting.
    """

    prompt = f"""
You are a transcript refinement system.

Your task is to correct plausible speech-recognition errors in a meeting
transcript, especially errors involving technical terminology, acronyms,
product names, and domain-specific language.

STRICT RULES:
- Preserve the speaker's intended meaning.
- Do not summarize the transcript.
- Do not add information that is not present.
- Do not remove information.
- Preserve names, numbers, deadlines, negations, commitments, and assignments.
- Never invent a person's name, task owner, deadline, decision, or commitment.
- Correct a phrase only when the correction is strongly supported by context.
- If you are uncertain about a correction, preserve the original wording.
- Return only the refined transcript. Do not explain your corrections.

RAW TRANSCRIPT:
{raw_transcript}
"""

    try:
        response = client.interactions.create(
            model="gemini-3.5-flash-lite",
            input=prompt
        )
    except (errors.APIError, InteractionsAPIError) as exc:
        status_code = exc.code if isinstance(exc, errors.APIError) else exc.status_code
        if status_code == 429:
            raise RuntimeError(
                "Transcript refinement failed because the AI service usage "
                "limit was reached (quota exhausted or rate limited)."
            ) from exc
        if status_code in (500, 502, 503, 504):
            raise RuntimeError(
                "Transcript refinement failed because the AI service "
                "was temporarily unavailable."
            ) from exc
        raise

    return response.output_text.strip()
