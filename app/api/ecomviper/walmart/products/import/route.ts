export const runtime = "nodejs";

import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { fail, ok } from "@/app/api/ecomviper/walmart/_utils/response";
import { requireSignedInUser } from "@/lib/auth/requireSignedInUser";
import {
  importWalmartProducts,
  isWalmartImportFailureError,
  listWalmartProductsForUser,
  queueWalmartPostImportLiveHydrationForUser,
  retryWalmartPublicImageEnrichmentForUser,
} from "@/lib/ecomviper/walmart/walmart-products";
import { getSerpApiCredentialsForUser } from "@/lib/ecomviper/walmart/serpapi-walmart-images";
import type {
  WalmartImportErrorCategory,
  WalmartImportFailurePhase,
  WalmartImportResult,
  WalmartSerpApiProviderStatus,
} from "@/lib/ecomviper/walmart/walmart-types";

interface ImportProgressTotals {
  importedCount: number;
  fetchedCount: number;
  processedCount: number;
  queuedCount: number;
  imageFoundCount: number;
  imageFromImportPayloadCount: number;
  imageEnrichedCount: number;
  imageFromWalmartSearchCount: number;
  imageFromSerpApiBrandSearchThumbnailCount: number;
  publicListingsDiscoveredViaSerpApiBrandSearchCount: number;
  serpApiBrandSearchAmbiguousCount: number;
  serpApiBrandSearchNoConfidentMatchCount: number;
  imageFromSerpApiFallbackCount: number;
  imageFromSerpApiProductGalleryCount: number;
  imageFromSerpApiSearchFallbackCount: number;
  perProductSerpApiSearchesAttempted: number;
  perProductSerpApiMatches: number;
  perProductSerpApiThumbnailsSaved: number;
  noConfidentMatchContinuedToFallback: number;
  ambiguousContinuedToFallback: number;
  ambiguousSkippedCount: number;
  walmartItemSearchExactIdentifierMatchCount: number;
  walmartItemSearchIdentifierNormalizedMatchCount: number;
  walmartItemSearchIdentifierAssistedMatchCount: number;
  walmartItemSearchMultipleCandidatesRejectedCount: number;
  walmartItemSearchSingleCandidateNoImageCount: number;
  walmartSearchNotFoundCount: number;
  imageStillMissingCount: number;
  imageMissingCount: number;
  imageNotFoundCount: number;
  imageAmbiguousCount: number;
  imageFailedCount: number;
  imageSkippedNoProviderCount: number;
  shopifyProductsImported: number;
  shopifyImagesImported: number;
  walmartProductsMatchedToShopify: number;
  imagesAppliedFromShopify: number;
  ambiguousShopifyMatches: number;
  shopifyNoMatchCount: number;
  shopifyNoImageAvailableCount: number;
  stillMissingAfterShopify: number;
  shopifyVariantSkuMatch: number;
  shopifyVariantBarcodeMatch: number;
  shopifyBarcodeNormalizedMatch: number;
  shopifyTitleVendorMatch: number;
  shopifyAmbiguousMatch: number;
  shopifyNoMatch: number;
  shopifyImageApplied: number;
  shopifyNoImageAvailable: number;
}

interface ImportProgressPerProductDiagnostic {
  sku: string;
  title: string;
  attemptedMethods: string[];
  queryUsed: string | null;
  walmartItemSearchQueryOrIdentifier: string | null;
  walmartItemSearchMethod: string | null;
  resultCount: number;
  topCandidateTitle: string | null;
  topCandidateItemOrProductId: string | null;
  topCandidateProductId: string | null;
  topCandidateUsItemId: string | null;
  topCandidateThumbnailPresent: boolean | null;
  matchScore: number | null;
  confidence: "high" | "medium" | "low" | null;
  rejectionReason: string | null;
  finalStatus: "found" | "not_found" | "ambiguous" | "failed" | "not_synced";
}

interface ImportProgressPayload {
  stage: "complete" | "completed_with_warnings" | "failed";
  providerConnected: boolean;
  providerStatus: WalmartSerpApiProviderStatus;
  providerStatusReason: string | null;
  providerCanAttempt: boolean;
  noImageReason: string | null;
  enrichmentBounded: boolean;
  enrichmentBoundedLimit: number | null;
  enrichmentDeferredCount: number;
  totals: ImportProgressTotals;
  perProductAttemptDiagnostics: ImportProgressPerProductDiagnostic[];
  importErrorCategory: WalmartImportErrorCategory;
  importErrorReason: string | null;
  importErrorPhase: WalmartImportFailurePhase | null;
  importErrorStatusCode: number | null;
  importErrorEndpointFamily: string | null;
  importErrorCorrelationId: string | null;
  importErrorResponseShape: string | null;
  shopifyCatalogRefreshTriggered: boolean;
  shopifyCatalogRefreshStatus: "success" | "failed" | "skipped";
  shopifyCatalogRefreshReason: string | null;
  shopifyReconcileError: string | null;
  enrichmentErrorCategories: {
    invalidKeyCount: number;
    forbiddenCount: number;
    rateLimitedCount: number;
    badRequestCount: number;
    providerErrorCount: number;
    networkErrorCount: number;
    malformedResponseCount: number;
    unknownErrorCount: number;
  };
  startedAt: string;
  finishedAt: string;
  existingProductsShownCount: number;
}

