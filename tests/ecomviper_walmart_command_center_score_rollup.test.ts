import { describe, expect, it, vi } from "vitest";
import { buildWalmartOptimizationCoverageAudit } from "@/lib/ecomviper/walmart/walmart-agentic-optimization-coverage";
import { buildWalmartCommandCenterScoreRollup } from "@/lib/ecomviper/walmart/walmart-command-center-score-rollup";

const commandCenterScoreRollupMocks = vi.hoisted(() => ({
  mapWalmartAiVisibilityScoreFromAudit: vi.fn(),
}));

vi.mock("@/lib/ecomviper/walmart/walmart-ai-visibility-score", () => ({
  mapWalmartAiVisibilityScoreFromAudit: commandCenterScoreRollupMocks.mapWalmartAiVisibilityScoreFromAudit,
}));

describe("Walmart command center score rollup", () => {
  it("uses canonical ai_visibility_score mapping for command-center readiness/confidence values", () => {
    const coverageAudit = buildWalmartOptimizationCoverageAudit();
    commandCenterScoreRollupMocks.mapWalmartAiVisibilityScoreFromAudit.mockReturnValueOnce({
      overall: 17,
      status: "critical",
      dimensions: {},
      confidence: {
        value: 23,
        level: "low",
      },
      provenance: {
        source: "derived",
      },
      recommendations: [],
    });

    const rollup = buildWalmartCommandCenterScoreRollup({
      coverageAudit,
    });

    expect(commandCenterScoreRollupMocks.mapWalmartAiVisibilityScoreFromAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        audit: coverageAudit,
        provenanceSource: "derived",
      })
    );
    expect(rollup.readinessScore).toBe(17);
    expect(rollup.confidenceScore).toBe(23);
    expect(rollup.confidenceLevel).toBe("low");
    expect(rollup.aiVisibilityScore.status).toBe("critical");
  });

  it("falls back to unknown confidence level when canonical confidence details are missing", () => {
    const coverageAudit = buildWalmartOptimizationCoverageAudit();
    commandCenterScoreRollupMocks.mapWalmartAiVisibilityScoreFromAudit.mockReturnValueOnce({
      overall: 61,
      status: "good",
      dimensions: {},
      provenance: {
        source: "derived",
      },
      recommendations: [],
    });

    const rollup = buildWalmartCommandCenterScoreRollup({
      coverageAudit,
    });

    expect(rollup.readinessScore).toBe(61);
    expect(rollup.confidenceScore).toBe(0);
    expect(rollup.confidenceLevel).toBe("unknown");
  });
});
