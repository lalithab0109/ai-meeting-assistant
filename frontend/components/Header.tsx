import { AudioLines, Github } from "lucide-react";

export function Header() {
  return (
    <header className="mx-auto flex h-20 w-full max-w-6xl items-center justify-between px-6 sm:px-10">
      <a href="/" className="flex items-center gap-2.5 text-[15px] font-medium tracking-tight" aria-label="MeetingAI home">
        <span className="flex size-7 items-center justify-center rounded-lg border border-[#373546] bg-[#242330] text-[#aaa6ef]">
          <AudioLines size={17} strokeWidth={1.5} aria-hidden="true" />
        </span>
        MeetingAI
      </a>
      <nav aria-label="Main navigation" className="flex items-center gap-6 text-[13px] text-[#99999f]">
        <a className="transition-colors hover:text-[#ededf0]" href="https://github.com/lalithab0109/ai-meeting-assistant#architecture" target="_blank" rel="noopener noreferrer">How it works</a>
        <a href="https://github.com/lalithab0109/ai-meeting-assistant" target="_blank" rel="noopener noreferrer" aria-label="GitHub repository" title="GitHub repository" className="transition-colors hover:text-[#ededf0]">
          <Github size={18} strokeWidth={1.5} aria-hidden="true" />
        </a>
      </nav>
    </header>
  );
}
