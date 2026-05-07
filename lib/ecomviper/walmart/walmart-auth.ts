import "server-only";

import crypto from "crypto";
import { appendActivityLog } from "@/lib/ecomviper/core/activity-log";
import {
  disconnectWalmartConnection,
  getWalmartConnectionState,
  getWalmartRuntimeMode,
  setWalmartConnectionSummary,
} from "@/lib/ecomviper/walmart/walmart-mock-data";
import type {
  WalmartApiError,
  WalmartConnectionHealth,
  WalmartConnectionInput,
  WalmartConnectionSummary,
  WalmartEnvironment,
  WalmartPermissionCheck,
  WalmartRegion,
} from "@/lib/ecomviper/walmart/walmart-types";

interface WalmartTokenCache {
  token: string;
  expiresAt: number;
  environment: WalmartEnvironment;
  region: WalmartRegion;
}

interface WalmartTokenRequestResult {
  ok: boolean;
  tokenStatus: WalmartConnectionSummary["tokenStatus"];
  lastError: WalmartApiError | null;
  accessToken: string | null;
  environment: WalmartEnvironment;
  marketplaceRegion: WalmartRegion;
}

declare global {
  var __ecomviper_walmart_token_cache__: WalmartTokenCache | undefined;
}

const WALMART_TOKEN_URL: Record<WalmartEnvironment, string> = {
  production: "https://marketplace.walmartapis.com/v3/token",
  sandbox: "https://sandbox.walmartapis.com/v3/token",
};

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

export function maskClientId(clientId: string): string {
  const trimmed = clientId.trim();
  if (!trimmed) return "Not configured";
  if (trimmed.length <= 4) return "****";
  return `${trimmed.slice(0, 2)}***${trimmed.slice(-4)}`;
}

function resolveEnvironment(value: string | null | undefined): WalmartEnvironment {
  return value?.trim().toLowerCase() === "production" ? "production" : "sandbox";
}

function resolveRegion(value: string | null | undefined): WalmartRegion {
  return value?.trim().toUpperCase() === "US" ? "US" : "US";
}

function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function sanitizeFailureMessage(params: {
  status?: number;
  payload?: unknown;
  fallback: string;
}): string {
  const { status, fallback } = params;
  if (status === 401) {
    return "Walmart token request failed: HTTP 401 unauthorized. Check that the Client ID/Secret pair is active and belongs to the selected environment.";
  }
  if (status === 403) {
    return "Walmart token request failed: HTTP 403 forbidden. Verify app permissions and environment access.";
  }
  if (status) {
    return `Walmart token request failed: HTTP ${status}.`;
  }
  return fallback;
}

function buildApiError(code: string, message: string): WalmartApiError {
  return { code, message };
}

export function getWalmartEnvConfig() {
  const clientId = process.env.WALMART_CLIENT_ID?.trim() ?? "";
  const clientSecret = process.env.WALMART_CLIENT_SECRET?.trim() ?? "";
  const environment = resolveEnvironment(process.env.WALMART_MARKETPLACE_ENV);
  const region = resolveRegion(process.env.WALMART_MARKETPLACE_REGION);
  const accountNickname = process.env.WALMART_ACCOUNT_NICKNAME?.trim() || "Walmart Account";

  const missingRequired = [
    clientId ? null : "WALMART_CLIENT_ID",
    clientSecret ? null : "WALMART_CLIENT_SECRET",
  ].filter((item): item is string => Boolean(item));

  return {
    accountNickname,
    clientId,
    clientSecret,
    environment,
    region,
    missingRequired,
    configured: missingRequired.length === 0,
  };
}

