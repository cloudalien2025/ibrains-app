import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import {
  getStudioIntegrationSecret,
  isStudioIntegrationEncryptionConfigured,
  isStudioIntegrationStoreAvailable,
} from "@/app/api/studio/domara/_utils/integration-settings";
import {
  getCasaHudCampaign,
  isCasaHudCampaignStoreAvailable,
  isCasaHudCampaignStoreUnavailable,
  saveCasaHudCampaign,
} from "@/lib/studio/domara/campaign-repository";
import {
  applyCasaHudLocationIntelligence,
  toCasaHudCampaignSummary,
} from "@/lib/studio/domara/campaigns";
import { runCasaHudLocationIntelligence } from "@/lib/studio/domara/location-intelligence-engine";

export const runtime = "nodejs";

function errorResponse(status: number, message: string, code: string, reqId = crypto.randomUUID()) {
  return NextResponse.json({ ok: false, error: { message, code, reqId } }, { status });
}

async function resolveLocationProviderSecrets(userId: string) {
  const fallback = {
    googlePlacesApiKey: (process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY || "").trim() || null,
    mapboxAccessToken: (process.env.MAPBOX_ACCESS_TOKEN || "").trim() || null,
  };

  try {
    const canReadStoredSecrets =
      (await isStudioIntegrationStoreAvailable()) && isStudioIntegrationEncryptionConfigured();
    if (!canReadStoredSecrets) return fallback;

    const [googlePlaces, mapbox] = await Promise.all([
      getStudioIntegrationSecret(userId, "google_maps_places"),
      getStudioIntegrationSecret(userId, "mapbox"),
    ]);

    return {
      googlePlacesApiKey: googlePlaces?.secret?.trim() || fallback.googlePlacesApiKey,
      mapboxAccessToken: mapbox?.secret?.trim() || fallback.mapboxAccessToken,
    };
  } catch (error) {
    console.warn("CasaHUD location secret resolution fell back to workspace configuration", { error });
    return fallback;
  }
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
      return errorResponse(400, "CasaHUD needs a valid campaign id before it can build location intelligence.", "INVALID_INPUT", reqId);
    }

    const campaignStoreAvailable = await isCasaHudCampaignStoreAvailable();
    if (!campaignStoreAvailable) {
      return errorResponse(503, "CasaHUD storage is not ready yet.", "CASAHUD_STORE_UNAVAILABLE", reqId);
    }

    const campaign = await getCasaHudCampaign(userId, campaignId);
    if (!campaign) {
      return errorResponse(404, "CasaHUD could not find that campaign.", "NOT_FOUND", reqId);
    }
    if (campaign.approvedListings.length === 0) {
      return errorResponse(
        409,
        "CasaHUD needs approved listings before it can build location intelligence.",
        "APPROVED_LISTINGS_REQUIRED",
        reqId,
      );
    }

    const secrets = await resolveLocationProviderSecrets(userId);
    const locationIntelligence = await runCasaHudLocationIntelligence(campaign, secrets);
    const updatedCampaign = applyCasaHudLocationIntelligence(campaign, locationIntelligence);
    await saveCasaHudCampaign(userId, updatedCampaign);

    return NextResponse.json({
      ok: true,
      reqId,
      campaign: updatedCampaign,
      summary: toCasaHudCampaignSummary(updatedCampaign),
      message: `Location intelligence complete. "${updatedCampaign.name}" now includes place story, POIs, and map scene ideas.`,
    });
  } catch (error) {
    if (isCasaHudCampaignStoreUnavailable(error)) {
      return errorResponse(503, "CasaHUD storage is not ready yet.", "CASAHUD_STORE_UNAVAILABLE", reqId);
    }

    console.error("CasaHUD location intelligence failed", { reqId, error });
    return errorResponse(
      500,
      "CasaHUD could not build location intelligence right now. Try again in a moment.",
      "LOCATION_INTELLIGENCE_FAILED",
      reqId,
    );
  }
}
