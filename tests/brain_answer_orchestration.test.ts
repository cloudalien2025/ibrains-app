import { beforeEach, describe, expect, it, vi } from "vitest";

const runCoBrainContextAssemblyMock = vi.fn();

vi.mock("@/lib/brain-learning/contextAssembly", () => ({
  runCoBrainContextAssembly: (...args: unknown[]) => runCoBrainContextAssemblyMock(...args),
}));

describe("runCoBrainAnswerOrchestration", () => {
  beforeEach(() => {
    runCoBrainContextAssemblyMock.mockReset();
  });

  it("builds advisor_response_v1 from assembled context packet", async () => {
    runCoBrainContextAssemblyMock.mockResolvedValue({
      packetVersion: "co_brain_context_packet_v1",
      brainId: "brain_1",
      query: "How do we improve local conversion?",
      generatedAt: "2026-04-02T00:00:00.000Z",
      queryInterpretation: {
        normalizedQuery: "how do we improve local conversion",
        queryTerms: ["improve", "local", "conversion"],
        inferredIntents: ["optimization"],
        preferredTaxonomyNodeIds: [],
        preferredTaxonomyNodeKeys: [],
      },
      retrieval: {
        rankingStrategy: "deterministic_lexical_taxonomy_freshness_v1",
        candidatesConsidered: 12,
        candidatesReturned: 12,
        candidatesSuppressed: {
          duplicateText: 1,
          staleSuperseded: 1,
          lowRelevance: 2,
        },
      },
      evidence: {
        selectedCount: 2,
        selected: [
          {
            chunkId: "chunk_1",
            documentId: "doc_1",
            sourceItemId: "source_1",
            ingestRunId: "run_1",
            chunkText: "Improve conversion by tightening offer-message fit and CTA proof.",
            relevanceScore: 2.4,
            selectionReason: ["current_document"],
            freshness: {
              isCurrent: true,
              freshnessScore: 1,
              versionNo: 2,
              supersedesDocumentId: "doc_old_1",
              supersededByDocumentId: null,
              documentCreatedAt: "2026-03-30T00:00:00.000Z",
            },
            taxonomyMatches: [
              {
                taxonomyNodeId: "node_1",
                taxonomyNodeKey: "strategy.conversion",
                taxonomyNodeLabel: "Conversion Strategy",
                confidence: 0.92,
                assignedBy: "rule",
                assignmentMethod: "deterministic_keyword_v1",
              },
            ],
            provenance: {
              documentKind: "transcript",
              chunkIndex: 0,
              sourceKind: "youtube_video",
              sourceExternalId: "vid_1",
              sourceTitle: "Conversion strategy",
              sourceUrl: null,
              sourcePublisherName: null,
              sourcePublishedAt: null,
              sourcePayload: {},
              chunkMetadata: {},
            },
          },
          {
            chunkId: "chunk_2",
            documentId: "doc_2",
            sourceItemId: "source_2",
            ingestRunId: "run_2",
            chunkText: "Improve conversion by reducing friction in service page pathways.",
            relevanceScore: 2.1,
            selectionReason: ["fresh_source"],
            freshness: {
              isCurrent: true,
              freshnessScore: 0.91,
              versionNo: 1,
              supersedesDocumentId: null,
              supersededByDocumentId: null,
              documentCreatedAt: "2026-03-25T00:00:00.000Z",
            },
            taxonomyMatches: [],
            provenance: {
              documentKind: "transcript",
              chunkIndex: 1,
              sourceKind: "youtube_video",
              sourceExternalId: "vid_2",
              sourceTitle: "Service pathway optimization",
              sourceUrl: null,
              sourcePublisherName: null,
              sourcePublishedAt: null,
              sourcePayload: {},
              chunkMetadata: {},
            },
          },
        ],
      },
      themes: [
        {
          themeKey: "strategy.conversion",
          themeLabel: "Conversion Strategy",
          weight: 2.1,
          supportCount: 1,
          supportingChunkIds: ["chunk_1"],
        },
      ],
      strongestCurrentGuidance: [
        {
          chunkId: "chunk_1",
          documentId: "doc_1",
          sourceItemId: "source_1",
          guidanceText: "Improve conversion by tightening offer-message fit and CTA proof.",
          relevanceScore: 2.4,
          freshnessScore: 1,
        },
      ],
      conflicts: [],
      answeringNotes: {
        responseStyle: "expert_advisor_grounded",
        guardrails: ["Prioritize current/fresh guidance over superseded historical guidance."],
        recommendedStructure: [],
        practicalNotes: [],
      },
    });

    const { runCoBrainAnswerOrchestration } = await import("@/lib/brain-learning/answerOrchestration");
    const result = await runCoBrainAnswerOrchestration({
      brainId: "brain_1",
      query: "How do we improve local conversion?",
    });

    expect(runCoBrainContextAssemblyMock).toHaveBeenCalledTimes(1);
    expect(result.advisorResponse.responseVersion).toBe("advisor_response_v1");
    expect(result.advisorResponse.supportingContextItemIds).toEqual(["chunk_1", "chunk_2"]);
    expect(result.advisorResponse.recommendations.length).toBeGreaterThan(0);
    expect(result.advisorResponse.answer).toContain("current grounded evidence");
    expect(result.summary.evidenceSelected).toBe(2);
  });

  it("uses provided context packet and surfaces cautions/uncertainty for mixed evidence", async () => {
    const packet = {
      packetVersion: "co_brain_context_packet_v1",
      brainId: "brain_2",
      query: "What should we do next?",
      generatedAt: "2026-04-02T00:00:00.000Z",
      queryInterpretation: {
        normalizedQuery: "what should we do next",
        queryTerms: ["what", "next"],
        inferredIntents: ["planning"],
        preferredTaxonomyNodeIds: [],
        preferredTaxonomyNodeKeys: [],
      },
      retrieval: {
        rankingStrategy: "deterministic_lexical_taxonomy_freshness_v1",
        candidatesConsidered: 4,
        candidatesReturned: 4,
        candidatesSuppressed: {
          duplicateText: 0,
          staleSuperseded: 1,
          lowRelevance: 1,
        },
      },
      evidence: {
        selectedCount: 1,
        selected: [
          {
            chunkId: "chunk_x",
            documentId: "doc_x",
            sourceItemId: "source_x",
            ingestRunId: "run_x",
            chunkText: "Prioritize service-page clarity before expanding acquisition channels.",
            relevanceScore: 1.8,
            selectionReason: ["current_document"],
            freshness: {
              isCurrent: true,
              freshnessScore: 0.88,
              versionNo: 1,
              supersedesDocumentId: null,
              supersededByDocumentId: null,
              documentCreatedAt: "2026-03-15T00:00:00.000Z",
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
      },
      themes: [],
      strongestCurrentGuidance: [
        {
          chunkId: "chunk_x",
          documentId: "doc_x",
          sourceItemId: "source_x",
          guidanceText: "Prioritize service-page clarity before expanding acquisition channels.",
          relevanceScore: 1.8,
          freshnessScore: 0.88,
        },
      ],
      conflicts: [
        {
          conflictType: "supersession_tension",
          severity: "medium",
          summary: "Older guidance is still relevant.",
          involvedChunkIds: ["chunk_x", "chunk_y"],
        },
      ],
      answeringNotes: {
        responseStyle: "expert_advisor_grounded",
        guardrails: ["Stay grounded in selected evidence and do not invent unsupported claims."],
        recommendedStructure: [],
        practicalNotes: [],
      },
    };

    const { runCoBrainAnswerOrchestration } = await import("@/lib/brain-learning/answerOrchestration");
    const result = await runCoBrainAnswerOrchestration({
      brainId: "brain_2",
      query: "What should we do next?",
      contextPacket: packet as any,
    });

    expect(runCoBrainContextAssemblyMock).not.toHaveBeenCalled();
    expect(result.advisorResponse.generationNotes.contextSource).toBe("provided_packet");
    expect(result.advisorResponse.cautions.length).toBeGreaterThan(0);
    expect(result.advisorResponse.uncertaintyNotes.length).toBeGreaterThan(0);
    expect(result.advisorResponse.supportingContextItemIds).toEqual(["chunk_x"]);
  });

  it("rejects provided packet mismatch with request identity", async () => {
    const { runCoBrainAnswerOrchestration } = await import("@/lib/brain-learning/answerOrchestration");
    await expect(
      runCoBrainAnswerOrchestration({
        brainId: "brain_3",
        query: "Any update?",
        contextPacket: {
          packetVersion: "co_brain_context_packet_v1",
          brainId: "brain_other",
          query: "Any update?",
        } as any,
      })
    ).rejects.toThrow("Context packet brainId does not match request brainId");
  });
});
