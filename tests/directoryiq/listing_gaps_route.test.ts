import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const proxyDirectoryIqRead = vi.fn();

vi.mock("@/app/api/directoryiq/_utils/externalReadProxy", () => ({
  proxyDirectoryIqRead: (...args: unknown[]) => proxyDirectoryIqRead(...args),
}));

describe("directoryiq listing gaps route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("derives gap status from proxied support data", async () => {
    proxyDirectoryIqRead.mockResolvedValueOnce(
      NextResponse.json({
        ok: true,
        support: {
          listing: {
            id: "site-1:321",
            title: "Acme Plumbing",
            canonicalUrl: "https://example.com/listings/acme",
            siteId: "site-1",
          },
          summary: {
            inboundLinkedSupportCount: 0,
            mentionWithoutLinkCount: 2,
            outboundSupportLinkCount: 0,
            connectedSupportPageCount: 0,
            lastGraphRunAt: "2026-03-10T00:00:00.000Z",
          },
        },
      })
    );

    const { GET } = await import("@/app/api/directoryiq/listings/[listingId]/gaps/route");
    const req = new NextRequest("http://localhost/api/directoryiq/listings/321/gaps?site_id=site-1");
    const res = await GET(req, { params: { listingId: "321" } });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.gaps.summary.dataStatus).toBe("gaps_found");
    expect(json.gaps.summary.totalGaps).toBe(4);
    expect(json.meta.source).toBe("directoryiq_support_derived_gaps_v1");
    expect(proxyDirectoryIqRead).toHaveBeenCalledWith(
      expect.any(NextRequest),
      "/api/directoryiq/listings/321/support"
    );
  });

  it("abstains from deterministic gaps when fallback support has no material signals", async () => {
    proxyDirectoryIqRead.mockResolvedValueOnce(
      NextResponse.json(
        {
          ok: false,
          error: {
            message: "connect ETIMEDOUT",
          },
        },
        { status: 502 }
      )
    );

    const { GET } = await import("@/app/api/directoryiq/listings/[listingId]/gaps/route");
    const req = new NextRequest("http://localhost/api/directoryiq/listings/321/gaps");
    const res = await GET(req, { params: { listingId: "321" } });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.gaps.listing.id).toBe("321");
    expect(json.gaps.summary.totalGaps).toBe(0);
    expect(json.gaps.summary.highCount).toBe(0);
    expect(json.gaps.summary.mediumCount).toBe(0);
    expect(json.gaps.summary.lowCount).toBe(0);
    expect(json.meta.source).toBe("directoryiq_support_derived_gaps_v1");
    expect(json.meta.supportSource).toBe("local_support_service_v1");
    expect(json.meta.supportDataStatus).toBe("no_support_data");
    expect(json.meta.supportFallbackApplied).toBe(true);
  });
});
