import { beforeEach, describe, expect, it, vi } from "vitest";

const queryMock = vi.fn();
const fetchSourceTextMock = vi.fn();
const runTaxonomyEnrichmentMock = vi.fn();

vi.mock("@/lib/brain-learning/db", () => ({
  getBrainLearningPool: () => ({
    query: queryMock,
  }),
}));

vi.mock("@/lib/brain-learning/youtubeIngestSource", () => ({
  fetchYoutubeSourceText: (...args: unknown[]) => fetchSourceTextMock(...args),
}));

vi.mock("@/lib/brain-learning/taxonomyEnrichment", () => ({
  runBrainTaxonomyEnrichment: (...args: unknown[]) => runTaxonomyEnrichmentMock(...args),
}));

describe("runBrainIngestOrchestration", () => {
  beforeEach(() => {
    queryMock.mockReset();
    fetchSourceTextMock.mockReset();
    runTaxonomyEnrichmentMock.mockReset();
    runTaxonomyEnrichmentMock.mockResolvedValue({
      chunksClassified: 2,
      assignmentsCreated: 3,
      assignmentsUpdated: 0,
    });
  });

  it("processes discovered items into completed runs with documents and chunks", async () => {
    const runStatusUpdates: string[] = [];
    const chunkInserts: string[] = [];

    queryMock.mockImplementation(async (sql: string, values?: unknown[]) => {
      if (sql.includes("FROM brain_ingest_runs r")) {
        return {
          rows: [
            {
              run_id: "run_1",
              source_item_id: "source_1",
              source_kind: "youtube_video",
              source_item_external_id: "vid_1",
              status: "discovered",
              created_at: "2026-01-01T00:00:00.000Z",
            },
          ],
        };
      }
      if (sql.includes("SET status = $2")) {
        runStatusUpdates.push(String(values?.[1] || ""));
        return { rows: [] };
      }
      if (sql.includes("FROM brain_documents") && sql.includes("is_current = TRUE")) {
        return { rows: [] };
      }
      if (sql.includes("INSERT INTO brain_documents")) {
        return { rows: [{ id: "doc_1" }] };
      }
      if (sql.includes("DELETE FROM brain_chunks")) {
        return { rows: [] };
      }
      if (sql.includes("INSERT INTO brain_chunks")) {
        chunkInserts.push(String(values?.[7] || ""));
        return { rows: [] };
      }
      return { rows: [] };
    });

    fetchSourceTextMock.mockResolvedValue({
      text: "This is transcript text from a source video. ".repeat(80),
      languageCode: "en",
      source: "youtube_snippet",
      contentJson: { provider: "youtube" },
      contentSha256: "sha_1",
      segments: [],
    });

    const { runBrainIngestOrchestration } = await import("@/lib/brain-learning/ingestOrchestrator");
    const summary = await runBrainIngestOrchestration({ brainId: "brain_1", limit: 1 });

    expect(summary.itemsConsidered).toBe(1);
    expect(summary.runsStarted).toBe(1);
    expect(summary.documentsCreated).toBe(1);
    expect(summary.chunksCreated).toBeGreaterThan(0);
    expect(summary.taxonomyChunksClassified).toBe(2);
    expect(summary.taxonomyAssignmentsCreated).toBe(3);
    expect(summary.itemsSkipped).toBe(0);
    expect(summary.failures).toEqual([]);

    expect(chunkInserts.length).toBeGreaterThan(0);
    expect(runStatusUpdates).toContain("queued");
    expect(runStatusUpdates).toContain("processing");
    expect(runStatusUpdates).toContain("completed");
    expect(runTaxonomyEnrichmentMock).toHaveBeenCalledTimes(1);
  });

  it("skips duplicate when a current document already exists and reingest is not requested", async () => {
    const runStatusUpdates: string[] = [];

    queryMock.mockImplementation(async (sql: string, values?: unknown[]) => {
      if (sql.includes("FROM brain_ingest_runs r")) {
        return {
          rows: [
            {
              run_id: "run_2",
              source_item_id: "source_2",
              source_kind: "youtube_video",
              source_item_external_id: "vid_2",
              status: "discovered",
              created_at: "2026-01-01T00:00:00.000Z",
            },
          ],
        };
      }
      if (sql.includes("SET status = $2")) {
        runStatusUpdates.push(String(values?.[1] || ""));
        return { rows: [] };
      }
      if (sql.includes("FROM brain_documents") && sql.includes("is_current = TRUE")) {
        return { rows: [{ id: "doc_current", content_sha256: "same", version_no: 1 }] };
      }
      if (sql.includes("INSERT INTO brain_documents")) {
        throw new Error("Should not create new document in duplicate-skip path");
      }
      return { rows: [] };
    });

    const { runBrainIngestOrchestration } = await import("@/lib/brain-learning/ingestOrchestrator");
    const summary = await runBrainIngestOrchestration({ brainId: "brain_2", limit: 1 });

    expect(summary.itemsConsidered).toBe(1);
    expect(summary.documentsCreated).toBe(0);
    expect(summary.itemsSkipped).toBe(1);
    expect(summary.failures).toEqual([]);
    expect(runStatusUpdates).toContain("skipped_duplicate");
  });
});
