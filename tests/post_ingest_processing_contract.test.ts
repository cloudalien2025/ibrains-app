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
    expect(summary.readinessPct).toBe(36);
    expect(summary.blockingState).toBe("Ready for Use");
    expect(summary.processedCount).toBe(5);
    expect(summary.telemetryCompleteness).toBe("complete");
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
    expect(summary.telemetryCompleteness).toBe("partial");
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
    expect(summary.readinessPct).toBe(20);
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
    expect(summary.readinessPct).toBe(20);
  });

  it("prioritizes report/run truth over fallback readiness", () => {
    const summary = summarizePostIngestProcessing({
      runPayload: {
        status: "completed",
        counters: {
          candidates_found: 9,
          completed: 2,
        },
      },
      reportPayload: {
        selected_new: 4,
        ingested_new: 2,
      },
      fallbackReadinessPct: 0,
      fallbackCollectedCount: 0,
    });

    expect(summary.counts.collected).toBe(9);
    expect(summary.processedCount).toBe(2);
    expect(summary.readinessSource).toBe("stage_based");
    expect(summary.readinessPct).toBeGreaterThan(0);
    expect(summary.blockingState).toBe("Ready for Use");
  });

  it("uses nested report summary telemetry before falling back to awaiting state", () => {
    const summary = summarizePostIngestProcessing({
      runPayload: {
        status: "completed",
      },
      reportPayload: {
        summary: {
          processing_status: "processing",
          current_stage: "activation",
          candidates_found: 10,
          items_processed: 7,
          items_activated: 2,
        },
      },
      fallbackReadinessPct: 0,
      fallbackCollectedCount: 0,
    });

    expect(summary.processingStatus).toBe("processing");
    expect(summary.currentStage).toBe("ACTIVATED");
    expect(summary.counts.collected).toBe(10);
    expect(summary.processedCount).toBe(7);
    expect(summary.counts.activated).toBe(2);
    expect(summary.readinessSource).toBe("stage_based");
    expect(summary.blockingState).toBe("Ready for Use");
    expect(summary.readinessPct).toBeGreaterThan(20);
  });

  it("uses nested report counters for processed/activated progress", () => {
    const summary = summarizePostIngestProcessing({
      runPayload: {
        status: "completed",
      },
      reportPayload: {
        counters: {
          candidates_found: 12,
          items_processed: 9,
          items_activated: 0,
        },
      },
      fallbackReadinessPct: 3,
      fallbackCollectedCount: 0,
    });

    expect(summary.counts.collected).toBe(12);
    expect(summary.processedCount).toBe(9);
    expect(summary.counts.activated).toBe(0);
    expect(summary.blockingState).toBe("Needs Activation");
    expect(summary.readinessSource).toBe("stage_based");
    expect(summary.readinessPct).toBeGreaterThan(20);
  });

  it("derives numeric processed and activated values from live-equivalent top-level run/report payload", () => {
    const summary = summarizePostIngestProcessing({
      runPayload: {
        run_id: "run_20260404_042817_brilliant_directories",
        status: "completed",
        step: "completed",
        candidates_found: 14,
        selected_new: 7,
        completed: 1,
        failed: 6,
      },
      reportPayload: {
        run_id: "run_20260404_042817_brilliant_directories",
        status: "completed",
        candidates_found: 14,
        selected_new: 7,
        ingested_new: 0,
        transcripts_succeeded: 0,
        transcripts_failed: 0,
      },
      fallbackReadinessPct: 14,
      fallbackCollectedCount: 70,
    });

    expect(summary.counts.collected).toBe(14);
    expect(summary.processedCount).toBe(1);
    expect(summary.counts.activated).toBe(0);
    expect(summary.blockingState).toBe("Needs Activation");
    expect(summary.readinessSource).toBe("stage_based");
  });
});
