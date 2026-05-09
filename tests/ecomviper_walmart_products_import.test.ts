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

  it("imports walmart catalog rows when ItemResponse is an array", async () => {
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
          ItemResponse: [
            {
              sku: "30066-841",
              productName: "Sample Walmart Product",
              brand: "Walmart Brand",
              category: "Supplements",
              price: { amount: "19.99" },
              inventory: { quantity: 12 },
              mainImageUrl: "https://images.example.com/30066-841.jpg",
              shortDescription: "Imported from ItemResponse array",
              longDescription: "Array-shape catalog payload",
              bulletPoints: ["Feature A", "Feature B"],
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

    expect(result.importedCount).toBeGreaterThan(0);
    expect(result.fetchedCount).toBe(2);
    expect(result.skippedCount).toBe(1);
    expect(result.importDiagnostics?.payloadShape).toBe("root.ItemResponse.array");
    expect(listWalmartProducts().map((entry) => entry.sku)).toContain("30066-841");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("preserves object/items ItemResponse parsing", async () => {
    mocks.requestWalmartTokenForUser.mockResolvedValue({
      ok: true,
      tokenStatus: "valid",
      lastError: null,
      accessToken: "wm_live_access_token",
      environment: "production",
      marketplaceRegion: "US",
      httpStatus: 200,
      correlationId: "corr-1b",
    });

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ItemResponse: {
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
                longDescription: "Object/items product payload",
                bulletPoints: ["Premium quality", "Purity tested"],
              },
            ],
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const { importWalmartProducts, listWalmartProducts } = await import("@/lib/ecomviper/walmart/walmart-products");
    const result = await importWalmartProducts("user_clerk_1");

    expect(result.importedCount).toBeGreaterThan(0);
    expect(result.fetchedCount).toBe(1);
    expect(result.skippedCount).toBe(0);
    expect(result.importDiagnostics?.payloadShape).toBe("root.ItemResponse.items");
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
