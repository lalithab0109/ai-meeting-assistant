"use client";

import { useRef, useState, type DragEvent } from "react";
import { ArrowRight, Check, FileAudio, Upload, X } from "lucide-react";

import { formatSize } from "@/lib/format-file";

const extensions = ["mp3", "wav", "m4a", "mp4", "webm"];
const mimeTypes = ["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/wave", "audio/mp4", "audio/x-m4a", "video/mp4", "video/webm", "audio/webm"];

export function UploadDropzone({ onProcess }: { onProcess: (file: File) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);

  function selectFiles(files: FileList | null) {
    if (!files?.length) return;
    if (files.length !== 1) {
      setError("Please select one recording at a time.");
      return;
    }
    const candidate = files[0];
    const extension = candidate.name.split(".").pop()?.toLowerCase();
    if (!candidate.name.includes(".") || !extension || !extensions.includes(extension)) {
      setError("Choose an MP3, WAV, M4A, MP4, or WEBM recording.");
      return;
    }
    if (candidate.size === 0) {
      setError("This file is empty. Please choose another recording.");
      return;
    }
    setFile(candidate);
    setError("");
  }

  function canDrop(event: DragEvent<HTMLDivElement>) {
    const items = Array.from(event.dataTransfer.items).filter((item) => item.kind === "file");
    // Browsers hide filenames during drag; unknown MIME types are validated on drop.
    return items.length === 1 && (!items[0].type || mimeTypes.includes(items[0].type));
  }

  function removeFile() {
    setFile(null);
    setError("");
    if (input.current) input.current.value = "";
  }

  return (
    <div>
      <input
        ref={input}
        type="file"
        accept={extensions.map((extension) => `.${extension}`).join(",")}
        className="sr-only"
        tabIndex={-1}
        aria-label="Choose a meeting recording"
        onChange={(event) => {
          selectFiles(event.target.files);
          event.target.value = "";
        }}
      />
      <div
        onDragEnter={(event) => {
          event.preventDefault();
          dragDepth.current += 1;
          setIsDragging(canDrop(event));
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = canDrop(event) ? "copy" : "none";
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          dragDepth.current = Math.max(0, dragDepth.current - 1);
          if (dragDepth.current === 0) setIsDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          dragDepth.current = 0;
          setIsDragging(false);
          selectFiles(event.dataTransfer.files);
        }}
        className={`flex min-h-[260px] flex-col items-center justify-center rounded-[10px] border border-dashed px-6 py-8 transition-colors duration-200 ${isDragging ? "border-[#938be0] bg-[#1d1c27]" : "border-[#383840] bg-[#19191e]"}`}
      >
        {file ? (
          <div className="w-full" aria-live="polite">
            <div className="mb-6 flex items-center justify-center gap-2 text-xs text-[#98b4a0]">
              <Check size={14} strokeWidth={1.5} aria-hidden="true" /> Recording selected
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-[#33333d] bg-[#1d1d23] p-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-[#383642] bg-[#292733] text-[#b0aadf]">
                <FileAudio size={21} strokeWidth={1.5} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-[#e3e3e9]" title={file.name}>{file.name}</p>
                <p className="mt-1 text-xs text-[#9999a6]">{file.name.split(".").pop()?.toUpperCase()} <span className="mx-1.5">·</span> {formatSize(file.size)}</p>
              </div>
              <button type="button" onClick={removeFile} aria-label="Remove selected recording" className="rounded-md p-2 text-[#92929f] transition-colors duration-200 hover:bg-[#303039] hover:text-[#ededf0]">
                <X size={16} strokeWidth={1.5} aria-hidden="true" />
              </button>
            </div>
            <button type="button" onClick={() => input.current?.click()} className="mx-auto mt-5 block rounded-md px-2 py-1 text-xs text-[#aaa6d4] transition-colors duration-200 hover:text-[#d3cfff]">Choose a different file</button>
          </div>
        ) : (
          <>
            <span className="mb-5 flex size-11 items-center justify-center rounded-[9px] border border-[#35343e] bg-[#23222b] text-[#a9a5c5]">
              <Upload size={21} strokeWidth={1.5} aria-hidden="true" />
            </span>
            <p className="text-center text-sm font-medium text-[#e0e0e6]">Drop your meeting recording here</p>
            <p className="mt-2 text-center text-xs text-[#93939f]">or choose a file from your computer</p>
            <button type="button" onClick={() => input.current?.click()} className="mt-5 rounded-lg border border-[#3b3b46] bg-[#25252e] px-4 py-2 text-xs font-medium text-[#d9d9e2] transition-colors duration-200 hover:border-[#565461] hover:bg-[#30303a]">Browse files</button>
            <p className="mt-5 text-[10px] tracking-[0.08em] text-[#868691]">MP3 · WAV · M4A · MP4 · WEBM</p>
          </>
        )}
      </div>
      {error && <p role="alert" className="mt-3 text-xs text-[#e5a3a3]">{error}</p>}
      <button
        type="button"
        disabled={!file}
        onClick={() => { if (file) onProcess(file); }}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-[#8d84d5] bg-[#8b82ce] py-3 text-[13px] font-medium text-[#13121c] transition-colors duration-200 hover:bg-[#a097e4] disabled:border-[#303039] disabled:bg-[#24242c] disabled:text-[#71717e]"
      >
        Process meeting <ArrowRight size={15} strokeWidth={1.5} aria-hidden="true" />
      </button>
      <p className="mt-3 text-center text-[11px] text-[#80808c]">One recording. A clearer path forward.</p>
    </div>
  );
}
