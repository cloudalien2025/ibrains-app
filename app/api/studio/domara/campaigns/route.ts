import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import {
  createCasaHudCampaignFromOpportunity,
  isCasaHudCampaignStoreAvailable,
  isCasaHudCampaignStoreUnavailable,
  listCasaHudCampaignSummaries,
} from "@/lib/studio/domara/campaign-repository";
import { parseCasaHudCampaignCreateBody, toCasaHudCampaignSummary } from "@/lib/studio/domara/campaigns";

export const runtime = "nodejs";

function errorResponse(status: number, message: string, code: string, reqId = crypto.randomUUID()) {
  return NextResponse.json({ ok: false, error: { message, code, reqId } }, { status });
}

export async function GET(request: NextRequest) {
  const reqId = crypto.randomUUID();

  try {
    const userId = resolveUserId(request);
    await ensureUser(userId);

    const storeAvailable = await isCasaHudCampaignStoreAvailable();
    if (!storeAvailable) {
      return NextResponse.json({
        ok: true,
        reqId,
        campaigns: [],
        storeAvailable: false,
        message: "CasaFlix storage is not ready yet.",
      });
    }

    const campaigns = await listCasaHudCampaignSummaries(userId);
    return NextResponse.json({
      ok: true,
      reqId,
      campaigns,
      storeAvailable: true,
    });
  } catch (error) {
    if (isCasaHudCampaignStoreUnavailable(error)) {
      return NextResponse.json({
        ok: true,
        reqId,
        campaigns: [],
        storeAvailable: false,
        message: "CasaFlix storage is not ready yet.",
      });
    }

    console.error("CasaFlix campaign list failed", { reqId, error });
    return errorResponse(
      500,
      "CasaFlix could not load recent campaigns right now. Try again in a moment.",
      "CAMPAIGN_LIST_FAILED",
      reqId,
    );
  }
}

export async function POST(request: NextRequest) {
  const reqId = crypto.randomUUID();

  try {
    const userId = resolveUserId(request);
    await ensureUser(userId);

    const storeAvailable = await isCasaHudCampaignStoreAvailable();
    if (!storeAvailable) {
      return errorResponse(503, "CasaFlix storage is not ready yet.", "CASAHUD_STORE_UNAVAILABLE", reqId);
    }

    const body = await request.json().catch(() => ({}));
    const parsed = parseCasaHudCampaignCreateBody(body);
    if (!parsed.ok) {
      return errorResponse(400, parsed.message, "INVALID_INPUT", reqId);
    }

    const allowDuplicate = body && typeof body === "object" && (body as Record<string, unknown>).allowDuplicate === true;
    const campaignNameOverrideRaw =
      body && typeof body === "object" && typeof (body as Record<string, unknown>).campaignNameOverride === "string"
        ? ((body as Record<string, unknown>).campaignNameOverride as string).trim()
        : "";
    const campaignNameOverride = campaignNameOverrideRaw || undefined;
    const requestedCampaignName = campaignNameOverride || parsed.opportunity.selectedTitle.title.trim();

    const existingCampaigns = await listCasaHudCampaignSummaries(userId, 100);
    const duplicate = existingCampaigns.find(
      (campaign) => campaign.name.trim().toLowerCase() === requestedCampaignName.trim().toLowerCase(),
    );
    if (duplicate && !allowDuplicate) {
      return NextResponse.json(
        {
          ok: false,
          reqId,
          error: {
            message:
              'A campaign with this title already exists. Resume it, choose a new campaign name, or create a duplicate intentionally.',
            code: "DUPLICATE_CAMPAIGN_TITLE",
          },
          duplicateCampaignId: duplicate.id,
          duplicateCampaignName: duplicate.name,
        },
        { status: 409 },
      );
    }

    const campaign = await createCasaHudCampaignFromOpportunity(userId, parsed.opportunity, {
      campaignNameOverride,
    });
    return NextResponse.json({
      ok: true,
      reqId,
      campaign,
      summary: toCasaHudCampaignSummary(campaign),
      message: `Campaign saved. "${campaign.name}" is ready for Property Discovery.`,
    });
  } catch (error) {
    if (isCasaHudCampaignStoreUnavailable(error)) {
      return errorResponse(503, "CasaFlix storage is not ready yet.", "CASAHUD_STORE_UNAVAILABLE", reqId);
    }

    console.error("CasaFlix campaign creation failed", { reqId, error });
    return errorResponse(
      500,
      "CasaFlix could not save this campaign right now. Try again in a moment.",
      "CAMPAIGN_CREATE_FAILED",
      reqId,
    );
  }
}
