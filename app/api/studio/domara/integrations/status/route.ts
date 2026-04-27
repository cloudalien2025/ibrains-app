import { NextRequest, NextResponse } from "next/server";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import {
  isStudioIntegrationEncryptionConfigured,
  isStudioIntegrationStoreAvailable,
  listStudioStoredIntegrationStatuses,
} from "@/app/api/studio/domara/_utils/integration-settings";
import {
  buildDomaraIntegrationCapabilitiesFromStatuses,
  getDomaraIntegrationCapabilityMap,
  mergeDomaraIntegrationStatusesWithStored,
} from "@/lib/studio/domara/integrations";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const userId = resolveUserId(request);
  await ensureUser(userId);

  const storeAvailable = (await isStudioIntegrationStoreAvailable()) && isStudioIntegrationEncryptionConfigured();
  const stored = storeAvailable ? await listStudioStoredIntegrationStatuses(userId) : [];
  const base = getDomaraIntegrationCapabilityMap();
  const providers = mergeDomaraIntegrationStatusesWithStored(base.statuses, stored);
  const capabilities = buildDomaraIntegrationCapabilitiesFromStatuses(providers);

  return NextResponse.json({
    ok: true,
    providers,
    capabilities,
    saveSupported: storeAvailable,
    storeStatusMessage: storeAvailable
      ? "Integration settings are stored server-side."
      : "Integration settings storage is unavailable (missing table or encryption configuration).",
    generatedAt: new Date().toISOString(),
    securityNote: "Provider secrets are never returned to the client.",
  });
}
