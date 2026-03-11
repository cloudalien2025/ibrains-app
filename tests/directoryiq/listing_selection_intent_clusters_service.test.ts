import { describe, expect, it } from "vitest";
import { buildListingSelectionIntentClusters } from "@/src/directoryiq/services/listingSelectionIntentClustersService";

describe("listing selection intent clusters service", () => {
  it("returns deterministic prioritized clusters from support, gaps, actions, and flywheel evidence", () => {
    const result = buildListingSelectionIntentClusters({
      support: {
        listing: {
          id: "321",
          title: "Acme Plumbing",
          canonicalUrl: "https://example.com/listings/acme",
          siteId: "site-1",
        },
        summary: {
          inboundLinkedSupportCount: 1,
          mentionWithoutLinkCount: 2,
          outboundSupportLinkCount: 0,
          connectedSupportPageCount: 0,
          lastGraphRunAt: "2026-03-11T00:00:00.000Z",
        },
        inboundLinkedSupport: [
          {
            sourceId: "blog-1",
            sourceType: "blog_post",
            title: "How to pick a plumber",
            url: "https://example.com/blog/pick-a-plumber",
            anchors: ["click here"],
            relationshipType: "links_to_listing",
          },
        ],
        mentionsWithoutLinks: [
          {
            sourceId: "blog-2",
            sourceType: "blog_post",
            title: "Emergency checklist",
            url: "https://example.com/blog/checklist",
            mentionSnippet: "Acme Plumbing has same-day service.",
            relationshipType: "mentions_without_link",
          },
        ],
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
            type: "mentions_without_links",
            severity: "medium",
            title: "Mentions without links are present",
            explanation: "Mentions found.",
            evidenceSummary: "2 mentions without links.",
          },
          {
            type: "no_listing_to_support_links",
            severity: "high",
            title: "No reciprocal links",
            explanation: "No outbound links.",
            evidenceSummary: "Outbound support links: 0.",
          },
          {
            type: "missing_comparison_content",
            severity: "medium",
            title: "Missing comparison content",
            explanation: "Missing.",
            evidenceSummary: "No comparison slot found.",
          },
          {
            type: "weak_local_context_support",
            severity: "low",
            title: "Weak local support",
            explanation: "Weak local context.",
            evidenceSummary: "Local terms have low support coverage.",
          },
          {
            type: "weak_anchor_text",
            severity: "medium",
            title: "Weak anchors",
            explanation: "Weak anchors found.",
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
          totalActions: 5,
          highPriorityCount: 2,
          mediumPriorityCount: 2,
          lowPriorityCount: 1,
          evaluatedAt: "2026-03-11T00:00:00.000Z",
          dataStatus: "actions_recommended",
        },
        items: [
          {
            key: "optimize_listing",
            priority: "high",
            title: "Optimize listing authority structure",
            rationale: "Tune listing.",
            evidenceSummary: "Gaps present.",
          },
          {
            key: "add_flywheel_links",
            priority: "high",
            title: "Add flywheel links",
            rationale: "Need reciprocal links.",
            evidenceSummary: "Outbound support links: 0.",
          },
          {
            key: "create_comparison_support_content",
            priority: "medium",
            title: "Create comparison support content",
            rationale: "Missing comparison support.",
            evidenceSummary: "No comparison coverage found.",
          },
          {
            key: "add_local_context_support",
            priority: "low",
            title: "Add local/context support",
            rationale: "Local coverage weak.",
            evidenceSummary: "Local support is weak.",
          },
          {
            key: "strengthen_anchor_text",
            priority: "medium",
            title: "Strengthen anchor text",
            rationale: "Weak anchors.",
            evidenceSummary: "Weak anchor evidence.",
          },
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
            title: "Blog post should link directly",
            rationale: "Mention without link.",
            evidenceSummary: "Detected mention without link.",
            sourceEntity: { id: "blog-2", type: "blog_post", title: "Emergency checklist", url: "https://example.com/blog/checklist" },
            targetEntity: { id: "321", type: "listing", title: "Acme Plumbing", url: "https://example.com/listings/acme" },
          },
          {
            key: "missing_reciprocal_link:321<->blog-1",
            type: "missing_reciprocal_link",
            priority: "high",
            title: "Missing reciprocal",
            rationale: "No reciprocal link pair.",
            evidenceSummary: "No reciprocal pair.",
            sourceEntity: { id: "321", type: "listing", title: "Acme Plumbing", url: "https://example.com/listings/acme" },
            targetEntity: { id: "blog-1", type: "blog_post", title: "How to pick a plumber", url: "https://example.com/blog/pick-a-plumber" },
          },
          {
            key: "category_or_guide_page_should_join_cluster:321",
            type: "category_or_guide_page_should_join_cluster",
            priority: "medium",
            title: "Add category page",
            rationale: "Need cluster support.",
            evidenceSummary: "Connected support pages: 0.",
            sourceEntity: { id: "321", type: "listing", title: "Acme Plumbing", url: "https://example.com/listings/acme" },
            targetEntity: { id: "321:cluster", type: "category_page", title: "Category cluster", url: null },
          },
          {
            key: "strengthen_anchor_text:blog-1->321",
            type: "strengthen_anchor_text",
            priority: "medium",
            title: "Strengthen anchors",
            rationale: "Weak anchors.",
            evidenceSummary: "Weak anchors.",
            sourceEntity: { id: "blog-1", type: "blog_post", title: "How to pick a plumber", url: "https://example.com/blog/pick-a-plumber" },
            targetEntity: { id: "321", type: "listing", title: "Acme Plumbing", url: "https://example.com/listings/acme" },
          },
        ],
      },
      evaluatedAt: "2026-03-11T00:00:01.000Z",
    });

    expect(result.summary.dataStatus).toBe("clusters_identified");
    expect(result.summary.totalClusters).toBe(5);
    expect(result.items.map((item) => item.id)).toEqual([
      "close_unlinked_support_mentions",
      "repair_bidirectional_flywheel_links",
      "reinforce_decision_stage_content",
      "strengthen_local_selection_confidence",
      "improve_anchor_intent_specificity",
    ]);
    expect(result.items[0]?.priority).toBe("high");
  });

  it("returns intentional no-cluster state when no strategic signals are present", () => {
    const result = buildListingSelectionIntentClusters({
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
      evaluatedAt: "2026-03-11T00:00:01.000Z",
    });

    expect(result.items).toHaveLength(0);
    expect(result.summary.totalClusters).toBe(0);
    expect(result.summary.dataStatus).toBe("no_major_reinforcement_intent_clusters_identified");
  });
});
