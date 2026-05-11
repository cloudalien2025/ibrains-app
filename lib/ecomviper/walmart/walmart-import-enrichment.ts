import type {
  WalmartProductRecord,
  WalmartSerpApiProviderStatus,
} from "@/lib/ecomviper/walmart/walmart-types";
import { normalizeWalmartImageUrlList } from "@/lib/ecomviper/walmart/walmart-image-fields";
import { enrichWalmartImageFromItemSearch } from "@/lib/ecomviper/walmart/walmart-item-search";
import { resolveCanonicalWalmartIdentifierFromProductRecord } from "@/lib/ecomviper/walmart/walmart-public-identifier";
import {
  enrichProductImagesFromPublicWalmartListing,
  getSerpApiCredentialsForUser,
} from "@/lib/ecomviper/walmart/serpapi-walmart-images";

const IMAGE_ISSUES = new Set([
  "Image not provided by Walmart catalog",
  "Image enrichment source not configured",
  "Image not provided by Walmart Item Search",
  "Image match ambiguous",
  "Image sync failed",
  "Image enrichment not synced",
]);
const SERPAPI_ENRICHMENT_RETRY_BACKOFF_MS = [500, 1_300] as const;

type WalmartImageIdentifierPath =
  | "seller_catalog_only"
  | "walmart_search_upc"
  | "walmart_search_gtin"
  | "walmart_search_title_brand"
  | "public_item_id_direct"
  | "serpapi_public_item_id"
  | "serpapi_title_brand_fallback"
  | "skipped_gtin_as_product_id"
  | "walmart_search_not_found"
  | "no_searchable_identifier";

type WalmartImageIdentifierPathCounts = Record<WalmartImageIdentifierPath, number>;

function createIdentifierPathCounts(): WalmartImageIdentifierPathCounts {
  return {
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
  };
}

function stripImageIssues(issues: string[]): string[] {
  return issues.filter((issue) => !IMAGE_ISSUES.has(issue));
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((entry) => entry.trim()).filter(Boolean)));
}

export interface WalmartPublicImportEnrichmentProgress {
  totalProducts: number;
  importedCount: number;
  enrichmentQueuedCount: number;
  enrichmentCompletedCount: number;
  foundCount: number;
  walmartSearchResolvedCount: number;
  walmartSearchImageFoundCount: number;
  serpApiFallbackFoundCount: number;
  walmartSearchNotFoundCount: number;
  notFoundCount: number;
  ambiguousCount: number;
  failedCount: number;
  skippedNoProviderCount: number;
  lastEnrichedAt: string | null;
  providerConnected: boolean;
  providerStatus: WalmartSerpApiProviderStatus;
  providerStatusReason: string | null;
  providerCanAttempt: boolean;
  errorCategories: {
    invalidKeyCount: number;
    forbiddenCount: number;
    rateLimitedCount: number;
    badRequestCount: number;
    providerErrorCount: number;
    networkErrorCount: number;
    malformedResponseCount: number;
    unknownErrorCount: number;
  };
  identifierPathCounts: WalmartImageIdentifierPathCounts;
}

export interface WalmartPublicImportEnrichmentResult {
  products: WalmartProductRecord[];
  progress: WalmartPublicImportEnrichmentProgress;
}

function shouldRetryTransientFailure(errorCode: string | undefined): boolean {
  if (!errorCode) return false;
  return (
    errorCode === "SERPAPI_PROVIDER_ERROR" ||
    errorCode === "SERPAPI_NETWORK_ERROR" ||
    errorCode === "SERPAPI_REQUEST_FAILED"
  );
}

function providerStatusPriority(status: WalmartSerpApiProviderStatus): number {
  if (status === "invalid_key") return 70;
  if (status === "forbidden") return 65;
  if (status === "rate_limited") return 60;
  if (status === "bad_request") return 57;
  if (status === "malformed_response") return 56;
  if (status === "network_error") return 55;
  if (status === "provider_error") return 54;
  if (status === "unknown_error") return 50;
  if (status === "not_connected") return 40;
  return 10;
}

