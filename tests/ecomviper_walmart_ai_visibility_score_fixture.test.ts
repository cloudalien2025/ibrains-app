import { describe, expect, it } from "vitest";
import { buildWalmartOptimizationCoverageAudit } from "@/lib/ecomviper/walmart/walmart-agentic-optimization-coverage";
import {
  buildWalmartAiVisibilityScoreFixture,
  mapWalmartAiVisibilityScoreFromAudit,
} from "@/lib/ecomviper/walmart/walmart-ai-visibility-score";

describe("Walmart ai_visibility_score fixture contract", () => {
  it("builds canonical fixture payload with expected top-level fields", () => {
    const score = buildWalmartAiVisibilityScoreFixture();

    expect(typeof score.overall).toBe("number");
    expect(score.status).toMatch(/excellent|good|warning|critical|unknown/);
    expect(score.dimensions).toEqual(
      expect.objectContaining({
        prompt_match_coverage: expect.any(Number),
        semantic_gap_health: expect.any(Number),
        trust_signal_health: expect.any(Number),
        catalog_readiness_coverage: expect.any(Number),
      })
    );
    expect(score.confidence?.value).toEqual(expect.any(Number));
    expect(score.provenance?.source).toBe("fixture");
    expect(Array.isArray(score.recommendations)).toBe(true);
  });

  it("maps readiness audit into canonical status, confidence, and recommendation priority", () => {
    const audit = buildWalmartOptimizationCoverageAudit();
    const firstAction = audit.nextBestActions[0];
    if (!firstAction) {
      throw new Error("Expected nextBestActions to contain at least one recommendation.");
    }

    audit.readiness.overallAiRecommendationReadinessScore = 91;
    audit.readiness.aiConfidenceScore = 88;
    audit.readiness.recommendationProbability = "high";
    audit.nextBestActions = [{ ...firstAction, priority: "critical" }];

    const score = mapWalmartAiVisibilityScoreFromAudit({
      audit,
      provenanceSource: "derived",
      inputRefs: ["test/audit-fixture"],
    });

    expect(score.status).toBe("excellent");
    expect(score.confidence?.level).toBe("high");
    expect(score.provenance).toEqual({
      source: "derived",
      generated_at: audit.generatedAt,
      input_refs: ["test/audit-fixture"],
    });
    expect(score.recommendations?.[0]?.priority).toBe("high");
  });
});
