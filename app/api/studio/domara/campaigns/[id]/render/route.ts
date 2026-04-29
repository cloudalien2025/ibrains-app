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
  applyCasaHudExecutionUpdate,
  toCasaHudCampaignSummary,
} from "@/lib/studio/domara/campaigns";
import { runCasaHudRenderAgent } from "@/lib/studio/domara/campaign-execution-engine";

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
      return errorResponse(400, "CasaHUD needs a valid campaign id before it can start rendering.", "INVALID_INPUT", reqId);
    }

    const storeAvailable = await isCasaHudCampaignStoreAvailable();
    if (!storeAvailable) {
      return errorResponse(503, "CasaHUD storage is not ready yet.", "CASAHUD_STORE_UNAVAILABLE", reqId);
    }

    const campaign = await getCasaHudCampaign(userId, campaignId);
    if (!campaign) {
      return errorResponse(404, "CasaHUD could not find that campaign.", "NOT_FOUND", reqId);
    }

    if (campaign.youtubePackageStatus !== "package_prepared" || (!campaign.renderPlan && !campaign.previewPackage)) {
      return errorResponse(
        409,
        "CasaHUD needs the completed YouTube package and render plan before it can render this campaign.",
        "RENDER_PLAN_REQUIRED",
        reqId,
      );
    }

    const result = await runCasaHudRenderAgent(campaign, { requestedBy: userId });
    const updatedCampaign = applyCasaHudExecutionUpdate(campaign, result.execution);
    await saveCasaHudCampaign(userId, updatedCampaign);

    return NextResponse.json(
      {
        ok: result.ok,
        reqId,
        campaign: updatedCampaign,
        summary: toCasaHudCampaignSummary(updatedCampaign),
        message: result.message,
        error: result.ok ? undefined : { message: result.message, code: result.httpStatus === 423 ? "RENDER_IN_PROGRESS" : "RENDER_BLOCKED", reqId },
      },
      { status: result.httpStatus },
    );
  } catch (error) {
    if (isCasaHudCampaignStoreUnavailable(error)) {
      return errorResponse(503, "CasaHUD storage is not ready yet.", "CASAHUD_STORE_UNAVAILABLE", reqId);
    }

    console.error("CasaHUD render execution failed", { reqId, error });
    return errorResponse(
      500,
      "CasaHUD could not render this campaign right now. Try again in a moment.",
      "RENDER_FAILED",
      reqId,
    );
  }
}
