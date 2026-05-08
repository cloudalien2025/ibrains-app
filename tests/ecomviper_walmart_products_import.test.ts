import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requestWalmartTokenForUser: vi.fn(),
  getWalmartConnectionHealth: vi.fn(() => ({
    connectionStatus: "not_connected",
    summary: {
      accountNickname: "Walmart Account",
      environment: "production",
      region: "US",
      maskedClientId: "Not configured",
      clientSecretStored: false,
      lastSuccessfulAuth: null,
      lastSuccessfulRead: null,
      lastApiError: null,
      tokenStatus: "unknown",
      safeReadStatus: "unknown",
      permissionChecks: [],
      credentialStorageMode: "memory",
      mode: "live-ready",
      diagnostic: {
        environment: "production",
        baseUrl: "https://marketplace.walmartapis.com",
        tokenStatus: "unknown",
        safeReadStatus: "unknown",
        httpStatus: null,
        correlationId: null,
        walmartErrorCode: null,
        walmartErrorMessage: null,
        timestamp: null,
      },
    },
    lastSuccessfulApiCall: null,
    lastApiError: null,
  })),
}));

vi.mock("@/lib/ecomviper/walmart/walmart-auth", () => ({
  requestWalmartTokenForUser: mocks.requestWalmartTokenForUser,
  getWalmartConnectionHealth: mocks.getWalmartConnectionHealth,
}));

describe("walmart product import", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    (globalThis as Record<string, unknown>).__ecomviper_walmart_store__ = undefined;
    (globalThis as Record<string, unknown>).__ecomviper_activity_store__ = undefined;
  });

  it("imports walmart catalog rows and stores normalized products", async () => {
    mocks.requestWalmartTokenForUser.mockResolvedValue({
      ok: true,
      tokenStatus: "valid",
      lastError: null,
      accessToken: "wm_live_access_token",
      environment: "production",
      marketplaceRegion: "US",
      httpStatus: 200,
      correlationId: "corr-1",
    });

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [
            {
              sku: "OPA-OMEGA3-120",
              productName: "OPA Nutrition Omega-3 Daily Wellness Softgels 120ct",
              brand: "OPA Nutrition",
              category: "Supplements",
              price: { amount: "39.99" },
              inventory: { quantity: 42 },
              mainImageUrl: "https://images.example.com/opa-omega3-120.jpg",
              shortDescription: "Daily wellness support",
              longDescription: "Long product description",
              bulletPoints: ["Premium quality", "Purity tested"],
            },
            {
              title: "Missing SKU row",
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const { importWalmartProducts, listWalmartProducts } = await import("@/lib/ecomviper/walmart/walmart-products");
    const result = await importWalmartProducts("user_clerk_1");

    expect(result.importedCount).toBe(1);
    expect(result.fetchedCount).toBe(2);
    expect(result.skippedCount).toBe(1);
    expect(listWalmartProducts().map((entry) => entry.sku)).toContain("OPA-OMEGA3-120");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("throws a clear error when walmart token request fails", async () => {
    mocks.requestWalmartTokenForUser.mockResolvedValue({
      ok: false,
      tokenStatus: "invalid",
      lastError: {
        code: "WALMART_TOKEN_HTTP_401",
        message: "Production token request failed: HTTP 401 unauthorized.",
      },
      accessToken: null,
      environment: "production",
      marketplaceRegion: "US",
      httpStatus: 401,
      correlationId: "corr-2",
    });

    const { importWalmartProducts } = await import("@/lib/ecomviper/walmart/walmart-products");

    await expect(importWalmartProducts("user_clerk_1")).rejects.toThrow(
      "Production token request failed: HTTP 401 unauthorized."
    );
  });
});
