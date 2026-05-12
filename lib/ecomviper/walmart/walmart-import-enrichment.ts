import type {
  WalmartProductRecord,
  WalmartSerpApiProviderStatus,
} from "@/lib/ecomviper/walmart/walmart-types";
import { normalizeWalmartImageUrlList } from "@/lib/ecomviper/walmart/walmart-image-fields";
import { enrichWalmartImageFromItemSearch } from "@/lib/ecomviper/walmart/walmart-item-search";
import { resolveCanonicalWalmartIdentifierFromProductRecord } from "@/lib/ecomviper/walmart/walmart-public-identifier";
import {
  enrichProductImagesFromPublicWalmartListing,
  harvestWalmartBrandSearchListingsViaSerpApi,
  getSerpApiCredentialsForUser,
  matchImportedWalmartProductToBrandSearchListings,
  type SerpApiWalmartBrandSearchListing,
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
const SERPAPI_BRAND_DISCOVERY_DEFAULT_QUERY = "OPA Nutrition";
const SERPAPI_PER_PRODUCT_SEARCH_MAX_PER_RUN_DEFAULT = 8;
const SERPAPI_PER_PRODUCT_SEARCH_MAX_PER_RUN_LIMIT = 40;
const SERPAPI_PER_PRODUCT_QUERY_MAX_TOKENS = 7;
const SERPAPI_PER_PRODUCT_TITLE_NOISE_TOKENS = new Set([
  "with",
  "and",
  "for",
  "the",
  "daily",
  "support",
  "capsule",
  "capsules",
  "tablet",
  "tablets",
  "gummy",
  "gummies",
  "count",
  "ct",
  "pack",
  "formula",
  "blend",
]);

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

function createSerpApiProductGalleryDiagnostics() {
  return {
    serpapi_product_gallery_checked: 0,
    serpapi_product_gallery_primary_found: 0,
    serpapi_product_gallery_additional_found: 0,
    serpapi_product_gallery_no_images: 0,
    skipped_no_verified_public_listing: 0,
    skipped_non_public_identifier: 0,
    skipped_gtin_as_product_id: 0,
  };
}

function createSerpApiBrandSearchDiagnostics() {
  return {
    serpapi_brand_search_checked: 0,
    serpapi_brand_search_results_harvested: 0,
    serpapi_brand_search_public_listing_matched: 0,
    serpapi_brand_search_thumbnail_saved: 0,
    serpapi_brand_search_ambiguous: 0,
    serpapi_brand_search_no_confident_match: 0,
  };
}

function createWalmartItemSearchDiagnostics() {
  return {
    walmart_item_search_exact_identifier_match: 0,
    walmart_item_search_identifier_normalized_match: 0,
    walmart_item_search_identifier_assisted_match: 0,
    walmart_item_search_multiple_candidates_rejected: 0,
    walmart_item_search_single_candidate_no_image: 0,
  };
}

function createSerpApiPerProductDiagnostics() {
  return {
    serpapi_per_product_searches_attempted: 0,
    serpapi_per_product_matches: 0,
    serpapi_per_product_thumbnails_saved: 0,
    no_confident_match_continued_to_fallback: 0,
    ambiguous_continued_to_fallback: 0,
    ambiguous_skipped: 0,
  };
}

type WalmartEnrichmentMethod =
  | "walmart_item_search"
  | "serpapi_brand_search"
  | "serpapi_per_product_search"
  | "serpapi_product_gallery";

type WalmartEnrichmentFinalStatus = "found" | "not_found" | "ambiguous" | "failed" | "not_synced";

interface WalmartPerProductAttemptDiagnostic {
  sku: string;
  title: string;
  attemptedMethods: WalmartEnrichmentMethod[];
  queryUsed: string | null;
  resultCount: number;
  topCandidateTitle: string | null;
  topCandidateItemOrProductId: string | null;
  rejectionReason: string | null;
  finalStatus: WalmartEnrichmentFinalStatus;
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
  serpApiProductGalleryFoundCount: number;
  serpApiSearchFallbackFoundCount: number;
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
  serpApiProductGalleryDiagnostics: {
    serpapi_product_gallery_checked: number;
    serpapi_product_gallery_primary_found: number;
    serpapi_product_gallery_additional_found: number;
    serpapi_product_gallery_no_images: number;
    skipped_no_verified_public_listing: number;
    skipped_non_public_identifier: number;
    skipped_gtin_as_product_id: number;
  };
  serpApiBrandSearchDiagnostics: {
    serpapi_brand_search_checked: number;
    serpapi_brand_search_results_harvested: number;
    serpapi_brand_search_public_listing_matched: number;
    serpapi_brand_search_thumbnail_saved: number;
    serpapi_brand_search_ambiguous: number;
    serpapi_brand_search_no_confident_match: number;
  };
  walmartItemSearchDiagnostics: {
    walmart_item_search_exact_identifier_match: number;
    walmart_item_search_identifier_normalized_match: number;
    walmart_item_search_identifier_assisted_match: number;
    walmart_item_search_multiple_candidates_rejected: number;
    walmart_item_search_single_candidate_no_image: number;
  };
  serpApiPerProductDiagnostics: {
    serpapi_per_product_searches_attempted: number;
    serpapi_per_product_matches: number;
    serpapi_per_product_thumbnails_saved: number;
    no_confident_match_continued_to_fallback: number;
    ambiguous_continued_to_fallback: number;
    ambiguous_skipped: number;
  };
  perProductAttemptDiagnostics: WalmartPerProductAttemptDiagnostic[];
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
    endpointFamily?: "walmart_product" | "walmart_search";
    productPageUrl?: string;
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
      serpApiEndpointFamily: resolution.endpointFamily ?? null,
      serpApiProductPageUrl: resolution.productPageUrl ?? null,
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

function normalizeText(value: string): string {
  return asString(value)
    .toLowerCase()
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function deriveBrandSearchQuery(products: WalmartProductRecord[]): string {
  const hasOpaSignal = products.some((product) => {
    const haystack = normalizeText(`${asString(product.brand)} ${asString(product.title)}`);
    return haystack.includes("opa");
  });
  if (hasOpaSignal) {
    return SERPAPI_BRAND_DISCOVERY_DEFAULT_QUERY;
  }
  return "";
}

function toSkuKey(sku: string): string {
  return sku.trim().toUpperCase();
}

function isPerProductTitleNoiseToken(token: string): boolean {
  if (!token) return true;
  if (SERPAPI_PER_PRODUCT_TITLE_NOISE_TOKENS.has(token)) return true;
  if (/^\d+$/.test(token)) return true;
  if (/^\d+(ct|count|mg|ml|oz)$/i.test(token)) return true;
  return false;
}

function rawWordTokens(value: string): string[] {
  return asString(value)
    .replace(/[\u2010-\u2015]/g, " ")
    .split(/[^a-zA-Z0-9]+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function buildPerProductSerpApiQuery(product: WalmartProductRecord): string {
  const brandTokens = rawWordTokens(asString(product.brand));
  const titleTokens = rawWordTokens(asString(product.title));
  const used = new Set<string>();
  const output: string[] = [];

  for (const token of brandTokens) {
    const key = token.toLowerCase();
    if (!key || used.has(key)) continue;
    used.add(key);
    output.push(token);
    if (output.length >= SERPAPI_PER_PRODUCT_QUERY_MAX_TOKENS) {
      return output.join(" ").trim();
    }
  }

  for (const token of titleTokens) {
    const key = token.toLowerCase();
    if (!key || used.has(key) || isPerProductTitleNoiseToken(key)) continue;
    used.add(key);
    output.push(token);
    if (output.length >= SERPAPI_PER_PRODUCT_QUERY_MAX_TOKENS) break;
  }

  return output.join(" ").trim();
}

function resolvePerProductSerpApiSearchLimit(value: number | undefined, queuedCount: number): number {
  const parsed =
    typeof value === "number" && Number.isFinite(value)
      ? Math.trunc(value)
      : SERPAPI_PER_PRODUCT_SEARCH_MAX_PER_RUN_DEFAULT;
  const bounded = Math.max(1, Math.min(SERPAPI_PER_PRODUCT_SEARCH_MAX_PER_RUN_LIMIT, parsed));
  return Math.min(bounded, Math.max(1, queuedCount));
}

function createEmptyPerProductAttemptDiagnostic(product: WalmartProductRecord): WalmartPerProductAttemptDiagnostic {
  return {
    sku: asString(product.sku),
    title: asString(product.title),
    attemptedMethods: [],
    queryUsed: null,
    resultCount: 0,
    topCandidateTitle: null,
    topCandidateItemOrProductId: null,
    rejectionReason: null,
    finalStatus: "not_synced",
  };
}

function upsertMethod(
  diagnostic: WalmartPerProductAttemptDiagnostic,
  method: WalmartEnrichmentMethod
): WalmartPerProductAttemptDiagnostic {
  if (diagnostic.attemptedMethods.includes(method)) return diagnostic;
  return {
    ...diagnostic,
    attemptedMethods: [...diagnostic.attemptedMethods, method],
  };
}

function applyAttemptSnapshot(
  diagnostic: WalmartPerProductAttemptDiagnostic,
  patch: {
    queryUsed?: string | null;
    resultCount?: number;
    topCandidateTitle?: string | null;
    topCandidateItemOrProductId?: string | null;
    rejectionReason?: string | null;
  }
): WalmartPerProductAttemptDiagnostic {
  return {
    ...diagnostic,
    queryUsed: patch.queryUsed !== undefined ? patch.queryUsed : diagnostic.queryUsed,
    resultCount: patch.resultCount !== undefined ? patch.resultCount : diagnostic.resultCount,
    topCandidateTitle:
      patch.topCandidateTitle !== undefined ? patch.topCandidateTitle : diagnostic.topCandidateTitle,
    topCandidateItemOrProductId:
      patch.topCandidateItemOrProductId !== undefined
        ? patch.topCandidateItemOrProductId
        : diagnostic.topCandidateItemOrProductId,
    rejectionReason:
      patch.rejectionReason !== undefined ? patch.rejectionReason : diagnostic.rejectionReason,
  };
}

function finalizePerProductAttemptDiagnostics(
  progress: WalmartPublicImportEnrichmentProgress,
  diagnosticsBySku: Map<string, WalmartPerProductAttemptDiagnostic>
): void {
  progress.perProductAttemptDiagnostics = Array.from(diagnosticsBySku.values()).sort((left, right) =>
    left.sku.localeCompare(right.sku, undefined, { sensitivity: "base", numeric: true })
  );
}

function hasVerifiedPublicListing(product: WalmartProductRecord): boolean {
  const resolved = resolveCanonicalWalmartIdentifierFromProductRecord({ product });
  if (!resolved.preferredWalmartProductId) return false;
  if (
    resolved.preferredIdentifierType === "missing_product_identifier" ||
    resolved.preferredIdentifierType === "search_title_brand" ||
    resolved.preferredIdentifierType === "upc_skipped_for_product_lookup" ||
    resolved.preferredIdentifierType === "gtin_skipped_for_product_lookup"
  ) {
    return false;
  }
  return true;
}

function mergeNormalizedPayload(
  product: WalmartProductRecord,
  patch: Record<string, unknown>
): Record<string, unknown> {
  const base =
    product.normalizedPayload && typeof product.normalizedPayload === "object"
      ? (product.normalizedPayload as Record<string, unknown>)
      : {};
  return {
    ...base,
    ...patch,
  };
}

function applyBrandSearchDiagnosticsOnly(input: {
  product: WalmartProductRecord;
  sourceQuery: string;
  listing: SerpApiWalmartBrandSearchListing | null;
  matchScore: number;
  confidence: "high" | "medium" | "low";
  outcome: "ambiguous" | "no_confident_match";
  runnerUpTitle?: string;
}): WalmartProductRecord {
  return {
    ...input.product,
    normalizedPayload: mergeNormalizedPayload(input.product, {
      serpApiBrandSearch: {
        source_query: input.sourceQuery,
        match_score: input.matchScore,
        confidence: input.confidence,
        outcome: input.outcome,
        matched_title: input.listing?.title ?? null,
        runner_up_title: input.runnerUpTitle ?? null,
        us_item_id: input.listing?.usItemId ?? null,
        product_id: input.listing?.productId ?? null,
        product_page_url: input.listing?.productPageUrl ?? null,
        page: input.listing?.page ?? null,
        thumbnail_present: Boolean(input.listing?.thumbnail),
      },
    }),
  };
}

function applyBrandSearchPublicListingMatch(input: {
  product: WalmartProductRecord;
  sourceQuery: string;
  listing: SerpApiWalmartBrandSearchListing;
  matchScore: number;
  confidence: "high" | "medium" | "low";
}): { product: WalmartProductRecord; thumbnailSaved: boolean } {
  const listingId = asString(input.listing.usItemId);
  const listingUrl = listingId
    ? asString(input.listing.productPageUrl) || derivePublicWalmartUrl(listingId)
    : "";
  const thumbnail = normalizeWalmartImageUrlList([input.listing.thumbnail])[0] ?? "";
  const hasExistingImage = Boolean(input.product.imageUrl.trim());
  const shouldSaveThumbnail = Boolean(!hasExistingImage && thumbnail);
  const mergedGallery = shouldSaveThumbnail
    ? normalizeWalmartImageUrlList([
        thumbnail,
        ...(input.product.galleryImageUrls ?? []),
      ])
    : input.product.galleryImageUrls ?? [];
  const next = {
    ...input.product,
    itemId: listingId || input.product.itemId,
    publicWalmartProductId: listingId || input.product.publicWalmartProductId,
    publicWalmartUrl: listingUrl || input.product.publicWalmartUrl,
    imageUrl: shouldSaveThumbnail ? thumbnail : input.product.imageUrl,
    primaryImageUrl: shouldSaveThumbnail
      ? thumbnail
      : normalizeWalmartImageUrlList([input.product.primaryImageUrl, input.product.imageUrl])[0] ??
        input.product.imageUrl,
    galleryImageUrls: mergedGallery,
    imageStatus: shouldSaveThumbnail ? "image_available" : input.product.imageStatus,
    imageStatusMessage: shouldSaveThumbnail ? "Image available" : input.product.imageStatusMessage,
    imageSource: shouldSaveThumbnail
      ? ("serpapi_walmart_brand_search" as const)
      : input.product.imageSource,
    imageSyncStatus: shouldSaveThumbnail ? "found" : input.product.imageSyncStatus,
    imageMatchMethod: shouldSaveThumbnail
      ? ("serpapi_search_title_brand" as const)
      : input.product.imageMatchMethod,
    imageSyncReason: shouldSaveThumbnail
      ? "Public listing discovered via SerpApi Walmart brand search thumbnail."
      : input.product.imageSyncReason,
    issues: shouldSaveThumbnail ? stripImageIssues(input.product.issues) : input.product.issues,
    normalizedPayload: mergeNormalizedPayload(input.product, {
      itemId: listingId || null,
      publicWalmartProductId: listingId || null,
      publicWalmartUrl: listingUrl || null,
      serpapiProductId: input.listing.productId || null,
      imageIdentifierPath: "serpapi_public_item_id",
      serpApiBrandSearch: {
        source_query: input.sourceQuery,
        match_score: input.matchScore,
        confidence: input.confidence,
        outcome: "matched",
        matched_title: input.listing.title,
        us_item_id: input.listing.usItemId || null,
        product_id: input.listing.productId || null,
        product_page_url: input.listing.productPageUrl || null,
        page: input.listing.page,
        thumbnail_present: Boolean(input.listing.thumbnail),
      },
      ...(shouldSaveThumbnail
        ? {
            imageUrl: thumbnail,
            primaryImageUrl: thumbnail,
            galleryImageUrls: mergedGallery,
            imageStatus: "image_available",
            imageStatusMessage: "Image available",
            imageSource: "serpapi_walmart_brand_search",
            imageSyncStatus: "found",
            imageMatchMethod: "serpapi_search_title_brand",
            imageSyncReason: "Public listing discovered via SerpApi Walmart brand search thumbnail.",
          }
        : {}),
    }),
  };

  return {
    product: next,
    thumbnailSaved: shouldSaveThumbnail,
  };
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

function applySerpApiGalleryDiagnostics(input: {
  progress: WalmartPublicImportEnrichmentProgress;
  resolution: Awaited<ReturnType<typeof enrichProductImagesFromPublicWalmartListing>>;
  identifierPath: WalmartImageIdentifierPath;
}): void {
  const diagnostics = input.progress.serpApiProductGalleryDiagnostics;
  const endpointFamily = asString(input.resolution.diagnostics?.endpointFamily);
  const identifierType = asString(input.resolution.diagnostics?.productIdentifierType);

  if (endpointFamily === "walmart_product") {
    diagnostics.serpapi_product_gallery_checked += 1;
    if (input.resolution.imageSyncStatus === "found" && input.resolution.primaryImageUrl.trim()) {
      diagnostics.serpapi_product_gallery_primary_found += 1;
      const additional = Math.max(0, input.resolution.galleryImageUrls.length - 1);
      diagnostics.serpapi_product_gallery_additional_found += additional;
    } else {
      diagnostics.serpapi_product_gallery_no_images += 1;
    }
  }

  if (input.identifierPath === "skipped_gtin_as_product_id") {
    diagnostics.skipped_gtin_as_product_id += 1;
  }

  if (identifierType === "missing_product_identifier") {
    diagnostics.skipped_no_verified_public_listing += 1;
  } else if (identifierType === "search_title_brand") {
    diagnostics.skipped_non_public_identifier += 1;
  }
}

function incrementPathCount(
  counts: WalmartImageIdentifierPathCounts,
  path: WalmartImageIdentifierPath
): void {
  counts[path] += 1;
}

function writePerProductAttemptDiagnostic(
  product: WalmartProductRecord,
  diagnostic: WalmartPerProductAttemptDiagnostic
): WalmartProductRecord {
  return {
    ...product,
    normalizedPayload: mergeNormalizedPayload(product, {
      publicImageEnrichmentAttempt: {
        sku: diagnostic.sku,
        title: diagnostic.title,
        attempted_methods: [...diagnostic.attemptedMethods],
        query_used: diagnostic.queryUsed,
        result_count: diagnostic.resultCount,
        top_candidate_title: diagnostic.topCandidateTitle,
        top_candidate_item_or_product_id: diagnostic.topCandidateItemOrProductId,
        rejection_reason: diagnostic.rejectionReason,
        final_status: diagnostic.finalStatus,
      },
    }),
  };
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

function applyWalmartItemSearchDecisionDiagnostics(input: {
  progress: WalmartPublicImportEnrichmentProgress;
  resolution: Awaited<ReturnType<typeof enrichWalmartImageFromItemSearch>>;
}): void {
  const decision = input.resolution.diagnostics?.decision;
  if (!decision) return;
  const counters = input.progress.walmartItemSearchDiagnostics;

  if (decision.decisionCode === "walmart_item_search_exact_identifier_match") {
    counters.walmart_item_search_exact_identifier_match += 1;
    return;
  }
  if (decision.decisionCode === "walmart_item_search_identifier_normalized_match") {
    counters.walmart_item_search_identifier_normalized_match += 1;
    return;
  }
  if (decision.decisionCode === "walmart_item_search_identifier_assisted_match") {
    counters.walmart_item_search_identifier_assisted_match += 1;
    return;
  }
  if (decision.decisionCode === "walmart_item_search_multiple_candidates_rejected") {
    counters.walmart_item_search_multiple_candidates_rejected += 1;
    return;
  }
  if (decision.decisionCode === "walmart_item_search_single_candidate_no_image") {
    counters.walmart_item_search_single_candidate_no_image += 1;
  }
}

async function resolveWithRetry(input: {
  userId: string;
  product: WalmartProductRecord;
  retries: number;
  searchTitleBrandQuery?: string;
  skipProductLookup?: boolean;
}): Promise<Awaited<ReturnType<typeof enrichProductImagesFromPublicWalmartListing>>> {
  let attempt = 0;
  let last = await enrichProductImagesFromPublicWalmartListing({
    userId: input.userId,
    product: input.product,
    searchTitleBrandQuery: input.searchTitleBrandQuery,
    skipProductLookup: input.skipProductLookup,
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
      searchTitleBrandQuery: input.searchTitleBrandQuery,
      skipProductLookup: input.skipProductLookup,
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
  maxPerProductSearchesPerRun?: number;
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
    serpApiProductGalleryFoundCount: 0,
    serpApiSearchFallbackFoundCount: 0,
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
    serpApiProductGalleryDiagnostics: createSerpApiProductGalleryDiagnostics(),
    serpApiBrandSearchDiagnostics: createSerpApiBrandSearchDiagnostics(),
    walmartItemSearchDiagnostics: createWalmartItemSearchDiagnostics(),
    serpApiPerProductDiagnostics: createSerpApiPerProductDiagnostics(),
    perProductAttemptDiagnostics: [],
  };

  const concurrency = Math.max(1, Math.min(6, input.concurrency ?? 2));
  const retries = Math.max(0, Math.min(2, input.retries ?? 2));
  const perProductSearchLimit = resolvePerProductSerpApiSearchLimit(
    input.maxPerProductSearchesPerRun,
    candidates.length
  );
  let unresolvedForSerpApi: WalmartProductRecord[] = [];
  const perProductDiagnosticBySku = new Map<string, WalmartPerProductAttemptDiagnostic>();

  const readDiagnostic = (product: WalmartProductRecord): WalmartPerProductAttemptDiagnostic => {
    const key = toSkuKey(product.sku);
    const existing = perProductDiagnosticBySku.get(key);
    if (existing) return existing;
    const created = createEmptyPerProductAttemptDiagnostic(product);
    perProductDiagnosticBySku.set(key, created);
    return created;
  };

  const writeDiagnostic = (
    product: WalmartProductRecord,
    updater: (current: WalmartPerProductAttemptDiagnostic) => WalmartPerProductAttemptDiagnostic
  ) => {
    const key = toSkuKey(product.sku);
    const current = readDiagnostic(product);
    const next = updater(current);
    perProductDiagnosticBySku.set(key, next);
    return next;
  };

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
                decisionCode: "walmart_item_search_provider_failed",
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
        const updatedDiagnostic = writeDiagnostic(result.repairedProduct, (current) =>
          upsertMethod(current, "walmart_item_search")
        );
        products[targetIndex] = result.repairedProduct;
        products[targetIndex] = writePerProductAttemptDiagnostic(
          products[targetIndex],
          updatedDiagnostic
        );
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
      applyWalmartItemSearchDecisionDiagnostics({
        progress,
        resolution: enriched,
      });
      const topAttempt = enriched.diagnostics?.decision;
      const diagnosticAfterItemSearch = writeDiagnostic(repairedForSearch, (current) =>
        applyAttemptSnapshot(upsertMethod(current, "walmart_item_search"), {
          queryUsed:
            enriched.matchMethod === "query"
              ? [asString(repairedForSearch.brand), asString(repairedForSearch.title)]
                  .filter(Boolean)
                  .join(" ")
                  .trim() || null
              : enriched.matchMethod === "upc"
              ? asString(repairedForSearch.upc) || null
              : enriched.matchMethod === "gtin"
              ? asString(repairedForSearch.gtin) || null
              : enriched.matchMethod === "itemId"
              ? asString(repairedForSearch.itemId) || null
              : enriched.matchMethod === "wpid"
              ? asString(repairedForSearch.wpid) || null
              : null,
          resultCount: topAttempt?.candidateCount ?? 0,
          rejectionReason:
            enriched.imageSyncStatus === "found" ? null : asString(enriched.statusReason) || null,
        })
      );
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
        const finalDiagnostic = {
          ...diagnosticAfterItemSearch,
          finalStatus: "found" as const,
          rejectionReason: null,
        };
        products[targetIndex] = writePerProductAttemptDiagnostic(products[targetIndex], finalDiagnostic);
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
      const finalDiagnostic = {
        ...diagnosticAfterItemSearch,
        finalStatus:
          enriched.imageSyncStatus === "failed"
            ? ("failed" as const)
            : enriched.imageSyncStatus === "ambiguous"
            ? ("ambiguous" as const)
            : ("not_found" as const),
        rejectionReason: asString(enriched.statusReason) || diagnosticAfterItemSearch.rejectionReason,
      };
      const nonFoundWithDiagnostic = writePerProductAttemptDiagnostic(nonFoundProduct, finalDiagnostic);
      products[targetIndex] = nonFoundWithDiagnostic;
      unresolvedForSerpApi.push(nonFoundWithDiagnostic);
    }
  }

  if (unresolvedForSerpApi.length === 0) {
    progress.lastEnrichedAt = progress.enrichmentCompletedCount > 0 ? new Date().toISOString() : progress.lastEnrichedAt;
    finalizePerProductAttemptDiagnostics(progress, perProductDiagnosticBySku);
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
      if (unresolvedPath === "skipped_gtin_as_product_id") {
        progress.serpApiProductGalleryDiagnostics.skipped_gtin_as_product_id += 1;
      } else if (unresolvedPath === "no_searchable_identifier") {
        progress.serpApiProductGalleryDiagnostics.skipped_no_verified_public_listing += 1;
      }
      progress.enrichmentCompletedCount += 1;
      const nonFound = applyNonFoundResolution(unresolved, {
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
      const finalizedDiagnostic = writeDiagnostic(unresolved, (current) =>
        applyAttemptSnapshot(current, {
          rejectionReason:
            asString(unresolved.imageSyncReason) ||
            unresolved.imageStatusMessage ||
            "SerpApi key is missing. Connect SerpApi to enable automated public Walmart image enrichment.",
        })
      );
      products[targetIndex] = writePerProductAttemptDiagnostic(nonFound, {
        ...finalizedDiagnostic,
        finalStatus:
          unresolved.imageSyncStatus === "failed"
            ? "failed"
            : unresolved.imageSyncStatus === "ambiguous"
            ? "ambiguous"
            : unresolved.imageSyncStatus === "not_synced"
            ? "not_synced"
            : "not_found",
      });

      if (unresolved.imageSyncStatus === "not_found") progress.notFoundCount += 1;
      else if (unresolved.imageSyncStatus === "ambiguous") progress.ambiguousCount += 1;
      else if (unresolved.imageSyncStatus === "failed") progress.failedCount += 1;
      else progress.notFoundCount += 1;
    }
    progress.lastEnrichedAt = progress.enrichmentCompletedCount > 0 ? new Date().toISOString() : progress.lastEnrichedAt;
    finalizePerProductAttemptDiagnostics(progress, perProductDiagnosticBySku);
    return { products, progress };
  }

  const brandNoConfidentSkuKeys = new Set<string>();
  const brandAmbiguousSkuKeys = new Set<string>();

  const brandSearchQuery = deriveBrandSearchQuery(unresolvedForSerpApi);
  if (brandSearchQuery) {
    const brandSearchCandidates = unresolvedForSerpApi.filter(
      (product) => !product.imageUrl.trim() && !hasVerifiedPublicListing(product)
    );

    if (brandSearchCandidates.length > 0) {
      progress.serpApiBrandSearchDiagnostics.serpapi_brand_search_checked +=
        brandSearchCandidates.length;

      const harvested = await harvestWalmartBrandSearchListingsViaSerpApi({
        apiKey: credentials.apiKey,
        query: brandSearchQuery,
        maxPages: 3,
        maxResults: 120,
      });

      if (harvested.ok) {
        progress.serpApiBrandSearchDiagnostics.serpapi_brand_search_results_harvested +=
          harvested.resultsHarvested;

        const matchedSkuKeys = new Set<string>();

        for (const candidate of brandSearchCandidates) {
          const skuKey = toSkuKey(candidate.sku);
          const targetIndex = products.findIndex((entry) => toSkuKey(entry.sku) === skuKey);
          if (targetIndex < 0) continue;

          const matched = matchImportedWalmartProductToBrandSearchListings({
            product: products[targetIndex]!,
            listings: harvested.listings,
            sourceQuery: brandSearchQuery,
          });
          const topListing = matched.matchedListing ?? matched.runnerUpListing;

          const productDiagnostic = writeDiagnostic(products[targetIndex]!, (current) =>
            applyAttemptSnapshot(upsertMethod(current, "serpapi_brand_search"), {
              queryUsed: brandSearchQuery,
              resultCount: harvested.resultsHarvested,
              topCandidateTitle: topListing?.title ?? null,
              topCandidateItemOrProductId:
                asString(topListing?.usItemId) || asString(topListing?.productId) || null,
              rejectionReason:
                matched.status === "matched"
                  ? null
                  : matched.status === "ambiguous"
                  ? "SerpApi Walmart brand search returned multiple similar public listings."
                  : "No confident SerpApi Walmart brand-search public listing match was found.",
            })
          );

          if (matched.status === "matched" && matched.matchedListing) {
            progress.serpApiBrandSearchDiagnostics.serpapi_brand_search_public_listing_matched += 1;
            incrementPathCount(progress.identifierPathCounts, "serpapi_public_item_id");

            const matchedProduct = applyBrandSearchPublicListingMatch({
              product: products[targetIndex]!,
              sourceQuery: brandSearchQuery,
              listing: matched.matchedListing,
              matchScore: matched.score,
              confidence: matched.confidence,
            });

            if (matchedProduct.thumbnailSaved) {
              progress.serpApiBrandSearchDiagnostics.serpapi_brand_search_thumbnail_saved += 1;
            }

            const galleryResolution = await resolveWithRetry({
              userId: input.userId,
              product: matchedProduct.product,
              retries,
            });
            applySerpApiGalleryDiagnostics({
              progress,
              resolution: galleryResolution,
              identifierPath: "serpapi_public_item_id",
            });

            progress.enrichmentCompletedCount += 1;
            matchedSkuKeys.add(skuKey);

            if (galleryResolution.imageSyncStatus === "found") {
              progress.foundCount += 1;
              progress.serpApiFallbackFoundCount += 1;
              if (galleryResolution.diagnostics.endpointFamily === "walmart_product") {
                progress.serpApiProductGalleryFoundCount += 1;
              } else {
                progress.serpApiSearchFallbackFoundCount += 1;
              }

              const foundFromGallery = applyFoundPublicListingImages(matchedProduct.product, {
                primaryImageUrl: galleryResolution.primaryImageUrl,
                galleryImageUrls: galleryResolution.galleryImageUrls,
                variantImageUrls: galleryResolution.variantImageUrls,
                publicWalmartUrl: galleryResolution.publicWalmartUrl,
                publicWalmartProductId: galleryResolution.publicWalmartProductId,
                imageMatchMethod: galleryResolution.imageMatchMethod,
                statusReason: galleryResolution.statusReason,
                lastImageSyncedAt: galleryResolution.lastImageSyncedAt,
                endpointFamily: galleryResolution.diagnostics.endpointFamily,
                productPageUrl: asString(galleryResolution.diagnostics.productPageUrl),
              });
              products[targetIndex] = writePerProductAttemptDiagnostic(foundFromGallery, {
                ...productDiagnostic,
                finalStatus: "found",
                rejectionReason: null,
              });
            } else if (matchedProduct.thumbnailSaved) {
              if (galleryResolution.imageSyncStatus === "failed") {
                applyProviderErrorToProgress({
                  progress,
                  errorCode: galleryResolution.errorCode,
                  statusReason: galleryResolution.statusReason,
                });
              }
              progress.foundCount += 1;
              const foundFromThumbnail = {
                ...matchedProduct.product,
                lastImageSyncedAt: galleryResolution.lastImageSyncedAt,
                normalizedPayload: mergeNormalizedPayload(matchedProduct.product, {
                  serpApiProductGallery: {
                    checked: true,
                    status: galleryResolution.imageSyncStatus,
                    status_reason: galleryResolution.statusReason,
                    endpoint_family: galleryResolution.diagnostics.endpointFamily,
                  },
                }),
              };
              products[targetIndex] = writePerProductAttemptDiagnostic(foundFromThumbnail, {
                ...productDiagnostic,
                finalStatus: "found",
                rejectionReason: null,
              });
            } else {
              if (galleryResolution.imageSyncStatus === "not_found") progress.notFoundCount += 1;
              else if (galleryResolution.imageSyncStatus === "ambiguous") progress.ambiguousCount += 1;
              else if (galleryResolution.imageSyncStatus === "failed") {
                progress.failedCount += 1;
                applyProviderErrorToProgress({
                  progress,
                  errorCode: galleryResolution.errorCode,
                  statusReason: galleryResolution.statusReason,
                });
              }

              const nonFoundFromGallery = applyNonFoundResolution(matchedProduct.product, {
                imageSyncStatus: galleryResolution.imageSyncStatus,
                statusReason: galleryResolution.statusReason,
                publicWalmartUrl: galleryResolution.publicWalmartUrl,
                publicWalmartProductId: galleryResolution.publicWalmartProductId,
                imageSource: "public_walmart_listing_serpapi",
                imageMatchMethod: galleryResolution.imageMatchMethod,
                lastImageSyncedAt: galleryResolution.lastImageSyncedAt,
              });
              products[targetIndex] = writePerProductAttemptDiagnostic(nonFoundFromGallery, {
                ...productDiagnostic,
                finalStatus:
                  galleryResolution.imageSyncStatus === "failed"
                    ? "failed"
                    : galleryResolution.imageSyncStatus === "ambiguous"
                    ? "ambiguous"
                    : "not_found",
                rejectionReason: galleryResolution.statusReason,
              });
            }
            continue;
          }

          if (matched.status === "ambiguous") {
            progress.serpApiBrandSearchDiagnostics.serpapi_brand_search_ambiguous += 1;
            brandAmbiguousSkuKeys.add(skuKey);
            const withDiagnostics = applyBrandSearchDiagnosticsOnly({
              product: products[targetIndex]!,
              sourceQuery: brandSearchQuery,
              listing: matched.matchedListing,
              matchScore: matched.score,
              confidence: matched.confidence,
              outcome: "ambiguous",
              runnerUpTitle: matched.runnerUpListing?.title,
            });
            products[targetIndex] = writePerProductAttemptDiagnostic(withDiagnostics, {
              ...productDiagnostic,
              finalStatus: "not_synced",
            });
            continue;
          }

          progress.serpApiBrandSearchDiagnostics.serpapi_brand_search_no_confident_match += 1;
          brandNoConfidentSkuKeys.add(skuKey);
          const withDiagnostics = applyBrandSearchDiagnosticsOnly({
            product: products[targetIndex]!,
            sourceQuery: brandSearchQuery,
            listing: matched.matchedListing,
            matchScore: matched.score,
            confidence: matched.confidence,
            outcome: "no_confident_match",
            runnerUpTitle: matched.runnerUpListing?.title,
          });
          products[targetIndex] = writePerProductAttemptDiagnostic(withDiagnostics, {
            ...productDiagnostic,
            finalStatus: "not_synced",
          });
        }

        unresolvedForSerpApi = unresolvedForSerpApi
          .filter((product) => !matchedSkuKeys.has(toSkuKey(product.sku)))
          .map((product) => {
            const key = toSkuKey(product.sku);
            const next = products.find((entry) => toSkuKey(entry.sku) === key);
            return next ?? product;
          });
      } else if (
        harvested.statusCategory === "invalid_key" ||
        harvested.statusCategory === "forbidden" ||
        harvested.statusCategory === "rate_limited" ||
        harvested.statusCategory === "provider_error" ||
        harvested.statusCategory === "network_error" ||
        harvested.statusCategory === "malformed_response" ||
        harvested.statusCategory === "validation_error"
      ) {
        applyProviderErrorToProgress({
          progress,
          errorCode: harvested.errorCode,
          statusReason: harvested.statusReason,
        });
      }
    }
  }

  const perProductSearchCandidates = unresolvedForSerpApi
    .filter((product) => !product.imageUrl.trim() && !hasVerifiedPublicListing(product))
    .sort((left, right) => {
      const leftKey = toSkuKey(left.sku);
      const rightKey = toSkuKey(right.sku);
      const leftPriority = brandNoConfidentSkuKeys.has(leftKey)
        ? 0
        : brandAmbiguousSkuKeys.has(leftKey)
        ? 1
        : 2;
      const rightPriority = brandNoConfidentSkuKeys.has(rightKey)
        ? 0
        : brandAmbiguousSkuKeys.has(rightKey)
        ? 1
        : 2;
      if (leftPriority !== rightPriority) return leftPriority - rightPriority;
      return leftKey.localeCompare(rightKey, undefined, { sensitivity: "base", numeric: true });
    });

  const selectedPerProductCandidates = perProductSearchCandidates.slice(0, perProductSearchLimit);
  const skippedForRemainingRetry = perProductSearchCandidates.slice(selectedPerProductCandidates.length);
  const skippedForRemainingRetryKeys = new Set(
    skippedForRemainingRetry.map((product) => toSkuKey(product.sku))
  );

  for (const skipped of skippedForRemainingRetry) {
    const skippedKey = toSkuKey(skipped.sku);
    if (brandAmbiguousSkuKeys.has(skippedKey)) {
      progress.serpApiPerProductDiagnostics.ambiguous_skipped += 1;
    }
    const skippedDiagnostic = writeDiagnostic(skipped, (current) =>
      applyAttemptSnapshot(current, {
        rejectionReason:
          "Deferred to remaining retry queue due per-product SerpApi search limit for this run.",
      })
    );
    perProductDiagnosticBySku.set(skippedKey, {
      ...skippedDiagnostic,
      finalStatus: "not_synced",
    });
  }

  const processedInPerProductFallback = new Set<string>();
  for (let index = 0; index < selectedPerProductCandidates.length; index += concurrency) {
    const batch = selectedPerProductCandidates.slice(index, index + concurrency);

    const results = await Promise.all(
      batch.map(async (product) => {
        const query = buildPerProductSerpApiQuery(product);
        if (!query) {
          return {
            product,
            query,
            resolution: null,
          } as const;
        }

        try {
          const resolution = await resolveWithRetry({
            userId: input.userId,
            product,
            retries,
            searchTitleBrandQuery: query,
            skipProductLookup: true,
          });
          return { product, query, resolution };
        } catch (error) {
          return {
            product,
            query,
            resolution: {
              imageSyncStatus: "failed" as const,
              imageSource: "public_walmart_listing_serpapi" as const,
              statusReason:
                error instanceof Error && error.message.trim().length > 0
                  ? error.message
                  : "Per-product SerpApi search failed.",
              imageMatchMethod: "serpapi_search_title_brand" as const,
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
                productIdentifierType: "search_title_brand" as const,
                queryUsed: query,
                candidateCount: 0,
                imageCount: 0,
                matchMethod: "serpapi_search_title_brand" as const,
                topCandidateTitle: null,
                topCandidateProductId: null,
              },
              errorCode: "SERPAPI_REQUEST_FAILED" as const,
            },
          };
        }
      })
    );

    for (const result of results) {
      const skuKey = toSkuKey(result.product.sku);
      const targetIndex = products.findIndex((entry) => toSkuKey(entry.sku) === skuKey);
      if (targetIndex < 0) continue;

      if (brandNoConfidentSkuKeys.has(skuKey)) {
        progress.serpApiPerProductDiagnostics.no_confident_match_continued_to_fallback += 1;
      }
      if (brandAmbiguousSkuKeys.has(skuKey)) {
        progress.serpApiPerProductDiagnostics.ambiguous_continued_to_fallback += 1;
      }

      progress.serpApiPerProductDiagnostics.serpapi_per_product_searches_attempted += 1;
      processedInPerProductFallback.add(skuKey);

      const baseDiagnostic = writeDiagnostic(products[targetIndex]!, (current) =>
        applyAttemptSnapshot(upsertMethod(current, "serpapi_per_product_search"), {
          queryUsed: result.query || null,
          resultCount: result.resolution?.diagnostics?.candidateCount ?? 0,
          topCandidateTitle: asString(result.resolution?.diagnostics?.topCandidateTitle) || null,
          topCandidateItemOrProductId:
            asString(result.resolution?.diagnostics?.topCandidateProductId) ||
            asString(result.resolution?.publicWalmartProductId) ||
            null,
        })
      );

      if (!result.query || !result.resolution) {
        incrementPathCount(progress.identifierPathCounts, "no_searchable_identifier");
        progress.serpApiProductGalleryDiagnostics.skipped_no_verified_public_listing += 1;
        progress.notFoundCount += 1;
        progress.enrichmentCompletedCount += 1;
        const terminal = applyNonFoundResolution(products[targetIndex]!, {
          imageSyncStatus: "not_found",
          statusReason: "No searchable brand/title tokens were available for per-product SerpApi search.",
          publicWalmartUrl: asString(products[targetIndex]?.publicWalmartUrl),
          publicWalmartProductId: asString(products[targetIndex]?.publicWalmartProductId),
          imageSource: "public_walmart_listing_serpapi",
          imageMatchMethod: null,
          lastImageSyncedAt: new Date().toISOString(),
        });
        products[targetIndex] = writePerProductAttemptDiagnostic(terminal, {
          ...baseDiagnostic,
          finalStatus: "not_found",
          rejectionReason: "No searchable brand/title tokens were available for per-product SerpApi search.",
        });
        continue;
      }

      const resolution = result.resolution;
      const identifierPath = pathFromSerpApiResolution(resolution);
      incrementPathCount(progress.identifierPathCounts, identifierPath);
      applySerpApiGalleryDiagnostics({
        progress,
        resolution,
        identifierPath,
      });
      progress.enrichmentCompletedCount += 1;

      if (resolution.imageSyncStatus === "found") {
        progress.serpApiPerProductDiagnostics.serpapi_per_product_matches += 1;
        if (resolution.primaryImageUrl.trim()) {
          progress.serpApiPerProductDiagnostics.serpapi_per_product_thumbnails_saved += 1;
        }

        let foundFromPerProductSearch = applyFoundPublicListingImages(products[targetIndex]!, {
          primaryImageUrl: resolution.primaryImageUrl,
          galleryImageUrls: resolution.galleryImageUrls,
          variantImageUrls: resolution.variantImageUrls,
          publicWalmartUrl: resolution.publicWalmartUrl,
          publicWalmartProductId: resolution.publicWalmartProductId,
          imageMatchMethod: resolution.imageMatchMethod,
          statusReason: resolution.statusReason,
          lastImageSyncedAt: resolution.lastImageSyncedAt,
          endpointFamily: resolution.diagnostics.endpointFamily,
          productPageUrl: asString(resolution.diagnostics.productPageUrl),
        });

        const galleryResolution = await resolveWithRetry({
          userId: input.userId,
          product: foundFromPerProductSearch,
          retries,
        });
        applySerpApiGalleryDiagnostics({
          progress,
          resolution: galleryResolution,
          identifierPath: "serpapi_public_item_id",
        });

        if (galleryResolution.imageSyncStatus === "found") {
          progress.foundCount += 1;
          progress.serpApiFallbackFoundCount += 1;
          if (galleryResolution.diagnostics.endpointFamily === "walmart_product") {
            progress.serpApiProductGalleryFoundCount += 1;
          } else {
            progress.serpApiSearchFallbackFoundCount += 1;
          }
          const foundFromGallery = applyFoundPublicListingImages(foundFromPerProductSearch, {
            primaryImageUrl: galleryResolution.primaryImageUrl,
            galleryImageUrls: galleryResolution.galleryImageUrls,
            variantImageUrls: galleryResolution.variantImageUrls,
            publicWalmartUrl: galleryResolution.publicWalmartUrl,
            publicWalmartProductId: galleryResolution.publicWalmartProductId,
            imageMatchMethod: galleryResolution.imageMatchMethod,
            statusReason: galleryResolution.statusReason,
            lastImageSyncedAt: galleryResolution.lastImageSyncedAt,
            endpointFamily: galleryResolution.diagnostics.endpointFamily,
            productPageUrl: asString(galleryResolution.diagnostics.productPageUrl),
          });
          products[targetIndex] = writePerProductAttemptDiagnostic(foundFromGallery, {
            ...baseDiagnostic,
            finalStatus: "found",
            rejectionReason: null,
          });
          continue;
        }

        progress.foundCount += 1;
        progress.serpApiFallbackFoundCount += 1;
        progress.serpApiSearchFallbackFoundCount += 1;
        if (galleryResolution.imageSyncStatus === "failed") {
          applyProviderErrorToProgress({
            progress,
            errorCode: galleryResolution.errorCode,
            statusReason: galleryResolution.statusReason,
          });
        }

        foundFromPerProductSearch = {
          ...foundFromPerProductSearch,
          lastImageSyncedAt: galleryResolution.lastImageSyncedAt,
          normalizedPayload: mergeNormalizedPayload(foundFromPerProductSearch, {
            serpApiProductGallery: {
              checked: true,
              status: galleryResolution.imageSyncStatus,
              status_reason: galleryResolution.statusReason,
              endpoint_family: galleryResolution.diagnostics.endpointFamily,
            },
            imageIdentifierPath: identifierPath,
          }),
        };
        products[targetIndex] = writePerProductAttemptDiagnostic(foundFromPerProductSearch, {
          ...baseDiagnostic,
          finalStatus: "found",
          rejectionReason: null,
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

      const nonFoundProduct = applyNonFoundResolution(products[targetIndex]!, {
        imageSyncStatus: resolution.imageSyncStatus,
        statusReason: resolution.statusReason,
        publicWalmartUrl: resolution.publicWalmartUrl,
        publicWalmartProductId: resolution.publicWalmartProductId,
        imageSource: "public_walmart_listing_serpapi",
        imageMatchMethod: resolution.imageMatchMethod,
        lastImageSyncedAt: resolution.lastImageSyncedAt,
      });

      products[targetIndex] = writePerProductAttemptDiagnostic(
        {
          ...nonFoundProduct,
          normalizedPayload: mergeNormalizedPayload(nonFoundProduct, {
            imageIdentifierPath: identifierPath,
          }),
        },
        {
          ...baseDiagnostic,
          finalStatus:
            resolution.imageSyncStatus === "failed"
              ? "failed"
              : resolution.imageSyncStatus === "ambiguous"
              ? "ambiguous"
              : resolution.imageSyncStatus === "not_synced"
              ? "not_synced"
              : "not_found",
          rejectionReason: resolution.statusReason,
        }
      );
    }
  }

  unresolvedForSerpApi = unresolvedForSerpApi.filter((product) => {
    const skuKey = toSkuKey(product.sku);
    if (processedInPerProductFallback.has(skuKey)) return false;
    if (skippedForRemainingRetryKeys.has(skuKey)) return false;
    return true;
  });

  if (unresolvedForSerpApi.length === 0) {
    progress.lastEnrichedAt =
      progress.enrichmentCompletedCount > 0 ? new Date().toISOString() : progress.lastEnrichedAt;
    finalizePerProductAttemptDiagnostics(progress, perProductDiagnosticBySku);
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
                queryUsed: null,
                candidateCount: 0,
                imageCount: 0,
                matchMethod: null,
                topCandidateTitle: null,
                topCandidateProductId: null,
              },
              errorCode: "SERPAPI_REQUEST_FAILED" as const,
            },
          };
        }
      })
    );

    for (const { product, resolution } of results) {
      const targetIndex = products.findIndex(
        (entry) => toSkuKey(entry.sku) === toSkuKey(product.sku)
      );
      if (targetIndex < 0) continue;

      const baseDiagnostic = writeDiagnostic(products[targetIndex]!, (current) =>
        applyAttemptSnapshot(upsertMethod(current, "serpapi_product_gallery"), {
          queryUsed: asString(resolution.diagnostics?.queryUsed) || current.queryUsed,
          resultCount: resolution.diagnostics?.candidateCount ?? current.resultCount,
          topCandidateTitle:
            asString(resolution.diagnostics?.topCandidateTitle) || current.topCandidateTitle,
          topCandidateItemOrProductId:
            asString(resolution.diagnostics?.topCandidateProductId) ||
            asString(resolution.publicWalmartProductId) ||
            current.topCandidateItemOrProductId,
          rejectionReason: resolution.imageSyncStatus === "found" ? null : resolution.statusReason,
        })
      );

      progress.enrichmentCompletedCount += 1;
      const identifierPath = pathFromSerpApiResolution(resolution);
      incrementPathCount(progress.identifierPathCounts, identifierPath);
      applySerpApiGalleryDiagnostics({
        progress,
        resolution,
        identifierPath,
      });

      if (resolution.imageSyncStatus === "found") {
        progress.foundCount += 1;
        progress.serpApiFallbackFoundCount += 1;
        if (resolution.diagnostics.endpointFamily === "walmart_product") {
          progress.serpApiProductGalleryFoundCount += 1;
        } else {
          progress.serpApiSearchFallbackFoundCount += 1;
        }
        products[targetIndex] = applyFoundPublicListingImages(products[targetIndex], {
          primaryImageUrl: resolution.primaryImageUrl,
          galleryImageUrls: resolution.galleryImageUrls,
          variantImageUrls: resolution.variantImageUrls,
          publicWalmartUrl: resolution.publicWalmartUrl,
          publicWalmartProductId: resolution.publicWalmartProductId,
          imageMatchMethod: resolution.imageMatchMethod,
          statusReason: resolution.statusReason,
          lastImageSyncedAt: resolution.lastImageSyncedAt,
          endpointFamily: resolution.diagnostics.endpointFamily,
          productPageUrl: asString(resolution.diagnostics.productPageUrl),
        });
        products[targetIndex] = writePerProductAttemptDiagnostic(
          {
            ...products[targetIndex],
            normalizedPayload: mergeNormalizedPayload(products[targetIndex]!, {
              imageIdentifierPath: identifierPath,
            }),
          },
          {
            ...baseDiagnostic,
            finalStatus: "found",
            rejectionReason: null,
          }
        );
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

      const nonFound = applyNonFoundResolution(products[targetIndex], {
        imageSyncStatus: resolution.imageSyncStatus,
        statusReason: resolution.statusReason,
        publicWalmartUrl: resolution.publicWalmartUrl,
        publicWalmartProductId: resolution.publicWalmartProductId,
        imageSource: "public_walmart_listing_serpapi",
        imageMatchMethod: resolution.imageMatchMethod,
        lastImageSyncedAt: resolution.lastImageSyncedAt,
      });
      products[targetIndex] = writePerProductAttemptDiagnostic(
        {
          ...nonFound,
          normalizedPayload: mergeNormalizedPayload(nonFound, {
            imageIdentifierPath: identifierPath,
          }),
        },
        {
          ...baseDiagnostic,
          finalStatus:
            resolution.imageSyncStatus === "failed"
              ? "failed"
              : resolution.imageSyncStatus === "ambiguous"
              ? "ambiguous"
              : resolution.imageSyncStatus === "not_synced"
              ? "not_synced"
              : "not_found",
        }
      );
    }
  }

  progress.lastEnrichedAt = progress.enrichmentCompletedCount > 0 ? new Date().toISOString() : progress.lastEnrichedAt;
  finalizePerProductAttemptDiagnostics(progress, perProductDiagnosticBySku);
  return { products, progress };
}
