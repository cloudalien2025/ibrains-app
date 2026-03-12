import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const ensureUserMock = vi.fn(async () => undefined);
const resolveUserIdMock = vi.fn(() => "00000000-0000-4000-8000-000000000001");
const shouldServeDirectoryIqLocallyMock = vi.fn(() => true);
const listDirectoryIqIntegrationsMock = vi.fn();
const listBdSitesMock = vi.fn();

vi.mock("@/app/api/ecomviper/_utils/user", () => ({
  ensureUser: ensureUserMock,
  resolveUserId: resolveUserIdMock,
}));

vi.mock("@/app/api/directoryiq/_utils/runtimeParity", () => ({
  shouldServeDirectoryIqLocally: shouldServeDirectoryIqLocallyMock,
}));

vi.mock("@/app/api/directoryiq/_utils/externalReadProxy", () => ({
  proxyDirectoryIqRequest: vi.fn(),
}));

vi.mock("@/app/api/directoryiq/_utils/credentials", () => ({
  listDirectoryIqIntegrations: listDirectoryIqIntegrationsMock,
  saveDirectoryIqIntegration: vi.fn(),
  getDirectoryIqIntegration: vi.fn(),
  deleteDirectoryIqIntegration: vi.fn(),
}));

vi.mock("@/app/api/directoryiq/_utils/bdSites", () => ({
  listBdSites: listBdSitesMock,
}));

describe("directoryiq signal-sources connected-state contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    shouldServeDirectoryIqLocallyMock.mockReturnValue(true);
  });

  it("does not report BD connector connected from credential status when canonical BD site state is disconnected", async () => {
    listDirectoryIqIntegrationsMock.mockResolvedValue([
      { provider: "brilliant_directories", status: "connected", masked: "****abcd", savedAt: "2026-03-12T00:00:00.000Z", meta: {} },
      { provider: "openai", status: "connected", masked: "****open", savedAt: "2026-03-12T00:00:00.000Z", meta: {} },
      { provider: "serpapi", status: "disconnected", masked: "", savedAt: null, meta: {} },
      { provider: "ga4", status: "disconnected", masked: "", savedAt: null, meta: {} },
    ]);
    listBdSitesMock.mockResolvedValue([]);

    const { GET } = await import("@/app/api/directoryiq/signal-sources/route");
    const response = await GET(new NextRequest("http://127.0.0.1/api/directoryiq/signal-sources"));
    const json = await response.json();

    const bd = (json.connectors as Array<{ connector_id: string; connected: boolean }>).find(
      (connector) => connector.connector_id === "brilliant_directories_api"
    );
    const openai = (json.connectors as Array<{ connector_id: string; connected: boolean }>).find(
      (connector) => connector.connector_id === "openai"
    );

    expect(response.status).toBe(200);
    expect(bd?.connected).toBe(false);
    expect(openai?.connected).toBe(true);
  });

  it("reports BD connector connected when canonical BD site state is connected", async () => {
    listDirectoryIqIntegrationsMock.mockResolvedValue([
      { provider: "brilliant_directories", status: "disconnected", masked: "", savedAt: null, meta: {} },
      { provider: "openai", status: "disconnected", masked: "", savedAt: null, meta: {} },
      { provider: "serpapi", status: "disconnected", masked: "", savedAt: null, meta: {} },
      { provider: "ga4", status: "disconnected", masked: "", savedAt: null, meta: {} },
    ]);
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

    const { GET } = await import("@/app/api/directoryiq/signal-sources/route");
    const response = await GET(new NextRequest("http://127.0.0.1/api/directoryiq/signal-sources"));
    const json = await response.json();

    const bd = (json.connectors as Array<{ connector_id: string; connected: boolean }>).find(
      (connector) => connector.connector_id === "brilliant_directories_api"
    );

    expect(response.status).toBe(200);
    expect(bd?.connected).toBe(true);
  });
});
