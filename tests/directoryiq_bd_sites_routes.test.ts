import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const ensureUser = vi.fn(async () => {});
const resolveUserId = vi.fn(() => "00000000-0000-4000-8000-000000000001");

const siteStub = {
  id: "site-1",
  label: "Site One",
  baseUrl: "https://example.com",
  enabled: true,
  listingsDataId: 75,
  blogPostsDataId: 14,
  listingsPath: "/api/v2/users_portfolio_groups/search",
  blogPostsPath: null,
  maskedSecret: "****1234",
  secretPresent: true,
};
const listBdSites = vi.fn(async () => [siteStub]);
const createBdSite = vi.fn(async () => siteStub);
const getBdSite = vi.fn(async () => null);
const updateBdSite = vi.fn(async () => {});
const deleteBdSite = vi.fn(async () => {});
const formatSiteResponse = vi.fn((site) => site);
const isAdminRequest = vi.fn(() => false);

vi.mock("@/app/api/ecomviper/_utils/user", () => ({
  ensureUser,
  resolveUserId,
}));

vi.mock("@/app/api/directoryiq/_utils/bdSites", () => ({
  listBdSites,
  createBdSite,
  getBdSite,
  updateBdSite,
  deleteBdSite,
  formatSiteResponse,
  isAdminRequest,
}));

describe("directoryiq bd sites routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DIRECTORYIQ_API_BASE = "http://localhost";
  });

  it("lists sites", async () => {
    resolveUserId.mockReturnValueOnce("11111111-1111-4111-8111-111111111111");
    const { GET } = await import("@/app/api/directoryiq/sites/route");
    const req = new NextRequest("http://localhost/api/directoryiq/sites", {
      headers: { "x-user-id": "00000000-0000-4000-8000-000000000001" },
    });
    const res = await GET(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.sites.length).toBe(1);
    expect(listBdSites).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111");
  });

  it("returns 403 when plan limit reached", async () => {
    createBdSite.mockImplementationOnce(async () => {
      throw new Error("bd_site_limit_reached");
    });
    const { POST } = await import("@/app/api/directoryiq/sites/route");
    const req = new NextRequest("http://localhost/api/directoryiq/sites", {
      method: "POST",
      headers: { "content-type": "application/json", "x-user-id": "00000000-0000-4000-8000-000000000001" },
      body: JSON.stringify({
        base_url: "https://example.com",
        api_key: "test",
        listings_data_id: 75,
      }),
    });
    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(403);
    expect(json.error).toBe("bd_site_limit_reached");
  });

  it("returns 404 on update when site missing", async () => {
    getBdSite.mockResolvedValueOnce(null);
    const { PUT } = await import("@/app/api/directoryiq/sites/[siteId]/route");
    const req = new NextRequest("http://localhost/api/directoryiq/sites/site-1", {
      method: "PUT",
      headers: { "content-type": "application/json", "x-user-id": "00000000-0000-4000-8000-000000000001" },
      body: JSON.stringify({ label: "Updated", base_url: "https://example.com", listings_data_id: 75 }),
    });
    const res = await PUT(req, { params: { siteId: "site-1" } });
    expect(res.status).toBe(404);
  });

  it("deletes site", async () => {
    const { DELETE } = await import("@/app/api/directoryiq/sites/[siteId]/route");
    const req = new NextRequest("http://localhost/api/directoryiq/sites/site-1", {
      method: "DELETE",
      headers: { "x-user-id": "00000000-0000-4000-8000-000000000001" },
    });
    const res = await DELETE(req, { params: { siteId: "site-1" } });
    expect(res.status).toBe(200);
    expect(deleteBdSite).toHaveBeenCalledTimes(1);
  });
});
