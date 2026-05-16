import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  importWalmartProducts,
  listWalmartProductsForUser,
} from "@/lib/ecomviper/walmart/walmart-products";

const walmartAuthMocks = vi.hoisted(() => ({
  requestWalmartTokenForUser: vi.fn(),
  getWalmartConnectionHealth: vi.fn(() => ({
    connectionStatus: "connected",
    summary: {
      accountNickname: "Walmart Account",
      environment: "production",
      region: "US",
      maskedClientId: "mock",
      clientSecretStored: true,
      lastSuccessfulAuth: null,
      lastSuccessfulRead: null,
      lastApiError: null,
      tokenStatus: "valid",
      safeReadStatus: "valid",
      permissionChecks: [],
      credentialStorageMode: "memory",
      mode: "live-ready",
      diagnostic: {
        environment: "production",
        baseUrl: "https://marketplace.walmartapis.com",
        tokenStatus: "valid",
        safeReadStatus: "valid",
        httpStatus: 200,
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

vi.mock("@/lib/ecomviper/walmart/walmart-auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ecomviper/walmart/walmart-auth")>(
    "@/lib/ecomviper/walmart/walmart-auth"
  );
  return {
    ...actual,
    requestWalmartTokenForUser: walmartAuthMocks.requestWalmartTokenForUser,
    getWalmartConnectionHealth: walmartAuthMocks.getWalmartConnectionHealth,
  };
});

describe("Walmart import alias hydration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    (globalThis as Record<string, unknown>).__ecomviper_walmart_store__ = undefined;
    (globalThis as Record<string, unknown>).__ecomviper_walmart_product_fallback__ = undefined;
    (globalThis as Record<string, unknown>).__ecomviper_walmart_product_tables_checked__ = undefined;
  });

  it("hydrates short/long/bullets from alias fields during import", async () => {
    walmartAuthMocks.requestWalmartTokenForUser.mockResolvedValue({
      ok: true,
      tokenStatus: "valid",
      lastError: null,
      accessToken: "wm_live_access_token",
      environment: "production",
      marketplaceRegion: "US",
      httpStatus: 200,
      correlationId: "corr-alias-import",
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

        if (url.includes("/v3/items")) {
          return new Response(
            JSON.stringify({
              ItemResponse: [
                {
                  sku: "ROC948",
                  productName: "Alias Import Product",
                  brand: "Alias Brand",
                  price: { amount: "24.99" },
                  availability: "In_stock",
                  siteDescription: "Alias site description from import payload",
                  fullDescription: "Alias full description from import payload",
                  highlights: [
                    { text: "Alias highlight one from import" },
                    { value: "Alias highlight two from import" },
                  ],
                },
              ],
            }),
            { status: 200, headers: { "content-type": "application/json" } }
          );
        }

        if (url.includes("/v3/items/walmart/search")) {
          return new Response(JSON.stringify({ items: [] }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }

        if (url.includes("/v3/inventory")) {
          return new Response(JSON.stringify({ quantity: { amount: 11 } }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ message: "not found" }), {
          status: 404,
          headers: { "content-type": "application/json" },
        });
      })
    );

    const result = await importWalmartProducts("user_import_alias");
    expect(result.importedCount).toBeGreaterThan(0);

    const products = await listWalmartProductsForUser("user_import_alias");
    const imported = products.find((entry) => entry.sku === "ROC948");
    expect(imported).toBeTruthy();
    expect(imported?.shortDescription).toBe("Alias site description from import payload");
    expect(imported?.longDescription).toBe("Alias full description from import payload");
    expect(imported?.bulletPoints).toEqual([
      "Alias highlight one from import",
      "Alias highlight two from import",
    ]);
  });
});
