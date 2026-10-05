import { Check, ArrowLeft, ListChecks, AlignLeft, List, UserRound, Clock } from "lucide-react";
import { MeetingExportControls } from "@/components/MeetingExportControls";
import { TranscriptComparison } from "@/components/TranscriptComparison";
import type { MeetingResult } from "@/types/meeting";

export function MeetingResults({ result, transcript, onTranscript, onStartOver }: { result: MeetingResult; transcript: string; onTranscript: () => void; onStartOver: () => void }) {
  return (
    <section data-meeting-results className="view-enter min-w-0 [overflow-wrap:anywhere]" aria-labelledby="meeting-title">
      <p className="mb-5 flex items-center gap-2 text-xs text-[#98b4a0]"><Check size={14} aria-hidden="true" />Processing complete</p>
      <h1 id="meeting-title" tabIndex={-1} className="text-[30px] font-medium tracking-[-0.045em] text-[#eeeeef] sm:text-[38px]">{result.title}</h1>

      <section className="mt-8 rounded-[10px] border border-[#3b374d] border-l-2 border-l-[#8278b6] bg-[#1d1b25] p-5 sm:p-6" aria-labelledby="summary-title">
        <h2 id="summary-title" className="mb-4 flex items-center gap-2.5 text-[15px] font-semibold tracking-tight text-[#eeeeef]">
          <AlignLeft size={17} strokeWidth={1.5} className="text-[#aaa6d4]" aria-hidden="true" />Summary
        </h2>
        <p className="max-w-[80ch] text-[15px] leading-7 text-[#cdcad8]">{result.summary}</p>
      </section>

      <div className="mt-10 space-y-10">
        <section aria-labelledby="points-title">
          <h2 id="points-title" className="mb-4 flex items-center gap-2.5 text-[15px] font-semibold tracking-tight text-[#e3e3e9]">
            <List size={17} strokeWidth={1.5} className="text-[#aaa6d4]" aria-hidden="true" />Key points
          </h2>
          <ul className="grid items-stretch gap-2.5 lg:grid-cols-2">
            {result.key_points.map((point, i) => (
              <li key={i} className="flex items-center gap-3 rounded-lg border border-[#2e2d37] bg-[#19191e] px-3.5 py-3 text-sm leading-6 text-[#bdbdc8]">
                <span className="size-1 shrink-0 rounded-full bg-[#938bae]" aria-hidden="true" />{point}
              </li>
            ))}
          </ul>
          {!result.key_points.length && <p className="text-sm text-[#898993]">No key points recorded.</p>}
        </section>
        <section aria-labelledby="decisions-title">
          <h2 id="decisions-title" className="mb-4 flex items-center gap-2.5 text-[15px] font-semibold tracking-tight text-[#e3e3e9]">
            <Check size={17} strokeWidth={1.5} className="text-[#98b4a0]" aria-hidden="true" />Decisions
          </h2>
          <ul className={`grid items-stretch gap-3 ${result.decisions.length > 1 ? "lg:grid-cols-2" : "max-w-prose"}`}>
            {result.decisions.map((decision, i) => (
              <li key={i} className="flex items-center gap-3 border-l border-[#3c5245] py-1 pl-3 text-sm leading-6 font-medium text-[#d0d9d2]">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-md border border-[#34473d] bg-[#1e2a23] text-[#98b4a0]">
                  <Check size={13} strokeWidth={1.5} aria-hidden="true" />
                </span>
                {decision}
              </li>
            ))}
          </ul>
          {!result.decisions.length && <p className="text-sm text-[#898993]">No decisions recorded.</p>}
        </section>
      </div>

      <section className="mt-10" aria-labelledby="actions-title">
        <h2 id="actions-title" className="mb-4 flex items-center gap-2.5 text-[15px] font-semibold tracking-tight text-[#e3e3e9]">
          <ListChecks size={17} strokeWidth={1.5} className="text-[#aaa6d4]" aria-hidden="true" />Action items
        </h2>
        <div className="grid items-stretch gap-3 lg:grid-cols-2">
          {result.action_items.map((item, i) => (
            <div key={i} className="flex flex-col rounded-[10px] border border-[#393641] bg-[#1c1b22] p-5">
              <p className="text-[15px] leading-6 font-medium text-[#e3e3e9]">{item.task}</p>
              <dl className="mt-auto flex flex-wrap gap-2 pt-3.5 text-xs text-[#aaa7ba]">
                <div className="flex items-center gap-1.5 rounded-md border border-[#37343f] bg-[#25222c] px-2.5 py-1.5">
                  <UserRound size={13} strokeWidth={1.5} aria-hidden="true" />
                  <dt className="sr-only">Owner:</dt><dd>{item.owner ?? "Unassigned"}</dd>
                </div>
                <div className="flex items-center gap-1.5 rounded-md border border-[#33333d] bg-[#23232b] px-2.5 py-1.5 text-[#a6a6b2]">
                  <Clock size={13} strokeWidth={1.5} aria-hidden="true" />
                  <dt className="sr-only">Due:</dt><dd>{item.deadline ?? "No deadline"}</dd>
                </div>
              </dl>
            </div>
          ))}
          {!result.action_items.length && <p className="rounded-[10px] border border-[#33333d] bg-[#19191e] p-5 text-sm text-[#898993]">No action items recorded.</p>}
        </div>
      </section>

      <div className="mt-10 border-t border-[#2c2c34] pt-6">
        <details className="rounded-lg border border-[#33333d] bg-[#19191e] p-5">
          <summary className="cursor-pointer text-sm text-[#d4d4dc]">Raw &amp; refined transcripts</summary>
          <TranscriptComparison rawTranscript={transcript} refinedTranscript={result.refined_transcript} />
        </details>
        <MeetingExportControls result={result} rawTranscript={transcript} />
        <div className="mt-6 flex flex-wrap gap-4 text-xs text-[#aaa6d4]">
          <button type="button" onClick={onTranscript} className="flex items-center gap-2 rounded-md px-2 py-2"><ArrowLeft size={14} aria-hidden="true" />Back to transcript</button>
          <button type="button" onClick={onStartOver} className="rounded-md px-2 py-2">New recording</button>
        </div>
      </div>
    </section>
  );
}
