"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import WalmartPageHeader from "@/app/apps/ecomviper/walmart/_components/page-header";
import StatusBadge from "@/app/apps/ecomviper/walmart/_components/status-badge";
import ConnectionInstructionsDialog, {
  type ConnectionInstructionsProvider,
} from "@/app/apps/ecomviper/walmart/connect/_components/connection-instructions-dialog";
import {
  hostFromUrl,
  type WalmartNetworkConnection,
  type WalmartNetworkConnectionInput,
} from "@/lib/ecomviper/walmart/walmart-network-connections";
import type {
  WalmartApiError,
  WalmartConnectionDiagnostic,
  WalmartConnectionHealth,
  WalmartConnectionSummary,
  WalmartOpenAiConnectionStatus,
  WalmartSerpApiConnectionStatus,
} from "@/lib/ecomviper/walmart/walmart-types";

interface ConnectClientProps {
  initialHealth: WalmartConnectionHealth;
  initialNetworkConnections?: WalmartNetworkConnection[];
}

type ConnectForm = {
  accountNickname: string;
  clientId: string;
  clientSecret: string;
  marketplaceRegion: "US";
  notes: string;
};

type OpenAiForm = {
  apiKey: string;
};

type SerpApiForm = {
  apiKey: string;
};

type ShopifyForm = {
  storeDomain: string;
  clientId: string;
  clientSecret: string;
};

type WordPressConnectionForm = {
  siteName: string;
  siteUrl: string;
  status: "connected" | "needs_attention" | "not_connected";
  credentialLabel: string;
  applicationPassword: string;
  defaultPublishingStatus: "draft" | "pending_review";
  defaultCategory: string;
  defaultAuthor: string;
  primaryNiche: string;
  secondaryNiches: string;
  allowedTopics: string;
  blockedTopics: string;
  preferredContentTypes: string;
  audience: string;
  notesForIBrains: string;
  notes: string;
};

type ShopifyStatus = {
  connected: boolean;
  status: "connected" | "disconnected";
  storeDomain: string;
  apiVersion: string;
  authMode: "dev_dashboard_client_credentials" | "legacy_admin_token";
  maskedClientId: string;
  clientSecretStored: boolean;
  tokenStatus: "valid" | "refresh_required" | "expired" | "missing_scope" | "invalid" | "unknown";
  lastTokenRefreshAt: string | null;
  tokenExpiresAt: string | null;
  grantedScopes: string[];
  lastApiError: {
    code: string;
    message: string;
  } | null;
  updatedAt: string | null;
  saveSupported: boolean;
};

type ConnectApiPayload = {
  ok: boolean;
  status: WalmartConnectionHealth["connectionStatus"];
  environment: WalmartConnectionSummary["environment"];
  marketplaceRegion: WalmartConnectionSummary["region"];
  accountNickname: string;
  maskedClientId: string;
  clientSecretStored: boolean;
  tokenStatus: WalmartConnectionSummary["tokenStatus"];
  safeReadStatus: WalmartConnectionSummary["safeReadStatus"];
  lastSuccessfulAuth: string | null;
  lastSuccessfulRead: string | null;
  lastApiError: WalmartApiError | null;
  permissionChecks: WalmartConnectionSummary["permissionChecks"];
  diagnostic: WalmartConnectionDiagnostic;
  summary: WalmartConnectionSummary;
  connectionStatus: WalmartConnectionHealth["connectionStatus"];
  lastSuccessfulApiCall: string | null;
  message?: string;
};

type WalmartHealthResponse = {
  ok: boolean;
  connectionHealth?: WalmartConnectionHealth;
};

type OpenAiConnectionApiPayload = {
  ok: boolean;
  provider: "openai";
  connected: boolean;
  status: WalmartOpenAiConnectionStatus["status"];
  maskedApiKey: string;
  updatedAt: string | null;
  saveSupported: boolean;
  message?: string;
};

type SerpApiConnectionApiPayload = {
  ok: boolean;
  provider: "serpapi";
  connected: boolean;
  status: WalmartSerpApiConnectionStatus["status"];
  maskedApiKey: string;
  updatedAt: string | null;
  saveSupported: boolean;
  providerStatus?:
    | "connected"
    | "not_connected"
    | "invalid_key"
    | "forbidden"
    | "rate_limited"
    | "bad_request"
    | "network_error"
    | "malformed_response"
    | "provider_error"
    | "unknown_error";
  providerStatusReason?: string | null;
  safeProviderErrorDetail?: string | null;
  statusCode?: number | null;
  usage?: {
    totalSearchesLeft: number | null;
    thisMonthUsage: number | null;
    planSearchesPerMonth: number | null;
  } | null;
  message?: string;
};

type ShopifyImportState = {
  lastImportAt: string | null;
  lastImportStatus: "success" | "failed" | "unknown";
  lastImportMessage: string | null;
  productCount: number;
  imageCount: number;
  updatedAt: string | null;
};

type ShopifyConnectionApiPayload = {
  ok: boolean;
  provider: "shopify";
  connected: boolean;
  status: "connected" | "disconnected";
  storeDomain: string;
  apiVersion: string;
  authMode: "dev_dashboard_client_credentials" | "legacy_admin_token";
  maskedClientId: string;
  clientSecretStored: boolean;
  tokenStatus: "valid" | "refresh_required" | "expired" | "missing_scope" | "invalid" | "unknown";
  lastTokenRefreshAt: string | null;
  tokenExpiresAt: string | null;
  grantedScopes: string[];
  lastApiError: {
    code: string;
    message: string;
  } | null;
  updatedAt: string | null;
  saveSupported: boolean;
  importState: ShopifyImportState;
  requiredScope?: "read_products";
  missingScope?: boolean;
  statusCode?: number | null;
  requestId?: string | null;
  diagnosticEvent?:
    | "shopify_connection_test_success"
    | "shopify_connection_missing_scope"
    | "shopify_connection_token_exchange_failed"
    | "shopify_connection_graphql_failed";
  message?: string;
};

type ShopifyImportApiPayload = {
  ok: boolean;
  provider: "shopify";
  importedCount: number;
  imageCount: number;
  pageCount: number;
  hasNextPage: boolean;
  fetchedNodeCount: number;
  lastImportAt: string;
  importState: ShopifyImportState;
  message?: string;
};

type NetworkConnectionsApiPayload = {
  ok: boolean;
  connections: WalmartNetworkConnection[];
  message?: string;
};

type NetworkConnectionApiPayload = {
  ok: boolean;
  connection: WalmartNetworkConnection;
  message?: string;
};

class ApiRequestError extends Error {
  readonly status: number;
  readonly payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

async function postJson<T>(url: string, payload: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = (await response.json().catch(() => null)) as
    | (T & { error?: { message?: string } })
    | null;
  if (!response.ok || !data) {
    const message =
      data && typeof data === "object" && data.error && typeof data.error.message === "string"
        ? data.error.message
        : "Request failed";
    throw new ApiRequestError(message, response.status, data);
  }
  return data as T;
}

async function deleteJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
  });

  const data = (await response.json().catch(() => null)) as
    | (T & { error?: { message?: string } })
    | null;
  if (!response.ok || !data) {
    const message =
      data && typeof data === "object" && data.error && typeof data.error.message === "string"
        ? data.error.message
        : "Request failed";
    throw new ApiRequestError(message, response.status, data);
  }
  return data as T;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asNullableString(value: unknown): string | null {
  const normalized = asString(value);
  return normalized || null;
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => asString(entry))
    .filter((entry) => entry.length > 0);
}

