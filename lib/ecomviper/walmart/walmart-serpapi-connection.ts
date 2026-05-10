import "server-only";

import crypto from "crypto";
import { decryptSecret, encryptSecret } from "@/app/api/ecomviper/_utils/crypto";
import { query } from "@/app/api/ecomviper/_utils/db";
import { isUndefinedRelationError } from "@/app/api/directoryiq/_utils/sqlErrors";
import type { WalmartSerpApiConnectionStatus } from "@/lib/ecomviper/walmart/walmart-types";

const CONNECTOR_ID = "ecomviper_walmart_serpapi";
const CREDENTIAL_SCOPE = "ecomviper:walmart:serpapi";
const TEST_PRODUCT_ID = "18410702298";

interface CredentialRow {
  secret_ciphertext: string;
  secret_last4: string | null;
  secret_length: number | null;
  updated_at: string;
}

interface FallbackCredential {
  secretCiphertext: string;
  secretLast4: string | null;
  secretLength: number;
  updatedAt: string;
}

declare global {
  var __ecomviper_walmart_serpapi_connection_fallback__: Map<string, FallbackCredential> | undefined;
}

function dbConfigured(): boolean {
  return Boolean(process.env.DIRECTORYIQ_DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim());
}

function allowFallbackStore(): boolean {
  return process.env.NODE_ENV === "test";
}

function relationMissingOrUnavailable(error: unknown): boolean {
  if (isUndefinedRelationError(error, "directoryiq_signal_source_credentials")) {
    return true;
  }
  return error instanceof Error && error.message.toLowerCase().includes("missing required env var");
}

function normalizeCredentialUserId(userId: string): string {
  const trimmed = userId.trim();
  if (!trimmed) return "00000000-0000-4000-8000-000000000000";

  const normalized = trimmed.toLowerCase();
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  if (uuidPattern.test(normalized)) return normalized;

  const hash = crypto.createHash("sha256").update(normalized).digest();
  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function connectorKey(userId: string): string {
  return `${normalizeCredentialUserId(userId)}:${CONNECTOR_ID}`;
}

function getFallbackStore(): Map<string, FallbackCredential> {
  if (!globalThis.__ecomviper_walmart_serpapi_connection_fallback__) {
    globalThis.__ecomviper_walmart_serpapi_connection_fallback__ = new Map<string, FallbackCredential>();
  }
  return globalThis.__ecomviper_walmart_serpapi_connection_fallback__;
}

function maskApiKey(last4: string | null, length: number | null): string {
  if (!last4 || !length || length <= 0) return "Not configured";
  const hidden = "*".repeat(Math.max(Math.min(length - 4, 12), 6));
  return `${hidden}${last4}`;
}

function disconnectedStatus(saveSupported: boolean): WalmartSerpApiConnectionStatus {
  return {
    connected: false,
    status: "disconnected",
    maskedApiKey: "Not configured",
    updatedAt: null,
    saveSupported,
  };
}

function asStatus(row: CredentialRow | null, saveSupported: boolean): WalmartSerpApiConnectionStatus {
  if (!row) return disconnectedStatus(saveSupported);
  return {
    connected: true,
    status: "connected",
    maskedApiKey: maskApiKey(row.secret_last4, row.secret_length),
    updatedAt: row.updated_at,
    saveSupported,
  };
}

function availabilityError(): Error {
  return new Error(
    "SerpApi credential persistence is not available. Ensure DATABASE_URL (or DIRECTORYIQ_DATABASE_URL) and directoryiq_signal_source_credentials are configured."
  );
}

async function readCredential(userId: string): Promise<CredentialRow | null> {
  const credentialUserId = normalizeCredentialUserId(userId);

  if (allowFallbackStore()) {
    const row = getFallbackStore().get(connectorKey(userId));
    if (!row) return null;
    return {
      secret_ciphertext: row.secretCiphertext,
      secret_last4: row.secretLast4,
      secret_length: row.secretLength,
      updated_at: row.updatedAt,
    };
  }

  if (!dbConfigured()) {
    throw availabilityError();
  }

  try {
    const rows = await query<CredentialRow>(
      `
      SELECT secret_ciphertext, secret_last4, secret_length, updated_at
      FROM directoryiq_signal_source_credentials
      WHERE user_id = $1 AND connector_id = $2
      LIMIT 1
      `,
      [credentialUserId, CONNECTOR_ID]
    );
    return rows[0] ?? null;
  } catch (error) {
    if (relationMissingOrUnavailable(error)) {
      throw availabilityError();
    }
    throw error;
  }
}

export async function isWalmartSerpApiStoreAvailable(): Promise<boolean> {
  if (allowFallbackStore()) return true;
  if (!dbConfigured()) return false;

  try {
    const rows = await query<{ exists: string | null }>(
      "SELECT to_regclass('public.directoryiq_signal_source_credentials')::text as exists"
    );
    return Boolean(rows[0]?.exists);
  } catch (error) {
    if (relationMissingOrUnavailable(error)) return false;
    return false;
  }
}

export async function getWalmartSerpApiConnectionStatusForUser(
  userId: string
): Promise<WalmartSerpApiConnectionStatus> {
  const saveSupported = await isWalmartSerpApiStoreAvailable();
  if (!saveSupported) {
    return disconnectedStatus(false);
  }

  const row = await readCredential(userId);
  return asStatus(row, true);
}

export async function saveWalmartSerpApiConnectionForUser(params: {
  userId: string;
  apiKey: string;
}): Promise<WalmartSerpApiConnectionStatus> {
  const credentialUserId = normalizeCredentialUserId(params.userId);
  const secret = params.apiKey.trim();
  if (!secret) {
    throw new Error("SerpApi key is required.");
  }

  const encrypted = encryptSecret(secret, `${credentialUserId}:${CREDENTIAL_SCOPE}`);
  const last4 = secret.slice(-4) || null;
  const secretLength = secret.length;

  if (allowFallbackStore()) {
    getFallbackStore().set(connectorKey(params.userId), {
      secretCiphertext: encrypted,
      secretLast4: last4,
      secretLength,
      updatedAt: new Date().toISOString(),
    });
    return getWalmartSerpApiConnectionStatusForUser(params.userId);
  }

  if (!dbConfigured()) {
    throw availabilityError();
  }

  try {
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
        credentialUserId,
        CONNECTOR_ID,
        encrypted,
        last4,
        secretLength,
        "EcomViper Walmart SerpApi",
        JSON.stringify({ scope: "ecomviper_walmart", provider: "serpapi" }),
      ]
    );
    return getWalmartSerpApiConnectionStatusForUser(params.userId);
  } catch (error) {
    if (relationMissingOrUnavailable(error)) {
      throw availabilityError();
    }
    throw error;
  }
}

