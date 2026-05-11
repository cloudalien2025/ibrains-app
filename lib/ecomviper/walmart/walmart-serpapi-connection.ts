import "server-only";

import crypto from "crypto";
import { decryptSecret, encryptSecret } from "@/app/api/ecomviper/_utils/crypto";
import { query } from "@/app/api/ecomviper/_utils/db";
import { isUndefinedRelationError } from "@/app/api/directoryiq/_utils/sqlErrors";
import {
  extractSerpApiErrorDetail,
  sanitizeSerpApiErrorDetail,
} from "@/lib/ecomviper/walmart/serpapi-safety";
import type {
  WalmartSerpApiConnectionStatus,
  WalmartSerpApiProviderStatus,
  WalmartSerpApiTestDiagnostics,
} from "@/lib/ecomviper/walmart/walmart-types";

const CONNECTOR_ID = "ecomviper_walmart_serpapi";
const CREDENTIAL_SCOPE = "ecomviper:walmart:serpapi";
const TEST_PRODUCT_ID = "18410702298";
const SERPAPI_TEST_TIMEOUT_MS = 14_000;

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

function asObject(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function withSafeDetail(base: string, detail: string | null): string {
  if (!detail) return base;
  if (base.endsWith(".")) {
    return `${base.slice(0, -1)}: ${detail}`;
  }
  return `${base}: ${detail}`;
}

function classifyByStatusCode(status: number, safeDetail: string | null): {
  providerStatus: WalmartSerpApiProviderStatus;
  statusReason: string;
} {
  if (status === 400 || status === 404 || status === 422) {
    return {
      providerStatus: "bad_request",
      statusReason: withSafeDetail("SerpApi bad request.", safeDetail),
    };
  }
  if (status === 401) {
    return {
      providerStatus: "invalid_key",
      statusReason: "SerpApi key was rejected.",
    };
  }
  if (status === 402 || status === 429) {
    return {
      providerStatus: "rate_limited",
      statusReason: "SerpApi rate limit reached.",
    };
  }
  if (status === 403) {
    return {
      providerStatus: "forbidden",
      statusReason: "SerpApi account does not have permission.",
    };
  }
  if (status >= 500) {
    return {
      providerStatus: "provider_error",
      statusReason: withSafeDetail("SerpApi provider error.", safeDetail),
    };
  }
  return {
    providerStatus: "provider_error",
    statusReason: withSafeDetail(`SerpApi request failed with HTTP ${status}.`, safeDetail),
  };
}

function classifyByMessage(message: string): {
  providerStatus: WalmartSerpApiProviderStatus;
  statusReason: string;
  safeProviderErrorDetail: string | null;
} {
  const lowered = message.toLowerCase();
  const safeDetail = sanitizeSerpApiErrorDetail(message);

  if (
    lowered.includes("api_key is required") ||
    lowered.includes("api key is required") ||
    lowered.includes("no api key") ||
    lowered.includes("missing api key")
  ) {
    return {
      providerStatus: "not_connected",
      statusReason: "SerpApi key missing.",
      safeProviderErrorDetail: safeDetail,
    };
  }
  if (lowered.includes("api key") || lowered.includes("unauthorized") || lowered.includes("authentication")) {
    return {
      providerStatus: "invalid_key",
      statusReason: "SerpApi key was rejected.",
      safeProviderErrorDetail: safeDetail,
    };
  }
  if (
    lowered.includes("forbidden") ||
    lowered.includes("permission") ||
    lowered.includes("not allowed") ||
    lowered.includes("plan") ||
    lowered.includes("upgrade") ||
    lowered.includes("account deleted")
  ) {
    return {
      providerStatus: "forbidden",
      statusReason: "SerpApi account does not have permission.",
      safeProviderErrorDetail: safeDetail,
    };
  }
  if (
    lowered.includes("rate") ||
    lowered.includes("too many") ||
    lowered.includes("out of searches") ||
    lowered.includes("no searches") ||
    lowered.includes("insufficient credits") ||
    lowered.includes("quota") ||
    lowered.includes("429")
  ) {
    return {
      providerStatus: "rate_limited",
      statusReason: "SerpApi rate limit reached.",
      safeProviderErrorDetail: safeDetail,
    };
  }
  if (
    lowered.includes("parameter") ||
    lowered.includes("product_id is required") ||
    lowered.includes("engine is required") ||
    lowered.includes("bad request") ||
    lowered.includes("unable to process") ||
    lowered.includes("unsupported engine") ||
    lowered.includes("not supported") ||
    lowered.includes("400")
  ) {
    return {
      providerStatus: "bad_request",
      statusReason: withSafeDetail("SerpApi bad request.", safeDetail),
      safeProviderErrorDetail: safeDetail,
    };
  }
  if (
    lowered.includes("timeout") ||
    lowered.includes("econnreset") ||
    lowered.includes("etimedout") ||
    lowered.includes("network")
  ) {
    return {
      providerStatus: "network_error",
      statusReason: withSafeDetail("SerpApi network error.", safeDetail),
      safeProviderErrorDetail: safeDetail,
    };
  }
  if (lowered.includes("invalid json") || lowered.includes("malformed")) {
    return {
      providerStatus: "malformed_response",
      statusReason: withSafeDetail("SerpApi returned a malformed response.", safeDetail),
      safeProviderErrorDetail: safeDetail,
    };
  }
  if (
    lowered.includes("internal error") ||
    lowered.includes("server error") ||
    lowered.includes("temporarily unavailable")
  ) {
    return {
      providerStatus: "provider_error",
      statusReason: withSafeDetail("SerpApi provider error.", safeDetail),
      safeProviderErrorDetail: safeDetail,
    };
  }
  return {
    providerStatus: "provider_error",
    statusReason: withSafeDetail("SerpApi provider error.", safeDetail),
    safeProviderErrorDetail: safeDetail,
  };
}

function parseUsage(payload: unknown): WalmartSerpApiTestDiagnostics["usage"] {
  const root = asObject(payload) ?? {};
  const planSearchesPerMonth = asNumber(
    root.plan_searches_per_month ?? asObject(root.plan)?.searches_per_month
  );
  const thisMonthUsage = asNumber(
    root.this_month_usage ?? asObject(root.usage)?.this_month_usage ?? asObject(root.account_usage)?.this_month_usage
  );
  const totalSearchesLeft = asNumber(
    root.total_searches_left ??
      root.searches_left ??
      asObject(root.usage)?.searches_left ??
      asObject(root.account_usage)?.searches_left
  );

  if (planSearchesPerMonth === null && thisMonthUsage === null && totalSearchesLeft === null) {
    return null;
  }

  return {
    totalSearchesLeft,
    thisMonthUsage,
    planSearchesPerMonth,
  };
}

async function fetchSerpApiTestPayload(url: URL): Promise<{
  networkErrorDetail: string | null;
  statusCode: number | null;
  ok: boolean;
  payload: unknown;
  parseFailed: boolean;
  safeErrorDetail: string | null;
}> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SERPAPI_TEST_TIMEOUT_MS);
    const response = await fetch(url.toString(), {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    const bodyText = await response.text();
    let payload: unknown = {};
    let parseFailed = false;
    if (bodyText.trim()) {
      try {
        payload = JSON.parse(bodyText) as unknown;
      } catch {
        parseFailed = true;
      }
    }

    const safeErrorDetail =
      extractSerpApiErrorDetail(payload, { includeGenericMessage: true }) ??
      sanitizeSerpApiErrorDetail(bodyText);

    return {
      networkErrorDetail: null,
      statusCode: response.status,
      ok: response.ok,
      payload,
      parseFailed,
      safeErrorDetail,
    };
  } catch (error) {
    return {
      networkErrorDetail:
        sanitizeSerpApiErrorDetail(error instanceof Error ? error.message : String(error)) ?? null,
      statusCode: null,
      ok: false,
      payload: {},
      parseFailed: false,
      safeErrorDetail: null,
    };
  }
}

