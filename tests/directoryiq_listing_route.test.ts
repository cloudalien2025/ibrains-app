import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { resolveUserId } from "@/app/api/ecomviper/_utils/user";

describe("directoryiq listing detail route proxy", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    delete process.env.DIRECTORYIQ_API_BASE;
    delete process.env.NEXT_PUBLIC_DIRECTORYIQ_API_BASE;
  });

  it("forwards listing detail reads to the external DirectoryIQ API", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ listing: { listing_id: "3" } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    process.env.DIRECTORYIQ_API_BASE = "https://directoryiq-api.ibrains.ai";

    const { GET } = await import("@/app/api/directoryiq/listings/[listingId]/route");
    const req = new NextRequest(
      "http://localhost/api/directoryiq/listings/3?site_id=5c82f5c1-a45f-4b25-a0d4-1b749d962415",
      {
        headers: {
          "x-user-id": "00000000-0000-4000-8000-000000000001",
        },
      }
    );

    const res = await GET(req, { params: { listingId: "3" } });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.listing.listing_id).toBe("3");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://directoryiq-api.ibrains.ai/api/directoryiq/listings/3?site_id=5c82f5c1-a45f-4b25-a0d4-1b749d962415");
    const headers = new Headers(init.headers);
    expect(headers.get("x-user-id")).toBe("00000000-0000-4000-8000-000000000001");
  });

  it("normalizes upstream listing image fields to canonical mainImageUrl", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          listing: {
            listing_id: "3",
            listing_name: "Listing 3",
            listing_url: "https://example.com/listings/3",
            main_image_url: "https://cdn.example.com/main.jpg",
            images: [{ url: "https://cdn.example.com/secondary.jpg" }],
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

    const { GET } = await import("@/app/api/directoryiq/listings/[listingId]/route");
    const req = new NextRequest("http://localhost/api/directoryiq/listings/3");

    const res = await GET(req, { params: { listingId: "3" } });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.listing.listing_id).toBe("3");
    expect(json.listing.mainImageUrl).toBe("https://cdn.example.com/main.jpg");
  });

  it("forwards Cloudflare Access JWT assertion header for external auth", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ listing: { listing_id: "3" } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    process.env.DIRECTORYIQ_API_BASE = "https://directoryiq-api.ibrains.ai";

    const { GET } = await import("@/app/api/directoryiq/listings/[listingId]/route");
    const req = new NextRequest("http://localhost/api/directoryiq/listings/3", {
      headers: {
        "cf-access-jwt-assertion": "test-cf-access-jwt",
      },
    });

    const res = await GET(req, { params: { listingId: "3" } });

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(headers.get("cf-access-jwt-assertion")).toBe("test-cf-access-jwt");
  });

  it("uses canonical user id resolution when request omits x-user-id", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ listing: { listing_id: "3" } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    process.env.DIRECTORYIQ_API_BASE = "https://directoryiq-api.ibrains.ai";

    const { GET } = await import("@/app/api/directoryiq/listings/[listingId]/route");
    const req = new NextRequest("http://localhost/api/directoryiq/listings/3", {
      headers: {
        "x-user-email": "owner@app.ibrains.ai",
      },
    });
    const expectedUserId = resolveUserId(req);

    const res = await GET(req, { params: { listingId: "3" } });

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(headers.get("x-user-id")).toBe(expectedUserId);
  });

  it("returns 502 when external listing detail proxy is unreachable", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("connect ETIMEDOUT"));
    vi.stubGlobal("fetch", fetchMock);
    process.env.DIRECTORYIQ_API_BASE = "https://directoryiq-api.ibrains.ai";

    const { GET } = await import("@/app/api/directoryiq/listings/[listingId]/route");
    const req = new NextRequest("http://localhost/api/directoryiq/listings/3");
    const res = await GET(req, { params: { listingId: "3" } });
    const json = await res.json();

    expect(res.status).toBe(502);
    expect(json.ok).toBe(false);
    expect(String(json.error)).toContain("connect ETIMEDOUT");
  });
});
