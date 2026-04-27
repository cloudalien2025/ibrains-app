import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import {
  getStudioIntegrationSecret,
  isStudioIntegrationEncryptionConfigured,
  isStudioIntegrationStoreAvailable,
  listStudioStoredIntegrationStatuses,
} from "@/app/api/studio/domara/_utils/integration-settings";
import {
  DatabaseCasaHudRepository,
  getLatestCasaHudRunOutput,
  isCasaHudStoreAvailable,
  isCasaHudStoreUnavailable,
  listCasaHudRunSummaries,
} from "@/lib/studio/domara/ai-channel-engine/database-repository";
import { runCasaHudOrchestrator } from "@/lib/studio/domara/ai-channel-engine/orchestrator";
import { createYouTubeResearchProvider } from "@/lib/studio/domara/ai-channel-engine/youtube-research-agent";
import {
  buildDomaraIntegrationCapabilitiesFromStatuses,
  getDomaraIntegrationCapabilityMap,
  mergeDomaraIntegrationStatusesWithStored,
} from "@/lib/studio/domara/integrations";

export const runtime = "nodejs";

function errorResponse(status: number, message: string, code: string, reqId = crypto.randomUUID()) {
  return NextResponse.json({ ok: false, error: { message, code, reqId } }, { status });
}

async function resolveCapabilities(userId: string) {
  const storeAvailable = (await isStudioIntegrationStoreAvailable()) && isStudioIntegrationEncryptionConfigured();
  const stored = storeAvailable ? await listStudioStoredIntegrationStatuses(userId) : [];
  const base = getDomaraIntegrationCapabilityMap();
  const providers = mergeDomaraIntegrationStatusesWithStored(base.statuses, stored);
  const capabilities = buildDomaraIntegrationCapabilitiesFromStatuses(providers);

  return {
    providers,
    storeAvailable,
    capabilities: {
      openaiGeneration: capabilities.openaiGeneration,
      youtubeResearch: capabilities.youtubePublishingApi,
      listingDiscovery: capabilities.listingFetchIdealista || capabilities.listingFetchImmobiliare,
      mapPoiEnrichment: capabilities.googleMapsVisuals,
      renderJobs: true,
      youtubePublishing: capabilities.youtubePublishingApi,
    },
  };
}

export async function GET(request: NextRequest) {
  const reqId = crypto.randomUUID();
  try {
    const userId = resolveUserId(request);
    await ensureUser(userId);
    const storeAvailable = await isCasaHudStoreAvailable();
    if (!storeAvailable) {
      return NextResponse.json({
        ok: true,
        reqId,
        runs: [],
        storeAvailable: false,
        message: "CasaHUD storage is not ready yet.",
      });
    }

    const runs = await listCasaHudRunSummaries(userId);
    const latestOutput = await getLatestCasaHudRunOutput(userId);
    return NextResponse.json({
      ok: true,
      reqId,
      runs,
      latestOutput,
      storeAvailable: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown CasaHUD run read error.";
    return errorResponse(500, message, "INTERNAL_ERROR", reqId);
  }
}

export async function POST(request: NextRequest) {
  const reqId = crypto.randomUUID();
  try {
    const userId = resolveUserId(request);
    await ensureUser(userId);
    const body = (await request.json().catch(() => ({}))) as {
      preferredMarket?: unknown;
    };
    const preferredMarket =
      typeof body.preferredMarket === "string" && body.preferredMarket.trim() ? body.preferredMarket.trim() : undefined;

    if (!(await isCasaHudStoreAvailable())) {
      return errorResponse(
        503,
        "CasaHUD storage is not ready yet.",
        "CASAHUD_STORE_UNAVAILABLE",
        reqId,
      );
    }

    const resolved = await resolveCapabilities(userId);
    const youtubeCredential = resolved.capabilities.youtubeResearch ? await getStudioIntegrationSecret(userId, "youtube") : null;
    const youtubeResearchProvider = createYouTubeResearchProvider({
      apiKey: youtubeCredential?.secret || process.env.YOUTUBE_API_KEY,
    });

    const output = await runCasaHudOrchestrator(
      {
        userId,
        objective: "generate_next_property_video",
        preferredMarket,
        capabilities: resolved.capabilities,
      },
      {
        repository: new DatabaseCasaHudRepository(),
        youtubeResearchProvider,
      },
    );

    return NextResponse.json({
      ok: true,
      reqId,
      output,
      providers: resolved.providers,
      securityNote: "Provider secrets were used server-side only and were not returned.",
    });
  } catch (error) {
    if (isCasaHudStoreUnavailable(error)) {
      return errorResponse(
        503,
        "CasaHUD storage is not ready yet.",
        "CASAHUD_STORE_UNAVAILABLE",
        reqId,
      );
    }
    const message = error instanceof Error ? error.message : "Unknown CasaHUD generation error.";
    return errorResponse(500, message, "INTERNAL_ERROR", reqId);
  }
}