export async function testWalmartSerpApiKey(apiKey: string): Promise<WalmartSerpApiTestDiagnostics> {
  const normalizedApiKey = apiKey.trim();
  if (!normalizedApiKey) {
    return {
      providerStatus: "not_connected",
      statusCode: null,
      statusReason: "SerpApi key missing.",
      safeProviderErrorDetail: null,
      usage: null,
    };
  }

  const accountUrl = new URL("https://serpapi.com/account");
  accountUrl.searchParams.set("api_key", normalizedApiKey);
  const accountResponse = await fetchSerpApiTestPayload(accountUrl);
  if (accountResponse.networkErrorDetail) {
    return {
      providerStatus: "network_error",
      statusCode: null,
      statusReason: withSafeDetail("SerpApi network error.", accountResponse.networkErrorDetail),
      safeProviderErrorDetail: accountResponse.networkErrorDetail,
      usage: null,
    };
  }
  if (accountResponse.parseFailed) {
    return {
      providerStatus: "malformed_response",
      statusCode: accountResponse.statusCode,
      statusReason: "SerpApi returned a malformed response.",
      safeProviderErrorDetail: null,
      usage: null,
    };
  }

  const usage = parseUsage(accountResponse.payload);
  if (!accountResponse.ok) {
    const mapped = classifyByStatusCode(
      accountResponse.statusCode ?? 0,
      accountResponse.safeErrorDetail
    );
    return {
      providerStatus: mapped.providerStatus,
      statusCode: accountResponse.statusCode,
      statusReason: mapped.statusReason,
      safeProviderErrorDetail: accountResponse.safeErrorDetail,
      usage,
    };
  }

  const accountPayloadError = extractSerpApiErrorDetail(accountResponse.payload, {
    includeGenericMessage: true,
  });
  if (accountPayloadError) {
    const mapped = classifyByMessage(accountPayloadError);
    return {
      providerStatus: mapped.providerStatus,
      statusCode: accountResponse.statusCode,
      statusReason: mapped.statusReason,
      safeProviderErrorDetail: mapped.safeProviderErrorDetail,
      usage,
    };
  }

  const searchUrl = new URL("https://serpapi.com/search.json");
  searchUrl.searchParams.set("engine", "walmart_product");
  searchUrl.searchParams.set("product_id", TEST_PRODUCT_ID);
  searchUrl.searchParams.set("api_key", normalizedApiKey);

  const searchResponse = await fetchSerpApiTestPayload(searchUrl);
  if (searchResponse.networkErrorDetail) {
    return {
      providerStatus: "network_error",
      statusCode: null,
      statusReason: withSafeDetail("SerpApi network error.", searchResponse.networkErrorDetail),
      safeProviderErrorDetail: searchResponse.networkErrorDetail,
      usage,
    };
  }
  if (searchResponse.parseFailed) {
    return {
      providerStatus: "malformed_response",
      statusCode: searchResponse.statusCode,
      statusReason: "SerpApi returned a malformed response.",
      safeProviderErrorDetail: null,
      usage,
    };
  }
  if (!searchResponse.ok) {
    const mapped = classifyByStatusCode(searchResponse.statusCode ?? 0, searchResponse.safeErrorDetail);
    return {
      providerStatus: mapped.providerStatus,
      statusCode: searchResponse.statusCode,
      statusReason: mapped.statusReason,
      safeProviderErrorDetail: searchResponse.safeErrorDetail,
      usage,
    };
  }

  const searchPayloadError = extractSerpApiErrorDetail(searchResponse.payload, {
    includeGenericMessage: false,
  });
  if (searchPayloadError) {
    const mapped = classifyByMessage(searchPayloadError);
    return {
      providerStatus: mapped.providerStatus,
      statusCode: searchResponse.statusCode,
      statusReason: mapped.statusReason,
      safeProviderErrorDetail: mapped.safeProviderErrorDetail,
      usage,
    };
  }

  return {
    providerStatus: "connected",
    statusCode: searchResponse.statusCode,
    statusReason: "Connected to SerpApi.",
    safeProviderErrorDetail: null,
    usage,
  };
}
