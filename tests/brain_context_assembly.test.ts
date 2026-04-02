import { beforeEach, describe, expect, it, vi } from "vitest";

const runBrainRetrievalMock = vi.fn();

vi.mock("@/lib/brain-learning/retrieval", () => ({
  runBrainRetrieval: (...args: unknown[]) => runBrainRetrievalMock(...args),
}));

describe("runCoBrainContextAssembly", () => {
  beforeEach(() => {
    runBrainRetrievalMock.mockReset();
  });

  it("builds deterministic expert context packet with themes and answering notes", async () => {
    runBrainRetrievalMock.mockResolvedValue({
      brainId: "brain_1",
      query: "How do we improve local ranking and conversion?",
      limit: 20,
      taxonomyNodeIds: [],
      taxonomyNodeKeys: [],
      queryTerms: ["improve", "local", "ranking", "conversion"],
      candidatesConsidered: 5,
      returned: 5,
      rankingStrategy: "deterministic_lexical_taxonomy_freshness_v1",
      items: [
        {
          chunkId: "chunk_current",
          documentId: "doc_current",
          sourceItemId: "source_a",
          ingestRunId: "run_current",
          brainId: "brain_1",
          chunkText: "Improve local ranking by tightening listing consistency and conversion-focused pages.",
          relevanceScore: 2.75,
          scoreBreakdown: { lexical: 1.7, taxonomy: 0.45, freshness: 0.3, currentness: 0.3 },
          freshness: {
            isCurrent: true,
            freshnessScore: 1,
            versionNo: 3,
            supersedesDocumentId: "doc_old",
            supersededByDocumentId: null,
            documentCreatedAt: "2026-03-10T00:00:00.000Z",
          },
          taxonomyMatches: [
            {
              taxonomyNodeId: "node_strategy",
              taxonomyNodeKey: "strategy.local_ranking",
              taxonomyNodeLabel: "Local Ranking Strategy",
              confidence: 0.92,
              assignedBy: "rule",
              assignmentMethod: "deterministic_keyword_v1",
            },
          ],
          provenance: {
            documentKind: "transcript",
            chunkIndex: 0,
            sourceKind: "youtube_video",
            sourceExternalId: "vid_a",
            sourceTitle: "Local ranking masterclass",
            sourceUrl: null,
            sourcePublisherName: null,
            sourcePublishedAt: null,
            sourcePayload: {},
            chunkMetadata: {},
          },
        },
        {
          chunkId: "chunk_old",
          documentId: "doc_old",
          sourceItemId: "source_a",
          ingestRunId: "run_old",
          brainId: "brain_1",
          chunkText: "Improve local ranking by tightening listing consistency and conversion-focused pages.",
          relevanceScore: 2.66,
          scoreBreakdown: { lexical: 1.7, taxonomy: 0.4, freshness: 0.16, currentness: -0.12 },
          freshness: {
            isCurrent: false,
            freshnessScore: 0.54,
            versionNo: 2,
            supersedesDocumentId: null,
            supersededByDocumentId: "doc_current",
            documentCreatedAt: "2026-02-15T00:00:00.000Z",
          },
          taxonomyMatches: [
            {
              taxonomyNodeId: "node_strategy",
              taxonomyNodeKey: "strategy.local_ranking",
              taxonomyNodeLabel: "Local Ranking Strategy",
              confidence: 0.84,
              assignedBy: "rule",
              assignmentMethod: "deterministic_keyword_v1",
            },
          ],
          provenance: {
            documentKind: "transcript",
            chunkIndex: 0,
            sourceKind: "youtube_video",
            sourceExternalId: "vid_a",
            sourceTitle: "Local ranking masterclass",
            sourceUrl: null,
            sourcePublisherName: null,
            sourcePublishedAt: null,
            sourcePayload: {},
            chunkMetadata: {},
          },
        },
        {
          chunkId: "chunk_support",
          documentId: "doc_support",
          sourceItemId: "source_b",
          ingestRunId: "run_support",
          brainId: "brain_1",
          chunkText: "Conversion lift comes from intent-aligned service pages and proof-rich CTAs.",
          relevanceScore: 2.2,
          scoreBreakdown: { lexical: 1.3, taxonomy: 0.35, freshness: 0.27, currentness: 0.28 },
          freshness: {
            isCurrent: true,
            freshnessScore: 0.91,
            versionNo: 1,
            supersedesDocumentId: null,
            supersededByDocumentId: null,
            documentCreatedAt: "2026-03-01T00:00:00.000Z",
          },
          taxonomyMatches: [
            {
              taxonomyNodeId: "node_conversion",
              taxonomyNodeKey: "strategy.conversion",
              taxonomyNodeLabel: "Conversion Strategy",
              confidence: 0.78,
              assignedBy: "rule",
              assignmentMethod: "deterministic_keyword_v1",
            },
          ],
          provenance: {
            documentKind: "transcript",
            chunkIndex: 1,
            sourceKind: "youtube_video",
            sourceExternalId: "vid_b",
            sourceTitle: "Conversion strategy workshop",
            sourceUrl: null,
            sourcePublisherName: null,
            sourcePublishedAt: null,
            sourcePayload: {},
            chunkMetadata: {},
          },
        },
      ],
    });

    const { runCoBrainContextAssembly } = await import("@/lib/brain-learning/contextAssembly");
    const packet = await runCoBrainContextAssembly({
      brainId: "brain_1",
      query: "How do we improve local ranking and conversion?",
      limit: 4,
    });

    expect(runBrainRetrievalMock).toHaveBeenCalledTimes(1);
    expect(packet.packetVersion).toBe("co_brain_context_packet_v1");
    expect(packet.evidence.selectedCount).toBe(2);
    expect(packet.evidence.selected[0].chunkId).toBe("chunk_current");
    expect(packet.retrieval.candidatesSuppressed.duplicateText).toBe(1);
    expect(packet.themes[0].themeKey).toBe("strategy.local_ranking");
    expect(packet.strongestCurrentGuidance.length).toBeGreaterThan(0);
    expect(packet.answeringNotes.responseStyle).toBe("expert_advisor_grounded");
  });

  it("detects supersession tension conflict when older evidence remains close in score", async () => {
    runBrainRetrievalMock.mockResolvedValue({
      brainId: "brain_2",
      query: "What changed in strategy?",
      limit: 20,
      taxonomyNodeIds: [],
      taxonomyNodeKeys: [],
      queryTerms: ["changed", "strategy"],
      candidatesConsidered: 2,
      returned: 2,
      rankingStrategy: "deterministic_lexical_taxonomy_freshness_v1",
      items: [
        {
          chunkId: "chunk_new",
          documentId: "doc_new",
          sourceItemId: "source_x",
          ingestRunId: "run_new",
          brainId: "brain_2",
          chunkText: "New strategy recommends stronger service-page clusters.",
          relevanceScore: 2.1,
          scoreBreakdown: { lexical: 1.2, taxonomy: 0.4, freshness: 0.3, currentness: 0.2 },
          freshness: {
            isCurrent: true,
            freshnessScore: 1,
            versionNo: 2,
            supersedesDocumentId: "doc_old",
            supersededByDocumentId: null,
            documentCreatedAt: "2026-03-20T00:00:00.000Z",
          },
          taxonomyMatches: [],
          provenance: {
            documentKind: "transcript",
            chunkIndex: 0,
            sourceKind: "youtube_video",
            sourceExternalId: "vid_x",
            sourceTitle: null,
            sourceUrl: null,
            sourcePublisherName: null,
            sourcePublishedAt: null,
            sourcePayload: {},
            chunkMetadata: {},
          },
        },
        {
          chunkId: "chunk_old_relevant",
          documentId: "doc_old",
          sourceItemId: "source_x",
          ingestRunId: "run_old",
          brainId: "brain_2",
          chunkText: "Old strategy recommends broad pages, still partially relevant.",
          relevanceScore: 1.95,
          scoreBreakdown: { lexical: 1.2, taxonomy: 0.35, freshness: 0.2, currentness: -0.12 },
          freshness: {
            isCurrent: false,
            freshnessScore: 0.68,
            versionNo: 1,
            supersedesDocumentId: null,
            supersededByDocumentId: "doc_new",
            documentCreatedAt: "2026-02-20T00:00:00.000Z",
          },
          taxonomyMatches: [],
          provenance: {
            documentKind: "transcript",
            chunkIndex: 0,
            sourceKind: "youtube_video",
            sourceExternalId: "vid_x",
            sourceTitle: null,
            sourceUrl: null,
            sourcePublisherName: null,
            sourcePublishedAt: null,
            sourcePayload: {},
            chunkMetadata: {},
          },
        },
      ],
    });

    const { runCoBrainContextAssembly } = await import("@/lib/brain-learning/contextAssembly");
    const packet = await runCoBrainContextAssembly({
      brainId: "brain_2",
      query: "What changed in strategy?",
      limit: 3,
    });

    const hasSupersessionConflict = packet.conflicts.some((conflict) => conflict.conflictType === "supersession_tension");
    expect(hasSupersessionConflict).toBe(true);
  });
});