function splitCsv(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function joinList(values: string[] | undefined): string {
  if (!Array.isArray(values) || values.length === 0) return "";
  return values.join(", ");
}

function toHealth(response: ConnectApiPayload): WalmartConnectionHealth {
  return {
    connectionStatus: response.connectionStatus,
    summary: {
      ...response.summary,
      environment: response.environment,
      region: response.marketplaceRegion,
      accountNickname: response.accountNickname,
      maskedClientId: response.maskedClientId,
      clientSecretStored: response.clientSecretStored,
      tokenStatus: response.tokenStatus,
      safeReadStatus: response.safeReadStatus,
      lastSuccessfulAuth: response.lastSuccessfulAuth,
      lastSuccessfulRead: response.lastSuccessfulRead,
      lastApiError: response.lastApiError,
      permissionChecks: response.permissionChecks,
      diagnostic: response.diagnostic,
    },
    lastSuccessfulApiCall: response.lastSuccessfulApiCall,
    lastApiError: response.lastApiError,
  };
}

function toOpenAiStatus(
  response: Partial<OpenAiConnectionApiPayload> | null | undefined
): WalmartOpenAiConnectionStatus {
  return {
    connected: asBoolean(response?.connected),
    status: response?.status === "connected" ? "connected" : "disconnected",
    maskedApiKey: asString(response?.maskedApiKey) || "Not configured",
    updatedAt: asNullableString(response?.updatedAt),
    saveSupported: asBoolean(response?.saveSupported, true),
  };
}

function toSerpApiStatus(
  response: Partial<SerpApiConnectionApiPayload> | null | undefined
): WalmartSerpApiConnectionStatus {
  return {
    connected: asBoolean(response?.connected),
    status: response?.status === "connected" ? "connected" : "disconnected",
    maskedApiKey: asString(response?.maskedApiKey) || "Not configured",
    updatedAt: asNullableString(response?.updatedAt),
    saveSupported: asBoolean(response?.saveSupported, true),
  };
}

function normalizeShopifyTokenStatus(
  value: unknown
): ShopifyStatus["tokenStatus"] {
  if (
    value === "valid" ||
    value === "refresh_required" ||
    value === "expired" ||
    value === "missing_scope" ||
    value === "invalid" ||
    value === "unknown"
  ) {
    return value;
  }
  return "unknown";
}

function normalizeShopifyAuthMode(value: unknown): ShopifyStatus["authMode"] {
  if (value === "legacy_admin_token") return "legacy_admin_token";
  return "dev_dashboard_client_credentials";
}

function normalizeShopifyImportState(
  value: unknown
): ShopifyImportState {
  const record = asRecord(value);
  const rawStatus = asString(record?.lastImportStatus);
  const status: ShopifyImportState["lastImportStatus"] =
    rawStatus === "success" || rawStatus === "failed" || rawStatus === "unknown"
      ? rawStatus
      : "unknown";

  const productCountRaw =
    typeof record?.productCount === "number"
      ? record.productCount
      : Number(record?.productCount);
  const imageCountRaw =
    typeof record?.imageCount === "number"
      ? record.imageCount
      : Number(record?.imageCount);

  return {
    lastImportAt: asNullableString(record?.lastImportAt),
    lastImportStatus: status,
    lastImportMessage: asNullableString(record?.lastImportMessage),
    productCount: Number.isFinite(productCountRaw) ? Math.max(0, Math.trunc(productCountRaw)) : 0,
    imageCount: Number.isFinite(imageCountRaw) ? Math.max(0, Math.trunc(imageCountRaw)) : 0,
    updatedAt: asNullableString(record?.updatedAt),
  };
}

function toShopifyStatus(
  response: Partial<ShopifyConnectionApiPayload> | null | undefined
): ShopifyStatus {
  const errorRecord = asRecord(response?.lastApiError);
  return {
    connected: asBoolean(response?.connected),
    status: response?.status === "connected" ? "connected" : "disconnected",
    storeDomain: asString(response?.storeDomain),
    apiVersion: asString(response?.apiVersion) || "2025-10",
    authMode: normalizeShopifyAuthMode(response?.authMode),
    maskedClientId: asString(response?.maskedClientId) || "Not configured",
    clientSecretStored: asBoolean(response?.clientSecretStored),
    tokenStatus: normalizeShopifyTokenStatus(response?.tokenStatus),
    lastTokenRefreshAt: asNullableString(response?.lastTokenRefreshAt),
    tokenExpiresAt: asNullableString(response?.tokenExpiresAt),
    grantedScopes: asStringArray(response?.grantedScopes),
    lastApiError:
      errorRecord && asString(errorRecord.code) && asString(errorRecord.message)
        ? {
            code: asString(errorRecord.code),
            message: asString(errorRecord.message),
          }
        : null,
    updatedAt: asNullableString(response?.updatedAt),
    saveSupported: asBoolean(response?.saveSupported, true),
  };
}

function normalizePermissionChecks(
  value: unknown
): WalmartConnectionHealth["summary"]["permissionChecks"] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => asRecord(entry))
    .filter((entry): entry is Record<string, unknown> => entry !== null)
    .map((entry) => {
      const id = asString(entry.id) as WalmartConnectionHealth["summary"]["permissionChecks"][number]["id"];
      const label = asString(entry.label);
      const state = asString(entry.state);
      const normalizedState =
        state === "granted" || state === "missing" || state === "unknown"
          ? state
          : "unknown";

      return {
        id: id || "catalog_read",
        label: label || "Permission check",
        state: normalizedState,
      };
    });
}

function normalizeConnectionHealth(
  value: unknown,
  fallback: WalmartConnectionHealth
): WalmartConnectionHealth {
  const record = asRecord(value);
  const summary = asRecord(record?.summary);
  const diagnostic = asRecord(summary?.diagnostic);
  const status = asString(record?.connectionStatus);
  const tokenStatus = asString(summary?.tokenStatus);
  const safeReadStatus = asString(summary?.safeReadStatus);
  const environment = asString(summary?.environment);
  const region = asString(summary?.region);
  const mode = asString(summary?.mode);
  const credentialStorageMode = asString(summary?.credentialStorageMode);
  const summaryHasPermissionChecks = Array.isArray(summary?.permissionChecks);
  const normalizedPermissionChecks = normalizePermissionChecks(summary?.permissionChecks);

  return {
    connectionStatus:
      status === "connected" ||
      status === "token_valid" ||
      status === "token_valid_read_not_configured" ||
      status === "failed" ||
      status === "not_connected"
        ? status
        : fallback.connectionStatus,
    summary: {
      accountNickname: asString(summary?.accountNickname) || fallback.summary.accountNickname,
      environment: environment === "production" ? "production" : fallback.summary.environment,
      region: region === "US" ? "US" : fallback.summary.region,
      maskedClientId: asString(summary?.maskedClientId) || fallback.summary.maskedClientId,
      clientSecretStored:
        typeof summary?.clientSecretStored === "boolean"
          ? summary.clientSecretStored
          : fallback.summary.clientSecretStored,
      lastSuccessfulAuth:
        asNullableString(summary?.lastSuccessfulAuth) ?? fallback.summary.lastSuccessfulAuth,
      lastSuccessfulRead:
        asNullableString(summary?.lastSuccessfulRead) ?? fallback.summary.lastSuccessfulRead,
      lastApiError:
        asRecord(summary?.lastApiError) &&
        asString(asRecord(summary?.lastApiError)?.code) &&
        asString(asRecord(summary?.lastApiError)?.message)
          ? {
              code: asString(asRecord(summary?.lastApiError)?.code),
              message: asString(asRecord(summary?.lastApiError)?.message),
            }
          : fallback.summary.lastApiError,
      tokenStatus:
        tokenStatus === "valid" ||
        tokenStatus === "invalid" ||
        tokenStatus === "expired" ||
        tokenStatus === "unknown"
          ? tokenStatus
          : fallback.summary.tokenStatus,
      safeReadStatus:
        safeReadStatus === "valid" ||
        safeReadStatus === "invalid" ||
        safeReadStatus === "not_configured" ||
        safeReadStatus === "unknown"
          ? safeReadStatus
          : fallback.summary.safeReadStatus,
      permissionChecks:
        summaryHasPermissionChecks
          ? normalizedPermissionChecks
          : fallback.summary.permissionChecks,
      credentialStorageMode:
        credentialStorageMode === "env" ||
        credentialStorageMode === "memory" ||
        credentialStorageMode === "encrypted-db"
          ? credentialStorageMode
          : fallback.summary.credentialStorageMode,
      mode:
        mode === "mock" || mode === "dry-run" || mode === "live-ready"
          ? mode
          : fallback.summary.mode,
      diagnostic: {
        environment:
          asString(diagnostic?.environment) === "production"
            ? "production"
            : fallback.summary.diagnostic.environment,
        baseUrl: asString(diagnostic?.baseUrl) || fallback.summary.diagnostic.baseUrl,
        tokenStatus:
          asString(diagnostic?.tokenStatus) === "valid" ||
          asString(diagnostic?.tokenStatus) === "invalid" ||
          asString(diagnostic?.tokenStatus) === "expired" ||
          asString(diagnostic?.tokenStatus) === "unknown"
            ? (asString(diagnostic?.tokenStatus) as WalmartConnectionHealth["summary"]["diagnostic"]["tokenStatus"])
            : fallback.summary.diagnostic.tokenStatus,
        safeReadStatus:
          asString(diagnostic?.safeReadStatus) === "valid" ||
          asString(diagnostic?.safeReadStatus) === "invalid" ||
          asString(diagnostic?.safeReadStatus) === "not_configured" ||
          asString(diagnostic?.safeReadStatus) === "unknown"
            ? (asString(diagnostic?.safeReadStatus) as WalmartConnectionHealth["summary"]["diagnostic"]["safeReadStatus"])
            : fallback.summary.diagnostic.safeReadStatus,
        httpStatus:
          typeof diagnostic?.httpStatus === "number" && Number.isFinite(diagnostic.httpStatus)
            ? diagnostic.httpStatus
            : fallback.summary.diagnostic.httpStatus,
        correlationId:
          asNullableString(diagnostic?.correlationId) ?? fallback.summary.diagnostic.correlationId,
        walmartErrorCode:
          asNullableString(diagnostic?.walmartErrorCode) ??
          fallback.summary.diagnostic.walmartErrorCode,
        walmartErrorMessage:
          asNullableString(diagnostic?.walmartErrorMessage) ??
          fallback.summary.diagnostic.walmartErrorMessage,
        timestamp:
          asNullableString(diagnostic?.timestamp) ?? fallback.summary.diagnostic.timestamp,
      },
    },
    lastSuccessfulApiCall:
      asNullableString(record?.lastSuccessfulApiCall) ?? fallback.lastSuccessfulApiCall,
    lastApiError:
      asRecord(record?.lastApiError) &&
      asString(asRecord(record?.lastApiError)?.code) &&
      asString(asRecord(record?.lastApiError)?.message)
        ? {
            code: asString(asRecord(record?.lastApiError)?.code),
            message: asString(asRecord(record?.lastApiError)?.message),
          }
        : fallback.lastApiError,
  };
}

function formatApiError(error: WalmartApiError | null | undefined): string {
  if (!error) return "None";
  return `${error.message} (${error.code})`;
}

