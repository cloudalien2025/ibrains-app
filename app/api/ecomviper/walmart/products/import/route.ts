export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { fail, ok } from "@/app/api/ecomviper/walmart/_utils/response";
import { requireSignedInUser } from "@/lib/auth/requireSignedInUser";
import {
  importWalmartProducts,
  retryWalmartPublicImageEnrichmentForUser,
} from "@/lib/ecomviper/walmart/walmart-products";

export async function POST(req: NextRequest) {
  try {
    const { userId, unauthorizedResponse } = await requireSignedInUser();
    if (unauthorizedResponse) {
      if (unauthorizedResponse.status !== 401) {
        return unauthorizedResponse;
      }
      return fail(401, "Please sign in before importing Walmart products.", "UNAUTHORIZED");
    }
    if (!userId) {
      return fail(401, "Please sign in before importing Walmart products.", "UNAUTHORIZED");
    }

    const body = (await req.json().catch(() => ({}))) as { mode?: unknown };
    const isRetryMode =
      typeof body.mode === "string" && body.mode.trim().toLowerCase() === "retry_image_enrichment";

    const result = isRetryMode
      ? await retryWalmartPublicImageEnrichmentForUser(userId)
      : await importWalmartProducts(userId);

    const fetchedCount = result.importDiagnostics?.fetchedCount ?? result.fetchedCount ?? 0;
    const payloadShape = result.importDiagnostics?.payloadShape ?? "unknown";
    const inventoryUnknownCount = result.importDiagnostics?.inventoryUnknownCount ?? 0;
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
    const providerConnected = result.importDiagnostics?.enrichmentProviderConnected ?? false;
    const noImageReason = result.importDiagnostics?.imageEnrichmentNoImageReason ?? null;
    const itemReportRequested = result.importDiagnostics?.itemReportRequested ?? false;
    const itemReportDownloaded = result.importDiagnostics?.itemReportDownloaded ?? false;
    const itemReportRowsParsed = result.importDiagnostics?.itemReportRowsParsed ?? 0;
    const itemReportRequestEndpointUsed = result.importDiagnostics?.itemReportRequestEndpointUsed ?? "n/a";
    const itemReportStatusEndpointUsed = result.importDiagnostics?.itemReportStatusEndpointUsed ?? "n/a";
    const itemReportDownloadEndpointUsed = result.importDiagnostics?.itemReportDownloadEndpointUsed ?? "n/a";
    const itemReportFailureCategory = result.importDiagnostics?.itemReportFailureCategory ?? "none";
    const sourceBreakdown = result.importDiagnostics?.imageSourceBreakdown;

    const missingCount = imageNotFoundCount + imageSkippedNoProviderCount;
    const warningCount = missingCount + imageAmbiguousCount + imageFailedCount;
    const stage: "complete" | "completed_with_warnings" =
      warningCount > 0 ? "completed_with_warnings" : "complete";

    const summary = `Imported ${result.importedCount} products. Images found ${imageFoundCount}, missing ${missingCount}, ambiguous ${imageAmbiguousCount}, failed ${imageFailedCount}.`;

    const inventoryNote =
      inventoryUnknownCount > 0
        ? ` Inventory pending for ${inventoryUnknownCount} SKU(s); quantity requires Walmart inventory sync.`
        : "";
    const imageNote = ` Image enrichment: queued=${enrichmentQueuedCount}, completed=${enrichmentCompletedCount}, found=${imageFoundCount}, notFound=${imageNotFoundCount}, ambiguous=${imageAmbiguousCount}, failed=${imageFailedCount}, skippedNoProvider=${imageSkippedNoProviderCount}. ItemReport requested=${itemReportRequested}, downloaded=${itemReportDownloaded}, rows=${itemReportRowsParsed}, requestEndpoint=${itemReportRequestEndpointUsed}, statusEndpoint=${itemReportStatusEndpointUsed}, downloadEndpoint=${itemReportDownloadEndpointUsed}, failureCategory=${itemReportFailureCategory}. Source breakdown: itemReport=${sourceBreakdown?.walmartItemReport ?? 0}, sellerCatalog=${sourceBreakdown?.walmartSellerCatalogSearch ?? 0}, itemSearch=${sourceBreakdown?.walmartItemSearch ?? 0}, publicListingSerpApi=${sourceBreakdown?.publicWalmartListingSerpApi ?? 0}.`;

    const message =
      result.importedCount > 0
        ? `${isRetryMode ? "Image enrichment retry completed." : summary}${inventoryNote}${imageNote}`
        : `${
            isRetryMode
              ? "Image enrichment retry completed with zero products."
              : `Walmart import completed with zero products. fetchedCount=${fetchedCount}, payloadShape=${payloadShape}.`
          }`;

    return ok({
      ok: true,
      ...result,
      message,
      importProgress: {
        stage,
        providerConnected,
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
      },
    });
  } catch (error) {
    return fail(500, error instanceof Error ? error.message : "Failed to import Walmart products.");
  }
}
