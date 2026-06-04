import "server-only";

import crypto from "crypto";
import { decryptSecret, encryptSecret } from "@/app/api/ecomviper/_utils/crypto";
import { query } from "@/app/api/ecomviper/_utils/db";
import { isUndefinedRelationError } from "@/app/api/directoryiq/_utils/sqlErrors";
import type {
  ShopifySerpApiConnectionStatus,
  ShopifySerpApiProviderStatus,
  ShopifySerpApiVisibilityScanResult,
} from "@/lib/ecomviper/shopify/shopify-types";

const CONNECTOR_ID = "ecomviper_shopify_serpapi";
const CREDENTIAL_SCOPE = "ecomviper:shopify:serpapi";
const SERPAPI_TIMEOUT_MS = 14_000;

interface CredentialRow {
  secret_ciphertext: string;
  secret_last4: string | null;
  secret_length: number | null;
  config_json: unknown;
  updated_at: string;
}

interface CredentialConfig {
  scope: string;
  provider: string;
  lastTestedAt: string | null;
  lastScanAt: string | null;
  lastError: string | null;
}

interface FallbackCredential {
  secretCiphertext: string;
  secretLast4: string | null;
  secretLength: number;
  config: CredentialConfig;
  updatedAt: string;
}

declare global {
  var __ecomviper_shopify_serpapi_connection_fallback__: Map<string, FallbackCredential> | undefined;
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
  if (!globalThis.__ecomviper_shopify_serpapi_connection_fallback__) {
    globalThis.__ecomviper_shopify_serpapi_connection_fallback__ = new Map<string, FallbackCredential>();
  }
  return globalThis.__ecomviper_shopify_serpapi_connection_fallback__;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asIsoTimestamp(value: unknown): string | null {
  const raw = asString(value);
  if (!raw) return null;
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString();
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function parseConfig(value: unknown): CredentialConfig {
  const record = asRecord(value);
  return {
    scope: asString(record?.scope) || "ecomviper_shopify",
    provider: asString(record?.provider) || "serpapi",
    lastTestedAt: asIsoTimestamp(record?.lastTestedAt),
    lastScanAt: asIsoTimestamp(record?.lastScanAt),
    lastError: asString(record?.lastError) || null,
  };
}

function buildConfigJson(config: CredentialConfig): string {
  return JSON.stringify({
    scope: config.scope,
    provider: config.provider,
    lastTestedAt: config.lastTestedAt,
    lastScanAt: config.lastScanAt,
    lastError: config.lastError,
  });
}

function maskApiKey(last4: string | null, length: number | null): string {
  if (!last4 || !length || length <= 0) return "Not configured";
  const hidden = "*".repeat(Math.max(Math.min(length - 4, 16), 6));
  return `${hidden}${last4}`;
}

function disconnectedStatus(saveSupported: boolean): ShopifySerpApiConnectionStatus {
  return {
    connected: false,
    status: "disconnected",
    maskedApiKey: "Not configured",
    updatedAt: null,
    saveSupported,
    lastTestedAt: null,
    lastScanAt: null,
    lastError: null,
  };
}

function asStatus(row: CredentialRow | null, saveSupported: boolean): ShopifySerpApiConnectionStatus {
  if (!row) return disconnectedStatus(saveSupported);
  const config = parseConfig(row.config_json);
  return {
    connected: true,
    status: "connected",
    maskedApiKey: maskApiKey(row.secret_last4, row.secret_length),
    updatedAt: row.updated_at,
    saveSupported,
    lastTestedAt: config.lastTestedAt,
    lastScanAt: config.lastScanAt,
    lastError: config.lastError,
  };
}

function availabilityError(): Error {
  return new Error(
    "Shopify SerpApi credential persistence is not available. Ensure DATABASE_URL (or DIRECTORYIQ_DATABASE_URL) and directoryiq_signal_source_credentials are configured."
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
      config_json: row.config,
      updated_at: row.updatedAt,
    };
  }

  if (!dbConfigured()) {
    throw availabilityError();
  }

  try {
    const rows = await query<CredentialRow>(
      `
      SELECT secret_ciphertext, secret_last4, secret_length, config_json, updated_at
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

async function persistConfigOnly(userId: string, config: CredentialConfig): Promise<void> {
  const credentialUserId = normalizeCredentialUserId(userId);

  if (allowFallbackStore()) {
    const row = getFallbackStore().get(connectorKey(userId));
    if (!row) return;
    getFallbackStore().set(connectorKey(userId), {
      ...row,
      config,
      updatedAt: new Date().toISOString(),
    });
    return;
  }

  if (!dbConfigured()) {
    throw availabilityError();
  }

  try {
    await query(
      `
      UPDATE directoryiq_signal_source_credentials
      SET config_json = $3::jsonb,
          updated_at = now()
      WHERE user_id = $1 AND connector_id = $2
      `,
      [credentialUserId, CONNECTOR_ID, buildConfigJson(config)]
    );
  } catch (error) {
    if (relationMissingOrUnavailable(error)) {
      throw availabilityError();
    }
    throw error;
  }
}

export async function isShopifySerpApiStoreAvailable(): Promise<boolean> {
  if (allowFallbackStore()) return true;
  if (!dbConfigured()) return false;

  try {
    const rows = await query<{ exists: string | null }>(
      "SELECT to_regclass('public.directoryiq_signal_source_credentials')::text as exists"
    );
    return Boolean(rows[0]?.exists);
  } catch {
    return false;
  }
}

export async function getShopifySerpApiConnectionStatusForUser(userId: string): Promise<ShopifySerpApiConnectionStatus> {
  const saveSupported = await isShopifySerpApiStoreAvailable();
  if (!saveSupported) {
    return disconnectedStatus(false);
  }

  const row = await readCredential(userId);
  return asStatus(row, true);
}

export async function saveShopifySerpApiConnectionForUser(params: {
  userId: string;
  apiKey: string;
}): Promise<ShopifySerpApiConnectionStatus> {
  const credentialUserId = normalizeCredentialUserId(params.userId);
  const secret = params.apiKey.trim();
  if (!secret) {
    throw new Error("SerpApi key is required.");
  }

  const encrypted = encryptSecret(secret, `${credentialUserId}:${CREDENTIAL_SCOPE}`);
  const last4 = secret.slice(-4) || null;
  const secretLength = secret.length;
  const config: CredentialConfig = {
    scope: "ecomviper_shopify",
    provider: "serpapi",
    lastTestedAt: null,
    lastScanAt: null,
    lastError: null,
  };

  if (allowFallbackStore()) {
    getFallbackStore().set(connectorKey(params.userId), {
      secretCiphertext: encrypted,
      secretLast4: last4,
      secretLength,
      config,
      updatedAt: new Date().toISOString(),
    });
    return getShopifySerpApiConnectionStatusForUser(params.userId);
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
        "EcomViper Shopify SerpApi",
        buildConfigJson(config),
      ]
    );
    return getShopifySerpApiConnectionStatusForUser(params.userId);
  } catch (error) {
    if (relationMissingOrUnavailable(error)) {
      throw availabilityError();
    }
    throw error;
  }
}

export async function deleteShopifySerpApiConnectionForUser(userId: string): Promise<ShopifySerpApiConnectionStatus> {
  const credentialUserId = normalizeCredentialUserId(userId);

  if (allowFallbackStore()) {
    getFallbackStore().delete(connectorKey(userId));
    return getShopifySerpApiConnectionStatusForUser(userId);
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
    return getShopifySerpApiConnectionStatusForUser(userId);
  } catch (error) {
    if (relationMissingOrUnavailable(error)) {
      throw availabilityError();
    }
    throw error;
  }
}

export async function getShopifySerpApiKeyForUser(userId: string): Promise<string | null> {
  const credentialUserId = normalizeCredentialUserId(userId);
  const saveSupported = await isShopifySerpApiStoreAvailable();
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

function classifySerpApiStatus(statusCode: number, detail: string | null): {
  providerStatus: ShopifySerpApiProviderStatus;
  statusReason: string;
} {
  if (statusCode === 401) {
    return {
      providerStatus: "invalid_key",
      statusReason: detail || "SerpApi rejected the key (HTTP 401).",
    };
  }
  if (statusCode === 403) {
    return {
      providerStatus: "forbidden",
      statusReason: detail || "SerpApi request forbidden (HTTP 403).",
    };
  }
  if (statusCode === 429) {
    return {
      providerStatus: "rate_limited",
      statusReason: detail || "SerpApi rate limit reached (HTTP 429).",
    };
  }
  if (statusCode >= 400 && statusCode < 500) {
    return {
      providerStatus: "bad_request",
      statusReason: detail || `SerpApi request failed (HTTP ${statusCode}).`,
    };
  }
  if (statusCode >= 500) {
    return {
      providerStatus: "provider_error",
      statusReason: detail || `SerpApi provider error (HTTP ${statusCode}).`,
    };
  }
  return {
    providerStatus: "unknown_error",
    statusReason: detail || `SerpApi request failed (HTTP ${statusCode}).`,
  };
}

async function runSerpApiRequest(input: {
  apiKey: string;
  query: string;
  num?: number;
}): Promise<{
  ok: boolean;
  statusCode: number | null;
  payload: Record<string, unknown> | null;
  providerStatus: ShopifySerpApiProviderStatus;
  statusReason: string;
}> {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), SERPAPI_TIMEOUT_MS);
  try {
    const params = new URLSearchParams({
      engine: "google",
      q: input.query,
      num: String(Math.max(1, Math.min(input.num ?? 10, 20))),
      api_key: input.apiKey,
    });

    const response = await fetch(`https://serpapi.com/search.json?${params.toString()}`, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    });

    const text = await response.text();
    const payload = text ? (asRecord(JSON.parse(text)) ?? null) : null;

    if (!response.ok) {
      const detail = payload ? asString(payload.error) || asString(payload.message) : null;
      const classified = classifySerpApiStatus(response.status, detail || null);
      return {
        ok: false,
        statusCode: response.status,
        payload,
        providerStatus: classified.providerStatus,
        statusReason: classified.statusReason,
      };
    }

    const errorText = payload ? asString(payload.error) || asString(payload.message) : "";
    if (errorText) {
      return {
        ok: false,
        statusCode: response.status,
        payload,
        providerStatus: "provider_error",
        statusReason: errorText,
      };
    }

    return {
      ok: true,
      statusCode: response.status,
      payload,
      providerStatus: "connected",
      statusReason: "Connected to SerpApi.",
    };
  } catch {
    return {
      ok: false,
      statusCode: null,
      payload: null,
      providerStatus: "network_error",
      statusReason: "SerpApi request failed due to a network or timeout error.",
    };
  } finally {
    clearTimeout(timeoutHandle);
  }
}

export async function recordShopifySerpApiTestResultForUser(input: {
  userId: string;
  ok: boolean;
  errorMessage?: string | null;
}): Promise<void> {
  const row = await readCredential(input.userId);
  if (!row) return;
  const current = parseConfig(row.config_json);
  const nextConfig: CredentialConfig = {
    ...current,
    lastTestedAt: new Date().toISOString(),
    lastError: input.ok ? null : asString(input.errorMessage) || "SerpApi test failed.",
  };
  await persistConfigOnly(input.userId, nextConfig);
}

export async function recordShopifySerpApiScanResultForUser(input: {
  userId: string;
  ok: boolean;
  errorMessage?: string | null;
}): Promise<void> {
  const row = await readCredential(input.userId);
  if (!row) return;
  const current = parseConfig(row.config_json);
  const nextConfig: CredentialConfig = {
    ...current,
    lastScanAt: new Date().toISOString(),
    lastError: input.ok ? null : asString(input.errorMessage) || "Visibility scan failed.",
  };
  await persistConfigOnly(input.userId, nextConfig);
}

export async function testShopifySerpApiKey(apiKey: string): Promise<{
  providerStatus: ShopifySerpApiProviderStatus;
  statusReason: string;
  statusCode: number | null;
}> {
  const result = await runSerpApiRequest({
    apiKey,
    query: "shopify ecommerce",
    num: 1,
  });

  return {
    providerStatus: result.providerStatus,
    statusReason: result.statusReason,
    statusCode: result.statusCode,
  };
}

export async function runShopifyVisibilityScanWithSerpApi(input: {
  apiKey: string;
  storeDomain: string;
  query?: string | null;
}): Promise<ShopifySerpApiVisibilityScanResult> {
  const searchQuery = asString(input.query) || `site:${input.storeDomain}`;
  const result = await runSerpApiRequest({
    apiKey: input.apiKey,
    query: searchQuery,
    num: 10,
  });

  if (!result.ok || !result.payload) {
    return {
      providerStatus: result.providerStatus,
      statusReason: result.statusReason,
      statusCode: result.statusCode,
      searchQuery,
      totalResults: null,
      resultUrls: [],
      scannedAt: new Date().toISOString(),
    };
  }

  const searchInformation = asRecord(result.payload.search_information);
  const totalResults = asNumber(searchInformation?.total_results) ?? null;

  const organic = Array.isArray(result.payload.organic_results)
    ? result.payload.organic_results
    : [];

  const shopping = Array.isArray(result.payload.shopping_results)
    ? result.payload.shopping_results
    : [];

  const urls = [...organic, ...shopping]
    .map((entry) => asRecord(entry))
    .filter((entry): entry is Record<string, unknown> => entry !== null)
    .map((entry) => asString(entry.link) || asString(entry.source))
    .filter((entry) => entry.length > 0)
    .slice(0, 20);

  return {
    providerStatus: result.providerStatus,
    statusReason: result.statusReason,
    statusCode: result.statusCode,
    searchQuery,
    totalResults,
    resultUrls: urls,
    scannedAt: new Date().toISOString(),
  };
}
