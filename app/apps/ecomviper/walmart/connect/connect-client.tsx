"use client";

import { useEffect, useMemo, useState } from "react";
import WalmartPageHeader from "@/app/apps/ecomviper/walmart/_components/page-header";
import StatusBadge from "@/app/apps/ecomviper/walmart/_components/status-badge";
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

function toOpenAiStatus(response: OpenAiConnectionApiPayload): WalmartOpenAiConnectionStatus {
  return {
    connected: response.connected,
    status: response.status,
    maskedApiKey: response.maskedApiKey,
    updatedAt: response.updatedAt,
    saveSupported: response.saveSupported,
  };
}

function toSerpApiStatus(
  response: SerpApiConnectionApiPayload
): WalmartSerpApiConnectionStatus {
  return {
    connected: response.connected,
    status: response.status,
    maskedApiKey: response.maskedApiKey,
    updatedAt: response.updatedAt,
    saveSupported: response.saveSupported,
  };
}

function formatApiError(error: WalmartApiError | null | undefined): string {
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

export default function WalmartConnectClient({ initialHealth }: ConnectClientProps) {
  const [form, setForm] = useState<ConnectForm>({
    accountNickname: initialHealth.summary.accountNickname,
    clientId: "",
    clientSecret: "",
    marketplaceRegion: initialHealth.summary.region,
    notes: "",
  });
  const [openAiForm, setOpenAiForm] = useState<OpenAiForm>({ apiKey: "" });
  const [serpApiForm, setSerpApiForm] = useState<SerpApiForm>({ apiKey: "" });
  const [health, setHealth] = useState(initialHealth);
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
  const [message, setMessage] = useState<string | null>(null);

  const canSubmit = useMemo(() => Boolean(form.accountNickname.trim()), [form.accountNickname]);
  const canSaveOpenAi = useMemo(() => Boolean(openAiForm.apiKey.trim()), [openAiForm.apiKey]);
  const canSaveSerpApi = useMemo(() => Boolean(serpApiForm.apiKey.trim()), [serpApiForm.apiKey]);

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

        setHealth(payload.connectionHealth);
        setForm((current) => ({
          ...current,
          accountNickname: payload.connectionHealth?.summary.accountNickname ?? current.accountNickname,
          marketplaceRegion: payload.connectionHealth?.summary.region ?? current.marketplaceRegion,
        }));
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

    void loadPersistedHealth();
    void loadOpenAiConnection();
    void loadSerpApiConnection();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleTest() {
    try {
      setLoading(true);
      const response = await postJson<ConnectApiPayload>("/api/ecomviper/walmart/connect/test", {
        ...form,
        region: form.marketplaceRegion,
      });

      setHealth(toHealth(response));
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
      const response = await postJson<
        ConnectApiPayload & {
          action?: "save" | "rotate" | "disconnect" | "permissions";
        }
      >("/api/ecomviper/walmart/connect/save", {
        ...form,
        region: form.marketplaceRegion,
        action,
      });

      setHealth(toHealth(response));

      if (action !== "permissions") {
        setForm((current) => ({ ...current, clientSecret: "" }));
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
        title="Walmart Connection"
        subtitle="Production connectivity doctor for Walmart Marketplace credentials and API health."
      />

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <article className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5 shadow-[0_16px_36px_rgba(15,23,42,0.08)]">
          <h2 className="text-lg font-semibold text-[#0F172A]">Credentials</h2>
          <p className="mt-1 text-sm text-[#64748B]">Client secret is accepted for this request only and is never returned in responses.</p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-sm text-[#334155]">
              Account nickname
              <input
                value={form.accountNickname}
                onChange={(event) => setForm((current) => ({ ...current, accountNickname: event.target.value }))}
                className="mt-1 w-full rounded-lg border border-[#D9E4F0] px-3 py-2"
                placeholder="OPA Nutrition Walmart"
              />
            </label>

            <label className="text-sm text-[#334155]">
              Client ID
              <input
                value={form.clientId}
                onChange={(event) => setForm((current) => ({ ...current, clientId: event.target.value }))}
                className="mt-1 w-full rounded-lg border border-[#D9E4F0] px-3 py-2"
                placeholder="Walmart client id"
              />
            </label>

            <label className="text-sm text-[#334155]">
              Client Secret
              <input
                type="password"
                value={form.clientSecret}
                onChange={(event) => setForm((current) => ({ ...current, clientSecret: event.target.value }))}
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
                onChange={() => setForm((current) => ({ ...current, marketplaceRegion: "US" }))}
                className="mt-1 w-full rounded-lg border border-[#D9E4F0] px-3 py-2"
              >
                <option value="US">US</option>
              </select>
            </label>

            <label className="text-sm text-[#334155] sm:col-span-2">
              Optional notes / label
              <textarea
                value={form.notes}
                onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
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
          </div>

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
    </div>
  );
}
