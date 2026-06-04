import "server-only";

import crypto from "crypto";
import { decryptSecret, encryptSecret } from "@/app/api/ecomviper/_utils/crypto";
import { query } from "@/app/api/ecomviper/_utils/db";
import { isUndefinedRelationError } from "@/app/api/directoryiq/_utils/sqlErrors";
import {
  runShopifyClientCredentialsExchange,
  runShopifyGraphqlRequest,
  detectShopifyMissingScope,
} from "@/lib/ecomviper/shopify/shopify-client";
import { normalizeShopifyStoreDomain } from "@/lib/ecomviper/shopify/shopify-domain";
import {
  DEFAULT_SHOPIFY_API_VERSION,
  type ShopifyAuthMode,
  type ShopifyConnectionApiError,
  type ShopifyConnectionStatus,
  type ShopifyConnectionTestResult,
  type ShopifyConnectionTokenStatus,
} from "@/lib/ecomviper/shopify/shopify-types";

const CONNECTOR_ID = "ecomviper_shopify_admin";
const CREDENTIAL_SCOPE = "ecomviper:shopify:admin";
const SHOPIFY_TOKEN_REFRESH_WINDOW_MS = 60_000;

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
  authMode: ShopifyAuthMode;
  storeDomain: string;
  apiVersion: string;
  clientId: string;
  tokenStatus: ShopifyConnectionTokenStatus;
  lastTokenRefreshAt: string | null;
  tokenExpiresAt: string | null;
  grantedScopes: string[];
  lastApiError: ShopifyConnectionApiError | null;
}

interface FallbackCredential {
  secretCiphertext: string;
  secretLast4: string | null;
  secretLength: number;
  config: CredentialConfig;
  updatedAt: string;
}

interface CachedAccessToken {
  accessToken: string;
  tokenExpiresAt: string | null;
  grantedScopes: string[];
  expiresAtMs: number;
}

export interface ShopifyAdminCredentials {
  connected: boolean;
  authMode: ShopifyAuthMode;
  storeDomain: string;
  apiVersion: string;
  clientId: string;
  clientSecret: string;
  adminApiToken: string;
  tokenStatus: ShopifyConnectionTokenStatus;
  tokenExpiresAt: string | null;
  grantedScopes: string[];
}

export interface ShopifyConnectionInput {
  storeDomain: string;
  clientId?: string | null;
  clientSecret?: string | null;
  adminApiToken?: string | null;
  apiVersion?: string | null;
}

export interface ShopifyResolvedAccessToken {
  authMode: ShopifyAuthMode;
  storeDomain: string;
  apiVersion: string;
  accessToken: string;
  tokenExpiresAt: string | null;
  grantedScopes: string[];
}

