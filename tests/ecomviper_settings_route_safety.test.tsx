import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireSignedInUser: vi.fn(),
  getRocktomicSourceIngestionSnapshot: vi.fn(),
  getShopifyConnectionStatusForUser: vi.fn(),
  getShopifyImportStateForUser: vi.fn(),
  getShopifyOpenAiConnectionStatusForUser: vi.fn(),
  getSupplierMembershipTierSelectionForUser: vi.fn(),
}));

vi.mock("@/lib/auth/requireSignedInUser", () => ({
  requireSignedInUser: mocks.requireSignedInUser,
}));

vi.mock("@/lib/ecomviper/dropshipping/rocktomic-source-ingestion", () => ({
  getRocktomicSourceIngestionSnapshot: mocks.getRocktomicSourceIngestionSnapshot,
}));

vi.mock("@/lib/ecomviper/shopify/shopify-connection", () => ({
  getShopifyConnectionStatusForUser: mocks.getShopifyConnectionStatusForUser,
}));

vi.mock("@/lib/ecomviper/shopify/shopify-import", () => ({
  getShopifyImportStateForUser: mocks.getShopifyImportStateForUser,
}));

vi.mock("@/lib/ecomviper/shopify/openai-connection", () => ({
  getShopifyOpenAiConnectionStatusForUser: mocks.getShopifyOpenAiConnectionStatusForUser,
}));

vi.mock("@/lib/ecomviper/settings/supplier-membership", () => ({
  getSupplierMembershipTierSelectionForUser: mocks.getSupplierMembershipTierSelectionForUser,
}));

vi.mock("@/app/ecomviper/settings/supplier-membership-tier-form", () => ({
  default: () => null,
}));

describe("ecomviper settings route safety", () => {
  beforeEach(() => {
    vi.resetModules();
    Object.values(mocks).forEach((fn) => fn.mockReset());
    mocks.getShopifyImportStateForUser.mockResolvedValue({ lastImportAt: null, importedCount: 0, updatedAt: null });
    mocks.getShopifyOpenAiConnectionStatusForUser.mockResolvedValue({ connected: false, maskedKey: "", updatedAt: null });
    mocks.getSupplierMembershipTierSelectionForUser.mockResolvedValue(null);
  });

  it("does not trigger supplier ingestion when Shopify is disconnected", async () => {
    mocks.requireSignedInUser.mockResolvedValue({ userId: "user_1", unauthorizedResponse: null });
    mocks.getShopifyConnectionStatusForUser.mockResolvedValue({
      connected: false,
      storeDomain: "",
      apiVersion: "2026-01",
      authMode: "legacy_admin_token",
      maskedClientId: "Not configured",
      clientSecretStored: false,
      tokenStatus: "unknown",
      lastTokenRefreshAt: null,
      tokenExpiresAt: null,
      grantedScopes: [],
      lastApiError: null,
      updatedAt: null,
      status: "disconnected",
      saveSupported: false,
    });

    const mod = await import("@/app/ecomviper/settings/page");
    await expect(mod.default()).resolves.toBeTruthy();
    expect(mocks.getRocktomicSourceIngestionSnapshot).not.toHaveBeenCalled();
  });

  it("uses cache-only supplier snapshot when Shopify is connected", async () => {
    mocks.requireSignedInUser.mockResolvedValue({ userId: "user_1", unauthorizedResponse: null });
    mocks.getShopifyConnectionStatusForUser.mockResolvedValue({
      connected: true,
      storeDomain: "demo-shop.myshopify.com",
      apiVersion: "2026-01",
      authMode: "legacy_admin_token",
      maskedClientId: "Not configured",
      clientSecretStored: false,
      tokenStatus: "unknown",
      lastTokenRefreshAt: null,
      tokenExpiresAt: null,
      grantedScopes: [],
      lastApiError: null,
      updatedAt: null,
      status: "connected",
      saveSupported: false,
    });
    mocks.getRocktomicSourceIngestionSnapshot.mockResolvedValue({
      supplier: "Rocktomic",
      products: [],
      productCount: 0,
      catalogSkuCount: 0,
      catalogExtractedSkuCount: 0,
      inventorySkuCount: 0,
      inventoryAvailable: false,
      usedSeedFallback: true,
      membershipTiersDetected: [],
      sourceDiagnostics: [],
      lastCheckedAt: "2026-05-30T00:00:00.000Z",
      cacheState: "stale",
      refreshState: "refreshing",
    });

    const mod = await import("@/app/ecomviper/settings/page");
    await expect(mod.default()).resolves.toBeTruthy();
    expect(mocks.getRocktomicSourceIngestionSnapshot).toHaveBeenCalledWith({
      userId: "user_1",
      allowRefresh: false,
      triggerBackgroundRefresh: false,
    });
  });
});
