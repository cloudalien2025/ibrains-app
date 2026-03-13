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

  it("returns 504 when external DirectoryIQ API request times out", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new DOMException("Aborted", "AbortError"));
    vi.stubGlobal("fetch", fetchMock);
    process.env.DIRECTORYIQ_API_BASE = "https://directoryiq-api.ibrains.ai";

    const { GET } = await import("@/app/api/directoryiq/listings/route");
    const req = new NextRequest("http://localhost/api/directoryiq/listings");
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(504);
    expect(json.ok).toBe(false);
    expect(String(json.error)).toContain("timed out");
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

  it("serves local external-owner payload and maps category from BD group_category", async () => {
    const getAllListingsWithEvaluations = vi.fn().mockResolvedValue({
      cards: [
        {
          listingId: "3",
          name: "Sample Listing",
          url: "",
          authorityStatus: "Needs Support",
          trustStatus: "Needs Trust",
          lastOptimized: null,
          evaluation: {
            score: 55,
            scores: {
              structure: 61,
              clarity: 60,
              trust: 50,
              authority: 50,
              actionability: 55,
            },
          },
          siteId: "5c82f5c1-a45f-4b25-a0d4-1b749d962415",
          siteLabel: "VailVacay",
        },
      ],
    });
    const query = vi.fn().mockResolvedValue([
      {
        source_id: "5c82f5c1-a45f-4b25-a0d4-1b749d962415:3",
        bd_site_id: "5c82f5c1-a45f-4b25-a0d4-1b749d962415",
        listing_id: "3",
        group_category: "Shops",
        category: null,
      },
    ]);
    const resolveUserId = vi.fn().mockReturnValue("00000000-0000-4000-8000-000000000001");

    vi.doMock("@/app/api/directoryiq/_utils/selectionData", () => ({ getAllListingsWithEvaluations }));
    vi.doMock("@/app/api/ecomviper/_utils/db", () => ({ query }));
    vi.doMock("@/app/api/ecomviper/_utils/user", () => ({ resolveUserId }));
    vi.doMock("@/app/api/directoryiq/_utils/bdSites", () => ({
      listBdSites: vi.fn().mockResolvedValue([
        {
          id: "5c82f5c1-a45f-4b25-a0d4-1b749d962415",
          label: "VailVacay",
          baseUrl: "https://www.vailvacay.com",
          enabled: true,
        },
      ]),
    }));

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    delete process.env.DIRECTORYIQ_API_BASE;

    const { GET } = await import("@/app/api/directoryiq/listings/route");
    const req = new NextRequest(
      "https://directoryiq-api.ibrains.ai/api/directoryiq/listings?site_id=5c82f5c1-a45f-4b25-a0d4-1b749d962415",
      {
        headers: {
          host: "directoryiq-api.ibrains.ai",
        },
      }
    );
    const res = await GET(req);
    const json = (await res.json()) as {
      ok: boolean;
      listings: Array<{ category: string | null; group_category: string | null }>;
    };

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(getAllListingsWithEvaluations).toHaveBeenCalledWith(
      "00000000-0000-4000-8000-000000000001",
      ["5c82f5c1-a45f-4b25-a0d4-1b749d962415"]
    );
    expect(json.listings[0]?.category).toBe("Shops");
    expect(json.listings[0]?.group_category).toBe("Shops");
  });

  it("serves local external-owner payload with null category when group_category is blank", async () => {
    const getAllListingsWithEvaluations = vi.fn().mockResolvedValue({
      cards: [
        {
          listingId: "8",
          name: "Blank Category Listing",
          url: "",
          authorityStatus: "Needs Support",
          trustStatus: "Needs Trust",
          lastOptimized: null,
          evaluation: {
            score: 55,
            scores: {
              structure: 61,
              clarity: 60,
              trust: 50,
              authority: 50,
              actionability: 55,
            },
          },
          siteId: "5c82f5c1-a45f-4b25-a0d4-1b749d962415",
          siteLabel: "VailVacay",
        },
      ],
    });
    const query = vi.fn().mockResolvedValue([
      {
        source_id: "5c82f5c1-a45f-4b25-a0d4-1b749d962415:8",
        bd_site_id: "5c82f5c1-a45f-4b25-a0d4-1b749d962415",
        listing_id: "8",
        group_category: "  ",
        category: null,
      },
    ]);
    const resolveUserId = vi.fn().mockReturnValue("00000000-0000-4000-8000-000000000001");

    vi.doMock("@/app/api/directoryiq/_utils/selectionData", () => ({ getAllListingsWithEvaluations }));
    vi.doMock("@/app/api/ecomviper/_utils/db", () => ({ query }));
    vi.doMock("@/app/api/ecomviper/_utils/user", () => ({ resolveUserId }));
    vi.doMock("@/app/api/directoryiq/_utils/bdSites", () => ({
      listBdSites: vi.fn().mockResolvedValue([
        {
          id: "5c82f5c1-a45f-4b25-a0d4-1b749d962415",
          label: "VailVacay",
          baseUrl: "https://www.vailvacay.com",
          enabled: true,
        },
      ]),
    }));

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    delete process.env.DIRECTORYIQ_API_BASE;

    const { GET } = await import("@/app/api/directoryiq/listings/route");
    const req = new NextRequest(
      "https://directoryiq-api.ibrains.ai/api/directoryiq/listings?site_id=5c82f5c1-a45f-4b25-a0d4-1b749d962415",
      {
        headers: {
          host: "directoryiq-api.ibrains.ai",
        },
      }
    );
    const res = await GET(req);
    const json = (await res.json()) as {
      ok: boolean;
      listings: Array<{ category: string | null; group_category: string | null }>;
    };

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(json.listings[0]?.category).toBeNull();
    expect(json.listings[0]?.group_category).toBeNull();
  });

  it("defaults to the single connected site and drops duplicate pseudo-site rows", async () => {
    const getAllListingsWithEvaluations = vi.fn().mockResolvedValue({
      cards: [
        {
          listingId: "3",
          name: "Listing 3",
          url: "https://www.vailvacay.com/listings/3",
          authorityStatus: "Needs Support",
          trustStatus: "Needs Trust",
          lastOptimized: null,
          evaluation: {
            score: 55,
            scores: {
              structure: 60,
              clarity: 60,
              trust: 50,
              authority: 50,
              actionability: 55,
            },
          },
          siteId: null,
          siteLabel: null,
        },
        {
          listingId: "3",
          name: "Listing 3",
          url: "https://www.vailvacay.com/listings/3",
          authorityStatus: "Needs Support",
          trustStatus: "Needs Trust",
          lastOptimized: null,
          evaluation: {
            score: 55,
            scores: {
              structure: 60,
              clarity: 60,
              trust: 50,
              authority: 50,
              actionability: 55,
            },
          },
          siteId: "5c82f5c1-a45f-4b25-a0d4-1b749d962415",
          siteLabel: "VailVacay",
        },
      ],
    });
    const query = vi.fn().mockResolvedValue([
      {
        source_id: "5c82f5c1-a45f-4b25-a0d4-1b749d962415:3",
        bd_site_id: "5c82f5c1-a45f-4b25-a0d4-1b749d962415",
        listing_id: "3",
        group_category: "Lodging",
        category: null,
      },
    ]);
    const resolveUserId = vi.fn().mockReturnValue("00000000-0000-4000-8000-000000000001");
    const listBdSites = vi.fn().mockResolvedValue([
      {
        id: "5c82f5c1-a45f-4b25-a0d4-1b749d962415",
        label: "VailVacay",
        baseUrl: "https://www.vailvacay.com",
        enabled: true,
      },
    ]);

    vi.doMock("@/app/api/directoryiq/_utils/selectionData", () => ({ getAllListingsWithEvaluations }));
    vi.doMock("@/app/api/ecomviper/_utils/db", () => ({ query }));
    vi.doMock("@/app/api/ecomviper/_utils/user", () => ({ resolveUserId }));
    vi.doMock("@/app/api/directoryiq/_utils/bdSites", () => ({ listBdSites }));

    delete process.env.DIRECTORYIQ_API_BASE;
    const { GET } = await import("@/app/api/directoryiq/listings/route");
    const req = new NextRequest("https://directoryiq-api.ibrains.ai/api/directoryiq/listings", {
      headers: {
        host: "directoryiq-api.ibrains.ai",
      },
    });
    const res = await GET(req);
    const json = (await res.json()) as { listings: Array<{ listing_id: string; site_id: string | null }> };

    expect(res.status).toBe(200);
    expect(getAllListingsWithEvaluations).toHaveBeenCalledWith(
      "00000000-0000-4000-8000-000000000001",
      ["5c82f5c1-a45f-4b25-a0d4-1b749d962415"]
    );
    expect(json.listings).toHaveLength(1);
    expect(json.listings[0]?.site_id).toBe("5c82f5c1-a45f-4b25-a0d4-1b749d962415");
  });
});