const EMPTY_ERROR_CATEGORIES: ImportProgressPayload["enrichmentErrorCategories"] = {
  invalidKeyCount: 0,
  forbiddenCount: 0,
  rateLimitedCount: 0,
  badRequestCount: 0,
  providerErrorCount: 0,
  networkErrorCount: 0,
  malformedResponseCount: 0,
  unknownErrorCount: 0,
};

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asNullableString(value: unknown): string | null {
  const normalized = asString(value);
  return normalized || null;
}

function asNullableBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function asNullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function normalizeErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  if (typeof error === "string" && error.trim()) return error.trim();
  if (error && typeof error === "object") {
    const candidate = (error as { message?: unknown }).message;
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return fallback;
}

function classifyImportError(error: unknown): {
  category: WalmartImportErrorCategory;
  phase: WalmartImportFailurePhase;
  reason: string;
  statusCode: number | null;
  endpointFamily: string | null;
  correlationId: string | null;
  responseShape: string | null;
} {
  if (isWalmartImportFailureError(error)) {
    return {
      category: error.category,
      phase: error.phase,
      reason: normalizeErrorMessage(error, "Import failed."),
      statusCode: error.statusCode ?? null,
      endpointFamily: error.endpointFamily ?? null,
      correlationId: error.correlationId ?? null,
      responseShape: error.responseShapeSummary ?? null,
    };
  }

  const fallback = "Import failed due to an unknown runtime error.";
  const reason = normalizeErrorMessage(error, fallback);
  const lowered = reason.toLowerCase();

  if (
    lowered.includes("gateway time-out") ||
    lowered.includes("gateway timeout") ||
    lowered.includes("timed out at the gateway")
  ) {
    return {
      category: "import_gateway_timeout",
      phase: "gateway_timeout",
      reason,
      statusCode: 504,
      endpointFamily: "gateway",
      correlationId: null,
      responseShape: null,
    };
  }
  if (
    lowered.includes("missing walmart client id") ||
    lowered.includes("missing walmart client secret") ||
    lowered.includes("missing credentials") ||
    lowered.includes("walmart is not connected")
  ) {
    return {
      category: "walmart_credentials_missing",
      phase: "walmart_credentials",
      reason,
      statusCode: null,
      endpointFamily: "walmart_token",
      correlationId: null,
      responseShape: null,
    };
  }
  if (lowered.includes("http 401") || lowered.includes("unauthorized")) {
    return {
      category: "walmart_auth_failed",
      phase: "walmart_auth",
      reason,
      statusCode: 401,
      endpointFamily: "walmart_token",
      correlationId: null,
      responseShape: null,
    };
  }
  if (lowered.includes("token request failed") || lowered.includes("token")) {
    return {
      category: "walmart_token_failed",
      phase: "walmart_token",
      reason,
      statusCode: null,
      endpointFamily: "walmart_token",
      correlationId: null,
      responseShape: null,
    };
  }
  if (
    lowered.includes("catalog read failed") ||
    lowered.includes("/v3/items") ||
    lowered.includes("walmart products request failed")
  ) {
    return {
      category: "walmart_products_fetch_failed",
      phase: "walmart_products_fetch",
      reason,
      statusCode: null,
      endpointFamily: "walmart_catalog_items",
      correlationId: null,
      responseShape: null,
    };
  }
  if (lowered.includes("not valid json") || lowered.includes("invalid response")) {
    return {
      category: "walmart_products_response_invalid",
      phase: "walmart_products_parse",
      reason,
      statusCode: null,
      endpointFamily: "walmart_catalog_items",
      correlationId: null,
      responseShape: "invalid_json",
    };
  }
  if (lowered.includes("normalization")) {
    return {
      category: "product_normalization_failed",
      phase: "product_normalization",
      reason,
      statusCode: null,
      endpointFamily: null,
      correlationId: null,
      responseShape: null,
    };
  }
  if (lowered.includes("persist")) {
    return {
      category: "product_persistence_failed",
      phase: "product_persistence",
      reason,
      statusCode: null,
      endpointFamily: null,
      correlationId: null,
      responseShape: null,
    };
  }
  if (
    lowered.includes("database") ||
    lowered.includes("directoryiq_database_url") ||
    lowered.includes("relation") ||
    lowered.includes("postgres")
  ) {
    return {
      category: "database_failed",
      phase: "database",
      reason,
      statusCode: null,
      endpointFamily: null,
      correlationId: null,
      responseShape: null,
    };
  }
  if (lowered.includes("sign in") || lowered.includes("unauthorized")) {
    return {
      category: "user_scope_failed",
      phase: "user_scope",
      reason,
      statusCode: 401,
      endpointFamily: null,
      correlationId: null,
      responseShape: null,
    };
  }
  return {
    category: "import_unknown_error",
    phase: "import_unknown",
    reason,
    statusCode: null,
    endpointFamily: null,
    correlationId: null,
    responseShape: null,
  };
}

function hashUserIdForLog(userId: string | null): string | null {
  if (!userId) return null;
  return crypto.createHash("sha256").update(userId).digest("hex").slice(0, 12);
}

