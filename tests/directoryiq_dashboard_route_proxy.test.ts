import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/app/api/directoryiq/_utils/selectionData", () => ({
  getAllListingsWithEvaluations: vi.fn().mockResolvedValue({
    cards: [
      {
        sourceId: "site-a:142",
        listingId: "142",
        category: "Hotels",
        siteId: "site-a",
      },
      {
        sourceId: "site-b:142",
        listingId: "142",
        category: "Hotels",
        siteId: "site-b",
      },
      {
        sourceId: "site-a:128",
        listingId: "128",
        category: "Ski Rentals",
        siteId: "site-a",
      },
    ],
  }),
  getDirectoryIqSettings: vi.fn(),
}));

describe("directoryiq dashboard route proxy", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    delete process.env.DIRECTORYIQ_API_BASE;
    delete process.env.NEXT_PUBLIC_DIRECTORYIQ_API_BASE;
  });

  it("proxies dashboard GET to the external DirectoryIQ API", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          connected: true,
          listings: [
            { listing_id: "142", listing_name: "Cedar at Streamside", score: 55 },
            { listing_id: "142", listing_name: "Cedar at Streamside", score: 55 },
            { listing_id: "128", listing_name: "Buzz's Ski Shop", score: 55 },
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

    const { GET } = await import("@/app/api/directoryiq/dashboard/route");
    const req = new NextRequest("http://localhost/api/directoryiq/dashboard", {
      headers: { "x-user-id": "00000000-0000-4000-8000-000000000001" },
    });

    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.connected).toBe(true);
    expect(json.listings[0].category).toBe("Hotels");
    expect(json.listings[1].category).toBe("Hotels");
    expect(json.listings[2].category).toBe("Ski Rentals");
    expect(new Set(json.listings.map((row: { listing_row_id: string }) => row.listing_row_id)).size).toBe(3);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://directoryiq-api.ibrains.ai/api/directoryiq/dashboard");
    expect(init.method).toBe("GET");
    const headers = new Headers(init.headers);
    expect(headers.get("x-user-id")).toBe("00000000-0000-4000-8000-000000000001");
  });

  it("proxies dashboard POST to the external DirectoryIQ API", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ connected: true, listings: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    process.env.DIRECTORYIQ_API_BASE = "https://directoryiq-api.ibrains.ai";

    const { POST } = await import("@/app/api/directoryiq/dashboard/route");
    const req = new NextRequest("http://localhost/api/directoryiq/dashboard", {
      method: "POST",
      headers: { "x-user-id": "00000000-0000-4000-8000-000000000001" },
    });

    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://directoryiq-api.ibrains.ai/api/directoryiq/dashboard");
    expect(init.method).toBe("POST");
  });
});
