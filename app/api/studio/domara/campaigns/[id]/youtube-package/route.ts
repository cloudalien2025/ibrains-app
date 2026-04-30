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
  applyCasaHudYouTubePackage,
  toCasaHudCampaignSummary,
} from "@/lib/studio/domara/campaigns";
import { runCasaHudYouTubePackageReview } from "@/lib/studio/domara/youtube-package-engine";

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
      return errorResponse(400, "CasaFlix needs a valid campaign id before it can build the YouTube package.", "INVALID_INPUT", reqId);
    }

    const campaignStoreAvailable = await isCasaHudCampaignStoreAvailable();
    if (!campaignStoreAvailable) {
      return errorResponse(503, "CasaFlix storage is not ready yet.", "CASAHUD_STORE_UNAVAILABLE", reqId);
    }

    const campaign = await getCasaHudCampaign(userId, campaignId);
    if (!campaign) {
      return errorResponse(404, "CasaFlix could not find that campaign.", "NOT_FOUND", reqId);
    }
    if (campaign.approvedListings.length === 0) {
      return errorResponse(
        409,
        "CasaFlix needs approved listings before it can build the YouTube package.",
        "APPROVED_LISTINGS_REQUIRED",
        reqId,
      );
    }
    if (campaign.locationIntelligenceStatus !== "location_intelligence_completed") {
      return errorResponse(
        409,
        "CasaFlix needs location intelligence before it can build the YouTube package.",
        "LOCATION_INTELLIGENCE_REQUIRED",
        reqId,
      );
    }
    if (campaign.scriptGenerationStatus !== "script_generated" || campaign.scriptSegments.length === 0) {
      return errorResponse(
        409,
        "CasaFlix needs the completed script package before it can build the YouTube package.",
        "SCRIPT_REQUIRED",
        reqId,
      );
    }
    if (campaign.mediaPlanningStatus !== "media_plan_built" || campaign.sceneAssetMapping.length === 0) {
      return errorResponse(
        409,
        "CasaFlix needs the completed media plan before it can build the YouTube package.",
        "MEDIA_PLAN_REQUIRED",
        reqId,
      );
    }

    const packageData = runCasaHudYouTubePackageReview(campaign);
    const updatedCampaign = applyCasaHudYouTubePackage(campaign, packageData);
    await saveCasaHudCampaign(userId, updatedCampaign);

    return NextResponse.json({
      ok: true,
      reqId,
      campaign: updatedCampaign,
      summary: toCasaHudCampaignSummary(updatedCampaign),
      message: `YouTube package ready. "${updatedCampaign.name}" now includes the review summary and render plan draft.`,
    });
  } catch (error) {
    if (isCasaHudCampaignStoreUnavailable(error)) {
      return errorResponse(503, "CasaFlix storage is not ready yet.", "CASAHUD_STORE_UNAVAILABLE", reqId);
    }

    console.error("CasaFlix YouTube package generation failed", { reqId, error });
    return errorResponse(
      500,
      "CasaFlix could not build the YouTube package right now. Try again in a moment.",
      "YOUTUBE_PACKAGE_FAILED",
      reqId,
    );
  }
}