function applyProviderErrorToProgress(input: {
  progress: WalmartPublicImportEnrichmentProgress;
  errorCode?: string;
  statusReason: string;
}) {
  const next = input.progress;
  const reason = input.statusReason.trim() || null;
  let status: WalmartSerpApiProviderStatus = "unknown_error";

  if (input.errorCode === "SERPAPI_INVALID_KEY" || input.errorCode === "SERPAPI_AUTH_FAILED") {
    next.errorCategories.invalidKeyCount += 1;
    status = "invalid_key";
  } else if (input.errorCode === "SERPAPI_FORBIDDEN") {
    next.errorCategories.forbiddenCount += 1;
    status = "forbidden";
  } else if (input.errorCode === "SERPAPI_RATE_LIMITED") {
    next.errorCategories.rateLimitedCount += 1;
    status = "rate_limited";
  } else if (input.errorCode === "SERPAPI_BAD_REQUEST") {
    next.errorCategories.badRequestCount += 1;
    status = "bad_request";
  } else if (input.errorCode === "SERPAPI_NETWORK_ERROR") {
    next.errorCategories.networkErrorCount += 1;
    status = "network_error";
  } else if (input.errorCode === "SERPAPI_MALFORMED_RESPONSE") {
    next.errorCategories.malformedResponseCount += 1;
    status = "malformed_response";
  } else if (
    input.errorCode === "SERPAPI_PROVIDER_ERROR" ||
    input.errorCode === "SERPAPI_REQUEST_FAILED"
  ) {
    next.errorCategories.providerErrorCount += 1;
    status = "provider_error";
  } else {
    next.errorCategories.unknownErrorCount += 1;
    status = "unknown_error";
  }

  if (providerStatusPriority(status) >= providerStatusPriority(next.providerStatus)) {
    next.providerStatus = status;
    next.providerStatusReason = reason;
  }
}

function applyFoundPublicListingImages(
  product: WalmartProductRecord,
  resolution: {
    primaryImageUrl: string;
    galleryImageUrls: string[];
    variantImageUrls: string[];
    publicWalmartUrl: string;
    publicWalmartProductId: string;
    imageMatchMethod: WalmartProductRecord["imageMatchMethod"] | null;
    statusReason: string;
    lastImageSyncedAt: string;
  }
): WalmartProductRecord {
  const primaryImageUrl =
    normalizeWalmartImageUrlList([resolution.primaryImageUrl, product.imageUrl])[0] ?? "";

  const galleryImageUrls = normalizeWalmartImageUrlList([
    primaryImageUrl,
    ...(product.galleryImageUrls ?? []),
    ...resolution.galleryImageUrls,
  ]);

  return {
    ...product,
    imageUrl: primaryImageUrl,
    primaryImageUrl,
    galleryImageUrls,
    variantImageUrls: normalizeWalmartImageUrlList([
      ...(product.variantImageUrls ?? []),
      ...resolution.variantImageUrls,
    ]),
    imageStatus: "image_available",
    imageStatusMessage: "Image available",
    imageSource: "public_walmart_listing_serpapi",
    imageSyncStatus: "found",
    imageMatchMethod: resolution.imageMatchMethod ?? product.imageMatchMethod,
    imageSyncReason: resolution.statusReason,
    publicWalmartUrl: resolution.publicWalmartUrl || product.publicWalmartUrl,
    publicWalmartProductId: resolution.publicWalmartProductId || product.publicWalmartProductId,
    lastImageSyncedAt: resolution.lastImageSyncedAt,
    issues: stripImageIssues(product.issues),
    normalizedPayload: {
      ...((product.normalizedPayload as Record<string, unknown>) ?? {}),
      imageUrl: primaryImageUrl,
      primaryImageUrl,
      galleryImageUrls,
      imageStatus: "image_available",
      imageStatusMessage: "Image available",
      imageSource: "public_walmart_listing_serpapi",
      imageSyncStatus: "found",
      imageMatchMethod: resolution.imageMatchMethod ?? null,
      imageSyncReason: resolution.statusReason,
      publicWalmartUrl: resolution.publicWalmartUrl || null,
      publicWalmartProductId: resolution.publicWalmartProductId || null,
      lastImageSyncedAt: resolution.lastImageSyncedAt,
    },
  };
}

