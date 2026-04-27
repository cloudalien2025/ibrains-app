export type DomaraIntegrationProviderId =
  | "openai"
  | "elevenlabs"
  | "mapbox"
  | "google_maps_places"
  | "idealista"
  | "immobiliare"
  | "cloudinary"
  | "digitalocean_spaces"
  | "youtube";

export type DomaraIntegrationValidationStatus = "unknown" | "configured" | "missing" | "invalid";
export type DomaraIntegrationCategory =
  | "ai_generation"
  | "voice"
  | "maps"
  | "listing_ingestion"
  | "publishing"
  | "media_storage";

export type DomaraIntegrationProviderStatus = {
  providerId: DomaraIntegrationProviderId;
  displayName: string;
  category: DomaraIntegrationCategory;
  requiredEnvVars: string[];
  configured: boolean;
  validationStatus: DomaraIntegrationValidationStatus;
  safeSetupHelp: string;
  capabilitiesEnabled: string[];
  maskedKey?: string;
  lastUpdatedAt?: string;
  configuredBy?: "workspace" | "saved";
};

export type PublicDomaraIntegrationProviderStatus = Omit<DomaraIntegrationProviderStatus, "requiredEnvVars">;

type ProviderDefinition = {
  providerId: DomaraIntegrationProviderId;
  displayName: string;
  category: DomaraIntegrationCategory;
  requiredEnvVars: string[];
  optionalEnvVars?: string[];
  capabilitiesEnabled: string[];
  safeSetupHelp: string;
};

const DEFINITIONS: ProviderDefinition[] = [
  {
    providerId: "openai",
    displayName: "OpenAI",
    category: "ai_generation",
    requiredEnvVars: ["OPENAI_API_KEY"],
    optionalEnvVars: ["OPENAI_MODEL"],
    capabilitiesEnabled: [
      "Viral title strategy",
      "Script and storyboard generation",
      "YouTube package generation",
      "Review checks",
    ],
    safeSetupHelp: "Connect OpenAI to create titles, strategy, scripts, storyboards, narration prompts, packaging, and review checks.",
  },
  {
    providerId: "elevenlabs",
    displayName: "ElevenLabs",
    category: "voice",
    requiredEnvVars: ["ELEVENLABS_API_KEY"],
    optionalEnvVars: ["ELEVENLABS_VOICE_ID"],
    capabilitiesEnabled: ["Premium AI voice narration", "Narration audio preparation"],
    safeSetupHelp: "Connect ElevenLabs when you want CasaHUD to prepare premium voice narration.",
  },
  {
    providerId: "mapbox",
    displayName: "Mapbox",
    category: "maps",
    requiredEnvVars: ["MAPBOX_ACCESS_TOKEN"],
    optionalEnvVars: ["MAPBOX_STYLE_URL", "MAPBOX_STYLE_ID"],
    capabilitiesEnabled: ["Premium map visuals", "Property-location scenes", "Area view sequences"],
    safeSetupHelp: "Connect Mapbox to create premium map visuals, location scenes, and area sequences.",
  },
  {
    providerId: "google_maps_places",
    displayName: "Google Places",
    category: "maps",
    requiredEnvVars: ["GOOGLE_MAPS_API_KEY"],
    optionalEnvVars: ["GOOGLE_PLACES_API_KEY", "GOOGLE_STATIC_MAPS_API_KEY"],
    capabilitiesEnabled: ["Local places and POIs", "Lifestyle context", "Location storytelling"],
    safeSetupHelp: "Connect Google Places to find restaurants, landmarks, transit, schools, beaches, marinas, ski areas, golf courses, and local highlights.",
  },
  {
    providerId: "idealista",
    displayName: "Idealista",
    category: "listing_ingestion",
    requiredEnvVars: ["IDEALISTA_API_KEY"],
    optionalEnvVars: ["IDEALISTA_CLIENT_ID", "IDEALISTA_CLIENT_SECRET"],
    capabilitiesEnabled: ["Real property discovery", "Listing claim validation", "Source-backed video ideas"],
    safeSetupHelp: "Connect Idealista when your account and listing access are approved for CasaHUD.",
  },
  {
    providerId: "immobiliare",
    displayName: "Immobiliare",
    category: "listing_ingestion",
    requiredEnvVars: ["IMMOBILIARE_API_KEY"],
    capabilitiesEnabled: ["Real property discovery", "Listing claim validation", "Source-backed video ideas"],
    safeSetupHelp: "Connect Immobiliare when your account and listing access are approved for CasaHUD.",
  },
  {
    providerId: "cloudinary",
    displayName: "Cloudinary",
    category: "media_storage",
    requiredEnvVars: ["CLOUDINARY_URL"],
    capabilitiesEnabled: ["Thumbnail storage", "Generated media storage", "Exported package storage"],
    safeSetupHelp: "Connect Cloudinary to save thumbnails, generated assets, render files, and completed video packages.",
  },
  {
    providerId: "digitalocean_spaces",
    displayName: "DigitalOcean Spaces",
    category: "media_storage",
    requiredEnvVars: ["DO_SPACES_ACCESS_KEY", "DO_SPACES_SECRET_KEY", "DO_SPACES_BUCKET"],
    capabilitiesEnabled: ["Thumbnail storage", "Generated media storage", "Exported package storage"],
    safeSetupHelp: "Connect DigitalOcean Spaces to save thumbnails, generated assets, render files, and completed video packages.",
  },
  {
    providerId: "youtube",
    displayName: "YouTube Channel",
    category: "publishing",
    requiredEnvVars: ["YOUTUBE_API_KEY"],
    optionalEnvVars: ["YOUTUBE_CLIENT_ID", "YOUTUBE_CLIENT_SECRET", "YOUTUBE_REFRESH_TOKEN"],
    capabilitiesEnabled: ["YouTube research", "Upload preparation", "Publish and schedule actions"],
    safeSetupHelp: "Connect YouTube Channel to research ranking videos, prepare uploads, publish now, and schedule videos.",
  },
];