function buildSuccessProgress(input: {
  result: WalmartImportResult;
  startedAt: string;
  existingProductsShownCount: number;
}): ImportProgressPayload {
  const result = input.result;
  const diagnostics = result.importDiagnostics;
  const hasImageDiagnostics =
    diagnostics?.imageFoundCount !== undefined ||
    diagnostics?.imageFromImportPayloadCount !== undefined ||
    diagnostics?.imageEnrichedCount !== undefined ||
    diagnostics?.imageFromWalmartSearchCount !== undefined ||
    diagnostics?.imageFromSerpApiBrandSearchThumbnailCount !== undefined ||
    diagnostics?.publicListingsDiscoveredViaSerpApiBrandSearchCount !== undefined ||
    diagnostics?.serpApiBrandSearchAmbiguousCount !== undefined ||
    diagnostics?.serpApiBrandSearchNoConfidentMatchCount !== undefined ||
    diagnostics?.imageFromSerpApiFallbackCount !== undefined ||
    diagnostics?.perProductSerpApiSearchesAttempted !== undefined ||
    diagnostics?.perProductSerpApiMatches !== undefined ||
    diagnostics?.perProductSerpApiThumbnailsSaved !== undefined ||
    diagnostics?.noConfidentMatchContinuedToFallback !== undefined ||
    diagnostics?.ambiguousContinuedToFallback !== undefined ||
    diagnostics?.ambiguousSkippedCount !== undefined ||
    diagnostics?.walmartItemSearchExactIdentifierMatchCount !== undefined ||
    diagnostics?.walmartItemSearchIdentifierNormalizedMatchCount !== undefined ||
    diagnostics?.walmartItemSearchIdentifierAssistedMatchCount !== undefined ||
    diagnostics?.walmartItemSearchMultipleCandidatesRejectedCount !== undefined ||
    diagnostics?.walmartItemSearchSingleCandidateNoImageCount !== undefined ||
    diagnostics?.walmartSearchNotFoundCount !== undefined ||
    diagnostics?.imageStillMissingCount !== undefined ||
    diagnostics?.imageNotFoundCount !== undefined ||
    diagnostics?.imageAmbiguousCount !== undefined ||
    diagnostics?.imageFailedCount !== undefined ||
    diagnostics?.imageSkippedNoProviderCount !== undefined ||
    diagnostics?.enrichmentQueuedCount !== undefined ||
    diagnostics?.enrichmentCompletedCount !== undefined ||
    diagnostics?.enrichmentProcessedCount !== undefined;
  const fetchedCount = result.importDiagnostics?.fetchedCount ?? result.fetchedCount ?? 0;
  const imageFoundCount = result.importDiagnostics?.imageFoundCount ?? 0;
  const imageFromImportPayloadCount = result.importDiagnostics?.imageFromImportPayloadCount ?? 0;
  const imageEnrichedCount =
    result.importDiagnostics?.imageEnrichedCount ??
    (hasImageDiagnostics ? Math.max(0, imageFoundCount - imageFromImportPayloadCount) : 0);
  const imageFromWalmartSearchCount = result.importDiagnostics?.imageFromWalmartSearchCount ?? 0;
  const imageFromSerpApiBrandSearchThumbnailCount =
    result.importDiagnostics?.imageFromSerpApiBrandSearchThumbnailCount ??
    result.importDiagnostics?.serpApiBrandSearchDiagnostics?.serpapi_brand_search_thumbnail_saved ??
    0;
  const publicListingsDiscoveredViaSerpApiBrandSearchCount =
    result.importDiagnostics?.publicListingsDiscoveredViaSerpApiBrandSearchCount ??
    result.importDiagnostics?.serpApiBrandSearchDiagnostics?.serpapi_brand_search_public_listing_matched ??
    0;
  const serpApiBrandSearchAmbiguousCount =
    result.importDiagnostics?.serpApiBrandSearchAmbiguousCount ??
    result.importDiagnostics?.serpApiBrandSearchDiagnostics?.serpapi_brand_search_ambiguous ??
    0;
  const serpApiBrandSearchNoConfidentMatchCount =
    result.importDiagnostics?.serpApiBrandSearchNoConfidentMatchCount ??
    result.importDiagnostics?.serpApiBrandSearchDiagnostics?.serpapi_brand_search_no_confident_match ??
    0;
  const imageFromSerpApiFallbackCount = result.importDiagnostics?.imageFromSerpApiFallbackCount ?? 0;
  const imageFromSerpApiProductGalleryCount =
    result.importDiagnostics?.imageFromSerpApiProductGalleryCount ?? 0;
  const imageFromSerpApiSearchFallbackCount =
    result.importDiagnostics?.imageFromSerpApiSearchFallbackCount ?? 0;
  const perProductSerpApiSearchesAttempted =
    result.importDiagnostics?.perProductSerpApiSearchesAttempted ??
    result.importDiagnostics?.serpApiPerProductDiagnostics?.serpapi_per_product_searches_attempted ??
    0;
  const perProductSerpApiMatches =
    result.importDiagnostics?.perProductSerpApiMatches ??
    result.importDiagnostics?.serpApiPerProductDiagnostics?.serpapi_per_product_matches ??
    0;
  const perProductSerpApiThumbnailsSaved =
    result.importDiagnostics?.perProductSerpApiThumbnailsSaved ??
    result.importDiagnostics?.serpApiPerProductDiagnostics?.serpapi_per_product_thumbnails_saved ??
    0;
  const noConfidentMatchContinuedToFallback =
    result.importDiagnostics?.noConfidentMatchContinuedToFallback ??
    result.importDiagnostics?.serpApiPerProductDiagnostics?.no_confident_match_continued_to_fallback ??
    0;
  const ambiguousContinuedToFallback =
    result.importDiagnostics?.ambiguousContinuedToFallback ??
    result.importDiagnostics?.serpApiPerProductDiagnostics?.ambiguous_continued_to_fallback ??
    0;
  const ambiguousSkippedCount =
    result.importDiagnostics?.ambiguousSkippedCount ??
    result.importDiagnostics?.serpApiPerProductDiagnostics?.ambiguous_skipped ??
    0;
  const walmartItemSearchExactIdentifierMatchCount =
    result.importDiagnostics?.walmartItemSearchExactIdentifierMatchCount ??
    result.importDiagnostics?.walmartItemSearchDiagnostics
      ?.walmart_item_search_exact_identifier_match ??
    0;
  const walmartItemSearchIdentifierNormalizedMatchCount =
    result.importDiagnostics?.walmartItemSearchIdentifierNormalizedMatchCount ??
    result.importDiagnostics?.walmartItemSearchDiagnostics
      ?.walmart_item_search_identifier_normalized_match ??
    0;
  const walmartItemSearchIdentifierAssistedMatchCount =
    result.importDiagnostics?.walmartItemSearchIdentifierAssistedMatchCount ??
    result.importDiagnostics?.walmartItemSearchDiagnostics
      ?.walmart_item_search_identifier_assisted_match ??
    0;
  const walmartItemSearchMultipleCandidatesRejectedCount =
    result.importDiagnostics?.walmartItemSearchMultipleCandidatesRejectedCount ??
    result.importDiagnostics?.walmartItemSearchDiagnostics
      ?.walmart_item_search_multiple_candidates_rejected ??
    0;
  const walmartItemSearchSingleCandidateNoImageCount =
    result.importDiagnostics?.walmartItemSearchSingleCandidateNoImageCount ??
    result.importDiagnostics?.walmartItemSearchDiagnostics
      ?.walmart_item_search_single_candidate_no_image ??
    0;
  const walmartSearchNotFoundCount = result.importDiagnostics?.walmartSearchNotFoundCount ?? 0;
  const imageStillMissingCount =
    result.importDiagnostics?.imageStillMissingCount ??
    (hasImageDiagnostics ? Math.max(0, result.importedCount - imageFoundCount) : 0);
  const imageNotFoundCount = result.importDiagnostics?.imageNotFoundCount ?? 0;
  const imageAmbiguousCount = result.importDiagnostics?.imageAmbiguousCount ?? 0;
  const imageFailedCount = result.importDiagnostics?.imageFailedCount ?? 0;
  const imageSkippedNoProviderCount = result.importDiagnostics?.imageSkippedNoProviderCount ?? 0;
  const enrichmentQueuedCount = result.importDiagnostics?.enrichmentQueuedCount ?? 0;
  const enrichmentCompletedCount =
    result.importDiagnostics?.enrichmentCompletedCount ??
    result.importDiagnostics?.enrichmentProcessedCount ??
    0;
  const missingCount = imageStillMissingCount;
  const providerConnected = result.importDiagnostics?.enrichmentProviderConnected ?? false;
  const providerStatus =
    result.importDiagnostics?.serpApiStatus ??
    (providerConnected ? "connected" : "not_connected");
  const providerStatusReason =
    result.importDiagnostics?.serpApiStatusReason ??
    (providerStatus === "not_connected" ? "SerpApi key is missing." : null);
  const providerCanAttempt = result.importDiagnostics?.serpApiCanAttempt ?? providerConnected;
  const noImageReason = result.importDiagnostics?.imageEnrichmentNoImageReason ?? null;
  const enrichmentBounded = Boolean(result.importDiagnostics?.imageEnrichmentBounded);
  const enrichmentBoundedLimit = result.importDiagnostics?.imageEnrichmentImportLimit ?? null;
  const enrichmentDeferredCount = result.importDiagnostics?.imageEnrichmentDeferredCount ?? 0;
  const shopifyProductsImported = result.importDiagnostics?.shopifyProductsImported ?? 0;
  const shopifyImagesImported = result.importDiagnostics?.shopifyImagesImported ?? 0;
  const walmartProductsMatchedToShopify =
    result.importDiagnostics?.walmartProductsMatchedToShopify ?? 0;
  const imagesAppliedFromShopify = result.importDiagnostics?.imagesAppliedFromShopify ?? 0;
  const ambiguousShopifyMatches = result.importDiagnostics?.ambiguousShopifyMatches ?? 0;
  const shopifyNoMatchCount = result.importDiagnostics?.shopifyNoMatchCount ?? 0;
  const shopifyNoImageAvailableCount =
    result.importDiagnostics?.shopifyNoImageAvailableCount ?? 0;
  const stillMissingAfterShopify = result.importDiagnostics?.stillMissingAfterShopify ?? imageStillMissingCount;
  const shopifyVariantSkuMatch = result.importDiagnostics?.shopifyVariantSkuMatch ?? 0;
  const shopifyVariantBarcodeMatch = result.importDiagnostics?.shopifyVariantBarcodeMatch ?? 0;
  const shopifyBarcodeNormalizedMatch = result.importDiagnostics?.shopifyBarcodeNormalizedMatch ?? 0;
  const shopifyTitleVendorMatch = result.importDiagnostics?.shopifyTitleVendorMatch ?? 0;
  const shopifyAmbiguousMatch = result.importDiagnostics?.shopifyAmbiguousMatch ?? 0;
  const shopifyNoMatch = result.importDiagnostics?.shopifyNoMatch ?? 0;
  const shopifyImageApplied = result.importDiagnostics?.shopifyImageApplied ?? 0;
  const shopifyNoImageAvailable = result.importDiagnostics?.shopifyNoImageAvailable ?? 0;
  const shopifyCatalogRefreshTriggered =
    result.importDiagnostics?.shopifyCatalogRefreshTriggered ?? false;
  const shopifyCatalogRefreshStatus =
    result.importDiagnostics?.shopifyCatalogRefreshStatus ?? "skipped";
  const shopifyCatalogRefreshReason =
    result.importDiagnostics?.shopifyCatalogRefreshReason ?? null;
  const shopifyReconcileError = result.importDiagnostics?.shopifyReconcileError ?? null;
  const enrichmentErrorCategories = {
    ...EMPTY_ERROR_CATEGORIES,
    ...(result.importDiagnostics?.enrichmentErrorCategories ?? {}),
  };
  const warningCount =
    imageStillMissingCount + imageAmbiguousCount + imageFailedCount + (shopifyReconcileError ? 1 : 0);
  const stage = warningCount > 0 ? "completed_with_warnings" : "complete";
  const rawPerProductDiagnostics = Array.isArray(
    result.importDiagnostics?.perProductAttemptDiagnostics
  )
    ? result.importDiagnostics.perProductAttemptDiagnostics
    : [];
  const perProductAttemptDiagnostics: ImportProgressPerProductDiagnostic[] = rawPerProductDiagnostics
    .map((entry) => asRecord(entry))
    .filter((entry): entry is Record<string, unknown> => entry !== null)
    .map((entry) => ({
      sku: asString(entry.sku),
      title: asString(entry.title),
      attemptedMethods: Array.isArray(entry.attemptedMethods)
        ? entry.attemptedMethods
          .map((method) => asString(method))
          .filter((method) => method.length > 0)
        : [],
      queryUsed: asNullableString(entry.queryUsed),
      walmartItemSearchQueryOrIdentifier: asNullableString(
        entry.walmartItemSearchQueryOrIdentifier
      ),
      walmartItemSearchMethod: asNullableString(entry.walmartItemSearchMethod),
      resultCount:
        typeof entry.resultCount === "number" && Number.isFinite(entry.resultCount)
          ? Math.max(0, Math.trunc(entry.resultCount))
          : 0,
      topCandidateTitle: asNullableString(entry.topCandidateTitle),
      topCandidateItemOrProductId: asNullableString(entry.topCandidateItemOrProductId),
      topCandidateProductId: asNullableString(entry.topCandidateProductId),
      topCandidateUsItemId: asNullableString(entry.topCandidateUsItemId),
      topCandidateThumbnailPresent: asNullableBoolean(entry.topCandidateThumbnailPresent),
      matchScore: asNullableNumber(entry.matchScore),
      confidence:
        entry.confidence === "high" ||
        entry.confidence === "medium" ||
        entry.confidence === "low"
          ? entry.confidence
          : null,
      rejectionReason: asNullableString(entry.rejectionReason),
      finalStatus:
        entry.finalStatus === "found" ||
        entry.finalStatus === "not_found" ||
        entry.finalStatus === "ambiguous" ||
        entry.finalStatus === "failed" ||
        entry.finalStatus === "not_synced"
          ? entry.finalStatus
          : "not_synced",
    }));

  return {
    stage,
    providerConnected,
    providerStatus,
    providerStatusReason,
    providerCanAttempt,
    noImageReason,
    enrichmentBounded,
    enrichmentBoundedLimit,
    enrichmentDeferredCount,
    totals: {
      importedCount: result.importedCount,
      fetchedCount,
      processedCount: enrichmentCompletedCount,
      queuedCount: enrichmentQueuedCount,
      imageFoundCount,
      imageFromImportPayloadCount,
      imageEnrichedCount,
      imageFromWalmartSearchCount,
      imageFromSerpApiBrandSearchThumbnailCount,
      publicListingsDiscoveredViaSerpApiBrandSearchCount,
      serpApiBrandSearchAmbiguousCount,
      serpApiBrandSearchNoConfidentMatchCount,
      imageFromSerpApiFallbackCount,
      imageFromSerpApiProductGalleryCount,
      imageFromSerpApiSearchFallbackCount,
      perProductSerpApiSearchesAttempted,
      perProductSerpApiMatches,
      perProductSerpApiThumbnailsSaved,
      noConfidentMatchContinuedToFallback,
      ambiguousContinuedToFallback,
      ambiguousSkippedCount,
      walmartItemSearchExactIdentifierMatchCount,
      walmartItemSearchIdentifierNormalizedMatchCount,
      walmartItemSearchIdentifierAssistedMatchCount,
      walmartItemSearchMultipleCandidatesRejectedCount,
      walmartItemSearchSingleCandidateNoImageCount,
      walmartSearchNotFoundCount,
      imageStillMissingCount,
      imageMissingCount: missingCount,
      imageNotFoundCount,
      imageAmbiguousCount,
      imageFailedCount,
      imageSkippedNoProviderCount,
      shopifyProductsImported,
      shopifyImagesImported,
      walmartProductsMatchedToShopify,
      imagesAppliedFromShopify,
      ambiguousShopifyMatches,
      shopifyNoMatchCount,
      shopifyNoImageAvailableCount,
      stillMissingAfterShopify,
      shopifyVariantSkuMatch,
      shopifyVariantBarcodeMatch,
      shopifyBarcodeNormalizedMatch,
      shopifyTitleVendorMatch,
      shopifyAmbiguousMatch,
      shopifyNoMatch,
      shopifyImageApplied,
      shopifyNoImageAvailable,
    },
    perProductAttemptDiagnostics,
    importErrorCategory: "none",
    importErrorReason: null,
    importErrorPhase: null,
    importErrorStatusCode: null,
    importErrorEndpointFamily: null,
    importErrorCorrelationId: null,
    importErrorResponseShape: null,
    shopifyCatalogRefreshTriggered,
    shopifyCatalogRefreshStatus,
    shopifyCatalogRefreshReason,
    shopifyReconcileError,
    enrichmentErrorCategories,
    startedAt: input.startedAt,
    finishedAt: new Date().toISOString(),
    existingProductsShownCount: input.existingProductsShownCount,
  };
}

