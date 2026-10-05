"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isMeetingResult, type MeetingResult } from "@/types/meeting";

type State = { loading: boolean; result: MeetingResult | null; error: string };

export function useMeetingProcessing(transcript: string) {
  const [state, setState] = useState<State>({ loading: false, result: null, error: "" });
  const pending = useRef<AbortController | null>(null);
  const cancel = useCallback(() => {
    pending.current?.abort();
    pending.current = null;
    setState({ loading: false, result: null, error: "" });
  }, []);

  useEffect(() => () => { pending.current?.abort(); pending.current = null; }, []);

  const runProcessing = useCallback(async () => {
    if (pending.current) return;
    if (!transcript.trim()) {
      setState({ loading: false, result: null, error: "A non-empty transcript is required." });
      return;
    }
    const controller = new AbortController();
    pending.current = controller;
    setState({ loading: true, result: null, error: "" });
    let timedOut = false;
    const timer = window.setTimeout(() => { timedOut = true; controller.abort(); }, 30000);
    try {
      const response = await fetch(`${(process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000").replace(/\/$/, "")}/api/process`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript }), signal: controller.signal,
      });
      if (response.status === 429) throw new Error("AI service usage limit reached. Please try again later.");
      if (response.status === 503) throw new Error("AI processing is temporarily unavailable. Please try again.");
      if (!response.ok) throw new Error(response.status === 422 ? "The transcript was rejected. Please check it and retry." : "Meeting processing failed. Please try again.");
      let result: unknown;
      try { result = await response.json(); }
      catch { throw new Error("The backend returned an invalid meeting result. Please retry."); }
      if (!isMeetingResult(result)) throw new Error("The backend returned an invalid meeting result. Please retry.");
      if (pending.current === controller) setState({ loading: false, result, error: "" });
    } catch (error) {
      if (pending.current === controller) setState({ loading: false, result: null, error: timedOut ? "Meeting processing timed out. Please retry." : error instanceof TypeError ? "Cannot reach the backend. Check that it is running and retry." : error instanceof Error ? error.message : "Meeting processing failed. Please retry." });
    } finally {
      window.clearTimeout(timer);
      if (pending.current === controller) pending.current = null;
    }
  }, [transcript]);

  return { ...state, start: runProcessing, retry: runProcessing, cancel };
}