function applyNonFoundResolution(
  product: WalmartProductRecord,
  resolution: {
    imageSyncStatus: WalmartProductRecord["imageSyncStatus"];
    statusReason: string;
    publicWalmartUrl: string;
    publicWalmartProductId: string;
    imageSource?: WalmartProductRecord["imageSource"];
    imageMatchMethod: WalmartProductRecord["imageMatchMethod"] | null;
    lastImageSyncedAt: string;
  }
): WalmartProductRecord {
  const issues = stripImageIssues(product.issues);

  if (resolution.imageSyncStatus === "not_found") {
    issues.push(
      resolution.imageSource === "walmart_item_search"
        ? "Image not provided by Walmart Item Search"
        : "Image not provided by Walmart catalog"
    );
  } else if (resolution.imageSyncStatus === "ambiguous") {
    issues.push("Image match ambiguous");
  } else if (resolution.imageSyncStatus === "failed") {
    issues.push("Image sync failed");
  } else if (resolution.imageSyncStatus === "not_synced") {
    issues.push("Image enrichment not synced");
  }

  const hasImage = Boolean(product.imageUrl.trim());

  const resolvedImageSource =
    (hasImage ? product.imageSource : resolution.imageSource ?? product.imageSource) ??
    "public_walmart_listing_serpapi";

  return {
    ...product,
    imageStatus: hasImage
      ? "image_available"
      : resolution.imageSyncStatus === "not_synced"
      ? "enrichment_unconfigured"
      : "catalog_missing",
    imageStatusMessage: hasImage ? "Image available" : resolution.statusReason,
    imageSource: resolvedImageSource,
    imageSyncStatus: resolution.imageSyncStatus,
    imageMatchMethod: resolution.imageMatchMethod ?? product.imageMatchMethod,
    imageSyncReason: resolution.statusReason,
    publicWalmartUrl: resolution.publicWalmartUrl || product.publicWalmartUrl,
    publicWalmartProductId: resolution.publicWalmartProductId || product.publicWalmartProductId,
    lastImageSyncedAt: resolution.lastImageSyncedAt,
    issues: unique(issues),
    normalizedPayload: {
      ...((product.normalizedPayload as Record<string, unknown>) ?? {}),
      imageStatus: hasImage
        ? "image_available"
        : resolution.imageSyncStatus === "not_synced"
        ? "enrichment_unconfigured"
        : "catalog_missing",
      imageStatusMessage: hasImage ? "Image available" : resolution.statusReason,
      imageSource: resolvedImageSource,
      imageSyncStatus: resolution.imageSyncStatus,
      imageMatchMethod: resolution.imageMatchMethod ?? null,
      imageSyncReason: resolution.statusReason,
      publicWalmartUrl: resolution.publicWalmartUrl || null,
      publicWalmartProductId: resolution.publicWalmartProductId || null,
      lastImageSyncedAt: resolution.lastImageSyncedAt,
    },
  };
}

function asString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function derivePublicWalmartUrl(productId: string): string {
  const trimmed = productId.trim();
  if (!trimmed) return "";
  return `https://www.walmart.com/ip/${trimmed}`;
}

function patchIdentifierMetadata(input: {
  product: WalmartProductRecord;
  publicWalmartProductId: string;
  publicWalmartUrl: string;
  path: WalmartImageIdentifierPath;
}): WalmartProductRecord {
  const normalizedPayload =
    input.product.normalizedPayload && typeof input.product.normalizedPayload === "object"
      ? (input.product.normalizedPayload as Record<string, unknown>)
      : {};

  return {
    ...input.product,
    itemId: input.publicWalmartProductId || input.product.itemId,
    publicWalmartProductId: input.publicWalmartProductId || input.product.publicWalmartProductId,
    publicWalmartUrl: input.publicWalmartUrl || input.product.publicWalmartUrl,
    normalizedPayload: {
      ...normalizedPayload,
      itemId: input.publicWalmartProductId || normalizedPayload.itemId || null,
      publicWalmartProductId: input.publicWalmartProductId || normalizedPayload.publicWalmartProductId || null,
      publicWalmartUrl: input.publicWalmartUrl || normalizedPayload.publicWalmartUrl || null,
      imageIdentifierPath: input.path,
    },
  };
}

function pathFromWalmartItemSearchResolution(
  resolution: Awaited<ReturnType<typeof enrichWalmartImageFromItemSearch>>
): WalmartImageIdentifierPath {
  if (resolution.matchMethod === "upc") return "walmart_search_upc";
  if (resolution.matchMethod === "gtin") return "walmart_search_gtin";
  if (resolution.matchMethod === "query") return "walmart_search_title_brand";
  if (resolution.matchMethod === "itemId" || resolution.matchMethod === "wpid") return "public_item_id_direct";
  if (resolution.imageSyncStatus === "not_found" || resolution.imageSyncStatus === "ambiguous") {
    return "walmart_search_not_found";
  }
  return "no_searchable_identifier";
}

