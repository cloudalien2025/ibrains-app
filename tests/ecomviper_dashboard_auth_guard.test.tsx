import { describe, expect, it, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  requireSignedInUser: vi.fn(),
  getRocktomicSourceIngestionSnapshot: vi.fn(),
  getShopifyConnectionStatusForUser: vi.fn(),
  getShopifyImportStateForUser: vi.fn(),
  getShopifyOpenAiConnectionStatusForUser: vi.fn(),
  listShopifyProductsForUser: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  },
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
  listShopifyProductsForUser: mocks.listShopifyProductsForUser,
}));

vi.mock("@/lib/ecomviper/shopify/openai-connection", () => ({
  getShopifyOpenAiConnectionStatusForUser: mocks.getShopifyOpenAiConnectionStatusForUser,
}));

vi.mock("@/lib/ecomviper/shopify/shopify-inventory-foundation", () => ({
  toEcomViperProductInventoryRows: () => [],
}));

vi.mock("@/app/ecomviper/ecomviper-dashboard-client", () => ({
  default: () => null,
}));

describe("ecomviper dashboard auth guard", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.requireSignedInUser.mockReset();
    mocks.getRocktomicSourceIngestionSnapshot.mockReset();
    mocks.getShopifyConnectionStatusForUser.mockReset();
    mocks.getShopifyImportStateForUser.mockReset();
    mocks.getShopifyOpenAiConnectionStatusForUser.mockReset();
    mocks.listShopifyProductsForUser.mockReset();
  });

  it("redirects before expensive ingestion when auth is unauthorized", async () => {
    mocks.requireSignedInUser.mockResolvedValue({
      userId: null,
      unauthorizedResponse: new Response("unauthorized", { status: 401 }),
    });

    const mod = await import("@/app/ecomviper/page");
    const page = mod.default;

    await expect(page()).rejects.toThrow("NEXT_REDIRECT:/sign-in");
    expect(mocks.getRocktomicSourceIngestionSnapshot).not.toHaveBeenCalled();
  });

  it("loads ingestion for signed-in users", async () => {
    mocks.requireSignedInUser.mockResolvedValue({
      userId: "user_1",
      unauthorizedResponse: null,
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
    });
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
    mocks.getShopifyImportStateForUser.mockResolvedValue({ lastImportAt: null, importedCount: 0, updatedAt: null });
    mocks.getShopifyOpenAiConnectionStatusForUser.mockResolvedValue({ connected: false, maskedKey: "", updatedAt: null });
    mocks.listShopifyProductsForUser.mockResolvedValue([]);

    const mod = await import("@/app/ecomviper/page");
    const page = mod.default;

    await expect(page()).resolves.toBeTruthy();
    expect(mocks.getRocktomicSourceIngestionSnapshot).toHaveBeenCalledTimes(1);
  });
});
