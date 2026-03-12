import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const ensureUserMock = vi.fn(async () => undefined);
const resolveUserIdMock = vi.fn(() => "00000000-0000-4000-8000-000000000001");
const getDirectoryIqIntegrationSecretMock = vi.fn();
const listBdSitesMock = vi.fn();

vi.mock("@/app/api/ecomviper/_utils/user", () => ({
  ensureUser: ensureUserMock,
  resolveUserId: resolveUserIdMock,
}));

vi.mock("@/app/api/directoryiq/_utils/credentials", () => ({
  getDirectoryIqIntegrationSecret: getDirectoryIqIntegrationSecretMock,
}));

vi.mock("@/app/api/directoryiq/_utils/bdSites", () => ({
  listBdSites: listBdSitesMock,
}));

describe("directoryiq integrations read route contract", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    delete process.env.E2E_MOCK_GRAPH;
  });

  it("returns configured state from canonical local sources", async () => {
    getDirectoryIqIntegrationSecretMock.mockResolvedValue({
      secret: "sk-test",
      meta: {},
    });
    listBdSitesMock.mockResolvedValue([
      {
        id: "site-1",
        userId: "00000000-0000-4000-8000-000000000001",
        label: "Primary",
        baseUrl: "https://example.com",
        enabled: true,
        listingsDataId: 75,
        blogPostsDataId: 14,
        listingsPath: "/api/v2/users_portfolio_groups/search",
        blogPostsPath: "/api/v2/data_posts/search",
        maskedSecret: "****",
        secretPresent: true,
      },
    ]);

    const { GET } = await import("@/app/api/directoryiq/integrations/route");
    const req = new NextRequest("http://localhost/api/directoryiq/integrations", {
      headers: {
        "x-user-id": "00000000-0000-4000-8000-000000000001",
      },
    });

    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.openaiConfigured).toBe(true);
    expect(json.bdConfigured).toBe(true);
    expect(getDirectoryIqIntegrationSecretMock).toHaveBeenCalledWith(
      "00000000-0000-4000-8000-000000000001",
      "openai"
    );
    expect(listBdSitesMock).toHaveBeenCalledWith("00000000-0000-4000-8000-000000000001");
  });

  it("returns disconnected when canonical sources are not configured", async () => {
    getDirectoryIqIntegrationSecretMock.mockResolvedValue(null);
    listBdSitesMock.mockResolvedValue([]);

    const { GET } = await import("@/app/api/directoryiq/integrations/route");
    const req = new NextRequest("http://localhost/api/directoryiq/integrations");
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.openaiConfigured).toBe(false);
    expect(json.bdConfigured).toBe(false);
  });

  it("returns mock values when E2E_MOCK_GRAPH is enabled", async () => {
    process.env.E2E_MOCK_GRAPH = "1";
    const { GET } = await import("@/app/api/directoryiq/integrations/route");
    const req = new NextRequest("http://localhost/api/directoryiq/integrations");
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.openaiConfigured).toBe(false);
    expect(json.bdConfigured).toBe(false);
  });
});
