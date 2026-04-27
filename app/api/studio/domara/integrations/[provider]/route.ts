import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import {
  clearStudioIntegrationSecret,
  isStudioIntegrationEncryptionConfigured,
  isStudioIntegrationProvider,
  isStudioIntegrationStoreAvailable,
  listStudioStoredIntegrationStatuses,
  sanitizeIntegrationApiKey,
  saveStudioIntegrationSecret,
} from "@/app/api/studio/domara/_utils/integration-settings";
import {
  buildDomaraIntegrationCapabilitiesFromStatuses,
  getDomaraIntegrationCapabilityMap,
  mergeDomaraIntegrationStatusesWithStored,
} from "@/lib/studio/domara/integrations";

export const runtime = "nodejs";

function errorResponse(status: number, message: string, code: string, reqId = crypto.randomUUID()) {
  return NextResponse.json({ error: { message, code, reqId } }, { status });
}

async function buildStatusPayload(userId: string) {
  const storeAvailable = (await isStudioIntegrationStoreAvailable()) && isStudioIntegrationEncryptionConfigured();
  const stored = storeAvailable ? await listStudioStoredIntegrationStatuses(userId) : [];
  const base = getDomaraIntegrationCapabilityMap();
  const providers = mergeDomaraIntegrationStatusesWithStored(base.statuses, stored);
  const capabilities = buildDomaraIntegrationCapabilitiesFromStatuses(providers);
  return {
    providers,
    capabilities,
    saveSupported: storeAvailable,
  };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> | { provider: string } }
) {
  try {
    const userId = resolveUserId(req);
    await ensureUser(userId);
    const { provider } = await Promise.resolve(params);
    const resolvedProvider = provider.trim().toLowerCase();
    if (!isStudioIntegrationProvider(resolvedProvider)) {
      return errorResponse(400, "Unsupported provider.", "BAD_PROVIDER");
    }

    const payload = await buildStatusPayload(userId);
    const item = payload.providers.find((entry) => entry.providerId === resolvedProvider);
    if (!item) {
      return errorResponse(404, "Provider status not found.", "NOT_FOUND");
    }
    return NextResponse.json({
      ok: true,
      provider: item,
      capabilities: payload.capabilities,
      saveSupported: payload.saveSupported,
      securityNote: "Provider secrets are never returned to the client.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown integration read error";
    return errorResponse(500, message, "INTERNAL_ERROR");
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> | { provider: string } }
) {
  try {
    const userId = resolveUserId(req);
    await ensureUser(userId);
    const { provider } = await Promise.resolve(params);
    const resolvedProvider = provider.trim().toLowerCase();
    if (!isStudioIntegrationProvider(resolvedProvider)) {
      return errorResponse(400, "Unsupported provider.", "BAD_PROVIDER");
    }

    const storeAvailable = (await isStudioIntegrationStoreAvailable()) && isStudioIntegrationEncryptionConfigured();
    if (!storeAvailable) {
      return errorResponse(
        503,
        "Integration settings storage is unavailable (missing table or encryption configuration).",
        "STORE_UNAVAILABLE"
      );
    }

    const body = (await req.json().catch(() => ({}))) as { apiKey?: unknown };
    const apiKey = sanitizeIntegrationApiKey(body.apiKey);
    if (!apiKey) {
      return errorResponse(400, "API key is required.", "VALIDATION_ERROR");
    }

    await saveStudioIntegrationSecret({
      userId,
      providerId: resolvedProvider,
      apiKey,
    });

    const payload = await buildStatusPayload(userId);
    const item = payload.providers.find((entry) => entry.providerId === resolvedProvider);
    return NextResponse.json({
      ok: true,
      provider: item,
      capabilities: payload.capabilities,
      saveSupported: payload.saveSupported,
      securityNote: "Provider secrets are never returned to the client.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown integration save error";
    return errorResponse(500, message, "INTERNAL_ERROR");
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> | { provider: string } }
) {
  try {
    const userId = resolveUserId(req);
    await ensureUser(userId);
    const { provider } = await Promise.resolve(params);
    const resolvedProvider = provider.trim().toLowerCase();
    if (!isStudioIntegrationProvider(resolvedProvider)) {
      return errorResponse(400, "Unsupported provider.", "BAD_PROVIDER");
    }

    const storeAvailable = (await isStudioIntegrationStoreAvailable()) && isStudioIntegrationEncryptionConfigured();
    if (!storeAvailable) {
      return errorResponse(
        503,
        "Integration settings storage is unavailable (missing table or encryption configuration).",
        "STORE_UNAVAILABLE"
      );
    }

    await clearStudioIntegrationSecret({
      userId,
      providerId: resolvedProvider,
    });

    const payload = await buildStatusPayload(userId);
    const item = payload.providers.find((entry) => entry.providerId === resolvedProvider);
    return NextResponse.json({
      ok: true,
      provider: item,
      capabilities: payload.capabilities,
      saveSupported: payload.saveSupported,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown integration clear error";
    return errorResponse(500, message, "INTERNAL_ERROR");
  }
}
