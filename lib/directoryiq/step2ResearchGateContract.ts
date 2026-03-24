import type { Step2SupportResearchArtifact } from "@/lib/directoryiq/step2SupportEngineContract";

export type Step2ResearchState = "not_started" | "queued" | "researching" | "ready" | "failed" | "stale";

export const STEP2_RESEARCH_REQUIRED_CODE = "STEP2_RESEARCH_REQUIRED";
export const STEP2_RESEARCH_REQUIRED_MESSAGE = "Complete listing research before creating support articles.";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isSyntheticResearchUrl(value: string): boolean {
  return /research\.local/i.test(value);
}

export function hasUsableStep2ResearchArtifact(value: unknown): value is Step2SupportResearchArtifact {
  const record = asRecord(value);
  const focusKeyword = asString(record.focus_keyword);
  const topResults = Array.isArray(record.top_results) ? record.top_results : [];
  if (!focusKeyword || topResults.length === 0) return false;
  return topResults.every((entry) => {
    const row = asRecord(entry);
    const url = asString(row.url);
    return Boolean(url) && !isSyntheticResearchUrl(url);
  });
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
