# MeetingAI — Technical Description

## 1. System Architecture

MeetingAI is an end-to-end meeting assistant that converts an English meeting recording into a raw transcript, a refined transcript, and a structured meeting record containing a summary, key points, decisions, and action items.

The processing pipeline is:

```text
Meeting Recording
        ↓
OpenAI Whisper Small
        ↓
Raw Transcript
        ↓
Gemini 3.5 Flash-Lite — Transcript Refinement
        ↓
Refined Transcript
        ↓
Gemini 3.5 Flash-Lite — Meeting Analysis
        ↓
Structured Meeting Record
        ↓
Interactive UI + Markdown / JSON Downloads
```

After a recording is selected and the user clicks **Process meeting**, the stages are executed as one coordinated workflow. The raw and refined transcripts are both retained so that users can inspect what changed during refinement before using the generated meeting record.

---

## 2. Speech Recognition — OpenAI Whisper Small

The first stage uses **OpenAI Whisper Small** to convert the uploaded meeting recording into text. Whisper runs locally in the Python backend and produces the raw transcript that becomes the input to the language-model pipeline.

### Why Whisper?

Whisper was chosen because it provides pretrained general-purpose speech recognition suitable for conversational English without requiring an ASR model to be trained from scratch. Running it locally also avoids dependence on a paid speech-to-text API and integrates naturally with the Python/FastAPI backend.

Hosted speech APIs and other pretrained ASR systems were possible alternatives, but local Whisper provided a suitable balance of transcription quality, portability, cost, and implementation complexity for this project.

### Why Whisper Small?

Whisper variants involve a trade-off between recognition quality and computational requirements. Larger variants can perform better on difficult audio but require more memory and computation and generally increase processing time. Very small variants are lighter but may lose recognition quality.

The **small** variant was therefore selected as a practical middle ground between transcription quality, local CPU feasibility, memory usage, and latency. This choice prioritizes a usable local application rather than maximum possible ASR accuracy.

The Whisper model is loaded lazily and reused across requests instead of being reloaded for every recording.

---

## 3. Language-Model Processing

MeetingAI uses two distinct language-model processing stages after transcription. Both currently use **Gemini 3.5 Flash-Lite**, but they are independent stages with separate API calls, prompts, responsibilities, and output contracts.

### Stage 1 — Domain-Aware Transcript Refinement

The first Gemini stage receives the raw Whisper transcript and performs conservative transcript correction. Its purpose is not to summarize or rewrite the conversation, but to correct plausible ASR errors involving technical terminology, acronyms, product names, frameworks, and other domain-specific language.

The refinement prompt explicitly instructs the model to preserve names, numbers, negations, commitments, assignments, and deadlines. It must not add information, remove information, summarize the meeting, or guess uncertain corrections.

During manual testing, this stage successfully corrected transcription errors such as:

- `Fast API` → `FastAPI`
- `posture SQL` → `PostgreSQL`
- `Varsal` → `Vercel`

The resulting text becomes the **refined transcript** and is passed to the next stage.

### Stage 2 — Meeting Documentation

The second Gemini stage receives the refined transcript and converts it into a structured meeting record containing:

- meeting title
- concise summary
- key points
- decisions
- action items

This stage is specifically instructed to distinguish confirmed decisions from proposals, suggestions, and rejected ideas. Task owners and deadlines are included only when supported by the transcript; otherwise they remain unspecified.

The generated response is parsed and validated against the application's structured schema before being sent to the frontend. This ensures that the frontend receives a consistent representation of the meeting record.

### Why Gemini 3.5 Flash-Lite?

The two language-model tasks are relatively focused: contextual terminology correction and structured information extraction. They require good contextual understanding and instruction following, but do not require the largest available language model.

**Gemini 3.5 Flash-Lite** was selected as a practical balance between capability, response time, availability, and cost. Its lightweight nature is appropriate for an interactive application, while its contextual language capabilities are sufficient for identifying technical corrections and extracting structured meeting information. It also allowed the project to operate within available free-tier constraints rather than depending on a paid LLM service.

The choice is therefore an engineering trade-off for this application's requirements rather than a claim that Gemini 3.5 Flash-Lite is universally superior to other language models.

### Why Two Separate LLM Stages?

Transcript refinement and meeting analysis are deliberately separated instead of being combined into one large prompt. Refinement has one narrow responsibility: improve transcription errors without changing meaning. Analysis then operates on that cleaner transcript to extract higher-level meeting information.

This separation makes the intermediate refined transcript inspectable, allows stricter task-specific prompts, and makes failures easier to identify. It also prevents transcript correction and summarization from competing within the same generation step.

---

## 4. Reliability and Hallucination Control

Because generative language models can produce plausible but unsupported information, the pipeline is designed to reduce this risk rather than assume that model output is always correct.

Transcript refinement is deliberately conservative, while the analysis stage contains explicit rules for decisions, task ownership, and deadlines. Proposals must not be promoted to decisions, and missing owners or deadlines must not be inferred. The raw and refined transcripts are also displayed separately, making refinement changes visible to the user.

Structured model output is validated before it reaches the frontend. Unsupported, empty, or unreadable recordings and transcription failures produce explicit errors. Gemini rate-limit, service, and malformed-response failures are also surfaced rather than silently replacing them with fabricated results.

Automatic Gemini retries are intentionally avoided. Each stage makes a single request, allowing quota-related or model failures to remain visible and giving the user control over whether to retry.

These safeguards reduce the likelihood of unsupported output, but they do not make hallucination theoretically impossible.

---

## 5. Validation and Stress Testing

The pipeline was evaluated using multiple manually recorded meetings designed to test more than a simple happy-path conversation. The recordings covered technical terminology, explicit and missing task owners, deadlines, unassigned tasks, proposals versus confirmed decisions, rejected ideas, numerical information, relative deadlines, negations, and incomplete spoken sentences.

Testing showed that technical ASR errors could be corrected while preserving surrounding meaning, and that proposed or rejected technologies were not incorrectly promoted to confirmed decisions. Tests containing numbers and negations were used to check that important factual details and intent survived both language-model stages.

An adversarial test also included an intentionally incomplete assignment to check whether the generative stages would plausibly auto-complete missing speech. In that case, the system retained only information supported by the recording and did not invent the missing continuation or deadline.

In addition to manual testing, automated backend and frontend tests cover pipeline ordering, model handling, schema validation, upload/error handling, single-attempt Gemini behavior, transcript comparison, workflow state, and exports. These tests provide empirical confidence across important failure modes, although they do not guarantee perfect behavior for every possible recording.

---

## 6. Technology Stack

**Frontend**
- Next.js
- React
- TypeScript

**Backend**
- Python
- FastAPI
- Pydantic
- Uvicorn

**Speech Recognition**
- OpenAI Whisper Small
- FFmpeg for audio decoding

**Language Processing**
- Gemini 3.5 Flash-Lite
  - Stage 1: transcript refinement
  - Stage 2: meeting documentation

**Outputs**
- Interactive meeting results
- Raw and refined transcript comparison
- Markdown export
- JSON export