import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

describe("directoryiq listing flywheel links route", () => {
  it("returns canonical flywheel links payload", async () => {
    const { POST } = await import("@/app/api/directoryiq/listings/[listingId]/flywheel-links/route");
    const req = new NextRequest("http://localhost/api/directoryiq/listings/321/flywheel-links", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        support: {
          listing: { id: "321", title: "Acme Plumbing", canonicalUrl: "https://example.com/listings/acme", siteId: "site-1" },
          summary: {
            inboundLinkedSupportCount: 0,
            mentionWithoutLinkCount: 1,
            outboundSupportLinkCount: 0,
            connectedSupportPageCount: 0,
            lastGraphRunAt: null,
          },
          inboundLinkedSupport: [],
          mentionsWithoutLinks: [
            {
              sourceId: "blog-1",
              sourceType: "blog_post",
              title: "Guide",
              url: "https://example.com/blog/guide",
              mentionSnippet: "Acme Plumbing appears here.",
              relationshipType: "mentions_without_link",
            },
          ],
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
              type: "mentions_without_links",
              severity: "medium",
              title: "Mentions without links",
              explanation: "Mentions found.",
              evidenceSummary: "1 mention without link.",
            },
            {
              type: "no_listing_to_support_links",
              severity: "high",
              title: "No reciprocal links",
              explanation: "No outbound links.",
              evidenceSummary: "Outbound support links: 0.",
            },
          ],
        },
      }),
    });

    const res = await POST(req, { params: { listingId: "321" } });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.flywheel.listing.id).toBe("321");
    expect(json.flywheel.summary.dataStatus).toBe("flywheel_opportunities_found");
    expect(json.flywheel.items[0].type).toBeDefined();
    expect(json.meta.source).toBe("first_party_flywheel_links_v1");
  });

  it("accepts site-prefixed listing ids in support and gaps payloads", async () => {
    const { POST } = await import("@/app/api/directoryiq/listings/[listingId]/flywheel-links/route");
    const req = new NextRequest("http://localhost/api/directoryiq/listings/321/flywheel-links", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        support: {
          listing: { id: "site-1:321", title: "Prefixed", canonicalUrl: null, siteId: "site-1" },
          summary: {
            inboundLinkedSupportCount: 1,
            mentionWithoutLinkCount: 0,
            outboundSupportLinkCount: 1,
            connectedSupportPageCount: 1,
            lastGraphRunAt: null,
          },
          inboundLinkedSupport: [],
          mentionsWithoutLinks: [],
          outboundSupportLinks: [],
          connectedSupportPages: [],
        },
        gaps: {
          listing: { id: "site-1:321", title: "Prefixed", canonicalUrl: null, siteId: "site-1" },
          summary: {
            totalGaps: 0,
            highCount: 0,
            mediumCount: 0,
            lowCount: 0,
            evaluatedAt: "2026-03-11T00:00:00.000Z",
            lastGraphRunAt: null,
            dataStatus: "no_meaningful_gaps",
          },
          items: [],
        },
      }),
    });

    const res = await POST(req, { params: { listingId: "321" } });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.flywheel.summary.dataStatus).toBe("no_major_flywheel_opportunities");
  });
});
