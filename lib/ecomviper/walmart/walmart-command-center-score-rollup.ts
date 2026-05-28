import type { WalmartOptimizationCoverageAudit } from "@/lib/ecomviper/walmart/walmart-agentic-optimization-coverage";
import {
  mapWalmartAiVisibilityScoreFromAudit,
  type WalmartAiVisibilityScore,
} from "@/lib/ecomviper/walmart/walmart-ai-visibility-score";

export interface WalmartCommandCenterScoreRollup {
  aiVisibilityScore: WalmartAiVisibilityScore;
  readinessScore: number;
  confidenceScore: number;
  confidenceLevel: "high" | "medium" | "low" | "unknown";
}

export function buildWalmartCommandCenterScoreRollup(input: {
  coverageAudit: WalmartOptimizationCoverageAudit;
}): WalmartCommandCenterScoreRollup {
  const aiVisibilityScore = mapWalmartAiVisibilityScoreFromAudit({
    audit: input.coverageAudit,
    provenanceSource: "derived",
    inputRefs: [
      "lib/ecomviper/walmart/walmart-agentic-optimization-coverage.ts",
      "lib/ecomviper/walmart/walmart-command-center-score-rollup.ts",
      "app/optiwal/page.tsx",
    ],
  });

  return {
    aiVisibilityScore,
    readinessScore: aiVisibilityScore.overall,
    confidenceScore: aiVisibilityScore.confidence?.value ?? 0,
    confidenceLevel: aiVisibilityScore.confidence?.level ?? "unknown",
  };
}
