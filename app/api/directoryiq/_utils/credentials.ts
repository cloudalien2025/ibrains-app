import { decryptSecret, encryptSecret } from "@/app/api/ecomviper/_utils/crypto";
import { query } from "@/app/api/ecomviper/_utils/db";
import { isUndefinedRelationError } from "@/app/api/directoryiq/_utils/sqlErrors";

export const DIRECTORYIQ_PRODUCT = "directoryiq" as const;
export const DIRECTORYIQ_PROVIDERS = ["brilliant_directories", "openai", "serpapi", "ga4"] as const;

export type DirectoryIqProvider = (typeof DIRECTORYIQ_PROVIDERS)[number];

type LegacyCredentialRow = {
  provider: string;
  status: string;
  secret_ciphertext: string | null;
  secret_iv: string | null;
  secret_tag: string | null;
  secret_last4: string | null;
  meta_json: Record<string, unknown> | null;
  saved_at: string;
  updated_at: string;
};

type CanonicalCredentialRow = {
  connector_id: string;
  secret_ciphertext: string | null;
  secret_last4: string | null;
  secret_length: number | null;
  label: string | null;
  config_json: Record<string, unknown> | null;
  updated_at: string;
};

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export function isDirectoryIqProvider(value: string): value is DirectoryIqProvider {
  return (DIRECTORYIQ_PROVIDERS as readonly string[]).includes(value);
}

function isNonBdProvider(provider: DirectoryIqProvider): provider is "openai" | "serpapi" | "ga4" {
  return provider === "openai" || provider === "serpapi" || provider === "ga4";
}

function maskLast4(last4: string | null): string {
  if (!last4) return "";
  return `********${last4}`;
}

function maskByLength(last4: string | null, length: number | null): string {
  if (!length || length <= 0) return "";
  const hidden = "*".repeat(Math.max(Math.min(length - 4, 12), 4));
  return `${hidden}${last4 ?? ""}`;
}

function splitCipherPayload(payloadB64: string): {
  ciphertext: string;
  iv: string | null;
  tag: string | null;
} {
  try {
    const parsed = JSON.parse(Buffer.from(payloadB64, "base64").toString("utf8")) as {
      ciphertext?: string;
      iv?: string;
      tag?: string;
    };
    if (!parsed.ciphertext) return { ciphertext: payloadB64, iv: null, tag: null };
    return {
      ciphertext: payloadB64,
      iv: parsed.iv ?? null,
      tag: parsed.tag ?? null,
    };
  } catch {
    return { ciphertext: payloadB64, iv: null, tag: null };
  }
}

