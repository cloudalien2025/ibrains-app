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
  applyCasaHudListingValidation,
  toCasaHudCampaignSummary,
  type CasaHudCampaign,
  type CasaHudListingCandidate,
} from "@/lib/studio/domara/campaigns";
import { runCasaHudListingValidation } from "@/lib/studio/domara/listing-validation-engine";

export const runtime = "nodejs";

function buildListingCandidatePool(campaign: CasaHudCampaign): CasaHudListingCandidate[] {
  const byId = new Map<string, CasaHudListingCandidate>();
  for (const listing of campaign.listingCandidates) {
    byId.set(listing.id, listing);
  }
  for (const listing of campaign.approvedListings) {
    if (!byId.has(listing.id)) byId.set(listing.id, listing);
  }
  for (const listing of campaign.rejectedListings) {
    if (!byId.has(listing.id)) byId.set(listing.id, listing);
  }
  return Array.from(byId.values());
}

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
      return errorResponse(400, "CasaFlix needs a valid campaign id before it can validate listings.", "INVALID_INPUT", reqId);
    }

    const campaignStoreAvailable = await isCasaHudCampaignStoreAvailable();
    if (!campaignStoreAvailable) {
      return errorResponse(503, "CasaFlix storage is not ready yet.", "CASAHUD_STORE_UNAVAILABLE", reqId);
    }

    const campaign = await getCasaHudCampaign(userId, campaignId);
    if (!campaign) {
      return errorResponse(404, "CasaFlix could not find that campaign.", "NOT_FOUND", reqId);
    }
    const listingCandidates = buildListingCandidatePool(campaign);
    if (listingCandidates.length === 0) {
      return errorResponse(
        409,
        "CasaFlix needs discovered listing candidates before it can validate and rank them.",
        "LISTING_CANDIDATES_REQUIRED",
        reqId,
      );
    }

    const validationCampaign = {
      ...campaign,
      listingCandidates,
    };
    const validation = runCasaHudListingValidation(validationCampaign);
    const updatedCampaign = applyCasaHudListingValidation(validationCampaign, validation);
    await saveCasaHudCampaign(userId, updatedCampaign);

    return NextResponse.json({
      ok: true,
      reqId,
      campaign: updatedCampaign,
      summary: toCasaHudCampaignSummary(updatedCampaign),
      message: `Listing validation complete. "${updatedCampaign.name}" is ready for Location Intelligence.`,
    });
  } catch (error) {
    if (isCasaHudCampaignStoreUnavailable(error)) {
      return errorResponse(503, "CasaFlix storage is not ready yet.", "CASAHUD_STORE_UNAVAILABLE", reqId);
    }

    console.error("CasaFlix listing validation failed", { reqId, error });
    return errorResponse(
      500,
      "CasaFlix could not validate these listings right now. Try again in a moment.",
      "LISTING_VALIDATION_FAILED",
      reqId,
    );
  }
}
