import type { Step2SupportResearchArtifact } from "@/lib/directoryiq/step2SupportEngineContract";

export type Step2ResearchState = "not_started" | "queued" | "researching" | "ready_thin" | "ready_grounded" | "ready" | "failed" | "stale";

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
  return state === "ready" || state === "ready_grounded";
}

export function classifyStep2ResearchReadiness(value: unknown): "missing" | "thin" | "grounded" {
  const record = asRecord(value);
  const topResults = Array.isArray(record.top_results) ? record.top_results : [];
  const faqPatterns = Array.isArray(record.faq_patterns) ? record.faq_patterns : [];
  const entities = asRecord(record.entities);
  const supportEvidence = Array.isArray(record.same_site_evidence) ? record.same_site_evidence : [];
  const entityCount = [entities.amenities, entities.location, entities.intent]
    .filter(Array.isArray)
    .reduce((sum, items) => sum + (items as unknown[]).length, 0);

  if (!hasUsableStep2ResearchArtifact(value)) return "missing";
  if (topResults.length >= 3 && faqPatterns.length >= 2 && entityCount >= 3 && supportEvidence.length >= 1) {
    return "grounded";
  }
  return "thin";
}

export function deriveStep2ResearchState(input: {
  requestedState: Step2ResearchState;
  hasUsableResearchArtifact: boolean;
  researchArtifact?: unknown;
}): Step2ResearchState {
  const readiness = classifyStep2ResearchReadiness(input.researchArtifact);
  if (readiness === "grounded") return "ready_grounded";
  if (readiness === "thin") return "ready_thin";
  return input.requestedState === "ready" || input.requestedState === "ready_grounded" || input.requestedState === "ready_thin"
    ? "not_started"
    : input.requestedState;
}
