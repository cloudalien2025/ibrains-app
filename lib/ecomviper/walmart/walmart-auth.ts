import "server-only";

import crypto from "crypto";
import { decryptSecret, encryptSecret } from "@/app/api/ecomviper/_utils/crypto";
import { appendActivityLog } from "@/lib/ecomviper/core/activity-log";
import { runWalmartSafeReadCheck, WALMART_PRODUCTION_BASE_URL } from "@/lib/ecomviper/walmart/walmart-client";
import {
  deletePersistedWalmartConnection,
  getPersistedWalmartConnection,
  updatePersistedWalmartConnectionStatus,
  upsertPersistedWalmartConnection,
  type PersistedWalmartConnection,
} from "@/lib/ecomviper/walmart/walmart-connection-repository";
import { getWalmartRuntimeMode } from "@/lib/ecomviper/walmart/walmart-store";
import type {
  WalmartApiError,
  WalmartConnectionHealth,
  WalmartConnectionInput,
  WalmartConnectionStatus,
  WalmartConnectionSummary,
  WalmartEnvironment,
  WalmartPermissionCheck,
  WalmartRegion,
  WalmartTokenStatus,
} from "@/lib/ecomviper/walmart/walmart-types";

interface WalmartTokenCache {
  token: string;
  expiresAt: number;
  region: WalmartRegion;
}

interface WalmartTokenRequestResult {
  ok: boolean;
  tokenStatus: WalmartTokenStatus;
  lastError: WalmartApiError | null;
  accessToken: string | null;
  environment: WalmartEnvironment;
  marketplaceRegion: WalmartRegion;
  httpStatus: number | null;
  correlationId: string;
}

interface ResolvedConnectionCredentials {
  accountNickname: string;
  clientId: string;
  clientSecret: string;
  marketplaceRegion: WalmartRegion;
  notes: string;
  persisted: PersistedWalmartConnection | null;
  secretSource: "submitted" | "stored" | "env";
}

declare global {
  var __ecomviper_walmart_token_cache__: WalmartTokenCache | undefined;
}

const WALMART_TOKEN_URL = `${WALMART_PRODUCTION_BASE_URL}/v3/token`;
const FALLBACK_CONNECTION_USER_ID = "ecomviper-system";
const WALMART_TOKEN_TIMEOUT_MS = 12_000;

function permissionsDefault(state: WalmartPermissionCheck["state"] = "unknown"): WalmartPermissionCheck[] {
  return [
    { id: "catalog_read", label: "Items / Catalog read", state },
    { id: "item_maintenance", label: "Item maintenance / content update", state },
    { id: "inventory_update", label: "Inventory update", state },
    { id: "pricing_update", label: "Pricing update", state },
    { id: "feeds_submit_read", label: "Feeds submit/read", state },
    { id: "feed_error_reports", label: "Feed error reports", state },
  ];
}

function resolveRegion(value: string | null | undefined): WalmartRegion {
  return value?.trim().toUpperCase() === "US" ? "US" : "US";
}

function resolveConnectionUserId(userId?: string): string {
  const trimmed = userId?.trim();
  if (trimmed) return trimmed;
  return process.env.DEFAULT_USER_ID?.trim() || FALLBACK_CONNECTION_USER_ID;
}

function toApiError(code: string, message: string): WalmartApiError {
  return { code, message };
}

function sanitizeTokenFailure(status: number | null): WalmartApiError {
  if (status === 401) {
    return toApiError(
      "WALMART_TOKEN_HTTP_401",
      "Production token request failed: HTTP 401 unauthorized. Confirm the Client ID and Client Secret are active production credentials."
    );
  }

  if (status === 403) {
    return toApiError("WALMART_TOKEN_HTTP_403", "Production token request failed: HTTP 403 forbidden. Check app roles/scopes.");
  }

  if (typeof status === "number") {
    return toApiError(`WALMART_TOKEN_HTTP_${status}`, `Production token request failed: HTTP ${status}.`);
  }

  return toApiError("WALMART_TOKEN_NETWORK_ERROR", "Production token request failed: network error.");
}

function cacheServerToken(token: string, region: WalmartRegion, expiresInSeconds: number): void {
  globalThis.__ecomviper_walmart_token_cache__ = {
    token,
    region,
    expiresAt: Date.now() + Math.max(expiresInSeconds - 15, 30) * 1_000,
  };
}

