import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import {
  getStudioIntegrationSecret,
  isStudioIntegrationEncryptionConfigured,
  isStudioIntegrationStoreAvailable,
} from "@/app/api/studio/domara/_utils/integration-settings";
import { generateCasaHudOpportunityResult } from "@/lib/studio/domara/opportunity-engine/orchestrator";
import { createCasaHudOpportunityResearchProvider } from "@/lib/studio/domara/opportunity-engine/youtube-research-provider";

export const runtime = "nodejs";

function errorResponse(status: number, message: string, code: string, reqId = crypto.randomUUID()) {
  return NextResponse.json({ ok: false, error: { message, code, reqId } }, { status });
}

async function resolveYouTubeApiKey(userId: string): Promise<string | undefined> {
  const envKey = process.env.YOUTUBE_API_KEY?.trim();
  if (envKey) return envKey;

  const storeAvailable = (await isStudioIntegrationStoreAvailable()) && isStudioIntegrationEncryptionConfigured();
  if (!storeAvailable) return undefined;

  const stored = await getStudioIntegrationSecret(userId, "youtube");
  return stored?.secret?.trim() || undefined;
}

export async function POST(request: NextRequest) {
  const reqId = crypto.randomUUID();

  try {
    const userId = resolveUserId(request);
    await ensureUser(userId);

    const body = (await request.json().catch(() => ({}))) as {
      preferredMarket?: unknown;
    };

    if (body.preferredMarket !== undefined && typeof body.preferredMarket !== "string") {
      return errorResponse(400, "CasaHUD needs a valid market hint to generate title opportunities.", "INVALID_INPUT", reqId);
    }

    const preferredMarket = body.preferredMarket?.trim() || undefined;
    const youtubeApiKey = await resolveYouTubeApiKey(userId);
    const researchProvider = createCasaHudOpportunityResearchProvider({ apiKey: youtubeApiKey });
    const output = await generateCasaHudOpportunityResult(
      {
        userId,
        preferredMarket,
      },
      { researchProvider },
    );

    return NextResponse.json({
      ok: true,
      reqId,
      output,
    });
  } catch (error) {
    console.error("CasaHUD opportunity generation failed", { reqId, error });
    return errorResponse(
      500,
      "CasaHUD could not generate title opportunities right now. Try again in a moment.",
      "OPPORTUNITY_GENERATION_FAILED",
      reqId,
    );
  }
}
