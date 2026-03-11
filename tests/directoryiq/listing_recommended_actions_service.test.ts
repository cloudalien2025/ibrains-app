import { describe, expect, it } from "vitest";
import { buildListingRecommendedActions } from "@/src/directoryiq/services/listingRecommendedActionsService";

describe("listing recommended actions service", () => {
  it("returns deterministic prioritized actions from support + gaps evidence", () => {
    const result = buildListingRecommendedActions({
      support: {
        listing: {
          id: "321",
          title: "Acme Plumbing",
          canonicalUrl: "https://example.com/listings/acme",
          siteId: "site-1",
        },
        summary: {
          inboundLinkedSupportCount: 0,
          mentionWithoutLinkCount: 3,
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
          totalGaps: 6,
          highCount: 1,
          mediumCount: 4,
          lowCount: 1,
          evaluatedAt: "2026-03-11T00:00:00.000Z",
          lastGraphRunAt: "2026-03-11T00:00:00.000Z",
          dataStatus: "gaps_found",
        },
        items: [
          {
            type: "no_linked_support_posts",
            severity: "high",
            title: "No support posts are linking to this listing",
            explanation: "Authority flow into this listing is missing.",
            evidenceSummary: "Inbound linked support count is 0.",
          },
          {
            type: "weak_anchor_text",
            severity: "medium",
            title: "Weak anchor text",
            explanation: "Generic anchor text detected.",
            evidenceSummary: "2 weak anchors found.",
          },
          {
            type: "mentions_without_links",
            severity: "medium",
            title: "Mentions without links",
            explanation: "Support content mentions without links.",
            evidenceSummary: "3 mentions without links.",
          },
          {
            type: "missing_comparison_content",
            severity: "medium",
            title: "Missing comparison support content",
            explanation: "No comparison-focused support found.",
            evidenceSummary: "No comparison post exists.",
          },
          {
            type: "missing_faq_support_coverage",
            severity: "medium",
            title: "Missing FAQ/support coverage",
            explanation: "No FAQ-like support content found.",
            evidenceSummary: "No FAQ support coverage found.",
          },
          {
            type: "weak_local_context_support",
            severity: "low",
            title: "Weak local/context support coverage",
            explanation: "Local intent support is weak.",
            evidenceSummary: "Local terms have low support coverage.",
          },
        ],
      },
      evaluatedAt: "2026-03-11T00:00:01.000Z",
    });

    expect(result.summary.dataStatus).toBe("actions_recommended");
    expect(result.summary.totalActions).toBe(7);
    expect(result.items.map((item) => item.key)).toEqual([
      "optimize_listing",
      "add_flywheel_links",
      "generate_reinforcement_cluster",
      "generate_reinforcement_post",
      "strengthen_anchor_text",
      "create_comparison_support_content",
      "add_local_context_support",
    ]);
  });

  it("returns intentional no-action state when no major gaps exist", () => {
    const result = buildListingRecommendedActions({
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
      evaluatedAt: "2026-03-11T00:00:01.000Z",
    });

    expect(result.items).toHaveLength(0);
    expect(result.summary.totalActions).toBe(0);
    expect(result.summary.dataStatus).toBe("no_major_actions_recommended");
  });
});