function getCachedToken(region: WalmartRegion): string | null {
  const cached = globalThis.__ecomviper_walmart_token_cache__;
  if (!cached) return null;
  if (cached.region !== region) return null;
  if (cached.expiresAt <= Date.now()) return null;
  return cached.token;
}

function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function permissionStateForStatus(status: WalmartConnectionStatus): WalmartPermissionCheck["state"] {
  if (status === "connected") return "granted";
  if (status === "failed") return "missing";
  return "unknown";
}

function apiErrorFromPersisted(record: PersistedWalmartConnection | null): WalmartApiError | null {
  if (!record?.lastErrorCode || !record.lastErrorMessage) return null;
  return toApiError(record.lastErrorCode, record.lastErrorMessage);
}

export function maskClientId(clientId: string): string {
  const trimmed = clientId.trim();
  if (!trimmed) return "Not configured";
  if (trimmed.length <= 4) return "****";
  return `${trimmed.slice(0, 2)}***${trimmed.slice(-4)}`;
}

export function getWalmartEnvConfig() {
  const clientId = process.env.WALMART_CLIENT_ID?.trim() ?? "";
  const clientSecret = process.env.WALMART_CLIENT_SECRET?.trim() ?? "";
  const region = resolveRegion(process.env.WALMART_MARKETPLACE_REGION);
  const accountNickname = process.env.WALMART_ACCOUNT_NICKNAME?.trim() || "Walmart Account";

  const missingRequired = [
    clientId ? null : "WALMART_CLIENT_ID",
    clientSecret ? null : "WALMART_CLIENT_SECRET",
  ].filter((item): item is string => Boolean(item));

  return {
    accountNickname,
    environment: "production" as WalmartEnvironment,
    region,
    clientId,
    clientSecret,
    configured: missingRequired.length === 0,
    missingRequired,
  };
}

function buildSummary(input: {
  accountNickname: string;
  clientId: string;
  clientSecretStored: boolean;
  credentialStorageMode: WalmartConnectionSummary["credentialStorageMode"];
  connectionStatus: WalmartConnectionStatus;
  tokenStatus: WalmartConnectionSummary["tokenStatus"];
  safeReadStatus: WalmartConnectionSummary["safeReadStatus"];
  lastSuccessfulAuth: string | null;
  lastSuccessfulRead: string | null;
  lastApiError: WalmartApiError | null;
  diagnostic: WalmartConnectionSummary["diagnostic"];
}): WalmartConnectionSummary {
  return {
    accountNickname: input.accountNickname,
    environment: "production",
    region: "US",
    maskedClientId: maskClientId(input.clientId),
    clientSecretStored: input.clientSecretStored,
    lastSuccessfulAuth: input.lastSuccessfulAuth,
    lastSuccessfulRead: input.lastSuccessfulRead,
    lastApiError: input.lastApiError,
    tokenStatus: input.tokenStatus,
    safeReadStatus: input.safeReadStatus,
    permissionChecks: permissionsDefault(permissionStateForStatus(input.connectionStatus)),
    credentialStorageMode: input.credentialStorageMode,
    mode: getWalmartRuntimeMode(),
    diagnostic: input.diagnostic,
  };
}

function buildHealthFromSummary(
  connectionStatus: WalmartConnectionStatus,
  summary: WalmartConnectionSummary
): WalmartConnectionHealth {
  return {
    connectionStatus,
    summary,
    lastSuccessfulApiCall: summary.lastSuccessfulRead ?? summary.lastSuccessfulAuth,
    lastApiError: summary.lastApiError,
  };
}

function buildDefaultConnectionHealth(): WalmartConnectionHealth {
  const env = getWalmartEnvConfig();

  const summary = buildSummary({
    accountNickname: env.accountNickname,
    clientId: "",
    clientSecretStored: false,
    credentialStorageMode: env.clientSecret ? "env" : "memory",
    connectionStatus: "not_connected",
    tokenStatus: "unknown",
    safeReadStatus: "unknown",
    lastSuccessfulAuth: null,
    lastSuccessfulRead: null,
    lastApiError: null,
    diagnostic: {
      environment: "production",
      baseUrl: WALMART_PRODUCTION_BASE_URL,
      tokenStatus: "unknown",
      safeReadStatus: "unknown",
      httpStatus: null,
      correlationId: null,
      walmartErrorCode: null,
      walmartErrorMessage: null,
      timestamp: null,
    },
  });

  return buildHealthFromSummary("not_connected", summary);
}

