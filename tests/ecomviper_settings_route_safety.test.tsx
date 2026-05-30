import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireSignedInUser: vi.fn(),
  getGlobalSupplierSyncSummary: vi.fn(),
  getShopifyConnectionStatusForUser: vi.fn(),
  getShopifyImportStateForUser: vi.fn(),
  getShopifyOpenAiConnectionStatusForUser: vi.fn(),
  getMerchantSupplierMembershipTier: vi.fn(),
}));

vi.mock("@/lib/auth/requireSignedInUser", () => ({
  requireSignedInUser: mocks.requireSignedInUser,
}));

vi.mock("@/lib/ecomviper/suppliers/global-supplier-data", () => ({
  getGlobalSupplierSyncSummary: mocks.getGlobalSupplierSyncSummary,
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
  getMerchantSupplierMembershipTier: mocks.getMerchantSupplierMembershipTier,
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
    mocks.getMerchantSupplierMembershipTier.mockResolvedValue(null);
    mocks.getGlobalSupplierSyncSummary.mockResolvedValue({
      supplierKey: "rocktomic",
      globalScopeKey: "__global__",
      productCount: 145,
      pricingRecordCount: 145,
      inventoryRecordCount: 145,
      assetRecordCount: 145,
      sourceStatuses: [],
      latestRun: null,
      detectedMembershipTiers: ["Non Member Pricing"],
      syncStatus: "synced",
      lastCheckedAt: "2026-05-30T00:00:00.000Z",
      lastSuccessfulSyncAt: "2026-05-30T00:00:00.000Z",
      lastAttemptedSyncAt: "2026-05-30T00:00:00.000Z",
      lastSyncError: null,
    });
  });

  it("reads global supplier diagnostics even when Shopify is disconnected", async () => {
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
    expect(mocks.getGlobalSupplierSyncSummary).toHaveBeenCalledWith("rocktomic");
  });

  it("uses global supplier summary when Shopify is connected", async () => {
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
    const mod = await import("@/app/ecomviper/settings/page");
    await expect(mod.default()).resolves.toBeTruthy();
    expect(mocks.getGlobalSupplierSyncSummary).toHaveBeenCalledWith("rocktomic");
  });
});
