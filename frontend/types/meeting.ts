export interface MeetingActionItem {
  task: string;
  owner: string | null;
  deadline: string | null;
}

export interface MeetingResult {
  refined_transcript: string;
  title: string;
  summary: string;
  key_points: string[];
  decisions: string[];
  action_items: MeetingActionItem[];
}

export function isMeetingResult(value: unknown): value is MeetingResult {
  if (typeof value !== "object" || value === null) return false;
  const result = value as Record<string, unknown>;
  const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every(item => typeof item === "string");
  const nullableString = (v: unknown) => v === null || typeof v === "string";
  return typeof result.refined_transcript === "string" && !!result.refined_transcript.trim() && typeof result.title === "string" && typeof result.summary === "string"
    && strings(result.key_points) && strings(result.decisions)
    && Array.isArray(result.action_items) && result.action_items.every(item => {
      if (typeof item !== "object" || item === null) return false;
      const action = item as Record<string, unknown>;
      return typeof action.task === "string" && nullableString(action.owner) && nullableString(action.deadline);
    });
}
