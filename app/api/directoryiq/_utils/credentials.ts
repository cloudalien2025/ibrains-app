import { decryptSecret, encryptSecret } from "@/app/api/ecomviper/_utils/crypto";
import { query } from "@/app/api/ecomviper/_utils/db";

export const DIRECTORYIQ_PRODUCT = "directoryiq" as const;
export const DIRECTORYIQ_PROVIDERS = ["brilliant_directories", "openai", "serpapi", "ga4"] as const;

export type DirectoryIqProvider = (typeof DIRECTORYIQ_PROVIDERS)[number];

type CredentialRow = {
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

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export function isDirectoryIqProvider(value: string): value is DirectoryIqProvider {
  return (DIRECTORYIQ_PROVIDERS as readonly string[]).includes(value);
}

function maskLast4(last4: string | null): string {
  if (!last4) return "";
  return `********${last4}`;
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

export type DirectoryIqIntegrationStatus = {
  provider: DirectoryIqProvider;
  status: "connected" | "disconnected";
  masked: string;
  savedAt: string | null;
  meta: Record<string, unknown>;
};

export async function listDirectoryIqIntegrations(userId: string): Promise<DirectoryIqIntegrationStatus[]> {
  const rows = await query<CredentialRow>(
    `
    SELECT provider, status, secret_last4, meta_json, saved_at, updated_at, secret_ciphertext, secret_iv, secret_tag
    FROM integrations_credentials
    WHERE user_id = $1 AND product = $2
    ORDER BY provider ASC
    `,
    [userId, DIRECTORYIQ_PRODUCT]
  );

  const byProvider = new Map(rows.map((row) => [row.provider, row]));
  return DIRECTORYIQ_PROVIDERS.map((provider) => {
    const row = byProvider.get(provider);
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
  const rows = await query<CredentialRow>(
    `
    SELECT provider, status, secret_last4, meta_json, saved_at, updated_at, secret_ciphertext, secret_iv, secret_tag
    FROM integrations_credentials
    WHERE user_id = $1 AND product = $2 AND provider = $3
    LIMIT 1
    `,
    [userId, DIRECTORYIQ_PRODUCT, provider]
  );
  const row = rows[0];
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
}

export async function deleteDirectoryIqIntegration(userId: string, provider: DirectoryIqProvider): Promise<void> {
  await query(
    `
    DELETE FROM integrations_credentials
    WHERE user_id = $1 AND product = $2 AND provider = $3
    `,
    [userId, DIRECTORYIQ_PRODUCT, provider]
  );
}

export async function getDirectoryIqIntegrationSecret(
  userId: string,
  provider: DirectoryIqProvider
): Promise<{ secret: string; meta: Record<string, unknown> } | null> {
  const rows = await query<CredentialRow>(
    `
    SELECT secret_ciphertext, meta_json
    FROM integrations_credentials
    WHERE user_id = $1 AND product = $2 AND provider = $3
    LIMIT 1
    `,
    [userId, DIRECTORYIQ_PRODUCT, provider]
  );
  const row = rows[0];
  if (!row?.secret_ciphertext) return null;
  const secret = decryptSecret(row.secret_ciphertext, `${userId}:directoryiq:${provider}`);
  return { secret, meta: asObject(row.meta_json) };
}