function pathFromSerpApiResolution(
  resolution: Awaited<ReturnType<typeof enrichProductImagesFromPublicWalmartListing>>
): WalmartImageIdentifierPath {
  const identifierType = asString(resolution.diagnostics?.productIdentifierType);
  if (
    identifierType === "upc_skipped_for_product_lookup" ||
    identifierType === "gtin_skipped_for_product_lookup"
  ) {
    return "skipped_gtin_as_product_id";
  }
  if (resolution.imageMatchMethod === "serpapi_search_title_brand") {
    return "serpapi_title_brand_fallback";
  }
  if (
    resolution.imageMatchMethod === "serpapi_product_id" ||
    resolution.imageMatchMethod === "public_url_product_id"
  ) {
    return "serpapi_public_item_id";
  }
  if (identifierType === "missing_product_identifier") {
    return "no_searchable_identifier";
  }
  return "serpapi_public_item_id";
}

function incrementPathCount(
  counts: WalmartImageIdentifierPathCounts,
  path: WalmartImageIdentifierPath
): void {
  counts[path] += 1;
}

function applyFoundWalmartItemSearchImages(
  product: WalmartProductRecord,
  resolution: {
    primaryImageUrl: string;
    galleryImageUrls: string[];
    variantImageUrls: string[];
    publicWalmartUrl: string;
    publicWalmartProductId: string;
    imageMatchMethod: WalmartProductRecord["imageMatchMethod"] | null;
    statusReason: string;
    lastImageSyncedAt: string;
    identifierPath: WalmartImageIdentifierPath;
  }
): WalmartProductRecord {
  const primaryImageUrl = normalizeWalmartImageUrlList([resolution.primaryImageUrl, product.imageUrl])[0] ?? "";

  const galleryImageUrls = normalizeWalmartImageUrlList([
    primaryImageUrl,
    ...(product.galleryImageUrls ?? []),
    ...resolution.galleryImageUrls,
  ]);

  const normalizedPayload =
    product.normalizedPayload && typeof product.normalizedPayload === "object"
      ? (product.normalizedPayload as Record<string, unknown>)
      : {};

  return {
    ...product,
    itemId: resolution.publicWalmartProductId || product.itemId,
    imageUrl: primaryImageUrl,
    primaryImageUrl,
    galleryImageUrls,
    variantImageUrls: normalizeWalmartImageUrlList([
      ...(product.variantImageUrls ?? []),
      ...resolution.variantImageUrls,
    ]),
    imageStatus: "image_available",
    imageStatusMessage: "Image available",
    imageSource: "walmart_item_search",
    imageSyncStatus: "found",
    imageMatchMethod: resolution.imageMatchMethod ?? product.imageMatchMethod,
    imageSyncReason: resolution.statusReason,
    publicWalmartUrl: resolution.publicWalmartUrl || product.publicWalmartUrl,
    publicWalmartProductId: resolution.publicWalmartProductId || product.publicWalmartProductId,
    lastImageSyncedAt: resolution.lastImageSyncedAt,
    issues: stripImageIssues(product.issues),
    normalizedPayload: {
      ...normalizedPayload,
      itemId: resolution.publicWalmartProductId || normalizedPayload.itemId || null,
      imageUrl: primaryImageUrl,
      primaryImageUrl,
      galleryImageUrls,
      imageStatus: "image_available",
      imageStatusMessage: "Image available",
      imageSource: "walmart_item_search",
      imageSyncStatus: "found",
      imageMatchMethod: resolution.imageMatchMethod ?? null,
      imageSyncReason: resolution.statusReason,
      publicWalmartUrl: resolution.publicWalmartUrl || normalizedPayload.publicWalmartUrl || null,
      publicWalmartProductId: resolution.publicWalmartProductId || normalizedPayload.publicWalmartProductId || null,
      imageIdentifierPath: resolution.identifierPath,
      lastImageSyncedAt: resolution.lastImageSyncedAt,
    },
  };
}

