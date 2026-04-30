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
  applyCasaHudScriptNarrative,
  toCasaHudCampaignSummary,
} from "@/lib/studio/domara/campaigns";
import { runCasaHudScriptNarrative } from "@/lib/studio/domara/script-narrative-engine";

export const runtime = "nodejs";

function errorResponse(status: number, message: string, code: string, reqId = crypto.randomUUID()) {
  return NextResponse.json({ ok: false, error: { message, code, reqId } }, { status });
}

async function resolveOpenAiSecret(userId: string) {
  const fallback = (process.env.OPENAI_API_KEY || "").trim() || null;

  try {
    const canReadStoredSecrets =
      (await isStudioIntegrationStoreAvailable()) && isStudioIntegrationEncryptionConfigured();
    if (!canReadStoredSecrets) return fallback;

    const openai = await getStudioIntegrationSecret(userId, "openai");
    return openai?.secret?.trim() || fallback;
  } catch (error) {
    console.warn("CasaFlix script secret resolution fell back to workspace configuration", { error });
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
      return errorResponse(400, "CasaFlix needs a valid campaign id before it can generate the script.", "INVALID_INPUT", reqId);
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
        "CasaFlix needs approved listings before it can write the script.",
        "APPROVED_LISTINGS_REQUIRED",
        reqId,
      );
    }
    if (campaign.locationIntelligenceStatus !== "location_intelligence_completed") {
      return errorResponse(
        409,
        "CasaFlix needs location intelligence before it can write the script.",
        "LOCATION_INTELLIGENCE_REQUIRED",
        reqId,
      );
    }

    const openAiApiKey = await resolveOpenAiSecret(userId);
    const script = await runCasaHudScriptNarrative(campaign, {
      openAiApiKey,
      providerTimeoutMs: 4_500,
    });
    const updatedCampaign = applyCasaHudScriptNarrative(campaign, script);
    await saveCasaHudCampaign(userId, updatedCampaign);

    return NextResponse.json({
      ok: true,
      reqId,
      campaign: updatedCampaign,
      summary: toCasaHudCampaignSummary(updatedCampaign),
      message: `Script ready. "${updatedCampaign.name}" now includes the review-ready narrative package.`,
    });
  } catch (error) {
    if (isCasaHudCampaignStoreUnavailable(error)) {
      return errorResponse(503, "CasaFlix storage is not ready yet.", "CASAHUD_STORE_UNAVAILABLE", reqId);
    }

    console.error("CasaFlix script generation failed", { reqId, error });
    return errorResponse(
      500,
      "CasaFlix could not generate the script right now. Try again in a moment.",
      "SCRIPT_GENERATION_FAILED",
      reqId,
    );
  }
}
