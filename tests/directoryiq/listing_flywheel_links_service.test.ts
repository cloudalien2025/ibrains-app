import { describe, expect, it } from "vitest";
import { buildListingFlywheelLinks } from "@/src/directoryiq/services/listingFlywheelLinksService";

describe("listing flywheel links service", () => {
  it("returns deterministic prioritized flywheel recommendations when evidence supports them", () => {
    const result = buildListingFlywheelLinks({
      support: {
        listing: {
          id: "321",
          title: "Acme Plumbing",
          canonicalUrl: "https://example.com/listings/acme",
          siteId: "site-1",
        },
        summary: {
          inboundLinkedSupportCount: 1,
          mentionWithoutLinkCount: 1,
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
          totalGaps: 4,
          highCount: 1,
          mediumCount: 2,
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
            evidenceSummary: "1 mention without link.",
          },
          {
            type: "weak_anchor_text",
            severity: "medium",
            title: "Weak anchors",
            explanation: "Weak anchors found.",
            evidenceSummary: "Weak anchor text found.",
            evidence: { anchors: ["click here"] },
          },
          {
            type: "no_listing_to_support_links",
            severity: "high",
            title: "No reciprocal listing links",
            explanation: "No outbound support links.",
            evidenceSummary: "Outbound support links: 0.",
          },
          {
            type: "weak_category_support",
            severity: "low",
            title: "Weak category support",
            explanation: "Low category support.",
            evidenceSummary: "Category support is weak.",
          },
        ],
      },
      evaluatedAt: "2026-03-11T00:00:01.000Z",
    });

    expect(result.summary.dataStatus).toBe("flywheel_opportunities_found");
    expect(result.summary.totalRecommendations).toBeGreaterThanOrEqual(5);
    expect(result.items.map((item) => item.type)).toContain("blog_posts_should_link_to_listing");
    expect(result.items.map((item) => item.type)).toContain("missing_reciprocal_link");
    expect(result.items.map((item) => item.type)).toContain("listing_should_link_back_to_support_post");
    expect(result.items.map((item) => item.type)).toContain("strengthen_anchor_text");
    expect(result.items.map((item) => item.type)).toContain("category_or_guide_page_should_join_cluster");
    expect(result.items[0]?.priority).toBe("high");
  });

  it("returns intentional no-opportunity state for healthy bidirectional support", () => {
    const result = buildListingFlywheelLinks({
      support: {
        listing: {
          id: "322",
          title: "Healthy Listing",
          canonicalUrl: "https://example.com/listings/healthy",
          siteId: "site-1",
        },
        summary: {
          inboundLinkedSupportCount: 2,
          mentionWithoutLinkCount: 0,
          outboundSupportLinkCount: 2,
          connectedSupportPageCount: 2,
          lastGraphRunAt: "2026-03-11T00:00:00.000Z",
        },
        inboundLinkedSupport: [
          {
            sourceId: "blog-1",
            sourceType: "blog_post",
            title: "Healthy Listing guide",
            url: "https://example.com/blog/healthy-guide",
            anchors: ["healthy listing plumbing"],
            relationshipType: "links_to_listing",
          },
        ],
        mentionsWithoutLinks: [],
        outboundSupportLinks: [
          {
            targetId: "blog-1",
            targetType: "blog_post",
            title: "Healthy Listing guide",
            url: "https://example.com/blog/healthy-guide",
            relationshipType: "listing_links_out",
          },
        ],
        connectedSupportPages: [
          {
            id: "hub-1",
            type: "hub",
            title: "Plumbing · Austin",
            url: null,
          },
        ],
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
    expect(result.summary.totalRecommendations).toBe(0);
    expect(result.summary.dataStatus).toBe("no_major_flywheel_opportunities");
  });
});
