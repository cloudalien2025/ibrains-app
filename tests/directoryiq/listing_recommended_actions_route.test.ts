import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

describe("directoryiq listing recommended actions route", () => {
  it("returns canonical recommended actions payload", async () => {
    const { POST } = await import("@/app/api/directoryiq/listings/[listingId]/actions/route");
    const req = new NextRequest("http://localhost/api/directoryiq/listings/321/actions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
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
            totalGaps: 2,
            highCount: 1,
            mediumCount: 1,
            lowCount: 0,
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
              type: "mentions_without_links",
              severity: "medium",
              title: "Mentions without links",
              explanation: "Mentions are unlinked.",
              evidenceSummary: "Mentions without links: 2.",
            },
          ],
        },
      }),
    });

    const res = await POST(req, { params: { listingId: "321" } });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.actions.listing.id).toBe("321");
    expect(json.actions.summary.dataStatus).toBe("actions_recommended");
    expect(json.actions.items[0].key).toBe("optimize_listing");
    expect(json.meta.source).toBe("first_party_recommended_actions_v1");
  });

  it("returns explicit bad request for listing-id mismatch", async () => {
    const { POST } = await import("@/app/api/directoryiq/listings/[listingId]/actions/route");
    const req = new NextRequest("http://localhost/api/directoryiq/listings/321/actions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        support: {
          listing: { id: "999", title: "Mismatch", canonicalUrl: null, siteId: null },
          summary: {
            inboundLinkedSupportCount: 0,
            mentionWithoutLinkCount: 0,
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
          listing: { id: "999", title: "Mismatch", canonicalUrl: null, siteId: null },
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

    expect(res.status).toBe(400);
    expect(json.ok).toBe(false);
    expect(json.error.code).toBe("BAD_REQUEST");
    expect(String(json.error.message)).toContain("listing_id mismatch");
  });

  it("accepts site-prefixed listing ids in support and gaps payloads", async () => {
    const { POST } = await import("@/app/api/directoryiq/listings/[listingId]/actions/route");
    const req = new NextRequest("http://localhost/api/directoryiq/listings/321/actions", {
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
    expect(json.actions.summary.dataStatus).toBe("no_major_actions_recommended");
  });
});
