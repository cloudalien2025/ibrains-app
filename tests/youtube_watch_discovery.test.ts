import { describe, expect, it, vi, beforeEach } from "vitest";

const queryMock = vi.fn();
const discoverMock = vi.fn();

vi.mock("@/lib/brain-learning/db", () => ({
  getBrainLearningPool: () => ({
    query: queryMock,
  }),
}));

vi.mock("@/lib/brain-learning/youtubeDiscovery", () => ({
  discoverYoutubeVideos: (...args: unknown[]) => discoverMock(...args),
  stableJsonHash: () => "hash_test",
}));

describe("runYoutubeWatchDiscovery", () => {
  beforeEach(() => {
    queryMock.mockReset();
    discoverMock.mockReset();
  });

  it("dedupes candidates, inserts only new items, and creates discovered ingest runs", async () => {
    const { runYoutubeWatchDiscovery } = await import("@/lib/brain-learning/youtubeWatchDiscovery");

    queryMock.mockImplementation(async (sql: string, values?: unknown[]) => {
      if (sql.includes("FROM brain_source_watches")) {
        return {
          rows: [
            {
              id: "watch_1",
              source_kind: "youtube_channel",
              external_ref: "UC123",
              canonical_ref: "UC123",
              discovery_query: null,
              config: { max_results: 10 },
            },
          ],
        };
      }

      if (sql.includes("INSERT INTO brain_source_items")) {
        const canonicalIdentity = String(values?.[3] ?? "");
        if (canonicalIdentity === "vid_new") {
          return { rows: [{ id: "item_new", inserted: true }] };
        }
        return { rows: [{ id: "item_existing", inserted: false }] };
      }

      if (sql.includes("INSERT INTO brain_ingest_runs")) {
        return { rows: [] };
      }

      if (sql.includes("UPDATE brain_source_watches")) {
        return { rows: [] };
      }

      return { rows: [] };
    });

    discoverMock.mockResolvedValue([
      {
        canonicalIdentity: "vid_new",
        sourceItemId: "vid_new",
        sourceUrl: "https://www.youtube.com/watch?v=vid_new",
        title: "New",
        channelId: "UC123",
        channelTitle: "Channel",
        publishedAt: "2026-01-01T00:00:00.000Z",
        languageCode: "en",
        raw: { id: "new" },
      },
      {
        canonicalIdentity: "vid_existing",
        sourceItemId: "vid_existing",
        sourceUrl: "https://www.youtube.com/watch?v=vid_existing",
        title: "Existing",
        channelId: "UC123",
        channelTitle: "Channel",
        publishedAt: "2025-12-01T00:00:00.000Z",
        languageCode: "en",
        raw: { id: "existing" },
      },
      {
        canonicalIdentity: "vid_new",
        sourceItemId: "vid_new",
        sourceUrl: "https://www.youtube.com/watch?v=vid_new",
        title: "New duplicate candidate",
        channelId: "UC123",
        channelTitle: "Channel",
        publishedAt: "2026-01-01T00:00:00.000Z",
        languageCode: "en",
        raw: { id: "new-duplicate" },
      },
    ]);

    const summary = await runYoutubeWatchDiscovery({
      brainId: "brain_1",
    });

    expect(summary.watchesProcessed).toBe(1);
    expect(summary.candidatesSeen).toBe(2);
    expect(summary.newItemsInserted).toBe(1);
    expect(summary.existingItemsMatched).toBe(1);
    expect(summary.ingestRunsCreated).toBe(1);
    expect(summary.failures).toEqual([]);

    const runInsertCalls = queryMock.mock.calls.filter(([sql]) =>
      String(sql).includes("INSERT INTO brain_ingest_runs")
    );
    expect(runInsertCalls).toHaveLength(1);
  });
});
