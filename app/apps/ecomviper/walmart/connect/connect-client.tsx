"use client";

import { useMemo, useState } from "react";
import WalmartPageHeader from "@/app/apps/ecomviper/walmart/_components/page-header";
import StatusBadge from "@/app/apps/ecomviper/walmart/_components/status-badge";
import type { WalmartConnectionHealth, WalmartConnectionSummary } from "@/lib/ecomviper/walmart/walmart-types";

interface ConnectClientProps {
  initialHealth: WalmartConnectionHealth;
}

type ConnectForm = {
  accountNickname: string;
  clientId: string;
  clientSecret: string;
  environment: "sandbox" | "production";
  region: "US";
  notes: string;
};

async function postJson<T>(url: string, payload: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = (await response.json().catch(() => null)) as T | null;
  if (!response.ok || !data) {
    throw new Error("Request failed");
  }
  return data;
}

export default function WalmartConnectClient({ initialHealth }: ConnectClientProps) {
  const [form, setForm] = useState<ConnectForm>({
    accountNickname: initialHealth.summary.accountNickname,
    clientId: "",
    clientSecret: "",
    environment: initialHealth.summary.environment,
    region: initialHealth.summary.region,
    notes: "",
  });
  const [health, setHealth] = useState(initialHealth);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const canSubmit = useMemo(() => Boolean(form.accountNickname.trim() && form.clientId.trim() && form.clientSecret.trim()), [form]);

  async function handleTest() {
    try {
      setLoading(true);
      const response = await postJson<{
        connectionStatus: WalmartConnectionHealth["connectionStatus"];
        summary: WalmartConnectionSummary;
        lastSuccessfulApiCall: string | null;
        lastApiError: string | null;
      }>("/api/ecomviper/walmart/connect/test", form);

      setHealth({
        connectionStatus: response.connectionStatus,
        summary: response.summary,
        lastSuccessfulApiCall: response.lastSuccessfulApiCall,
        lastApiError: response.lastApiError,
      });
      setMessage("Connection test completed.");
    } catch {
      setMessage("Connection test failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(action: "save" | "rotate" | "disconnect" | "permissions") {
    try {
      setLoading(true);
      const response = await postJson<{
        connectionStatus?: WalmartConnectionHealth["connectionStatus"];
        summary?: WalmartConnectionSummary;
        permissions?: WalmartConnectionSummary["permissionChecks"];
      }>("/api/ecomviper/walmart/connect/save", {
        ...form,
        action,
      });

      if (response.summary && response.connectionStatus) {
        setHealth((current) => ({
          ...current,
          summary: response.summary ?? current.summary,
          connectionStatus: response.connectionStatus ?? current.connectionStatus,
        }));
      }

      const permissions = response.permissions;
      if (permissions) {
        setHealth((current) => ({
          ...current,
          summary: {
            ...current.summary,
            permissionChecks: permissions,
          },
        }));
      }

      if (action !== "permissions") {
        setForm((current) => ({ ...current, clientSecret: "" }));
      }
      setMessage(
        action === "save"
          ? "Credential summary saved safely."
          : action === "rotate"
            ? "Credential rotation request stored safely."
            : action === "disconnect"
              ? "Walmart disconnected."
              : "Permissions refreshed."
      );
    } catch {
      setMessage("Action failed. Please retry.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4" data-testid="ecomviper-walmart-connect-page">
      <WalmartPageHeader
        title="Walmart Connection"
        subtitle="Save and verify Walmart Marketplace credentials with server-side only secret handling."
        mode={health.summary.mode}
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
                placeholder="Walmart client secret"
              />
            </label>

            <label className="text-sm text-[#334155]">
              Environment
              <select
                value={form.environment}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    environment: event.target.value === "production" ? "production" : "sandbox",
                  }))
                }
                className="mt-1 w-full rounded-lg border border-[#D9E4F0] px-3 py-2"
              >
                <option value="sandbox">Sandbox</option>
                <option value="production">Production</option>
              </select>
            </label>

            <label className="text-sm text-[#334155]">
              Marketplace region
              <select
                value={form.region}
                onChange={() => setForm((current) => ({ ...current, region: "US" }))}
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
          </div>

          {message ? <p className="mt-3 text-sm text-[#334155]">{message}</p> : null}
        </article>

        <article className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5 shadow-[0_16px_36px_rgba(15,23,42,0.08)]">
          <h2 className="text-lg font-semibold text-[#0F172A]">Connection Status</h2>
          <div className="mt-3"><StatusBadge status={health.connectionStatus === "connected" ? "Connected" : "Not Connected"} /></div>
          <dl className="mt-3 space-y-2 text-sm text-[#334155]">
            <div className="flex items-start justify-between gap-3">
              <dt>Environment</dt>
              <dd className="font-medium">{health.summary.environment}</dd>
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
              <dd className="font-medium">{health.summary.clientSecretStored ? "Stored server-side indicator" : "Not stored"}</dd>
            </div>
            <div className="flex items-start justify-between gap-3">
              <dt>Token status</dt>
              <dd className="font-medium">{health.summary.tokenStatus}</dd>
            </div>
            <div className="flex items-start justify-between gap-3">
              <dt>Last successful auth</dt>
              <dd className="font-medium">{health.summary.lastSuccessfulAuth ?? "Never"}</dd>
            </div>
            <div className="flex items-start justify-between gap-3">
              <dt>Last API error</dt>
              <dd className="font-medium">{health.summary.lastApiError ?? "None"}</dd>
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
    </div>
  );
}
