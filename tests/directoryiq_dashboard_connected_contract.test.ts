import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/app/api/ecomviper/_utils/user", () => ({
  ensureUser: vi.fn().mockResolvedValue(undefined),
  resolveUserId: vi.fn().mockReturnValue("00000000-0000-4000-8000-000000000001"),
}));

vi.mock("@/app/api/ecomviper/_utils/db", () => ({
  query: vi.fn().mockResolvedValue([{ finished_at: "2026-03-10T18:20:18.964Z" }]),
}));

vi.mock("@/app/api/directoryiq/_utils/selectionData", () => ({
  getAllListingsWithEvaluations: vi.fn().mockResolvedValue({
    cards: [],
    readiness: 56,
    pillarAverages: {
      structure: 61,
      clarity: 65,
      trust: 50,
      authority: 50,
      actionability: 55,
    },
    verticalDetected: "general",
  }),
  getDirectoryIqSettings: vi.fn().mockResolvedValue({
    verticalOverride: null,
  }),
}));

const listBdSitesMock = vi.fn();
vi.mock("@/app/api/directoryiq/_utils/bdSites", () => ({
  listBdSites: listBdSitesMock,
}));

describe("directoryiq dashboard connected contract", () => {
  beforeEach(() => {
    vi.resetModules();
    listBdSitesMock.mockReset();
    delete process.env.DIRECTORYIQ_API_BASE;
    delete process.env.NEXT_PUBLIC_DIRECTORYIQ_API_BASE;
  });

  it("marks dashboard connected when canonical BD sites include an enabled configured site", async () => {
    process.env.DIRECTORYIQ_API_BASE = "http://127.0.0.1:3001";
    listBdSitesMock.mockResolvedValue([
      {
        id: "5c82f5c1-a45f-4b25-a0d4-1b749d962415",
        userId: "00000000-0000-4000-8000-000000000001",
        label: "VailVacay",
        baseUrl: "https://www.vailvacay.com",
        enabled: true,
        listingsDataId: 75,
        blogPostsDataId: 14,
        listingsPath: "/api/v2/users_portfolio_groups/search",
        blogPostsPath: "/api/v2/data_posts/search",
        maskedSecret: "****",
        secretPresent: true,
      },
    ]);

    const { GET } = await import("@/app/api/directoryiq/dashboard/route");
    const req = new NextRequest("http://127.0.0.1:3001/api/directoryiq/dashboard", {
      headers: { "x-forwarded-host": "127.0.0.1:3001" },
    });

    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.connected).toBe(true);
    expect(json.readiness).toBe(56);
    expect(json.last_analyzed_at).toBe("2026-03-10T18:20:18.964Z");
  });

  it("marks dashboard disconnected when no enabled configured site exists", async () => {
    process.env.DIRECTORYIQ_API_BASE = "http://127.0.0.1:3001";
    listBdSitesMock.mockResolvedValue([
      {
        id: "5c82f5c1-a45f-4b25-a0d4-1b749d962415",
        userId: "00000000-0000-4000-8000-000000000001",
        label: "VailVacay",
        baseUrl: "https://www.vailvacay.com",
        enabled: false,
        listingsDataId: 75,
        blogPostsDataId: 14,
        listingsPath: "/api/v2/users_portfolio_groups/search",
        blogPostsPath: "/api/v2/data_posts/search",
        maskedSecret: "****",
        secretPresent: true,
      },
    ]);

    const { GET } = await import("@/app/api/directoryiq/dashboard/route");
    const req = new NextRequest("http://127.0.0.1:3001/api/directoryiq/dashboard", {
      headers: { "x-forwarded-host": "127.0.0.1:3001" },
    });

    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.connected).toBe(false);
  });
});
