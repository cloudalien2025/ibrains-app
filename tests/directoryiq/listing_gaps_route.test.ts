import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const resolveUserId = vi.fn();
const ensureUser = vi.fn();
const resolveListingEvaluation = vi.fn();
const getListingAuthorityGaps = vi.fn();

vi.mock("@/app/api/ecomviper/_utils/user", () => ({
  resolveUserId: (...args: unknown[]) => resolveUserId(...args),
  ensureUser: (...args: unknown[]) => ensureUser(...args),
}));

vi.mock("@/app/api/directoryiq/_utils/listingResolve", async () => {
  const actual = await vi.importActual("@/app/api/directoryiq/_utils/listingResolve");
  return {
    ...actual,
    resolveListingEvaluation: (...args: unknown[]) => resolveListingEvaluation(...args),
  };
});

vi.mock("@/src/directoryiq/services/listingGapsService", () => ({
  getListingAuthorityGaps: (...args: unknown[]) => getListingAuthorityGaps(...args),
}));

describe("directoryiq listing gaps route", () => {
  beforeEach(() => {
    resolveUserId.mockReset();
    ensureUser.mockReset();
    resolveListingEvaluation.mockReset();
    getListingAuthorityGaps.mockReset();
    resolveUserId.mockReturnValue("00000000-0000-4000-8000-000000000001");
    ensureUser.mockResolvedValue(undefined);
  });

  it("returns canonical authority gaps response", async () => {
    resolveListingEvaluation.mockResolvedValue({
      siteId: "site-1",
      listingEval: {
        listing: {
          source_id: "site-1:321",
          title: "Acme Plumbing",
          url: "https://example.com/listings/acme",
          raw_json: {
            listing_id: "321",
            group_category: "Plumber",
          },
        },
        authorityPosts: [
          {
            post_type: "comparison",
            status: "published",
            title: "Acme vs Others",
            focus_topic: "comparison",
          },
        ],
      },
    });
    getListingAuthorityGaps.mockResolvedValue({
      listing: { id: "321", title: "Acme Plumbing", canonicalUrl: "https://example.com/listings/acme", siteId: "site-1" },
      summary: {
        totalGaps: 1,
        highCount: 1,
        mediumCount: 0,
        lowCount: 0,
        evaluatedAt: "2026-03-10T00:00:00.000Z",
        lastGraphRunAt: "2026-03-10T00:00:00.000Z",
        dataStatus: "gaps_found",
      },
      items: [
        {
          type: "no_linked_support_posts",
          severity: "high",
          title: "No support posts are linking to this listing",
          explanation: "Authority flow is missing.",
          evidenceSummary: "Inbound linked support count is 0.",
        },
      ],
    });

    const { GET } = await import("@/app/api/directoryiq/listings/[listingId]/gaps/route");
    const req = new NextRequest("http://localhost/api/directoryiq/listings/321/gaps?site_id=site-1");
    const res = await GET(req, { params: { listingId: "321" } });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.gaps.summary.dataStatus).toBe("gaps_found");
    expect(json.meta.source).toBe("first_party_authority_gaps_v1");
    expect(resolveListingEvaluation).toHaveBeenCalledWith({
      userId: "00000000-0000-4000-8000-000000000001",
      listingId: "321",
      siteId: "site-1",
    });
    expect(getListingAuthorityGaps).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "default",
        listingId: "321",
      })
    );
  });

  it("returns explicit failure payload when gap evaluation fails", async () => {
    resolveListingEvaluation.mockResolvedValue({
      siteId: null,
      listingEval: {
        listing: {
          source_id: "321",
          title: "Acme Plumbing",
          url: "https://example.com/listings/acme",
          raw_json: { listing_id: "321" },
        },
        authorityPosts: [],
      },
    });
    getListingAuthorityGaps.mockRejectedValue(new Error("connect ETIMEDOUT"));

    const { GET } = await import("@/app/api/directoryiq/listings/[listingId]/gaps/route");
    const req = new NextRequest("http://localhost/api/directoryiq/listings/321/gaps");
    const res = await GET(req, { params: { listingId: "321" } });
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.ok).toBe(false);
    expect(json.error.code).toBe("GAPS_EVALUATION_FAILED");
    expect(String(json.error.message)).toContain("connect ETIMEDOUT");
  });
});
