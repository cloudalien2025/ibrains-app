import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { normalizeWalmartProduct } from "@/lib/ecomviper/core/product-normalizer";
import {
  getWalmartProductBySkuForUser,
  importWalmartProducts,
  listWalmartProducts,
  listWalmartProductsForUser,
  replaceWalmartProductsForUser,
} from "@/lib/ecomviper/walmart/walmart-products";

const authMocks = vi.hoisted(() => ({
  requireSignedInUser: vi.fn(),
}));

const walmartAuthMocks = vi.hoisted(() => ({
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

vi.mock("@/lib/auth/requireSignedInUser", () => ({
  requireSignedInUser: authMocks.requireSignedInUser,
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

function buildProduct(sku: string) {
  return normalizeWalmartProduct({
    sku,
    title: `Product ${sku}`,
    brand: "Walmart Brand",
    price: 19.99,
    inventoryQuantity: 8,
    inventoryStatus: "known",
    imageUrl: "",
    imageStatus: "catalog_missing",
    imageStatusMessage: "Image not provided by Walmart catalog",
    imageSource: "none",
    shortDescription: "Short description",
    description: "Long description",
    bulletPoints: ["Bullet 1"],
    attributes: { size: "M" },
  });
}

describe("walmart products persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    (globalThis as Record<string, unknown>).__ecomviper_walmart_store__ = undefined;
    (globalThis as Record<string, unknown>).__ecomviper_activity_store__ = undefined;
    (globalThis as Record<string, unknown>).__ecomviper_walmart_product_fallback__ = undefined;
    (globalThis as Record<string, unknown>).__ecomviper_walmart_product_tables_checked__ = undefined;
    delete process.env.E2E_MOCK_GRAPH;
  });

  it("import writes products to durable per-user storage and survives runtime-store reset", async () => {
    walmartAuthMocks.requestWalmartTokenForUser.mockResolvedValue({
      ok: true,
      tokenStatus: "valid",
      lastError: null,
      accessToken: "wm_live_access_token",
      environment: "production",
      marketplaceRegion: "US",
      httpStatus: 200,
      correlationId: "corr-persist-1",
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
                  sku: "30066-841",
                  productName: "Durable Walmart Product",
                  brand: "Walmart Brand",
                  price: { amount: "18.99" },
                  availability: "In_stock",
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

    const result = await importWalmartProducts("user_a");
    expect(result.importedCount).toBeGreaterThan(0);

    (globalThis as Record<string, unknown>).__ecomviper_walmart_store__ = undefined;

    const durable = await listWalmartProductsForUser("user_a");
    expect(durable.some((product) => product.sku === "30066-841")).toBe(true);
    expect(listWalmartProducts()).toHaveLength(0);
  });

  it("products API reads from the same durable repository used by import", async () => {
    await replaceWalmartProductsForUser({
      userId: "user_api",
      products: [buildProduct("API-30066-841")],
      importedAt: new Date().toISOString(),
    });

    (globalThis as Record<string, unknown>).__ecomviper_walmart_store__ = undefined;

    authMocks.requireSignedInUser.mockResolvedValue({ userId: "user_api", unauthorizedResponse: null });
    const { GET } = await import("@/app/api/ecomviper/walmart/products/route");

    const response = await GET(
      new NextRequest("https://app.ibrains.ai/api/ecomviper/walmart/products?search=&filter=all", {
        method: "GET",
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.count).toBe(1);
    expect(payload.products?.[0]?.sku).toBe("API-30066-841");
  });

  it("scopes products by signed-in user", async () => {
    await replaceWalmartProductsForUser({
      userId: "user_scope_a",
      products: [buildProduct("SCOPE-A-1")],
      importedAt: new Date().toISOString(),
    });
    await replaceWalmartProductsForUser({
      userId: "user_scope_b",
      products: [buildProduct("SCOPE-B-1")],
      importedAt: new Date().toISOString(),
    });

    const aProducts = await listWalmartProductsForUser("user_scope_a");
    const bProducts = await listWalmartProductsForUser("user_scope_b");
    const aSkuFromB = await getWalmartProductBySkuForUser("user_scope_b", "SCOPE-A-1");

    expect(aProducts.map((product) => product.sku)).toEqual(["SCOPE-A-1"]);
    expect(bProducts.map((product) => product.sku)).toEqual(["SCOPE-B-1"]);
    expect(aSkuFromB).toBeNull();
  });

  it("persists Item Search image fields across repository reload", async () => {
    const product = buildProduct("IMG-PERSIST-1");
    product.imageUrl = "https://images.example.com/img-persist-1.jpg";
    product.imageStatus = "image_available";
    product.imageStatusMessage = "Image available";
    product.imageSource = "walmart_item_search";
    product.imageSyncStatus = "found";
    product.imageMatchMethod = "gtin";
    product.matchedItemId = "WM-IMG-1";
    product.galleryImageUrls = [
      "https://images.example.com/img-persist-1.jpg",
      "https://images.example.com/img-persist-1-gallery.jpg",
    ];
    product.variantImageUrls = ["https://images.example.com/img-persist-1-variant.jpg"];
    product.lastImageSyncedAt = "2026-05-09T12:00:00.000Z";
    product.issues = [];

    await replaceWalmartProductsForUser({
      userId: "user_image_persist",
      products: [product],
      importedAt: new Date().toISOString(),
    });

    (globalThis as Record<string, unknown>).__ecomviper_walmart_store__ = undefined;

    const reloaded = await getWalmartProductBySkuForUser("user_image_persist", "IMG-PERSIST-1");
    expect(reloaded?.imageUrl).toBe("https://images.example.com/img-persist-1.jpg");
    expect(reloaded?.imageSyncStatus).toBe("found");
    expect(reloaded?.imageMatchMethod).toBe("gtin");
    expect(reloaded?.matchedItemId).toBe("WM-IMG-1");
    expect(reloaded?.galleryImageUrls).toEqual([
      "https://images.example.com/img-persist-1.jpg",
      "https://images.example.com/img-persist-1-gallery.jpg",
    ]);
    expect(reloaded?.variantImageUrls).toEqual(["https://images.example.com/img-persist-1-variant.jpg"]);
  });

  it("persists Item Report image fields across repository reload", async () => {
    const product = buildProduct("IMG-REPORT-1");
    product.imageUrl = "https://images.example.com/report-primary.jpg";
    product.imageStatus = "image_available";
    product.imageStatusMessage = "Image found in Walmart Item Report.";
    product.imageSource = "walmart_item_report";
    product.imageSyncStatus = "found";
    product.imageMatchMethod = "item_report_sku";
    product.matchedItemId = "REPORT-ITEM-1";
    product.galleryImageUrls = [
      "https://images.example.com/report-primary.jpg",
      "https://images.example.com/report-gallery.jpg",
    ];
    product.variantImageUrls = ["https://images.example.com/report-variant.jpg"];
    product.lastImageSyncedAt = "2026-05-09T13:00:00.000Z";
    product.issues = [];

    await replaceWalmartProductsForUser({
      userId: "user_image_report_persist",
      products: [product],
      importedAt: new Date().toISOString(),
    });

    (globalThis as Record<string, unknown>).__ecomviper_walmart_store__ = undefined;

    const reloaded = await getWalmartProductBySkuForUser("user_image_report_persist", "IMG-REPORT-1");
    expect(reloaded?.imageSource).toBe("walmart_item_report");
    expect(reloaded?.imageSyncStatus).toBe("found");
    expect(reloaded?.imageMatchMethod).toBe("item_report_sku");
    expect(reloaded?.imageStatusMessage).toBe("Image found in Walmart Item Report.");
    expect(reloaded?.matchedItemId).toBe("REPORT-ITEM-1");
  });

  it("test seed route stays disabled in normal mode and cannot shadow production products", async () => {
    await replaceWalmartProductsForUser({
      userId: "prod_user",
      products: [buildProduct("PROD-SKU-1")],
      importedAt: new Date().toISOString(),
    });

    authMocks.requireSignedInUser.mockResolvedValue({ userId: "prod_user", unauthorizedResponse: null });
    const { POST } = await import("@/app/api/ecomviper/walmart/test-seed/route");

    const disabledResponse = await POST(
      new NextRequest("https://app.ibrains.ai/api/ecomviper/walmart/test-seed", { method: "POST" })
    );
    expect(disabledResponse.status).toBe(404);

    const prodProductsAfterDisabledSeed = await listWalmartProductsForUser("prod_user");
    expect(prodProductsAfterDisabledSeed.map((product) => product.sku)).toEqual(["PROD-SKU-1"]);

    process.env.E2E_MOCK_GRAPH = "1";
    authMocks.requireSignedInUser.mockResolvedValue({ userId: "e2e-admin", unauthorizedResponse: null });

    const enabledResponse = await POST(
      new NextRequest("https://app.ibrains.ai/api/ecomviper/walmart/test-seed", {
        method: "POST",
        body: JSON.stringify({ sku: "E2E-SKU-1" }),
      })
    );

    expect(enabledResponse.status).toBe(200);
    const prodProductsAfterEnabledSeed = await listWalmartProductsForUser("prod_user");
    const e2eProducts = await listWalmartProductsForUser("e2e-admin");

    expect(prodProductsAfterEnabledSeed.map((product) => product.sku)).toEqual(["PROD-SKU-1"]);
    expect(e2eProducts.some((product) => product.sku === "E2E-SKU-1")).toBe(true);
  });

  it("saves a draft for a persisted SKU even when runtime product cache is empty", async () => {
    const userId = "user_save_after_ai";
    await replaceWalmartProductsForUser({
      userId,
      products: [buildProduct("ROC808")],
      importedAt: new Date().toISOString(),
    });

    (globalThis as Record<string, unknown>).__ecomviper_walmart_store__ = undefined;
    authMocks.requireSignedInUser.mockResolvedValue({ userId, unauthorizedResponse: null });

    const { POST: createDraftRoute } = await import("@/app/api/ecomviper/walmart/drafts/route");
    const response = await createDraftRoute(
      new NextRequest("https://app.ibrains.ai/api/ecomviper/walmart/drafts", {
        method: "POST",
        body: JSON.stringify({
          sku: "ROC808",
          draftPayload: {
            title: "ROC808 Daily Wellness Formula | Optimized",
            shortDescription: "Daily mobility support summary.",
            longDescription: "Detailed compliant listing description.",
            bulletPoints: ["Optimized bullet 1", "Optimized bullet 2", "Optimized bullet 3"],
            brand: "Walmart Brand",
            attributes: { form: "Capsule" },
            imageUrl: "",
            additionalImageUrls: [],
            price: 29.99,
            inventoryQuantity: 9,
          },
        }),
      })
    );

    const payload = await response.json();
    expect(response.status).toBe(201);
    expect(payload.ok).toBe(true);
    expect(payload.draft?.sku).toBe("ROC808");
    expect(payload.draft?.draftPayload?.title).toBe(
      "ROC808 Daily Wellness Formula | Optimized"
    );
  });

  it("returns product-not-found when draft save SKU is missing from persisted and runtime products", async () => {
    const userId = "user_save_missing";
    authMocks.requireSignedInUser.mockResolvedValue({ userId, unauthorizedResponse: null });
    (globalThis as Record<string, unknown>).__ecomviper_walmart_store__ = undefined;

    const { POST: createDraftRoute } = await import("@/app/api/ecomviper/walmart/drafts/route");
    const response = await createDraftRoute(
      new NextRequest("https://app.ibrains.ai/api/ecomviper/walmart/drafts", {
        method: "POST",
        body: JSON.stringify({
          sku: "MISSING-SKU",
          draftPayload: {
            title: "Missing SKU",
            price: 12.5,
            inventoryQuantity: 5,
          },
        }),
      })
    );

    const payload = await response.json();
    expect(response.status).toBe(404);
    expect(payload.error?.code).toBe("PRODUCT_NOT_FOUND");
    expect(payload.error?.message).toContain("product record was not found");
  });
});
