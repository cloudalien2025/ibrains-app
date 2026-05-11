export const runtime = "nodejs";

import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { fail, ok } from "@/app/api/ecomviper/walmart/_utils/response";
import { requireSignedInUser } from "@/lib/auth/requireSignedInUser";
import {
  importWalmartProducts,
  isWalmartImportFailureError,
  listWalmartProductsForUser,
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
  imageStillMissingCount: number;
  imageMissingCount: number;
  imageNotFoundCount: number;
  imageAmbiguousCount: number;
  imageFailedCount: number;
  imageSkippedNoProviderCount: number;
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
  importErrorCategory: WalmartImportErrorCategory;
  importErrorReason: string | null;
  importErrorPhase: WalmartImportFailurePhase | null;
  importErrorStatusCode: number | null;
  importErrorEndpointFamily: string | null;
  importErrorCorrelationId: string | null;
  importErrorResponseShape: string | null;
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
  const enrichmentErrorCategories = {
    ...EMPTY_ERROR_CATEGORIES,
    ...(result.importDiagnostics?.enrichmentErrorCategories ?? {}),
  };
  const warningCount = imageStillMissingCount + imageAmbiguousCount + imageFailedCount;
  const stage = warningCount > 0 ? "completed_with_warnings" : "complete";

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
      imageStillMissingCount,
      imageMissingCount: missingCount,
      imageNotFoundCount,
      imageAmbiguousCount,
      imageFailedCount,
      imageSkippedNoProviderCount,
    },
    importErrorCategory: "none",
    importErrorReason: null,
    importErrorPhase: null,
    importErrorStatusCode: null,
    importErrorEndpointFamily: null,
    importErrorCorrelationId: null,
    importErrorResponseShape: null,
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

    const body = (await req.json().catch(() => ({}))) as { mode?: unknown };
    if (body.mode !== undefined && typeof body.mode !== "string") {
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
        totals: {
          importedCount: 0,
          fetchedCount: 0,
          processedCount: 0,
          queuedCount: 0,
          imageFoundCount: 0,
          imageFromImportPayloadCount: 0,
          imageEnrichedCount: 0,
          imageStillMissingCount: 0,
          imageMissingCount: 0,
          imageNotFoundCount: 0,
          imageAmbiguousCount: 0,
          imageFailedCount: 0,
          imageSkippedNoProviderCount: 0,
        },
        importErrorCategory: "import_request_invalid",
        importErrorReason: "Import request mode must be a string value.",
        importErrorPhase: "request_validation",
        importErrorStatusCode: 400,
        importErrorEndpointFamily: null,
        importErrorCorrelationId: null,
        importErrorResponseShape: null,
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

    const result = isRetryMode
      ? await retryWalmartPublicImageEnrichmentForUser(userId)
      : await importWalmartProducts(userId, {
          boundedRuntime: true,
        });

    const progress = buildSuccessProgress({
      result,
      startedAt,
      existingProductsShownCount,
    });

    const summary = `Imported ${progress.totals.importedCount} products. Images found: ${progress.totals.imageFoundCount}. Missing: ${progress.totals.imageMissingCount}. Ambiguous: ${progress.totals.imageAmbiguousCount}. Failed: ${progress.totals.imageFailedCount}.`;
    const message =
      progress.totals.importedCount > 0
        ? isRetryMode
          ? `Image enrichment retry completed. ${summary}`
          : summary
        : isRetryMode
        ? "Image enrichment retry completed with zero products."
        : `Walmart import completed with zero products. fetchedCount=${progress.totals.fetchedCount}, payloadShape=${
            result.importDiagnostics?.payloadShape ?? "unknown"
          }.`;

    return ok({
      ok: true,
      ...result,
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
      totals: {
        importedCount: partialTotals?.importedCount ?? 0,
        fetchedCount: partialTotals?.fetchedCount ?? 0,
        processedCount: partialTotals?.processedCount ?? 0,
        queuedCount: partialTotals?.queuedCount ?? 0,
        imageFoundCount: partialTotals?.imageFoundCount ?? 0,
        imageFromImportPayloadCount: 0,
        imageEnrichedCount: 0,
        imageStillMissingCount: partialTotals?.imageMissingCount ?? 0,
        imageMissingCount: partialTotals?.imageMissingCount ?? 0,
        imageNotFoundCount: partialTotals?.imageNotFoundCount ?? 0,
        imageAmbiguousCount: partialTotals?.imageAmbiguousCount ?? 0,
        imageFailedCount: partialTotals?.imageFailedCount ?? 0,
        imageSkippedNoProviderCount: partialTotals?.imageSkippedNoProviderCount ?? 0,
      },
      importErrorCategory: classified.category,
      importErrorReason: classified.reason,
      importErrorPhase: classified.phase,
      importErrorStatusCode: classified.statusCode,
      importErrorEndpointFamily: classified.endpointFamily,
      importErrorCorrelationId: classified.correlationId,
      importErrorResponseShape: classified.responseShape,
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