function applyWalmartItemSearchNonFoundResolution(
  product: WalmartProductRecord,
  resolution: Awaited<ReturnType<typeof enrichWalmartImageFromItemSearch>>,
  identifierPath: WalmartImageIdentifierPath
): WalmartProductRecord {
  const publicWalmartProductId =
    asString(resolution.matchedItemId) || asString(product.publicWalmartProductId) || asString(product.itemId);
  const publicWalmartUrl = asString(product.publicWalmartUrl) || derivePublicWalmartUrl(publicWalmartProductId);
  const patched = patchIdentifierMetadata({
    product,
    publicWalmartProductId,
    publicWalmartUrl,
    path: identifierPath,
  });

  const next = applyNonFoundResolution(patched, {
    imageSyncStatus: resolution.imageSyncStatus,
    statusReason: resolution.statusReason,
    publicWalmartUrl,
    publicWalmartProductId,
    imageSource: "walmart_item_search",
    imageMatchMethod: resolution.matchMethod,
    lastImageSyncedAt: resolution.lastImageSyncedAt,
  });

  const normalizedPayload =
    next.normalizedPayload && typeof next.normalizedPayload === "object"
      ? (next.normalizedPayload as Record<string, unknown>)
      : {};

  return {
    ...next,
    normalizedPayload: {
      ...normalizedPayload,
      imageIdentifierPath: identifierPath,
    },
  };
}

async function resolveWithRetry(input: {
  userId: string;
  product: WalmartProductRecord;
  retries: number;
}): Promise<Awaited<ReturnType<typeof enrichProductImagesFromPublicWalmartListing>>> {
  let attempt = 0;
  let last = await enrichProductImagesFromPublicWalmartListing({
    userId: input.userId,
    product: input.product,
  });

  while (
    attempt < input.retries &&
    last.imageSyncStatus === "failed" &&
    shouldRetryTransientFailure(last.errorCode)
  ) {
    const delay = SERPAPI_ENRICHMENT_RETRY_BACKOFF_MS[Math.min(attempt, SERPAPI_ENRICHMENT_RETRY_BACKOFF_MS.length - 1)];
    attempt += 1;
    await new Promise((resolve) => setTimeout(resolve, delay));
    last = await enrichProductImagesFromPublicWalmartListing({
      userId: input.userId,
      product: input.product,
    });
  }

  return last;
}

async function resolveWithWalmartItemSearch(input: {
  accessToken: string;
  product: WalmartProductRecord;
}): Promise<Awaited<ReturnType<typeof enrichWalmartImageFromItemSearch>>> {
  const resolved = resolveCanonicalWalmartIdentifierFromProductRecord({ product: input.product });
  const preferredItemId =
    resolved.preferredWalmartProductId || asString(input.product.itemId) || asString(input.product.publicWalmartProductId);
  const hasPreferredItemId = Boolean(preferredItemId);

  return enrichWalmartImageFromItemSearch({
    accessToken: input.accessToken,
    product: {
      upc: hasPreferredItemId ? "" : asString(input.product.upc),
      gtin: hasPreferredItemId ? "" : asString(input.product.gtin),
      itemId: preferredItemId,
      wpid: asString(input.product.wpid),
      title: asString(input.product.title),
      brand: asString(input.product.brand),
    },
  });
}

