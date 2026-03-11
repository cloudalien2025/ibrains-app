import { describe, expect, it } from "vitest";
import type { SerpCacheEntry } from "@/lib/directoryiq/types";
import { buildListingSerpContentStructure } from "@/src/directoryiq/services/listingSerpContentStructureService";

const baseSupport = {
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
};

const baseGaps = {
  listing: { id: "321", title: "Acme Plumbing", canonicalUrl: "https://example.com/listings/acme", siteId: "site-1" },
  summary: {
    totalGaps: 4,
    highCount: 2,
    mediumCount: 2,
    lowCount: 0,
    evaluatedAt: "2026-03-11T00:00:00.000Z",
    lastGraphRunAt: null,
    dataStatus: "gaps_found" as const,
  },
  items: [
    {
      type: "missing_comparison_content" as const,
      severity: "high" as const,
      title: "Missing comparison coverage",
      explanation: "Missing.",
      evidenceSummary: "No comparison content found.",
    },
    {
      type: "missing_faq_support_coverage" as const,
      severity: "medium" as const,
      title: "Missing FAQ coverage",
      explanation: "Missing.",
      evidenceSummary: "No FAQ content found.",
    },
    {
      type: "mentions_without_links" as const,
      severity: "medium" as const,
      title: "Mentions without links",
      explanation: "Mentions found.",
      evidenceSummary: "Mentions without links: 2.",
    },
    {
      type: "weak_anchor_text" as const,
      severity: "low" as const,
      title: "Weak anchors",
      explanation: "Generic anchors.",
      evidenceSummary: "Anchors are generic.",
    },
  ],
};

const baseActions = {
  listing: { id: "321", title: "Acme Plumbing", canonicalUrl: "https://example.com/listings/acme", siteId: "site-1" },
  summary: {
    totalActions: 4,
    highPriorityCount: 2,
    mediumPriorityCount: 2,
    lowPriorityCount: 0,
    evaluatedAt: "2026-03-11T00:00:00.000Z",
    dataStatus: "actions_recommended" as const,
  },
  items: [
    { key: "create_comparison_support_content" as const, priority: "high" as const, title: "Comparison", rationale: "", evidenceSummary: "" },
    { key: "generate_reinforcement_post" as const, priority: "medium" as const, title: "Post", rationale: "", evidenceSummary: "" },
    { key: "add_flywheel_links" as const, priority: "high" as const, title: "Links", rationale: "", evidenceSummary: "" },
    { key: "strengthen_anchor_text" as const, priority: "medium" as const, title: "Anchors", rationale: "", evidenceSummary: "" },
  ],
};

const baseFlywheel = {
  listing: { id: "321", title: "Acme Plumbing", canonicalUrl: "https://example.com/listings/acme", siteId: "site-1" },
  summary: {
    totalRecommendations: 3,
    highPriorityCount: 2,
    mediumPriorityCount: 1,
    lowPriorityCount: 0,
    evaluatedAt: "2026-03-11T00:00:00.000Z",
    dataStatus: "flywheel_opportunities_found" as const,
  },
  items: [
    {
      key: "missing_reciprocal_link:blog-1->321",
      type: "missing_reciprocal_link" as const,
      priority: "high" as const,
      title: "Missing reciprocal",
      rationale: "",
      evidenceSummary: "",
      sourceEntity: { id: "blog-1", type: "blog_post" as const, title: "Blog 1", url: "https://example.com/blog/1" },
      targetEntity: { id: "321", type: "listing" as const, title: "Acme", url: "https://example.com/listings/acme" },
    },
    {
      key: "blog_posts_should_link_to_listing:blog-2->321",
      type: "blog_posts_should_link_to_listing" as const,
      priority: "high" as const,
      title: "Should link",
      rationale: "",
      evidenceSummary: "",
      sourceEntity: { id: "blog-2", type: "blog_post" as const, title: "Blog 2", url: "https://example.com/blog/2" },
      targetEntity: { id: "321", type: "listing" as const, title: "Acme", url: "https://example.com/listings/acme" },
    },
    {
      key: "strengthen_anchor_text:blog-3->321",
      type: "strengthen_anchor_text" as const,
      priority: "medium" as const,
      title: "Strengthen anchors",
      rationale: "",
      evidenceSummary: "",
      sourceEntity: { id: "blog-3", type: "blog_post" as const, title: "Blog 3", url: "https://example.com/blog/3" },
      targetEntity: { id: "321", type: "listing" as const, title: "Acme", url: "https://example.com/listings/acme" },
    },
  ],
};

const baseIntentClusters = {
  listing: { id: "321", title: "Acme Plumbing", canonicalUrl: "https://example.com/listings/acme", siteId: "site-1" },
  summary: {
    totalClusters: 3,
    highPriorityCount: 2,
    mediumPriorityCount: 1,
    lowPriorityCount: 0,
    evaluatedAt: "2026-03-11T00:00:00.000Z",
    dataStatus: "clusters_identified" as const,
  },
  items: [
    { id: "reinforce_decision_stage_content" as const, title: "Decision", priority: "high" as const, rationale: "", evidenceSummary: "" },
    { id: "close_unlinked_support_mentions" as const, title: "Mentions", priority: "high" as const, rationale: "", evidenceSummary: "" },
    { id: "improve_anchor_intent_specificity" as const, title: "Anchors", priority: "medium" as const, rationale: "", evidenceSummary: "" },
  ],
};

