import { beforeEach, describe, expect, it, vi } from "vitest";

const queryMock = vi.fn();

vi.mock("@/lib/brain-learning/db", () => ({
  getBrainLearningPool: () => ({
    query: queryMock,
  }),
}));

describe("runBrainRetrieval", () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  it("ranks current/fresher chunks above stale ones for the same query", async () => {
    queryMock.mockResolvedValue({
      rows: [
        {
          chunk_id: "chunk_old",
          document_id: "doc_old",
          source_item_id: "source_1",
          ingest_run_id: "run_old",
          brain_id: "brain_1",
          chunk_text: "This playbook improves conversion and search visibility quickly.",
          chunk_index: 0,
          chunk_metadata: {},
          document_kind: "transcript",
          document_version_no: 1,
          document_is_current: false,
          document_freshness_score: "0.4000",
          document_supersedes_document_id: null,
          document_superseded_by_document_id: "doc_new",
          document_created_at: "2026-01-01T00:00:00.000Z",
          source_kind: "youtube_video",
          source_external_id: "vid_1",
          source_title: "Search visibility playbook",
          source_url: "https://example.com/vid_1",
          source_publisher_name: "Publisher",
          source_published_at: "2026-01-01T00:00:00.000Z",
          source_payload: {},
          taxonomy_assignments: [],
        },
        {
          chunk_id: "chunk_new",
          document_id: "doc_new",
          source_item_id: "source_1",
          ingest_run_id: "run_new",
          brain_id: "brain_1",
          chunk_text: "This playbook improves conversion and search visibility quickly.",
          chunk_index: 0,
          chunk_metadata: {},
          document_kind: "transcript",
          document_version_no: 2,
          document_is_current: true,
          document_freshness_score: "1.0000",
          document_supersedes_document_id: "doc_old",
          document_superseded_by_document_id: null,
          document_created_at: "2026-02-01T00:00:00.000Z",
          source_kind: "youtube_video",
          source_external_id: "vid_1",
          source_title: "Search visibility playbook",
          source_url: "https://example.com/vid_1",
          source_publisher_name: "Publisher",
          source_published_at: "2026-02-01T00:00:00.000Z",
          source_payload: {},
          taxonomy_assignments: [],
        },
      ],
    });

    const { runBrainRetrieval } = await import("@/lib/brain-learning/retrieval");
    const result = await runBrainRetrieval({
      brainId: "brain_1",
      query: "search visibility conversion",
      limit: 2,
    });

    expect(result.returned).toBe(2);
    expect(result.items[0].chunkId).toBe("chunk_new");
    expect(result.items[0].freshness.isCurrent).toBe(true);
    expect(result.items[0].relevanceScore).toBeGreaterThan(result.items[1].relevanceScore);
  });

  it("passes taxonomy filters into SQL and preserves taxonomy/provenance in response", async () => {
    queryMock.mockImplementation(async (_sql: string, values?: unknown[]) => {
      expect(values?.[2]).toEqual(["node_uuid_1"]);
      expect(values?.[3]).toEqual(["strategy.positioning"]);
      return {
        rows: [
          {
            chunk_id: "chunk_tax",
            document_id: "doc_tax",
            source_item_id: "source_tax",
            ingest_run_id: "run_tax",
            brain_id: "brain_2",
            chunk_text: "Positioning strategy increases local ranking wins.",
            chunk_index: 3,
            chunk_metadata: { section: "strategy" },
            document_kind: "transcript",
            document_version_no: 1,
            document_is_current: true,
            document_freshness_score: "0.9500",
            document_supersedes_document_id: null,
            document_superseded_by_document_id: null,
            document_created_at: "2026-03-01T00:00:00.000Z",
            source_kind: "youtube_video",
            source_external_id: "vid_tax",
            source_title: "Local strategy class",
            source_url: "https://example.com/vid_tax",
            source_publisher_name: "Coach",
            source_published_at: "2026-03-01T00:00:00.000Z",
            source_payload: { channel: "coach" },
            taxonomy_assignments: [
              {
                taxonomy_node_id: "node_uuid_1",
                taxonomy_node_key: "strategy.positioning",
                taxonomy_node_label: "Positioning",
                confidence: "0.9100",
                assigned_by: "rule",
                assignment_method: "deterministic_keyword_v1",
                rationale: {},
              },
            ],
          },
        ],
      };
    });

    const { runBrainRetrieval } = await import("@/lib/brain-learning/retrieval");
    const result = await runBrainRetrieval({
      brainId: "brain_2",
      query: "positioning strategy",
      taxonomyNodeIds: ["node_uuid_1"],
      taxonomyNodeKeys: ["strategy.positioning"],
      limit: 5,
    });

    expect(result.returned).toBe(1);
    expect(result.items[0].taxonomyMatches[0].taxonomyNodeKey).toBe("strategy.positioning");
    expect(result.items[0].provenance.sourceExternalId).toBe("vid_tax");
    expect(result.items[0].provenance.chunkMetadata).toEqual({ section: "strategy" });
  });

  it("controls duplicate source/document overrepresentation while preserving top-ranked chunks", async () => {
    queryMock.mockResolvedValue({
      rows: [
        {
          chunk_id: "chunk_a1",
          document_id: "doc_a",
          source_item_id: "source_a",
          ingest_run_id: "run_a",
          brain_id: "brain_3",
          chunk_text: "Expert ranking system details for local SEO and conversion.",
          chunk_index: 0,
          chunk_metadata: {},
          document_kind: "transcript",
          document_version_no: 1,
          document_is_current: true,
          document_freshness_score: "1.0000",
          document_supersedes_document_id: null,
          document_superseded_by_document_id: null,
          document_created_at: "2026-03-10T00:00:00.000Z",
          source_kind: "youtube_video",
          source_external_id: "vid_a",
          source_title: "Ranking systems",
          source_url: null,
          source_publisher_name: null,
          source_published_at: null,
          source_payload: {},
          taxonomy_assignments: [],
        },
        {
          chunk_id: "chunk_a2",
          document_id: "doc_a",
          source_item_id: "source_a",
          ingest_run_id: "run_a",
          brain_id: "brain_3",
          chunk_text: "Expert ranking system details for local SEO and conversion.",
          chunk_index: 1,
          chunk_metadata: {},
          document_kind: "transcript",
          document_version_no: 1,
          document_is_current: true,
          document_freshness_score: "1.0000",
          document_supersedes_document_id: null,
          document_superseded_by_document_id: null,
          document_created_at: "2026-03-10T00:00:00.000Z",
          source_kind: "youtube_video",
          source_external_id: "vid_a",
          source_title: "Ranking systems",
          source_url: null,
          source_publisher_name: null,
          source_published_at: null,
          source_payload: {},
          taxonomy_assignments: [],
        },
        {
          chunk_id: "chunk_a3",
          document_id: "doc_a",
          source_item_id: "source_a",
          ingest_run_id: "run_a",
          brain_id: "brain_3",
          chunk_text: "Expert ranking system details for local SEO and conversion.",
          chunk_index: 2,
          chunk_metadata: {},
          document_kind: "transcript",
          document_version_no: 1,
          document_is_current: true,
          document_freshness_score: "1.0000",
          document_supersedes_document_id: null,
          document_superseded_by_document_id: null,
          document_created_at: "2026-03-10T00:00:00.000Z",
          source_kind: "youtube_video",
          source_external_id: "vid_a",
          source_title: "Ranking systems",
          source_url: null,
          source_publisher_name: null,
          source_published_at: null,
          source_payload: {},
          taxonomy_assignments: [],
        },
        {
          chunk_id: "chunk_b1",
          document_id: "doc_b",
          source_item_id: "source_b",
          ingest_run_id: "run_b",
          brain_id: "brain_3",
          chunk_text: "Expert ranking system details for local SEO and conversion.",
          chunk_index: 0,
          chunk_metadata: {},
          document_kind: "transcript",
          document_version_no: 1,
          document_is_current: true,
          document_freshness_score: "0.9200",
          document_supersedes_document_id: null,
          document_superseded_by_document_id: null,
          document_created_at: "2026-03-09T00:00:00.000Z",
          source_kind: "youtube_video",
          source_external_id: "vid_b",
          source_title: "Ranking systems 2",
          source_url: null,
          source_publisher_name: null,
          source_published_at: null,
          source_payload: {},
          taxonomy_assignments: [],
        },
      ],
    });

    const { runBrainRetrieval } = await import("@/lib/brain-learning/retrieval");
    const result = await runBrainRetrieval({
      brainId: "brain_3",
      query: "expert ranking local seo conversion",
      limit: 3,
    });

    expect(result.returned).toBe(3);
    expect(result.items.map((item) => item.chunkId)).toEqual(["chunk_a1", "chunk_a2", "chunk_b1"]);
    expect(result.items.filter((item) => item.sourceItemId === "source_a")).toHaveLength(2);
  });
});
