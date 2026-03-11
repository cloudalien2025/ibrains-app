import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

describe("directoryiq listing support route proxy", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    delete process.env.DIRECTORYIQ_API_BASE;
    delete process.env.NEXT_PUBLIC_DIRECTORYIQ_API_BASE;
  });

  it("forwards support reads to the external DirectoryIQ API", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, support: { summary: { inboundLinkedSupportCount: 0 } } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    process.env.DIRECTORYIQ_API_BASE = "https://directoryiq-api.ibrains.ai";

    const { GET } = await import("@/app/api/directoryiq/listings/[listingId]/support/route");
    const req = new NextRequest(
      "http://localhost/api/directoryiq/listings/3/support?site_id=5c82f5c1-a45f-4b25-a0d4-1b749d962415",
      {
        headers: {
          "x-user-id": "00000000-0000-4000-8000-000000000001",
        },
      }
    );

    const res = await GET(req, { params: { listingId: "3" } });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      "https://directoryiq-api.ibrains.ai/api/directoryiq/listings/3/support?site_id=5c82f5c1-a45f-4b25-a0d4-1b749d962415"
    );
    const headers = new Headers(init.headers);
    expect(headers.get("x-user-id")).toBe("00000000-0000-4000-8000-000000000001");
  });

  it("falls back to local support model when external support proxy is unreachable", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("connect ETIMEDOUT"));
    vi.stubGlobal("fetch", fetchMock);
    process.env.DIRECTORYIQ_API_BASE = "https://directoryiq-api.ibrains.ai";

    const { GET } = await import("@/app/api/directoryiq/listings/[listingId]/support/route");
    const req = new NextRequest("http://localhost/api/directoryiq/listings/3/support");
    const res = await GET(req, { params: { listingId: "3" } });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.meta.source).toBe("local_support_service_v1");
    expect(json.meta.fallbackApplied).toBe(true);
    expect(json.meta.upstreamStatus).toBe(502);
    expect(json.support.listing.id).toBe("3");
    expect(json.support.summary.inboundLinkedSupportCount).toBe(0);
    expect(json.support.summary.mentionWithoutLinkCount).toBe(0);
    expect(json.support.summary.outboundSupportLinkCount).toBe(0);
    expect(json.support.summary.connectedSupportPageCount).toBe(0);
  });

  it("returns upstream support payload for stale zero-state without authority listing fallback", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: true,
            support: {
              listing: {
                id: "5c82f5c1-a45f-4b25-a0d4-1b749d962415:45",
                title: "Austria Haus",
                canonicalUrl: "",
                siteId: "5c82f5c1-a45f-4b25-a0d4-1b749d962415",
              },
              summary: {
                inboundLinkedSupportCount: 0,
                mentionWithoutLinkCount: 0,
                outboundSupportLinkCount: 0,
                connectedSupportPageCount: 0,
                lastGraphRunAt: "2026-03-05T17:28:35.127Z",
              },
              inboundLinkedSupport: [],
              mentionsWithoutLinks: [],
              outboundSupportLinks: [],
              connectedSupportPages: [],
            },
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          }
        )
      );
    vi.stubGlobal("fetch", fetchMock);
    process.env.DIRECTORYIQ_API_BASE = "https://directoryiq-api.ibrains.ai";

    const { GET } = await import("@/app/api/directoryiq/listings/[listingId]/support/route");
    const req = new NextRequest(
      "http://localhost/api/directoryiq/listings/45/support?site_id=5c82f5c1-a45f-4b25-a0d4-1b749d962415",
      {
        headers: {
          "x-user-id": "00000000-0000-4000-8000-000000000001",
        },
      }
    );

    const res = await GET(req, { params: { listingId: "45" } });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.meta.source).toBe("external_proxy_support_v1");
    expect(json.meta.fallbackApplied).toBe(false);
    expect(json.meta.upstreamStatus).toBeNull();
    expect(json.support.summary.inboundLinkedSupportCount).toBe(0);
    expect(json.support.summary.mentionWithoutLinkCount).toBe(0);
    expect(json.support.summary.outboundSupportLinkCount).toBe(0);
    expect(json.support.summary.connectedSupportPageCount).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