function formatShopifyApiError(error: ShopifyStatus["lastApiError"]): string {
  if (!error) return "None";
  return `${error.message} (${error.code})`;
}

function statusLabel(status: WalmartConnectionHealth["connectionStatus"]): string {
  if (status === "connected") return "Connected";
  if (status === "token_valid" || status === "token_valid_read_not_configured") return "Token Valid";
  if (status === "failed") return "Failed";
  return "Not Connected";
}

function buildDiagnosticText(diagnostic: WalmartConnectionDiagnostic): string {
  return JSON.stringify(
    {
      environment: diagnostic.environment,
      baseUrl: diagnostic.baseUrl,
      tokenStatus: diagnostic.tokenStatus,
      safeReadStatus: diagnostic.safeReadStatus,
      httpStatus: diagnostic.httpStatus,
      correlationId: diagnostic.correlationId,
      walmartErrorCode: diagnostic.walmartErrorCode,
      walmartErrorMessage: diagnostic.walmartErrorMessage,
      timestamp: diagnostic.timestamp,
    },
    null,
    2
  );
}

export default function WalmartConnectClient({
  initialHealth,
  initialNetworkConnections = [],
}: ConnectClientProps) {
  const walmartClientIdInputRef = useRef<HTMLInputElement | null>(null);
  const walmartClientSecretInputRef = useRef<HTMLInputElement | null>(null);
  const [form, setForm] = useState<ConnectForm>({
    accountNickname: initialHealth.summary.accountNickname,
    clientId: "",
    clientSecret: "",
    marketplaceRegion: initialHealth.summary.region,
    notes: "",
  });
  const [openAiForm, setOpenAiForm] = useState<OpenAiForm>({ apiKey: "" });
  const [serpApiForm, setSerpApiForm] = useState<SerpApiForm>({ apiKey: "" });
  const [shopifyForm, setShopifyForm] = useState<ShopifyForm>({
    storeDomain: "",
    clientId: "",
    clientSecret: "",
  });
  const [wordpressForm, setWordpressForm] = useState<WordPressConnectionForm>({
    siteName: "",
    siteUrl: "",
    status: "connected",
    credentialLabel: "",
    applicationPassword: "",
    defaultPublishingStatus: "draft",
    defaultCategory: "",
    defaultAuthor: "",
    primaryNiche: "",
    secondaryNiches: "",
    allowedTopics: "",
    blockedTopics: "",
    preferredContentTypes: "",
    audience: "",
    notesForIBrains: "",
    notes: "",
  });
  const [health, setHealth] = useState(initialHealth);
  const [networkConnections, setNetworkConnections] = useState<WalmartNetworkConnection[]>(initialNetworkConnections);
  const [openAiStatus, setOpenAiStatus] = useState<WalmartOpenAiConnectionStatus>({
    connected: false,
    status: "disconnected",
    maskedApiKey: "Not configured",
    updatedAt: null,
    saveSupported: true,
  });
  const [serpApiStatus, setSerpApiStatus] = useState<WalmartSerpApiConnectionStatus>({
    connected: false,
    status: "disconnected",
    maskedApiKey: "Not configured",
    updatedAt: null,
    saveSupported: true,
  });
  const [shopifyStatus, setShopifyStatus] = useState<ShopifyStatus>({
    connected: false,
    status: "disconnected",
    storeDomain: "",
    apiVersion: "2025-10",
    authMode: "dev_dashboard_client_credentials",
    maskedClientId: "Not configured",
    clientSecretStored: false,
    tokenStatus: "unknown",
    lastTokenRefreshAt: null,
    tokenExpiresAt: null,
    grantedScopes: [],
    lastApiError: null,
    updatedAt: null,
    saveSupported: true,
  });
  const [shopifyImportState, setShopifyImportState] = useState<ShopifyImportState>({
    lastImportAt: null,
    lastImportStatus: "unknown",
    lastImportMessage: null,
    productCount: 0,
    imageCount: 0,
    updatedAt: null,
  });
  const [serpApiDiagnostics, setSerpApiDiagnostics] = useState<{
    providerStatus:
      | "connected"
      | "not_connected"
      | "invalid_key"
      | "forbidden"
      | "rate_limited"
      | "bad_request"
      | "network_error"
      | "malformed_response"
      | "provider_error"
      | "unknown_error";
    providerStatusReason: string;
    safeProviderErrorDetail: string | null;
    statusCode: number | null;
    usage: {
      totalSearchesLeft: number | null;
      thisMonthUsage: number | null;
      planSearchesPerMonth: number | null;
    } | null;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [openAiLoading, setOpenAiLoading] = useState(false);
  const [serpApiLoading, setSerpApiLoading] = useState(false);
  const [shopifyLoading, setShopifyLoading] = useState(false);
  const [networkLoading, setNetworkLoading] = useState(false);
  const [shopifyFullSync, setShopifyFullSync] = useState(false);
  const [walmartDraftDirty, setWalmartDraftDirty] = useState(false);
  const [shopifyDraftDirty, setShopifyDraftDirty] = useState(false);
  const [instructionsProvider, setInstructionsProvider] = useState<ConnectionInstructionsProvider | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const canSubmit = useMemo(() => Boolean(form.accountNickname.trim()), [form.accountNickname]);
  const canSaveOpenAi = useMemo(() => Boolean(openAiForm.apiKey.trim()), [openAiForm.apiKey]);
  const canSaveSerpApi = useMemo(() => Boolean(serpApiForm.apiKey.trim()), [serpApiForm.apiKey]);
  const canSaveShopify = useMemo(
    () => Boolean(shopifyForm.storeDomain.trim() && shopifyForm.clientId.trim() && shopifyForm.clientSecret.trim()),
    [shopifyForm.storeDomain, shopifyForm.clientId, shopifyForm.clientSecret]
  );
  const hasUnsavedWalmartChanges = useMemo(() => {
    if (!walmartDraftDirty) return false;
    if (form.clientId.trim() || form.clientSecret.trim() || form.notes.trim()) return true;
    return form.accountNickname.trim() !== health.summary.accountNickname.trim();
  }, [form.accountNickname, form.clientId, form.clientSecret, form.notes, health.summary.accountNickname, walmartDraftDirty]);
  const hasUnsavedShopifyChanges = useMemo(() => {
    if (!shopifyDraftDirty) return false;
    if (shopifyForm.clientSecret.trim()) return true;
    if (shopifyForm.storeDomain.trim() !== (shopifyStatus.storeDomain || "").trim()) return true;
    if (shopifyForm.clientId.trim()) return true;
    return false;
  }, [
    shopifyDraftDirty,
    shopifyForm.clientSecret,
    shopifyForm.storeDomain,
    shopifyForm.clientId,
    shopifyStatus.storeDomain,
  ]);
  const wordpressConnections = useMemo(
    () => networkConnections.filter((connection) => connection.platform === "wordpress"),
    [networkConnections]
  );

  function resolveWalmartFormForSubmit(): ConnectForm {
    const clientIdFromInput = walmartClientIdInputRef.current?.value?.trim() ?? "";
    const clientSecretFromInput = walmartClientSecretInputRef.current?.value ?? "";

    const resolved: ConnectForm = {
      ...form,
      clientId: clientIdFromInput || form.clientId,
      clientSecret: clientSecretFromInput || form.clientSecret,
    };

    if (
      resolved.clientId !== form.clientId ||
      resolved.clientSecret !== form.clientSecret
    ) {
      setForm((current) => ({
        ...current,
        clientId: resolved.clientId,
        clientSecret: resolved.clientSecret,
      }));
      setWalmartDraftDirty(true);
    }

    return resolved;
  }

  useEffect(() => {
    let cancelled = false;

    async function loadPersistedHealth() {
      try {
        const response = await fetch("/api/ecomviper/walmart/health", { cache: "no-store" });
        if (!response.ok) {
          if (response.status === 401) {
            const payload = (await response.json().catch(() => null)) as
              | { error?: { message?: string } }
              | null;
            setMessage(payload?.error?.message ?? "Please sign in before loading Walmart connection health.");
          }
          return;
        }

        const payload = (await response.json()) as WalmartHealthResponse;
        if (!payload.connectionHealth || cancelled) return;

        const normalizedHealth = normalizeConnectionHealth(payload.connectionHealth, initialHealth);
        setHealth(normalizedHealth);
        setForm((current) => ({
          ...current,
          accountNickname: normalizedHealth.summary.accountNickname || current.accountNickname,
          marketplaceRegion: normalizedHealth.summary.region || current.marketplaceRegion,
        }));
        setWalmartDraftDirty(false);
      } catch {
        // Intentionally silent; form remains usable with initial server snapshot.
      }
    }

    async function loadOpenAiConnection() {
      try {
        const response = await fetch("/api/ecomviper/walmart/connect/openai", { cache: "no-store" });
        if (!response.ok) return;
        const payload = (await response.json().catch(() => null)) as OpenAiConnectionApiPayload | null;
        if (!payload || cancelled) return;
        setOpenAiStatus(toOpenAiStatus(payload));
      } catch {
        // Intentionally silent; operator can still submit credentials manually.
      }
    }

    async function loadSerpApiConnection() {
      try {
        const response = await fetch("/api/ecomviper/walmart/connect/serpapi", { cache: "no-store" });
        if (!response.ok) return;
        const payload = (await response.json().catch(() => null)) as SerpApiConnectionApiPayload | null;
        if (!payload || cancelled) return;
        setSerpApiStatus(toSerpApiStatus(payload));
      } catch {
        // Intentionally silent; operator can still submit credentials manually.
      }
    }

    async function loadShopifyConnection() {
      try {
        const response = await fetch("/api/ecomviper/shopify/connect", { cache: "no-store" });
        if (!response.ok) return;
        const payload = (await response.json().catch(() => null)) as ShopifyConnectionApiPayload | null;
        if (!payload || cancelled) return;
        setShopifyStatus(toShopifyStatus(payload));
        setShopifyImportState(normalizeShopifyImportState(payload.importState));
        setShopifyForm((current) => ({
          ...current,
          storeDomain: asString(payload.storeDomain) || current.storeDomain,
        }));
        setShopifyDraftDirty(false);
      } catch {
        // Intentionally silent; operator can still submit credentials manually.
      }
    }

    async function loadNetworkConnections() {
      try {
        const response = await fetch("/api/ecomviper/walmart/network-connections", { cache: "no-store" });
        if (!response.ok) return;
        const payload = (await response.json().catch(() => null)) as NetworkConnectionsApiPayload | null;
        if (!payload || cancelled) return;
        setNetworkConnections(Array.isArray(payload.connections) ? payload.connections : []);
      } catch {
        // Intentionally silent; operator can still create connections manually.
      }
    }

    void loadPersistedHealth();
    void loadOpenAiConnection();
    void loadSerpApiConnection();
    void loadShopifyConnection();
    void loadNetworkConnections();

    return () => {
      cancelled = true;
    };
  }, [initialHealth]);

  async function handleTest() {
    try {
      setLoading(true);
      const resolvedForm = resolveWalmartFormForSubmit();
      const response = await postJson<ConnectApiPayload>("/api/ecomviper/walmart/connect/test", {
        ...resolvedForm,
        region: resolvedForm.marketplaceRegion,
      });

      setHealth((current) => normalizeConnectionHealth(toHealth(response), current));
      setMessage(response.message ?? response.lastApiError?.message ?? "Connection test completed.");
    } catch (error) {
      if (error instanceof ApiRequestError) {
        setMessage(error.message);
      } else {
        setMessage("Production token request failed: network error.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(action: "save" | "rotate" | "disconnect" | "permissions") {
    try {
      setLoading(true);
      const resolvedForm = resolveWalmartFormForSubmit();
      const response = await postJson<
        ConnectApiPayload & {
          action?: "save" | "rotate" | "disconnect" | "permissions";
        }
      >("/api/ecomviper/walmart/connect/save", {
        ...resolvedForm,
        region: resolvedForm.marketplaceRegion,
        action,
      });

      setHealth((current) => normalizeConnectionHealth(toHealth(response), current));

      if (action === "disconnect") {
        setForm((current) => ({ ...current, clientId: "", clientSecret: "", notes: "" }));
      } else if (action !== "permissions") {
        setForm((current) => ({ ...current, clientSecret: "" }));
      }
      if (action !== "permissions") {
        setWalmartDraftDirty(false);
      }

      setMessage(
        response.message ??
          (action === "save"
            ? "Credentials saved securely."
            : action === "rotate"
              ? "Credential rotation request stored safely."
              : action === "disconnect"
                ? "Walmart disconnected."
                : "Permissions refreshed.")
      );
    } catch (error) {
      if (error instanceof ApiRequestError) {
        setMessage(error.message);
      } else {
        setMessage("Action failed. Please retry.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleOpenAiTest() {
    try {
      setOpenAiLoading(true);
      const response = await postJson<OpenAiConnectionApiPayload>(
        "/api/ecomviper/walmart/connect/openai/test",
        {
          apiKey: openAiForm.apiKey,
        }
      );
      setOpenAiStatus(toOpenAiStatus(response));
      setMessage(response.message ?? "OpenAI API test completed.");
    } catch (error) {
      if (error instanceof ApiRequestError) {
        setMessage(error.message);
      } else {
        setMessage("OpenAI API test failed.");
      }
    } finally {
      setOpenAiLoading(false);
    }
  }

  async function handleOpenAiSave() {
    try {
      setOpenAiLoading(true);
      const response = await postJson<OpenAiConnectionApiPayload>(
        "/api/ecomviper/walmart/connect/openai",
        {
          apiKey: openAiForm.apiKey,
        }
      );
      setOpenAiStatus(toOpenAiStatus(response));
      setOpenAiForm({ apiKey: "" });
      setMessage(response.message ?? "OpenAI API key saved securely.");
    } catch (error) {
      if (error instanceof ApiRequestError) {
        setMessage(error.message);
      } else {
        setMessage("Failed to save OpenAI API key.");
      }
    } finally {
      setOpenAiLoading(false);
    }
  }

  async function handleOpenAiDisconnect() {
    try {
      setOpenAiLoading(true);
      const response = await deleteJson<OpenAiConnectionApiPayload>(
        "/api/ecomviper/walmart/connect/openai"
      );
      setOpenAiStatus(toOpenAiStatus(response));
      setOpenAiForm({ apiKey: "" });
      setMessage(response.message ?? "OpenAI API disconnected.");
    } catch (error) {
      if (error instanceof ApiRequestError) {
        setMessage(error.message);
      } else {
        setMessage("Failed to disconnect OpenAI API key.");
      }
    } finally {
      setOpenAiLoading(false);
    }
  }

  async function handleSerpApiTest() {
    try {
      setSerpApiLoading(true);
      const response = await postJson<SerpApiConnectionApiPayload>(
        "/api/ecomviper/walmart/connect/serpapi/test",
        {
          apiKey: serpApiForm.apiKey,
        }
      );
      setSerpApiStatus(toSerpApiStatus(response));
      setSerpApiDiagnostics({
        providerStatus: response.providerStatus ?? (response.connected ? "connected" : "not_connected"),
        providerStatusReason: response.providerStatusReason ?? (response.connected ? "Connected to SerpApi." : "SerpApi key missing."),
        safeProviderErrorDetail: response.safeProviderErrorDetail ?? null,
        statusCode: response.statusCode ?? null,
        usage: response.usage ?? null,
      });
      setMessage(response.message ?? "SerpApi test completed.");
    } catch (error) {
      if (error instanceof ApiRequestError) {
        setMessage(error.message);
      } else {
        setMessage("SerpApi test failed.");
      }
    } finally {
      setSerpApiLoading(false);
    }
  }

  async function handleSerpApiSave() {
    try {
      setSerpApiLoading(true);
      const response = await postJson<SerpApiConnectionApiPayload>(
        "/api/ecomviper/walmart/connect/serpapi",
        {
          apiKey: serpApiForm.apiKey,
        }
      );
      setSerpApiStatus(toSerpApiStatus(response));
      setSerpApiDiagnostics(null);
      setSerpApiForm({ apiKey: "" });
      setMessage(response.message ?? "SerpApi key saved securely.");
    } catch (error) {
      if (error instanceof ApiRequestError) {
        setMessage(error.message);
      } else {
        setMessage("Failed to save SerpApi key.");
      }
    } finally {
      setSerpApiLoading(false);
    }
  }

  async function handleSerpApiDisconnect() {
    try {
      setSerpApiLoading(true);
      const response = await deleteJson<SerpApiConnectionApiPayload>(
        "/api/ecomviper/walmart/connect/serpapi"
      );
      setSerpApiStatus(toSerpApiStatus(response));
      setSerpApiDiagnostics(null);
      setSerpApiForm({ apiKey: "" });
      setMessage(response.message ?? "SerpApi disconnected.");
    } catch (error) {
      if (error instanceof ApiRequestError) {
        setMessage(error.message);
      } else {
        setMessage("Failed to disconnect SerpApi key.");
      }
    } finally {
      setSerpApiLoading(false);
    }
  }

  async function handleShopifyTest() {
    try {
      setShopifyLoading(true);
      const response = await postJson<ShopifyConnectionApiPayload>(
        "/api/ecomviper/shopify/connect/test",
        {
          storeDomain: shopifyForm.storeDomain,
          clientId: shopifyForm.clientId,
          clientSecret: shopifyForm.clientSecret,
        }
      );
      setShopifyStatus(toShopifyStatus(response));
      setShopifyImportState(normalizeShopifyImportState(response.importState));
      setMessage(response.message ?? "Shopify connection test completed.");
    } catch (error) {
      if (error instanceof ApiRequestError) {
        setMessage(error.message);
      } else {
        setMessage("Shopify connection test failed.");
      }
    } finally {
      setShopifyLoading(false);
    }
  }

  async function handleShopifySave() {
    try {
      setShopifyLoading(true);
      const response = await postJson<ShopifyConnectionApiPayload>(
        "/api/ecomviper/shopify/connect",
        {
          storeDomain: shopifyForm.storeDomain,
          clientId: shopifyForm.clientId,
          clientSecret: shopifyForm.clientSecret,
        }
      );
      setShopifyStatus(toShopifyStatus(response));
      setShopifyImportState(normalizeShopifyImportState(response.importState));
      setShopifyForm((current) => ({ ...current, clientSecret: "" }));
      setShopifyDraftDirty(false);
      setMessage(response.message ?? "Shopify connection saved securely.");
    } catch (error) {
      if (error instanceof ApiRequestError) {
        setMessage(error.message);
      } else {
        setMessage("Failed to save Shopify credentials.");
      }
    } finally {
      setShopifyLoading(false);
    }
  }

  async function handleShopifyDisconnect() {
    try {
      setShopifyLoading(true);
      const response = await deleteJson<ShopifyConnectionApiPayload>(
        "/api/ecomviper/shopify/connect"
      );
      setShopifyStatus(toShopifyStatus(response));
      setShopifyImportState(normalizeShopifyImportState(response.importState));
      setShopifyForm((current) => ({ ...current, clientSecret: "" }));
      setShopifyDraftDirty(false);
      setMessage(response.message ?? "Shopify disconnected.");
    } catch (error) {
      if (error instanceof ApiRequestError) {
        setMessage(error.message);
      } else {
        setMessage("Failed to disconnect Shopify.");
      }
    } finally {
      setShopifyLoading(false);
    }
  }

  async function handleShopifyImport() {
    try {
      setShopifyLoading(true);
      const response = await postJson<ShopifyImportApiPayload>(
        "/api/ecomviper/shopify/import",
        {
          boundedRuntime: !shopifyFullSync,
        }
      );
      setShopifyImportState(normalizeShopifyImportState(response.importState));
      setMessage(
        response.message ??
          `Imported ${response.importedCount} Shopify products (${shopifyFullSync ? "full sync" : "quick sync"}).`
      );
    } catch (error) {
      if (error instanceof ApiRequestError) {
        setMessage(error.message);
      } else {
        setMessage("Failed to import Shopify products.");
      }
    } finally {
      setShopifyLoading(false);
    }
  }

  async function handleAddWordpressConnection() {
    try {
      setNetworkLoading(true);
      const payload: WalmartNetworkConnectionInput = {
        name: wordpressForm.siteName,
        platform: "wordpress",
        url: wordpressForm.siteUrl,
        status: wordpressForm.status,
        credentialLabel: wordpressForm.credentialLabel,
        applicationPassword: wordpressForm.applicationPassword,
        defaultPublishingStatus: wordpressForm.defaultPublishingStatus,
        defaultCategory: wordpressForm.defaultCategory,
        defaultAuthor: wordpressForm.defaultAuthor,
        publishingMode: "draft_only",
        guardrails: {
          primaryNiche: wordpressForm.primaryNiche,
          secondaryNiches: splitCsv(wordpressForm.secondaryNiches),
          allowedTopics: splitCsv(wordpressForm.allowedTopics),
          blockedTopics: splitCsv(wordpressForm.blockedTopics),
          preferredContentTypes: splitCsv(wordpressForm.preferredContentTypes),
          audience: wordpressForm.audience,
          notesForIBrains: wordpressForm.notesForIBrains,
        },
        notes: wordpressForm.notes,
      };

      const response = await postJson<NetworkConnectionApiPayload>(
        "/api/ecomviper/walmart/network-connections",
        payload
      );
      setNetworkConnections((current) =>
        [...current.filter((entry) => entry.id !== response.connection.id), response.connection].sort((left, right) =>
          left.name.localeCompare(right.name)
        )
      );
      setWordpressForm({
        siteName: "",
        siteUrl: "",
        status: "connected",
        credentialLabel: "",
        applicationPassword: "",
        defaultPublishingStatus: "draft",
        defaultCategory: "",
        defaultAuthor: "",
        primaryNiche: "",
        secondaryNiches: "",
        allowedTopics: "",
        blockedTopics: "",
        preferredContentTypes: "",
        audience: "",
        notesForIBrains: "",
        notes: "",
      });
      setMessage(response.message ?? "WordPress network connection saved.");
    } catch (error) {
      if (error instanceof ApiRequestError) {
        setMessage(error.message);
      } else {
        setMessage("Failed to save WordPress network connection.");
      }
    } finally {
      setNetworkLoading(false);
    }
  }

  async function handleRemoveConnection(connectionId: string) {
    try {
      setNetworkLoading(true);
      await deleteJson<{ ok: boolean; message?: string }>(
        `/api/ecomviper/walmart/network-connections?connectionId=${encodeURIComponent(connectionId)}`
      );
      setNetworkConnections((current) => current.filter((entry) => entry.id !== connectionId));
      setMessage("Network connection removed.");
    } catch (error) {
      if (error instanceof ApiRequestError) {
        setMessage(error.message);
      } else {
        setMessage("Failed to remove network connection.");
      }
    } finally {
      setNetworkLoading(false);
    }
  }

  async function copyDiagnostic() {
    try {
      const text = buildDiagnosticText(health.summary.diagnostic);
      await navigator.clipboard.writeText(text);
      setMessage("Diagnostic copied.");
    } catch {
      setMessage("Unable to copy diagnostic in this browser context.");
    }
  }

  return (
    <div className="space-y-4" data-testid="ecomviper-walmart-connect-page">
      <WalmartPageHeader
        title="Network Connections"
        subtitle="Connect Walmart Marketplace and owned publishing properties so iBrains Intelligence can recommend destination-aware drafts."
      />

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <article className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5 shadow-[0_16px_36px_rgba(15,23,42,0.08)]">
          <h2 className="text-lg font-semibold text-[#0F172A]">Walmart Marketplace Credentials</h2>
          <p className="mt-1 text-sm text-[#64748B]">Client secret is accepted for this request only and is never returned in responses.</p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-sm text-[#334155]">
              Account nickname
              <input
                value={form.accountNickname}
                onChange={(event) => {
                  setForm((current) => ({ ...current, accountNickname: event.target.value }));
                  setWalmartDraftDirty(true);
                }}
                className="mt-1 w-full rounded-lg border border-[#D9E4F0] px-3 py-2"
                placeholder="OPA Nutrition Walmart"
              />
            </label>

            <label className="text-sm text-[#334155]">
              Client ID
              <input
                ref={walmartClientIdInputRef}
                value={form.clientId}
                onChange={(event) => {
                  setForm((current) => ({ ...current, clientId: event.target.value }));
                  setWalmartDraftDirty(true);
                }}
                onInput={(event) => {
                  const target = event.target as HTMLInputElement;
                  setForm((current) => ({ ...current, clientId: target.value }));
                  setWalmartDraftDirty(true);
                }}
                className="mt-1 w-full rounded-lg border border-[#D9E4F0] px-3 py-2"
                placeholder="Walmart client id"
              />
            </label>

            <label className="text-sm text-[#334155]">
              Client Secret
              <input
                ref={walmartClientSecretInputRef}
                type="password"
                value={form.clientSecret}
                onChange={(event) => {
                  setForm((current) => ({ ...current, clientSecret: event.target.value }));
                  setWalmartDraftDirty(true);
                }}
                onInput={(event) => {
                  const target = event.target as HTMLInputElement;
                  setForm((current) => ({ ...current, clientSecret: target.value }));
                  setWalmartDraftDirty(true);
                }}
                className="mt-1 w-full rounded-lg border border-[#D9E4F0] px-3 py-2"
                placeholder="Leave blank to keep stored secret"
              />
            </label>

            <label className="text-sm text-[#334155]">
              Environment
              <input value="Production" readOnly className="mt-1 w-full rounded-lg border border-[#D9E4F0] bg-[#F8FBFF] px-3 py-2" />
            </label>

            <label className="text-sm text-[#334155]">
              Marketplace region
              <select
                value={form.marketplaceRegion}
                onChange={() => {
                  setForm((current) => ({ ...current, marketplaceRegion: "US" }));
                  setWalmartDraftDirty(true);
                }}
                className="mt-1 w-full rounded-lg border border-[#D9E4F0] px-3 py-2"
              >
                <option value="US">US</option>
              </select>
            </label>

            <label className="text-sm text-[#334155] sm:col-span-2">
              Optional notes / label
              <textarea
                value={form.notes}
                onChange={(event) => {
                  setForm((current) => ({ ...current, notes: event.target.value }));
                  setWalmartDraftDirty(true);
                }}
                className="mt-1 min-h-24 w-full rounded-lg border border-[#D9E4F0] px-3 py-2"
                placeholder="Optional operator notes"
              />
            </label>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleTest}
              disabled={loading || !canSubmit}
              className="rounded-lg border border-[#2563EB] bg-[#2563EB] px-3 py-2 text-sm text-white disabled:opacity-50"
            >
              Test Connection
            </button>
            <button
              type="button"
              onClick={() => handleSave("save")}
              disabled={loading || !canSubmit}
              className="rounded-lg border border-[#0F172A] bg-[#0F172A] px-3 py-2 text-sm text-white disabled:opacity-50"
            >
              Save Credentials
            </button>
            <button
              type="button"
              onClick={() => handleSave("rotate")}
              disabled={loading || !canSubmit}
              className="rounded-lg border border-[#D9E4F0] bg-white px-3 py-2 text-sm text-[#0F172A] disabled:opacity-50"
            >
              Rotate Credentials
            </button>
            <button
              type="button"
              onClick={() => handleSave("disconnect")}
              disabled={loading}
              className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 disabled:opacity-50"
            >
              Disconnect Walmart
            </button>
            <button
              type="button"
              onClick={() => handleSave("permissions")}
              disabled={loading}
              className="rounded-lg border border-[#D9E4F0] bg-white px-3 py-2 text-sm text-[#0F172A] disabled:opacity-50"
            >
              View API Permissions
            </button>
            <button
              type="button"
              onClick={copyDiagnostic}
              disabled={loading}
              className="rounded-lg border border-[#D9E4F0] bg-white px-3 py-2 text-sm text-[#0F172A] disabled:opacity-50"
            >
              Copy Diagnostic
            </button>
            <button
              type="button"
              onClick={() => setInstructionsProvider("walmart")}
              className="rounded-lg border border-[#D9E4F0] bg-white px-3 py-2 text-sm text-[#0F172A]"
            >
              Instructions
            </button>
          </div>

          {hasUnsavedWalmartChanges ? (
            <p className="mt-3 text-xs text-amber-700">
              You have unsaved Walmart credential changes. The status panel shows only the last saved connection state.
            </p>
          ) : null}
          {message ? <p className="mt-3 text-sm text-[#334155]">{message}</p> : null}
        </article>

        <article className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5 shadow-[0_16px_36px_rgba(15,23,42,0.08)]">
          <h2 className="text-lg font-semibold text-[#0F172A]">Connection Status</h2>
          <div className="mt-3"><StatusBadge status={statusLabel(health.connectionStatus)} /></div>
          <dl className="mt-3 space-y-2 text-sm text-[#334155]">
            <div className="flex items-start justify-between gap-3">
              <dt>Environment</dt>
              <dd className="font-medium">Production</dd>
            </div>
            <div className="flex items-start justify-between gap-3">
              <dt>Marketplace region</dt>
              <dd className="font-medium">{health.summary.region}</dd>
            </div>
            <div className="flex items-start justify-between gap-3">
              <dt>Account nickname</dt>
              <dd className="font-medium">{health.summary.accountNickname}</dd>
            </div>
            <div className="flex items-start justify-between gap-3">
              <dt>Client ID</dt>
              <dd className="font-medium">{health.summary.maskedClientId}</dd>
            </div>
            <div className="flex items-start justify-between gap-3">
              <dt>Client Secret</dt>
              <dd className="font-medium">{health.summary.clientSecretStored ? "Stored" : "Not stored"}</dd>
            </div>
            <div className="flex items-start justify-between gap-3">
              <dt>Token status</dt>
              <dd className="font-medium">{health.summary.tokenStatus}</dd>
            </div>
            <div className="flex items-start justify-between gap-3">
              <dt>Safe read status</dt>
              <dd className="font-medium">{health.summary.safeReadStatus}</dd>
            </div>
            <div className="flex items-start justify-between gap-3">
              <dt>Last successful auth</dt>
              <dd className="font-medium">{health.summary.lastSuccessfulAuth ?? "Never"}</dd>
            </div>
            <div className="flex items-start justify-between gap-3">
              <dt>Last successful read</dt>
              <dd className="font-medium">{health.summary.lastSuccessfulRead ?? "Never"}</dd>
            </div>
            <div className="flex items-start justify-between gap-3">
              <dt>Last API error</dt>
              <dd className="font-medium">{formatApiError(health.summary.lastApiError)}</dd>
            </div>
          </dl>

          <h3 className="mt-5 text-sm font-semibold uppercase tracking-[0.12em] text-[#64748B]">Permission checklist</h3>
          <ul className="mt-2 space-y-2">
            {health.summary.permissionChecks.map((permission) => (
              <li key={permission.id} className="flex items-center justify-between gap-3 rounded-lg border border-[#E2E8F0] bg-[#F8FBFF] px-3 py-2 text-sm">
                <span className="text-[#334155]">{permission.label}</span>
                <StatusBadge status={permission.state} />
              </li>
            ))}
          </ul>
        </article>
      </section>

      <section
        className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]"
        data-testid="ecomviper-walmart-network-connections-panel"
      >
        <article className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5 shadow-[0_16px_36px_rgba(15,23,42,0.08)]">
          <h2 className="text-lg font-semibold text-[#0F172A]">Owned Publishing Properties (WordPress)</h2>
          <p className="mt-1 text-sm text-[#64748B]">
            Add connected WordPress properties with topical guardrails so iBrains can recommend the best destinations.
          </p>
          <p className="mt-1 text-sm text-[#64748B]">
            iBrains Intelligence creates drafts and recommendations. You approve before anything is published externally.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-sm text-[#334155]">
              Site name
              <input
                value={wordpressForm.siteName}
                onChange={(event) => setWordpressForm((current) => ({ ...current, siteName: event.target.value }))}
                className="mt-1 w-full rounded-lg border border-[#D9E4F0] px-3 py-2"
                placeholder="consumersun.com"
              />
            </label>
            <label className="text-sm text-[#334155]">
              Site URL
              <input
                value={wordpressForm.siteUrl}
                onChange={(event) => setWordpressForm((current) => ({ ...current, siteUrl: event.target.value }))}
                className="mt-1 w-full rounded-lg border border-[#D9E4F0] px-3 py-2"
                placeholder="https://consumersun.com"
              />
            </label>
            <label className="text-sm text-[#334155]">
              Platform
              <input
                value="WordPress"
                readOnly
                className="mt-1 w-full rounded-lg border border-[#D9E4F0] bg-[#F8FBFF] px-3 py-2"
              />
            </label>
            <label className="text-sm text-[#334155]">
              Connection status
              <select
                value={wordpressForm.status}
                onChange={(event) =>
                  setWordpressForm((current) => ({
                    ...current,
                    status: event.target.value as WordPressConnectionForm["status"],
                  }))
                }
                className="mt-1 w-full rounded-lg border border-[#D9E4F0] px-3 py-2"
              >
                <option value="connected">Connected</option>
                <option value="needs_attention">Needs attention</option>
                <option value="not_connected">Not connected</option>
              </select>
            </label>
            <label className="text-sm text-[#334155]">
              Username / credential label
              <input
                value={wordpressForm.credentialLabel}
                onChange={(event) =>
                  setWordpressForm((current) => ({ ...current, credentialLabel: event.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-[#D9E4F0] px-3 py-2"
                placeholder="content-bot"
              />
            </label>
            <label className="text-sm text-[#334155]">
              Application password / API credential
              <input
                type="password"
                value={wordpressForm.applicationPassword}
                onChange={(event) =>
                  setWordpressForm((current) => ({ ...current, applicationPassword: event.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-[#D9E4F0] px-3 py-2"
                placeholder="Accepted for save only"
              />
            </label>
            <label className="text-sm text-[#334155]">
              Default publishing status
              <select
                value={wordpressForm.defaultPublishingStatus}
                onChange={(event) =>
                  setWordpressForm((current) => ({
                    ...current,
                    defaultPublishingStatus: event.target.value as WordPressConnectionForm["defaultPublishingStatus"],
                  }))
                }
                className="mt-1 w-full rounded-lg border border-[#D9E4F0] px-3 py-2"
              >
                <option value="draft">Draft</option>
                <option value="pending_review">Pending review</option>
              </select>
            </label>
            <label className="text-sm text-[#334155]">
              Default category
              <input
                value={wordpressForm.defaultCategory}
                onChange={(event) =>
                  setWordpressForm((current) => ({ ...current, defaultCategory: event.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-[#D9E4F0] px-3 py-2"
                placeholder="Buying Guides"
              />
            </label>
            <label className="text-sm text-[#334155]">
              Default author
              <input
                value={wordpressForm.defaultAuthor}
                onChange={(event) =>
                  setWordpressForm((current) => ({ ...current, defaultAuthor: event.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-[#D9E4F0] px-3 py-2"
                placeholder="IBrains Editorial"
              />
            </label>
            <label className="text-sm text-[#334155]">
              Primary niche
              <input
                value={wordpressForm.primaryNiche}
                onChange={(event) =>
                  setWordpressForm((current) => ({ ...current, primaryNiche: event.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-[#D9E4F0] px-3 py-2"
                placeholder="Product reviews"
              />
            </label>
            <label className="text-sm text-[#334155]">
              Secondary niches
              <input
                value={wordpressForm.secondaryNiches}
                onChange={(event) =>
                  setWordpressForm((current) => ({ ...current, secondaryNiches: event.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-[#D9E4F0] px-3 py-2"
                placeholder="consumer buying guides, supplement reviews"
              />
            </label>
            <label className="text-sm text-[#334155]">
              Allowed topics
              <input
                value={wordpressForm.allowedTopics}
                onChange={(event) =>
                  setWordpressForm((current) => ({ ...current, allowedTopics: event.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-[#D9E4F0] px-3 py-2"
                placeholder="product reviews, comparison articles"
              />
            </label>
            <label className="text-sm text-[#334155]">
              Blocked topics
              <input
                value={wordpressForm.blockedTopics}
                onChange={(event) =>
                  setWordpressForm((current) => ({ ...current, blockedTopics: event.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-[#D9E4F0] px-3 py-2"
                placeholder="pregnancy, children health"
              />
            </label>
            <label className="text-sm text-[#334155] sm:col-span-2">
              Preferred content types
              <input
                value={wordpressForm.preferredContentTypes}
                onChange={(event) =>
                  setWordpressForm((current) => ({ ...current, preferredContentTypes: event.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-[#D9E4F0] px-3 py-2"
                placeholder="product reviews, roundup articles, comparison posts"
              />
            </label>
            <label className="text-sm text-[#334155]">
              Audience
              <input
                value={wordpressForm.audience}
                onChange={(event) => setWordpressForm((current) => ({ ...current, audience: event.target.value }))}
                className="mt-1 w-full rounded-lg border border-[#D9E4F0] px-3 py-2"
                placeholder="General consumers researching products"
              />
            </label>
            <label className="text-sm text-[#334155]">
              Notes for iBrains
              <input
                value={wordpressForm.notesForIBrains}
                onChange={(event) =>
                  setWordpressForm((current) => ({ ...current, notesForIBrains: event.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-[#D9E4F0] px-3 py-2"
                placeholder="Prioritize buyer guide angles."
              />
            </label>
            <label className="text-sm text-[#334155] sm:col-span-2">
              Connection notes
              <textarea
                value={wordpressForm.notes}
                onChange={(event) => setWordpressForm((current) => ({ ...current, notes: event.target.value }))}
                className="mt-1 min-h-20 w-full rounded-lg border border-[#D9E4F0] px-3 py-2"
                placeholder="Optional operational notes"
              />
            </label>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={networkLoading || !wordpressForm.siteName.trim()}
              onClick={handleAddWordpressConnection}
              className="rounded-lg border border-[#0F172A] bg-[#0F172A] px-3 py-2 text-sm text-white disabled:opacity-50"
            >
              Add WordPress connection
            </button>
          </div>
          <p className="mt-2 text-xs text-[#64748B]">
            Credentials are accepted for save requests and never shown back in the UI.
          </p>
        </article>

        <article className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5 shadow-[0_16px_36px_rgba(15,23,42,0.08)]">
          <h2 className="text-lg font-semibold text-[#0F172A]">Connected Properties</h2>
          <ul className="mt-3 space-y-2" data-testid="ecomviper-walmart-network-connection-list">
            <li className="rounded-lg border border-[#E2E8F0] bg-[#F8FBFF] px-3 py-2 text-sm text-[#334155]">
              <p className="font-medium text-[#0F172A]">Walmart Marketplace</p>
              <p className="text-xs text-[#64748B]">Connected via Walmart credentials and permissions.</p>
            </li>
            {wordpressConnections.map((connection) => (
              <li
                key={connection.id}
                className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-2"
                data-testid="ecomviper-network-connection-row"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-[#0F172A]">{hostFromUrl(connection.url) || connection.name}</p>
                    <p className="text-xs text-[#64748B]">WordPress · {connection.status.replace(/_/g, " ")}</p>
                    <p className="mt-1 text-xs text-[#64748B]">
                      Primary niche: {connection.guardrails?.primaryNiche || "Not set"}
                    </p>
                    <p className="mt-1 text-xs text-[#64748B]">
                      Allowed topics: {joinList(connection.guardrails?.allowedTopics) || "Not set"}
                    </p>
                    <p className="mt-1 text-xs text-[#64748B]">
                      Preferred content types: {joinList(connection.guardrails?.preferredContentTypes) || "Not set"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      void handleRemoveConnection(connection.id);
                    }}
                    className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-xs text-rose-700"
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
            {wordpressConnections.length === 0 ? (
              <li className="rounded-lg border border-dashed border-[#D9E4F0] px-3 py-2 text-sm text-[#64748B]">
                No WordPress properties connected yet. Add a property to enable destination-aware recommendations.
              </li>
            ) : null}
          </ul>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <article className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5 shadow-[0_16px_36px_rgba(15,23,42,0.08)]">
          <h2 className="text-lg font-semibold text-[#0F172A]">OpenAI API</h2>
          <p className="mt-1 text-sm text-[#64748B]">
            Bring your own OpenAI API key. EcomViper uses your key to generate Walmart listing content and never returns the raw key.
          </p>

          <div className="mt-4 grid gap-3">
            <label className="text-sm text-[#334155]">
              OpenAI API key
              <input
                type="password"
                value={openAiForm.apiKey}
                onChange={(event) => setOpenAiForm({ apiKey: event.target.value })}
                className="mt-1 w-full rounded-lg border border-[#D9E4F0] px-3 py-2"
                placeholder="sk-..."
              />
            </label>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleOpenAiTest}
              disabled={openAiLoading}
              className="rounded-lg border border-[#2563EB] bg-[#2563EB] px-3 py-2 text-sm text-white disabled:opacity-50"
            >
              Test API Key
            </button>
            <button
              type="button"
              onClick={handleOpenAiSave}
              disabled={openAiLoading || !canSaveOpenAi || !openAiStatus.saveSupported}
              className="rounded-lg border border-[#0F172A] bg-[#0F172A] px-3 py-2 text-sm text-white disabled:opacity-50"
            >
              Save OpenAI Key
            </button>
            <button
              type="button"
              onClick={handleOpenAiDisconnect}
              disabled={openAiLoading || !openAiStatus.saveSupported}
              className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 disabled:opacity-50"
            >
              Disconnect OpenAI
            </button>
            <button
              type="button"
              onClick={() => setInstructionsProvider("openai")}
              className="rounded-lg border border-[#D9E4F0] bg-white px-3 py-2 text-sm text-[#0F172A]"
            >
              Instructions
            </button>
          </div>

          {!openAiStatus.saveSupported ? (
            <p className="mt-3 text-sm text-amber-700">
              Walmart OpenAI credential saving is not available in this environment.
            </p>
          ) : null}
        </article>

        <article className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5 shadow-[0_16px_36px_rgba(15,23,42,0.08)]">
          <h2 className="text-lg font-semibold text-[#0F172A]">OpenAI Status</h2>
          <div className="mt-3"><StatusBadge status={openAiStatus.connected ? "Connected" : "Not Connected"} /></div>
          <dl className="mt-3 space-y-2 text-sm text-[#334155]">
            <div className="flex items-start justify-between gap-3">
              <dt>Provider</dt>
              <dd className="font-medium">OpenAI API</dd>
            </div>
            <div className="flex items-start justify-between gap-3">
              <dt>Connection</dt>
              <dd className="font-medium">{openAiStatus.connected ? "Connected" : "Disconnected"}</dd>
            </div>
            <div className="flex items-start justify-between gap-3">
              <dt>API key</dt>
              <dd className="font-medium">{openAiStatus.maskedApiKey}</dd>
            </div>
            <div className="flex items-start justify-between gap-3">
              <dt>Last updated</dt>
              <dd className="font-medium">{openAiStatus.updatedAt ?? "Never"}</dd>
            </div>
          </dl>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <article className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5 shadow-[0_16px_36px_rgba(15,23,42,0.08)]">
          <h2 className="text-lg font-semibold text-[#0F172A]">SerpApi</h2>
          <p className="mt-1 text-sm text-[#64748B]">
            Used to fetch public Walmart.com listing images when Walmart Marketplace APIs do not return images.
          </p>

          <div className="mt-4 grid gap-3">
            <label className="text-sm text-[#334155]">
              SerpApi key
              <input
                type="password"
                value={serpApiForm.apiKey}
                onChange={(event) => setSerpApiForm({ apiKey: event.target.value })}
                className="mt-1 w-full rounded-lg border border-[#D9E4F0] px-3 py-2"
                placeholder="serpapi_..."
              />
            </label>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleSerpApiTest}
              disabled={serpApiLoading}
              className="rounded-lg border border-[#2563EB] bg-[#2563EB] px-3 py-2 text-sm text-white disabled:opacity-50"
            >
              Test API Key
            </button>
            <button
              type="button"
              onClick={handleSerpApiSave}
              disabled={serpApiLoading || !canSaveSerpApi || !serpApiStatus.saveSupported}
              className="rounded-lg border border-[#0F172A] bg-[#0F172A] px-3 py-2 text-sm text-white disabled:opacity-50"
            >
              Save SerpApi Key
            </button>
            <button
              type="button"
              onClick={handleSerpApiDisconnect}
              disabled={serpApiLoading || !serpApiStatus.saveSupported}
              className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 disabled:opacity-50"
            >
              Disconnect SerpApi
            </button>
            <button
              type="button"
              onClick={() => setInstructionsProvider("serpapi")}
              className="rounded-lg border border-[#D9E4F0] bg-white px-3 py-2 text-sm text-[#0F172A]"
            >
              Instructions
            </button>
          </div>

          {!serpApiStatus.saveSupported ? (
            <p className="mt-3 text-sm text-amber-700">
              Walmart SerpApi credential saving is not available in this environment.
            </p>
          ) : null}
        </article>

        <article className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5 shadow-[0_16px_36px_rgba(15,23,42,0.08)]">
          <h2 className="text-lg font-semibold text-[#0F172A]">SerpApi Status</h2>
          <div className="mt-3"><StatusBadge status={serpApiStatus.connected ? "Connected" : "Not Connected"} /></div>
          <dl className="mt-3 space-y-2 text-sm text-[#334155]">
            <div className="flex items-start justify-between gap-3">
              <dt>Provider</dt>
              <dd className="font-medium">SerpApi</dd>
            </div>
            <div className="flex items-start justify-between gap-3">
              <dt>Connection</dt>
              <dd className="font-medium">{serpApiStatus.connected ? "Connected" : "Disconnected"}</dd>
            </div>
            <div className="flex items-start justify-between gap-3">
              <dt>API key</dt>
              <dd className="font-medium">{serpApiStatus.maskedApiKey}</dd>
            </div>
            <div className="flex items-start justify-between gap-3">
              <dt>Last updated</dt>
              <dd className="font-medium">{serpApiStatus.updatedAt ?? "Never"}</dd>
            </div>
            {serpApiDiagnostics ? (
              <>
                <div className="flex items-start justify-between gap-3">
                  <dt>Test status</dt>
                  <dd className="font-medium">{serpApiDiagnostics.providerStatus}</dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt>Test HTTP status</dt>
                  <dd className="font-medium">
                    {serpApiDiagnostics.statusCode === null ? "N/A" : String(serpApiDiagnostics.statusCode)}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt>Test reason</dt>
                  <dd className="font-medium text-right">{serpApiDiagnostics.providerStatusReason}</dd>
                </div>
                {serpApiDiagnostics.safeProviderErrorDetail ? (
                  <div className="flex items-start justify-between gap-3">
                    <dt>Safe detail</dt>
                    <dd className="font-medium text-right">{serpApiDiagnostics.safeProviderErrorDetail}</dd>
                  </div>
                ) : null}
                {serpApiDiagnostics.usage ? (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <dt>Searches left</dt>
                      <dd className="font-medium">
                        {serpApiDiagnostics.usage.totalSearchesLeft === null
                          ? "N/A"
                          : String(serpApiDiagnostics.usage.totalSearchesLeft)}
                      </dd>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <dt>Month usage</dt>
                      <dd className="font-medium">
                        {serpApiDiagnostics.usage.thisMonthUsage === null
                          ? "N/A"
                          : String(serpApiDiagnostics.usage.thisMonthUsage)}
                      </dd>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <dt>Plan/month</dt>
                      <dd className="font-medium">
                        {serpApiDiagnostics.usage.planSearchesPerMonth === null
                          ? "N/A"
                          : String(serpApiDiagnostics.usage.planSearchesPerMonth)}
                      </dd>
                    </div>
                  </>
                ) : null}
              </>
            ) : null}
          </dl>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <article className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5 shadow-[0_16px_36px_rgba(15,23,42,0.08)]">
          <h2 className="text-lg font-semibold text-[#0F172A]">Shopify Source Catalog</h2>
          <p className="mt-1 text-sm text-[#64748B]">
            Connect Shopify as the product/image source of truth for Walmart catalog reconciliation.
          </p>
          <p className="mt-1 text-sm text-[#64748B]">
            Use the Client ID and Secret from your Shopify Dev Dashboard app settings. Do not paste the App automation token.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-sm text-[#334155] sm:col-span-2">
              Shopify store domain
              <input
                value={shopifyForm.storeDomain}
                onChange={(event) => {
                  setShopifyForm((current) => ({ ...current, storeDomain: event.target.value }));
                  setShopifyDraftDirty(true);
                }}
                className="mt-1 w-full rounded-lg border border-[#D9E4F0] px-3 py-2"
                placeholder="opanutrition.myshopify.com"
              />
            </label>

            <label className="text-sm text-[#334155]">
              Client ID
              <input
                value={shopifyForm.clientId}
                onChange={(event) => {
                  setShopifyForm((current) => ({ ...current, clientId: event.target.value }));
                  setShopifyDraftDirty(true);
                }}
                className="mt-1 w-full rounded-lg border border-[#D9E4F0] px-3 py-2"
                placeholder="Shopify client id"
              />
            </label>

            <label className="text-sm text-[#334155]">
              Client Secret
              <input
                type="password"
                value={shopifyForm.clientSecret}
                onChange={(event) => {
                  setShopifyForm((current) => ({ ...current, clientSecret: event.target.value }));
                  setShopifyDraftDirty(true);
                }}
                className="mt-1 w-full rounded-lg border border-[#D9E4F0] px-3 py-2"
                placeholder="Shopify client secret"
              />
            </label>

          </div>

          <label className="mt-3 flex items-center gap-2 text-sm text-[#334155]">
            <input
              type="checkbox"
              checked={shopifyFullSync}
              onChange={(event) => setShopifyFullSync(event.target.checked)}
              disabled={shopifyLoading}
              className="h-4 w-4 rounded border border-[#D9E4F0]"
            />
            Full Shopify sync (unbounded pages, slower)
          </label>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleShopifyTest}
              disabled={shopifyLoading}
              className="rounded-lg border border-[#2563EB] bg-[#2563EB] px-3 py-2 text-sm text-white disabled:opacity-50"
            >
              Test Connection
            </button>
            <button
              type="button"
              onClick={handleShopifySave}
              disabled={shopifyLoading || !canSaveShopify || !shopifyStatus.saveSupported}
              className="rounded-lg border border-[#0F172A] bg-[#0F172A] px-3 py-2 text-sm text-white disabled:opacity-50"
            >
              Save Shopify
            </button>
            <button
              type="button"
              onClick={handleShopifyImport}
              disabled={shopifyLoading || !shopifyStatus.connected}
              className="rounded-lg border border-[#D9E4F0] bg-white px-3 py-2 text-sm text-[#0F172A] disabled:opacity-50"
            >
              Import/Sync Shopify products
            </button>
            <button
              type="button"
              onClick={handleShopifyDisconnect}
              disabled={shopifyLoading || !shopifyStatus.saveSupported}
              className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 disabled:opacity-50"
            >
              Disconnect Shopify
            </button>
            <button
              type="button"
              onClick={() => setInstructionsProvider("shopify")}
              className="rounded-lg border border-[#D9E4F0] bg-white px-3 py-2 text-sm text-[#0F172A]"
            >
              Instructions
            </button>
          </div>

          {!shopifyStatus.saveSupported ? (
            <p className="mt-3 text-sm text-amber-700">
              Shopify credential saving is not available in this environment.
            </p>
          ) : null}
          {hasUnsavedShopifyChanges ? (
            <p className="mt-3 text-xs text-amber-700">
              You have unsaved Shopify credential changes. The status panel shows only the last saved connection state.
            </p>
          ) : null}
        </article>

        <article className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5 shadow-[0_16px_36px_rgba(15,23,42,0.08)]">
          <h2 className="text-lg font-semibold text-[#0F172A]">Shopify Status</h2>
          <div className="mt-3"><StatusBadge status={shopifyStatus.connected ? "Connected" : "Not Connected"} /></div>
          <dl className="mt-3 space-y-2 text-sm text-[#334155]">
            <div className="flex items-start justify-between gap-3">
              <dt>Connection</dt>
              <dd className="font-medium">{shopifyStatus.connected ? "Connected" : "Disconnected"}</dd>
            </div>
            <div className="flex items-start justify-between gap-3">
              <dt>Store domain</dt>
              <dd className="font-medium">{shopifyStatus.storeDomain || "Not configured"}</dd>
            </div>
            <div className="flex items-start justify-between gap-3">
              <dt>API version</dt>
              <dd className="font-medium">{shopifyStatus.apiVersion}</dd>
            </div>
            <div className="flex items-start justify-between gap-3">
              <dt>Auth mode</dt>
              <dd className="font-medium">
                {shopifyStatus.authMode === "dev_dashboard_client_credentials"
                  ? "Dev Dashboard Client Credentials"
                  : "Legacy Admin token"}
              </dd>
            </div>
            <div className="flex items-start justify-between gap-3">
              <dt>Client ID</dt>
              <dd className="font-medium">{shopifyStatus.maskedClientId}</dd>
            </div>
            <div className="flex items-start justify-between gap-3">
              <dt>Client Secret</dt>
              <dd className="font-medium">{shopifyStatus.clientSecretStored ? "Stored" : "Not stored"}</dd>
            </div>
            <div className="flex items-start justify-between gap-3">
              <dt>Token status</dt>
              <dd className="font-medium">{shopifyStatus.tokenStatus}</dd>
            </div>
            <div className="flex items-start justify-between gap-3">
              <dt>Last token refresh</dt>
              <dd className="font-medium">{shopifyStatus.lastTokenRefreshAt ?? "Never"}</dd>
            </div>
            <div className="flex items-start justify-between gap-3">
              <dt>Token expiry</dt>
              <dd className="font-medium">{shopifyStatus.tokenExpiresAt ?? "Unknown"}</dd>
            </div>
            <div className="flex items-start justify-between gap-3">
              <dt>Granted scopes</dt>
              <dd className="font-medium text-right">
                {shopifyStatus.grantedScopes.length > 0
                  ? shopifyStatus.grantedScopes.join(", ")
                  : "Unknown"}
              </dd>
            </div>
            <div className="flex items-start justify-between gap-3">
              <dt>Last API error</dt>
              <dd className="font-medium text-right">{formatShopifyApiError(shopifyStatus.lastApiError)}</dd>
            </div>
            <div className="flex items-start justify-between gap-3">
              <dt>Last updated</dt>
              <dd className="font-medium">{shopifyStatus.updatedAt ?? "Never"}</dd>
            </div>
            <div className="flex items-start justify-between gap-3">
              <dt>Last sync status</dt>
              <dd className="font-medium">{shopifyImportState.lastImportStatus}</dd>
            </div>
            <div className="flex items-start justify-between gap-3">
              <dt>Last sync at</dt>
              <dd className="font-medium">{shopifyImportState.lastImportAt ?? "Never"}</dd>
            </div>
            <div className="flex items-start justify-between gap-3">
              <dt>Product count imported</dt>
              <dd className="font-medium">{shopifyImportState.productCount}</dd>
            </div>
            <div className="flex items-start justify-between gap-3">
              <dt>Image count imported</dt>
              <dd className="font-medium">{shopifyImportState.imageCount}</dd>
            </div>
            {shopifyImportState.lastImportMessage ? (
              <div className="flex items-start justify-between gap-3">
                <dt>Sync note</dt>
                <dd className="font-medium text-right">{shopifyImportState.lastImportMessage}</dd>
              </div>
            ) : null}
          </dl>
        </article>
      </section>

      <ConnectionInstructionsDialog
        provider={instructionsProvider}
        onClose={() => setInstructionsProvider(null)}
      />
    </div>
  );
}