function normalizeLabel(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function providerToConnector(provider: DirectoryIqProvider): "openai" | "serpapi" | "ga4" | null {
  if (provider === "openai" || provider === "serpapi" || provider === "ga4") return provider;
  return null;
}

async function listLegacyDirectoryIqIntegrations(userId: string): Promise<LegacyCredentialRow[]> {
  try {
    return await query<LegacyCredentialRow>(
      `
      SELECT provider, status, secret_last4, meta_json, saved_at, updated_at, secret_ciphertext, secret_iv, secret_tag
      FROM integrations_credentials
      WHERE user_id = $1 AND product = $2
      ORDER BY provider ASC
      `,
      [userId, DIRECTORYIQ_PRODUCT]
    );
  } catch (error) {
    if (!isUndefinedRelationError(error, "integrations_credentials")) {
      throw error;
    }
    return [];
  }
}

async function getLegacyDirectoryIqIntegration(userId: string, provider: DirectoryIqProvider): Promise<LegacyCredentialRow | null> {
  try {
    const rows = await query<LegacyCredentialRow>(
      `
      SELECT provider, status, secret_last4, meta_json, saved_at, updated_at, secret_ciphertext, secret_iv, secret_tag
      FROM integrations_credentials
      WHERE user_id = $1 AND product = $2 AND provider = $3
      LIMIT 1
      `,
      [userId, DIRECTORYIQ_PRODUCT, provider]
    );
    return rows[0] ?? null;
  } catch (error) {
    if (!isUndefinedRelationError(error, "integrations_credentials")) {
      throw error;
    }
    return null;
  }
}

async function listCanonicalNonBdIntegrations(userId: string): Promise<CanonicalCredentialRow[]> {
  try {
    return await query<CanonicalCredentialRow>(
      `
      SELECT connector_id, secret_ciphertext, secret_last4, secret_length, label, config_json, updated_at
      FROM directoryiq_signal_source_credentials
      WHERE user_id = $1 AND connector_id IN ('openai', 'serpapi', 'ga4')
      ORDER BY connector_id ASC
      `,
      [userId]
    );
  } catch (error) {
    if (!isUndefinedRelationError(error, "directoryiq_signal_source_credentials")) {
      throw error;
    }
    return [];
  }
}

async function getCanonicalNonBdIntegration(
  userId: string,
  provider: "openai" | "serpapi" | "ga4"
): Promise<CanonicalCredentialRow | null> {
  try {
    const rows = await query<CanonicalCredentialRow>(
      `
      SELECT connector_id, secret_ciphertext, secret_last4, secret_length, label, config_json, updated_at
      FROM directoryiq_signal_source_credentials
      WHERE user_id = $1 AND connector_id = $2
      LIMIT 1
      `,
      [userId, provider]
    );
    return rows[0] ?? null;
  } catch (error) {
    if (!isUndefinedRelationError(error, "directoryiq_signal_source_credentials")) {
      throw error;
    }
    return null;
  }
}

export type DirectoryIqIntegrationStatus = {
  provider: DirectoryIqProvider;
  status: "connected" | "disconnected";
  masked: string;
  savedAt: string | null;
  meta: Record<string, unknown>;
};

export async function listDirectoryIqIntegrations(userId: string): Promise<DirectoryIqIntegrationStatus[]> {
  const [legacyRows, canonicalRows] = await Promise.all([
    listLegacyDirectoryIqIntegrations(userId),
    listCanonicalNonBdIntegrations(userId),
  ]);

  const legacyByProvider = new Map(legacyRows.map((row) => [row.provider, row]));
  const canonicalByConnector = new Map(canonicalRows.map((row) => [row.connector_id, row]));

  return DIRECTORYIQ_PROVIDERS.map((provider) => {
    if (isNonBdProvider(provider)) {
      const row = canonicalByConnector.get(provider);
      const config = asObject(row?.config_json);
      const label = row?.label ?? normalizeLabel(config.label) ?? null;
      return {
        provider,
        status: row ? "connected" : "disconnected",
        masked: row ? maskByLength(row.secret_last4, row.secret_length) : "",
        savedAt: row?.updated_at ?? null,
        meta: label ? { ...config, label } : config,
      };
    }

    const row = legacyByProvider.get(provider);
    return {
      provider,
      status: row ? "connected" : "disconnected",
      masked: row ? maskLast4(row.secret_last4) : "",
      savedAt: row?.saved_at ?? null,
      meta: asObject(row?.meta_json),
    };
  });
}

export async function getDirectoryIqIntegration(userId: string, provider: DirectoryIqProvider): Promise<DirectoryIqIntegrationStatus> {
  if (isNonBdProvider(provider)) {
    const row = await getCanonicalNonBdIntegration(userId, provider);
    const config = asObject(row?.config_json);
    const label = row?.label ?? normalizeLabel(config.label) ?? null;

    return {
      provider,
      status: row ? "connected" : "disconnected",
      masked: row ? maskByLength(row.secret_last4, row.secret_length) : "",
      savedAt: row?.updated_at ?? null,
      meta: label ? { ...config, label } : config,
    };
  }

  const row = await getLegacyDirectoryIqIntegration(userId, provider);
  return {
    provider,
    status: row ? "connected" : "disconnected",
    masked: row ? maskLast4(row.secret_last4) : "",
    savedAt: row?.saved_at ?? null,
    meta: asObject(row?.meta_json),
  };
}

export async function saveDirectoryIqIntegration(params: {
  userId: string;
  provider: DirectoryIqProvider;
  secret: string;
  meta: Record<string, unknown>;
}): Promise<void> {
  if (!isNonBdProvider(params.provider)) {
    const encrypted = encryptSecret(params.secret, `${params.userId}:directoryiq:${params.provider}`);
    const split = splitCipherPayload(encrypted);
    const last4 = params.secret.slice(-4);

    await query(
      `
      INSERT INTO integrations_credentials
      (user_id, product, provider, status, secret_ciphertext, secret_iv, secret_tag, secret_last4, meta_json, saved_at, updated_at)
      VALUES ($1, $2, $3, 'connected', $4, $5, $6, $7, $8::jsonb, now(), now())
      ON CONFLICT (user_id, product, provider)
      DO UPDATE SET
        status = 'connected',
        secret_ciphertext = EXCLUDED.secret_ciphertext,
        secret_iv = EXCLUDED.secret_iv,
        secret_tag = EXCLUDED.secret_tag,
        secret_last4 = EXCLUDED.secret_last4,
        meta_json = EXCLUDED.meta_json,
        saved_at = now(),
        updated_at = now()
      `,
      [
        params.userId,
        DIRECTORYIQ_PRODUCT,
        params.provider,
        split.ciphertext,
        split.iv,
        split.tag,
        last4 || null,
        JSON.stringify(params.meta ?? {}),
      ]
    );
    return;
  }

  const encrypted = encryptSecret(params.secret, `${params.userId}:directoryiq:${params.provider}`);
  const last4 = params.secret.slice(-4);
  const meta = asObject(params.meta);
  const label = normalizeLabel(meta.label);
  const config = { ...meta };
  delete config.label;

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
      params.provider,
      encrypted,
      last4 || null,
      params.secret.length,
      label,
      JSON.stringify(config),
    ]
  );
}

