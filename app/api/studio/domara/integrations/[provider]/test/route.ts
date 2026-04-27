import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import {
  getStudioIntegrationSecret,
  isStudioIntegrationProvider,
} from "@/app/api/studio/domara/_utils/integration-settings";

export const runtime = "nodejs";

function errorResponse(status: number, message: string, code: string, reqId = crypto.randomUUID()) {
  return NextResponse.json({ error: { message, code, reqId } }, { status });
}

function formatLooksValid(provider: string, secret: string): boolean {
  const trimmed = secret.trim();
  if (!trimmed) return false;
  if (provider === "openai") return trimmed.length >= 20;
  if (provider === "elevenlabs") return trimmed.length >= 12;
  if (provider === "mapbox") return trimmed.length >= 16;
  if (provider === "google_maps_places") return trimmed.length >= 16;
  if (provider === "idealista") return trimmed.length >= 8;
  if (provider === "immobiliare") return trimmed.length >= 8;
  if (provider === "cloudinary") return trimmed.length >= 8;
  if (provider === "digitalocean_spaces") return trimmed.length >= 8;
  if (provider === "youtube") return trimmed.length >= 16;
  return false;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> | { provider: string } }
) {
  const reqId = crypto.randomUUID();
  try {
    const userId = resolveUserId(req);
    await ensureUser(userId);
    const { provider } = await Promise.resolve(params);
    const resolvedProvider = provider.trim().toLowerCase();
    if (!isStudioIntegrationProvider(resolvedProvider)) {
      return errorResponse(400, "Unsupported provider.", "BAD_PROVIDER", reqId);
    }

    const credential = await getStudioIntegrationSecret(userId, resolvedProvider);
    if (!credential) {
      return errorResponse(400, "This connection has not been saved yet. Connect it first.", "NOT_CONFIGURED", reqId);
    }

    const looksValid = formatLooksValid(resolvedProvider, credential.secret);
    if (!looksValid) {
      return errorResponse(400, "Connection details need attention. Reconnect and try again.", "VALIDATION_ERROR", reqId);
    }

    return NextResponse.json({
      ok: true,
      reqId,
      providerId: resolvedProvider,
      message: "Connection looks ready.",
      verifiedAt: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown integration test error";
    return errorResponse(500, message, "INTERNAL_ERROR", reqId);
  }
}
