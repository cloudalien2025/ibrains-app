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
  applyCasaHudMediaPlan,
  toCasaHudCampaignSummary,
} from "@/lib/studio/domara/campaigns";
import { deriveCasaHudWorkingListings } from "@/lib/studio/domara/listing-working-set";
import { runCasaHudMediaPlanning } from "@/lib/studio/domara/media-planning-engine";

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
      return errorResponse(400, "CasaFlix needs a valid campaign id before it can build the media plan.", "INVALID_INPUT", reqId);
    }

    const campaignStoreAvailable = await isCasaHudCampaignStoreAvailable();
    if (!campaignStoreAvailable) {
      return errorResponse(503, "CasaFlix storage is not ready yet.", "CASAHUD_STORE_UNAVAILABLE", reqId);
    }

    const campaign = await getCasaHudCampaign(userId, campaignId);
    if (!campaign) {
      return errorResponse(404, "CasaFlix could not find that campaign.", "NOT_FOUND", reqId);
    }
    if (deriveCasaHudWorkingListings(campaign).length === 0) {
      return errorResponse(
        409,
        "CasaFlix needs at least one complete listing before it can assemble the visual plan.",
        "APPROVED_LISTINGS_REQUIRED",
        reqId,
      );
    }
    if (campaign.locationIntelligenceStatus !== "location_intelligence_completed") {
      return errorResponse(
        409,
        "CasaFlix needs location intelligence before it can assemble the visual plan.",
        "LOCATION_INTELLIGENCE_REQUIRED",
        reqId,
      );
    }
    if (campaign.scriptGenerationStatus !== "script_generated" || campaign.scriptSegments.length === 0) {
      return errorResponse(
        409,
        "CasaFlix needs the completed script package before it can assemble the visual plan.",
        "SCRIPT_REQUIRED",
        reqId,
      );
    }

    const mediaPlan = runCasaHudMediaPlanning(campaign);
    const updatedCampaign = applyCasaHudMediaPlan(campaign, mediaPlan);
    await saveCasaHudCampaign(userId, updatedCampaign);

    return NextResponse.json({
      ok: true,
      reqId,
      campaign: updatedCampaign,
      summary: toCasaHudCampaignSummary(updatedCampaign),
      message: `Media plan ready. "${updatedCampaign.name}" now includes the visual production package.`,
    });
  } catch (error) {
    if (isCasaHudCampaignStoreUnavailable(error)) {
      return errorResponse(503, "CasaFlix storage is not ready yet.", "CASAHUD_STORE_UNAVAILABLE", reqId);
    }

    console.error("CasaFlix media planning failed", { reqId, error });
    return errorResponse(
      500,
      "CasaFlix could not assemble the visual plan right now. Try again in a moment.",
      "MEDIA_PLANNING_FAILED",
      reqId,
    );
  }
}
