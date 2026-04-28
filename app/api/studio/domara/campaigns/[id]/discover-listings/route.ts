import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import {
  isStudioIntegrationEncryptionConfigured,
  isStudioIntegrationStoreAvailable,
  listStudioStoredIntegrationStatuses,
} from "@/app/api/studio/domara/_utils/integration-settings";
import {
  getCasaHudCampaign,
  isCasaHudCampaignStoreAvailable,
  isCasaHudCampaignStoreUnavailable,
  saveCasaHudCampaign,
} from "@/lib/studio/domara/campaign-repository";
import {
  applyCasaHudListingDiscovery,
  toCasaHudCampaignSummary,
} from "@/lib/studio/domara/campaigns";
import {
  getDomaraIntegrationStatuses,
  mergeDomaraIntegrationStatusesWithStored,
} from "@/lib/studio/domara/integrations";
import { runCasaHudListingDiscovery } from "@/lib/studio/domara/listing-discovery-engine";

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
      return errorResponse(400, "CasaHUD needs a valid campaign id before it can discover listings.", "INVALID_INPUT", reqId);
    }

    const campaignStoreAvailable = await isCasaHudCampaignStoreAvailable();
    if (!campaignStoreAvailable) {
      return errorResponse(503, "CasaHUD storage is not ready yet.", "CASAHUD_STORE_UNAVAILABLE", reqId);
    }

    const campaign = await getCasaHudCampaign(userId, campaignId);
    if (!campaign) {
      return errorResponse(404, "CasaHUD could not find that campaign.", "NOT_FOUND", reqId);
    }

    const storedStatuses =
      (await isStudioIntegrationStoreAvailable()) && isStudioIntegrationEncryptionConfigured()
        ? await listStudioStoredIntegrationStatuses(userId)
        : [];
    const providers = mergeDomaraIntegrationStatusesWithStored(getDomaraIntegrationStatuses(process.env), storedStatuses);
    const idealistaConfigured = providers.find((provider) => provider.providerId === "idealista")?.configured ?? false;
    const immobiliareConfigured = providers.find((provider) => provider.providerId === "immobiliare")?.configured ?? false;

    const discovery = await runCasaHudListingDiscovery(campaign, {
      idealistaCredential: idealistaConfigured ? "configured" : null,
      immobiliareCredential: immobiliareConfigured ? "configured" : null,
    });
    const updatedCampaign = applyCasaHudListingDiscovery(campaign, discovery);
    await saveCasaHudCampaign(userId, updatedCampaign);

    return NextResponse.json({
      ok: true,
      reqId,
      campaign: updatedCampaign,
      summary: toCasaHudCampaignSummary(updatedCampaign),
      message: `Property discovery complete. "${updatedCampaign.name}" is ready for listing validation.`,
    });
  } catch (error) {
    if (isCasaHudCampaignStoreUnavailable(error)) {
      return errorResponse(503, "CasaHUD storage is not ready yet.", "CASAHUD_STORE_UNAVAILABLE", reqId);
    }

    console.error("CasaHUD listing discovery failed", { reqId, error });
    return errorResponse(
      500,
      "CasaHUD could not discover listing candidates right now. Try again in a moment.",
      "LISTING_DISCOVERY_FAILED",
      reqId,
    );
  }
}
