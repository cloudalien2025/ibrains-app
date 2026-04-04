import { describe, expect, it } from "vitest";
import { summarizePostIngestProcessing } from "@/lib/brains/postIngestProcessingContract";

describe("summarizePostIngestProcessing", () => {
  it("maps explicit run counters into canonical post-ingest counts", () => {
    const summary = summarizePostIngestProcessing({
      runPayload: {
        status: "processing",
        current_stage: "taxonomy_classification",
        counters: {
          discovered_count: 20,
          normalized_count: 14,
          taxonomy_chunks_classified: 8,
          summaries_generated: 5,
          activated_count: 3,
          duplicates_skipped: 2,
        },
      },
      fallbackReadinessPct: 47,
    });

    expect(summary.processingStatus).toBe("processing");
    expect(summary.currentStage).toBe("CLASSIFIED");
    expect(summary.counts).toMatchObject({
      collected: 20,
      normalized: 14,
      classified: 8,
      summarized: 5,
      activated: 3,
      deduped: 2,
    });
    expect(summary.readinessSource).toBe("stage_based");
    expect(summary.readinessPct).toBe(15);
    expect(summary.blockingState).toBe("Ready for Use");
  });

  it("falls back to upstream readiness when stage counters are absent", () => {
    const summary = summarizePostIngestProcessing({
      runPayload: {
        status: "completed",
        stage: "done",
      },
      fallbackReadinessPct: 62.4,
    });

    expect(summary.readinessSource).toBe("upstream_fill_pct");
    expect(summary.readinessPct).toBe(62);
    expect(summary.currentStage).toBe("COLLECTED");
    expect(summary.processingStatus).toBe("completed");
    expect(summary.blockingState).toBe("Awaiting Processing Signal");
  });

  it("uses fallback collected count to avoid misleading no-knowledge state", () => {
    const summary = summarizePostIngestProcessing({
      runPayload: {},
      fallbackReadinessPct: null,
      fallbackCollectedCount: 66,
    });

    expect(summary.counts.collected).toBe(66);
    expect(summary.blockingState).toBe("Awaiting Processing Signal");
    expect(summary.blockingReason).toContain("telemetry");
  });

  it("marks collected-but-unprocessed brains as needing processing", () => {
    const summary = summarizePostIngestProcessing({
      runPayload: {
        status: "completed",
        counters: {
          collected_count: 12,
          activated_count: 0,
          normalized_count: 0,
          taxonomy_chunks_classified: 0,
          summaries_generated: 0,
        },
      },
      fallbackReadinessPct: 0,
    });

    expect(summary.blockingState).toBe("Needs Processing");
    expect(summary.nextStep).toContain("normalize");
  });
});
