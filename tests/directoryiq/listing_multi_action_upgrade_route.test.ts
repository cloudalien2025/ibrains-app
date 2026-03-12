import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

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
        title: "Missing comparison support",
        explanation: "Missing.",
        evidenceSummary: "No comparison coverage.",
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
      { key: "optimize_listing", priority: "high", title: "Optimize", rationale: "", evidenceSummary: "" },
      { key: "add_flywheel_links", priority: "medium", title: "Flywheel", rationale: "", evidenceSummary: "" },
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
        sourceEntity: { id: "blog-1", type: "blog_post", title: "Blog", url: "https://example.com/blog/1" },
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
    items: [{ id: "repair_bidirectional_flywheel_links", title: "Repair", priority: "high", rationale: "", evidenceSummary: "" }],
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
  contentStructure: {
    listing: { id: "321", title: "Acme Plumbing", canonicalUrl: "https://example.com/listings/acme", siteId: "site-1" },
    summary: {
      totalRecommendations: 1,
      highPriorityCount: 1,
      mediumPriorityCount: 0,
      lowPriorityCount: 0,
      evaluatedAt: "2026-03-11T00:00:00.000Z",
      dataStatus: "structure_recommendations_identified",
      serpPatternStatus: "patterns_available",
      serpPatternSource: "serp_cache",
    },
    serpPatternSummary: {
      readySlotCount: 1,
      totalSlotCount: 1,
      commonHeadings: ["Cost Factors"],
      commonQuestions: ["what is included"],
      targetLengthBand: { min: 1000, median: 1400, max: 1800 },
    },
    items: [
      {
        id: "structure_decision_comparison",
        key: "structure_decision_comparison",
        title: "Decision comparison",
        priority: "high",
        recommendedContentType: "comparison_page",
        recommendedTitlePattern: "Acme Plumbing comparison guide",
        suggestedH1: "Acme Plumbing selection guide",
        suggestedH2Structure: ["Who this is for"],
        comparisonCriteria: ["price"],
        faqThemes: ["what is included"],
        localModifiers: ["Denver"],
        entityCoverageTargets: ["Acme Plumbing"],
        internalLinkOpportunities: ["comparison-page -> listing"],
        whyThisStructureMatters: "Decision-stage users need explicit structure.",
        rationale: "",
        evidenceSummary: "",
        suggestedStructureType: "comparison_matrix",
        suggestedSections: ["Who this is for"],
        suggestedComponents: ["comparison-table"],
      },
    ],
  },
  integrations: {
    openaiConfigured: true,
    bdConfigured: true,
  },
};

describe("directoryiq listing multi-action upgrade route", () => {
  it("returns canonical multi-action payload", async () => {
    const { POST } = await import("@/app/api/directoryiq/listings/[listingId]/upgrade/multi-action/route");
    const req = new NextRequest("http://localhost/api/directoryiq/listings/321/upgrade/multi-action", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(baseBody),
    });

    const res = await POST(req, { params: { listingId: "321" } });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.multiAction.listing.id).toBe("321");
    expect(json.multiAction.summary.dataStatus).toBe("upgrade_actions_available");
    expect(json.meta.source).toBe("first_party_multi_action_upgrade_v1");
  });

  it("returns intentional no-action state", async () => {
    const { POST } = await import("@/app/api/directoryiq/listings/[listingId]/upgrade/multi-action/route");
    const req = new NextRequest("http://localhost/api/directoryiq/listings/321/upgrade/multi-action", {
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
            connectedSupportPageCount: 2,
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
        contentStructure: {
          ...baseBody.contentStructure,
          summary: {
            ...baseBody.contentStructure.summary,
            totalRecommendations: 0,
            highPriorityCount: 0,
            mediumPriorityCount: 0,
            lowPriorityCount: 0,
            dataStatus: "no_major_structure_recommendations_identified",
          },
          items: [],
        },
      }),
    });

    const res = await POST(req, { params: { listingId: "321" } });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.multiAction.summary.dataStatus).toBe("no_major_upgrade_actions_available");
  });
});
