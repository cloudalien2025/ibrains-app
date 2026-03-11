import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

describe("directoryiq listings read route proxy", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    delete process.env.DIRECTORYIQ_API_BASE;
    delete process.env.NEXT_PUBLIC_DIRECTORYIQ_API_BASE;
  });

  it("forwards query and identity headers to external DirectoryIQ API", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, listings: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    process.env.DIRECTORYIQ_API_BASE = "https://directoryiq-api.ibrains.ai";

    const { GET } = await import("@/app/api/directoryiq/listings/route");

    const req = new NextRequest("http://localhost/api/directoryiq/listings?site=all", {
      headers: {
        "x-user-id": "00000000-0000-4000-8000-000000000001",
      },
    });

    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://directoryiq-api.ibrains.ai/api/directoryiq/listings?site=all");
    const headers = new Headers(init.headers);
    expect(headers.get("x-user-id")).toBe("00000000-0000-4000-8000-000000000001");
  });

  it("returns 502 when external DirectoryIQ API is unreachable", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("connect ETIMEDOUT"));
    vi.stubGlobal("fetch", fetchMock);
    process.env.DIRECTORYIQ_API_BASE = "https://directoryiq-api.ibrains.ai";

    const { GET } = await import("@/app/api/directoryiq/listings/route");
    const req = new NextRequest("http://localhost/api/directoryiq/listings");
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(502);
    expect(json.ok).toBe(false);
    expect(String(json.error)).toContain("connect ETIMEDOUT");
  });

  it("maps category from group_category in upstream listings payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          listings: [
            {
              listing_id: "1",
              listing_name: "Sunrise Diner",
              group_category: "Restaurants",
            },
          ],
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        }
      )
    );
    vi.stubGlobal("fetch", fetchMock);
    process.env.DIRECTORYIQ_API_BASE = "https://directoryiq-api.ibrains.ai";

    const { GET } = await import("@/app/api/directoryiq/listings/route");
    const req = new NextRequest("http://localhost/api/directoryiq/listings");
    const res = await GET(req);
    const json = (await res.json()) as { listings: Array<{ category: string | null }> };

    expect(res.status).toBe(200);
    expect(json.listings[0]?.category).toBe("Restaurants");
  });

  it("returns null category when upstream category fields are missing or blank", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          listings: [
            {
              listing_id: "1",
              listing_name: "Unknown Listing",
              group_category: "   ",
              category: "",
              raw_json: {
                group_category: "  ",
              },
            },
          ],
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        }
      )
    );
    vi.stubGlobal("fetch", fetchMock);
    process.env.DIRECTORYIQ_API_BASE = "https://directoryiq-api.ibrains.ai";

    const { GET } = await import("@/app/api/directoryiq/listings/route");
    const req = new NextRequest("http://localhost/api/directoryiq/listings");
    const res = await GET(req);
    const json = (await res.json()) as { listings: Array<{ category: string | null }> };

    expect(res.status).toBe(200);
    expect(json.listings[0]?.category).toBeNull();
  });
});
