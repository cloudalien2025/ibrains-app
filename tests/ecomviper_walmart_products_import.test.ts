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

const serpApiMocks = vi.hoisted(() => ({
  getSerpApiCredentialsForUser: vi.fn(),
  enrichProductImagesFromPublicWalmartListing: vi.fn(),
}));

vi.mock("@/lib/ecomviper/walmart/walmart-auth", () => ({
  requestWalmartTokenForUser: mocks.requestWalmartTokenForUser,
  getWalmartConnectionHealth: mocks.getWalmartConnectionHealth,
}));

vi.mock("@/lib/ecomviper/walmart/serpapi-walmart-images", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/ecomviper/walmart/serpapi-walmart-images")>(
      "@/lib/ecomviper/walmart/serpapi-walmart-images"
    );

  return {
    ...actual,
    getSerpApiCredentialsForUser: serpApiMocks.getSerpApiCredentialsForUser,
    enrichProductImagesFromPublicWalmartListing: serpApiMocks.enrichProductImagesFromPublicWalmartListing,
  };
});

function createFetchMock(params: {
  catalogPayload: unknown;
  inventoryBySku?: Record<string, unknown | null>;
  itemSearchByMethod?: Partial<Record<"gtin" | "upc" | "itemId" | "wpid" | "query", unknown>>;
  itemSearchByQueryValue?: Record<string, unknown>;
}) {
  const inventoryBySku = params.inventoryBySku ?? {};
  const itemSearchByMethod = params.itemSearchByMethod ?? {};
  const itemSearchByQueryValue = params.itemSearchByQueryValue ?? {};

  return vi.fn(async (input: RequestInfo | URL) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

    if (url.includes("/v3/items/walmart/search")) {
      const parsed = new URL(url);
      let key: "gtin" | "upc" | "itemId" | "wpid" | "query" = "query";
      const queryValue = (parsed.searchParams.get("query") ?? "").trim();
      if (parsed.searchParams.get("gtin")) key = "gtin";
      else if (parsed.searchParams.get("upc")) key = "upc";
      else if (queryValue) {
        if (/^item[-_ ]?id[: ]?/i.test(queryValue)) key = "itemId";
        else if (/^wpid[: ]?/i.test(queryValue)) key = "wpid";
        else if (itemSearchByMethod.itemId && queryValue.toUpperCase() === queryValue && /[0-9]/.test(queryValue)) {
          key = "itemId";
        } else if (itemSearchByMethod.wpid && queryValue.toUpperCase() === queryValue && /[0-9]/.test(queryValue)) {
          key = "wpid";
        } else key = "query";
      }

      const payload = itemSearchByQueryValue[queryValue] ?? itemSearchByMethod[key] ?? { items: [] };
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

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
    serpApiMocks.getSerpApiCredentialsForUser.mockResolvedValue({
      connected: false,
      apiKey: null,
    });
    serpApiMocks.enrichProductImagesFromPublicWalmartListing.mockResolvedValue({
      imageSyncStatus: "not_synced",
      imageSource: "public_walmart_listing_serpapi",
      statusReason: "SerpApi key missing. Connect SerpApi to enable automated public Walmart image enrichment.",
      imageMatchMethod: null,
      publicWalmartUrl: "",
      publicWalmartProductId: "",
      primaryImageUrl: "",
      galleryImageUrls: [],
      variantImageUrls: [],
      lastImageSyncedAt: "2026-05-10T00:00:00.000Z",
      diagnostics: {
        provider: "serpapi",
        endpointFamily: "walmart_product",
        statusCategory: "not_configured",
        productId: null,
        candidateCount: 0,
        imageCount: 0,
        matchMethod: null,
      },
      errorCode: "SERPAPI_NOT_CONNECTED",
    });
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
    expect(product?.imageStatusMessage).toBe("Item Search returned no usable image.");
    expect(product?.imageSyncStatus).toBe("not_found");
    expect(product?.issues).toContain("Image not provided by Walmart Item Search");
    expect(product?.issues).not.toContain("Image not provided by Walmart catalog");
    expect(product?.status).not.toBe("sync_failed");
    expect(product?.inventoryQuantity).toBe(7);
    expect(product?.inventoryStatus).toBe("known");
  });

  it("enriches missing catalog images using Item Search with GTIN/UPC priority", async () => {
    mocks.requestWalmartTokenForUser.mockResolvedValue({
      ok: true,
      tokenStatus: "valid",
      lastError: null,
      accessToken: "wm_live_access_token",
      environment: "production",
      marketplaceRegion: "US",
      httpStatus: 200,
      correlationId: "corr-image-gtin",
    });

    const fetchMock = createFetchMock({
      catalogPayload: {
        ItemResponse: [
          {
            sku: "GTIN-IMAGE-1",
            productName: "GTIN Image Product",
            brand: "Walmart Brand",
            gtin: "000111222333",
            upc: "111222333444",
            availability: "In_stock",
            price: { amount: "22.00" },
          },
        ],
      },
      inventoryBySku: {
        "GTIN-IMAGE-1": {
          sku: "GTIN-IMAGE-1",
          quantity: { unit: "EACH", amount: 4 },
        },
      },
      itemSearchByMethod: {
        gtin: {
          items: [
            {
              itemId: "12345",
              gtin: "000111222333",
              productName: "GTIN Image Product",
              brand: "Walmart Brand",
              images: [{ url: "http://images.example.com/gtin-image-1.jpg" }],
              properties: {
                variants: {
                  variantData: [{ productImageUrl: "https://images.example.com/gtin-image-1-variant.jpg" }],
                },
              },
            },
          ],
        },
      },
    });
    vi.stubGlobal("fetch", fetchMock);

    const { importWalmartProducts, listWalmartProducts } = await import("@/lib/ecomviper/walmart/walmart-products");
    const result = await importWalmartProducts("user_clerk_1");
    const product = listWalmartProducts().find((entry) => entry.sku === "GTIN-IMAGE-1");

    expect(result.importDiagnostics?.imageFoundCount).toBe(1);
    expect(result.importDiagnostics?.imageSource).toBe(
      "Walmart Item Report + Walmart Item Search + Public Walmart Listing via SerpApi"
    );
    expect(product?.imageUrl).toBe("https://images.example.com/gtin-image-1.jpg");
    expect(product?.imageSyncStatus).toBe("found");
    expect(product?.imageMatchMethod).toBe("gtin");
    expect(product?.imageSource).toBe("walmart_item_search");
    expect(product?.gtin).toBe("000111222333");
    expect(product?.upc).toBe("111222333444");
    expect(product?.galleryImageUrls).toContain("https://images.example.com/gtin-image-1.jpg");
    expect(product?.variantImageUrls).toContain("https://images.example.com/gtin-image-1-variant.jpg");
    expect(product?.issues).not.toContain("Image not provided by Walmart Item Search");
  });

  it("uses title/brand query fallback when identifiers are unavailable", async () => {
    mocks.requestWalmartTokenForUser.mockResolvedValue({
      ok: true,
      tokenStatus: "valid",
      lastError: null,
      accessToken: "wm_live_access_token",
      environment: "production",
      marketplaceRegion: "US",
      httpStatus: 200,
      correlationId: "corr-image-query",
    });

    const fetchMock = createFetchMock({
      catalogPayload: {
        ItemResponse: [
          {
            sku: "QUERY-IMAGE-1",
            productName: "Daily Wellness Formula",
            brand: "BrandX",
            availability: "In_stock",
            price: { amount: "12.50" },
          },
        ],
      },
      inventoryBySku: {
        "QUERY-IMAGE-1": {
          sku: "QUERY-IMAGE-1",
          quantity: { unit: "EACH", amount: 5 },
        },
      },
      itemSearchByMethod: {
        query: {
          items: [
            {
              itemId: "Q-100",
              productName: "Daily Wellness Formula",
              brand: "BrandX",
              images: [{ url: "https://images.example.com/query-image-1.jpg" }],
            },
          ],
        },
      },
    });
    vi.stubGlobal("fetch", fetchMock);

    const { importWalmartProducts, listWalmartProducts } = await import("@/lib/ecomviper/walmart/walmart-products");
    await importWalmartProducts("user_clerk_1");
    const product = listWalmartProducts().find((entry) => entry.sku === "QUERY-IMAGE-1");

    expect(product?.imageUrl).toBe("https://images.example.com/query-image-1.jpg");
    expect(product?.imageMatchMethod).toBe("query");
    expect(product?.imageSyncStatus).toBe("found");
  });

  it("uses itemId fallback as an exact high-confidence match when available", async () => {
    mocks.requestWalmartTokenForUser.mockResolvedValue({
      ok: true,
      tokenStatus: "valid",
      lastError: null,
      accessToken: "wm_live_access_token",
      environment: "production",
      marketplaceRegion: "US",
      httpStatus: 200,
      correlationId: "corr-image-itemid",
    });

    const fetchMock = createFetchMock({
      catalogPayload: {
        ItemResponse: [
          {
            sku: "ITEMID-IMAGE-1",
            itemId: "WM-ITEM-123",
            productName: "ItemId Match Product",
            brand: "BrandY",
            availability: "In_stock",
            price: { amount: "24.25" },
          },
        ],
      },
      inventoryBySku: {
        "ITEMID-IMAGE-1": {
          sku: "ITEMID-IMAGE-1",
          quantity: { unit: "EACH", amount: 3 },
        },
      },
      itemSearchByQueryValue: {
        "WM-ITEM-123": {
          items: [
            {
              itemId: "WM-ITEM-123",
              productName: "ItemId Match Product",
              brand: "BrandY",
              images: [{ url: "https://images.example.com/itemid-image-1.jpg" }],
            },
          ],
        },
      },
    });
    vi.stubGlobal("fetch", fetchMock);

    const { importWalmartProducts, listWalmartProducts } = await import("@/lib/ecomviper/walmart/walmart-products");
    await importWalmartProducts("user_clerk_1");
    const product = listWalmartProducts().find((entry) => entry.sku === "ITEMID-IMAGE-1");

    expect(product?.imageSyncStatus).toBe("found");
    expect(product?.imageMatchMethod).toBe("itemId");
    expect(product?.matchedItemId).toBe("WM-ITEM-123");
    expect(product?.imageUrl).toBe("https://images.example.com/itemid-image-1.jpg");
    expect(product?.imageStatusMessage).toBe("Image available");
  });

  it("uses Item Report before Item Search and stores per-source image fields", async () => {
    mocks.requestWalmartTokenForUser.mockResolvedValue({
      ok: true,
      tokenStatus: "valid",
      lastError: null,
      accessToken: "wm_live_access_token",
      environment: "production",
      marketplaceRegion: "US",
      httpStatus: 200,
      correlationId: "corr-item-report-priority",
    });

    const callOrder: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        callOrder.push(url);

        if (url.includes("/v3/items?")) {
          return new Response(
            JSON.stringify({
              ItemResponse: [
                {
                  sku: "REPORT-IMG-1",
                  productName: "Report Image Product",
                  brand: "BrandR",
                  price: { amount: "18.00" },
                },
                {
                  sku: "SEARCH-IMG-1",
                  productName: "Search Image Product",
                  brand: "BrandS",
                  price: { amount: "14.00" },
                },
              ],
            }),
            { status: 200, headers: { "content-type": "application/json" } }
          );
        }

        if (url.includes("/v3/inventory")) {
          return new Response(JSON.stringify({ quantity: { amount: 5 } }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }

        if (url.includes("/v3/reports/reportRequests/REQ-REPORT-1")) {
          return new Response(
            JSON.stringify({ reportStatus: "PROCESSED", downloadUrl: "https://signed.example.com/report.csv" }),
            { status: 200, headers: { "content-type": "application/json" } }
          );
        }

        if (url.includes("/v3/reports/reportRequests") && !url.includes("/v3/reports/reportRequests/")) {
          return new Response(JSON.stringify({ reportRequestId: "REQ-REPORT-1" }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }

        if (url.includes("signed.example.com/report.csv")) {
          return new Response(
            ["SKU,PrimaryImageUrl", "REPORT-IMG-1,https://images.example.com/report-img-1.jpg"].join("\n"),
            { status: 200, headers: { "content-type": "text/csv" } }
          );
        }

        if (url.includes("/v3/items/walmart/search")) {
          return new Response(
            JSON.stringify({
              items: [
                {
                  itemId: "SEARCH-ITEM-1",
                  productName: "Search Image Product",
                  brand: "BrandS",
                  images: [{ url: "https://images.example.com/search-img-1.jpg" }],
                },
              ],
            }),
            { status: 200, headers: { "content-type": "application/json" } }
          );
        }

        return new Response(JSON.stringify({ message: "not found" }), {
          status: 404,
          headers: { "content-type": "application/json" },
        });
      })
    );

    const { importWalmartProducts, listWalmartProducts } = await import("@/lib/ecomviper/walmart/walmart-products");
    const result = await importWalmartProducts("user_clerk_1");
    const reportProduct = listWalmartProducts().find((entry) => entry.sku === "REPORT-IMG-1");
    const searchProduct = listWalmartProducts().find((entry) => entry.sku === "SEARCH-IMG-1");

    const firstReportCall = callOrder.findIndex((entry) => entry.includes("/v3/reports/reportRequests"));
    const firstItemSearchCall = callOrder.findIndex((entry) => entry.includes("/v3/items/walmart/search"));

    expect(firstReportCall).toBeGreaterThan(-1);
    expect(firstItemSearchCall).toBeGreaterThan(-1);
    expect(firstReportCall).toBeLessThan(firstItemSearchCall);

    expect(reportProduct?.imageSource).toBe("walmart_item_report");
    expect(reportProduct?.imageMatchMethod).toBe("item_report_sku");
    expect(reportProduct?.imageUrl).toBe("https://images.example.com/report-img-1.jpg");
    expect(reportProduct?.imageStatusMessage).toBe("Image available");

    expect(searchProduct?.imageSource).toBe("walmart_item_search");
    expect(searchProduct?.imageMatchMethod).toBe("query");
    expect(searchProduct?.imageUrl).toBe("https://images.example.com/search-img-1.jpg");

    expect(result.importDiagnostics?.itemReportRequested).toBe(true);
    expect(result.importDiagnostics?.itemReportDownloaded).toBe(true);
    expect(result.importDiagnostics?.itemReportRowsParsed).toBe(1);
    expect(result.importDiagnostics?.itemReportRequestEndpointUsed).toBe("/v3/reports/reportRequests");
    expect(result.importDiagnostics?.itemReportStatusEndpointUsed).toBe("/v3/reports/reportRequests/REQ-REPORT-1");
    expect(result.importDiagnostics?.itemReportDownloadEndpointUsed).toBe("status.downloadUrl");
    expect(result.importDiagnostics?.itemReportFailureCategory).toBe("none");
    expect(result.importDiagnostics?.imageSourceBreakdown?.walmartItemReport).toBe(1);
    expect(result.importDiagnostics?.imageSourceBreakdown?.walmartItemSearch).toBe(1);
  });

  it("does not fail import when Item Search image sync fails for a SKU", async () => {
    mocks.requestWalmartTokenForUser.mockResolvedValue({
      ok: true,
      tokenStatus: "valid",
      lastError: null,
      accessToken: "wm_live_access_token",
      environment: "production",
      marketplaceRegion: "US",
      httpStatus: 200,
      correlationId: "corr-image-fail",
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        if (url.includes("/v3/items/walmart/search")) {
          return new Response(JSON.stringify({ message: "service unavailable" }), {
            status: 503,
            headers: { "content-type": "application/json" },
          });
        }
        if (url.includes("/v3/items")) {
          return new Response(
            JSON.stringify({
              ItemResponse: [
                {
                  sku: "FAILED-IMG-1",
                  productName: "Image Failure Product",
                  brand: "Walmart Brand",
                  price: { amount: "10.99" },
                },
              ],
            }),
            { status: 200, headers: { "content-type": "application/json" } }
          );
        }
        if (url.includes("/v3/inventory")) {
          return new Response(JSON.stringify({ quantity: { amount: 3 } }), {
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

    const { importWalmartProducts, listWalmartProducts } = await import("@/lib/ecomviper/walmart/walmart-products");
    const result = await importWalmartProducts("user_clerk_1");
    const product = listWalmartProducts().find((entry) => entry.sku === "FAILED-IMG-1");

    expect(result.importedCount).toBe(1);
    expect(result.importDiagnostics?.imageFailedCount).toBe(1);
    expect(product?.imageSyncStatus).toBe("failed");
    expect(product?.imageStatusMessage).toBe("Item Search request failed after retry.");
    expect(product?.issues).toContain("Image sync failed");
    expect(product?.inventoryQuantity).toBe(3);
  });

  it("runs public listing SerpApi enrichment for missing images when provider is connected", async () => {
    mocks.requestWalmartTokenForUser.mockResolvedValue({
      ok: true,
      tokenStatus: "valid",
      lastError: null,
      accessToken: "wm_live_access_token",
      environment: "production",
      marketplaceRegion: "US",
      httpStatus: 200,
      correlationId: "corr-public-serpapi",
    });

    serpApiMocks.getSerpApiCredentialsForUser.mockResolvedValue({
      connected: true,
      apiKey: "serpapi_test_key",
    });
    serpApiMocks.enrichProductImagesFromPublicWalmartListing.mockResolvedValue({
      imageSyncStatus: "found",
      imageSource: "public_walmart_listing_serpapi",
      statusReason: "Public Walmart listing images found via SerpApi.",
      imageMatchMethod: "serpapi_product_id",
      publicWalmartUrl: "https://www.walmart.com/ip/sample/18410702298",
      publicWalmartProductId: "18410702298",
      primaryImageUrl: "https://i5.walmartimages.com/asr/18410702298-primary.jpeg",
      galleryImageUrls: [
        "https://i5.walmartimages.com/asr/18410702298-primary.jpeg",
        "https://i5.walmartimages.com/asr/18410702298-gallery-1.jpeg",
      ],
      variantImageUrls: [],
      lastImageSyncedAt: "2026-05-10T00:00:00.000Z",
      diagnostics: {
        provider: "serpapi",
        endpointFamily: "walmart_product",
        statusCategory: "ok",
        productId: "18410702298",
        candidateCount: 1,
        imageCount: 2,
        matchMethod: "serpapi_product_id",
      },
    });

    const fetchMock = createFetchMock({
      catalogPayload: {
        ItemResponse: [
          {
            sku: "SERPAPI-IMG-1",
            productName: "SerpApi Image Product",
            brand: "OPA",
            itemId: "18410702298",
            availability: "In_stock",
            price: { amount: "29.99" },
          },
        ],
      },
      inventoryBySku: {
        "SERPAPI-IMG-1": {
          sku: "SERPAPI-IMG-1",
          quantity: { unit: "EACH", amount: 7 },
        },
      },
    });
    vi.stubGlobal("fetch", fetchMock);

    const { importWalmartProducts, listWalmartProducts } = await import("@/lib/ecomviper/walmart/walmart-products");
    const result = await importWalmartProducts("user_clerk_1");
    const product = listWalmartProducts().find((entry) => entry.sku === "SERPAPI-IMG-1");

    expect(serpApiMocks.enrichProductImagesFromPublicWalmartListing).toHaveBeenCalledTimes(1);
    expect(result.importDiagnostics?.enrichmentQueuedCount).toBe(1);
    expect(result.importDiagnostics?.enrichmentCompletedCount).toBe(1);
    expect(result.importDiagnostics?.imageFoundCount).toBe(1);
    expect(result.importDiagnostics?.imageSourceBreakdown?.publicWalmartListingSerpApi).toBe(1);
    expect(product?.imageSource).toBe("public_walmart_listing_serpapi");
    expect(product?.imageUrl).toBe("https://i5.walmartimages.com/asr/18410702298-primary.jpeg");
  });

  it("normalizes numeric Walmart public IDs from import payload for SerpApi enrichment", async () => {
    mocks.requestWalmartTokenForUser.mockResolvedValue({
      ok: true,
      tokenStatus: "valid",
      lastError: null,
      accessToken: "wm_live_access_token",
      environment: "production",
      marketplaceRegion: "US",
      httpStatus: 200,
      correlationId: "corr-public-serpapi-numeric-id",
    });

    serpApiMocks.getSerpApiCredentialsForUser.mockResolvedValue({
      connected: true,
      apiKey: "serpapi_test_key",
    });
    serpApiMocks.enrichProductImagesFromPublicWalmartListing.mockResolvedValue({
      imageSyncStatus: "found",
      imageSource: "public_walmart_listing_serpapi",
      statusReason: "Public Walmart listing images found via SerpApi.",
      imageMatchMethod: "public_url_product_id",
      publicWalmartUrl:
        "https://www.walmart.com/ip/OPA-Sleep-Magnesium-Glycinate-Relaxation-Gummies-60ct/18410702298",
      publicWalmartProductId: "18410702298",
      primaryImageUrl: "https://i5.walmartimages.com/asr/18410702298-primary.jpeg",
      galleryImageUrls: ["https://i5.walmartimages.com/asr/18410702298-primary.jpeg"],
      variantImageUrls: [],
      lastImageSyncedAt: "2026-05-10T00:00:00.000Z",
      diagnostics: {
        provider: "serpapi",
        endpointFamily: "walmart_product",
        statusCategory: "ok",
        productId: "18410702298",
        candidateCount: 1,
        imageCount: 1,
        matchMethod: "public_url_product_id",
      },
    });

    const fetchMock = createFetchMock({
      catalogPayload: {
        ItemResponse: [
          {
            sku: "SERPAPI-NUMERIC-ID-1",
            productName: "Numeric Identifier Product",
            brand: "OPA",
            usItemId: 18410702298,
            productPageUrl:
              "https://www.walmart.com/ip/OPA-Sleep-Magnesium-Glycinate-Relaxation-Gummies-60ct/18410702298",
            availability: "In_stock",
            price: { amount: "18.99" },
          },
        ],
      },
      inventoryBySku: {
        "SERPAPI-NUMERIC-ID-1": {
          sku: "SERPAPI-NUMERIC-ID-1",
          quantity: { unit: "EACH", amount: 4 },
        },
      },
    });
    vi.stubGlobal("fetch", fetchMock);

    const { importWalmartProducts, listWalmartProducts } = await import("@/lib/ecomviper/walmart/walmart-products");
    const result = await importWalmartProducts("user_clerk_1");
    const product = listWalmartProducts().find((entry) => entry.sku === "SERPAPI-NUMERIC-ID-1");

    expect(result.importDiagnostics?.imageFoundCount).toBe(1);
    expect(product?.publicWalmartProductId).toBe("18410702298");
    expect(product?.publicWalmartUrl).toContain("/18410702298");
    expect(serpApiMocks.enrichProductImagesFromPublicWalmartListing).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user_clerk_1",
        product: expect.objectContaining({
          publicWalmartProductId: "18410702298",
        }),
      })
    );
  });

  it("reports no-image reason when SerpApi is not connected", async () => {
    mocks.requestWalmartTokenForUser.mockResolvedValue({
      ok: true,
      tokenStatus: "valid",
      lastError: null,
      accessToken: "wm_live_access_token",
      environment: "production",
      marketplaceRegion: "US",
      httpStatus: 200,
      correlationId: "corr-no-provider-reason",
    });

    serpApiMocks.getSerpApiCredentialsForUser.mockResolvedValue({
      connected: false,
      apiKey: null,
    });

    const fetchMock = createFetchMock({
      catalogPayload: {
        ItemResponse: [
          {
            sku: "NO-PROVIDER-IMG-1",
            productName: "No Provider Product",
            brand: "BrandZ",
            availability: "In_stock",
            price: { amount: "11.00" },
          },
        ],
      },
      inventoryBySku: {
        "NO-PROVIDER-IMG-1": {
          sku: "NO-PROVIDER-IMG-1",
          quantity: { unit: "EACH", amount: 2 },
        },
      },
    });
    vi.stubGlobal("fetch", fetchMock);

    const { importWalmartProducts } = await import("@/lib/ecomviper/walmart/walmart-products");
    const result = await importWalmartProducts("user_clerk_1");

    expect(result.importDiagnostics?.enrichmentProviderConnected).toBe(false);
    expect(result.importDiagnostics?.imageSkippedNoProviderCount).toBe(1);
    expect(result.importDiagnostics?.imageEnrichmentNoImageReason).toBe(
      "Connect SerpApi to enable automated public Walmart image enrichment."
    );
    expect(result.importDiagnostics?.serpApiStatus).toBe("not_connected");
    expect(result.importDiagnostics?.serpApiCanAttempt).toBe(false);
  });

  it("categorizes SerpApi invalid-key failures without marking provider as disconnected", async () => {
    mocks.requestWalmartTokenForUser.mockResolvedValue({
      ok: true,
      tokenStatus: "valid",
      lastError: null,
      accessToken: "wm_live_access_token",
      environment: "production",
      marketplaceRegion: "US",
      httpStatus: 200,
      correlationId: "corr-invalid-key",
    });

    serpApiMocks.getSerpApiCredentialsForUser.mockResolvedValue({
      connected: true,
      apiKey: "serpapi_bad_key",
    });
    serpApiMocks.enrichProductImagesFromPublicWalmartListing.mockResolvedValue({
      imageSyncStatus: "failed",
      imageSource: "public_walmart_listing_serpapi",
      statusReason: "SerpApi key was rejected.",
      imageMatchMethod: "serpapi_product_id",
      publicWalmartUrl: "",
      publicWalmartProductId: "18410702298",
      primaryImageUrl: "",
      galleryImageUrls: [],
      variantImageUrls: [],
      lastImageSyncedAt: "2026-05-10T00:00:00.000Z",
      diagnostics: {
        provider: "serpapi",
        endpointFamily: "walmart_product",
        statusCategory: "invalid_key",
        productId: "18410702298",
        candidateCount: 0,
        imageCount: 0,
        matchMethod: "serpapi_product_id",
      },
      errorCode: "SERPAPI_INVALID_KEY",
    });

    const fetchMock = createFetchMock({
      catalogPayload: {
        ItemResponse: [
          {
            sku: "SERPAPI-INVALID-KEY-1",
            productName: "Invalid Key Product",
            brand: "BrandX",
            itemId: "18410702298",
            availability: "In_stock",
            price: { amount: "11.00" },
          },
        ],
      },
      inventoryBySku: {
        "SERPAPI-INVALID-KEY-1": {
          sku: "SERPAPI-INVALID-KEY-1",
          quantity: { unit: "EACH", amount: 2 },
        },
      },
    });
    vi.stubGlobal("fetch", fetchMock);

    const { importWalmartProducts, listWalmartProducts } = await import("@/lib/ecomviper/walmart/walmart-products");
    const result = await importWalmartProducts("user_clerk_1");
    const product = listWalmartProducts().find((entry) => entry.sku === "SERPAPI-INVALID-KEY-1");

    expect(result.importDiagnostics?.serpApiStatus).toBe("invalid_key");
    expect(result.importDiagnostics?.serpApiStatusReason).toBe("SerpApi key was rejected.");
    expect(result.importDiagnostics?.imageFailedCount).toBe(1);
    expect(result.importDiagnostics?.enrichmentErrorCategories?.invalidKeyCount).toBe(1);
    expect(product?.imageSource).toBe("public_walmart_listing_serpapi");
    expect(product?.imageSyncStatus).toBe("failed");
    expect(product?.imageStatusMessage).toBe("SerpApi key was rejected.");
  });

  it("categorizes SerpApi forbidden failures with provider warning reason", async () => {
    mocks.requestWalmartTokenForUser.mockResolvedValue({
      ok: true,
      tokenStatus: "valid",
      lastError: null,
      accessToken: "wm_live_access_token",
      environment: "production",
      marketplaceRegion: "US",
      httpStatus: 200,
      correlationId: "corr-forbidden",
    });

    serpApiMocks.getSerpApiCredentialsForUser.mockResolvedValue({
      connected: true,
      apiKey: "serpapi_forbidden_key",
    });
    serpApiMocks.enrichProductImagesFromPublicWalmartListing.mockResolvedValue({
      imageSyncStatus: "failed",
      imageSource: "public_walmart_listing_serpapi",
      statusReason: "SerpApi account does not have permission.",
      imageMatchMethod: "serpapi_product_id",
      publicWalmartUrl: "",
      publicWalmartProductId: "18410702298",
      primaryImageUrl: "",
      galleryImageUrls: [],
      variantImageUrls: [],
      lastImageSyncedAt: "2026-05-10T00:00:00.000Z",
      diagnostics: {
        provider: "serpapi",
        endpointFamily: "walmart_product",
        statusCategory: "forbidden",
        productId: "18410702298",
        candidateCount: 0,
        imageCount: 0,
        matchMethod: "serpapi_product_id",
      },
      errorCode: "SERPAPI_FORBIDDEN",
    });

    const fetchMock = createFetchMock({
      catalogPayload: {
        ItemResponse: [
          {
            sku: "SERPAPI-FORBIDDEN-1",
            productName: "Forbidden Product",
            brand: "BrandX",
            itemId: "18410702298",
            availability: "In_stock",
            price: { amount: "11.00" },
          },
        ],
      },
      inventoryBySku: {
        "SERPAPI-FORBIDDEN-1": {
          sku: "SERPAPI-FORBIDDEN-1",
          quantity: { unit: "EACH", amount: 2 },
        },
      },
    });
    vi.stubGlobal("fetch", fetchMock);

    const { importWalmartProducts } = await import("@/lib/ecomviper/walmart/walmart-products");
    const result = await importWalmartProducts("user_clerk_1");

    expect(result.importDiagnostics?.serpApiStatus).toBe("forbidden");
    expect(result.importDiagnostics?.serpApiStatusReason).toBe("SerpApi account does not have permission.");
    expect(result.importDiagnostics?.enrichmentErrorCategories?.forbiddenCount).toBe(1);
    expect(result.importDiagnostics?.imageEnrichmentNoImageReason).toBe(
      "SerpApi account does not have permission."
    );
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
