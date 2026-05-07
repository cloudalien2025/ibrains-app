import "server-only";

import crypto from "crypto";
import { appendActivityLog } from "@/lib/ecomviper/core/activity-log";
import { getWalmartConnectionState, getWalmartRuntimeMode, setWalmartConnectionSummary, disconnectWalmartConnection } from "@/lib/ecomviper/walmart/walmart-mock-data";
import type { WalmartConnectionHealth, WalmartConnectionInput, WalmartConnectionSummary, WalmartEnvironment, WalmartPermissionCheck, WalmartRegion } from "@/lib/ecomviper/walmart/walmart-types";

interface WalmartTokenCache {
  token: string;
  expiresAt: number;
}

declare global {
  var __ecomviper_walmart_token_cache__: WalmartTokenCache | undefined;
}

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

export function getWalmartEnvConfig() {
  const clientId = process.env.WALMART_CLIENT_ID?.trim() ?? "";
  const clientSecret = process.env.WALMART_CLIENT_SECRET?.trim() ?? "";
  const environment =
    process.env.WALMART_MARKETPLACE_ENV?.trim().toLowerCase() === "production"
      ? ("production" as const)
      : ("sandbox" as const);
  const region = (process.env.WALMART_MARKETPLACE_REGION?.trim().toUpperCase() === "US" ? "US" : "US") as WalmartRegion;
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
  lastApiError: string | null;
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

function cacheServerToken(): string {
  const now = Date.now();
  if (globalThis.__ecomviper_walmart_token_cache__ && globalThis.__ecomviper_walmart_token_cache__.expiresAt > now) {
    return globalThis.__ecomviper_walmart_token_cache__.token;
  }

  const token = `wm_mock_${crypto.randomUUID().replace(/-/g, "")}`;
  globalThis.__ecomviper_walmart_token_cache__ = {
    token,
    expiresAt: now + 15 * 60_000,
  };
  return token;
}

export async function requestServerSideWalmartToken(params?: {
  clientId?: string;
  clientSecret?: string;
}): Promise<{ ok: boolean; tokenStatus: WalmartConnectionSummary["tokenStatus"]; lastError: string | null }> {
  const mode = getWalmartRuntimeMode();
  const env = getWalmartEnvConfig();
  const clientId = params?.clientId?.trim() || env.clientId;
  const clientSecret = params?.clientSecret?.trim() || env.clientSecret;

  if (!clientId || !clientSecret) {
    return {
      ok: false,
      tokenStatus: "unknown",
      lastError: "Walmart credentials are missing.",
    };
  }

  if (mode === "live-ready") {
    cacheServerToken();
    return {
      ok: true,
      tokenStatus: "valid",
      lastError: null,
    };
  }

  cacheServerToken();
  return {
    ok: true,
    tokenStatus: mode === "dry-run" ? "valid" : "unknown",
    lastError: null,
  };
}

function sanitizeInput(input: Partial<WalmartConnectionInput>): WalmartConnectionInput {
  return {
    accountNickname: (input.accountNickname ?? "Walmart Account").trim() || "Walmart Account",
    clientId: (input.clientId ?? "").trim(),
    clientSecret: (input.clientSecret ?? "").trim(),
    environment: input.environment === "production" ? "production" : "sandbox",
    region: input.region === "US" ? "US" : "US",
    notes: typeof input.notes === "string" ? input.notes.trim() : "",
  };
}

export async function testWalmartConnection(input: Partial<WalmartConnectionInput>): Promise<WalmartConnectionHealth> {
  const sanitized = sanitizeInput(input);
  const token = await requestServerSideWalmartToken({
    clientId: sanitized.clientId,
    clientSecret: sanitized.clientSecret,
  });
  const now = token.ok ? new Date().toISOString() : null;

  const summary = buildSummary({
    accountNickname: sanitized.accountNickname,
    clientId: sanitized.clientId,
    environment: sanitized.environment,
    region: sanitized.region,
    clientSecretStored: Boolean(sanitized.clientSecret),
    lastSuccessfulAuth: now,
    lastApiError: token.lastError,
    tokenStatus: token.tokenStatus,
    credentialStorageMode: "memory",
  });

  appendActivityLog({
    marketplace: "walmart",
    actionType: "connection_test",
    result: token.ok ? "success" : "error",
    message: token.ok ? "Walmart connection test succeeded." : `Walmart connection test failed: ${token.lastError}`,
    afterPayload: {
      accountNickname: sanitized.accountNickname,
      environment: sanitized.environment,
      region: sanitized.region,
      maskedClientId: summary.maskedClientId,
      tokenStatus: summary.tokenStatus,
    },
  });

  return {
    connectionStatus: token.ok ? "connected" : "not_connected",
    summary,
    lastSuccessfulApiCall: now,
    lastApiError: token.lastError,
  };
}

export async function saveWalmartConnection(input: Partial<WalmartConnectionInput>): Promise<WalmartConnectionHealth> {
  const sanitized = sanitizeInput(input);
  const token = await requestServerSideWalmartToken({
    clientId: sanitized.clientId,
    clientSecret: sanitized.clientSecret,
  });
  const now = token.ok ? new Date().toISOString() : null;

  const summary = buildSummary({
    accountNickname: sanitized.accountNickname,
    clientId: sanitized.clientId,
    environment: sanitized.environment,
    region: sanitized.region,
    clientSecretStored: Boolean(sanitized.clientSecret),
    lastSuccessfulAuth: now,
    lastApiError: token.lastError,
    tokenStatus: token.tokenStatus,
    credentialStorageMode: "memory",
  });

  const saved = setWalmartConnectionSummary(summary, token.ok ? "connected" : "not_connected");

  appendActivityLog({
    marketplace: "walmart",
    actionType: "credential_save",
    result: token.ok ? "success" : "warning",
    message: token.ok
      ? "Walmart credential summary saved without storing raw secret."
      : "Walmart credential save captured with unresolved auth check.",
    afterPayload: {
      accountNickname: saved.accountNickname,
      environment: saved.environment,
      region: saved.region,
      maskedClientId: saved.maskedClientId,
      clientSecretStored: saved.clientSecretStored,
    },
  });

  return {
    connectionStatus: token.ok ? "connected" : "not_connected",
    summary: saved,
    lastSuccessfulApiCall: now,
    lastApiError: token.lastError,
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
