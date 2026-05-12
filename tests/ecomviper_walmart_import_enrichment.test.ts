import { beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeWalmartProduct } from "@/lib/ecomviper/core/product-normalizer";
import type { WalmartProductRecord } from "@/lib/ecomviper/walmart/walmart-types";

const serpApiMocks = vi.hoisted(() => ({
  getSerpApiCredentialsForUser: vi.fn(),
  harvestWalmartBrandSearchListingsViaSerpApi: vi.fn(),
  matchImportedWalmartProductToBrandSearchListings: vi.fn(),
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
    harvestWalmartBrandSearchListingsViaSerpApi:
      serpApiMocks.harvestWalmartBrandSearchListingsViaSerpApi,
    matchImportedWalmartProductToBrandSearchListings:
      serpApiMocks.matchImportedWalmartProductToBrandSearchListings,
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
    serpApiMocks.harvestWalmartBrandSearchListingsViaSerpApi.mockResolvedValue({
      ok: true,
      statusCategory: "not_found",
      statusReason: "No brand-search public listing candidates found.",
      query: "OPA Nutrition",
      pagesFetched: 1,
      resultsHarvested: 0,
      listings: [],
    });
    serpApiMocks.matchImportedWalmartProductToBrandSearchListings.mockReturnValue({
      status: "no_confident_match",
      confidence: "low",
      score: 0,
      matchedListing: null,
      runnerUpListing: null,
      runnerUpScore: 0,
      titleCoverage: 0,
      titleJaccard: 0,
      keyTokenOverlap: 0,
      exactTitle: false,
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

  it("discovers verified public listing via SerpApi brand search and enriches gallery images", async () => {
    const product = {
      ...createProduct("OPA-SLEEP-1"),
      title:
        "OPA Sleep Magnesium Glycinate Evening Relaxation & Nightly Wellness Capsules 60ct",
      brand: "OPA Nutrition",
      itemId: "",
      publicWalmartProductId: "",
      publicWalmartUrl: "",
      imageUrl: "",
    };

    const listing = {
      sourceQuery: "OPA Nutrition",
      page: 1,
      rank: 3,
      title: "OPA Sleep Magnesium Glycinate Evening Relaxation & Nightly Wellness Capsules 60ct",
      thumbnail: "https://i5.walmartimages.com/asr/opa-brand-thumb.jpg",
      productPageUrl:
        "https://www.walmart.com/ip/OPA-Sleep-Magnesium-Glycinate/18410702298",
      usItemId: "18410702298",
      productId: "6FWY2XQ0R4DE",
      upc: "850054016119",
      sellerId: "401",
      sellerName: "OPA Nutrition",
      brand: "OPA Nutrition",
      manufacturer: "OPA Nutrition",
      raw: {},
    };

    serpApiMocks.harvestWalmartBrandSearchListingsViaSerpApi.mockResolvedValueOnce({
      ok: true,
      statusCategory: "ok",
      statusReason: "Harvested 1 brand-search public listing candidate(s).",
      query: "OPA Nutrition",
      pagesFetched: 1,
      resultsHarvested: 1,
      listings: [listing],
    });
    serpApiMocks.matchImportedWalmartProductToBrandSearchListings.mockReturnValueOnce({
      status: "matched",
      confidence: "high",
      score: 98,
      matchedListing: listing,
      runnerUpListing: null,
      runnerUpScore: 0,
      titleCoverage: 1,
      titleJaccard: 1,
      keyTokenOverlap: 4,
      exactTitle: true,
    });
    serpApiMocks.enrichProductImagesFromPublicWalmartListing.mockResolvedValueOnce({
      imageSyncStatus: "found",
      imageSource: "public_walmart_listing_serpapi",
      statusReason: "Public Walmart listing images found via SerpApi.",
      imageMatchMethod: "serpapi_product_id",
      publicWalmartUrl: "https://www.walmart.com/ip/18410702298",
      publicWalmartProductId: "18410702298",
      primaryImageUrl: "https://i5.walmartimages.com/asr/opa-gallery-1.jpg",
      galleryImageUrls: [
        "https://i5.walmartimages.com/asr/opa-gallery-1.jpg",
        "https://i5.walmartimages.com/asr/opa-gallery-2.jpg",
        "https://i5.walmartimages.com/asr/opa-gallery-3.jpg",
        "https://i5.walmartimages.com/asr/opa-gallery-4.jpg",
        "https://i5.walmartimages.com/asr/opa-gallery-5.jpg",
      ],
      variantImageUrls: [],
      lastImageSyncedAt: "2026-05-11T00:00:00.000Z",
      diagnostics: {
        provider: "serpapi",
        endpointFamily: "walmart_product",
        statusCategory: "ok",
        productId: "18410702298",
        productIdentifierType: "walmart_item_id",
        candidateCount: 1,
        imageCount: 5,
        matchMethod: "serpapi_product_id",
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

    expect(serpApiMocks.harvestWalmartBrandSearchListingsViaSerpApi).toHaveBeenCalledTimes(1);
    expect(serpApiMocks.matchImportedWalmartProductToBrandSearchListings).toHaveBeenCalledTimes(1);
    expect(serpApiMocks.enrichProductImagesFromPublicWalmartListing).toHaveBeenCalledTimes(1);
    expect(result.products[0]?.publicWalmartProductId).toBe("18410702298");
    expect(result.products[0]?.publicWalmartUrl).toContain("/18410702298");
    expect(result.products[0]?.imageUrl).toBe("https://i5.walmartimages.com/asr/opa-gallery-1.jpg");
    expect(result.products[0]?.galleryImageUrls?.length).toBeGreaterThanOrEqual(5);
    expect(
      result.progress.serpApiBrandSearchDiagnostics.serpapi_brand_search_public_listing_matched
    ).toBe(1);
    expect(result.progress.serpApiProductGalleryDiagnostics.serpapi_product_gallery_checked).toBe(1);
  });

  it("marks brand-search ambiguity and skips automatic persistence and gallery fallback", async () => {
    const product = {
      ...createProduct("OPA-AMBIG-1"),
      title: "OPA Sleep Magnesium Glycinate Capsules 60ct",
      brand: "OPA Nutrition",
      itemId: "",
      publicWalmartProductId: "",
      publicWalmartUrl: "",
      imageUrl: "",
    };
    const listingA = {
      sourceQuery: "OPA Nutrition",
      page: 1,
      rank: 1,
      title: "OPA Sleep Magnesium Glycinate Capsules 60ct",
      thumbnail: "https://i5.walmartimages.com/asr/a.jpg",
      productPageUrl: "https://www.walmart.com/ip/18410702298",
      usItemId: "18410702298",
      productId: "AAA111",
      upc: "",
      sellerId: "401",
      sellerName: "OPA Nutrition",
      brand: "OPA Nutrition",
      manufacturer: "OPA Nutrition",
      raw: {},
    };

    serpApiMocks.harvestWalmartBrandSearchListingsViaSerpApi.mockResolvedValueOnce({
      ok: true,
      statusCategory: "ok",
      statusReason: "Harvested 2 brand-search public listing candidate(s).",
      query: "OPA Nutrition",
      pagesFetched: 1,
      resultsHarvested: 2,
      listings: [listingA],
    });
    serpApiMocks.matchImportedWalmartProductToBrandSearchListings.mockReturnValueOnce({
      status: "ambiguous",
      confidence: "high",
      score: 80,
      matchedListing: listingA,
      runnerUpListing: {
        ...listingA,
        title: "OPA Sleep Magnesium Glycinate Plus Capsules 60ct",
        usItemId: "18410703333",
        productId: "BBB222",
        productPageUrl: "https://www.walmart.com/ip/18410703333",
      },
      runnerUpScore: 77,
      titleCoverage: 0.82,
      titleJaccard: 0.72,
      keyTokenOverlap: 3,
      exactTitle: false,
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

    expect(serpApiMocks.enrichProductImagesFromPublicWalmartListing).not.toHaveBeenCalled();
    expect(result.products[0]?.publicWalmartProductId).toBe("");
    expect(result.products[0]?.publicWalmartUrl).toBe("");
    expect(result.products[0]?.imageSyncStatus).toBe("ambiguous");
    expect(result.progress.serpApiBrandSearchDiagnostics.serpapi_brand_search_ambiguous).toBe(1);
  });

  it("does not run gallery fallback or persist generic listing when brand search has no confident match", async () => {
    const product = {
      ...createProduct("OPA-NOMATCH-1"),
      title: "OPA Joint Flex Turmeric Daily Capsules 60ct",
      brand: "OPA Nutrition",
      itemId: "",
      publicWalmartProductId: "",
      publicWalmartUrl: "",
      imageUrl: "",
      upc: "850054016119",
      gtin: "0850054016119",
      wpid: "WPID-OPA-1",
    };

    serpApiMocks.harvestWalmartBrandSearchListingsViaSerpApi.mockResolvedValueOnce({
      ok: true,
      statusCategory: "ok",
      statusReason: "Harvested 1 brand-search public listing candidate(s).",
      query: "OPA Nutrition",
      pagesFetched: 1,
      resultsHarvested: 1,
      listings: [],
    });
    serpApiMocks.matchImportedWalmartProductToBrandSearchListings.mockReturnValueOnce({
      status: "no_confident_match",
      confidence: "medium",
      score: 52,
      matchedListing: null,
      runnerUpListing: null,
      runnerUpScore: 0,
      titleCoverage: 0.5,
      titleJaccard: 0.38,
      keyTokenOverlap: 1,
      exactTitle: false,
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

    expect(serpApiMocks.enrichProductImagesFromPublicWalmartListing).not.toHaveBeenCalled();
    expect(result.products[0]?.publicWalmartProductId).toBe("");
    expect(result.products[0]?.publicWalmartUrl).toBe("");
    expect(result.products[0]?.imageSyncStatus).toBe("not_found");
    expect(result.progress.serpApiBrandSearchDiagnostics.serpapi_brand_search_no_confident_match).toBe(1);
  });
});
