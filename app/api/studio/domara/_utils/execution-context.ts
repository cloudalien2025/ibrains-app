import {
  isStudioIntegrationEncryptionConfigured,
  isStudioIntegrationStoreAvailable,
  listStudioStoredIntegrationStatuses,
} from "@/app/api/studio/domara/_utils/integration-settings";
import type { CasaHudYouTubeExecutionContext } from "@/lib/studio/domara/campaign-execution-engine";
import {
  buildDomaraIntegrationCapabilitiesFromStatuses,
  getDomaraIntegrationCapabilityMap,
  mergeDomaraIntegrationStatusesWithStored,
} from "@/lib/studio/domara/integrations";

export async function resolveCasaHudYouTubeExecutionContext(userId: string): Promise<CasaHudYouTubeExecutionContext> {
  const storeAvailable = (await isStudioIntegrationStoreAvailable()) && isStudioIntegrationEncryptionConfigured();
  const stored = storeAvailable ? await listStudioStoredIntegrationStatuses(userId) : [];
  const base = getDomaraIntegrationCapabilityMap();
  const providers = mergeDomaraIntegrationStatusesWithStored(base.statuses, stored);
  const capabilities = buildDomaraIntegrationCapabilitiesFromStatuses(providers);
  const youtubeProvider = providers.find((provider) => provider.providerId === "youtube");
  const connected = Boolean(youtubeProvider?.configured && youtubeProvider.validationStatus === "configured");

  if (!connected) {
    return {
      connected: false,
      uploadAvailable: false,
      providerStatus: {
        provider: "youtube_unavailable",
        state: "needs_connection",
        detail: "Connect the YouTube Channel before CasaFlix can publish or schedule this campaign.",
      },
    };
  }

  return {
    connected: true,
    uploadAvailable: false,
    providerStatus: {
      provider: "youtube_channel",
      state: capabilities.youtubePublishingApi ? "degraded" : "unavailable",
      detail:
        "YouTube Channel is connected for research and package preparation, but live upload and scheduling are not enabled in this workspace yet.",
    },
  };
}