function buildSummary(input: {
  accountNickname: string;
  clientId: string;
  environment: WalmartEnvironment;
  region: WalmartRegion;
  clientSecretStored: boolean;
  lastSuccessfulAuth: string | null;
  lastApiError: WalmartApiError | null;
  tokenStatus: WalmartConnectionSummary["tokenStatus"];
  credentialStorageMode: WalmartConnectionSummary["credentialStorageMode"];
}): WalmartConnectionSummary {
  return {
    accountNickname: input.accountNickname,
    environment: input.environment,
    region: input.region,
    maskedClientId: maskClientId(input.clientId),
    clientSecretStored: input.clientSecretStored,
    lastSuccessfulAuth: input.lastSuccessfulAuth,
    lastApiError: input.lastApiError,
    tokenStatus: input.tokenStatus,
    permissionChecks: permissionsDefault().map((permission) => ({
      ...permission,
      state: input.clientSecretStored ? "granted" : "unknown",
    })),
    credentialStorageMode: input.credentialStorageMode,
    mode: getWalmartRuntimeMode(),
  };
}

function cacheServerToken(token: string, environment: WalmartEnvironment, region: WalmartRegion, expiresInSeconds: number): void {
  const now = Date.now();
  globalThis.__ecomviper_walmart_token_cache__ = {
    token,
    environment,
    region,
    expiresAt: now + Math.max(expiresInSeconds - 15, 30) * 1_000,
  };
}

export async function requestServerSideWalmartToken(params?: {
  clientId?: string;
  clientSecret?: string;
  environment?: WalmartEnvironment;
  marketplaceRegion?: WalmartRegion;
  region?: WalmartRegion;
}): Promise<WalmartTokenRequestResult> {
  const env = getWalmartEnvConfig();
  const environment = resolveEnvironment(params?.environment ?? env.environment);
  const marketplaceRegion = resolveRegion(params?.marketplaceRegion ?? params?.region ?? env.region);
  const clientId = params?.clientId?.trim() || env.clientId;
  const clientSecret = params?.clientSecret?.trim() || env.clientSecret;

  if (!clientId || !clientSecret) {
    return {
      ok: false,
      tokenStatus: "unknown",
      lastError: buildApiError("MISSING_CREDENTIALS", "Missing Walmart Client ID or Client Secret."),
      accessToken: null,
      environment,
      marketplaceRegion,
    };
  }

  const tokenUrl = WALMART_TOKEN_URL[environment];
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const body = new URLSearchParams({ grant_type: "client_credentials" }).toString();

  try {
    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
        "WM_QOS.CORRELATION_ID": crypto.randomUUID(),
        "WM_SVC.NAME": "Walmart Marketplace",
      },
      body,
      cache: "no-store",
    });

    const raw = await response.text();
    const payload = raw ? safeJsonParse(raw) : null;

    if (!response.ok) {
      return {
        ok: false,
        tokenStatus: "invalid",
        lastError: buildApiError(
          `WALMART_TOKEN_HTTP_${response.status}`,
          sanitizeFailureMessage({
            status: response.status,
            payload,
            fallback: "Walmart token request failed.",
          })
        ),
        accessToken: null,
        environment,
        marketplaceRegion,
      };
    }

    const token =
      payload && typeof payload === "object" && typeof (payload as { access_token?: unknown }).access_token === "string"
        ? (payload as { access_token: string }).access_token
        : "";

    const expiresIn =
      payload && typeof payload === "object" && typeof (payload as { expires_in?: unknown }).expires_in === "number"
        ? (payload as { expires_in: number }).expires_in
        : 900;

    if (!token) {
      return {
        ok: false,
        tokenStatus: "invalid",
        lastError: buildApiError("WALMART_TOKEN_INVALID_RESPONSE", "Walmart token request failed: invalid response payload."),
        accessToken: null,
        environment,
        marketplaceRegion,
      };
    }

    cacheServerToken(token, environment, marketplaceRegion, expiresIn);

    return {
      ok: true,
      tokenStatus: "valid",
      lastError: null,
      accessToken: token,
      environment,
      marketplaceRegion,
    };
  } catch {
    return {
      ok: false,
      tokenStatus: "unknown",
      lastError: buildApiError("WALMART_TOKEN_NETWORK_ERROR", "Walmart token request failed: network error."),
      accessToken: null,
      environment,
      marketplaceRegion,
    };
  }
}

