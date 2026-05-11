import { beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeWalmartProduct } from "@/lib/ecomviper/core/product-normalizer";
import type { WalmartProductRecord } from "@/lib/ecomviper/walmart/walmart-types";

const serpApiMocks = vi.hoisted(() => ({
  getSerpApiCredentialsForUser: vi.fn(),
  enrichProductImagesFromPublicWalmartListing: vi.fn(),
}));

const itemSearchMocks = vi.hoisted(() => ({
  enrichWalmartImageFromItemSearch: vi.fn(),
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

vi.mock("@/lib/ecomviper/walmart/walmart-item-search", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/ecomviper/walmart/walmart-item-search")>(
      "@/lib/ecomviper/walmart/walmart-item-search"
    );
  return {
    ...actual,
    enrichWalmartImageFromItemSearch: itemSearchMocks.enrichWalmartImageFromItemSearch,
  };
});

function createProduct(sku: string): WalmartProductRecord {
  return {
    ...normalizeWalmartProduct({
      sku,
      title: `Product ${sku}`,
      brand: "Brand",
      price: 19.99,
      inventoryQuantity: 3,
      inventoryStatus: "known",
      imageUrl: "",
      shortDescription: "Short",
      description: "Long",
      bulletPoints: ["Bullet"],
      attributes: {},
    }),
    itemId: `${sku}-ITEM`,
  };
}

describe("walmart import enrichment queue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serpApiMocks.getSerpApiCredentialsForUser.mockResolvedValue({
      connected: true,
      apiKey: "serpapi_test_key",
      status: "connected",
      statusReason: null,
    });
    itemSearchMocks.enrichWalmartImageFromItemSearch.mockResolvedValue({
      imageSyncStatus: "not_found",
      imageSource: "walmart_item_search",
      statusReason: "Item Search returned no usable image.",
      primaryImageUrl: "",
      galleryImageUrls: [],
      variantImageUrls: [],
      matchedItemId: null,
      matchMethod: "query",
      lastImageSyncedAt: "2026-05-11T00:00:00.000Z",
      diagnostics: {
        attempts: [],
        decision: {
          outcome: "not_found",
          reason: "Item Search returned no usable image.",
          matchMethod: "query",
          candidateCount: 0,
          selectedScore: null,
          runnerUpScore: null,
          acceptedBy: "none",
        },
      },
    });
  });

  it("continues processing remaining products when one enrichment throws", async () => {
    const now = "2026-05-11T00:00:00.000Z";
    const [productA, productB, productC] = [
      createProduct("A-1"),
      createProduct("B-1"),
      createProduct("C-1"),
    ];

    serpApiMocks.enrichProductImagesFromPublicWalmartListing.mockImplementation(
      async ({ product }: { product: WalmartProductRecord }) => {
        if (product.sku === "A-1") {
          throw new Error("Provider timeout");
        }
        if (product.sku === "B-1") {
          return {
            imageSyncStatus: "found" as const,
            imageSource: "public_walmart_listing_serpapi" as const,
            statusReason: "Found image.",
            imageMatchMethod: "serpapi_product_id" as const,
            publicWalmartUrl: "https://www.walmart.com/ip/18410702298",
            publicWalmartProductId: "18410702298",
            primaryImageUrl: "https://i5.walmartimages.com/asr/b-1.jpeg",
            galleryImageUrls: ["https://i5.walmartimages.com/asr/b-1.jpeg"],
            variantImageUrls: [],
            lastImageSyncedAt: now,
            diagnostics: {
              provider: "serpapi" as const,
              endpointFamily: "walmart_product" as const,
              statusCategory: "ok" as const,
              productId: "18410702298",
              candidateCount: 1,
              imageCount: 1,
              matchMethod: "serpapi_product_id" as const,
            },
          };
        }
        return {
          imageSyncStatus: "not_found" as const,
          imageSource: "public_walmart_listing_serpapi" as const,
          statusReason: "No image.",
          imageMatchMethod: "serpapi_product_id" as const,
          publicWalmartUrl: "",
          publicWalmartProductId: "C-1-ITEM",
          primaryImageUrl: "",
          galleryImageUrls: [],
          variantImageUrls: [],
          lastImageSyncedAt: now,
          diagnostics: {
            provider: "serpapi" as const,
            endpointFamily: "walmart_product" as const,
            statusCategory: "not_found" as const,
            productId: "C-1-ITEM",
            candidateCount: 0,
            imageCount: 0,
            matchMethod: "serpapi_product_id" as const,
          },
          errorCode: "SERPAPI_NOT_FOUND" as const,
        };
      }
    );

    const { runPublicListingImageEnrichmentQueue } = await import(
      "@/lib/ecomviper/walmart/walmart-import-enrichment"
    );

    const result = await runPublicListingImageEnrichmentQueue({
      userId: "user_clerk_1",
      products: [productA, productB, productC],
      importedCount: 3,
      concurrency: 2,
      retries: 0,
    });

    expect(serpApiMocks.enrichProductImagesFromPublicWalmartListing).toHaveBeenCalledTimes(3);
    expect(result.progress.enrichmentQueuedCount).toBe(3);
    expect(result.progress.enrichmentCompletedCount).toBe(3);
    expect(result.progress.foundCount).toBe(1);
    expect(result.progress.failedCount).toBe(1);
    expect(result.progress.notFoundCount).toBe(1);

    const failed = result.products.find((product) => product.sku === "A-1");
    const found = result.products.find((product) => product.sku === "B-1");
    const notFound = result.products.find((product) => product.sku === "C-1");

    expect(failed?.imageSyncStatus).toBe("failed");
    expect(found?.imageSyncStatus).toBe("found");
    expect(found?.imageUrl).toBe("https://i5.walmartimages.com/asr/b-1.jpeg");
    expect(notFound?.imageSyncStatus).toBe("not_found");
  });

  it("resolves image and public item ID via Walmart Item Search UPC without SerpApi fallback", async () => {
    const product = {
      ...createProduct("UPC-1"),
      itemId: "",
      publicWalmartProductId: "",
      publicWalmartUrl: "",
      upc: "850054016119",
      gtin: "",
    };

    itemSearchMocks.enrichWalmartImageFromItemSearch.mockResolvedValueOnce({
      imageSyncStatus: "found",
      imageSource: "walmart_item_search",
      statusReason: "Exact identifier match with usable Walmart Item Search image.",
      primaryImageUrl: "https://i5.walmartimages.com/asr/upc-1.jpg",
      galleryImageUrls: ["https://i5.walmartimages.com/asr/upc-1.jpg"],
      variantImageUrls: [],
      matchedItemId: "17812552813",
      matchMethod: "upc",
      lastImageSyncedAt: "2026-05-11T00:00:00.000Z",
      diagnostics: {
        attempts: [],
        decision: {
          outcome: "found",
          reason: "Exact identifier match with usable Walmart Item Search image.",
          matchMethod: "upc",
          candidateCount: 1,
          selectedScore: 320,
          runnerUpScore: null,
          acceptedBy: "identifier_exact",
        },
      },
    });

    const { runPublicListingImageEnrichmentQueue } = await import(
      "@/lib/ecomviper/walmart/walmart-import-enrichment"
    );

    const result = await runPublicListingImageEnrichmentQueue({
      userId: "user_clerk_1",
      accessToken: "wm_token",
      products: [product],
      importedCount: 1,
      retries: 0,
    });

    expect(itemSearchMocks.enrichWalmartImageFromItemSearch).toHaveBeenCalledTimes(1);
    expect(serpApiMocks.enrichProductImagesFromPublicWalmartListing).not.toHaveBeenCalled();
    expect(result.progress.walmartSearchImageFoundCount).toBe(1);
    expect(result.products[0]?.imageUrl).toBe("https://i5.walmartimages.com/asr/upc-1.jpg");
    expect(result.products[0]?.publicWalmartProductId).toBe("17812552813");
    expect(result.products[0]?.publicWalmartUrl).toContain("/17812552813");
  });

  it("uses GTIN structured resolver and avoids GTIN as SerpApi product ID", async () => {
    const product = {
      ...createProduct("GTIN-ONLY-1"),
      itemId: "",
      publicWalmartProductId: "",
      publicWalmartUrl: "",
      upc: "",
      gtin: "000852764008491",
    };

    itemSearchMocks.enrichWalmartImageFromItemSearch.mockResolvedValueOnce({
      imageSyncStatus: "not_found",
      imageSource: "walmart_item_search",
      statusReason: "Item Search returned no usable image.",
      primaryImageUrl: "",
      galleryImageUrls: [],
      variantImageUrls: [],
      matchedItemId: null,
      matchMethod: "gtin",
      lastImageSyncedAt: "2026-05-11T00:00:00.000Z",
      diagnostics: {
        attempts: [],
        decision: {
          outcome: "not_found",
          reason: "Item Search returned no usable image.",
          matchMethod: "gtin",
          candidateCount: 0,
          selectedScore: null,
          runnerUpScore: null,
          acceptedBy: "none",
        },
      },
    });
    serpApiMocks.enrichProductImagesFromPublicWalmartListing.mockResolvedValueOnce({
      imageSyncStatus: "not_found",
      imageSource: "public_walmart_listing_serpapi",
      statusReason: "No safe Walmart product identifier is available for lookup. Identifier strategy: gtin_skipped_for_product_lookup.",
      imageMatchMethod: null,
      publicWalmartUrl: "",
      publicWalmartProductId: "",
      primaryImageUrl: "",
      galleryImageUrls: [],
      variantImageUrls: [],
      lastImageSyncedAt: "2026-05-11T00:00:00.000Z",
      diagnostics: {
        provider: "serpapi",
        endpointFamily: "walmart_search",
        statusCategory: "not_found",
        productId: null,
        productIdentifierType: "gtin_skipped_for_product_lookup",
        candidateCount: 0,
        imageCount: 0,
        matchMethod: null,
      },
      errorCode: "SERPAPI_NOT_FOUND",
    });

    const { runPublicListingImageEnrichmentQueue } = await import(
      "@/lib/ecomviper/walmart/walmart-import-enrichment"
    );

    const result = await runPublicListingImageEnrichmentQueue({
      userId: "user_clerk_1",
      accessToken: "wm_token",
      products: [product],
      importedCount: 1,
      retries: 0,
    });

    expect(itemSearchMocks.enrichWalmartImageFromItemSearch).toHaveBeenCalledTimes(1);
    expect(serpApiMocks.enrichProductImagesFromPublicWalmartListing).toHaveBeenCalledTimes(1);
    expect(serpApiMocks.enrichProductImagesFromPublicWalmartListing).toHaveBeenCalledWith(
      expect.objectContaining({
        product: expect.objectContaining({
          gtin: "000852764008491",
          publicWalmartProductId: "",
        }),
      })
    );
    expect(result.progress.identifierPathCounts.skipped_gtin_as_product_id).toBeGreaterThanOrEqual(1);
  });
});
