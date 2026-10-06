# AI Meeting Assistant Remaining Issues Review

## Summary

The team reviewed remaining issues for the AI meeting assistant, confirming the use of Whisper and rejecting automatic API retries and PostgreSQL storage for the current version. Action items were assigned to Kavya and Arjun.

## Key Points

- Whisper will be kept for transcription in the current version despite technical word recognition issues.
- A custom dictionary of technical terms was discussed for transcript correction, but no implementation decision was made.
- Hallucination rules dictate that the meeting analysis model must not assign unassigned tasks.
- Evaluation of transcription accuracy on different accents is still unassigned.
- Automatic Gemini API retry was rejected to prevent API quota consumption; instead, a clear error and manual retry will be used.
- PostgreSQL storage for meeting history is not required for the first version and will not be added now.
- Speaker diarization was mentioned as potentially useful later, with no plan for the current release.
- A complete test from audio upload to downloading the final meeting recording must be run before submission.

## Decisions

- Keep Whisper for the current version rather than changing the speech-to-text model.
- Do not automatically retry the Gemini API upon failure; instead, display a clear error and allow manual retry.
- Do not add a database or store previous meetings in PostgreSQL for the first version.

## Action Items

- **Task:** Test the system using 3 noisy recordings
  - Owner: Kavya
  - Deadline: Wednesday evening

- **Task:** Evaluate the transcription accuracy on different accents
  - Owner: Unspecified
  - Deadline: Unspecified

- **Task:** Verify the markdown and JSON downloads
  - Owner: Arjun
  - Deadline: tomorrow morning

- **Task:** Run one complete test from audio upload all the way to downloading the final meeting recording before submission
  - Owner: Unspecified
  - Deadline: Unspecified

## Raw Transcript

```text
Okay, let's go through the remaining issues for the AI making assistant. So first whisper is working for transcription. Although we notice that technical words aren't recognized correctly, we are going to keep whisper for the current version rather than changing the speech-to-text model. For transcript correction we have discussed whether we should maintain a custom dictionary of technical terms that is an interesting option but we haven't decided to implement it. We have to keep that the refined transcript must preserve names, numbers, negations and commitments from the original conversation. Kavya will test the system using 3 noisy recordings before Wednesday evening. The second issue is hallucination. The meeting analysis model must not assign a task to somebody unless the speaker actually assigned it. For example, we still need someone to evaluate the transcription accuracy on different accents but nobody has volunteered for that yet and there was a proposal to automatically retry the Gemini API whenever a request fails. We decided not to do that because unnecessary retries could consume our API quota. Instead, the interface should display a clear error and allow the user to try again manually. We also consider storing the previous meetings in posture SQL but meeting history is not required for the first version. So we are not adding a database right now. Arjun will verify the markdown and JSON downloads tomorrow morning and someone also mentioned that adding speaker, a diarization could be useful later but it doesn't require any need or plan for the current release. And finally before the submission, we need to run one complete test from audio upload all the way to downloading the final meeting recording. We haven't assigned that final test to a specific person yet. Okay, that's everything.
```

## Refined Transcript

```text
Okay, let's go through the remaining issues for the AI meeting assistant. So first Whisper is working for transcription. Although we notice that technical words aren't recognized correctly, we are going to keep Whisper for the current version rather than changing the speech-to-text model. For transcript correction we have discussed whether we should maintain a custom dictionary of technical terms that is an interesting option but we haven't decided to implement it. We have to keep that the refined transcript must preserve names, numbers, negations and commitments from the original conversation. Kavya will test the system using 3 noisy recordings before Wednesday evening. The second issue is hallucination. The meeting analysis model must not assign a task to somebody unless the speaker actually assigned it. For example, we still need someone to evaluate the transcription accuracy on different accents but nobody has volunteered for that yet and there was a proposal to automatically retry the Gemini API whenever a request fails. We decided not to do that because unnecessary retries could consume our API quota. Instead, the interface should display a clear error and allow the user to try again manually. We also considered storing the previous meetings in PostgreSQL but meeting history is not required for the first version. So we are not adding a database right now. Arjun will verify the markdown and JSON downloads tomorrow morning and someone also mentioned that adding speaker diarization could be useful later but it doesn't require any need or plan for the current release. And finally before the submission, we need to run one complete test from audio upload all the way to downloading the final meeting recording. We haven't assigned that final test to a specific person yet. Okay, that's everything.
```
