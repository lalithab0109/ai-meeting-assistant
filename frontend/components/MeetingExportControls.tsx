"use client";

import { Download } from "lucide-react";
import { downloadMeeting } from "@/lib/meetingExport";
import type { MeetingResult } from "@/types/meeting";

export function MeetingExportControls({ result, rawTranscript }: { result: MeetingResult; rawTranscript: string }) {
  return (
    <div aria-label="Download meeting record" className="mt-5 flex flex-wrap gap-3">
      <button type="button" onClick={() => downloadMeeting(result, rawTranscript, "md")} className="flex items-center gap-2 rounded-lg border border-[#3b3b46] bg-[#25252e] px-3.5 py-2.5 text-xs font-medium text-[#d9d9e2] transition-colors duration-200 hover:border-[#565461] hover:bg-[#30303a]">
        <Download size={14} strokeWidth={1.5} aria-hidden="true" />Download Markdown
      </button>
      <button type="button" onClick={() => downloadMeeting(result, rawTranscript, "json")} className="flex items-center gap-2 rounded-lg border border-[#3b3b46] bg-[#25252e] px-3.5 py-2.5 text-xs font-medium text-[#d9d9e2] transition-colors duration-200 hover:border-[#565461] hover:bg-[#30303a]">
        <Download size={14} strokeWidth={1.5} aria-hidden="true" />Download JSON
      </button>
    </div>
  );
}
