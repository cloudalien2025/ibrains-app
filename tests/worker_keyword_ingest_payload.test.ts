import { describe, expect, it } from "vitest";
import {
  buildWorkerKeywordIngestPayload,
  hasIngestCounters,
} from "@/lib/directoryiq/ingestion/workerKeywordIngest";

describe("worker keyword ingest payload mapping", () => {
  it("detects when ingest counters are absent from start payload", () => {
    expect(hasIngestCounters({ run_id: "run_1", status: "queued" })).toBe(false);
    expect(hasIngestCounters({ counters: { candidates_found: 5 } })).toBe(true);
  });

  it("hydrates queued worker response from run/report payloads", () => {
    const merged = buildWorkerKeywordIngestPayload({
      startPayload: { run_id: "run_1", status: "queued" },
      runPayload: {
        status: "completed",
        candidates_found: 9,
        selected_new: 4,
        completed: 2,
        failed: 2,
      },
      reportPayload: {
        candidates_found: 9,
        selected_new: 4,
        ingested_new: 2,
      },
    }) as Record<string, any>;

    expect(merged.counters).toMatchObject({
      candidates_found: 9,
      selected_new: 4,
      new_items_added: 2,
      duplicates_skipped: 5,
      failed_items: 2,
    });
    expect(merged.summary).toMatchObject({
      candidates_found: 9,
      selected_new: 4,
      new_items_added: 2,
    });
  });
});
