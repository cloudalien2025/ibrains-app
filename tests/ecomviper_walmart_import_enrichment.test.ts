import { beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeWalmartProduct } from "@/lib/ecomviper/core/product-normalizer";
import type { WalmartProductRecord } from "@/lib/ecomviper/walmart/walmart-types";

const serpApiMocks = vi.hoisted(() => ({
  getSerpApiCredentialsForUser: vi.fn(),
  enrichProductImagesFromPublicWalmartListing: vi.fn(),
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
});
