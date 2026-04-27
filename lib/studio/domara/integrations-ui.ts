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
  | "google_maps_places"
  | "elevenlabs";

export type CasaHudConnectionCard = {
  id: CasaHudConnectionCardId;
  title: string;
  status: "connected" | "not_connected";
  required: boolean;
  optional: boolean;
  enables: string;
  detail: string;
  providerIds: DomaraIntegrationProviderId[];
  ctaLabel: "Connect" | "Manage";
};

const PROVIDER_ORDER: DomaraIntegrationProviderId[] = [
  "openai",
  "elevenlabs",
  "mapbox",
  "google_maps_places",
  "idealista",
  "immobiliare",
  "youtube",
];

const PROVIDER_DISPLAY_NAMES: Record<DomaraIntegrationProviderId, string> = {
  openai: "OpenAI",
  elevenlabs: "ElevenLabs",
  mapbox: "Mapbox",
  google_maps_places: "Google Maps",
  idealista: "Idealista",
  immobiliare: "Immobiliare",
  youtube: "YouTube",
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

export function buildCasaHudConnectionCards(providers: DomaraIntegrationProviderStatus[]): CasaHudConnectionCard[] {
  const byId = new Map(providers.map((provider) => [provider.providerId, provider]));
  const youtubeConnected = providerConnected(byId, "youtube");
  const openAiConnected = providerConnected(byId, "openai");
  const listingConnected = providerConnected(byId, "idealista") || providerConnected(byId, "immobiliare");
  const mapsConnected = providerConnected(byId, "google_maps_places");
  const voiceConnected = providerConnected(byId, "elevenlabs");

  return [
    {
      id: "youtube",
      title: "YouTube",
      status: youtubeConnected ? "connected" : "not_connected",
      required: true,
      optional: false,
      enables: "Researches audience demand, prepares publishing details, and unlocks upload and scheduling actions.",
      detail: "Required for a production video workflow from trend research through publishing.",
      providerIds: ["youtube"],
      ctaLabel: youtubeConnected ? "Manage" : "Connect",
    },
    {
      id: "openai",
      title: "OpenAI",
      status: openAiConnected ? "connected" : "not_connected",
      required: true,
      optional: false,
      enables: "Creates the title strategy, script, storyboard, thumbnail direction, and video metadata.",
      detail: "Required for CasaHUD to generate a production-ready creative package.",
      providerIds: ["openai"],
      ctaLabel: openAiConnected ? "Manage" : "Connect",
    },
    {
      id: "listing_sources",
      title: "Listing Sources",
      status: listingConnected ? "connected" : "not_connected",
      required: true,
      optional: false,
      enables: "Finds real properties, verifies listing fit, and keeps the video grounded in available inventory.",
      detail: "Connect at least one listing source before CasaHUD selects properties for the video.",
      providerIds: ["idealista", "immobiliare"],
      ctaLabel: listingConnected ? "Manage" : "Connect",
    },
    {
      id: "google_maps_places",
      title: "Google Maps / Places",
      status: mapsConnected ? "connected" : "not_connected",
      required: true,
      optional: false,
      enables: "Adds neighborhood context, points of interest, map scenes, and location-aware hooks.",
      detail: "Required for the local intelligence that makes the listing story production-ready.",
      providerIds: ["google_maps_places"],
      ctaLabel: mapsConnected ? "Manage" : "Connect",
    },
    {
      id: "elevenlabs",
      title: "ElevenLabs",
      status: voiceConnected ? "connected" : "not_connected",
      required: false,
      optional: true,
      enables: "Adds premium voice narration when you want CasaHUD to prepare narrated renders.",
      detail: "Optional. CasaHUD can still build the video package without live narration.",
      providerIds: ["elevenlabs"],
      ctaLabel: voiceConnected ? "Manage" : "Connect",
    },
  ];
}

export function getMissingCasaHudCoreConnections(cards: CasaHudConnectionCard[]): CasaHudConnectionCard[] {
  return cards.filter((card) => card.required && card.status !== "connected");
}

export function shouldOpenCasaHudSetupForGenerate(cards: CasaHudConnectionCard[]): boolean {
  return getMissingCasaHudCoreConnections(cards).length > 0;
}

export function getCasaHudSetupMessage(cards: CasaHudConnectionCard[]): string {
  const missing = getMissingCasaHudCoreConnections(cards);
  if (missing.length === 0) {
    return "CasaHUD has the core connections needed to create, render, publish, and schedule a production video.";
  }

  const names = missing.map((card) => card.title).join(", ");
  return `Connect ${names} before CasaHUD generates a production video. These services power research, creative generation, real listing selection, local context, publishing, and scheduling.`;
}
