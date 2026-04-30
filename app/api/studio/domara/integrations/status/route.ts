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
  toPublicDomaraIntegrationStatuses,
} from "@/lib/studio/domara/integrations";
import {
  buildCasaHudConnectionCards,
  getMissingCasaHudCoreConnections,
} from "@/lib/studio/domara/integrations-ui";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const userId = resolveUserId(request);
  await ensureUser(userId);

  const storeAvailable = (await isStudioIntegrationStoreAvailable()) && isStudioIntegrationEncryptionConfigured();
  const stored = storeAvailable ? await listStudioStoredIntegrationStatuses(userId) : [];
  const base = getDomaraIntegrationCapabilityMap();
  const providers = mergeDomaraIntegrationStatusesWithStored(base.statuses, stored);
  const capabilities = buildDomaraIntegrationCapabilitiesFromStatuses(providers);
  const connectionCards = buildCasaHudConnectionCards(providers);
  const missing = getMissingCasaHudCoreConnections(connectionCards);

  return NextResponse.json({
    ok: true,
    providers: toPublicDomaraIntegrationStatuses(providers),
    connectionCards,
    systemStatus: {
      label: missing.length === 0 ? "Ready" : "Needs Connections",
      missingConnectionIds: missing.map((card) => card.id),
      message:
        missing.length === 0
          ? "CasaFlix is ready to create and prepare videos."
          : "Connect the highlighted services before generating a production video.",
    },
    capabilities,
    saveSupported: storeAvailable,
    storeStatusMessage: storeAvailable
      ? "Connections are protected for this workspace."
      : "Connection saving is not ready in this workspace. Existing connected services can still be used.",
    generatedAt: new Date().toISOString(),
    securityNote: "Saved connection values are protected server-side and never returned.",
  });
}
