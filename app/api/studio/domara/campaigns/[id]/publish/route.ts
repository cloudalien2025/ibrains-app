import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import { resolveCasaHudYouTubeExecutionContext } from "@/app/api/studio/domara/_utils/execution-context";
import {
  getCasaHudCampaign,
  isCasaHudCampaignStoreAvailable,
  isCasaHudCampaignStoreUnavailable,
  saveCasaHudCampaign,
} from "@/lib/studio/domara/campaign-repository";
import {
  applyCasaHudExecutionUpdate,
  toCasaHudCampaignSummary,
} from "@/lib/studio/domara/campaigns";
import { runCasaHudPublishAgent } from "@/lib/studio/domara/campaign-execution-engine";

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
      return errorResponse(400, "CasaHUD needs a valid campaign id before it can publish.", "INVALID_INPUT", reqId);
    }

    const storeAvailable = await isCasaHudCampaignStoreAvailable();
    if (!storeAvailable) {
      return errorResponse(503, "CasaHUD storage is not ready yet.", "CASAHUD_STORE_UNAVAILABLE", reqId);
    }

    const campaign = await getCasaHudCampaign(userId, campaignId);
    if (!campaign) {
      return errorResponse(404, "CasaHUD could not find that campaign.", "NOT_FOUND", reqId);
    }

    if (campaign.youtubePackageStatus !== "package_prepared") {
      return errorResponse(
        409,
        "CasaHUD needs the completed YouTube package before it can publish this campaign.",
        "YOUTUBE_PACKAGE_REQUIRED",
        reqId,
      );
    }

    const youtube = await resolveCasaHudYouTubeExecutionContext(userId);
    const result = await runCasaHudPublishAgent(campaign, youtube);
    const updatedCampaign = applyCasaHudExecutionUpdate(campaign, result.execution);
    await saveCasaHudCampaign(userId, updatedCampaign);

    return NextResponse.json(
      {
        ok: result.ok,
        reqId,
        campaign: updatedCampaign,
        summary: toCasaHudCampaignSummary(updatedCampaign),
        message: result.message,
        error: result.ok
          ? undefined
          : {
              message: result.message,
              code:
                result.httpStatus === 409
                  ? "PUBLISH_BLOCKED"
                  : youtube.connected
                    ? "YOUTUBE_UPLOAD_UNAVAILABLE"
                    : "YOUTUBE_CONNECTION_REQUIRED",
              reqId,
            },
      },
      { status: result.httpStatus },
    );
  } catch (error) {
    if (isCasaHudCampaignStoreUnavailable(error)) {
      return errorResponse(503, "CasaHUD storage is not ready yet.", "CASAHUD_STORE_UNAVAILABLE", reqId);
    }

    console.error("CasaHUD publish execution failed", { reqId, error });
    return errorResponse(
      500,
      "CasaHUD could not publish this campaign right now. Try again in a moment.",
      "PUBLISH_FAILED",
      reqId,
    );
  }
}
