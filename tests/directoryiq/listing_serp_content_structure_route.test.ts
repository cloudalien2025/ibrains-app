import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const listSerpStatusMock = vi.fn();

vi.mock("@/lib/directoryiq/storage/serpCacheStore", () => ({
  listSerpStatus: listSerpStatusMock,
}));

const baseBody = {
  support: {
    listing: { id: "321", title: "Acme Plumbing", canonicalUrl: "https://example.com/listings/acme", siteId: "site-1" },
    summary: {
      inboundLinkedSupportCount: 0,
      mentionWithoutLinkCount: 2,
      outboundSupportLinkCount: 0,
      connectedSupportPageCount: 0,
      lastGraphRunAt: null,
    },
    inboundLinkedSupport: [],
    mentionsWithoutLinks: [],
    outboundSupportLinks: [],
    connectedSupportPages: [],
  },
  gaps: {
    listing: { id: "321", title: "Acme Plumbing", canonicalUrl: "https://example.com/listings/acme", siteId: "site-1" },
    summary: {
      totalGaps: 2,
      highCount: 1,
      mediumCount: 1,
      lowCount: 0,
      evaluatedAt: "2026-03-11T00:00:00.000Z",
      lastGraphRunAt: null,
      dataStatus: "gaps_found",
    },
    items: [
      {
        type: "missing_comparison_content",
        severity: "high",
        title: "Missing comparison",
        explanation: "Missing.",
        evidenceSummary: "No comparison content found.",
      },
      {
        type: "mentions_without_links",
        severity: "medium",
        title: "Mentions without links",
        explanation: "Mentions.",
        evidenceSummary: "Mentions without links: 2.",
      },
    ],
  },
  actions: {
    listing: { id: "321", title: "Acme Plumbing", canonicalUrl: "https://example.com/listings/acme", siteId: "site-1" },
    summary: {
      totalActions: 2,
      highPriorityCount: 1,
      mediumPriorityCount: 1,
      lowPriorityCount: 0,
      evaluatedAt: "2026-03-11T00:00:00.000Z",
      dataStatus: "actions_recommended",
    },
    items: [
      {
        key: "add_flywheel_links",
        priority: "high",
        title: "Add flywheel links",
        rationale: "",
        evidenceSummary: "",
      },
      {
        key: "create_comparison_support_content",
        priority: "medium",
        title: "Comparison",
        rationale: "",
        evidenceSummary: "",
      },
    ],
  },
  flywheel: {
    listing: { id: "321", title: "Acme Plumbing", canonicalUrl: "https://example.com/listings/acme", siteId: "site-1" },
    summary: {
      totalRecommendations: 1,
      highPriorityCount: 1,
      mediumPriorityCount: 0,
      lowPriorityCount: 0,
      evaluatedAt: "2026-03-11T00:00:00.000Z",
      dataStatus: "flywheel_opportunities_found",
    },
    items: [
      {
        key: "missing_reciprocal_link:blog-1->321",
        type: "missing_reciprocal_link",
        priority: "high",
        title: "Missing reciprocal",
        rationale: "",
        evidenceSummary: "",
        sourceEntity: { id: "blog-1", type: "blog_post", title: "Blog", url: "https://example.com/blog" },
        targetEntity: { id: "321", type: "listing", title: "Acme", url: "https://example.com/listings/acme" },
      },
    ],
  },
  intentClusters: {
    listing: { id: "321", title: "Acme Plumbing", canonicalUrl: "https://example.com/listings/acme", siteId: "site-1" },
    summary: {
      totalClusters: 1,
      highPriorityCount: 1,
      mediumPriorityCount: 0,
      lowPriorityCount: 0,
      evaluatedAt: "2026-03-11T00:00:00.000Z",
      dataStatus: "clusters_identified",
    },
    items: [{ id: "reinforce_decision_stage_content", title: "Decision", priority: "high", rationale: "", evidenceSummary: "" }],
  },
  reinforcementPlan: {
    listing: { id: "321", title: "Acme Plumbing", canonicalUrl: "https://example.com/listings/acme", siteId: "site-1" },
    summary: {
      totalPlanItems: 1,
      highPriorityCount: 1,
      mediumPriorityCount: 0,
      lowPriorityCount: 0,
      evaluatedAt: "2026-03-11T00:00:00.000Z",
      dataStatus: "plan_items_identified",
    },
    items: [
      {
        id: "publish_comparison_decision_post",
        title: "Comparison",
        priority: "high",
        rationale: "",
        evidenceSummary: "",
        suggestedContentPurpose: "",
        suggestedTargetSurface: "comparison",
      },
    ],
  },
};