const baseReinforcementPlan = {
  listing: { id: "321", title: "Acme Plumbing", canonicalUrl: "https://example.com/listings/acme", siteId: "site-1" },
  summary: {
    totalPlanItems: 4,
    highPriorityCount: 2,
    mediumPriorityCount: 2,
    lowPriorityCount: 0,
    evaluatedAt: "2026-03-11T00:00:00.000Z",
    dataStatus: "plan_items_identified" as const,
  },
  items: [
    {
      id: "publish_comparison_decision_post" as const,
      title: "Comparison",
      priority: "high" as const,
      rationale: "",
      evidenceSummary: "",
      suggestedContentPurpose: "",
      suggestedTargetSurface: "comparison" as const,
    },
    {
      id: "publish_faq_support_post" as const,
      title: "FAQ",
      priority: "medium" as const,
      rationale: "",
      evidenceSummary: "",
      suggestedContentPurpose: "",
      suggestedTargetSurface: "faq" as const,
    },
    {
      id: "publish_reciprocal_support_post" as const,
      title: "Reciprocal",
      priority: "high" as const,
      rationale: "",
      evidenceSummary: "",
      suggestedContentPurpose: "",
      suggestedTargetSurface: "blog" as const,
    },
    {
      id: "refresh_anchor_intent_post" as const,
      title: "Anchor",
      priority: "low" as const,
      rationale: "",
      evidenceSummary: "",
      suggestedContentPurpose: "",
      suggestedTargetSurface: "support_page" as const,
    },
  ],
};

const serpEntries: SerpCacheEntry[] = [
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
      h2Sections: [
        { heading: "Cost Factors", score: 6, avgPosition: 2, h3: ["What is included?"] },
        { heading: "How to Choose", score: 4, avgPosition: 3, h3: ["Checklist"] },
      ],
      mustCoverQuestions: ["what is included", "how to choose"],
      targetLengthBand: { min: 1000, median: 1400, max: 1800 },
    },
    content_deltas: [],
    error_message: null,
    created_at: "2026-03-11T00:00:00.000Z",
    updated_at: "2026-03-11T00:00:00.000Z",
    expires_at: "2026-03-20T00:00:00.000Z",
  },
];

describe("listing serp content structure service", () => {
  it("returns deterministic prioritized structure recommendations from first-party evidence", () => {
    const result = buildListingSerpContentStructure({
      support: baseSupport,
      gaps: baseGaps,
      actions: baseActions,
      flywheel: baseFlywheel,
      intentClusters: baseIntentClusters,
      reinforcementPlan: baseReinforcementPlan,
      serpCacheEntries: serpEntries,
      evaluatedAt: "2026-03-11T00:00:10.000Z",
    });

    expect(result.summary.dataStatus).toBe("structure_recommendations_identified");
    expect(result.summary.serpPatternStatus).toBe("patterns_available");
    expect(result.items[0].id).toBe("structure_decision_comparison");
    expect(result.items[0].priority).toBe("high");
    expect(result.items[0].serpPatternSummary?.commonHeadings.length).toBeGreaterThan(0);
    expect(result.serpPatternSummary?.targetLengthBand).toEqual({ min: 1000, median: 1400, max: 1800 });
  });

  it("returns intentional no-structure state when no major signals exist", () => {
    const result = buildListingSerpContentStructure({
      support: {
        ...baseSupport,
        summary: {
          ...baseSupport.summary,
          inboundLinkedSupportCount: 3,
          mentionWithoutLinkCount: 0,
          outboundSupportLinkCount: 2,
          connectedSupportPageCount: 2,
        },
      },
      gaps: {
        ...baseGaps,
        summary: {
          ...baseGaps.summary,
          totalGaps: 0,
          highCount: 0,
          mediumCount: 0,
          lowCount: 0,
          dataStatus: "no_meaningful_gaps",
        },
        items: [],
      },
      actions: {
        ...baseActions,
        summary: {
          ...baseActions.summary,
          totalActions: 0,
          highPriorityCount: 0,
          mediumPriorityCount: 0,
          lowPriorityCount: 0,
          dataStatus: "no_major_actions_recommended",
        },
        items: [],
      },
      flywheel: {
        ...baseFlywheel,
        summary: {
          ...baseFlywheel.summary,
          totalRecommendations: 0,
          highPriorityCount: 0,
          mediumPriorityCount: 0,
          lowPriorityCount: 0,
          dataStatus: "no_major_flywheel_opportunities",
        },
        items: [],
      },
      intentClusters: {
        ...baseIntentClusters,
        summary: {
          ...baseIntentClusters.summary,
          totalClusters: 0,
          highPriorityCount: 0,
          mediumPriorityCount: 0,
          lowPriorityCount: 0,
          dataStatus: "no_major_reinforcement_intent_clusters_identified",
        },
        items: [],
      },
      reinforcementPlan: {
        ...baseReinforcementPlan,
        summary: {
          ...baseReinforcementPlan.summary,
          totalPlanItems: 0,
          highPriorityCount: 0,
          mediumPriorityCount: 0,
          lowPriorityCount: 0,
          dataStatus: "no_major_reinforcement_plan_items_identified",
        },
        items: [],
      },
      serpCacheEntries: [],
      evaluatedAt: "2026-03-11T00:00:10.000Z",
    });

    expect(result.summary.dataStatus).toBe("no_major_structure_recommendations_identified");
    expect(result.summary.serpPatternStatus).toBe("patterns_unavailable");
    expect(result.items).toEqual([]);
  });
});
