type TranscriptComparisonProps = {
  rawTranscript: string;
  refinedTranscript: unknown;
};

export function TranscriptComparison({ rawTranscript, refinedTranscript }: TranscriptComparisonProps) {
  const refined = typeof refinedTranscript === "string" && refinedTranscript.trim()
    ? refinedTranscript
    : null;

  return (
    <div className="mt-5 grid min-w-0 gap-4 md:grid-cols-2">
      <section className="min-w-0 rounded-lg border border-[#33333d] bg-[#19191e] p-4" aria-labelledby="raw-transcript-title">
        <h3 id="raw-transcript-title" className="text-xs font-semibold tracking-wide text-[#d4d4dc] uppercase">Raw Transcript</h3>
        <p className="mt-2 text-xs leading-5 text-[#9999a6]">Original transcription generated from the recording.</p>
        <p className="mt-4 max-h-[400px] overflow-y-auto text-sm leading-7 whitespace-pre-wrap text-[#b4b4bf] [overflow-wrap:anywhere]">{rawTranscript}</p>
      </section>
      <section className="min-w-0 rounded-lg border border-[#3b374d] bg-[#1d1b25] p-4" aria-labelledby="refined-transcript-title">
        <h3 id="refined-transcript-title" className="text-xs font-semibold tracking-wide text-[#aaa6d4] uppercase">Refined Transcript</h3>
        <p className="mt-2 text-xs leading-5 text-[#9999a6]">Technical terminology corrected while preserving the original meaning.</p>
        {refined ? (
          <p className="mt-4 max-h-[400px] overflow-y-auto text-sm leading-7 whitespace-pre-wrap text-[#cdcad8] [overflow-wrap:anywhere]">{refined}</p>
        ) : (
          <p className="mt-4 text-sm leading-6 text-[#9999a6]">Refined transcript unavailable. The original transcript remains available.</p>
        )}
      </section>
    </div>
  );
}