describe("directoryiq listing serp content structure route", () => {
  beforeEach(() => {
    listSerpStatusMock.mockReset();
  });

  it("returns canonical content structure payload", async () => {
    listSerpStatusMock.mockResolvedValue([
      {
        id: "cache-1",
        listing_id: "321",
        slot_id: "comparison",
        focus_keyword: "acme plumbing comparison",
        location_modifier: null,
        serp_query_used: "acme plumbing comparison",
        status: "READY",
        top_results: [],
        extracted_outline: [],
        consensus_outline: {
          h2Sections: [{ heading: "Cost Factors", score: 3, avgPosition: 2, h3: [] }],
          mustCoverQuestions: ["what is included"],
          targetLengthBand: { min: 1000, median: 1400, max: 1800 },
        },
        content_deltas: [],
        error_message: null,
        created_at: "2026-03-11T00:00:00.000Z",
        updated_at: "2026-03-11T00:00:00.000Z",
        expires_at: "2026-03-20T00:00:00.000Z",
      },
    ]);

    const { POST } = await import("@/app/api/directoryiq/listings/[listingId]/content-structure/route");
    const req = new NextRequest("http://localhost/api/directoryiq/listings/321/content-structure", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(baseBody),
    });

    const res = await POST(req, { params: { listingId: "321" } });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.contentStructure.listing.id).toBe("321");
    expect(json.contentStructure.summary.dataStatus).toBe("structure_recommendations_identified");
    expect(json.meta.source).toBe("first_party_serp_content_structure_v1");
    expect(listSerpStatusMock).toHaveBeenCalledWith("321");
  });

  it("returns intentional no-structure state", async () => {
    listSerpStatusMock.mockResolvedValue([]);

    const { POST } = await import("@/app/api/directoryiq/listings/[listingId]/content-structure/route");
    const req = new NextRequest("http://localhost/api/directoryiq/listings/321/content-structure", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...baseBody,
        support: {
          ...baseBody.support,
          summary: {
            ...baseBody.support.summary,
            inboundLinkedSupportCount: 3,
            mentionWithoutLinkCount: 0,
            outboundSupportLinkCount: 2,
            connectedSupportPageCount: 3,
          },
        },
        gaps: {
          ...baseBody.gaps,
          summary: {
            ...baseBody.gaps.summary,
            totalGaps: 0,
            highCount: 0,
            mediumCount: 0,
            lowCount: 0,
            dataStatus: "no_meaningful_gaps",
          },
          items: [],
        },
        actions: {
          ...baseBody.actions,
          summary: {
            ...baseBody.actions.summary,
            totalActions: 0,
            highPriorityCount: 0,
            mediumPriorityCount: 0,
            lowPriorityCount: 0,
            dataStatus: "no_major_actions_recommended",
          },
          items: [],
        },
        flywheel: {
          ...baseBody.flywheel,
          summary: {
            ...baseBody.flywheel.summary,
            totalRecommendations: 0,
            highPriorityCount: 0,
            mediumPriorityCount: 0,
            lowPriorityCount: 0,
            dataStatus: "no_major_flywheel_opportunities",
          },
          items: [],
        },
        intentClusters: {
          ...baseBody.intentClusters,
          summary: {
            ...baseBody.intentClusters.summary,
            totalClusters: 0,
            highPriorityCount: 0,
            mediumPriorityCount: 0,
            lowPriorityCount: 0,
            dataStatus: "no_major_reinforcement_intent_clusters_identified",
          },
          items: [],
        },
        reinforcementPlan: {
          ...baseBody.reinforcementPlan,
          summary: {
            ...baseBody.reinforcementPlan.summary,
            totalPlanItems: 0,
            highPriorityCount: 0,
            mediumPriorityCount: 0,
            lowPriorityCount: 0,
            dataStatus: "no_major_reinforcement_plan_items_identified",
          },
          items: [],
        },
      }),
    });

    const res = await POST(req, { params: { listingId: "321" } });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.contentStructure.summary.dataStatus).toBe("no_major_structure_recommendations_identified");
    expect(json.contentStructure.summary.serpPatternStatus).toBe("patterns_unavailable");
  });

  it("returns explicit failure state when serp status retrieval throws", async () => {
    listSerpStatusMock.mockRejectedValue(new Error("serp status read failed"));

    const { POST } = await import("@/app/api/directoryiq/listings/[listingId]/content-structure/route");
    const req = new NextRequest("http://localhost/api/directoryiq/listings/321/content-structure", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(baseBody),
    });

    const res = await POST(req, { params: { listingId: "321" } });
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.ok).toBe(false);
    expect(json.error.code).toBe("CONTENT_STRUCTURE_EVALUATION_FAILED");
  });
});
