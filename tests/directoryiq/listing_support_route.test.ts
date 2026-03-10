import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const ensureUser = vi.fn();
const resolveUserId = vi.fn();
const resolveListingEvaluation = vi.fn();
const getListingCurrentSupport = vi.fn();

class MockListingSiteRequiredError extends Error {
  candidates: Array<{ siteId: string; siteLabel: string | null }>;

  constructor(candidates: Array<{ siteId: string; siteLabel: string | null }>) {
    super("site_required");
    this.name = "ListingSiteRequiredError";
    this.candidates = candidates;
  }
}

vi.mock("@/app/api/ecomviper/_utils/user", () => ({
  ensureUser: (...args: unknown[]) => ensureUser(...args),
  resolveUserId: (...args: unknown[]) => resolveUserId(...args),
}));

vi.mock("@/app/api/directoryiq/_utils/listingResolve", () => ({
  ListingSiteRequiredError: MockListingSiteRequiredError,
  resolveListingEvaluation: (...args: unknown[]) => resolveListingEvaluation(...args),
}));

vi.mock("@/src/directoryiq/services/listingSupportService", () => ({
  getListingCurrentSupport: (...args: unknown[]) => getListingCurrentSupport(...args),
}));

describe("directoryiq listing support route", () => {
  beforeEach(() => {
    vi.resetModules();
    ensureUser.mockReset();
    resolveUserId.mockReset();
    resolveListingEvaluation.mockReset();
    getListingCurrentSupport.mockReset();
    resolveUserId.mockReturnValue("00000000-0000-4000-8000-000000000001");
    ensureUser.mockResolvedValue(undefined);
  });

  it("returns canonical first-party support contract", async () => {
    resolveListingEvaluation.mockResolvedValue({
      siteId: "site-1",
      listingEval: {
        listing: {
          source_id: "site-1:listing-3",
          title: "Listing 3",
          url: "https://example.com/listing-3",
        },
      },
    });
    getListingCurrentSupport.mockResolvedValue({
      listing: {
        id: "site-1:listing-3",
        title: "Listing 3",
        canonicalUrl: "https://example.com/listing-3",
        siteId: "site-1",
      },
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
    });

    const { GET } = await import("@/app/api/directoryiq/listings/[listingId]/support/route");
    const req = new NextRequest("http://localhost/api/directoryiq/listings/3/support?site_id=site-1");
    const res = await GET(req, { params: { listingId: "3" } });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.meta.source).toBe("first_party_graph_v1");
    expect(json.meta.dataStatus).toBe("no_support_data");
    expect(getListingCurrentSupport).toHaveBeenCalledWith({
      tenantId: "default",
      listingId: "site-1:listing-3",
      listingTitle: "Listing 3",
      listingUrl: "https://example.com/listing-3",
      siteId: "site-1",
    });
  });

  it("returns 404 when listing evaluation cannot be resolved", async () => {
    resolveListingEvaluation.mockResolvedValue(null);

    const { GET } = await import("@/app/api/directoryiq/listings/[listingId]/support/route");
    const req = new NextRequest("http://localhost/api/directoryiq/listings/missing/support");
    const res = await GET(req, { params: { listingId: "missing" } });
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.ok).toBe(false);
    expect(json.error.code).toBe("NOT_FOUND");
  });

  it("returns 409 with site candidates when site disambiguation is required", async () => {
    resolveListingEvaluation.mockRejectedValue(
      new MockListingSiteRequiredError([
        { siteId: "site-a", siteLabel: "Alpha" },
        { siteId: "site-b", siteLabel: "Beta" },
      ])
    );

    const { GET } = await import("@/app/api/directoryiq/listings/[listingId]/support/route");
    const req = new NextRequest("http://localhost/api/directoryiq/listings/3/support");
    const res = await GET(req, { params: { listingId: "3" } });
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.ok).toBe(false);
    expect(json.error.code).toBe("SITE_REQUIRED");
    expect(json.error.candidates).toEqual([
      { site_id: "site-a", site_label: "Alpha" },
      { site_id: "site-b", site_label: "Beta" },
    ]);
  });

  it("returns 500 when first-party support computation fails", async () => {
    resolveListingEvaluation.mockResolvedValue({
      siteId: "site-1",
      listingEval: {
        listing: {
          source_id: "site-1:listing-3",
          title: "Listing 3",
          url: "https://example.com/listing-3",
        },
      },
    });
    getListingCurrentSupport.mockRejectedValue(new Error("query failed"));

    const { GET } = await import("@/app/api/directoryiq/listings/[listingId]/support/route");
    const req = new NextRequest("http://localhost/api/directoryiq/listings/3/support?site_id=site-1");
    const res = await GET(req, { params: { listingId: "3" } });
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.ok).toBe(false);
    expect(json.error.code).toBe("INTERNAL_ERROR");
    expect(String(json.error.message)).toContain("query failed");
  });
});