export async function runPublicListingImageEnrichmentQueue(input: {
  userId: string;
  products: WalmartProductRecord[];
  importedCount: number;
  accessToken?: string;
  concurrency?: number;
  retries?: number;
}): Promise<WalmartPublicImportEnrichmentResult> {
  const products = [...input.products];
  const now = new Date().toISOString();
  const candidates = products.filter(
    (product) => !product.imageUrl.trim() || !asString(product.publicWalmartProductId)
  );

  const progress: WalmartPublicImportEnrichmentProgress = {
    totalProducts: products.length,
    importedCount: input.importedCount,
    enrichmentQueuedCount: candidates.length,
    enrichmentCompletedCount: 0,
    foundCount: 0,
    walmartSearchResolvedCount: 0,
    walmartSearchImageFoundCount: 0,
    serpApiFallbackFoundCount: 0,
    walmartSearchNotFoundCount: 0,
    notFoundCount: 0,
    ambiguousCount: 0,
    failedCount: 0,
    skippedNoProviderCount: 0,
    lastEnrichedAt: candidates.length > 0 ? now : null,
    providerConnected: false,
    providerStatus: "not_connected",
    providerStatusReason: null,
    providerCanAttempt: false,
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
    identifierPathCounts: createIdentifierPathCounts(),
  };

  const concurrency = Math.max(1, Math.min(6, input.concurrency ?? 2));
  const retries = Math.max(0, Math.min(2, input.retries ?? 2));
  const unresolvedForSerpApi: WalmartProductRecord[] = [];

  for (let index = 0; index < candidates.length; index += concurrency) {
    const batch = candidates.slice(index, index + concurrency);
    const walmartSearchResults = await Promise.all(
      batch.map(async (product) => {
        const canonical = resolveCanonicalWalmartIdentifierFromProductRecord({ product });
        const canonicalProductId =
          asString(canonical.preferredWalmartProductId) ||
          asString(product.publicWalmartProductId) ||
          asString(product.itemId);
        const canonicalPublicWalmartUrl =
          asString(canonical.normalizedPublicWalmartUrl) ||
          asString(product.publicWalmartUrl) ||
          derivePublicWalmartUrl(canonicalProductId);
        const basePath = product.imageUrl.trim() ? "seller_catalog_only" : "no_searchable_identifier";

        const repaired = patchIdentifierMetadata({
          product,
          publicWalmartProductId: canonicalProductId,
          publicWalmartUrl: canonicalPublicWalmartUrl,
          path: basePath,
        });

        if (!input.accessToken || repaired.imageUrl.trim()) {
          return {
            product,
            repairedProduct: repaired,
            itemSearchResolution: null,
            path: basePath,
          } as const;
        }

        try {
          const itemSearchResolution = await resolveWithWalmartItemSearch({
            accessToken: input.accessToken,
            product: repaired,
          });
          const path = pathFromWalmartItemSearchResolution(itemSearchResolution);
          return {
            product,
            repairedProduct: repaired,
            itemSearchResolution,
            path,
          } as const;
        } catch {
          const itemSearchResolution: Awaited<ReturnType<typeof enrichWalmartImageFromItemSearch>> = {
            imageSyncStatus: "failed",
            imageSource: "walmart_item_search",
            statusReason: "Item Search request failed after retry.",
            primaryImageUrl: "",
            galleryImageUrls: [],
            variantImageUrls: [],
            matchedItemId: null,
            matchMethod: null,
            lastImageSyncedAt: new Date().toISOString(),
            diagnostics: {
              attempts: [],
              decision: {
                outcome: "failed",
                reason: "Item Search request failed after retry.",
                matchMethod: null,
                candidateCount: 0,
                selectedScore: null,
                runnerUpScore: null,
                acceptedBy: "none",
              },
            },
          };
          return {
            product,
            repairedProduct: repaired,
            itemSearchResolution,
            path: "walmart_search_not_found" as const,
          };
        }
      })
    );

    for (const result of walmartSearchResults) {
      const targetIndex = products.findIndex(
        (entry) => entry.sku.trim().toUpperCase() === result.product.sku.trim().toUpperCase()
      );
      if (targetIndex < 0) continue;

      const enriched = result.itemSearchResolution;
      if (!enriched) {
        products[targetIndex] = result.repairedProduct;
        if (result.repairedProduct.imageUrl.trim()) {
          progress.enrichmentCompletedCount += 1;
          incrementPathCount(progress.identifierPathCounts, result.path);
        } else {
          unresolvedForSerpApi.push(result.repairedProduct);
        }
        continue;
      }

      const resolvedProductId =
        asString(enriched.matchedItemId) ||
        asString(result.repairedProduct.publicWalmartProductId) ||
        asString(result.repairedProduct.itemId);
      const resolvedPublicWalmartUrl =
        asString(result.repairedProduct.publicWalmartUrl) || derivePublicWalmartUrl(resolvedProductId);
      const repairedForSearch = patchIdentifierMetadata({
        product: result.repairedProduct,
        publicWalmartProductId: resolvedProductId,
        publicWalmartUrl: resolvedPublicWalmartUrl,
        path: result.path,
      });
      incrementPathCount(progress.identifierPathCounts, result.path);

      if (enriched.imageSyncStatus === "found") {
        products[targetIndex] = applyFoundWalmartItemSearchImages(repairedForSearch, {
          primaryImageUrl: enriched.primaryImageUrl,
          galleryImageUrls: enriched.galleryImageUrls,
          variantImageUrls: enriched.variantImageUrls,
          publicWalmartProductId: resolvedProductId,
          publicWalmartUrl: resolvedPublicWalmartUrl,
          imageMatchMethod: enriched.matchMethod,
          statusReason: enriched.statusReason,
          lastImageSyncedAt: enriched.lastImageSyncedAt,
          identifierPath: result.path,
        });
        progress.enrichmentCompletedCount += 1;
        progress.foundCount += 1;
        progress.walmartSearchResolvedCount += 1;
        progress.walmartSearchImageFoundCount += 1;
        continue;
      }

      if (enriched.imageSyncStatus === "not_found") {
        progress.walmartSearchNotFoundCount += 1;
      }

      const nonFoundProduct = applyWalmartItemSearchNonFoundResolution(
        repairedForSearch,
        enriched,
        result.path
      );
      products[targetIndex] = nonFoundProduct;
      unresolvedForSerpApi.push(nonFoundProduct);
    }
  }

  if (unresolvedForSerpApi.length === 0) {
    progress.lastEnrichedAt = progress.enrichmentCompletedCount > 0 ? new Date().toISOString() : progress.lastEnrichedAt;
    return { products, progress };
  }

  const credentials = await getSerpApiCredentialsForUser(input.userId);
  progress.providerConnected = credentials.connected;
  progress.providerStatus = credentials.status === "connected" ? "connected" : "not_connected";
  progress.providerStatusReason = credentials.statusReason;
  progress.providerCanAttempt = Boolean(credentials.connected && credentials.apiKey);

  if (!credentials.connected || !credentials.apiKey) {
    progress.skippedNoProviderCount = unresolvedForSerpApi.length;
    progress.providerStatus = "not_connected";
    progress.providerStatusReason = "SerpApi key is missing.";
    progress.providerCanAttempt = false;
    for (const unresolved of unresolvedForSerpApi) {
      const targetIndex = products.findIndex(
        (entry) => entry.sku.trim().toUpperCase() === unresolved.sku.trim().toUpperCase()
      );
      if (targetIndex < 0) continue;
      const unresolvedPathRaw =
        unresolved.normalizedPayload && typeof unresolved.normalizedPayload === "object"
          ? (unresolved.normalizedPayload as Record<string, unknown>).imageIdentifierPath
          : null;
      const unresolvedPath =
        unresolvedPathRaw === "seller_catalog_only" ||
        unresolvedPathRaw === "walmart_search_upc" ||
        unresolvedPathRaw === "walmart_search_gtin" ||
        unresolvedPathRaw === "walmart_search_title_brand" ||
        unresolvedPathRaw === "public_item_id_direct" ||
        unresolvedPathRaw === "serpapi_public_item_id" ||
        unresolvedPathRaw === "serpapi_title_brand_fallback" ||
        unresolvedPathRaw === "skipped_gtin_as_product_id" ||
        unresolvedPathRaw === "walmart_search_not_found" ||
        unresolvedPathRaw === "no_searchable_identifier"
          ? unresolvedPathRaw
          : "seller_catalog_only";
      incrementPathCount(progress.identifierPathCounts, unresolvedPath);
      progress.enrichmentCompletedCount += 1;
      products[targetIndex] = applyNonFoundResolution(unresolved, {
        imageSyncStatus: unresolved.imageSyncStatus ?? "not_synced",
        statusReason:
          asString(unresolved.imageSyncReason) ||
          unresolved.imageStatusMessage ||
          "SerpApi key is missing. Connect SerpApi to enable automated public Walmart image enrichment.",
        publicWalmartUrl: asString(unresolved.publicWalmartUrl),
        publicWalmartProductId: asString(unresolved.publicWalmartProductId),
        imageSource: unresolved.imageSource ?? "walmart_item_search",
        imageMatchMethod: unresolved.imageMatchMethod ?? null,
        lastImageSyncedAt: new Date().toISOString(),
      });

      if (unresolved.imageSyncStatus === "not_found") progress.notFoundCount += 1;
      else if (unresolved.imageSyncStatus === "ambiguous") progress.ambiguousCount += 1;
      else if (unresolved.imageSyncStatus === "failed") progress.failedCount += 1;
      else progress.notFoundCount += 1;
    }
    progress.lastEnrichedAt = progress.enrichmentCompletedCount > 0 ? new Date().toISOString() : progress.lastEnrichedAt;
    return { products, progress };
  }

  for (let index = 0; index < unresolvedForSerpApi.length; index += concurrency) {
    const batch = unresolvedForSerpApi.slice(index, index + concurrency);

    const results = await Promise.all(
      batch.map(async (product) => {
        try {
          const resolution = await resolveWithRetry({
            userId: input.userId,
            product,
            retries,
          });
          return { product, resolution };
        } catch (error) {
          return {
            product,
            resolution: {
              imageSyncStatus: "failed" as const,
              imageSource: "public_walmart_listing_serpapi" as const,
              statusReason:
                error instanceof Error && error.message.trim().length > 0
                  ? error.message
                  : "Public Walmart listing enrichment failed.",
              imageMatchMethod: null,
              publicWalmartUrl: product.publicWalmartUrl ?? "",
              publicWalmartProductId: product.publicWalmartProductId ?? "",
              primaryImageUrl: "",
              galleryImageUrls: [],
              variantImageUrls: [],
              lastImageSyncedAt: new Date().toISOString(),
              diagnostics: {
                provider: "serpapi" as const,
                endpointFamily: "walmart_search" as const,
                statusCategory: "provider_error" as const,
                productId: product.publicWalmartProductId ?? null,
                candidateCount: 0,
                imageCount: 0,
                matchMethod: null,
              },
              errorCode: "SERPAPI_REQUEST_FAILED" as const,
            },
          };
        }
      })
    );

    for (const { product, resolution } of results) {
      const targetIndex = products.findIndex(
        (entry) => entry.sku.trim().toUpperCase() === product.sku.trim().toUpperCase()
      );
      if (targetIndex < 0) continue;

      progress.enrichmentCompletedCount += 1;
      const identifierPath = pathFromSerpApiResolution(resolution);
      incrementPathCount(progress.identifierPathCounts, identifierPath);

      if (resolution.imageSyncStatus === "found") {
        progress.foundCount += 1;
        progress.serpApiFallbackFoundCount += 1;
        products[targetIndex] = applyFoundPublicListingImages(products[targetIndex], {
          primaryImageUrl: resolution.primaryImageUrl,
          galleryImageUrls: resolution.galleryImageUrls,
          variantImageUrls: resolution.variantImageUrls,
          publicWalmartUrl: resolution.publicWalmartUrl,
          publicWalmartProductId: resolution.publicWalmartProductId,
          imageMatchMethod: resolution.imageMatchMethod,
          statusReason: resolution.statusReason,
          lastImageSyncedAt: resolution.lastImageSyncedAt,
        });
        const normalizedPayload =
          products[targetIndex]?.normalizedPayload && typeof products[targetIndex]?.normalizedPayload === "object"
            ? (products[targetIndex]?.normalizedPayload as Record<string, unknown>)
            : {};
        products[targetIndex] = {
          ...products[targetIndex],
          normalizedPayload: {
            ...normalizedPayload,
            imageIdentifierPath: identifierPath,
          },
        };
        continue;
      }

      if (resolution.imageSyncStatus === "not_found") progress.notFoundCount += 1;
      else if (resolution.imageSyncStatus === "ambiguous") progress.ambiguousCount += 1;
      else if (resolution.imageSyncStatus === "failed") {
        progress.failedCount += 1;
        applyProviderErrorToProgress({
          progress,
          errorCode: resolution.errorCode,
          statusReason: resolution.statusReason,
        });
      }

      products[targetIndex] = applyNonFoundResolution(products[targetIndex], {
        imageSyncStatus: resolution.imageSyncStatus,
        statusReason: resolution.statusReason,
        publicWalmartUrl: resolution.publicWalmartUrl,
        publicWalmartProductId: resolution.publicWalmartProductId,
        imageSource: "public_walmart_listing_serpapi",
        imageMatchMethod: resolution.imageMatchMethod,
        lastImageSyncedAt: resolution.lastImageSyncedAt,
      });
      const normalizedPayload =
        products[targetIndex]?.normalizedPayload && typeof products[targetIndex]?.normalizedPayload === "object"
          ? (products[targetIndex]?.normalizedPayload as Record<string, unknown>)
          : {};
      products[targetIndex] = {
        ...products[targetIndex],
        normalizedPayload: {
          ...normalizedPayload,
          imageIdentifierPath: identifierPath,
        },
      };
    }
  }

  progress.lastEnrichedAt = progress.enrichmentCompletedCount > 0 ? new Date().toISOString() : progress.lastEnrichedAt;
  return { products, progress };
}
