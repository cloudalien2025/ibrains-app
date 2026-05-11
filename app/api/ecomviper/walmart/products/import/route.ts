export const runtime = "nodejs";

import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { fail, ok } from "@/app/api/ecomviper/walmart/_utils/response";
import { requireSignedInUser } from "@/lib/auth/requireSignedInUser";
import {
  importWalmartProducts,
  listWalmartProductsForUser,
  retryWalmartPublicImageEnrichmentForUser,
} from "@/lib/ecomviper/walmart/walmart-products";
import { getSerpApiCredentialsForUser } from "@/lib/ecomviper/walmart/serpapi-walmart-images";
import type {
  WalmartImportErrorCategory,
  WalmartImportResult,
  WalmartSerpApiProviderStatus,
} from "@/lib/ecomviper/walmart/walmart-types";

interface ImportProgressTotals {
  importedCount: number;
  fetchedCount: number;
  processedCount: number;
  queuedCount: number;
  imageFoundCount: number;
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
  totals: ImportProgressTotals;
  importErrorCategory: WalmartImportErrorCategory;
  importErrorReason: string | null;
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

function classifyImportError(error: unknown): {
  category: WalmartImportErrorCategory;
  reason: string;
} {
  const fallback = "Import failed.";
  const reason = error instanceof Error && error.message.trim() ? error.message.trim() : fallback;
  const lowered = reason.toLowerCase();

  if (lowered.includes("not connected")) {
    return {
      category: "walmart_not_connected",
      reason,
    };
  }
  if (lowered.includes("http 401") || lowered.includes("unauthorized") || lowered.includes("token")) {
    return {
      category: "walmart_auth",
      reason,
    };
  }
  if (lowered.includes("http 403") || lowered.includes("forbidden") || lowered.includes("permission")) {
    return {
      category: "walmart_permission",
      reason,
    };
  }
  if (lowered.includes("http 429") || lowered.includes("rate limit")) {
    return {
      category: "walmart_rate_limited",
      reason,
    };
  }
  if (lowered.includes("walmart catalog read failed") || lowered.includes("walmart")) {
    return {
      category: "walmart_provider_error",
      reason,
    };
  }
  return {
    category: "import_runtime_error",
    reason,
  };
}

function buildSuccessProgress(input: {
  result: WalmartImportResult;
  startedAt: string;
  existingProductsShownCount: number;
}): ImportProgressPayload {
  const result = input.result;
  const fetchedCount = result.importDiagnostics?.fetchedCount ?? result.fetchedCount ?? 0;
  const imageFoundCount = result.importDiagnostics?.imageFoundCount ?? 0;
  const imageNotFoundCount = result.importDiagnostics?.imageNotFoundCount ?? 0;
  const imageAmbiguousCount = result.importDiagnostics?.imageAmbiguousCount ?? 0;
  const imageFailedCount = result.importDiagnostics?.imageFailedCount ?? 0;
  const imageSkippedNoProviderCount = result.importDiagnostics?.imageSkippedNoProviderCount ?? 0;
  const enrichmentQueuedCount = result.importDiagnostics?.enrichmentQueuedCount ?? 0;
  const enrichmentCompletedCount =
    result.importDiagnostics?.enrichmentCompletedCount ??
    result.importDiagnostics?.enrichmentProcessedCount ??
    0;
  const missingCount = imageNotFoundCount + imageSkippedNoProviderCount;
  const providerConnected = result.importDiagnostics?.enrichmentProviderConnected ?? false;
  const providerStatus =
    result.importDiagnostics?.serpApiStatus ??
    (providerConnected ? "connected" : "not_connected");
  const providerStatusReason =
    result.importDiagnostics?.serpApiStatusReason ??
    (providerStatus === "not_connected" ? "SerpApi key is missing." : null);
  const providerCanAttempt = result.importDiagnostics?.serpApiCanAttempt ?? providerConnected;
  const noImageReason = result.importDiagnostics?.imageEnrichmentNoImageReason ?? null;
  const enrichmentErrorCategories = {
    ...EMPTY_ERROR_CATEGORIES,
    ...(result.importDiagnostics?.enrichmentErrorCategories ?? {}),
  };
  const warningCount = missingCount + imageAmbiguousCount + imageFailedCount;
  const stage = warningCount > 0 ? "completed_with_warnings" : "complete";

  return {
    stage,
    providerConnected,
    providerStatus,
    providerStatusReason,
    providerCanAttempt,
    noImageReason,
    totals: {
      importedCount: result.importedCount,
      fetchedCount,
      processedCount: enrichmentCompletedCount,
      queuedCount: enrichmentQueuedCount,
      imageFoundCount,
      imageMissingCount: missingCount,
      imageNotFoundCount,
      imageAmbiguousCount,
      imageFailedCount,
      imageSkippedNoProviderCount,
    },
    importErrorCategory: "none",
    importErrorReason: null,
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
    const isRetryMode =
      typeof body.mode === "string" && body.mode.trim().toLowerCase() === "retry_image_enrichment";

    const result = isRetryMode
      ? await retryWalmartPublicImageEnrichmentForUser(userId)
      : await importWalmartProducts(userId);

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
      totals: {
        importedCount: partialTotals?.importedCount ?? 0,
        fetchedCount: partialTotals?.fetchedCount ?? 0,
        processedCount: partialTotals?.processedCount ?? 0,
        queuedCount: partialTotals?.queuedCount ?? 0,
        imageFoundCount: partialTotals?.imageFoundCount ?? 0,
        imageMissingCount: partialTotals?.imageMissingCount ?? 0,
        imageNotFoundCount: partialTotals?.imageNotFoundCount ?? 0,
        imageAmbiguousCount: partialTotals?.imageAmbiguousCount ?? 0,
        imageFailedCount: partialTotals?.imageFailedCount ?? 0,
        imageSkippedNoProviderCount: partialTotals?.imageSkippedNoProviderCount ?? 0,
      },
      importErrorCategory: classified.category,
      importErrorReason: classified.reason,
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