export type DomaraStoredIntegrationStatus = {
  providerId: DomaraIntegrationProviderId;
  configured: boolean;
  secretLast4?: string;
  updatedAt?: string;
};

function maskLast4(last4?: string): string {
  return last4 ? `••••••••${last4}` : "••••••••";
}

function hasEnv(name: string, env: NodeJS.ProcessEnv): boolean {
  const value = env[name];
  return typeof value === "string" && value.trim().length > 0;
}

export function getDomaraIntegrationStatuses(env: NodeJS.ProcessEnv = process.env): DomaraIntegrationProviderStatus[] {
  return DEFINITIONS.map((definition) => {
    const configured = definition.requiredEnvVars.every((key) => hasEnv(key, env));
    const validationStatus: DomaraIntegrationValidationStatus = configured ? "configured" : "missing";

    return {
      providerId: definition.providerId,
      displayName: definition.displayName,
      category: definition.category,
      requiredEnvVars: [],
      configured,
      validationStatus,
      safeSetupHelp: definition.safeSetupHelp,
      capabilitiesEnabled: definition.capabilitiesEnabled,
      maskedKey: configured ? maskLast4() : undefined,
      configuredBy: configured ? "workspace" : undefined,
    };
  });
}

export function mergeDomaraIntegrationStatusesWithStored(
  base: DomaraIntegrationProviderStatus[],
  stored: DomaraStoredIntegrationStatus[]
): DomaraIntegrationProviderStatus[] {
  const storedByProvider = new Map(stored.map((item) => [item.providerId, item]));

  return base.map((provider) => {
    const storedEntry = storedByProvider.get(provider.providerId);
    if (!storedEntry?.configured) return provider;
    if (provider.configured) return provider;

    return {
      ...provider,
      configured: true,
      validationStatus: "configured",
      maskedKey: maskLast4(storedEntry.secretLast4),
      lastUpdatedAt: storedEntry.updatedAt,
      configuredBy: "saved",
    };
  });
}

export function toPublicDomaraIntegrationStatuses(
  providers: DomaraIntegrationProviderStatus[]
): PublicDomaraIntegrationProviderStatus[] {
  return providers.map(({ requiredEnvVars: _requiredEnvVars, ...provider }) => provider);
}

export function getDomaraIntegrationCapabilityMap(env: NodeJS.ProcessEnv = process.env) {
  const statuses = getDomaraIntegrationStatuses(env);
  const capabilities = buildDomaraIntegrationCapabilitiesFromStatuses(statuses);

  return {
    statuses,
    capabilities,
  };
}

export function buildDomaraIntegrationCapabilitiesFromStatuses(statuses: DomaraIntegrationProviderStatus[]) {
  const byId = Object.fromEntries(statuses.map((status) => [status.providerId, status])) as Record<
    DomaraIntegrationProviderId,
    DomaraIntegrationProviderStatus
  >;

  return {
    openaiGeneration: byId.openai?.configured ?? false,
    elevenlabsLiveNarration: byId.elevenlabs?.configured ?? false,
    mapboxVisuals: byId.mapbox?.configured ?? false,
    googleMapsVisuals: byId.google_maps_places?.configured ?? false,
    listingFetchIdealista: byId.idealista?.configured ?? false,
    listingFetchImmobiliare: byId.immobiliare?.configured ?? false,
    youtubePublishingApi: byId.youtube?.configured ?? false,
    mediaStorage: (byId.cloudinary?.configured ?? false) || (byId.digitalocean_spaces?.configured ?? false),
  };
}
