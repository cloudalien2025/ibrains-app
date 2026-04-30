import type {
  DomaraIntegrationProviderId,
  DomaraIntegrationProviderStatus,
  DomaraIntegrationValidationStatus,
} from "@/lib/studio/domara/integrations";

export type DomaraOperatorIntegrationStatus = "connected" | "missing" | "invalid";

export type DomaraOperatorIntegrationRow = {
  providerId: DomaraIntegrationProviderId;
  displayName: string;
  status: DomaraOperatorIntegrationStatus;
  validationStatus: DomaraIntegrationValidationStatus;
  configured: boolean;
  requiredEnvVars: string[];
  maskedKey?: string;
  lastUpdatedAt?: string;
};

export type CasaHudConnectionCardId =
  | "youtube"
  | "openai"
  | "listing_sources"
  | "mapbox"
  | "google_places"
  | "elevenlabs"
  | "media_storage";

export type CasaHudConnectionGroupId = "create" | "publish" | "optional";
export type CasaHudConnectionStatus = "connected" | "partially_connected" | "not_connected" | "needs_attention" | "optional";
export type CasaHudConnectionAction = "Connect" | "Manage" | "Test Connection" | "Connect Source" | "Manage Sources" | "Test Source";

export type CasaHudConnectionCard = {
  id: CasaHudConnectionCardId;
  title: string;
  status: CasaHudConnectionStatus;
  statusLabel: "Connected" | "Partially Connected" | "Not Connected" | "Needs Attention" | "Optional";
  group: CasaHudConnectionGroupId;
  required: boolean;
  optional: boolean;
  enables: string;
  detail: string;
  missingSetupGuidance: string;
  safeErrorState: string | null;
  supportedSourceLabels?: string[];
  providerIds: DomaraIntegrationProviderId[];
  actions: CasaHudConnectionAction[];
  ctaLabel: CasaHudConnectionAction;
  lastCheckedAt?: string;
};

const PROVIDER_ORDER: DomaraIntegrationProviderId[] = [
  "openai",
  "elevenlabs",
  "mapbox",
  "google_maps_places",
  "idealista",
  "immobiliare",
  "cloudinary",
  "digitalocean_spaces",
  "youtube",
];

const PROVIDER_DISPLAY_NAMES: Record<DomaraIntegrationProviderId, string> = {
  openai: "OpenAI",
  elevenlabs: "ElevenLabs",
  mapbox: "Mapbox",
  google_maps_places: "Google Places",
  idealista: "Idealista",
  immobiliare: "Immobiliare",
  cloudinary: "Cloudinary",
  digitalocean_spaces: "DigitalOcean Spaces",
  youtube: "YouTube Channel",
};

export function resolveOperatorIntegrationStatus(
  configured: boolean,
  validationStatus: DomaraIntegrationValidationStatus,
): DomaraOperatorIntegrationStatus {
  if (validationStatus === "invalid") return "invalid";
  if (configured || validationStatus === "configured") return "connected";
  return "missing";
}

export function maskIntegrationKey(rawKey?: string | null): string {
  const key = (rawKey || "").trim();
  if (!key) return "••••••••";
  const visibleSuffix = key.slice(-4);
  return `••••••••${visibleSuffix}`;
}

export function buildOperatorIntegrationRows(providers: DomaraIntegrationProviderStatus[]): DomaraOperatorIntegrationRow[] {
  const byId = new Map(providers.map((provider) => [provider.providerId, provider]));

  return PROVIDER_ORDER.map((providerId) => {
    const provider = byId.get(providerId);
    const configured = Boolean(provider?.configured);
    const validationStatus = provider?.validationStatus || "missing";

    return {
      providerId,
      displayName: provider?.displayName || PROVIDER_DISPLAY_NAMES[providerId],
      status: resolveOperatorIntegrationStatus(configured, validationStatus),
      validationStatus,
      configured,
      requiredEnvVars: provider?.requiredEnvVars || [],
      maskedKey: configured ? provider?.maskedKey || maskIntegrationKey(undefined) : undefined,
      lastUpdatedAt: provider?.lastUpdatedAt,
    };
  });
}

function providerConnected(
  byId: Map<DomaraIntegrationProviderId, DomaraIntegrationProviderStatus>,
  providerId: DomaraIntegrationProviderId,
): boolean {
  const provider = byId.get(providerId);
  return Boolean(provider?.configured && provider.validationStatus !== "invalid");
}

function providerNeedsAttention(
  byId: Map<DomaraIntegrationProviderId, DomaraIntegrationProviderStatus>,
  providerIds: DomaraIntegrationProviderId[],
): boolean {
  return providerIds.some((providerId) => byId.get(providerId)?.validationStatus === "invalid");
}

function latestCheckedAt(
  byId: Map<DomaraIntegrationProviderId, DomaraIntegrationProviderStatus>,
  providerIds: DomaraIntegrationProviderId[],
): string | undefined {
  return providerIds
    .map((providerId) => byId.get(providerId)?.lastUpdatedAt)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);
}

