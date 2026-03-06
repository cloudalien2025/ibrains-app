import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const ensureUser = vi.fn(async () => {});
const resolveUserId = vi.fn(() => "00000000-0000-4000-8000-000000000001");
const getListingEvaluation = vi.fn(async () => ({
  listing: {
    source_id: "98",
    title: "Fixture Listing",
    url: "https://example.com/listings/fixture",
    raw_json: { listing_id: "98", site_label: "Site One" },
  },
  evaluation: {
    totalScore: 42,
  },
}));
const findListingCandidates = vi.fn(async () => [
  { sourceId: "site-1:98", siteId: "site-1", siteLabel: "Site One" },
]);
const getBdSite = vi.fn(async () => ({
  id: "site-1",
  user_id: "00000000-0000-4000-8000-000000000001",
  label: "Site One",
  base_url: "https://example.com",
  enabled: true,
  listings_data_id: 75,
  blog_posts_data_id: 14,
  listings_path: "/api/v2/users_portfolio_groups/search",
  blog_posts_path: null,
  ingest_checkpoint_json: {},
  secret_ciphertext: "cipher",
  secret_last4: "1234",
  secret_length: 12,
  created_at: "2026-01-01",
  updated_at: "2026-01-01",
}));

vi.mock("@/app/api/ecomviper/_utils/user", () => ({
  ensureUser,
  resolveUserId,
}));

vi.mock("@/app/api/directoryiq/_utils/selectionData", () => ({
  getListingEvaluation,
  findListingCandidates,
}));

vi.mock("@/app/api/directoryiq/_utils/bdSites", () => ({
  getBdSite,
}));

vi.mock("@/src/lib/images/normalizeListingImageUrl", () => ({
  normalizeListingImageUrl: vi.fn(() => null),
}));

describe("directoryiq listing route", () => {
  const originalMock = process.env.E2E_MOCK_GRAPH;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.E2E_MOCK_GRAPH = "0";
  });

  it("returns 401 when no identity headers present", async () => {
    const { GET } = await import("@/app/api/directoryiq/listings/[listingId]/route");
    const req = new NextRequest("http://localhost/api/directoryiq/listings/98");
    const res = await GET(req, { params: { listingId: "98" } });
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe("unauthorized");
  });

  it("returns listing data with x-user-id header", async () => {
    const { GET } = await import("@/app/api/directoryiq/listings/[listingId]/route");
    const req = new NextRequest("http://localhost/api/directoryiq/listings/98", {
      headers: { "x-user-id": "00000000-0000-4000-8000-000000000001" },
    });
    const res = await GET(req, { params: { listingId: "98" } });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.listing.listing_name).toBe("Fixture Listing");
    expect(getListingEvaluation).toHaveBeenCalledTimes(1);
  });

  it("returns site_required when multiple sites share listing", async () => {
    findListingCandidates.mockResolvedValueOnce([
      { sourceId: "site-1:98", siteId: "site-1", siteLabel: "Site One" },
      { sourceId: "site-2:98", siteId: "site-2", siteLabel: "Site Two" },
    ]);
    const { GET } = await import("@/app/api/directoryiq/listings/[listingId]/route");
    const req = new NextRequest("http://localhost/api/directoryiq/listings/98", {
      headers: { "x-user-id": "00000000-0000-4000-8000-000000000001" },
    });
    const res = await GET(req, { params: { listingId: "98" } });
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.error).toBe("site_required");
    expect(Array.isArray(json.candidates)).toBe(true);
  });

  afterAll(() => {
    process.env.E2E_MOCK_GRAPH = originalMock;
  });
});
