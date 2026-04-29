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

    if (imported.importedCount === 0) {
      const hasOnlyDuplicates = imported.results.every((result) => result.status === "duplicate");
      return errorResponse(
        hasOnlyDuplicates ? 409 : 400,
        hasOnlyDuplicates ? "Every URL in this import is already on the campaign." : "CasaHUD could not use any of the submitted URLs.",
        hasOnlyDuplicates ? "DUPLICATE_URLS" : "NO_USABLE_URLS",
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
      importedCount: imported.importedCount,
      duplicateCount: imported.duplicateCount,
      invalidCount: imported.invalidCount,
      failedCount: imported.failedCount,
      skippedCount: imported.skippedCount,
      results: imported.results.map((result) => ({
        inputUrl: result.inputUrl,
        normalizedUrl: result.normalizedUrl,
        status: result.status,
        warnings: result.warnings,
        reason: result.reason,
        candidateId: result.candidate?.id,
      })),
      warnings: imported.warnings,
      message: `Imported ${imported.importedCount} listing URL${imported.importedCount === 1 ? "" : "s"} and skipped ${imported.skippedCount}.`,
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