export async function deleteDirectoryIqIntegration(userId: string, provider: DirectoryIqProvider): Promise<void> {
  if (!isNonBdProvider(provider)) {
    await query(
      `
      DELETE FROM integrations_credentials
      WHERE user_id = $1 AND product = $2 AND provider = $3
      `,
      [userId, DIRECTORYIQ_PRODUCT, provider]
    );
    return;
  }

  await query(
    `
    DELETE FROM directoryiq_signal_source_credentials
    WHERE user_id = $1 AND connector_id = $2
    `,
    [userId, provider]
  );
}

export async function getDirectoryIqIntegrationSecret(
  userId: string,
  provider: DirectoryIqProvider
): Promise<{ secret: string; meta: Record<string, unknown> } | null> {
  if (isNonBdProvider(provider)) {
    let rows: CanonicalCredentialRow[] = [];
    try {
      rows = await query<CanonicalCredentialRow>(
        `
        SELECT secret_ciphertext, config_json, label
        FROM directoryiq_signal_source_credentials
        WHERE user_id = $1 AND connector_id = $2
        LIMIT 1
        `,
        [userId, provider]
      );
    } catch (error) {
      if (isUndefinedRelationError(error, "directoryiq_signal_source_credentials")) return null;
      throw error;
    }

    const row = rows[0];
    if (!row?.secret_ciphertext) return null;

    const secret = decryptSecret(row.secret_ciphertext, `${userId}:directoryiq:${provider}`);
    const meta = asObject(row.config_json);
    const label = row.label ?? normalizeLabel(meta.label) ?? null;
    return { secret, meta: label ? { ...meta, label } : meta };
  }

  let rows: LegacyCredentialRow[] = [];
  try {
    rows = await query<LegacyCredentialRow>(
      `
      SELECT secret_ciphertext, meta_json
      FROM integrations_credentials
      WHERE user_id = $1 AND product = $2 AND provider = $3
      LIMIT 1
      `,
      [userId, DIRECTORYIQ_PRODUCT, provider]
    );
  } catch (error) {
    if (isUndefinedRelationError(error, "integrations_credentials")) return null;
    throw error;
  }

  const row = rows[0];
  if (!row?.secret_ciphertext) return null;
  const secret = decryptSecret(row.secret_ciphertext, `${userId}:directoryiq:${provider}`);
  return { secret, meta: asObject(row.meta_json) };
}

export async function isDirectoryIqCredentialStoreAvailable(): Promise<boolean> {
  try {
    const rows = await query<{ exists: string | null }>(
      `SELECT to_regclass('public.directoryiq_signal_source_credentials')::text as exists`
    );
    return Boolean(rows[0]?.exists);
  } catch (error) {
    if (isUndefinedRelationError(error, "directoryiq_signal_source_credentials")) return false;
    throw error;
  }
}
