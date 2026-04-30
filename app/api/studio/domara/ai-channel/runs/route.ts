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
  toPublicDomaraIntegrationStatuses,
} from "@/lib/studio/domara/integrations";
import {
  buildCasaHudConnectionCards,
  getCasaHudSetupMessage,
  getMissingCasaHudCoreConnections,
} from "@/lib/studio/domara/integrations-ui";

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
      mapPoiEnrichment: capabilities.mapboxVisuals && capabilities.googleMapsVisuals,
      renderJobs: capabilities.mediaStorage,
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
        message: "CasaFlix storage is not ready yet.",
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
    const message = error instanceof Error ? error.message : "Unknown CasaFlix run read error.";
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
        "CasaFlix storage is not ready yet.",
        "CASAHUD_STORE_UNAVAILABLE",
        reqId,
      );
    }

    const resolved = await resolveCapabilities(userId);
    const connectionCards = buildCasaHudConnectionCards(resolved.providers);
    const missingConnections = getMissingCasaHudCoreConnections(connectionCards);
    if (missingConnections.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          reqId,
          error: {
            message: getCasaHudSetupMessage(connectionCards),
            code: "CONNECTIONS_REQUIRED",
            reqId,
          },
          providers: toPublicDomaraIntegrationStatuses(resolved.providers),
          connectionCards,
          missingConnectionIds: missingConnections.map((card) => card.id),
        },
        { status: 409 },
      );
    }

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
      providers: toPublicDomaraIntegrationStatuses(resolved.providers),
      securityNote: "Saved connection values were used server-side only and were not returned.",
    });
  } catch (error) {
    if (isCasaHudStoreUnavailable(error)) {
      return errorResponse(
        503,
        "CasaFlix storage is not ready yet.",
        "CASAHUD_STORE_UNAVAILABLE",
        reqId,
      );
    }
    const message = error instanceof Error ? error.message : "Unknown CasaFlix generation error.";
    return errorResponse(500, message, "INTERNAL_ERROR", reqId);
  }
}
