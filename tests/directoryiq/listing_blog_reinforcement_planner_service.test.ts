import { describe, expect, it } from "vitest";
import { buildListingBlogReinforcementPlan } from "@/src/directoryiq/services/listingBlogReinforcementPlannerService";

describe("listing blog reinforcement planner service", () => {
  it("returns deterministic prioritized reinforcement plan items from first-party evidence", () => {
    const result = buildListingBlogReinforcementPlan({
      support: {
        listing: {
          id: "321",
          title: "Acme Plumbing",
          canonicalUrl: "https://example.com/listings/acme",
          siteId: "site-1",
        },
        summary: {
          inboundLinkedSupportCount: 0,
          mentionWithoutLinkCount: 2,
          outboundSupportLinkCount: 0,
          connectedSupportPageCount: 0,
          lastGraphRunAt: "2026-03-11T00:00:00.000Z",
        },
        inboundLinkedSupport: [],
        mentionsWithoutLinks: [],
        outboundSupportLinks: [],
        connectedSupportPages: [],
      },
      gaps: {
        listing: {
          id: "321",
          title: "Acme Plumbing",
          canonicalUrl: "https://example.com/listings/acme",
          siteId: "site-1",
        },
        summary: {
          totalGaps: 5,
          highCount: 1,
          mediumCount: 3,
          lowCount: 1,
          evaluatedAt: "2026-03-11T00:00:00.000Z",
          lastGraphRunAt: "2026-03-11T00:00:00.000Z",
          dataStatus: "gaps_found",
        },
        items: [
          {
            type: "missing_comparison_content",
            severity: "medium",
            title: "Missing comparison support",
            explanation: "Missing comparison.",
            evidenceSummary: "No comparison slot found.",
          },
          {
            type: "missing_faq_support_coverage",
            severity: "medium",
            title: "Missing FAQ support",
            explanation: "Missing FAQ.",
            evidenceSummary: "No FAQ-like support slot found.",
          },
          {
            type: "weak_local_context_support",
            severity: "low",
            title: "Weak local context",
            explanation: "Weak local context.",
            evidenceSummary: "Local terms have low support coverage.",
          },
          {
            type: "mentions_without_links",
            severity: "medium",
            title: "Mentions without links",
            explanation: "Mentions found.",
            evidenceSummary: "Mentions without links: 2.",
          },
          {
            type: "weak_anchor_text",
            severity: "medium",
            title: "Weak anchors",
            explanation: "Weak anchor text.",
            evidenceSummary: "1 weak anchor instance(s) detected for this listing.",
          },
        ],
      },
      actions: {
        listing: {
          id: "321",
          title: "Acme Plumbing",
          canonicalUrl: "https://example.com/listings/acme",
          siteId: "site-1",
        },
        summary: {
          totalActions: 6,
          highPriorityCount: 2,
          mediumPriorityCount: 3,
          lowPriorityCount: 1,
          evaluatedAt: "2026-03-11T00:00:00.000Z",
          dataStatus: "actions_recommended",
        },
        items: [
          { key: "create_comparison_support_content", priority: "medium", title: "Comparison", rationale: "", evidenceSummary: "" },
          { key: "generate_reinforcement_post", priority: "medium", title: "Reinforcement post", rationale: "", evidenceSummary: "" },
          { key: "generate_reinforcement_cluster", priority: "high", title: "Cluster", rationale: "", evidenceSummary: "" },
          { key: "add_local_context_support", priority: "low", title: "Local context", rationale: "", evidenceSummary: "" },
          { key: "add_flywheel_links", priority: "high", title: "Flywheel links", rationale: "", evidenceSummary: "" },
          { key: "strengthen_anchor_text", priority: "medium", title: "Anchor text", rationale: "", evidenceSummary: "" },
        ],
      },
      flywheel: {
        listing: {
          id: "321",
          title: "Acme Plumbing",
          canonicalUrl: "https://example.com/listings/acme",
          siteId: "site-1",
        },
        summary: {
          totalRecommendations: 4,
          highPriorityCount: 2,
          mediumPriorityCount: 2,
          lowPriorityCount: 0,
          evaluatedAt: "2026-03-11T00:00:00.000Z",
          dataStatus: "flywheel_opportunities_found",
        },
        items: [
          {
            key: "blog_posts_should_link_to_listing:blog-2->321",
            type: "blog_posts_should_link_to_listing",
            priority: "high",
            title: "Blog should link",
            rationale: "",
            evidenceSummary: "",
            sourceEntity: { id: "blog-2", type: "blog_post", title: "Guide", url: null },
            targetEntity: { id: "321", type: "listing", title: "Acme Plumbing", url: null },
          },
          {
            key: "missing_reciprocal_link:321<->blog-2",
            type: "missing_reciprocal_link",
            priority: "high",
            title: "Missing reciprocal",
            rationale: "",
            evidenceSummary: "",
            sourceEntity: { id: "321", type: "listing", title: "Acme Plumbing", url: null },
            targetEntity: { id: "blog-2", type: "blog_post", title: "Guide", url: null },
          },
          {
            key: "category_or_guide_page_should_join_cluster:321",
            type: "category_or_guide_page_should_join_cluster",
            priority: "medium",
            title: "Cluster page",
            rationale: "",
            evidenceSummary: "",
            sourceEntity: { id: "321", type: "listing", title: "Acme Plumbing", url: null },
            targetEntity: { id: "321:cluster", type: "category_page", title: "Cluster", url: null },
          },
          {
            key: "strengthen_anchor_text:blog-1->321",
            type: "strengthen_anchor_text",
            priority: "medium",
            title: "Strengthen anchors",
            rationale: "",
            evidenceSummary: "",
            sourceEntity: { id: "blog-1", type: "blog_post", title: "Guide", url: null },
            targetEntity: { id: "321", type: "listing", title: "Acme Plumbing", url: null },
          },
        ],
      },
      intentClusters: {
        listing: {
          id: "321",
          title: "Acme Plumbing",
          canonicalUrl: "https://example.com/listings/acme",
          siteId: "site-1",
        },
        summary: {
          totalClusters: 5,
          highPriorityCount: 2,
          mediumPriorityCount: 3,
          lowPriorityCount: 0,
          evaluatedAt: "2026-03-11T00:00:00.000Z",
          dataStatus: "clusters_identified",
        },
        intentProfile: {
          primaryIntent: "hire_trusted_local_service",
          secondaryIntents: ["compare_alternatives", "validate_trust_signals", "confirm_local_fit"],
          targetEntities: ["Acme Plumbing", "plumber", "Denver"],
          supportingEntities: ["reviews", "credentials", "coverage area"],
          localModifiers: ["Denver"],
          comparisonFrames: ["Acme Plumbing vs nearby plumbing providers in Denver"],
          supportedEntities: ["reviews"],
          missingEntities: ["credentials", "coverage area"],
          clusterPriorityRanking: [
            {
              clusterId: "proof_depth",
              title: "Proof Depth",
              priority: "high",
              score: 34,
              rationale: "Support evidence is thin.",
            },
          ],
          confidence: "medium",
          dataStatus: "intent_resolved",
        },
        items: [
          { id: "close_unlinked_support_mentions", title: "", priority: "high", rationale: "", evidenceSummary: "" },
          { id: "repair_bidirectional_flywheel_links", title: "", priority: "high", rationale: "", evidenceSummary: "" },
          { id: "reinforce_decision_stage_content", title: "", priority: "medium", rationale: "", evidenceSummary: "" },
          { id: "strengthen_local_selection_confidence", title: "", priority: "medium", rationale: "", evidenceSummary: "" },
          { id: "improve_anchor_intent_specificity", title: "", priority: "medium", rationale: "", evidenceSummary: "" },
        ],
      },
      evaluatedAt: "2026-03-11T00:00:01.000Z",
    });

    expect(result.summary.dataStatus).toBe("plan_items_identified");
    expect(result.summary.totalPlanItems).toBe(6);
    expect(result.items.map((item) => item.id)).toEqual([
      "publish_comparison_decision_post",
      "publish_faq_support_post",
      "publish_reciprocal_support_post",
      "publish_local_context_guide",
      "publish_cluster_hub_support_page",
      "refresh_anchor_intent_post",
    ]);
    expect(result.items[0]?.priority).toBe("high");
    expect(result.items[0]?.recommendationType).toBeDefined();
    expect(result.items[0]?.targetIntent).toBeDefined();
    expect(result.items[0]?.suggestedInternalLinkPattern).toContain("->");
    expect(result.items[0]?.reinforcesListingId).toBe("321");
  });

  it("returns intentional no-plan state when no major reinforcement signals exist", () => {
    const result = buildListingBlogReinforcementPlan({
      support: {
        listing: {
          id: "322",
          title: "Healthy Listing",
          canonicalUrl: "https://example.com/listings/healthy",
          siteId: "site-1",
        },
        summary: {
          inboundLinkedSupportCount: 3,
          mentionWithoutLinkCount: 0,
          outboundSupportLinkCount: 2,
          connectedSupportPageCount: 2,
          lastGraphRunAt: "2026-03-11T00:00:00.000Z",
        },
        inboundLinkedSupport: [],
        mentionsWithoutLinks: [],
        outboundSupportLinks: [],
        connectedSupportPages: [],
      },
      gaps: {
        listing: {
          id: "322",
          title: "Healthy Listing",
          canonicalUrl: "https://example.com/listings/healthy",
          siteId: "site-1",
        },
        summary: {
          totalGaps: 0,
          highCount: 0,
          mediumCount: 0,
          lowCount: 0,
          evaluatedAt: "2026-03-11T00:00:00.000Z",
          lastGraphRunAt: "2026-03-11T00:00:00.000Z",
          dataStatus: "no_meaningful_gaps",
        },
        items: [],
      },
      actions: {
        listing: {
          id: "322",
          title: "Healthy Listing",
          canonicalUrl: "https://example.com/listings/healthy",
          siteId: "site-1",
        },
        summary: {
          totalActions: 0,
          highPriorityCount: 0,
          mediumPriorityCount: 0,
          lowPriorityCount: 0,
          evaluatedAt: "2026-03-11T00:00:00.000Z",
          dataStatus: "no_major_actions_recommended",
        },
        items: [],
      },
      flywheel: {
        listing: {
          id: "322",
          title: "Healthy Listing",
          canonicalUrl: "https://example.com/listings/healthy",
          siteId: "site-1",
        },
        summary: {
          totalRecommendations: 0,
          highPriorityCount: 0,
          mediumPriorityCount: 0,
          lowPriorityCount: 0,
          evaluatedAt: "2026-03-11T00:00:00.000Z",
          dataStatus: "no_major_flywheel_opportunities",
        },
        items: [],
      },
      intentClusters: {
        listing: {
          id: "322",
          title: "Healthy Listing",
          canonicalUrl: "https://example.com/listings/healthy",
          siteId: "site-1",
        },
        summary: {
          totalClusters: 0,
          highPriorityCount: 0,
          mediumPriorityCount: 0,
          lowPriorityCount: 0,
          evaluatedAt: "2026-03-11T00:00:00.000Z",
          dataStatus: "no_major_reinforcement_intent_clusters_identified",
        },
        items: [],
      },
      evaluatedAt: "2026-03-11T00:00:01.000Z",
    });

    expect(result.items).toHaveLength(0);
    expect(result.summary.totalPlanItems).toBe(0);
    expect(result.summary.dataStatus).toBe("no_major_reinforcement_plan_items_identified");
  });
});
