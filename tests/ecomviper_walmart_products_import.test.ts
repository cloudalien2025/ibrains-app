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

function createFetchMock(params: {
  catalogPayload: unknown;
  inventoryBySku?: Record<string, unknown | null>;
}) {
  const inventoryBySku = params.inventoryBySku ?? {};

  return vi.fn(async (input: RequestInfo | URL) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

    if (url.includes("/v3/items")) {
      return new Response(JSON.stringify(params.catalogPayload), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    if (url.includes("/v3/inventory")) {
      const parsed = new URL(url);
      const sku = parsed.searchParams.get("sku") ?? "";
      if (!(sku in inventoryBySku) || inventoryBySku[sku] === null) {
        return new Response(JSON.stringify({ message: "not found" }), {
          status: 404,
          headers: { "content-type": "application/json" },
        });
      }

      return new Response(JSON.stringify(inventoryBySku[sku]), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ message: "not found" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  });
}

describe("walmart product import", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    (globalThis as Record<string, unknown>).__ecomviper_walmart_store__ = undefined;
    (globalThis as Record<string, unknown>).__ecomviper_activity_store__ = undefined;
    (globalThis as Record<string, unknown>).__ecomviper_walmart_product_fallback__ = undefined;
    (globalThis as Record<string, unknown>).__ecomviper_walmart_product_tables_checked__ = undefined;
  });

  it("imports image URL when present on an ItemResponse array payload", async () => {
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

    const fetchMock = createFetchMock({
      catalogPayload: {
        ItemResponse: [
          {
            sku: "30066-841",
            productName: "Sample Walmart Product",
            brand: "Walmart Brand",
            shelf: "Supplements",
            productType: "supplement",
            availability: "In_stock",
            price: { amount: "19.99" },
            productAssets: [
              {
                assetType: "PRIMARY",
                imageUrl: "https://images.example.com/30066-841.jpg",
              },
            ],
          },
        ],
      },
      inventoryBySku: {
        "30066-841": {
          sku: "30066-841",
          quantity: { unit: "EACH", amount: 12 },
        },
      },
    });
    vi.stubGlobal("fetch", fetchMock);

    const { importWalmartProducts, listWalmartProducts } = await import("@/lib/ecomviper/walmart/walmart-products");
    const result = await importWalmartProducts("user_clerk_1");
    const product = listWalmartProducts().find((entry) => entry.sku === "30066-841");

    expect(result.importedCount).toBeGreaterThan(0);
    expect(result.fetchedCount).toBe(1);
    expect(result.skippedCount).toBe(0);
    expect(result.importDiagnostics?.payloadShape).toBe("root.ItemResponse.array");
    expect(product?.imageUrl).toBe("https://images.example.com/30066-841.jpg");
    expect(product?.imageStatusMessage).toBe("Image available");
    expect(product?.issues).not.toContain("Image not provided by Walmart catalog");
    expect(product?.issues).not.toContain("Image enrichment source not configured");
    expect(product?.inventoryQuantity).toBe(12);
    expect(product?.inventoryStatus).toBe("known");
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

    const fetchMock = createFetchMock({
      catalogPayload: {
        ItemResponse: {
          items: [
            {
              sku: "OPA-OMEGA3-120",
              productName: "OPA Nutrition Omega-3 Daily Wellness Softgels 120ct",
              brand: "OPA Nutrition",
              shelf: "Supplements",
              productType: "supplement",
              availability: "In_stock",
              price: { amount: "39.99" },
              images: [{ url: "https://images.example.com/opa-omega3-120.jpg" }],
            },
          ],
        },
      },
      inventoryBySku: {
        "OPA-OMEGA3-120": {
          sku: "OPA-OMEGA3-120",
          quantity: { unit: "EACH", amount: 42 },
        },
      },
    });
    vi.stubGlobal("fetch", fetchMock);

    const { importWalmartProducts, listWalmartProducts } = await import("@/lib/ecomviper/walmart/walmart-products");
    const result = await importWalmartProducts("user_clerk_1");

    expect(result.importedCount).toBeGreaterThan(0);
    expect(result.fetchedCount).toBe(1);
    expect(result.skippedCount).toBe(0);
    expect(result.importDiagnostics?.payloadShape).toBe("root.ItemResponse.items");
    expect(listWalmartProducts().map((entry) => entry.sku)).toContain("OPA-OMEGA3-120");
  });

  it("marks missing image when no Walmart image URL exists", async () => {
    mocks.requestWalmartTokenForUser.mockResolvedValue({
      ok: true,
      tokenStatus: "valid",
      lastError: null,
      accessToken: "wm_live_access_token",
      environment: "production",
      marketplaceRegion: "US",
      httpStatus: 200,
      correlationId: "corr-1c",
    });

    const fetchMock = createFetchMock({
      catalogPayload: {
        ItemResponse: [
          {
            sku: "NO-IMAGE-1",
            productName: "No Image Product",
            brand: "Walmart Brand",
            availability: "In_stock",
            price: { amount: "15.50" },
          },
        ],
      },
      inventoryBySku: {
        "NO-IMAGE-1": {
          sku: "NO-IMAGE-1",
          quantity: { unit: "EACH", amount: 7 },
        },
      },
    });
    vi.stubGlobal("fetch", fetchMock);

    const { importWalmartProducts, listWalmartProducts } = await import("@/lib/ecomviper/walmart/walmart-products");
    await importWalmartProducts("user_clerk_1");
    const product = listWalmartProducts().find((entry) => entry.sku === "NO-IMAGE-1");

    expect(product?.imageUrl).toBe("");
    expect(product?.imageStatusMessage).toBe("Image enrichment source not configured");
    expect(product?.issues).toContain("Image not provided by Walmart catalog");
    expect(product?.issues).toContain("Image enrichment source not configured");
    expect(product?.status).not.toBe("sync_failed");
    expect(product?.inventoryQuantity).toBe(7);
    expect(product?.inventoryStatus).toBe("known");
  });

  it("treats missing inventory as unknown and only flags out-of-stock on explicit zero quantity", async () => {
    mocks.requestWalmartTokenForUser.mockResolvedValue({
      ok: true,
      tokenStatus: "valid",
      lastError: null,
      accessToken: "wm_live_access_token",
      environment: "production",
      marketplaceRegion: "US",
      httpStatus: 200,
      correlationId: "corr-1d",
    });

    const fetchMock = createFetchMock({
      catalogPayload: {
        ItemResponse: [
          {
            sku: "UNKNOWN-INV-1",
            productName: "Inventory Unknown Product",
            brand: "Walmart Brand",
            availability: "In_stock",
            price: { amount: "12.00" },
            images: [{ imageUrl: "https://images.example.com/unknown-inv.jpg" }],
          },
          {
            sku: "ZERO-INV-1",
            productName: "Inventory Zero Product",
            brand: "Walmart Brand",
            availability: "In_stock",
            price: { amount: "9.99" },
            images: [{ imageUrl: "https://images.example.com/zero-inv.jpg" }],
          },
        ],
      },
      inventoryBySku: {
        "UNKNOWN-INV-1": null,
        "ZERO-INV-1": {
          sku: "ZERO-INV-1",
          quantity: { unit: "EACH", amount: 0 },
        },
      },
    });
    vi.stubGlobal("fetch", fetchMock);

    const { importWalmartProducts, listWalmartProducts } = await import("@/lib/ecomviper/walmart/walmart-products");
    const result = await importWalmartProducts("user_clerk_1");
    const unknownInventory = listWalmartProducts().find((entry) => entry.sku === "UNKNOWN-INV-1");
    const zeroInventory = listWalmartProducts().find((entry) => entry.sku === "ZERO-INV-1");

    expect(result.importedCount).toBe(2);
    expect(unknownInventory?.inventoryStatus).toBe("unknown");
    expect(unknownInventory?.inventoryQuantity).toBe(0);
    expect(unknownInventory?.issues).not.toContain("Out of stock");
    expect(zeroInventory?.inventoryStatus).toBe("known");
    expect(zeroInventory?.inventoryQuantity).toBe(0);
    expect(zeroInventory?.issues).toContain("Out of stock");
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