export function buildCasaHudConnectionCards(providers: DomaraIntegrationProviderStatus[]): CasaHudConnectionCard[] {
  const byId = new Map(providers.map((provider) => [provider.providerId, provider]));
  const youtubeConnected = providerConnected(byId, "youtube");
  const openAiConnected = providerConnected(byId, "openai");
  const idealistaConnected = providerConnected(byId, "idealista");
  const immobiliareConnected = providerConnected(byId, "immobiliare");
  const listingConnectedCount = [idealistaConnected, immobiliareConnected].filter(Boolean).length;
  const listingConnected = listingConnectedCount > 0;
  const mapboxConnected = providerConnected(byId, "mapbox");
  const placesConnected = providerConnected(byId, "google_maps_places");
  const voiceConnected = providerConnected(byId, "elevenlabs");
  const mediaStorageConnected = providerConnected(byId, "cloudinary") || providerConnected(byId, "digitalocean_spaces");

  return [
    {
      id: "openai",
      title: "OpenAI",
      status: providerNeedsAttention(byId, ["openai"]) ? "needs_attention" : openAiConnected ? "connected" : "not_connected",
      statusLabel: providerNeedsAttention(byId, ["openai"]) ? "Needs Attention" : openAiConnected ? "Connected" : "Not Connected",
      group: "create",
      required: true,
      optional: false,
      enables: "Creates viral titles, video strategy, scripts, storyboards, narration prompts, YouTube packaging, and review checks.",
      detail: "Required for Generate Viral Video, script/storyboard generation, and YouTube package generation.",
      missingSetupGuidance: "Connect OpenAI so CasaFlix can create the strategy and review-ready video package.",
      safeErrorState: providerNeedsAttention(byId, ["openai"]) ? "OpenAI needs to be reconnected before generation." : null,
      providerIds: ["openai"],
      actions: [openAiConnected ? "Manage" : "Connect", "Test Connection"],
      ctaLabel: openAiConnected ? "Manage" : "Connect",
      lastCheckedAt: latestCheckedAt(byId, ["openai"]),
    },
    {
      id: "listing_sources",
      title: "Listing Sources",
      status: providerNeedsAttention(byId, ["idealista", "immobiliare"])
        ? "needs_attention"
        : listingConnectedCount > 1
          ? "connected"
          : listingConnected
            ? "partially_connected"
            : "not_connected",
      statusLabel: providerNeedsAttention(byId, ["idealista", "immobiliare"])
        ? "Needs Attention"
        : listingConnectedCount > 1
          ? "Connected"
          : listingConnected
            ? "Partially Connected"
            : "Not Connected",
      group: "create",
      required: true,
      optional: false,
      enables: "Finds real properties for single-property, roundup, niche, and location videos.",
      detail: "Required for finding matching real properties and validating video claims.",
      missingSetupGuidance: "Connect at least one listing source before CasaFlix selects properties for the video.",
      safeErrorState: providerNeedsAttention(byId, ["idealista", "immobiliare"]) ? "One listing source needs attention." : null,
      supportedSourceLabels: ["Idealista", "Immobiliare", "Manual Listing Import", "Future Listing APIs"],
      providerIds: ["idealista", "immobiliare"],
      actions: [listingConnected ? "Manage Sources" : "Connect Source", "Test Source"],
      ctaLabel: listingConnected ? "Manage Sources" : "Connect Source",
      lastCheckedAt: latestCheckedAt(byId, ["idealista", "immobiliare"]),
    },
    {
      id: "mapbox",
      title: "Maps & Location Visuals",
      status: providerNeedsAttention(byId, ["mapbox"]) ? "needs_attention" : mapboxConnected ? "connected" : "not_connected",
      statusLabel: providerNeedsAttention(byId, ["mapbox"]) ? "Needs Attention" : mapboxConnected ? "Connected" : "Not Connected",
      group: "create",
      required: true,
      optional: false,
      enables: "Creates premium map visuals, property-location scenes, area views, and map sequences for videos.",
      detail: "Required for map visuals and premium location scenes.",
      missingSetupGuidance: "Connect Mapbox so CasaFlix can prepare premium map scenes.",
      safeErrorState: providerNeedsAttention(byId, ["mapbox"]) ? "Map visuals need to be reconnected." : null,
      providerIds: ["mapbox"],
      actions: [mapboxConnected ? "Manage" : "Connect", "Test Connection"],
      ctaLabel: mapboxConnected ? "Manage" : "Connect",
      lastCheckedAt: latestCheckedAt(byId, ["mapbox"]),
    },
    {
      id: "google_places",
      title: "Local Places & POIs",
      status: providerNeedsAttention(byId, ["google_maps_places"]) ? "needs_attention" : placesConnected ? "connected" : "not_connected",
      statusLabel: providerNeedsAttention(byId, ["google_maps_places"]) ? "Needs Attention" : placesConnected ? "Connected" : "Not Connected",
      group: "create",
      required: true,
      optional: false,
      enables: "Finds cafes, restaurants, landmarks, beaches, marinas, airports, train stations, schools, ski areas, golf courses, and local highlights.",
      detail: "Required for POI intelligence, lifestyle context, location storytelling, and local highlights.",
      missingSetupGuidance: "Connect Google Places so CasaFlix can add local highlights and lifestyle context.",
      safeErrorState: providerNeedsAttention(byId, ["google_maps_places"]) ? "Local Places needs to be reconnected." : null,
      providerIds: ["google_maps_places"],
      actions: [placesConnected ? "Manage" : "Connect", "Test Connection"],
      ctaLabel: placesConnected ? "Manage" : "Connect",
      lastCheckedAt: latestCheckedAt(byId, ["google_maps_places"]),
    },
    {
      id: "media_storage",
      title: "Media Storage",
      status: providerNeedsAttention(byId, ["cloudinary", "digitalocean_spaces"])
        ? "needs_attention"
        : mediaStorageConnected
          ? "connected"
          : "not_connected",
      statusLabel: providerNeedsAttention(byId, ["cloudinary", "digitalocean_spaces"])
        ? "Needs Attention"
        : mediaStorageConnected
          ? "Connected"
          : "Not Connected",
      group: "create",
      required: true,
      optional: false,
      enables: "Stores thumbnails, generated media, render assets, exported packages, and video files.",
      detail: "Required for saving generated media assets and completed packages.",
      missingSetupGuidance: "Connect media storage so CasaFlix can save generated assets and completed packages.",
      safeErrorState: providerNeedsAttention(byId, ["cloudinary", "digitalocean_spaces"]) ? "Media Storage needs to be reconnected." : null,
      supportedSourceLabels: ["Cloudinary", "DigitalOcean Spaces"],
      providerIds: ["cloudinary", "digitalocean_spaces"],
      actions: [mediaStorageConnected ? "Manage" : "Connect", "Test Connection"],
      ctaLabel: mediaStorageConnected ? "Manage" : "Connect",
      lastCheckedAt: latestCheckedAt(byId, ["cloudinary", "digitalocean_spaces"]),
    },
    {
      id: "youtube",
      title: "YouTube Channel",
      status: providerNeedsAttention(byId, ["youtube"]) ? "needs_attention" : youtubeConnected ? "connected" : "not_connected",
      statusLabel: providerNeedsAttention(byId, ["youtube"]) ? "Needs Attention" : youtubeConnected ? "Connected" : "Not Connected",
      group: "publish",
      required: true,
      optional: false,
      enables: "Researches ranking videos, analyzes title patterns, prepares uploads, publishes videos, and schedules videos.",
      detail: "Required for YouTube research, upload, publish now, and schedule to YouTube.",
      missingSetupGuidance: "Connect YouTube Channel before CasaFlix researches live ranking videos or publishes reviewed packages.",
      safeErrorState: providerNeedsAttention(byId, ["youtube"]) ? "YouTube Channel needs to be reconnected." : null,
      providerIds: ["youtube"],
      actions: [youtubeConnected ? "Manage" : "Connect", "Test Connection"],
      ctaLabel: youtubeConnected ? "Manage" : "Connect",
      lastCheckedAt: latestCheckedAt(byId, ["youtube"]),
    },
    {
      id: "elevenlabs",
      title: "Voice Narration",
      status: providerNeedsAttention(byId, ["elevenlabs"]) ? "needs_attention" : voiceConnected ? "connected" : "optional",
      statusLabel: providerNeedsAttention(byId, ["elevenlabs"]) ? "Needs Attention" : voiceConnected ? "Connected" : "Optional",
      group: "optional",
      required: false,
      optional: true,
      enables: "Creates premium AI voice narration.",
      detail: "Optional premium narration. CasaFlix can still create scripts and review packages without ElevenLabs.",
      missingSetupGuidance: "Connect ElevenLabs when you want premium AI voice narration.",
      safeErrorState: providerNeedsAttention(byId, ["elevenlabs"]) ? "Voice Narration needs to be reconnected." : null,
      providerIds: ["elevenlabs"],
      actions: [voiceConnected ? "Manage" : "Connect", "Test Connection"],
      ctaLabel: voiceConnected ? "Manage" : "Connect",
      lastCheckedAt: latestCheckedAt(byId, ["elevenlabs"]),
    },
  ];
}

export function getMissingCasaHudCoreConnections(cards: CasaHudConnectionCard[]): CasaHudConnectionCard[] {
  return cards.filter((card) => card.required && card.status !== "connected" && card.status !== "partially_connected");
}

export function shouldOpenCasaHudSetupForGenerate(cards: CasaHudConnectionCard[]): boolean {
  return getMissingCasaHudCoreConnections(cards).length > 0;
}

export function getCasaHudSetupMessage(cards: CasaHudConnectionCard[]): string {
  const missing = getMissingCasaHudCoreConnections(cards);
  if (missing.length === 0) {
    return "CasaFlix has the core connections needed to create, save, publish, and schedule a production video.";
  }

  const names = missing.map((card) => card.title).join(", ");
  return `Connect ${names} before CasaFlix generates a production video. These services power creative generation, real listing selection, map visuals, local highlights, media storage, publishing, and scheduling.`;
}
