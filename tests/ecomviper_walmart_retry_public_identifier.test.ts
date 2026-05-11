import { beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeWalmartProduct } from "@/lib/ecomviper/core/product-normalizer";

const enrichmentQueueMocks = vi.hoisted(() => ({
  runPublicListingImageEnrichmentQueue: vi.fn(),
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
          },
        };
      }
    );
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
