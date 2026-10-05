"use client";

import { useState } from "react";
import { ArrowRight, FileAudio, ListChecks, ScanText } from "lucide-react";
import { ProcessingView } from "@/components/ProcessingView";
import { Header } from "@/components/Header";
import { UploadDropzone } from "@/components/UploadDropzone";

const stages = [
  { icon: FileAudio, title: "Transcribe", description: "Bring your conversation into focus." },
  { icon: ScanText, title: "Refine", description: "Keep technical language accurate." },
  { icon: ListChecks, title: "Extract", description: "Find the decisions and next steps." },
];

export default function Home() {
  const [recording, setRecording] = useState<File | null>(null);
  return (
    <div className="flex min-h-svh flex-col">
      <Header />
      <main className="mx-auto w-full max-w-3xl has-[[data-meeting-results]]:max-w-6xl flex-1 px-6 pb-16 pt-14 sm:pt-20">
        {recording ? <ProcessingView file={recording} onBack={() => setRecording(null)} /> : <>
        <section aria-labelledby="hero-title" className="text-center">
          <p className="mb-6 text-[11px] font-medium tracking-[0.18em] text-[#aaa6d4] uppercase">Less replaying. More moving forward.</p>
          <h1 id="hero-title" className="mx-auto max-w-[620px] text-[34px] leading-[1.16] font-medium tracking-[-0.045em] text-[#eeeeef] sm:text-[46px]">
            Turn meetings into<br className="hidden sm:block" /> actionable knowledge.
          </h1>
          <p className="mx-auto mt-5 max-w-[490px] text-[15px] leading-7 text-[#9b9ba5]">
            Transcribe conversations, refine technical terminology, and extract the decisions and tasks that matter.
          </p>
        </section>
        <div className="mx-auto mt-10 max-w-[580px] sm:mt-12"><UploadDropzone onProcess={setRecording} /></div>
        <section id="how-it-works" aria-label="How it works" className="mx-auto mt-14 max-w-[620px] scroll-mt-8">
          <div className="grid gap-6 sm:grid-cols-3 sm:gap-7">
            {stages.map(({ icon: Icon, title, description }, index) => (
              <div key={title}>
                <div className="mb-3 flex items-center gap-2 text-[#a4a4b0]">
                  <Icon size={15} strokeWidth={1.5} aria-hidden="true" />
                  <span className="text-xs font-medium text-[#d4d4dc]">{title}</span>
                  {index < 2 && <ArrowRight size={12} className="ml-auto hidden text-[#51515c] sm:block" aria-hidden="true" />}
                </div>
                <p className="text-xs leading-5 text-[#898993]">{description}</p>
              </div>
            ))}
          </div>
        </section>
        </>}
      </main>
      <footer className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-6 text-[11px] text-[#777782] sm:px-10">
        <span>MeetingAI <span className="mx-2 text-[#44444d]">/</span> A little clarity goes a long way.</span>
        <span id="github-placeholder">Local development · Recordings processed on your backend</span>
      </footer>
    </div>
  );
}
