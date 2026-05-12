import { beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeWalmartProduct } from "@/lib/ecomviper/core/product-normalizer";

const enrichmentQueueMocks = vi.hoisted(() => ({
  runPublicListingImageEnrichmentQueue: vi.fn(),
}));

const authMocks = vi.hoisted(() => ({
  requestWalmartTokenForUser: vi.fn(),
}));

vi.mock("@/lib/ecomviper/walmart/walmart-import-enrichment", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/ecomviper/walmart/walmart-import-enrichment")>(
      "@/lib/ecomviper/walmart/walmart-import-enrichment"
    );

  return {
    ...actual,
    runPublicListingImageEnrichmentQueue: enrichmentQueueMocks.runPublicListingImageEnrichmentQueue,
  };
});

vi.mock("@/lib/ecomviper/walmart/walmart-auth", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/ecomviper/walmart/walmart-auth")>(
      "@/lib/ecomviper/walmart/walmart-auth"
    );
  return {
    ...actual,
    requestWalmartTokenForUser: authMocks.requestWalmartTokenForUser,
  };
});

describe("Walmart retry enrichment identifier repair", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    (globalThis as Record<string, unknown>).__ecomviper_walmart_store__ = undefined;
    (globalThis as Record<string, unknown>).__ecomviper_walmart_product_fallback__ = undefined;
    (globalThis as Record<string, unknown>).__ecomviper_walmart_product_tables_checked__ = undefined;

    enrichmentQueueMocks.runPublicListingImageEnrichmentQueue.mockImplementation(
      async (input: { products: unknown[] }) => {
        const products = input.products;
        return {
          products,
          progress: {
            totalProducts: products.length,
            importedCount: products.length,
            enrichmentQueuedCount: products.length,
            enrichmentCompletedCount: products.length,
            foundCount: 0,
            walmartSearchResolvedCount: 0,
            walmartSearchImageFoundCount: 0,
            serpApiFallbackFoundCount: 0,
            serpApiProductGalleryFoundCount: 0,
            serpApiSearchFallbackFoundCount: 0,
            walmartSearchNotFoundCount: 0,
            notFoundCount: 0,
            ambiguousCount: 0,
            failedCount: 0,
            skippedNoProviderCount: 0,
            lastEnrichedAt: null,
            providerConnected: true,
            providerStatus: "connected",
            providerStatusReason: null,
            providerCanAttempt: true,
            errorCategories: {
              invalidKeyCount: 0,
              forbiddenCount: 0,
              rateLimitedCount: 0,
              badRequestCount: 0,
              providerErrorCount: 0,
              networkErrorCount: 0,
              malformedResponseCount: 0,
              unknownErrorCount: 0,
            },
            identifierPathCounts: {
              seller_catalog_only: 0,
              walmart_search_upc: 0,
              walmart_search_gtin: 0,
              walmart_search_title_brand: 0,
              public_item_id_direct: 0,
              serpapi_public_item_id: 0,
              serpapi_title_brand_fallback: 0,
              skipped_gtin_as_product_id: 0,
              walmart_search_not_found: 0,
              no_searchable_identifier: 0,
            },
            serpApiProductGalleryDiagnostics: {
              serpapi_product_gallery_checked: 0,
              serpapi_product_gallery_primary_found: 0,
              serpapi_product_gallery_additional_found: 0,
              serpapi_product_gallery_no_images: 0,
              skipped_no_verified_public_listing: 0,
              skipped_non_public_identifier: 0,
              skipped_gtin_as_product_id: 0,
            },
            serpApiBrandSearchDiagnostics: {
              serpapi_brand_search_checked: 0,
              serpapi_brand_search_results_harvested: 0,
              serpapi_brand_search_public_listing_matched: 0,
              serpapi_brand_search_thumbnail_saved: 0,
              serpapi_brand_search_ambiguous: 0,
              serpapi_brand_search_no_confident_match: 0,
            },
          },
        };
      }
    );
    authMocks.requestWalmartTokenForUser.mockResolvedValue({
      ok: true,
      tokenStatus: "valid",
      lastError: null,
      accessToken: "wm_token",
      environment: "production",
      marketplaceRegion: "US",
      httpStatus: 200,
      correlationId: "corr-retry",
    });
  });

  it("backfills Walmart product ID from persisted Walmart URL before retry queue runs", async () => {
    const { replaceWalmartProductsForUser, retryWalmartPublicImageEnrichmentForUser } = await import(
      "@/lib/ecomviper/walmart/walmart-products"
    );

    await replaceWalmartProductsForUser({
      userId: "user_ibrains",
      importedAt: "2026-05-11T00:00:00.000Z",
      products: [
        {
          ...normalizeWalmartProduct({
            sku: "WMT-URL-REPAIR-1",
            title: "Seort Product",
            brand: "Seort",
            price: 10,
            inventoryQuantity: 2,
            inventoryStatus: "known",
            imageUrl: "",
            upc: "",
            gtin: "",
            shortDescription: "Short",
            description: "Long",
            bulletPoints: ["Point"],
            attributes: {},
          }),
          publicWalmartProductId: "850054016119",
          publicWalmartUrl: undefined,
          normalizedPayload: {
            productPageUrl: "/ip/seort/17812552813",
            publicWalmartProductId: "850054016119",
          },
          rawPayload: {
            productPageUrl: "/ip/seort/17812552813",
            productId: "850054016119",
          },
        },
      ],
    });

    await retryWalmartPublicImageEnrichmentForUser("user_ibrains");

    expect(enrichmentQueueMocks.runPublicListingImageEnrichmentQueue).toHaveBeenCalledTimes(1);
    expect(enrichmentQueueMocks.runPublicListingImageEnrichmentQueue).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user_ibrains",
        accessToken: "wm_token",
        products: [
          expect.objectContaining({
            sku: "WMT-URL-REPAIR-1",
            publicWalmartUrl: "https://www.walmart.com/ip/seort/17812552813",
            publicWalmartProductId: "17812552813",
          }),
        ],
      })
    );
  });
});