export async function POST(req: NextRequest) {
  const startedAt = new Date().toISOString();
  let userId: string | null = null;
  let existingProductsShownCount = 0;

  try {
    const auth = await requireSignedInUser();
    userId = auth.userId ?? null;
    if (auth.unauthorizedResponse) {
      if (auth.unauthorizedResponse.status !== 401) {
        return auth.unauthorizedResponse;
      }
      return fail(401, "Please sign in before importing Walmart products.", "UNAUTHORIZED");
    }
    if (!userId) {
      return fail(401, "Please sign in before importing Walmart products.", "UNAUTHORIZED");
    }

    existingProductsShownCount = (await listWalmartProductsForUser(userId)).length;

    const body = (await req.json().catch(() => ({}))) as {
      mode?: unknown;
      continuationCursor?: unknown;
    };
    const modeIsInvalid = body.mode !== undefined && typeof body.mode !== "string";
    const continuationCursorIsInvalid =
      body.continuationCursor !== undefined &&
      body.continuationCursor !== null &&
      typeof body.continuationCursor !== "string";
    if (modeIsInvalid || continuationCursorIsInvalid) {
      const invalidReason = modeIsInvalid
        ? "Import request mode must be a string value."
        : "Import request continuationCursor must be a string or null.";
      const importProgress: ImportProgressPayload = {
        stage: "failed",
        providerConnected: false,
        providerStatus: "unknown_error",
        providerStatusReason: null,
        providerCanAttempt: false,
        noImageReason: null,
        enrichmentBounded: false,
        enrichmentBoundedLimit: null,
        enrichmentDeferredCount: 0,
        perProductAttemptDiagnostics: [],
        totals: {
          importedCount: 0,
          fetchedCount: 0,
          processedCount: 0,
          queuedCount: 0,
          imageFoundCount: 0,
          imageFromImportPayloadCount: 0,
          imageEnrichedCount: 0,
          imageFromWalmartSearchCount: 0,
          imageFromSerpApiBrandSearchThumbnailCount: 0,
          publicListingsDiscoveredViaSerpApiBrandSearchCount: 0,
          serpApiBrandSearchAmbiguousCount: 0,
          serpApiBrandSearchNoConfidentMatchCount: 0,
          imageFromSerpApiFallbackCount: 0,
          imageFromSerpApiProductGalleryCount: 0,
          imageFromSerpApiSearchFallbackCount: 0,
          perProductSerpApiSearchesAttempted: 0,
          perProductSerpApiMatches: 0,
          perProductSerpApiThumbnailsSaved: 0,
          noConfidentMatchContinuedToFallback: 0,
          ambiguousContinuedToFallback: 0,
          ambiguousSkippedCount: 0,
          walmartItemSearchExactIdentifierMatchCount: 0,
          walmartItemSearchIdentifierNormalizedMatchCount: 0,
          walmartItemSearchIdentifierAssistedMatchCount: 0,
          walmartItemSearchMultipleCandidatesRejectedCount: 0,
          walmartItemSearchSingleCandidateNoImageCount: 0,
          walmartSearchNotFoundCount: 0,
          imageStillMissingCount: 0,
          imageMissingCount: 0,
          imageNotFoundCount: 0,
          imageAmbiguousCount: 0,
          imageFailedCount: 0,
          imageSkippedNoProviderCount: 0,
          shopifyProductsImported: 0,
          shopifyImagesImported: 0,
          walmartProductsMatchedToShopify: 0,
          imagesAppliedFromShopify: 0,
          ambiguousShopifyMatches: 0,
          shopifyNoMatchCount: 0,
          shopifyNoImageAvailableCount: 0,
          stillMissingAfterShopify: 0,
          shopifyVariantSkuMatch: 0,
          shopifyVariantBarcodeMatch: 0,
          shopifyBarcodeNormalizedMatch: 0,
          shopifyTitleVendorMatch: 0,
          shopifyAmbiguousMatch: 0,
          shopifyNoMatch: 0,
          shopifyImageApplied: 0,
          shopifyNoImageAvailable: 0,
        },
        importErrorCategory: "import_request_invalid",
        importErrorReason: invalidReason,
        importErrorPhase: "request_validation",
        importErrorStatusCode: 400,
        importErrorEndpointFamily: null,
        importErrorCorrelationId: null,
        importErrorResponseShape: null,
        shopifyCatalogRefreshTriggered: false,
        shopifyCatalogRefreshStatus: "skipped",
        shopifyCatalogRefreshReason: null,
        shopifyReconcileError: null,
        enrichmentErrorCategories: {
          ...EMPTY_ERROR_CATEGORIES,
        },
        startedAt,
        finishedAt: new Date().toISOString(),
        existingProductsShownCount,
      };
      return NextResponse.json(
        {
          ok: false,
          message: importProgress.importErrorReason,
          error: {
            code: "IMPORT_REQUEST_INVALID",
            message: importProgress.importErrorReason,
            reqId: crypto.randomUUID(),
          },
          importProgress,
        },
        { status: 400 }
      );
    }
    const isRetryMode =
      typeof body.mode === "string" && body.mode.trim().toLowerCase() === "retry_image_enrichment";
    const continuationCursor =
      typeof body.continuationCursor === "string" && body.continuationCursor.trim().length > 0
        ? body.continuationCursor.trim()
        : null;

    const result = isRetryMode
      ? await retryWalmartPublicImageEnrichmentForUser(userId)
      : await importWalmartProducts(userId, {
          boundedRuntime: true,
          maxCatalogPages: 1,
          startCursor: continuationCursor,
        });
    const hasMore =
      !isRetryMode && Boolean(result.importDiagnostics?.hasMoreCatalogPages);
    const nextCursor =
      hasMore && typeof result.importDiagnostics?.nextCatalogCursor === "string"
        ? result.importDiagnostics.nextCatalogCursor
        : null;

    const progress = buildSuccessProgress({
      result,
      startedAt,
      existingProductsShownCount,
    });

    if (!isRetryMode && !hasMore) {
      const importRunSkus = Array.isArray(result.importDiagnostics?.importRunSkus)
        ? result.importDiagnostics?.importRunSkus
        : [];
      void queueWalmartPostImportLiveHydrationForUser({
        userId,
        importedSkus: importRunSkus,
      });
    }

    const summary = `Imported ${progress.totals.importedCount} products. Images from import payload: ${progress.totals.imageFromImportPayloadCount}. Walmart Item Search images: ${progress.totals.imageFromWalmartSearchCount}. SerpApi brand-search thumbnails: ${progress.totals.imageFromSerpApiBrandSearchThumbnailCount}. SerpApi per-product searches attempted: ${progress.totals.perProductSerpApiSearchesAttempted}. SerpApi per-product matches: ${progress.totals.perProductSerpApiMatches}. SerpApi product gallery images: ${progress.totals.imageFromSerpApiProductGalleryCount}. SerpApi per-product search images: ${progress.totals.imageFromSerpApiSearchFallbackCount}. Brand-search ambiguous matches: ${progress.totals.serpApiBrandSearchAmbiguousCount}. Brand-search no confident match: ${progress.totals.serpApiBrandSearchNoConfidentMatchCount}. Shopify products imported: ${progress.totals.shopifyProductsImported}. Shopify images imported: ${progress.totals.shopifyImagesImported}. Walmart products matched to Shopify: ${progress.totals.walmartProductsMatchedToShopify}. Shopify images applied: ${progress.totals.imagesAppliedFromShopify}. Shopify ambiguous matches: ${progress.totals.ambiguousShopifyMatches}. Shopify no match: ${progress.totals.shopifyNoMatchCount}. Processed this run: ${progress.totals.processedCount}. Total still missing: ${progress.totals.imageStillMissingCount}. Queued for remaining retry: ${Math.max(0, progress.totals.queuedCount - progress.totals.processedCount)}. Provider failed: ${progress.totals.imageFailedCount}.`;
    const shopifyReconcileErrorSuffix = progress.shopifyReconcileError
      ? ` Shopify reconcile warning: ${progress.shopifyReconcileError}.`
      : "";
    const message =
      progress.totals.importedCount > 0
        ? isRetryMode
          ? `Image enrichment retry completed. ${summary}${shopifyReconcileErrorSuffix}`
          : `${summary}${shopifyReconcileErrorSuffix}`
        : isRetryMode
        ? "Image enrichment retry completed with zero products."
        : `Walmart import completed with zero products. fetchedCount=${progress.totals.fetchedCount}, payloadShape=${
            result.importDiagnostics?.payloadShape ?? "unknown"
          }.${shopifyReconcileErrorSuffix}`;

    return ok({
      ok: true,
      ...result,
      hasMore,
      nextCursor,
      message,
      importProgress: progress,
    });
  } catch (error) {
    const classified = classifyImportError(error);
    const partialTotals =
      error &&
      typeof error === "object" &&
      "partialProgress" in error &&
      error.partialProgress &&
      typeof error.partialProgress === "object"
        ? (error.partialProgress as Partial<ImportProgressTotals>)
        : null;

    let providerStatus: WalmartSerpApiProviderStatus = "unknown_error";
    let providerStatusReason: string | null = "SerpApi status could not be determined.";
    let providerConnected = false;
    let providerCanAttempt = false;

    if (userId) {
      try {
        const serpApiCredentials = await getSerpApiCredentialsForUser(userId);
        providerConnected = serpApiCredentials.connected;
        providerCanAttempt = Boolean(serpApiCredentials.connected && serpApiCredentials.apiKey);
        providerStatus = serpApiCredentials.status === "connected" ? "connected" : "not_connected";
        providerStatusReason =
          serpApiCredentials.statusReason ??
          (providerStatus === "not_connected" ? "SerpApi key is missing." : null);
      } catch {
        providerStatus = "unknown_error";
        providerStatusReason = "SerpApi status lookup failed.";
      }

      if (existingProductsShownCount === 0) {
        try {
          existingProductsShownCount = (await listWalmartProductsForUser(userId)).length;
        } catch {
          existingProductsShownCount = 0;
        }
      }
    }

    const importProgress: ImportProgressPayload = {
      stage: "failed",
      providerConnected,
      providerStatus,
      providerStatusReason,
      providerCanAttempt,
      noImageReason: null,
      enrichmentBounded: false,
      enrichmentBoundedLimit: null,
      enrichmentDeferredCount: 0,
      perProductAttemptDiagnostics: [],
      totals: {
        importedCount: partialTotals?.importedCount ?? 0,
        fetchedCount: partialTotals?.fetchedCount ?? 0,
        processedCount: partialTotals?.processedCount ?? 0,
        queuedCount: partialTotals?.queuedCount ?? 0,
        imageFoundCount: partialTotals?.imageFoundCount ?? 0,
        imageFromImportPayloadCount: 0,
        imageEnrichedCount: 0,
        imageFromWalmartSearchCount: 0,
        imageFromSerpApiBrandSearchThumbnailCount: 0,
        publicListingsDiscoveredViaSerpApiBrandSearchCount: 0,
        serpApiBrandSearchAmbiguousCount: 0,
        serpApiBrandSearchNoConfidentMatchCount: 0,
        imageFromSerpApiFallbackCount: 0,
        imageFromSerpApiProductGalleryCount: 0,
        imageFromSerpApiSearchFallbackCount: 0,
        perProductSerpApiSearchesAttempted: 0,
        perProductSerpApiMatches: 0,
        perProductSerpApiThumbnailsSaved: 0,
        noConfidentMatchContinuedToFallback: 0,
        ambiguousContinuedToFallback: 0,
        ambiguousSkippedCount: 0,
        walmartItemSearchExactIdentifierMatchCount: 0,
        walmartItemSearchIdentifierNormalizedMatchCount: 0,
        walmartItemSearchIdentifierAssistedMatchCount: 0,
        walmartItemSearchMultipleCandidatesRejectedCount: 0,
        walmartItemSearchSingleCandidateNoImageCount: 0,
        walmartSearchNotFoundCount: 0,
        imageStillMissingCount: partialTotals?.imageMissingCount ?? 0,
        imageMissingCount: partialTotals?.imageMissingCount ?? 0,
        imageNotFoundCount: partialTotals?.imageNotFoundCount ?? 0,
        imageAmbiguousCount: partialTotals?.imageAmbiguousCount ?? 0,
        imageFailedCount: partialTotals?.imageFailedCount ?? 0,
        imageSkippedNoProviderCount: partialTotals?.imageSkippedNoProviderCount ?? 0,
        shopifyProductsImported: 0,
        shopifyImagesImported: 0,
        walmartProductsMatchedToShopify: 0,
        imagesAppliedFromShopify: 0,
        ambiguousShopifyMatches: 0,
        shopifyNoMatchCount: 0,
        shopifyNoImageAvailableCount: 0,
        stillMissingAfterShopify: 0,
        shopifyVariantSkuMatch: 0,
        shopifyVariantBarcodeMatch: 0,
        shopifyBarcodeNormalizedMatch: 0,
        shopifyTitleVendorMatch: 0,
        shopifyAmbiguousMatch: 0,
        shopifyNoMatch: 0,
        shopifyImageApplied: 0,
        shopifyNoImageAvailable: 0,
      },
      importErrorCategory: classified.category,
      importErrorReason: classified.reason,
      importErrorPhase: classified.phase,
      importErrorStatusCode: classified.statusCode,
      importErrorEndpointFamily: classified.endpointFamily,
      importErrorCorrelationId: classified.correlationId,
      importErrorResponseShape: classified.responseShape,
      shopifyCatalogRefreshTriggered: false,
      shopifyCatalogRefreshStatus: "skipped",
      shopifyCatalogRefreshReason: null,
      shopifyReconcileError: null,
      enrichmentErrorCategories: {
        ...EMPTY_ERROR_CATEGORIES,
      },
      startedAt,
      finishedAt: new Date().toISOString(),
      existingProductsShownCount,
    };

    console.error("[ecomviper:walmart:import] failed", {
      phase: classified.phase,
      category: classified.category,
      statusCode: classified.statusCode,
      endpointFamily: classified.endpointFamily,
      correlationId: classified.correlationId,
      responseShape: classified.responseShape,
      userScope: hashUserIdForLog(userId),
      fetchedCount: importProgress.totals.fetchedCount,
      importedCount: importProgress.totals.importedCount,
    });

    return NextResponse.json(
      {
        ok: false,
        message: classified.reason,
        error: {
          code: "IMPORT_FAILED",
          message: classified.reason,
          reqId: crypto.randomUUID(),
        },
        importProgress,
      },
      { status: 500 }
    );
  }
}
