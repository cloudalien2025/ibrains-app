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
      maskedKey: configured ? maskIntegrationKey(undefined) : undefined,
    };
  });
}
