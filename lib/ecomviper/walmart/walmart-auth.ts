import "server-only";

import crypto from "crypto";
import { appendActivityLog } from "@/lib/ecomviper/core/activity-log";
import { runWalmartSafeReadCheck, WALMART_PRODUCTION_BASE_URL } from "@/lib/ecomviper/walmart/walmart-client";
import {
  disconnectWalmartConnection,
  getWalmartConnectionState,
  getWalmartRuntimeMode,
  setWalmartConnectionState,
} from "@/lib/ecomviper/walmart/walmart-store";
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

declare global {
  var __ecomviper_walmart_token_cache__: WalmartTokenCache | undefined;
}

const WALMART_TOKEN_URL = `${WALMART_PRODUCTION_BASE_URL}/v3/token`;

function permissionsDefault(): WalmartPermissionCheck[] {
  return [
    { id: "catalog_read", label: "Items / Catalog read", state: "unknown" },
    { id: "item_maintenance", label: "Item maintenance / content update", state: "unknown" },
    { id: "inventory_update", label: "Inventory update", state: "unknown" },
    { id: "pricing_update", label: "Pricing update", state: "unknown" },
    { id: "feeds_submit_read", label: "Feeds submit/read", state: "unknown" },
    { id: "feed_error_reports", label: "Feed error reports", state: "unknown" },
  ];
}

function resolveRegion(value: string | null | undefined): WalmartRegion {
  return value?.trim().toUpperCase() === "US" ? "US" : "US";
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

function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
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
    });

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

function sanitizeInput(input: Partial<WalmartConnectionInput>): WalmartConnectionInput {
  const fallback = getWalmartEnvConfig();

  return {
    accountNickname: (input.accountNickname ?? fallback.accountNickname).trim() || "Walmart Account",
    clientId: (input.clientId ?? "").trim() || fallback.clientId,
    clientSecret: (input.clientSecret ?? "").trim() || fallback.clientSecret,
    marketplaceRegion: resolveRegion(input.marketplaceRegion ?? input.region ?? fallback.region),
    region: resolveRegion(input.region ?? input.marketplaceRegion ?? fallback.region),
    notes: typeof input.notes === "string" ? input.notes.trim() : "",
  };
}

function permissionStateForStatus(status: WalmartConnectionStatus): WalmartPermissionCheck["state"] {
  if (status === "connected") return "granted";
  if (status === "failed") return "missing";
  return "unknown";
}

function buildSummary(params: {
  input: WalmartConnectionInput;
  tokenStatus: WalmartConnectionSummary["tokenStatus"];
  safeReadStatus: WalmartConnectionSummary["safeReadStatus"];
  connectionStatus: WalmartConnectionStatus;
  clientSecretStored: boolean;
  credentialStorageMode: WalmartConnectionSummary["credentialStorageMode"];
  lastSuccessfulAuth: string | null;
  lastSuccessfulRead: string | null;
  lastApiError: WalmartApiError | null;
  diagnostic: WalmartConnectionSummary["diagnostic"];
}): WalmartConnectionSummary {
  const permissionState = permissionStateForStatus(params.connectionStatus);

  return {
    accountNickname: params.input.accountNickname,
    environment: "production",
    region: params.input.marketplaceRegion ?? "US",
    maskedClientId: maskClientId(params.input.clientId),
    clientSecretStored: params.clientSecretStored,
    lastSuccessfulAuth: params.lastSuccessfulAuth,
    lastSuccessfulRead: params.lastSuccessfulRead,
    lastApiError: params.lastApiError,
    tokenStatus: params.tokenStatus,
    safeReadStatus: params.safeReadStatus,
    permissionChecks: permissionsDefault().map((permission) => ({
      ...permission,
      state: permissionState,
    })),
    credentialStorageMode: params.credentialStorageMode,
    mode: getWalmartRuntimeMode(),
    diagnostic: params.diagnostic,
  };
}