function healthFromPersisted(record: PersistedWalmartConnection): WalmartConnectionHealth {
  const lastApiError = apiErrorFromPersisted(record);

  const summary = buildSummary({
    accountNickname: record.accountName,
    clientId: record.clientId ?? "",
    clientSecretStored: Boolean(record.encryptedClientSecret),
    credentialStorageMode: record.credentialStorageMode,
    connectionStatus: record.status,
    tokenStatus: record.lastTokenStatus,
    safeReadStatus: record.lastSafeReadStatus,
    lastSuccessfulAuth: record.lastSuccessfulAuthAt,
    lastSuccessfulRead: record.lastSuccessfulReadAt,
    lastApiError,
    diagnostic: {
      environment: "production",
      baseUrl: WALMART_PRODUCTION_BASE_URL,
      tokenStatus: record.lastTokenStatus,
      safeReadStatus: record.lastSafeReadStatus,
      httpStatus: null,
      correlationId: null,
      walmartErrorCode: record.lastErrorCode,
      walmartErrorMessage: record.lastErrorMessage,
      timestamp: record.updatedAt,
    },
  });

  return buildHealthFromSummary(record.status, summary);
}

async function decryptStoredSecret(
  userId: string,
  record: PersistedWalmartConnection
): Promise<string | null> {
  if (!record.encryptedClientSecret) return null;

  try {
    return decryptSecret(record.encryptedClientSecret, `${userId}:ecomviper:walmart`);
  } catch {
    throw new Error(
      "Stored Walmart credentials could not be decrypted. Re-save credentials after configuring ECOMVIPER_CREDENTIAL_ENCRYPTION_KEY."
    );
  }
}

async function resolveConnectionCredentials(
  input: Partial<WalmartConnectionInput>,
  userId: string
): Promise<ResolvedConnectionCredentials | { error: WalmartApiError }> {
  const persisted = await getPersistedWalmartConnection(userId);
  const env = getWalmartEnvConfig();

  const accountNickname =
    (input.accountNickname ?? "").trim() || persisted?.accountName || env.accountNickname;
  const submittedClientId = (input.clientId ?? "").trim();
  const submittedClientSecret = (input.clientSecret ?? "").trim();

  const clientId = submittedClientId || persisted?.clientId || env.clientId;

  let clientSecret = "";
  let secretSource: ResolvedConnectionCredentials["secretSource"] = "submitted";

  if (submittedClientSecret) {
    clientSecret = submittedClientSecret;
    secretSource = "submitted";
  } else if (persisted?.encryptedClientSecret) {
    clientSecret = (await decryptStoredSecret(userId, persisted)) ?? "";
    secretSource = "stored";
  } else if (env.clientSecret) {
    clientSecret = env.clientSecret;
    secretSource = "env";
  }

  if (!clientId || !clientSecret) {
    return {
      error: toApiError(
        "MISSING_CREDENTIALS",
        "Missing Walmart Client ID or Client Secret. Save credentials or paste them before testing."
      ),
    };
  }

  return {
    accountNickname,
    clientId,
    clientSecret,
    marketplaceRegion: resolveRegion(input.marketplaceRegion ?? input.region ?? persisted?.region ?? env.region),
    notes: typeof input.notes === "string" ? input.notes.trim() : (persisted?.notes ?? ""),
    persisted,
    secretSource,
  };
}

