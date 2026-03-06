import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const ensureUser = vi.fn(async () => {});
const resolveUserId = vi.fn(() => "00000000-0000-4000-8000-000000000001");

const listBdSites = vi.fn(async () => [
  { id: "site-1", label: "Site One", baseUrl: "https://example.com", enabled: true },
  { id: "site-2", label: "Site Two", baseUrl: "https://example.org", enabled: true },
]);
const isAdminRequest = vi.fn(() => true);

const getAllListingsWithEvaluations = vi.fn(async () => ({
  cards: [
    {
      listingId: "98",
      name: "Fixture Listing",
      url: "https://example.com/listings/fixture",
      authorityStatus: "Strong",
      trustStatus: "Strong",
      lastOptimized: null,
      evaluation: { totalScore: 88, scores: { structure: 80, clarity: 80, trust: 80, authority: 80, actionability: 80 } },
      siteId: "site-1",
      siteLabel: "Site One",
    },
  ],
  readiness: 75,
  pillarAverages: { structure: 80, clarity: 80, trust: 80, authority: 80, actionability: 80 },
  verticalDetected: "general",
}));

vi.mock("@/app/api/ecomviper/_utils/user", () => ({
  ensureUser,
  resolveUserId,
}));

vi.mock("@/app/api/directoryiq/_utils/bdSites", () => ({
  listBdSites,
  isAdminRequest,
}));

vi.mock("@/app/api/directoryiq/_utils/selectionData", () => ({
  getAllListingsWithEvaluations,
}));

describe("directoryiq listings route site scope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows admin to request all sites", async () => {
    const { GET } = await import("@/app/api/directoryiq/listings/route");
    const req = new NextRequest("http://localhost/api/directoryiq/listings?site=all", {
      headers: { "x-user-id": "00000000-0000-4000-8000-000000000001" },
    });
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.listings[0].site_label).toBe("Site One");
  });

  it("blocks non-admin all-sites requests", async () => {
    isAdminRequest.mockReturnValueOnce(false);
    const { GET } = await import("@/app/api/directoryiq/listings/route");
    const req = new NextRequest("http://localhost/api/directoryiq/listings?site=all", {
      headers: { "x-user-id": "00000000-0000-4000-8000-000000000001" },
    });
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toBe("admin_only");
  });
});
