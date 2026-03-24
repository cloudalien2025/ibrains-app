import type { Step2SupportResearchArtifact } from "@/lib/directoryiq/step2SupportEngineContract";

export type Step2ResearchState = "not_started" | "queued" | "researching" | "ready" | "failed" | "stale";

export const STEP2_RESEARCH_REQUIRED_CODE = "STEP2_RESEARCH_REQUIRED";
export const STEP2_RESEARCH_REQUIRED_MESSAGE = "Complete listing research before creating support articles.";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export function hasUsableStep2ResearchArtifact(value: unknown): value is Step2SupportResearchArtifact {
  const record = asRecord(value);
  const focusKeyword = typeof record.focus_keyword === "string" ? record.focus_keyword.trim() : "";
  const topResults = Array.isArray(record.top_results) ? record.top_results : [];
  return Boolean(focusKeyword) && topResults.length > 0;
}

export function isStep2ResearchReady(state: Step2ResearchState): boolean {
  return state === "ready";
}

export function deriveStep2ResearchState(input: {
  requestedState: Step2ResearchState;
  hasUsableResearchArtifact: boolean;
}): Step2ResearchState {
  if (input.hasUsableResearchArtifact) return "ready";
  return input.requestedState === "ready" ? "not_started" : input.requestedState;
}
