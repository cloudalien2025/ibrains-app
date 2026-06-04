import {
  buildWalmartOptimizationCoverageAudit,
  type WalmartAgenticReadinessRecommendation,
  type WalmartOptimizationCoverageAudit,
  type WalmartOptimizationPriority,
} from "@/lib/ecomviper/walmart/walmart-agentic-optimization-coverage";
import type { WalmartProductRecord } from "@/lib/ecomviper/walmart/walmart-types";

export type WalmartAiVisibilityScoreStatus =
  | "excellent"
  | "good"
  | "warning"
  | "critical"
  | "unknown";

export type WalmartAiVisibilityScoreProvenanceSource =
  | "fixture"
  | "demo"
  | "derived"
  | "api"
  | "walmart"
  | "unknown";

export type WalmartAiVisibilityScoreConfidenceLevel = "high" | "medium" | "low" | "unknown";
export type WalmartAiVisibilityScoreRecommendationPriority = "high" | "medium" | "low";

export interface WalmartAiVisibilityScoreRecommendation {
  id: string;
  label: string;
  priority: WalmartAiVisibilityScoreRecommendationPriority;
  surface?: string;
}

export interface WalmartAiVisibilityScore {
  overall: number;
  status: WalmartAiVisibilityScoreStatus;
  dimensions: {
    prompt_match_coverage?: number;
    semantic_gap_health?: number;
    opportunity_priority?: number;
    trust_signal_health?: number;
    catalog_readiness_coverage?: number;
  };
  confidence?: {
    value: number;
    level?: WalmartAiVisibilityScoreConfidenceLevel;
    reasons?: string[];
  };
  provenance?: {
    source: WalmartAiVisibilityScoreProvenanceSource;
    generated_at?: string;
    input_refs?: string[];
  };
  recommendations?: WalmartAiVisibilityScoreRecommendation[];
}

const DEFAULT_INPUT_REFS = [
  "lib/ecomviper/walmart/walmart-agentic-optimization-coverage.ts",
  "app/api/ecomviper/walmart/health/route.ts",
];

export function clampWalmartAiVisibilityScoreValue(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function toWalmartAiVisibilityScoreStatus(
  overall: number
): WalmartAiVisibilityScoreStatus {
  if (!Number.isFinite(overall)) return "unknown";
  if (overall >= 85) return "excellent";
  if (overall >= 70) return "good";
  if (overall >= 50) return "warning";
  return "critical";
}

function normalizePriority(
  priority: WalmartOptimizationPriority
): WalmartAiVisibilityScoreRecommendationPriority {
  if (priority === "critical") return "high";
  if (priority === "high") return "high";
  if (priority === "medium") return "medium";
  return "low";
}

function confidenceLevelFromProbability(
  probability: "low" | "medium" | "high" | undefined
): WalmartAiVisibilityScoreConfidenceLevel {
  if (probability === "high") return "high";
  if (probability === "medium") return "medium";
  if (probability === "low") return "low";
  return "unknown";
}

function normalizeRecommendations(
  recommendations: WalmartAgenticReadinessRecommendation[]
): WalmartAiVisibilityScoreRecommendation[] {
  return recommendations.slice(0, 12).map((recommendation) => ({
    id: recommendation.id,
    label: recommendation.label,
    priority: normalizePriority(recommendation.priority),
  }));
}

export function mapWalmartAiVisibilityScoreFromAudit(input: {
  audit: WalmartOptimizationCoverageAudit;
  provenanceSource?: WalmartAiVisibilityScoreProvenanceSource;
  inputRefs?: string[];
}): WalmartAiVisibilityScore {
  const readiness = input.audit.readiness;
  const overall = clampWalmartAiVisibilityScoreValue(
    readiness.overallAiRecommendationReadinessScore
  );

  return {
    overall,
    status: toWalmartAiVisibilityScoreStatus(overall),
    dimensions: {
      prompt_match_coverage: clampWalmartAiVisibilityScoreValue(
        readiness.subscores["Search/AI Semantics"]
      ),
      semantic_gap_health: clampWalmartAiVisibilityScoreValue(
        readiness.subscores["Structured Attributes"]
      ),
      trust_signal_health: clampWalmartAiVisibilityScoreValue(
        readiness.subscores["Compliance Safety"]
      ),
      catalog_readiness_coverage: clampWalmartAiVisibilityScoreValue(
        readiness.subscores["PDP Content"]
      ),
    },
    confidence: {
      value: clampWalmartAiVisibilityScoreValue(readiness.aiConfidenceScore),
      level: confidenceLevelFromProbability(readiness.recommendationProbability),
    },
    provenance: {
      source: input.provenanceSource ?? "fixture",
      generated_at: input.audit.generatedAt,
      input_refs: input.inputRefs ?? DEFAULT_INPUT_REFS,
    },
    recommendations: normalizeRecommendations(input.audit.nextBestActions),
  };
}

export function buildWalmartAiVisibilityScoreFixture(input?: {
  product?: WalmartProductRecord | null;
  provenanceSource?: WalmartAiVisibilityScoreProvenanceSource;
  inputRefs?: string[];
}): WalmartAiVisibilityScore {
  const audit = buildWalmartOptimizationCoverageAudit({
    product: input?.product ?? null,
  });

  return mapWalmartAiVisibilityScoreFromAudit({
    audit,
    provenanceSource: input?.provenanceSource ?? "fixture",
    inputRefs: input?.inputRefs,
  });
}