export async function deleteWalmartSerpApiConnectionForUser(
  userId: string
): Promise<WalmartSerpApiConnectionStatus> {
  const credentialUserId = normalizeCredentialUserId(userId);

  if (allowFallbackStore()) {
    getFallbackStore().delete(connectorKey(userId));
    return getWalmartSerpApiConnectionStatusForUser(userId);
  }

  if (!dbConfigured()) {
    throw availabilityError();
  }

  try {
    await query(
      `
      DELETE FROM directoryiq_signal_source_credentials
      WHERE user_id = $1 AND connector_id = $2
      `,
      [credentialUserId, CONNECTOR_ID]
    );
    return getWalmartSerpApiConnectionStatusForUser(userId);
  } catch (error) {
    if (relationMissingOrUnavailable(error)) {
      throw availabilityError();
    }
    throw error;
  }
}

export async function getWalmartSerpApiKeyForUser(userId: string): Promise<string | null> {
  const credentialUserId = normalizeCredentialUserId(userId);
  const saveSupported = await isWalmartSerpApiStoreAvailable();
  if (!saveSupported) return null;

  const row = await readCredential(userId);
  if (!row?.secret_ciphertext) return null;

  try {
    return decryptSecret(row.secret_ciphertext, `${credentialUserId}:${CREDENTIAL_SCOPE}`);
  } catch {
    throw new Error(
      "Stored SerpApi credentials could not be decrypted. Re-save the key after configuring ECOMVIPER_CREDENTIAL_ENCRYPTION_KEY."
    );
  }
}

function sanitizeSerpApiTestError(status: number): Error {
  if (status === 401 || status === 403) {
    return new Error("SerpApi test failed: authentication error. Verify your SerpApi key.");
  }
  if (status === 429) {
    return new Error("SerpApi test failed: rate limited. Retry in a moment.");
  }
  if (status >= 500) {
    return new Error("SerpApi test failed: provider temporarily unavailable.");
  }
  return new Error(`SerpApi test failed: HTTP ${status}.`);
}

export async function testWalmartSerpApiKey(apiKey: string): Promise<void> {
  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "walmart_product");
  url.searchParams.set("product_id", TEST_PRODUCT_ID);
  url.searchParams.set("api_key", apiKey);

  const response = await fetch(url.toString(), {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    throw sanitizeSerpApiTestError(response.status);
  }

  const payload = (await response.json().catch(() => ({}))) as { error?: unknown };
  if (typeof payload.error === "string" && payload.error.trim()) {
    throw new Error("SerpApi test failed: provider returned an error response.");
  }
}
