import { decryptSecret, encryptSecret } from "@/app/api/ecomviper/_utils/crypto";
import { query } from "@/app/api/ecomviper/_utils/db";
import { isUndefinedRelationError } from "@/app/api/directoryiq/_utils/sqlErrors";
import type { DomaraIntegrationProviderId } from "@/lib/studio/domara/integrations";

const CONNECTOR_PREFIX = "studio_domara_" as const;

type CredentialRow = {
  connector_id: string;
  secret_ciphertext: string;
  secret_last4: string | null;
  updated_at: string;
};

export type StudioStoredIntegrationStatus = {
  providerId: DomaraIntegrationProviderId;
  configured: boolean;
  secretLast4?: string;
  updatedAt?: string;
};

export type StudioIntegrationSecret = {
  providerId: DomaraIntegrationProviderId;
  secret: string;
  secretLast4?: string;
  updatedAt?: string;
};

export const STUDIO_INTEGRATION_PROVIDERS: DomaraIntegrationProviderId[] = [
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

export function isStudioIntegrationProvider(value: string): value is DomaraIntegrationProviderId {
  return STUDIO_INTEGRATION_PROVIDERS.includes(value as DomaraIntegrationProviderId);
}

function connectorId(providerId: DomaraIntegrationProviderId): string {
  return `${CONNECTOR_PREFIX}${providerId}`;
}

function providerFromConnector(connector: string): DomaraIntegrationProviderId | null {
  if (!connector.startsWith(CONNECTOR_PREFIX)) return null;
  const provider = connector.slice(CONNECTOR_PREFIX.length);
  return isStudioIntegrationProvider(provider) ? provider : null;
}

function relationMissingOrUnavailable(error: unknown): boolean {
  return isUndefinedRelationError(error, "directoryiq_signal_source_credentials");
}

export function sanitizeIntegrationApiKey(input: unknown): string {
  return typeof input === "string" ? input.trim() : "";
}

export function parseStudioIntegrationSavePayload(input: unknown): { ok: true; connectionKey: string } | { ok: false; message: string } {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, message: "Add a connection key before saving." };
  }

  const payload = input as { connectionKey?: unknown; apiKey?: unknown };
  const connectionKey = sanitizeIntegrationApiKey(payload.connectionKey ?? payload.apiKey);
  if (!connectionKey) return { ok: false, message: "Add a connection key before saving." };
  if (connectionKey.length < 6) return { ok: false, message: "Connection key looks too short. Check it and try again." };

  return { ok: true, connectionKey };
}

export function isStudioIntegrationEncryptionConfigured(): boolean {
  const keys = [process.env.INTEGRATIONS_ENCRYPTION_KEY, process.env.SERVER_ENCRYPTION_KEY];
  return keys.some((value) => typeof value === "string" && value.trim().length > 0);
}

export async function isStudioIntegrationStoreAvailable(): Promise<boolean> {
  try {
    const result = await query<{ exists: string | null }>(
      "SELECT to_regclass('public.directoryiq_signal_source_credentials')::text as exists"
    );
    return Boolean(result[0]?.exists);
  } catch (error) {
    if (relationMissingOrUnavailable(error)) return false;
    if (error instanceof Error && error.message.toLowerCase().includes("missing required env var")) return false;
    return false;
  }
}

export async function listStudioStoredIntegrationStatuses(userId: string): Promise<StudioStoredIntegrationStatus[]> {
  try {
    const rows = await query<CredentialRow>(
      `
      SELECT connector_id, secret_ciphertext, secret_last4, updated_at
      FROM directoryiq_signal_source_credentials
      WHERE user_id = $1 AND connector_id LIKE 'studio_domara_%'
      ORDER BY connector_id ASC
      `,
      [userId]
    );

    const result: StudioStoredIntegrationStatus[] = [];
    for (const row of rows) {
      const providerId = providerFromConnector(row.connector_id);
      if (!providerId) continue;
      result.push({
        providerId,
        configured: true,
        secretLast4: row.secret_last4 || undefined,
        updatedAt: row.updated_at,
      });
    }
    return result;
  } catch (error) {
    if (relationMissingOrUnavailable(error)) return [];
    throw error;
  }
}

export async function getStudioIntegrationSecret(
  userId: string,
  providerId: DomaraIntegrationProviderId
): Promise<StudioIntegrationSecret | null> {
  try {
    const rows = await query<CredentialRow>(
      `
      SELECT connector_id, secret_ciphertext, secret_last4, updated_at
      FROM directoryiq_signal_source_credentials
      WHERE user_id = $1 AND connector_id = $2
      LIMIT 1
      `,
      [userId, connectorId(providerId)]
    );
    const row = rows[0];
    if (!row?.secret_ciphertext) return null;

    return {
      providerId,
      secret: decryptSecret(row.secret_ciphertext, `${userId}:studio:${providerId}`),
      secretLast4: row.secret_last4 || undefined,
      updatedAt: row.updated_at,
    };
  } catch (error) {
    if (relationMissingOrUnavailable(error)) return null;
    throw error;
  }
}

export async function saveStudioIntegrationSecret(params: {
  userId: string;
  providerId: DomaraIntegrationProviderId;
  apiKey: string;
}): Promise<void> {
  const secret = sanitizeIntegrationApiKey(params.apiKey);
  if (!secret) {
    throw new Error("Add a connection key before saving.");
  }

  const encrypted = encryptSecret(secret, `${params.userId}:studio:${params.providerId}`);
  const last4 = secret.slice(-4) || null;

  await query(
    `
    INSERT INTO directoryiq_signal_source_credentials
    (user_id, connector_id, secret_ciphertext, secret_last4, secret_length, label, config_json, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, now(), now())
    ON CONFLICT (user_id, connector_id)
    DO UPDATE SET
      secret_ciphertext = EXCLUDED.secret_ciphertext,
      secret_last4 = EXCLUDED.secret_last4,
      secret_length = EXCLUDED.secret_length,
      label = EXCLUDED.label,
      config_json = EXCLUDED.config_json,
      updated_at = now()
    `,
    [
      params.userId,
      connectorId(params.providerId),
      encrypted,
      last4,
      secret.length,
      `CasaHUD ${params.providerId}`,
      JSON.stringify({ scope: "studio_domara" }),
    ]
  );
}

export async function clearStudioIntegrationSecret(params: {
  userId: string;
  providerId: DomaraIntegrationProviderId;
}): Promise<void> {
  await query(
    `
    DELETE FROM directoryiq_signal_source_credentials
    WHERE user_id = $1 AND connector_id = $2
    `,
    [params.userId, connectorId(params.providerId)]
  );
}
