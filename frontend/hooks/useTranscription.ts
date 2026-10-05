"use client";

import { useEffect, useState } from "react";

type TranscriptionState = {
  phase: "uploading" | "transcribing" | "complete" | "error";
  transcript: string;
  error: string;
};

export function useTranscription(file: File) {
  const [state, setState] = useState<TranscriptionState>({ phase: "uploading", transcript: "", error: "" });

  useEffect(() => {
    let cancelled = false;
    const request = new XMLHttpRequest();
    const fail = (error: string) => {
      if (!cancelled) setState({ phase: "error", transcript: "", error });
    };
    setState({ phase: "uploading", transcript: "", error: "" });
    // Upload events track browser transfer, not granular server/model progress.
    request.upload.onload = () => {
      if (!cancelled) setState({ phase: "transcribing", transcript: "", error: "" });
    };
    request.onload = () => {
      if (cancelled) return;
      const response = request.response;
      if (request.status >= 200 && request.status < 300 && response?.success === true && typeof response.rawTranscript === "string" && response.rawTranscript.trim()) {
        setState({ phase: "complete", transcript: response.rawTranscript, error: "" });
      } else {
        fail(typeof response?.error === "string" ? response.error : "The recording could not be transcribed. Please try again.");
      }
    };
    request.onerror = () => fail("Cannot reach the backend. Check that it is running and try again.");
    request.ontimeout = () => fail("Transcription timed out. Try a shorter recording or check the backend.");
    request.onabort = () => fail("Transcription was cancelled.");
    try {
      request.open("POST", `${(process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000").replace(/\/$/, "")}/api/transcribe`);
      request.responseType = "json";
      request.timeout = 10 * 60 * 1000;
      const body = new FormData();
      body.append("file", file);
      request.send(body);
    } catch {
      fail("The transcription request could not be sent. Check the backend URL and try again.");
    }
    return () => {
      cancelled = true;
      request.abort();
    };
  }, [file]);

  return state;
}
