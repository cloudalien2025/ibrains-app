import { beforeEach, describe, expect, it, vi } from "vitest";

const getIssues = vi.fn();
const getListingCurrentSupport = vi.fn();
const computeListingMetrics = vi.fn();
const weakAnchorDetector = vi.fn();

vi.mock("@/src/directoryiq/graph/graphService", () => ({
  getIssues: (...args: unknown[]) => getIssues(...args),
}));

vi.mock("@/src/directoryiq/services/listingSupportService", () => ({
  getListingCurrentSupport: (...args: unknown[]) => getListingCurrentSupport(...args),
}));

vi.mock("@/src/directoryiq/services/graphIntegrity/integrityMetrics", () => ({
  computeListingMetrics: (...args: unknown[]) => computeListingMetrics(...args),
}));

vi.mock("@/src/directoryiq/domain/authorityGraph", () => ({
  weakAnchorDetector: (...args: unknown[]) => weakAnchorDetector(...args),
}));

import { getListingAuthorityGaps } from "@/src/directoryiq/services/listingGapsService";

describe("listing gaps service", () => {
  beforeEach(() => {
    getIssues.mockReset();
    getListingCurrentSupport.mockReset();
    computeListingMetrics.mockReset();
    weakAnchorDetector.mockReset();
  });

  it("returns structured deterministic gaps with severity and evidence", async () => {
    weakAnchorDetector.mockImplementation((value: string) => value.toLowerCase() === "click here");
    getListingCurrentSupport.mockResolvedValue({
      listing: {
        id: "listing-1",
        title: "Acme Plumbing",
        canonicalUrl: "https://example.com/listings/acme",
        siteId: "site-1",
      },
      summary: {
        inboundLinkedSupportCount: 0,
        mentionWithoutLinkCount: 1,
        outboundSupportLinkCount: 0,
        connectedSupportPageCount: 0,
        lastGraphRunAt: "2026-03-10T00:00:00.000Z",
      },
      inboundLinkedSupport: [
        {
          sourceId: "blog-1",
          sourceType: "blog_post",
          title: "Plumbing Guide",
          url: "https://example.com/blog/guide",
          anchors: ["click here"],
          relationshipType: "links_to_listing",
        },
      ],
      mentionsWithoutLinks: [
        {
          sourceId: "blog-2",
          sourceType: "blog_post",
          title: "Checklist",
          url: "https://example.com/blog/checklist",
          mentionSnippet: "Acme Plumbing is mentioned here.",
          relationshipType: "mentions_without_link",
        },
      ],
      outboundSupportLinks: [],
      connectedSupportPages: [],
    });
    computeListingMetrics.mockResolvedValue({
      inbound_links_to_count: 0,
      inbound_mentions_count: 1,
      unique_referring_blogs: 1,
      anchor_diversity_score: 0,
      backlink_compliance_rate: 0,
      orphan_status: true,
    });
    getIssues.mockResolvedValue({
      orphans: [
        {
          to: { externalId: "listing-1" },
        },
      ],
      mentions_without_links: [
        {
          to: { externalId: "listing-1" },
        },
      ],
      weak_anchors: [
        {
          to: { externalId: "listing-1" },
          evidence: { anchorText: "click here" },
        },
      ],
      lastRun: null,
    });

    const result = await getListingAuthorityGaps({
      tenantId: "default",
      listingId: "listing-1",
      listingTitle: "Acme Plumbing",
      listingUrl: "https://example.com/listings/acme",
      siteId: "site-1",
      listingRaw: {
        group_category: "Plumber",
        city: "Austin",
        state: "TX",
      },
      authorityPosts: [
        {
          post_type: "best_of",
          status: "not_created",
          title: null,
          focus_topic: "Top plumbers",
        },
      ],
    });

    expect(result.listing.id).toBe("listing-1");
    expect(result.summary.dataStatus).toBe("gaps_found");
    expect(result.summary.totalGaps).toBeGreaterThanOrEqual(5);
    expect(result.items.map((item) => item.type)).toContain("no_linked_support_posts");
    expect(result.items.map((item) => item.type)).toContain("weak_anchor_text");
    expect(result.items.map((item) => item.type)).toContain("mentions_without_links");
    expect(result.items.map((item) => item.type)).toContain("no_listing_to_support_links");
    expect(result.items.map((item) => item.type)).toContain("missing_comparison_content");
    expect(result.items.map((item) => item.type)).toContain("missing_faq_support_coverage");
    expect(result.items[0]?.severity).toBe("high");
    expect(result.summary.evaluatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("returns no_meaningful_gaps when no signals indicate an issue", async () => {
    weakAnchorDetector.mockReturnValue(false);
    getListingCurrentSupport.mockResolvedValue({
      listing: {
        id: "listing-2",
        title: "Good Listing",
        canonicalUrl: "https://example.com/listings/good",
        siteId: "site-1",
      },
      summary: {
        inboundLinkedSupportCount: 2,
        mentionWithoutLinkCount: 0,
        outboundSupportLinkCount: 2,
        connectedSupportPageCount: 1,
        lastGraphRunAt: "2026-03-10T00:00:00.000Z",
      },
      inboundLinkedSupport: [
        {
          sourceId: "blog-1",
          sourceType: "blog_post",
          title: "Good Listing in Austin",
          url: "https://example.com/blog/1",
          anchors: ["Good Listing"],
          relationshipType: "links_to_listing",
        },
      ],
      mentionsWithoutLinks: [],
      outboundSupportLinks: [
        {
          targetId: "blog-9",
          targetType: "blog_post",
          title: "Guide",
          url: "https://example.com/blog/9",
          relationshipType: "listing_links_out",
        },
      ],
      connectedSupportPages: [
        {
          id: "hub-1",
          type: "hub",
          title: "Plumber · Austin",
          url: null,
        },
      ],
    });
    computeListingMetrics.mockResolvedValue({
      inbound_links_to_count: 2,
      inbound_mentions_count: 0,
      unique_referring_blogs: 2,
      anchor_diversity_score: 70,
      backlink_compliance_rate: 100,
      orphan_status: false,
    });
    getIssues.mockResolvedValue({
      orphans: [],
      mentions_without_links: [],
      weak_anchors: [],
      lastRun: null,
    });

    const result = await getListingAuthorityGaps({
      tenantId: "default",
      listingId: "listing-2",
      listingTitle: "Good Listing",
      listingRaw: {},
      authorityPosts: [
        {
          post_type: "comparison",
          status: "published",
          title: "Good Listing vs Other Plumbers FAQ",
          focus_topic: "comparison faq",
        },
      ],
    });

    expect(result.items).toHaveLength(0);
    expect(result.summary.totalGaps).toBe(0);
    expect(result.summary.dataStatus).toBe("no_meaningful_gaps");
  });
});
