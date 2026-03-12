import { beforeEach, describe, expect, it, vi } from "vitest";

const listBdSitesMock = vi.fn();

vi.mock("@/app/api/directoryiq/_utils/bdSites", () => ({
  listBdSites: listBdSitesMock,
}));

describe("directoryiq snapshot connected-state contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns disconnected when no enabled configured BD site exists", async () => {
    listBdSitesMock.mockResolvedValue([
      {
        id: "site-1",
        userId: "00000000-0000-4000-8000-000000000001",
        label: "Primary",
        baseUrl: "https://example.com",
        enabled: false,
        listingsDataId: 75,
        blogPostsDataId: 14,
        listingsPath: "/api/v2/users_portfolio_groups/search",
        blogPostsPath: "/api/v2/data_posts/search",
        maskedSecret: "****",
        secretPresent: true,
      },
    ]);

    const { hasDirectoryIqConnection } = await import("@/app/api/_utils/snapshots");
    await expect(hasDirectoryIqConnection("00000000-0000-4000-8000-000000000001")).resolves.toBe(false);
  });

  it("returns connected when at least one canonical BD site is enabled and configured", async () => {
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

    const { hasDirectoryIqConnection } = await import("@/app/api/_utils/snapshots");
    await expect(hasDirectoryIqConnection("00000000-0000-4000-8000-000000000001")).resolves.toBe(true);
  });
});