function buildHealthFromCheck(input: {
  accountNickname: string;
  clientId: string;
  clientSecretStored: boolean;
  credentialStorageMode: WalmartConnectionSummary["credentialStorageMode"];
  token: WalmartTokenRequestResult;
  safeReadResult?: Awaited<ReturnType<typeof runWalmartSafeReadCheck>>;
}): WalmartConnectionHealth {
  const now = new Date().toISOString();

  let connectionStatus: WalmartConnectionStatus;
  let safeReadStatus: WalmartConnectionSummary["safeReadStatus"] = "unknown";
  let lastError: WalmartApiError | null = input.token.lastError;
  let lastSuccessfulRead: string | null = null;
  let httpStatus: number | null = input.token.httpStatus;
  let correlationId = input.token.correlationId;

  if (!input.token.ok) {
    connectionStatus = input.token.lastError?.code === "MISSING_CREDENTIALS" ? "not_connected" : "failed";
  } else if (!input.safeReadResult) {
    connectionStatus = "token_valid";
    safeReadStatus = "unknown";
    lastError = null;
  } else if (input.safeReadResult.ok) {
    connectionStatus = "connected";
    safeReadStatus = "valid";
    lastError = null;
    lastSuccessfulRead = input.safeReadResult.lastSuccessfulRead;
    httpStatus = input.safeReadResult.httpStatus;
    correlationId = input.safeReadResult.correlationId;
  } else if (input.safeReadResult.safeReadStatus === "not_configured") {
    connectionStatus = "token_valid_read_not_configured";
    safeReadStatus = "not_configured";
    lastError = toApiError(
      "WALMART_SAFE_READ_NOT_CONFIGURED",
      "Production token succeeded. Safe read check is not configured yet, so EcomViper cannot confirm catalog access."
    );
    httpStatus = input.safeReadResult.httpStatus;
    correlationId = input.safeReadResult.correlationId;
  } else {
    connectionStatus = "failed";
    safeReadStatus = input.safeReadResult.safeReadStatus;
    lastError = input.safeReadResult.lastError;
    httpStatus = input.safeReadResult.httpStatus;
    correlationId = input.safeReadResult.correlationId;
  }

  const summary = buildSummary({
    accountNickname: input.accountNickname,
    clientId: input.clientId,
    clientSecretStored: input.clientSecretStored,
    credentialStorageMode: input.credentialStorageMode,
    connectionStatus,
    tokenStatus: input.token.tokenStatus,
    safeReadStatus,
    lastSuccessfulAuth: input.token.ok ? now : null,
    lastSuccessfulRead,
    lastApiError: lastError,
    diagnostic: {
      environment: "production",
      baseUrl: WALMART_PRODUCTION_BASE_URL,
      tokenStatus: input.token.tokenStatus,
      safeReadStatus,
      httpStatus,
      correlationId,
      walmartErrorCode: lastError?.code ?? null,
      walmartErrorMessage: lastError?.message ?? null,
      timestamp: now,
    },
  });

  return buildHealthFromSummary(connectionStatus, summary);
}

function sanitizePersistenceError(error: unknown): Error {
  if (!(error instanceof Error)) {
    return new Error("Failed to persist Walmart credentials.");
  }

  const message = error.message;
  if (message.includes("Missing encryption key")) {
    return new Error("Credential encryption key is missing. Set ECOMVIPER_CREDENTIAL_ENCRYPTION_KEY.");
  }

  return error;
}

