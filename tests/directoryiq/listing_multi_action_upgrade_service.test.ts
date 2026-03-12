import { describe, expect, it } from "vitest";
import { buildListingMultiActionUpgrade } from "@/src/directoryiq/services/listingMultiActionUpgradeService";

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
    totalGaps: 3,
    highCount: 1,
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
      title: "Missing comparison support",
      explanation: "Missing.",
      evidenceSummary: "No comparison coverage.",
    },
    {
      type: "mentions_without_links" as const,
      severity: "medium" as const,
      title: "Mentions without links",
      explanation: "Mentions.",
      evidenceSummary: "Mentions without links: 2.",
    },
    {
      type: "weak_anchor_text" as const,
      severity: "medium" as const,
      title: "Weak anchors",
      explanation: "Anchors are generic.",
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
    { key: "optimize_listing" as const, priority: "high" as const, title: "Optimize", rationale: "", evidenceSummary: "" },
    { key: "add_flywheel_links" as const, priority: "high" as const, title: "Flywheel", rationale: "", evidenceSummary: "" },
    { key: "generate_reinforcement_post" as const, priority: "medium" as const, title: "Post", rationale: "", evidenceSummary: "" },
    { key: "strengthen_anchor_text" as const, priority: "medium" as const, title: "Anchor", rationale: "", evidenceSummary: "" },
  ],
};

const baseFlywheel = {
  listing: { id: "321", title: "Acme Plumbing", canonicalUrl: "https://example.com/listings/acme", siteId: "site-1" },
  summary: {
    totalRecommendations: 2,
    highPriorityCount: 1,
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
      sourceEntity: { id: "blog-1", type: "blog_post" as const, title: "Blog", url: "https://example.com/blog/1" },
      targetEntity: { id: "321", type: "listing" as const, title: "Acme", url: "https://example.com/listings/acme" },
    },
    {
      key: "strengthen_anchor_text:blog-2->321",
      type: "strengthen_anchor_text" as const,
      priority: "medium" as const,
      title: "Anchor",
      rationale: "",
      evidenceSummary: "",
      sourceEntity: { id: "blog-2", type: "blog_post" as const, title: "Blog 2", url: "https://example.com/blog/2" },
      targetEntity: { id: "321", type: "listing" as const, title: "Acme", url: "https://example.com/listings/acme" },
    },
  ],
};

const baseIntent = {
  listing: { id: "321", title: "Acme Plumbing", canonicalUrl: "https://example.com/listings/acme", siteId: "site-1" },
  summary: {
    totalClusters: 2,
    highPriorityCount: 1,
    mediumPriorityCount: 1,
    lowPriorityCount: 0,
    evaluatedAt: "2026-03-11T00:00:00.000Z",
    dataStatus: "clusters_identified" as const,
  },
  items: [
    { id: "repair_bidirectional_flywheel_links" as const, title: "Repair links", priority: "high" as const, rationale: "", evidenceSummary: "" },
    { id: "improve_anchor_intent_specificity" as const, title: "Anchor intent", priority: "medium" as const, rationale: "", evidenceSummary: "" },
  ],
};

