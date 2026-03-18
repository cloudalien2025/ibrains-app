import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const resolveListingEvaluationMock = vi.fn();
const resolveUserIdMock = vi.fn();
const getListingCurrentSupportMock = vi.fn();
const proxyDirectoryIqReadMock = vi.fn();

vi.mock("@/app/api/directoryiq/_utils/listingResolve", () => ({
  resolveListingEvaluation: resolveListingEvaluationMock,
}));

vi.mock("@/app/api/ecomviper/_utils/user", () => ({
  resolveUserId: resolveUserIdMock,
}));

vi.mock("@/src/directoryiq/services/listingSupportService", () => ({
  getListingCurrentSupport: getListingCurrentSupportMock,
}));

vi.mock("@/app/api/directoryiq/_utils/externalReadProxy", () => ({
  proxyDirectoryIqRead: proxyDirectoryIqReadMock,
}));

describe("listingSupportRuntime", () => {
  beforeEach(() => {
    vi.resetModules();
    resolveListingEvaluationMock.mockReset();
    resolveUserIdMock.mockReset();
    getListingCurrentSupportMock.mockReset();
    proxyDirectoryIqReadMock.mockReset();
    delete process.env.DIRECTORYIQ_API_BASE;
    delete process.env.NEXT_PUBLIC_DIRECTORYIQ_API_BASE;
  });

  it("falls back to authority tenant default when user-tenant support is false-zero", async () => {
    resolveUserIdMock.mockReturnValue("00000000-0000-4000-8000-000000000001");
    resolveListingEvaluationMock.mockResolvedValue({
      siteId: "5c82f5c1-a45f-4b25-a0d4-1b749d962415",
      listingEval: {
        listing: {
          source_id: "5c82f5c1-a45f-4b25-a0d4-1b749d962415:651",
          title: "Tivoli Lodge",
          url: "https://www.vailvacay.com/listings/tivoli-lodge",
          raw_json: {
            listing_id: "651",
            group_name: "Tivoli Lodge",
            url: "https://www.vailvacay.com/listings/tivoli-lodge",
          },
        },
      },
    });
    getListingCurrentSupportMock
      .mockResolvedValueOnce({
        listing: {
          id: "651",
          title: "Tivoli Lodge",
          canonicalUrl: null,
          siteId: "5c82f5c1-a45f-4b25-a0d4-1b749d962415",
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
      })
      .mockResolvedValueOnce({
        listing: {
          id: "651",
          title: "Tivoli Lodge",
          canonicalUrl: "https://www.vailvacay.com/listings/tivoli-lodge",
          siteId: "5c82f5c1-a45f-4b25-a0d4-1b749d962415",
        },
        summary: {
          inboundLinkedSupportCount: 1,
          mentionWithoutLinkCount: 0,
          outboundSupportLinkCount: 0,
          connectedSupportPageCount: 0,
          lastGraphRunAt: "2026-03-13T00:00:00.000Z",
        },
        inboundLinkedSupport: [
          {
            sourceId: "64",
            sourceType: "blog_post",
            title: "The 30 Best Hotels in Vail, Colorado",
            url: "https://www.vailvacay.com/blog/best-hotels-in-vail-colorado",
            anchors: ["Tivoli Lodge Vail"],
            relationshipType: "links_to_listing",
          },
        ],
        mentionsWithoutLinks: [],
        outboundSupportLinks: [],
        connectedSupportPages: [],
      });

    process.env.DIRECTORYIQ_API_BASE = "http://localhost";
    const { resolveListingSupportModel } = await import("@/app/api/directoryiq/_utils/listingSupportRuntime");
    const req = new NextRequest(
      "http://localhost/api/directoryiq/listings/651/support?site_id=5c82f5c1-a45f-4b25-a0d4-1b749d962415"
    );

    const result = await resolveListingSupportModel(req, "651");

    expect(getListingCurrentSupportMock).toHaveBeenCalledTimes(2);
    expect(getListingCurrentSupportMock.mock.calls[0]?.[0]?.tenantId).toBe("00000000-0000-4000-8000-000000000001");
    expect(getListingCurrentSupportMock.mock.calls[1]?.[0]?.tenantId).toBe("default");
    expect(result.support.summary.inboundLinkedSupportCount).toBe(1);
    expect(result.dataStatus).toBe("supported");
    expect(result.fallbackApplied).toBe(false);
    expect(result.source).toBe("local_support_service_v1");
    expect(proxyDirectoryIqReadMock).not.toHaveBeenCalled();
  });

  it("uses upstream-first on non-api hosts and skips slow local support fallback when upstream responds", async () => {
    resolveUserIdMock.mockReturnValue("00000000-0000-4000-8000-000000000001");
    proxyDirectoryIqReadMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          support: {
            listing: {
              id: "651",
              title: "Tivoli Lodge",
              canonicalUrl: "https://www.vailvacay.com/listings/tivoli-lodge",
              siteId: "5c82f5c1-a45f-4b25-a0d4-1b749d962415",
            },
            summary: {
              inboundLinkedSupportCount: 2,
              mentionWithoutLinkCount: 1,
              outboundSupportLinkCount: 1,
              connectedSupportPageCount: 1,
              lastGraphRunAt: "2026-03-13T00:00:00.000Z",
            },
            inboundLinkedSupport: [],
            mentionsWithoutLinks: [],
            outboundSupportLinks: [],
            connectedSupportPages: [],
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );

    process.env.DIRECTORYIQ_API_BASE = "https://directoryiq-api.ibrains.ai";
    const { resolveListingSupportModel } = await import("@/app/api/directoryiq/_utils/listingSupportRuntime");
    const req = new NextRequest(
      "https://app.ibrains.ai/api/directoryiq/listings/651/support?site_id=5c82f5c1-a45f-4b25-a0d4-1b749d962415"
    );

    const result = await resolveListingSupportModel(req, "651");

    expect(result.source).toBe("external_proxy_support_v1");
    expect(result.fallbackApplied).toBe(false);
    expect(result.dataStatus).toBe("supported");
    expect(result.support.summary.inboundLinkedSupportCount).toBe(2);
    expect(proxyDirectoryIqReadMock).toHaveBeenCalledTimes(1);
    expect(getListingCurrentSupportMock).not.toHaveBeenCalled();
  });

  it("derives canonical URL from listing raw fallback fields for local support lookup", async () => {
    resolveUserIdMock.mockReturnValue("00000000-0000-4000-8000-000000000001");
    resolveListingEvaluationMock.mockResolvedValue({
      siteId: "5c82f5c1-a45f-4b25-a0d4-1b749d962415",
      listingEval: {
        listing: {
          source_id: "5c82f5c1-a45f-4b25-a0d4-1b749d962415:651",
          title: "Tivoli Lodge",
          url: null,
          raw_json: {
            listing_id: "651",
            group_name: "Tivoli Lodge",
            profile_url: "https://www.vailvacay.com/listings/tivoli-lodge",
          },
        },
      },
    });
    getListingCurrentSupportMock
      .mockResolvedValueOnce({
        listing: {
          id: "651",
          title: "Tivoli Lodge",
          canonicalUrl: "https://www.vailvacay.com/listings/tivoli-lodge",
          siteId: "5c82f5c1-a45f-4b25-a0d4-1b749d962415",
        },
        summary: {
          inboundLinkedSupportCount: 1,
          mentionWithoutLinkCount: 0,
          outboundSupportLinkCount: 0,
          connectedSupportPageCount: 0,
          lastGraphRunAt: "2026-03-13T00:00:00.000Z",
        },
        inboundLinkedSupport: [],
        mentionsWithoutLinks: [],
        outboundSupportLinks: [],
        connectedSupportPages: [],
      })
      .mockResolvedValueOnce({
        listing: {
          id: "651",
          title: "Tivoli Lodge",
          canonicalUrl: "https://www.vailvacay.com/listings/tivoli-lodge",
          siteId: "5c82f5c1-a45f-4b25-a0d4-1b749d962415",
        },
        summary: {
          inboundLinkedSupportCount: 1,
          mentionWithoutLinkCount: 0,
          outboundSupportLinkCount: 0,
          connectedSupportPageCount: 0,
          lastGraphRunAt: "2026-03-13T00:00:00.000Z",
        },
        inboundLinkedSupport: [],
        mentionsWithoutLinks: [],
        outboundSupportLinks: [],
        connectedSupportPages: [],
      });

    process.env.DIRECTORYIQ_API_BASE = "http://localhost";
    const { resolveListingSupportModel } = await import("@/app/api/directoryiq/_utils/listingSupportRuntime");
    const req = new NextRequest(
      "http://localhost/api/directoryiq/listings/651/support?site_id=5c82f5c1-a45f-4b25-a0d4-1b749d962415"
    );

    await resolveListingSupportModel(req, "651");

    expect(getListingCurrentSupportMock).toHaveBeenCalledTimes(2);
    expect(getListingCurrentSupportMock.mock.calls[0]?.[0]?.listingUrl).toBe(
      "https://www.vailvacay.com/listings/tivoli-lodge"
    );
  });
});
