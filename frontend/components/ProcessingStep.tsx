import { Check, Circle } from "lucide-react";

export type ProcessingState = "completed" | "active" | "upcoming";

type ProcessingStepProps = {
  title: string;
  description: string;
  state: ProcessingState;
  isLast: boolean;
};

export function ProcessingStep({ title, description, state, isLast }: ProcessingStepProps) {
  const active = state === "active";
  const completed = state === "completed";

  return (
    <li aria-current={active ? "step" : undefined} className="relative flex min-h-[78px] gap-4 last:min-h-0">
      {!isLast && <span aria-hidden="true" className="absolute top-8 bottom-0 left-[15px] w-px bg-[#33333d]" />}
      <span aria-hidden="true" className={`relative z-10 flex size-8 shrink-0 items-center justify-center rounded-lg border transition-colors duration-200 ${completed ? "border-[#34473d] bg-[#1e2a23] text-[#98b4a0]" : active ? "border-[#655d91] bg-[#292733] text-[#aaa6ef]" : "border-[#33333d] bg-[#1d1d23] text-[#73737f]"}`}>
        {completed ? <Check size={15} strokeWidth={1.5} /> : active ? <span className="size-2 rounded-full bg-[#aaa6ef] motion-safe:animate-pulse" /> : <Circle size={13} strokeWidth={1.5} />}
      </span>
      <div className="min-w-0 flex-1 pb-5 pt-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className={`text-[13px] transition-colors duration-200 ${active ? "font-medium text-[#d3cfff]" : completed ? "text-[#d4d4dc]" : "text-[#898993]"}`}>{title}</p>
          <span className={`text-[10px] ${active ? "text-[#aaa6d4]" : completed ? "text-[#98b4a0]" : "text-[#777782]"}`}>{completed ? "Completed" : active ? "In progress" : "Upcoming"}</span>
        </div>
        {active && <p className="view-enter mt-2 text-xs leading-5 text-[#9999a6]">{description}</p>}
      </div>
    </li>
  );
}
