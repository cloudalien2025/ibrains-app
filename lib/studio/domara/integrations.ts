export type DomaraIntegrationProviderId =
  | "openai"
  | "elevenlabs"
  | "mapbox"
  | "google_maps_places"
  | "idealista"
  | "immobiliare"
  | "youtube";

export type DomaraIntegrationValidationStatus = "unknown" | "configured" | "missing" | "invalid";

export type DomaraIntegrationProviderStatus = {
  providerId: DomaraIntegrationProviderId;
  displayName: string;
  category: "ai_generation" | "voice" | "maps" | "listing_ingestion" | "publishing";
  requiredEnvVars: string[];
  configured: boolean;
  validationStatus: DomaraIntegrationValidationStatus;
  safeSetupHelp: string;
  capabilitiesEnabled: string[];
  maskedKey?: string;
  lastUpdatedAt?: string;
  configuredBy?: "environment" | "saved";
};

type ProviderDefinition = {
  providerId: DomaraIntegrationProviderId;
  displayName: string;
  category: "ai_generation" | "voice" | "maps" | "listing_ingestion" | "publishing";
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
      "Script and storyboard generation",
      "Narration script generation",
      "YouTube metadata generation",
      "Content angle expansion",
    ],
    safeSetupHelp: "Set OPENAI_API_KEY on the server environment. Optional: OPENAI_MODEL.",
  },
  {
    providerId: "elevenlabs",
    displayName: "ElevenLabs",
    category: "voice",
    requiredEnvVars: ["ELEVENLABS_API_KEY"],
    optionalEnvVars: ["ELEVENLABS_VOICE_ID"],
    capabilitiesEnabled: ["Live narration audio synthesis", "Narrated MP4 render path"],
    safeSetupHelp: "Set ELEVENLABS_API_KEY on the server environment. Optional: ELEVENLABS_VOICE_ID.",
  },
  {
    providerId: "mapbox",
    displayName: "Mapbox",
    category: "maps",
    requiredEnvVars: ["MAPBOX_ACCESS_TOKEN"],
    optionalEnvVars: ["MAPBOX_STYLE_URL", "MAPBOX_STYLE_ID"],
    capabilitiesEnabled: ["Cinematic map visual scenes", "Mapbox static imagery provider path"],
    safeSetupHelp: "Set MAPBOX_ACCESS_TOKEN server-side. Optional: MAPBOX_STYLE_URL or MAPBOX_STYLE_ID.",
  },
  {
    providerId: "google_maps_places",
    displayName: "Google Maps / Places",
    category: "maps",
    requiredEnvVars: ["GOOGLE_MAPS_API_KEY"],
    optionalEnvVars: ["GOOGLE_PLACES_API_KEY", "GOOGLE_STATIC_MAPS_API_KEY"],
    capabilitiesEnabled: ["Location/POI enrichment provider path", "Google Static Maps fallback path"],
    safeSetupHelp:
      "Set GOOGLE_MAPS_API_KEY server-side. Optional: GOOGLE_PLACES_API_KEY and GOOGLE_STATIC_MAPS_API_KEY.",
  },
  {
    providerId: "idealista",
    displayName: "Idealista",
    category: "listing_ingestion",
    requiredEnvVars: ["IDEALISTA_API_KEY"],
    optionalEnvVars: ["IDEALISTA_CLIENT_ID", "IDEALISTA_CLIENT_SECRET"],
    capabilitiesEnabled: ["Listing fetch adapter (provider seam)"],
    safeSetupHelp:
      "Set IDEALISTA_API_KEY server-side. If your integration contract requires OAuth, configure client id/secret in server env.",
  },
  {
    providerId: "immobiliare",
    displayName: "Immobiliare",
    category: "listing_ingestion",
    requiredEnvVars: ["IMMOBILIARE_API_KEY"],
    capabilitiesEnabled: ["Listing fetch adapter (provider seam)"],
    safeSetupHelp: "Set IMMOBILIARE_API_KEY server-side for live provider integration.",
  },
  {
    providerId: "youtube",
    displayName: "YouTube",
    category: "publishing",
    requiredEnvVars: ["YOUTUBE_API_KEY"],
    optionalEnvVars: ["YOUTUBE_CLIENT_ID", "YOUTUBE_CLIENT_SECRET", "YOUTUBE_REFRESH_TOKEN"],
    capabilitiesEnabled: ["Publishing provider placeholder", "Future upload/scheduling bridge"],
    safeSetupHelp:
      "Set YouTube server credentials for future upload automation. Current phase exposes publishing package generation only.",
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
      requiredEnvVars: [...definition.requiredEnvVars, ...(definition.optionalEnvVars || [])],
      configured,
      validationStatus,
      safeSetupHelp: definition.safeSetupHelp,
      capabilitiesEnabled: definition.capabilitiesEnabled,
      maskedKey: configured ? maskLast4() : undefined,
      configuredBy: configured ? "environment" : undefined,
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
  };
}