function buildHealthFromChecks(params: {
  input: WalmartConnectionInput;
  token: WalmartTokenRequestResult;
  credentialStorageMode: WalmartConnectionSummary["credentialStorageMode"];
  safeReadResult?: Awaited<ReturnType<typeof runWalmartSafeReadCheck>>;
}): WalmartConnectionHealth {
  const now = new Date().toISOString();

  let connectionStatus: WalmartConnectionStatus;
  let safeReadStatus: WalmartConnectionSummary["safeReadStatus"] = "unknown";
  let lastError: WalmartApiError | null = params.token.lastError;
  let lastSuccessfulRead: string | null = null;
  let httpStatus: number | null = params.token.httpStatus;
  let correlationId = params.token.correlationId;

  if (!params.token.ok) {
    connectionStatus = params.token.lastError?.code === "MISSING_CREDENTIALS" ? "not_connected" : "failed";
  } else if (!params.safeReadResult) {
    connectionStatus = "token_valid_read_not_configured";
    safeReadStatus = "not_configured";
    lastError = toApiError(
      "WALMART_SAFE_READ_NOT_CONFIGURED",
      "Production token succeeded. Safe read check is not configured yet, so EcomViper cannot confirm catalog access."
    );
  } else if (params.safeReadResult.ok) {
    connectionStatus = "connected";
    safeReadStatus = "valid";
    lastError = null;
    lastSuccessfulRead = params.safeReadResult.lastSuccessfulRead;
    httpStatus = params.safeReadResult.httpStatus;
    correlationId = params.safeReadResult.correlationId;
  } else if (params.safeReadResult.safeReadStatus === "not_configured") {
    connectionStatus = "token_valid_read_not_configured";
    safeReadStatus = "not_configured";
    lastError = toApiError(
      "WALMART_SAFE_READ_NOT_CONFIGURED",
      "Production token succeeded. Safe read check is not configured yet, so EcomViper cannot confirm catalog access."
    );
    httpStatus = params.safeReadResult.httpStatus;
    correlationId = params.safeReadResult.correlationId;
  } else {
    connectionStatus = "failed";
    safeReadStatus = params.safeReadResult.safeReadStatus;
    lastError = params.safeReadResult.lastError;
    httpStatus = params.safeReadResult.httpStatus;
    correlationId = params.safeReadResult.correlationId;
  }

  const summary = buildSummary({
    input: params.input,
    tokenStatus: params.token.tokenStatus,
    safeReadStatus,
    connectionStatus,
    clientSecretStored: Boolean(params.input.clientSecret),
    credentialStorageMode: params.credentialStorageMode,
    lastSuccessfulAuth: params.token.ok ? now : null,
    lastSuccessfulRead,
    lastApiError: lastError,
    diagnostic: {
      environment: "production",
      baseUrl: WALMART_PRODUCTION_BASE_URL,
      tokenStatus: params.token.tokenStatus,
      safeReadStatus,
      httpStatus,
      correlationId,
      walmartErrorCode: lastError?.code ?? null,
      walmartErrorMessage: lastError?.message ?? null,
      timestamp: now,
    },
  });

  return {
    connectionStatus,
    summary,
    lastSuccessfulApiCall: lastSuccessfulRead ?? summary.lastSuccessfulAuth,
    lastApiError: lastError,
  };
}

export async function testWalmartConnection(input: Partial<WalmartConnectionInput>): Promise<WalmartConnectionHealth> {
  const sanitized = sanitizeInput(input);

  const token = await requestServerSideWalmartToken({
    clientId: sanitized.clientId,
    clientSecret: sanitized.clientSecret,
    marketplaceRegion: sanitized.marketplaceRegion,
    region: sanitized.region,
    forceRefresh: true,
  });

  const safeReadResult =
    token.ok && token.accessToken
      ? await runWalmartSafeReadCheck({
          accessToken: token.accessToken,
        })
      : undefined;

  const health = buildHealthFromChecks({
    input: sanitized,
    token,
    credentialStorageMode: "memory",
    safeReadResult,
  });

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

export async function saveWalmartConnection(input: Partial<WalmartConnectionInput>): Promise<WalmartConnectionHealth> {
  const health = await testWalmartConnection(input);

  setWalmartConnectionState({
    summary: health.summary,
    connectionStatus: health.connectionStatus,
    lastSuccessfulApiCall: health.lastSuccessfulApiCall,
    lastApiError: health.lastApiError,
  });

  appendActivityLog({
    marketplace: "walmart",
    actionType: "credential_save",
    result: health.connectionStatus === "connected" ? "success" : "warning",
    message:
      health.connectionStatus === "connected"
        ? "Walmart credential summary saved safely for production."
        : health.lastApiError?.message ?? "Credential summary saved with warnings.",
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

export async function rotateWalmartCredentials(input: Partial<WalmartConnectionInput>): Promise<WalmartConnectionHealth> {
  appendActivityLog({
    marketplace: "walmart",
    actionType: "credential_rotate",
    result: "warning",
    message: "Credential rotation requested.",
  });

  return saveWalmartConnection(input);
}

export function disconnectWalmart(): WalmartConnectionHealth {
  disconnectWalmartConnection();

  appendActivityLog({
    marketplace: "walmart",
    actionType: "credential_disconnect",
    result: "warning",
    message: "Walmart marketplace disconnected.",
  });

  return getWalmartConnectionHealth();
}

export function getWalmartConnectionHealth(): WalmartConnectionHealth {
  const state = getWalmartConnectionState();
  return {
    connectionStatus: state.connectionStatus,
    summary: state.summary,
    lastSuccessfulApiCall: state.lastSuccessfulApiCall,
    lastApiError: state.lastApiError,
  };
}

export function getWalmartPermissionChecklist(): WalmartPermissionCheck[] {
  return getWalmartConnectionState().summary.permissionChecks;
}
