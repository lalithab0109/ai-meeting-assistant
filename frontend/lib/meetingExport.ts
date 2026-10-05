import type { MeetingResult } from "@/types/meeting";

type ExportFormat = "md" | "json";

export function meetingFilename(title: string, format: ExportFormat): string {
  let base = title.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
    .slice(0, 100).replace(/-+$/g, "");
  if (!base) base = "meeting-record";
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/.test(base)) base = `meeting-${base}`;
  return `${base}.${format}`;
}

function text(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/([`*_{}\[\]<>#|])/g, "\\$1");
}

function list(items: string[], emptyMessage: string): string {
  return items.length ? items.map(item => `- ${text(item).replace(/\n/g, "\n  ")}`).join("\n") : emptyMessage;
}

function transcriptBlock(value: string): string {
  // A longer fence preserves transcript text even when it contains backticks.
  const longest = Math.max(0, ...(value.match(/`+/g) || []).map(run => run.length));
  const fence = "`".repeat(Math.max(3, longest + 1));
  return `${fence}text\n${value}\n${fence}`;
}

export function meetingMarkdown(result: MeetingResult, rawTranscript: string): string {
  const actions = result.action_items.length ? result.action_items.map(item =>
    `- **Task:** ${text(item.task).replace(/\n/g, "\n  ")}\n  - Owner: ${text(item.owner ?? "Unspecified").replace(/\n/g, "\n    ")}\n  - Deadline: ${text(item.deadline ?? "Unspecified").replace(/\n/g, "\n    ")}`
  ).join("\n\n") : "No action items recorded.";

  return [
    `# ${text(result.title).replace(/[\r\n]+/g, " ")}`,
    "## Summary", text(result.summary),
    "## Key Points", list(result.key_points, "No key points recorded."),
    "## Decisions", list(result.decisions, "No decisions recorded."),
    "## Action Items", actions,
    "## Raw Transcript", transcriptBlock(rawTranscript),
    "## Refined Transcript", transcriptBlock(result.refined_transcript),
  ].join("\n\n") + "\n";
}

export function meetingJSON(result: MeetingResult, rawTranscript: string): string {
  return JSON.stringify({
    title: result.title,
    summary: result.summary,
    key_points: result.key_points,
    decisions: result.decisions,
    action_items: result.action_items,
    refined_transcript: result.refined_transcript,
    raw_transcript: rawTranscript,
  }, null, 2) + "\n";
}

export function downloadMeeting(result: MeetingResult, rawTranscript: string, format: ExportFormat): void {
  const content = format === "md" ? meetingMarkdown(result, rawTranscript) : meetingJSON(result, rawTranscript);
  const blob = new Blob([content], { type: format === "md" ? "text/markdown;charset=utf-8" : "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  try {
    link.href = url;
    link.download = meetingFilename(result.title, format);
    document.body.appendChild(link);
    link.click();
  } finally {
    link.remove();
    // Allow the browser to start consuming the URL before revoking it.
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