export async function requestServerSideWalmartToken(params?: {
  clientId?: string;
  clientSecret?: string;
  marketplaceRegion?: WalmartRegion;
  region?: WalmartRegion;
  forceRefresh?: boolean;
}): Promise<WalmartTokenRequestResult> {
  const env = getWalmartEnvConfig();
  const marketplaceRegion = resolveRegion(params?.marketplaceRegion ?? params?.region ?? env.region);
  const clientId = params?.clientId?.trim() || env.clientId;
  const clientSecret = params?.clientSecret?.trim() || env.clientSecret;
  const correlationId = crypto.randomUUID();

  if (!clientId || !clientSecret) {
    return {
      ok: false,
      tokenStatus: "unknown",
      lastError: toApiError("MISSING_CREDENTIALS", "Missing Walmart Client ID or Client Secret."),
      accessToken: null,
      environment: "production",
      marketplaceRegion,
      httpStatus: null,
      correlationId,
    };
  }

  if (!params?.forceRefresh) {
    const cachedToken = getCachedToken(marketplaceRegion);
    if (cachedToken) {
      return {
        ok: true,
        tokenStatus: "valid",
        lastError: null,
        accessToken: cachedToken,
        environment: "production",
        marketplaceRegion,
        httpStatus: 200,
        correlationId,
      };
    }
  }

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  try {
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), WALMART_TOKEN_TIMEOUT_MS);
    const response = await fetch(WALMART_TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
        "WM_QOS.CORRELATION_ID": correlationId,
        "WM_SVC.NAME": "Walmart Marketplace",
      },
      body: new URLSearchParams({ grant_type: "client_credentials" }).toString(),
      cache: "no-store",
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutHandle));

    const raw = await response.text();
    const payload = raw ? safeJsonParse(raw) : null;

    if (!response.ok) {
      return {
        ok: false,
        tokenStatus: "invalid",
        lastError: sanitizeTokenFailure(response.status),
        accessToken: null,
        environment: "production",
        marketplaceRegion,
        httpStatus: response.status,
        correlationId,
      };
    }

    const accessToken =
      payload && typeof payload === "object" && typeof (payload as { access_token?: unknown }).access_token === "string"
        ? (payload as { access_token: string }).access_token
        : "";

    const expiresIn =
      payload && typeof payload === "object" && typeof (payload as { expires_in?: unknown }).expires_in === "number"
        ? (payload as { expires_in: number }).expires_in
        : 900;

    if (!accessToken) {
      return {
        ok: false,
        tokenStatus: "invalid",
        lastError: toApiError("WALMART_TOKEN_INVALID_RESPONSE", "Production token request failed: invalid response payload."),
        accessToken: null,
        environment: "production",
        marketplaceRegion,
        httpStatus: response.status,
        correlationId,
      };
    }

    cacheServerToken(accessToken, marketplaceRegion, expiresIn);

    return {
      ok: true,
      tokenStatus: "valid",
      lastError: null,
      accessToken,
      environment: "production",
      marketplaceRegion,
      httpStatus: response.status,
      correlationId,
    };
  } catch {
    return {
      ok: false,
      tokenStatus: "unknown",
      lastError: sanitizeTokenFailure(null),
      accessToken: null,
      environment: "production",
      marketplaceRegion,
      httpStatus: null,
      correlationId,
    };
  }
}

export async function requestWalmartTokenForUser(
  userId: string,
  params?: { forceRefresh?: boolean }
): Promise<WalmartTokenRequestResult> {
  const resolvedUserId = resolveConnectionUserId(userId);
  const resolved = await resolveConnectionCredentials({}, resolvedUserId);

  if ("error" in resolved) {
    return {
      ok: false,
      tokenStatus: "unknown",
      lastError: resolved.error,
      accessToken: null,
      environment: "production",
      marketplaceRegion: "US",
      httpStatus: null,
      correlationId: crypto.randomUUID(),
    };
  }

  return requestServerSideWalmartToken({
    clientId: resolved.clientId,
    clientSecret: resolved.clientSecret,
    marketplaceRegion: resolved.marketplaceRegion,
    region: resolved.marketplaceRegion,
    forceRefresh: params?.forceRefresh ?? false,
  });
}

