import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import {
  getCasaHudCampaign,
  isCasaHudCampaignStoreAvailable,
  isCasaHudCampaignStoreUnavailable,
  saveCasaHudCampaign,
} from "@/lib/studio/domara/campaign-repository";
import {
  applyCasaHudImportedListingCandidates,
  toCasaHudCampaignSummary,
} from "@/lib/studio/domara/campaigns";
import { importCasaHudListingUrls } from "@/lib/studio/domara/campaign-listing-url-importer";

export const runtime = "nodejs";

function errorResponse(status: number, message: string, code: string, reqId = crypto.randomUUID()) {
  return NextResponse.json({ ok: false, error: { message, code, reqId } }, { status });
}

function buildImportMessage(params: {
  importedCount: number;
  partialCount: number;
  manualDraftCount: number;
  duplicateCount: number;
  searchPageCount: number;
  invalidCount: number;
  failedCount: number;
}) {
  const parts = [
    params.importedCount > 0 ? `Imported ${params.importedCount} fully extracted listing URL${params.importedCount === 1 ? "" : "s"}` : null,
    params.partialCount > 0 ? `added ${params.partialCount} partial import${params.partialCount === 1 ? "" : "s"}` : null,
    params.manualDraftCount > 0 ? `created ${params.manualDraftCount} manual draft${params.manualDraftCount === 1 ? "" : "s"}` : null,
    params.searchPageCount > 0 ? `detected ${params.searchPageCount} search page${params.searchPageCount === 1 ? "" : "s"}` : null,
    params.duplicateCount > 0 ? `skipped ${params.duplicateCount} duplicate${params.duplicateCount === 1 ? "" : "s"}` : null,
    params.invalidCount > 0 ? `rejected ${params.invalidCount} invalid URL${params.invalidCount === 1 ? "" : "s"}` : null,
    params.failedCount > 0 ? `${params.failedCount} URL${params.failedCount === 1 ? "" : "s"} could not be used` : null,
  ].filter(Boolean);

  if (parts.length === 0) return "CasaHUD processed the submitted listing URLs.";
  return `${parts.join("; ")}.`;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } },
) {
  const reqId = crypto.randomUUID();

  try {
    const userId = resolveUserId(request);
    await ensureUser(userId);

    const resolvedParams = await Promise.resolve(params);
    const campaignId = resolvedParams.id?.trim();
    if (!campaignId) {
      return errorResponse(400, "CasaHUD needs a valid campaign id before it can import listing URLs.", "INVALID_INPUT", reqId);
    }

    const campaignStoreAvailable = await isCasaHudCampaignStoreAvailable();
    if (!campaignStoreAvailable) {
      return errorResponse(503, "CasaHUD storage is not ready yet.", "CASAHUD_STORE_UNAVAILABLE", reqId);
    }

    const campaign = await getCasaHudCampaign(userId, campaignId);
    if (!campaign) {
      return errorResponse(404, "CasaHUD could not find that campaign.", "NOT_FOUND", reqId);
    }

    const payload = (await request.json().catch(() => null)) as { rawUrls?: string } | null;
    if (!payload?.rawUrls?.trim()) {
      return errorResponse(400, "Paste at least one listing URL to import.", "LISTING_URLS_REQUIRED", reqId);
    }

    const imported = await importCasaHudListingUrls({
      campaign,
      rawUrls: payload.rawUrls,
    });

    const importedCount = imported.importedCount || 0;
    const partialCount = imported.partialCount || 0;
    const manualDraftCount = imported.manualDraftCount || 0;
    const duplicateCount = imported.duplicateCount || 0;
    const searchPageCount = imported.searchPageCount || 0;
    const invalidCount = imported.invalidCount || 0;
    const failedCount = imported.failedCount || 0;
    const skippedCount = imported.skippedCount || 0;
    const persistedCount = importedCount + partialCount + manualDraftCount;

    if (persistedCount === 0) {
      const hasOnlyDuplicates = imported.results.every((result) => result.status === "duplicate");
      const hasOnlySearchPages = imported.results.every((result) => result.status === "search_results");
      return errorResponse(
        hasOnlyDuplicates ? 409 : 400,
        hasOnlyDuplicates
          ? "Every URL in this import is already on the campaign."
          : hasOnlySearchPages
            ? "This looks like a search results page. Paste individual listing URLs or choose listings to import."
            : "CasaHUD could not use any of the submitted URLs.",
        hasOnlyDuplicates ? "DUPLICATE_URLS" : hasOnlySearchPages ? "SEARCH_PAGE_DETECTED" : "NO_USABLE_URLS",
        reqId,
      );
    }

    const mergedCandidates = [...campaign.listingCandidates, ...imported.importedCandidates];
    const updatedCampaign = applyCasaHudImportedListingCandidates(campaign, {
      listingCandidates: mergedCandidates,
      discoveredAt: imported.importedAt,
      warnings: imported.warnings,
    });
    await saveCasaHudCampaign(userId, updatedCampaign);

    return NextResponse.json({
      ok: true,
      reqId,
      campaign: updatedCampaign,
      summary: toCasaHudCampaignSummary(updatedCampaign),
      importedCount,
      partialCount,
      manualDraftCount,
      duplicateCount,
      searchPageCount,
      invalidCount,
      failedCount,
      skippedCount,
      results: imported.results.map((result) => ({
        inputUrl: result.inputUrl,
        normalizedUrl: result.normalizedUrl,
        provider: result.provider,
        providerName: result.providerName,
        urlClassification: result.urlClassification,
        extractionStatus: result.extractionStatus,
        status: result.status,
        warnings: result.warnings,
        reason: result.reason,
        nextAction: result.nextAction,
        discoveredListingUrls: result.discoveredListingUrls,
        candidateId: result.candidate?.id,
      })),
      warnings: imported.warnings,
      message: buildImportMessage({
        importedCount,
        partialCount,
        manualDraftCount,
        duplicateCount,
        searchPageCount,
        invalidCount,
        failedCount,
      }),
    });
  } catch (error) {
    if (isCasaHudCampaignStoreUnavailable(error)) {
      return errorResponse(503, "CasaHUD storage is not ready yet.", "CASAHUD_STORE_UNAVAILABLE", reqId);
    }

    const message = error instanceof Error ? error.message : "CasaHUD could not import listing URLs right now.";
    if (/Paste at least one listing URL|Import up to \d+ listing URLs/.test(message)) {
      return errorResponse(400, message, "INVALID_INPUT", reqId);
    }

    console.error("CasaHUD listing URL import failed", { reqId, error });
    return errorResponse(
      500,
      "CasaHUD could not import those listing URLs right now. Try again in a moment.",
      "LISTING_URL_IMPORT_FAILED",
      reqId,
    );
  }
}
