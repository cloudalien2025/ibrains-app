import type {
  CasaHudPublishScheduleRequest,
  CasaHudPublishScheduleResult,
} from "@/lib/studio/domara/ai-channel-engine/types";
import type { DomaraYouTubePackage } from "@/lib/studio/domara/youtube-package";

export interface CasaHudYouTubePublishingProvider {
  providerName: "youtube_data_api";
  publishOrSchedule(params: {
    packageData: DomaraYouTubePackage;
    request: CasaHudPublishScheduleRequest;
  }): Promise<CasaHudPublishScheduleResult>;
}

export function resolvePublishScheduleGate(params: {
  approved: boolean;
  youtubeConfigured: boolean;
  request: CasaHudPublishScheduleRequest;
  packageData: DomaraYouTubePackage;
  provider?: CasaHudYouTubePublishingProvider;
}): Promise<CasaHudPublishScheduleResult> {
  if (!params.approved) {
    return Promise.resolve({
      status: "needs_approval",
      provider: "youtube_data_api",
      message: "Human approval is required before CasaHUD can publish or schedule a YouTube upload.",
    });
  }

  if (!params.youtubeConfigured || !params.provider) {
    return Promise.resolve({
      status: "needs_credentials",
      provider: "youtube_data_api",
      message: "YouTube credentials are required before CasaHUD can publish or schedule this package.",
    });
  }

  return params.provider.publishOrSchedule({
    packageData: params.packageData,
    request: params.request,
  });
}
