import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import {
  clearStudioIntegrationSecret,
  isStudioIntegrationEncryptionConfigured,
  isStudioIntegrationProvider,
  isStudioIntegrationStoreAvailable,
  listStudioStoredIntegrationStatuses,
  parseStudioIntegrationSavePayload,
  saveStudioIntegrationSecret,
} from "@/app/api/studio/domara/_utils/integration-settings";
import {
  buildDomaraIntegrationCapabilitiesFromStatuses,
  getDomaraIntegrationCapabilityMap,
  mergeDomaraIntegrationStatusesWithStored,
  toPublicDomaraIntegrationStatuses,
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
    publicProviders: toPublicDomaraIntegrationStatuses(providers),
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
    const publicItem = payload.publicProviders.find((entry) => entry.providerId === resolvedProvider);
    return NextResponse.json({
      ok: true,
      provider: publicItem,
      providers: payload.publicProviders,
      capabilities: payload.capabilities,
      saveSupported: payload.saveSupported,
      securityNote: "Saved connection values are protected server-side and never returned.",
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
        "Connection saving is not ready in this workspace. Existing connected services can still be used.",
        "STORE_UNAVAILABLE"
      );
    }

    const body = await req.json().catch(() => ({}));
    const parsed = parseStudioIntegrationSavePayload(body);
    if (!parsed.ok) {
      return errorResponse(400, parsed.message, "VALIDATION_ERROR");
    }

    await saveStudioIntegrationSecret({
      userId,
      providerId: resolvedProvider,
      apiKey: parsed.connectionKey,
    });

    const payload = await buildStatusPayload(userId);
    const item = payload.providers.find((entry) => entry.providerId === resolvedProvider);
    const publicItem = payload.publicProviders.find((entry) => entry.providerId === resolvedProvider);
    return NextResponse.json({
      ok: true,
      provider: publicItem,
      providers: payload.publicProviders,
      capabilities: payload.capabilities,
      saveSupported: payload.saveSupported,
      securityNote: "Saved connection values are protected server-side and never returned.",
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
        "Connection saving is not ready in this workspace. Existing connected services can still be used.",
        "STORE_UNAVAILABLE"
      );
    }

    await clearStudioIntegrationSecret({
      userId,
      providerId: resolvedProvider,
    });

    const payload = await buildStatusPayload(userId);
    const item = payload.providers.find((entry) => entry.providerId === resolvedProvider);
    const publicItem = payload.publicProviders.find((entry) => entry.providerId === resolvedProvider);
    return NextResponse.json({
      ok: true,
      provider: publicItem,
      providers: payload.publicProviders,
      capabilities: payload.capabilities,
      saveSupported: payload.saveSupported,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown integration clear error";
    return errorResponse(500, message, "INTERNAL_ERROR");
  }
}
