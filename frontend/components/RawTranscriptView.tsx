export function RawTranscriptView({ transcript, onBack, onContinue }: { transcript: string; onBack: () => void; onContinue?: () => void }) {
  return (
    <div className="view-enter mt-8">
      <h2 className="mb-3 text-sm font-medium text-[#e3e3e9]">Raw Transcript</h2>
      <p className="max-h-[400px] overflow-y-auto rounded-lg border border-[#33333d] bg-[#19191e] p-5 text-sm leading-7 whitespace-pre-wrap text-[#d4d4dc]">{transcript}</p>
      {onContinue && <button type="button" onClick={onContinue} className="mt-4 flex w-full items-center justify-center rounded-lg border border-[#8d84d5] bg-[#8b82ce] py-3 text-[13px] font-medium text-[#13121c] transition-colors duration-200 hover:bg-[#a097e4]">Continue to meeting analysis</button>}
      <button type="button" onClick={onBack} className="mt-4 rounded-lg border border-[#3b3b46] bg-[#25252e] px-4 py-2 text-xs font-medium text-[#d9d9e2] transition-colors duration-200 hover:bg-[#30303a]">Back</button>
    </div>
  );
}