export async function testWalmartConnection(
  input: Partial<WalmartConnectionInput>,
  userId?: string
): Promise<WalmartConnectionHealth> {
  const resolvedUserId = resolveConnectionUserId(userId);
  const resolved = await resolveConnectionCredentials(input, resolvedUserId);

  if ("error" in resolved) {
    const persisted = await getPersistedWalmartConnection(resolvedUserId);
    const summary = buildSummary({
      accountNickname: (input.accountNickname ?? "").trim() || persisted?.accountName || getWalmartEnvConfig().accountNickname,
      clientId: (input.clientId ?? "").trim() || persisted?.clientId || "",
      clientSecretStored: Boolean(persisted?.encryptedClientSecret),
      credentialStorageMode: persisted?.credentialStorageMode ?? "memory",
      connectionStatus: "not_connected",
      tokenStatus: "unknown",
      safeReadStatus: "unknown",
      lastSuccessfulAuth: persisted?.lastSuccessfulAuthAt ?? null,
      lastSuccessfulRead: persisted?.lastSuccessfulReadAt ?? null,
      lastApiError: resolved.error,
      diagnostic: {
        environment: "production",
        baseUrl: WALMART_PRODUCTION_BASE_URL,
        tokenStatus: "unknown",
        safeReadStatus: "unknown",
        httpStatus: null,
        correlationId: null,
        walmartErrorCode: resolved.error.code,
        walmartErrorMessage: resolved.error.message,
        timestamp: new Date().toISOString(),
      },
    });

    const health = buildHealthFromSummary("not_connected", summary);

    if (persisted) {
      await updatePersistedWalmartConnectionStatus({
        userId: resolvedUserId,
        status: health.connectionStatus,
        lastTokenStatus: health.summary.tokenStatus,
        lastSafeReadStatus: health.summary.safeReadStatus,
        lastSuccessfulAuthAt: health.summary.lastSuccessfulAuth,
        lastSuccessfulReadAt: health.summary.lastSuccessfulRead,
        lastErrorCode: health.lastApiError?.code ?? null,
        lastErrorMessage: health.lastApiError?.message ?? null,
      });
    }

    return health;
  }

  const token = await requestServerSideWalmartToken({
    clientId: resolved.clientId,
    clientSecret: resolved.clientSecret,
    marketplaceRegion: resolved.marketplaceRegion,
    region: resolved.marketplaceRegion,
    forceRefresh: true,
  });

  const safeReadResult =
    token.ok && token.accessToken
      ? await runWalmartSafeReadCheck({
          accessToken: token.accessToken,
        })
      : undefined;

  const health = buildHealthFromCheck({
    accountNickname: resolved.accountNickname,
    clientId: resolved.clientId,
    clientSecretStored: Boolean(resolved.persisted?.encryptedClientSecret),
    credentialStorageMode: resolved.persisted?.credentialStorageMode ?? (resolved.secretSource === "env" ? "env" : "memory"),
    token,
    safeReadResult,
  });

  if (resolved.persisted) {
    await updatePersistedWalmartConnectionStatus({
      userId: resolvedUserId,
      status: health.connectionStatus,
      lastTokenStatus: health.summary.tokenStatus,
      lastSafeReadStatus: health.summary.safeReadStatus,
      lastSuccessfulAuthAt: health.summary.lastSuccessfulAuth,
      lastSuccessfulReadAt: health.summary.lastSuccessfulRead,
      lastErrorCode: health.lastApiError?.code ?? null,
      lastErrorMessage: health.lastApiError?.message ?? null,
    });
  }

  appendActivityLog({
    marketplace: "walmart",
    actionType: "connection_test",
    result: health.connectionStatus === "connected" ? "success" : health.connectionStatus === "failed" ? "error" : "warning",
    message:
      health.connectionStatus === "connected"
        ? "Connected. Production OAuth token and safe read check succeeded."
        : health.lastApiError?.message ?? "Connection test did not complete.",
    afterPayload: {
      accountNickname: health.summary.accountNickname,
      environment: health.summary.environment,
      region: health.summary.region,
      maskedClientId: health.summary.maskedClientId,
      tokenStatus: health.summary.tokenStatus,
      safeReadStatus: health.summary.safeReadStatus,
      diagnostic: health.summary.diagnostic,
    },
  });

  return health;
}