function sanitizeInput(input: Partial<WalmartConnectionInput>): WalmartConnectionInput {
  const fallback = getWalmartEnvConfig();
  return {
    accountNickname: (input.accountNickname ?? fallback.accountNickname).trim() || "Walmart Account",
    clientId: (input.clientId ?? "").trim(),
    clientSecret: (input.clientSecret ?? "").trim(),
    environment: resolveEnvironment(input.environment),
    marketplaceRegion: resolveRegion(input.marketplaceRegion ?? input.region),
    region: resolveRegion(input.marketplaceRegion ?? input.region),
    notes: typeof input.notes === "string" ? input.notes.trim() : "",
  };
}

function buildConnectionHealthFromResult(params: {
  sanitized: WalmartConnectionInput;
  token: WalmartTokenRequestResult;
  credentialStorageMode: WalmartConnectionSummary["credentialStorageMode"];
}): WalmartConnectionHealth {
  const now = params.token.ok ? new Date().toISOString() : null;

  const summary = buildSummary({
    accountNickname: params.sanitized.accountNickname,
    clientId: params.sanitized.clientId,
    environment: params.token.environment,
    region: params.token.marketplaceRegion,
    clientSecretStored: Boolean(params.sanitized.clientSecret),
    lastSuccessfulAuth: now,
    lastApiError: params.token.lastError,
    tokenStatus: params.token.tokenStatus,
    credentialStorageMode: params.credentialStorageMode,
  });

  return {
    connectionStatus: params.token.ok ? "connected" : "not_connected",
    summary,
    lastSuccessfulApiCall: now,
    lastApiError: params.token.lastError,
  };
}

export async function testWalmartConnection(input: Partial<WalmartConnectionInput>): Promise<WalmartConnectionHealth> {
  const sanitized = sanitizeInput(input);
  const token = await requestServerSideWalmartToken({
    clientId: sanitized.clientId,
    clientSecret: sanitized.clientSecret,
    environment: sanitized.environment,
    marketplaceRegion: sanitized.marketplaceRegion,
  });

  const health = buildConnectionHealthFromResult({
    sanitized,
    token,
    credentialStorageMode: "memory",
  });

  appendActivityLog({
    marketplace: "walmart",
    actionType: "connection_test",
    result: token.ok ? "success" : "error",
    message: token.ok
      ? "Walmart connection test succeeded."
      : `Walmart connection test failed: ${token.lastError?.code ?? "UNKNOWN"}`,
    afterPayload: {
      accountNickname: sanitized.accountNickname,
      environment: health.summary.environment,
      region: health.summary.region,
      maskedClientId: health.summary.maskedClientId,
      tokenStatus: health.summary.tokenStatus,
      lastApiError: health.summary.lastApiError,
    },
  });

  return health;
}

export async function saveWalmartConnection(input: Partial<WalmartConnectionInput>): Promise<WalmartConnectionHealth> {
  const sanitized = sanitizeInput(input);
  const token = await requestServerSideWalmartToken({
    clientId: sanitized.clientId,
    clientSecret: sanitized.clientSecret,
    environment: sanitized.environment,
    marketplaceRegion: sanitized.marketplaceRegion,
  });

  const health = buildConnectionHealthFromResult({
    sanitized,
    token,
    credentialStorageMode: "memory",
  });

  const saved = setWalmartConnectionSummary(health.summary, health.connectionStatus);

  appendActivityLog({
    marketplace: "walmart",
    actionType: "credential_save",
    result: token.ok ? "success" : "warning",
    message: token.ok
      ? "Walmart credential summary saved without storing raw secret."
      : `Walmart credential save failed token check: ${token.lastError?.code ?? "UNKNOWN"}`,
    afterPayload: {
      accountNickname: saved.accountNickname,
      environment: saved.environment,
      region: saved.region,
      maskedClientId: saved.maskedClientId,
      clientSecretStored: saved.clientSecretStored,
      tokenStatus: saved.tokenStatus,
      lastApiError: saved.lastApiError,
    },
  });

  return {
    ...health,
    summary: saved,
  };
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

export function getWalmartSafeConnectionSummary(): WalmartConnectionSummary {
  return getWalmartConnectionState().summary;
}
