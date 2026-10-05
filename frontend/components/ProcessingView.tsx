"use client";

import { useEffect, useRef, useState } from "react";
import { Check, FileAudio } from "lucide-react";
import { ProcessingStep } from "@/components/ProcessingStep";
import { useTranscription } from "@/hooks/useTranscription";
import { RawTranscriptView } from "@/components/RawTranscriptView";
import { useMeetingProcessing } from "@/hooks/useMeetingProcessing";
import { MeetingResults } from "@/components/MeetingResults";
import { formatSize } from "@/lib/format-file";

const stages = [
  { title: "Uploading recording", description: "Preparing your recording." },
  { title: "Transcribing audio", description: "Converting speech into a raw transcript." },
  { title: "Refining technical terminology", description: "Correcting technical terminology while preserving meaning." },
  { title: "Analyzing meeting", description: "Identifying minutes, decisions, and actionable tasks." },
  { title: "Preparing meeting record", description: "Structuring your meeting record." },
];

export function ProcessingView({ file, onBack }: { file: File; onBack: () => void }) {
  const { phase, transcript, error } = useTranscription(file);
  const meeting = useMeetingProcessing(transcript);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const isComplete = phase === "complete";
  const activeStage = phase === "uploading" ? 0 : phase === "transcribing" ? 1 : -1;
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, [isComplete, error, showAnalysis, meeting.result, meeting.error]);

  const returnToTranscript = () => { meeting.cancel(); setShowAnalysis(false); };
  const continueToAnalysis = () => { setShowAnalysis(true); void meeting.start(); };

  if (showAnalysis) return (
    <div className={`view-enter mx-auto ${meeting.result ? "w-full" : "max-w-[580px]"}`}>
      {meeting.result ? <MeetingResults result={meeting.result} transcript={transcript} onTranscript={returnToTranscript} onStartOver={onBack} /> : (
        <>
          <p className="mb-6 text-center text-[11px] font-medium tracking-[0.18em] text-[#aaa6d4] uppercase">Processing meeting</p>
          <h1 ref={heading} tabIndex={-1} className="text-center text-[30px] font-medium tracking-[-0.045em] sm:text-[38px]">{meeting.error ? "Meeting processing interrupted" : "Preparing your meeting record."}</h1>
          <p role="status" className="mt-4 text-center text-xs text-[#9999a6]">Refining your transcript and analyzing the meeting.</p>
          {meeting.error && <p role="alert" className="mt-6 text-sm text-[#e5a3a3]">{meeting.error}</p>}
          <div className="mt-6 flex flex-wrap gap-4 text-xs text-[#aaa6d4]">
            {meeting.error && <button type="button" onClick={() => void meeting.retry()} disabled={meeting.loading} className="rounded-lg border border-[#8d84d5] bg-[#8b82ce] px-4 py-2 font-medium text-[#13121c]">Retry</button>}
            <button type="button" onClick={returnToTranscript} className="rounded-md px-2 py-2">Back to transcript</button>
          </div>
        </>
      )}
      {!meeting.result && <ol aria-label="Meeting processing stages" className="mt-8 rounded-[10px] border border-[#33333d] bg-[#19191e] p-5 sm:p-6">
        {stages.map((stage, index) => <ProcessingStep key={stage.title} {...stage} description="Waiting for the meeting processor response." state={index < 2 || meeting.result ? "completed" : meeting.loading ? "active" : "upcoming"} isLast={index === stages.length - 1} />)}
      </ol>}
      <p className="mt-4 text-center text-[11px] leading-5 text-[#80808c]">Structured results are based on the refined transcript.</p>
    </div>
  );

  return (
    <section className="view-enter mx-auto max-w-[580px]" aria-labelledby="processing-title">
      <p className="mb-6 text-center text-[11px] font-medium tracking-[0.18em] text-[#aaa6d4] uppercase">Processing meeting</p>
      <div className="text-center">
        {isComplete && <span className="mx-auto mb-5 flex size-11 items-center justify-center rounded-[9px] border border-[#34473d] bg-[#1e2a23] text-[#98b4a0]"><Check size={21} strokeWidth={1.5} aria-hidden="true" /></span>}
        <h1 ref={heading} tabIndex={-1} id="processing-title" className="text-[30px] leading-[1.16] font-medium tracking-[-0.045em] text-[#eeeeef] sm:text-[38px]">
          {isComplete ? "Transcription complete" : error ? "Transcription interrupted" : "Turning conversation into clarity."}
        </h1>
        {isComplete && <p className="mt-5 text-[15px] leading-7 text-[#9b9ba5]">Your raw transcript is ready.</p>}
      </div>
      <div className="mt-8 flex items-center gap-3 rounded-lg border border-[#33333d] bg-[#1d1d23] px-4 py-3">
        <FileAudio size={19} strokeWidth={1.5} className="shrink-0 text-[#b0aadf]" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-[#e3e3e9]" title={file.name}>{file.name}</p>
          <p className="mt-1 text-xs text-[#9999a6]">{file.name.split(".").pop()?.toUpperCase()} <span className="mx-1.5">·</span> {formatSize(file.size)}</p>
        </div>
      </div>
      <p role="status" className="sr-only">{isComplete ? "Transcription complete." : error || `${stages[activeStage].title}. ${stages[activeStage].description}`}</p>
      {isComplete ? <RawTranscriptView transcript={transcript} onBack={onBack} onContinue={continueToAnalysis} /> : error ? (
        <div className="mt-8">
          <p role="alert" className="text-sm leading-6 text-[#e5a3a3]">{error}</p>
          <button type="button" onClick={onBack} className="mt-4 rounded-lg border border-[#3b3b46] bg-[#25252e] px-4 py-2 text-xs font-medium text-[#d9d9e2] transition-colors duration-200 hover:bg-[#30303a]">Back · Choose another recording</button>
        </div>
      ) : null}
      {!error && (
        <ol aria-label="Meeting processing stages" className="mt-8 rounded-[10px] border border-[#33333d] bg-[#19191e] p-5 sm:p-6">
          {stages.map((stage, index) => <ProcessingStep key={stage.title} {...stage} state={isComplete && index < 2 || activeStage === 1 && index === 0 ? "completed" : index === activeStage ? "active" : "upcoming"} isLast={index === stages.length - 1} />)}
        </ol>
      )}
      <p className="mt-4 text-center text-[11px] leading-5 text-[#80808c]">{isComplete ? "Stage 1 complete · Later stages have not run." : "Local transcription · After upload, waiting for the backend result."}</p>
    </section>
  );
}