declare global {
  var __ecomviper_shopify_connection_fallback__: Map<string, FallbackCredential> | undefined;
  var __ecomviper_shopify_access_token_cache__: Map<string, CachedAccessToken> | undefined;
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

function tokenCacheKey(params: {
  userId: string;
  storeDomain: string;
  apiVersion: string;
  clientId: string;
}): string {
  return `${normalizeCredentialUserId(params.userId)}:${params.storeDomain}:${params.apiVersion}:${params.clientId}`;
}

function getFallbackStore(): Map<string, FallbackCredential> {
  if (!globalThis.__ecomviper_shopify_connection_fallback__) {
    globalThis.__ecomviper_shopify_connection_fallback__ = new Map<string, FallbackCredential>();
  }
  return globalThis.__ecomviper_shopify_connection_fallback__;
}

function getTokenCache(): Map<string, CachedAccessToken> {
  if (!globalThis.__ecomviper_shopify_access_token_cache__) {
    globalThis.__ecomviper_shopify_access_token_cache__ = new Map<string, CachedAccessToken>();
  }
  return globalThis.__ecomviper_shopify_access_token_cache__;
}

function clearTokenCacheForUser(userId: string): void {
  const prefix = `${normalizeCredentialUserId(userId)}:`;
  for (const key of getTokenCache().keys()) {
    if (key.startsWith(prefix)) {
      getTokenCache().delete(key);
    }
  }
}

function toApiError(code: ShopifyConnectionApiError["code"], message: string): ShopifyConnectionApiError {
  return { code, message };
}

function maskClientId(clientId: string): string {
  const trimmed = clientId.trim();
  if (!trimmed) return "Not configured";
  if (trimmed.length <= 4) return "****";
  return `${trimmed.slice(0, 2)}***${trimmed.slice(-4)}`;
}

function disconnectedStatus(saveSupported: boolean): ShopifyConnectionStatus {
  return {
    connected: false,
    status: "disconnected",
    storeDomain: "",
    apiVersion: DEFAULT_SHOPIFY_API_VERSION,
    authMode: "dev_dashboard_client_credentials",
    maskedClientId: "Not configured",
    clientSecretStored: false,
    tokenStatus: "unknown",
    lastTokenRefreshAt: null,
    tokenExpiresAt: null,
    grantedScopes: [],
    lastApiError: null,
    updatedAt: null,
    saveSupported,
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => asString(entry)).filter((entry) => entry.length > 0);
}

function asIsoTimestamp(value: unknown): string | null {
  const raw = asString(value);
  if (!raw) return null;
  const timestamp = Date.parse(raw);
  if (!Number.isFinite(timestamp)) return null;
  return new Date(timestamp).toISOString();
}

function normalizeTokenStatus(value: string, fallback: ShopifyConnectionTokenStatus): ShopifyConnectionTokenStatus {
  const normalized = value.trim().toLowerCase();
  if (
    normalized === "valid" ||
    normalized === "refresh_required" ||
    normalized === "expired" ||
    normalized === "missing_scope" ||
    normalized === "invalid" ||
    normalized === "unknown"
  ) {
    return normalized;
  }
  return fallback;
}

function parseApiError(value: unknown): ShopifyConnectionApiError | null {
  const record = asRecord(value);
  if (!record) return null;
  const message = asString(record.message);
  if (!message) return null;

  const rawCode = asString(record.code) as ShopifyConnectionApiError["code"];
  const code = rawCode || "unknown_error";
  return { code, message };
}

function normalizeApiVersion(value: string | null | undefined): string {
  const raw = value?.trim() || DEFAULT_SHOPIFY_API_VERSION;
  return /^[0-9]{4}-[0-9]{2}$/.test(raw) ? raw : DEFAULT_SHOPIFY_API_VERSION;
}

function parseCredentialConfig(value: unknown, secretStored: boolean): CredentialConfig {
  const record = asRecord(value);

  const authModeRaw = asString(record?.authMode);
  const authMode: ShopifyAuthMode =
    authModeRaw === "dev_dashboard_client_credentials" || authModeRaw === "legacy_admin_token"
      ? authModeRaw
      : "legacy_admin_token";

  const fallbackTokenStatus: ShopifyConnectionTokenStatus =
    authMode === "dev_dashboard_client_credentials"
      ? secretStored
        ? "refresh_required"
        : "unknown"
      : secretStored
        ? "valid"
        : "unknown";

  return {
    scope: asString(record?.scope) || "ecomviper_shopify",
    provider:
      asString(record?.provider) ||
      (authMode === "dev_dashboard_client_credentials"
        ? "shopify_dev_dashboard_client_credentials"
        : "shopify_admin_graphql_legacy"),
    authMode,
    storeDomain: asString(record?.storeDomain),
    apiVersion: normalizeApiVersion(asString(record?.apiVersion) || DEFAULT_SHOPIFY_API_VERSION),
    clientId: asString(record?.clientId),
    tokenStatus: normalizeTokenStatus(asString(record?.tokenStatus), fallbackTokenStatus),
    lastTokenRefreshAt: asIsoTimestamp(record?.lastTokenRefreshAt),
    tokenExpiresAt: asIsoTimestamp(record?.tokenExpiresAt),
    grantedScopes: asStringArray(record?.grantedScopes),
    lastApiError: parseApiError(record?.lastApiError),
  };
}

function buildConfigJson(config: CredentialConfig): string {
  return JSON.stringify({
    scope: config.scope,
    provider: config.provider,
    authMode: config.authMode,
    storeDomain: config.storeDomain,
    apiVersion: config.apiVersion,
    clientId: config.clientId,
    tokenStatus: config.tokenStatus,
    lastTokenRefreshAt: config.lastTokenRefreshAt,
    tokenExpiresAt: config.tokenExpiresAt,
    grantedScopes: config.grantedScopes,
    lastApiError: config.lastApiError,
  });
}

function asStatus(row: CredentialRow | null, saveSupported: boolean): ShopifyConnectionStatus {
  if (!row) return disconnectedStatus(saveSupported);

  const secretStored = Boolean(row.secret_ciphertext && (row.secret_length ?? 0) > 0);
  const config = parseCredentialConfig(row.config_json, secretStored);

  const connected =
    config.authMode === "legacy_admin_token"
      ? secretStored && Boolean(config.storeDomain)
      : secretStored &&
        Boolean(config.storeDomain) &&
        Boolean(config.clientId) &&
        (config.tokenStatus === "valid" ||
          config.tokenStatus === "refresh_required" ||
          config.tokenStatus === "expired");

  return {
    connected,
    status: connected ? "connected" : "disconnected",
    storeDomain: config.storeDomain,
    apiVersion: config.apiVersion,
    authMode: config.authMode,
    maskedClientId:
      config.authMode === "legacy_admin_token" && !config.clientId
        ? "Legacy token mode"
        : maskClientId(config.clientId),
    clientSecretStored: secretStored,
    tokenStatus: config.tokenStatus,
    lastTokenRefreshAt: config.lastTokenRefreshAt,
    tokenExpiresAt: config.tokenExpiresAt,
    grantedScopes: config.grantedScopes,
    lastApiError: config.lastApiError,
    updatedAt: row.updated_at,
    saveSupported,
  };
}

function availabilityError(): Error {
  return new Error(
    "Shopify credential persistence is not available. Ensure DATABASE_URL (or DIRECTORYIQ_DATABASE_URL) and directoryiq_signal_source_credentials are configured."
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
    const key = connectorKey(userId);
    const existing = getFallbackStore().get(key);
    if (!existing) return;

    getFallbackStore().set(key, {
      ...existing,
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
      SET config_json = $3::jsonb, updated_at = now()
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

async function persistTokenMetadata(userId: string, input: {
  tokenStatus: ShopifyConnectionTokenStatus;
  lastTokenRefreshAt: string | null;
  tokenExpiresAt: string | null;
  grantedScopes: string[];
  lastApiError: ShopifyConnectionApiError | null;
}): Promise<void> {
  const row = await readCredential(userId);
  if (!row) return;

  const secretStored = Boolean(row.secret_ciphertext && (row.secret_length ?? 0) > 0);
  const config = parseCredentialConfig(row.config_json, secretStored);
  const nextConfig: CredentialConfig = {
    ...config,
    tokenStatus: input.tokenStatus,
    lastTokenRefreshAt: input.lastTokenRefreshAt,
    tokenExpiresAt: input.tokenExpiresAt,
    grantedScopes: input.grantedScopes,
    lastApiError: input.lastApiError,
  };

  await persistConfigOnly(userId, nextConfig);
}

export async function isShopifyStoreAvailable(): Promise<boolean> {
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

export async function getShopifyConnectionStatusForUser(userId: string): Promise<ShopifyConnectionStatus> {
  const saveSupported = await isShopifyStoreAvailable();
  if (!saveSupported) {
    return disconnectedStatus(false);
  }

  const row = await readCredential(userId);
  return asStatus(row, true);
}

export async function saveShopifyConnectionForUser(input: {
  userId: string;
  storeDomain: string;
  clientId?: string | null;
  clientSecret?: string | null;
  adminApiToken?: string | null;
  apiVersion?: string | null;
  connectionTest?: ShopifyConnectionTestResult;
}): Promise<ShopifyConnectionStatus> {
  const credentialUserId = normalizeCredentialUserId(input.userId);
  const normalizedStoreDomain = normalizeShopifyStoreDomain(input.storeDomain);
  if (!normalizedStoreDomain) {
    throw new Error("Shopify store domain must be a valid myshopify.com domain.");
  }

  const clientId = input.clientId?.trim() ?? "";
  const clientSecret = input.clientSecret?.trim() ?? "";
  const adminApiToken = input.adminApiToken?.trim() ?? "";

  const useLegacyToken = Boolean(adminApiToken) && !clientSecret;

  if (!useLegacyToken && !clientId) {
    throw new Error("Shopify Client ID is required.");
  }

  const secret = useLegacyToken ? adminApiToken : clientSecret;
  if (!secret) {
    throw new Error(useLegacyToken ? "Shopify Admin API token is required." : "Shopify Client Secret is required.");
  }

  const apiVersion = normalizeApiVersion(input.apiVersion);
  const encrypted = encryptSecret(secret, `${credentialUserId}:${CREDENTIAL_SCOPE}`);
  const last4 = secret.slice(-4) || null;
  const secretLength = secret.length;

  const config: CredentialConfig = {
    scope: "ecomviper_shopify",
    provider: useLegacyToken ? "shopify_admin_graphql_legacy" : "shopify_dev_dashboard_client_credentials",
    authMode: useLegacyToken ? "legacy_admin_token" : "dev_dashboard_client_credentials",
    storeDomain: normalizedStoreDomain,
    apiVersion,
    clientId,
    tokenStatus: input.connectionTest?.tokenStatus ?? "refresh_required",
    lastTokenRefreshAt: input.connectionTest?.ok ? new Date().toISOString() : null,
    tokenExpiresAt: input.connectionTest?.tokenExpiresAt ?? null,
    grantedScopes: input.connectionTest?.grantedScopes ?? [],
    lastApiError: input.connectionTest?.lastApiError ?? null,
  };

  if (allowFallbackStore()) {
    getFallbackStore().set(connectorKey(input.userId), {
      secretCiphertext: encrypted,
      secretLast4: last4,
      secretLength,
      config,
      updatedAt: new Date().toISOString(),
    });
    clearTokenCacheForUser(input.userId);
    return getShopifyConnectionStatusForUser(input.userId);
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
        "EcomViper Shopify Dev Dashboard",
        buildConfigJson(config),
      ]
    );

    clearTokenCacheForUser(input.userId);
    return getShopifyConnectionStatusForUser(input.userId);
  } catch (error) {
    if (relationMissingOrUnavailable(error)) {
      throw availabilityError();
    }
    throw error;
  }
}

export async function deleteShopifyConnectionForUser(userId: string): Promise<ShopifyConnectionStatus> {
  const credentialUserId = normalizeCredentialUserId(userId);

  if (allowFallbackStore()) {
    getFallbackStore().delete(connectorKey(userId));
    clearTokenCacheForUser(userId);
    return getShopifyConnectionStatusForUser(userId);
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
    clearTokenCacheForUser(userId);
    return getShopifyConnectionStatusForUser(userId);
  } catch (error) {
    if (relationMissingOrUnavailable(error)) {
      throw availabilityError();
    }
    throw error;
  }
}

export async function getShopifyAdminCredentialsForUser(userId: string): Promise<ShopifyAdminCredentials> {
  const credentialUserId = normalizeCredentialUserId(userId);
  const saveSupported = await isShopifyStoreAvailable();
  if (!saveSupported) {
    return {
      connected: false,
      authMode: "dev_dashboard_client_credentials",
      storeDomain: "",
      apiVersion: DEFAULT_SHOPIFY_API_VERSION,
      clientId: "",
      clientSecret: "",
      adminApiToken: "",
      tokenStatus: "unknown",
      tokenExpiresAt: null,
      grantedScopes: [],
    };
  }

  const row = await readCredential(userId);
  if (!row?.secret_ciphertext) {
    return {
      connected: false,
      authMode: "dev_dashboard_client_credentials",
      storeDomain: "",
      apiVersion: DEFAULT_SHOPIFY_API_VERSION,
      clientId: "",
      clientSecret: "",
      adminApiToken: "",
      tokenStatus: "unknown",
      tokenExpiresAt: null,
      grantedScopes: [],
    };
  }

  const secretStored = Boolean(row.secret_ciphertext && (row.secret_length ?? 0) > 0);
  const config = parseCredentialConfig(row.config_json, secretStored);

  if (!config.storeDomain) {
    return {
      connected: false,
      authMode: config.authMode,
      storeDomain: "",
      apiVersion: DEFAULT_SHOPIFY_API_VERSION,
      clientId: config.clientId,
      clientSecret: "",
      adminApiToken: "",
      tokenStatus: config.tokenStatus,
      tokenExpiresAt: config.tokenExpiresAt,
      grantedScopes: config.grantedScopes,
    };
  }

  try {
    const decrypted = decryptSecret(row.secret_ciphertext, `${credentialUserId}:${CREDENTIAL_SCOPE}`);
    const status = asStatus(row, true);
    return {
      connected: status.connected,
      authMode: config.authMode,
      storeDomain: config.storeDomain,
      apiVersion: normalizeApiVersion(config.apiVersion),
      clientId: config.clientId,
      clientSecret: config.authMode === "dev_dashboard_client_credentials" ? decrypted : "",
      adminApiToken: config.authMode === "legacy_admin_token" ? decrypted : "",
      tokenStatus: config.tokenStatus,
      tokenExpiresAt: config.tokenExpiresAt,
      grantedScopes: config.grantedScopes,
    };
  } catch {
    throw new Error(
      "Stored Shopify credentials could not be decrypted. Re-save credentials after configuring ECOMVIPER_CREDENTIAL_ENCRYPTION_KEY."
    );
  }
}

function hasReadProductsScope(scopes: string[]): boolean {
  return scopes.some((scope) => scope.trim().toLowerCase() === "read_products");
}

export async function resolveShopifyAccessTokenForUser(
  userId: string,
  options?: { forceRefresh?: boolean }
): Promise<ShopifyResolvedAccessToken> {
  const stored = await getShopifyAdminCredentialsForUser(userId);
  if (!stored.connected || !stored.storeDomain) {
    throw new Error("Connect Shopify using store domain, Client ID, and Client Secret before importing products.");
  }

  if (stored.authMode === "legacy_admin_token") {
    if (!stored.adminApiToken) {
      throw new Error("Legacy Shopify Admin token is missing. Reconnect Shopify using Client ID and Client Secret.");
    }

    return {
      authMode: stored.authMode,
      storeDomain: stored.storeDomain,
      apiVersion: stored.apiVersion,
      accessToken: stored.adminApiToken,
      tokenExpiresAt: null,
      grantedScopes: stored.grantedScopes,
    };
  }

  if (!stored.clientId || !stored.clientSecret) {
    throw new Error("Shopify Client ID and Client Secret are required. Reconnect Shopify to continue.");
  }

  const cacheKey = tokenCacheKey({
    userId,
    storeDomain: stored.storeDomain,
    apiVersion: stored.apiVersion,
    clientId: stored.clientId,
  });

  if (!options?.forceRefresh) {
    const cached = getTokenCache().get(cacheKey);
    if (cached && cached.expiresAtMs > Date.now() + SHOPIFY_TOKEN_REFRESH_WINDOW_MS) {
      return {
        authMode: stored.authMode,
        storeDomain: stored.storeDomain,
        apiVersion: stored.apiVersion,
        accessToken: cached.accessToken,
        tokenExpiresAt: cached.tokenExpiresAt,
        grantedScopes: cached.grantedScopes,
      };
    }
  }

  const exchange = await runShopifyClientCredentialsExchange({
    storeDomain: stored.storeDomain,
    clientId: stored.clientId,
    clientSecret: stored.clientSecret,
  });

  if (!exchange.ok || !exchange.accessToken) {
    await persistTokenMetadata(userId, {
      tokenStatus: exchange.tokenStatus,
      lastTokenRefreshAt: null,
      tokenExpiresAt: null,
      grantedScopes: exchange.grantedScopes,
      lastApiError: exchange.lastApiError,
    });

    throw new Error(exchange.errorMessage ?? "Shopify token exchange failed.");
  }

  const refreshedAt = new Date().toISOString();

  await persistTokenMetadata(userId, {
    tokenStatus: hasReadProductsScope(exchange.grantedScopes) ? "valid" : "missing_scope",
    lastTokenRefreshAt: refreshedAt,
    tokenExpiresAt: exchange.tokenExpiresAt,
    grantedScopes: exchange.grantedScopes,
    lastApiError: hasReadProductsScope(exchange.grantedScopes)
      ? null
      : toApiError("insufficient_scope", "Shopify token is missing required scope: read_products."),
  });

  const expiresAtMs = exchange.tokenExpiresAt ? Date.parse(exchange.tokenExpiresAt) : Date.now() + 30 * 1_000;
  getTokenCache().set(cacheKey, {
    accessToken: exchange.accessToken,
    tokenExpiresAt: exchange.tokenExpiresAt,
    grantedScopes: exchange.grantedScopes,
    expiresAtMs: Number.isFinite(expiresAtMs) ? expiresAtMs : Date.now() + 30 * 1_000,
  });

  return {
    authMode: stored.authMode,
    storeDomain: stored.storeDomain,
    apiVersion: stored.apiVersion,
    accessToken: exchange.accessToken,
    tokenExpiresAt: exchange.tokenExpiresAt,
    grantedScopes: exchange.grantedScopes,
  };
}

export async function testShopifyConnectionForUser(input: {
  userId: string;
  storeDomain?: string | null;
  clientId?: string | null;
  clientSecret?: string | null;
  apiVersion?: string | null;
  adminApiToken?: string | null;
}): Promise<ShopifyConnectionTestResult> {
  const stored = await getShopifyAdminCredentialsForUser(input.userId);

  const resolvedStoreDomain = normalizeShopifyStoreDomain(input.storeDomain ?? "") ?? stored.storeDomain;
  const resolvedApiVersion = normalizeApiVersion(input.apiVersion ?? stored.apiVersion);

  if (!resolvedStoreDomain) {
    throw new Error("Shopify store domain is required.");
  }

  const submittedClientId = input.clientId?.trim() ?? "";
  const submittedClientSecret = input.clientSecret?.trim() ?? "";
  const submittedLegacyToken = input.adminApiToken?.trim() ?? "";

  const hasSubmittedDevCredentials = Boolean(submittedClientId || submittedClientSecret);
  const hasSubmittedLegacyToken = Boolean(submittedLegacyToken);
  const shouldUseDevDashboardCredentials =
    hasSubmittedDevCredentials ||
    (!hasSubmittedLegacyToken && stored.authMode === "dev_dashboard_client_credentials");

  let accessToken = "";
  let grantedScopes: string[] = [];
  let tokenExpiresAt: string | null = null;
  let statusCode: number | null = null;
  let requestId: string | null = null;
  let tokenStatus: ShopifyConnectionTokenStatus = "unknown";

  if (shouldUseDevDashboardCredentials) {
    const clientId = submittedClientId || stored.clientId;
    const clientSecret = submittedClientSecret || stored.clientSecret;

    if (!clientId || !clientSecret) {
      throw new Error("Shopify Client ID and Client Secret are required.");
    }

    const exchange = await runShopifyClientCredentialsExchange({
      storeDomain: resolvedStoreDomain,
      clientId,
      clientSecret,
    });

    statusCode = exchange.statusCode;
    requestId = exchange.requestId;
    tokenStatus = exchange.tokenStatus;
    grantedScopes = exchange.grantedScopes;
    tokenExpiresAt = exchange.tokenExpiresAt;

    if (!exchange.ok || !exchange.accessToken) {
      return {
        ok: false,
        connectionStatus: "disconnected",
        requiredScope: "read_products",
        missingScope: false,
        statusCode,
        storeDomain: resolvedStoreDomain,
        apiVersion: resolvedApiVersion,
        requestId,
        message: exchange.errorMessage ?? "Shopify token exchange failed.",
        tokenStatus,
        tokenExpiresAt,
        grantedScopes,
        lastApiError: exchange.lastApiError,
        diagnosticEvent: "shopify_connection_token_exchange_failed",
      };
    }

    accessToken = exchange.accessToken;
  } else {
    const legacyToken = submittedLegacyToken || stored.adminApiToken;
    if (!legacyToken) {
      throw new Error("Shopify Admin API token is required.");
    }

    accessToken = legacyToken;
    tokenStatus = "valid";
  }

  const probe = await runShopifyGraphqlRequest<{
    shop?: { id?: string; name?: string; myshopifyDomain?: string } | null;
    products?: { nodes?: Array<{ id?: string; title?: string }> } | null;
  }>({
    storeDomain: resolvedStoreDomain,
    accessToken,
    apiVersion: resolvedApiVersion,
    query: `#graphql
      query ShopifyConnectionProbe {
        shop {
          id
          name
          myshopifyDomain
        }
        products(first: 1) {
          nodes {
            id
            title
          }
        }
      }
    `,
  });

  const scopeMissingFromProbe = detectShopifyMissingScope(probe.payload.errors);
  const scopeMissingFromGrant = grantedScopes.length > 0 && !hasReadProductsScope(grantedScopes);

  if (scopeMissingFromProbe || scopeMissingFromGrant) {
    const lastApiError = toApiError("insufficient_scope", "Shopify token is missing required scope: read_products.");
    return {
      ok: false,
      connectionStatus: "disconnected",
      requiredScope: "read_products",
      missingScope: true,
      statusCode: probe.statusCode ?? statusCode,
      storeDomain: resolvedStoreDomain,
      apiVersion: resolvedApiVersion,
      requestId: probe.requestId ?? requestId,
      message: lastApiError.message,
      tokenStatus: "missing_scope",
      tokenExpiresAt,
      grantedScopes,
      lastApiError,
      diagnosticEvent: "shopify_connection_missing_scope",
    };
  }

  if (!probe.ok) {
    const lastApiError =
      probe.lastApiError ??
      toApiError("graphql_request_failed", probe.errorMessage ?? "Shopify connection test failed.");

    return {
      ok: false,
      connectionStatus: "disconnected",
      requiredScope: "read_products",
      missingScope: false,
      statusCode: probe.statusCode ?? statusCode,
      storeDomain: resolvedStoreDomain,
      apiVersion: resolvedApiVersion,
      requestId: probe.requestId ?? requestId,
      message: lastApiError.message,
      tokenStatus: "invalid",
      tokenExpiresAt,
      grantedScopes,
      lastApiError,
      diagnosticEvent: "shopify_connection_graphql_failed",
    };
  }

  return {
    ok: true,
    connectionStatus: "connected",
    requiredScope: "read_products",
    missingScope: false,
    statusCode: probe.statusCode ?? statusCode,
    storeDomain: resolvedStoreDomain,
    apiVersion: resolvedApiVersion,
    requestId: probe.requestId ?? requestId,
    message: "Shopify connection verified with read_products scope.",
    tokenStatus: "valid",
    tokenExpiresAt,
    grantedScopes,
    lastApiError: null,
    diagnosticEvent: "shopify_connection_test_success",
  };
}
