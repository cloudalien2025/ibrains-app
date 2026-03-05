import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const ensureUser = vi.fn(async () => {});
const resolveUserId = vi.fn(() => "00000000-0000-4000-8000-000000000001");
const getListingEvaluation = vi.fn(async () => ({
  listing: {
    source_id: "98",
    title: "Fixture Listing",
    url: "https://example.com/listings/fixture",
    raw_json: {},
  },
  evaluation: {
    totalScore: 42,
  },
}));
const getDirectoryIqIntegration = vi.fn(async () => ({
  provider: "brilliant_directories",
  status: "connected",
  meta: { baseUrl: "https://example.com" },
}));

vi.mock("@/app/api/ecomviper/_utils/user", () => ({
  ensureUser,
  resolveUserId,
}));

vi.mock("@/app/api/directoryiq/_utils/selectionData", () => ({
  getListingEvaluation,
}));

vi.mock("@/app/api/directoryiq/_utils/credentials", () => ({
  getDirectoryIqIntegration,
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

  afterAll(() => {
    process.env.E2E_MOCK_GRAPH = originalMock;
  });
});
