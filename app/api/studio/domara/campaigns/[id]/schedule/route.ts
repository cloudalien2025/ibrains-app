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
import { runCasaHudScheduleAgent } from "@/lib/studio/domara/campaign-execution-engine";

export const runtime = "nodejs";

function errorResponse(status: number, message: string, code: string, reqId = crypto.randomUUID()) {
  return NextResponse.json({ ok: false, error: { message, code, reqId } }, { status });
}

function parseScheduledAt(body: unknown): string | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const value = (body as { scheduledAt?: unknown }).scheduledAt;
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function isFutureSchedule(value: string): boolean {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && parsed > Date.now() + 60_000;
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
      return errorResponse(400, "CasaFlix needs a valid campaign id before it can schedule.", "INVALID_INPUT", reqId);
    }

    const scheduledAt = parseScheduledAt(await request.json().catch(() => null));
    if (!scheduledAt || !isFutureSchedule(scheduledAt)) {
      return errorResponse(
        400,
        "Choose a future publish time at least one minute ahead before CasaFlix can schedule this campaign.",
        "INVALID_SCHEDULE_TIME",
        reqId,
      );
    }

    const storeAvailable = await isCasaHudCampaignStoreAvailable();
    if (!storeAvailable) {
      return errorResponse(503, "CasaFlix storage is not ready yet.", "CASAHUD_STORE_UNAVAILABLE", reqId);
    }

    const campaign = await getCasaHudCampaign(userId, campaignId);
    if (!campaign) {
      return errorResponse(404, "CasaFlix could not find that campaign.", "NOT_FOUND", reqId);
    }

    if (campaign.youtubePackageStatus !== "package_prepared") {
      return errorResponse(
        409,
        "CasaFlix needs the completed YouTube package before it can schedule this campaign.",
        "YOUTUBE_PACKAGE_REQUIRED",
        reqId,
      );
    }

    const youtube = await resolveCasaHudYouTubeExecutionContext(userId);
    const result = await runCasaHudScheduleAgent(campaign, youtube, scheduledAt);
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
                  ? "SCHEDULE_BLOCKED"
                  : youtube.connected
                    ? "YOUTUBE_SCHEDULE_UNAVAILABLE"
                    : "YOUTUBE_CONNECTION_REQUIRED",
              reqId,
            },
      },
      { status: result.httpStatus },
    );
  } catch (error) {
    if (isCasaHudCampaignStoreUnavailable(error)) {
      return errorResponse(503, "CasaFlix storage is not ready yet.", "CASAHUD_STORE_UNAVAILABLE", reqId);
    }

    console.error("CasaFlix schedule execution failed", { reqId, error });
    return errorResponse(
      500,
      "CasaFlix could not schedule this campaign right now. Try again in a moment.",
      "SCHEDULE_FAILED",
      reqId,
    );
  }
}