export async function saveWalmartConnection(
  input: Partial<WalmartConnectionInput>,
  userId?: string
): Promise<WalmartConnectionHealth> {
  const resolvedUserId = resolveConnectionUserId(userId);
  const resolved = await resolveConnectionCredentials(input, resolvedUserId);

  if ("error" in resolved) {
    const summary = buildSummary({
      accountNickname: (input.accountNickname ?? "").trim() || getWalmartEnvConfig().accountNickname,
      clientId: (input.clientId ?? "").trim(),
      clientSecretStored: false,
      credentialStorageMode: "memory",
      connectionStatus: "not_connected",
      tokenStatus: "unknown",
      safeReadStatus: "unknown",
      lastSuccessfulAuth: null,
      lastSuccessfulRead: null,
      lastApiError: resolved.error,
      diagnostic: {
        environment: "production",
        baseUrl: WALMART_PRODUCTION_BASE_URL,
        tokenStatus: "unknown",
        safeReadStatus: "unknown",
        httpStatus: null,
        correlationId: null,
        walmartErrorCode: resolved.error.code,
        walmartErrorMessage: resolved.error.message,
        timestamp: new Date().toISOString(),
      },
    });
    return buildHealthFromSummary("not_connected", summary);
  }

  const token = await requestServerSideWalmartToken({
    clientId: resolved.clientId,
    clientSecret: resolved.clientSecret,
    marketplaceRegion: resolved.marketplaceRegion,
    region: resolved.marketplaceRegion,
    forceRefresh: true,
  });

  const safeReadResult =
    token.ok && token.accessToken
      ? await runWalmartSafeReadCheck({
          accessToken: token.accessToken,
        })
      : undefined;

  const checked = buildHealthFromCheck({
    accountNickname: resolved.accountNickname,
    clientId: resolved.clientId,
    clientSecretStored: true,
    credentialStorageMode: "encrypted-db",
    token,
    safeReadResult,
  });

  let encryptedClientSecret = resolved.persisted?.encryptedClientSecret ?? null;

  try {
    if ((input.clientSecret ?? "").trim()) {
      encryptedClientSecret = encryptSecret((input.clientSecret ?? "").trim(), `${resolvedUserId}:ecomviper:walmart`);
    } else if (!encryptedClientSecret) {
      encryptedClientSecret = encryptSecret(resolved.clientSecret, `${resolvedUserId}:ecomviper:walmart`);
    }
  } catch (error) {
    throw sanitizePersistenceError(error);
  }

  const persisted = await upsertPersistedWalmartConnection({
    userId: resolvedUserId,
    accountName: resolved.accountNickname,
    environment: "production",
    region: resolved.marketplaceRegion,
    status: checked.connectionStatus,
    clientId: resolved.clientId,
    maskedClientId: maskClientId(resolved.clientId),
    encryptedClientSecret,
    credentialStorageMode: "encrypted-db",
    lastTokenStatus: checked.summary.tokenStatus,
    lastSafeReadStatus: checked.summary.safeReadStatus,
    lastSuccessfulAuthAt: checked.summary.lastSuccessfulAuth,
    lastSuccessfulReadAt: checked.summary.lastSuccessfulRead,
    lastErrorCode: checked.lastApiError?.code ?? null,
    lastErrorMessage: checked.lastApiError?.message ?? null,
    notes: resolved.notes || null,
  });

  const health = healthFromPersisted(persisted);

  appendActivityLog({
    marketplace: "walmart",
    actionType: "credential_save",
    result: health.connectionStatus === "connected" ? "success" : "warning",
    message:
      health.connectionStatus === "connected"
        ? "Credentials saved securely."
        : health.lastApiError?.message ?? "Credential save completed with warnings.",
    afterPayload: {
      accountNickname: health.summary.accountNickname,
      environment: health.summary.environment,
      region: health.summary.region,
      maskedClientId: health.summary.maskedClientId,
      clientSecretStored: health.summary.clientSecretStored,
      tokenStatus: health.summary.tokenStatus,
      safeReadStatus: health.summary.safeReadStatus,
      diagnostic: health.summary.diagnostic,
    },
  });

  return health;
}

export async function rotateWalmartCredentials(
  input: Partial<WalmartConnectionInput>,
  userId?: string
): Promise<WalmartConnectionHealth> {
  appendActivityLog({
    marketplace: "walmart",
    actionType: "credential_rotate",
    result: "warning",
    message: "Credential rotation requested.",
  });

  return saveWalmartConnection(input, userId);
}

export async function disconnectWalmart(userId?: string): Promise<WalmartConnectionHealth> {
  const resolvedUserId = resolveConnectionUserId(userId);
  await deletePersistedWalmartConnection(resolvedUserId);

  const health = buildDefaultConnectionHealth();

  appendActivityLog({
    marketplace: "walmart",
    actionType: "credential_disconnect",
    result: "warning",
    message: "Walmart marketplace disconnected.",
  });

  return health;
}

export function getWalmartConnectionHealth(): WalmartConnectionHealth {
  return buildDefaultConnectionHealth();
}

export async function getWalmartConnectionHealthForUser(userId: string): Promise<WalmartConnectionHealth> {
  const resolvedUserId = resolveConnectionUserId(userId);
  const persisted = await getPersistedWalmartConnection(resolvedUserId);
  if (!persisted) {
    return buildDefaultConnectionHealth();
  }

  return healthFromPersisted(persisted);
}

export function getWalmartPermissionChecklist(): WalmartPermissionCheck[] {
  return permissionsDefault("unknown");
}

export async function getWalmartPermissionChecklistForUser(userId: string): Promise<WalmartPermissionCheck[]> {
  const health = await getWalmartConnectionHealthForUser(userId);
  return health.summary.permissionChecks;
}
