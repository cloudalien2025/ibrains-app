import type {
  WalmartProductRecord,
  WalmartSerpApiProviderStatus,
} from "@/lib/ecomviper/walmart/walmart-types";
import { normalizeWalmartImageUrlList } from "@/lib/ecomviper/walmart/walmart-image-fields";
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
  if (status === "provider_error") return 55;
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
    status = "provider_error";
  } else if (input.errorCode === "SERPAPI_NETWORK_ERROR") {
    next.errorCategories.networkErrorCount += 1;
    status = "provider_error";
  } else if (input.errorCode === "SERPAPI_MALFORMED_RESPONSE") {
    next.errorCategories.malformedResponseCount += 1;
    status = "provider_error";
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
    imageMatchMethod: WalmartProductRecord["imageMatchMethod"] | null;
    lastImageSyncedAt: string;
  }
): WalmartProductRecord {
  const issues = stripImageIssues(product.issues);

  if (resolution.imageSyncStatus === "not_found") {
    issues.push("Image not provided by Walmart catalog");
  } else if (resolution.imageSyncStatus === "ambiguous") {
    issues.push("Image match ambiguous");
  } else if (resolution.imageSyncStatus === "failed") {
    issues.push("Image sync failed");
  } else if (resolution.imageSyncStatus === "not_synced") {
    issues.push("Image enrichment not synced");
  }

  const hasImage = Boolean(product.imageUrl.trim());

  return {
    ...product,
    imageStatus: hasImage
      ? "image_available"
      : resolution.imageSyncStatus === "not_synced"
      ? "enrichment_unconfigured"
      : "catalog_missing",
    imageStatusMessage: hasImage ? "Image available" : resolution.statusReason,
    imageSource: hasImage ? product.imageSource : "public_walmart_listing_serpapi",
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
      imageSource: hasImage ? product.imageSource : "public_walmart_listing_serpapi",
      imageSyncStatus: resolution.imageSyncStatus,
      imageMatchMethod: resolution.imageMatchMethod ?? null,
      imageSyncReason: resolution.statusReason,
      publicWalmartUrl: resolution.publicWalmartUrl || null,
      publicWalmartProductId: resolution.publicWalmartProductId || null,
      lastImageSyncedAt: resolution.lastImageSyncedAt,
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

export async function runPublicListingImageEnrichmentQueue(input: {
  userId: string;
  products: WalmartProductRecord[];
  importedCount: number;
  concurrency?: number;
  retries?: number;
}): Promise<WalmartPublicImportEnrichmentResult> {
  const products = [...input.products];
  const now = new Date().toISOString();
  const candidates = products.filter((product) => !product.imageUrl.trim());

  const credentials = await getSerpApiCredentialsForUser(input.userId);

  const progress: WalmartPublicImportEnrichmentProgress = {
    totalProducts: products.length,
    importedCount: input.importedCount,
    enrichmentQueuedCount: candidates.length,
    enrichmentCompletedCount: 0,
    foundCount: 0,
    notFoundCount: 0,
    ambiguousCount: 0,
    failedCount: 0,
    skippedNoProviderCount: 0,
    lastEnrichedAt: candidates.length > 0 ? now : null,
    providerConnected: credentials.connected,
    providerStatus: credentials.status === "connected" ? "connected" : "not_connected",
    providerStatusReason: credentials.statusReason,
    providerCanAttempt: Boolean(credentials.connected && credentials.apiKey),
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
  };

  if (!credentials.connected || !credentials.apiKey) {
    progress.skippedNoProviderCount = candidates.length;
    progress.providerStatus = "not_connected";
    progress.providerStatusReason = "SerpApi key is missing.";
    progress.providerCanAttempt = false;
    return { products, progress };
  }

  const concurrency = Math.max(1, Math.min(6, input.concurrency ?? 2));
  const retries = Math.max(0, Math.min(2, input.retries ?? 2));

  for (let index = 0; index < candidates.length; index += concurrency) {
    const batch = candidates.slice(index, index + concurrency);

    const results = await Promise.all(
      batch.map(async (product) => {
        const resolution = await resolveWithRetry({
          userId: input.userId,
          product,
          retries,
        });
        return { product, resolution };
      })
    );

    for (const { product, resolution } of results) {
      const targetIndex = products.findIndex(
        (entry) => entry.sku.trim().toUpperCase() === product.sku.trim().toUpperCase()
      );
      if (targetIndex < 0) continue;

      progress.enrichmentCompletedCount += 1;

      if (resolution.imageSyncStatus === "found") {
        progress.foundCount += 1;
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
        imageMatchMethod: resolution.imageMatchMethod,
        lastImageSyncedAt: resolution.lastImageSyncedAt,
      });
    }
  }

  progress.lastEnrichedAt = progress.enrichmentCompletedCount > 0 ? new Date().toISOString() : progress.lastEnrichedAt;
  return { products, progress };
}