const basePlan = {
  listing: { id: "321", title: "Acme Plumbing", canonicalUrl: "https://example.com/listings/acme", siteId: "site-1" },
  summary: {
    totalPlanItems: 2,
    highPriorityCount: 1,
    mediumPriorityCount: 1,
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

const baseStructure = {
  listing: { id: "321", title: "Acme Plumbing", canonicalUrl: "https://example.com/listings/acme", siteId: "site-1" },
  summary: {
    totalRecommendations: 2,
    highPriorityCount: 1,
    mediumPriorityCount: 1,
    lowPriorityCount: 0,
    evaluatedAt: "2026-03-11T00:00:00.000Z",
    dataStatus: "structure_recommendations_identified" as const,
    serpPatternStatus: "patterns_available" as const,
    serpPatternSource: "serp_cache" as const,
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
      id: "structure_decision_comparison" as const,
      key: "structure_decision_comparison" as const,
      title: "Decision comparison structure",
      priority: "high" as const,
      recommendedContentType: "comparison_page" as const,
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
      suggestedStructureType: "comparison_matrix" as const,
      suggestedSections: ["Who this is for"],
      suggestedComponents: ["comparison-table"],
    },
    {
      id: "structure_anchor_intent" as const,
      key: "structure_anchor_intent" as const,
      title: "Anchor intent",
      priority: "medium" as const,
      recommendedContentType: "support_post" as const,
      recommendedTitlePattern: "Acme Plumbing intent guide",
      suggestedH1: "Acme Plumbing intent and scenarios",
      suggestedH2Structure: ["Intent sections"],
      comparisonCriteria: [],
      faqThemes: [],
      localModifiers: [],
      entityCoverageTargets: ["Acme Plumbing"],
      internalLinkOpportunities: ["support-post -> listing"],
      whyThisStructureMatters: "Improves intent specificity.",
      rationale: "",
      evidenceSummary: "",
      suggestedStructureType: "anchor_intent_module" as const,
      suggestedSections: ["Intent sections"],
      suggestedComponents: ["toc-anchor-jumps"],
    },
  ],
};

describe("listing multi action upgrade service", () => {
  it("returns deterministic prioritized action set", () => {
    const result = buildListingMultiActionUpgrade({
      support: baseSupport,
      gaps: baseGaps,
      actions: baseActions,
      flywheel: baseFlywheel,
      intentClusters: baseIntent,
      reinforcementPlan: basePlan,
      contentStructure: baseStructure,
      integrations: { openaiConfigured: true, bdConfigured: true },
      evaluatedAt: "2026-03-11T00:00:10.000Z",
    });

    expect(result.summary.dataStatus).toBe("upgrade_actions_available");
    expect(result.summary.availableCount).toBeGreaterThan(0);
    expect(result.items[0].key).toBe("optimize_listing_description");
    expect(result.items[0].actionId).toBe("optimize_listing_description");
    expect(result.items[0].actionType).toBe("listing_detail_improvement");
    expect(result.items[0].readinessState).toBe("ready");
    expect(result.items[0].whyItMatters.length).toBeGreaterThan(0);
    expect(result.items[0].sourceSignals.gapTypes?.length).toBeGreaterThan(0);
    expect(result.items[0].status).toBe("available");
    expect(result.items[0].previewCapability?.supported).toBe(true);
    expect(result.grouped.byReadiness.ready.length).toBeGreaterThan(0);
  });

  it("returns intentional no-action state when all actions are not recommended", () => {
    const result = buildListingMultiActionUpgrade({
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
        ...baseIntent,
        summary: {
          ...baseIntent.summary,
          totalClusters: 0,
          highPriorityCount: 0,
          mediumPriorityCount: 0,
          lowPriorityCount: 0,
          dataStatus: "no_major_reinforcement_intent_clusters_identified",
        },
        items: [],
      },
      reinforcementPlan: {
        ...basePlan,
        summary: {
          ...basePlan.summary,
          totalPlanItems: 0,
          highPriorityCount: 0,
          mediumPriorityCount: 0,
          lowPriorityCount: 0,
          dataStatus: "no_major_reinforcement_plan_items_identified",
        },
        items: [],
      },
      contentStructure: {
        ...baseStructure,
        summary: {
          ...baseStructure.summary,
          totalRecommendations: 0,
          highPriorityCount: 0,
          mediumPriorityCount: 0,
          lowPriorityCount: 0,
          dataStatus: "no_major_structure_recommendations_identified",
        },
        items: [],
      },
      integrations: { openaiConfigured: true, bdConfigured: true },
      evaluatedAt: "2026-03-11T00:00:10.000Z",
    });

    expect(result.summary.dataStatus).toBe("no_major_upgrade_actions_available");
    expect(result.items.every((item) => item.status === "not_recommended")).toBe(true);
  });
});
