"use client";

import { useEffect, useMemo, useState } from "react";
import TopBar from "@/components/ecomviper/TopBar";
import HudCard from "@/components/ecomviper/HudCard";
import NeonButton from "@/components/ecomviper/NeonButton";

type Provider = "brilliant_directories" | "openai" | "ga4" | "serpapi";
type Status = "connected" | "disconnected";

type IntegrationStatus = {
  provider: Provider;
  status: Status;
  masked: string;
  savedAt: string | null;
  meta: Record<string, unknown>;
};

type SaveError = {
  message: string;
  code?: string;
  reqId?: string;
};

const SECTIONS = [
  {
    title: "Core",
    items: [
      {
        id: "brilliant_directories",
        provider: "brilliant_directories" as const,
        name: "Brilliant Directories API",
        description: "Primary directory data source for listings and push updates.",
        locked: false,
      },
      {
        id: "openai",
        provider: "openai" as const,
        name: "OpenAI API (BYO)",
        description: "Drafts, featured images, and reasoning.",
        locked: false,
      },
    ],
  },
  {
    title: "Recommended",
    items: [
      {
        id: "ga4",
        provider: "ga4" as const,
        name: "GA4",
        description: "Behavior analytics signals.",
        locked: false,
      },
      {
        id: "serpapi",
        provider: "serpapi" as const,
        name: "SerpAPI",
        description: "Visibility and competitor context.",
        locked: false,
      },
    ],
  },
  {
    title: "Optional",
    items: [
      {
        provider: "ga4" as const,
        id: "reviews",
        name: "Reviews Platforms",
        description: "Future connector scaffold for reputation signals.",
        locked: true,
      },
      {
        provider: "serpapi" as const,
        id: "support",
        name: "Support Signals",
        description: "Future connector scaffold for support intent signals.",
        locked: true,
      },
    ],
  },
];

const EMPTY: Record<Provider, IntegrationStatus> = {
  brilliant_directories: { provider: "brilliant_directories", status: "disconnected", masked: "", savedAt: null, meta: {} },
  openai: { provider: "openai", status: "disconnected", masked: "", savedAt: null, meta: {} },
  ga4: { provider: "ga4", status: "disconnected", masked: "", savedAt: null, meta: {} },
  serpapi: { provider: "serpapi", status: "disconnected", masked: "", savedAt: null, meta: {} },
};

function parseApiError(json: unknown, fallback: string): SaveError {
  if (json && typeof json === "object" && "error" in json) {
    const error = (json as { error?: unknown }).error;
    if (typeof error === "string") return { message: error };
    if (error && typeof error === "object") {
      const e = error as { message?: string; code?: string; reqId?: string };
      return {
        message: e.message || fallback,
        code: e.code,
        reqId: e.reqId,
      };
    }
  }
  return { message: fallback };
}

export default function DirectoryIqIntegrationsClient() {
  const [statusByProvider, setStatusByProvider] = useState<Record<Provider, IntegrationStatus>>(EMPTY);
  const [expandedProvider, setExpandedProvider] = useState<Provider | null>(null);
  const [error, setError] = useState<SaveError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState<Provider | null>(null);
  const [testing, setTesting] = useState<Provider | null>(null);
  const [testMessage, setTestMessage] = useState<string | null>(null);

  const [bdBaseUrl, setBdBaseUrl] = useState("");
  const [bdApiKey, setBdApiKey] = useState("");
  const [bdSiteLabel, setBdSiteLabel] = useState("");
  const [openAiApiKey, setOpenAiApiKey] = useState("");
  const [ga4MeasurementId, setGa4MeasurementId] = useState("");
  const [ga4ApiSecret, setGa4ApiSecret] = useState("");
  const [serpApiKey, setSerpApiKey] = useState("");
  const [serpEnginePreference, setSerpEnginePreference] = useState("");

  const connectGuide = useMemo(
    () => [
      "Configure Brilliant Directories API first to enable listing analysis and push.",
      "Add OpenAI API (BYO) to enable draft and featured image generation.",
      "Add GA4 and SerpAPI for additional signal enrichment.",
    ],
    []
  );

  async function load() {
    setError(null);
    const response = await fetch("/api/directoryiq/integrations", { cache: "no-store" });
    const json = (await response.json()) as { integrations?: IntegrationStatus[]; error?: unknown };
    if (!response.ok) {
      setError(parseApiError(json, "Failed to load integrations."));
      return;
    }
    const next = { ...EMPTY };
    for (const row of json.integrations ?? []) {
      next[row.provider] = row;
    }
    setStatusByProvider(next);

    const bdMeta = next.brilliant_directories.meta ?? {};
    const ga4Meta = next.ga4.meta ?? {};
    const serpMeta = next.serpapi.meta ?? {};
    setBdBaseUrl(typeof bdMeta.baseUrl === "string" ? bdMeta.baseUrl : "");
    setBdSiteLabel(typeof bdMeta.siteLabel === "string" ? bdMeta.siteLabel : "");
    setGa4MeasurementId(typeof ga4Meta.measurementId === "string" ? ga4Meta.measurementId : "");
    setSerpEnginePreference(typeof serpMeta.enginePreference === "string" ? serpMeta.enginePreference : "");
  }

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, []);

  async function save(provider: Provider) {
    setSaving(provider);
    setError(null);
    setNotice(null);
    setTestMessage(null);

    let body: Record<string, unknown> = {};
    if (provider === "brilliant_directories") {
      body = {
        baseUrl: bdBaseUrl.trim(),
        apiKey: bdApiKey.trim(),
        meta: { siteLabel: bdSiteLabel.trim() || null },
      };
    } else if (provider === "openai") {
      body = { apiKey: openAiApiKey.trim() };
    } else if (provider === "ga4") {
      body = {
        measurementId: ga4MeasurementId.trim(),
        apiSecret: ga4ApiSecret.trim(),
      };
    } else {
      body = {
        apiKey: serpApiKey.trim(),
        meta: { enginePreference: serpEnginePreference.trim() || null },
      };
    }

    const response = await fetch(`/api/directoryiq/integrations/${provider}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(parseApiError(json, "Failed to save integration."));
      setSaving(null);
      return;
    }

    setNotice("Integration saved.");
    setExpandedProvider(null);
    setBdApiKey("");
    setOpenAiApiKey("");
    setGa4ApiSecret("");
    setSerpApiKey("");
    await load();
    setSaving(null);
  }

  async function test(provider: Provider) {
    setTesting(provider);
    setError(null);
    setTestMessage(null);
    const response = await fetch(`/api/directoryiq/integrations/${provider}/test`, {
      method: "POST",
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(parseApiError(json, "Connection test failed."));
      setTesting(null);
      return;
    }
    const message = (json as { message?: string }).message ?? "Connection successful.";
    setTestMessage(message);
    setTesting(null);
  }

  async function disconnect(provider: Provider) {
    setSaving(provider);
    setError(null);
    const response = await fetch(`/api/directoryiq/integrations/${provider}`, { method: "DELETE" });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(parseApiError(json, "Failed to disconnect integration."));
      setSaving(null);
      return;
    }
    setNotice("Integration disconnected.");
    await load();
    setSaving(null);
  }

  function stateLabel(provider: Provider): "CONNECTED" | "DISCONNECTED" {
    return statusByProvider[provider].status === "connected" ? "CONNECTED" : "DISCONNECTED";
  }

  return (
    <>
      <section className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
        <h1 className="text-xl font-semibold text-slate-100">Signal Sources Integrations</h1>
        <p className="mt-1 text-sm text-slate-300">
          Connect providers once, then manage edits inline without leaving this page.
        </p>
      </section>

      <TopBar
        breadcrumbs={["Home", "DirectoryIQ", "Settings", "Integrations"]}
        searchPlaceholder="Search signal sources..."
      />

      {error ? (
        <div className="rounded-xl border border-rose-300/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
          <div>{error.message}</div>
          {(error.code || error.reqId) ? (
            <div className="mt-1 text-xs text-rose-200/90">
              {error.code ? `Code: ${error.code}` : ""} {error.reqId ? `ReqId: ${error.reqId}` : ""}
            </div>
          ) : null}
        </div>
      ) : null}
      {notice ? (
        <div className="rounded-xl border border-emerald-300/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
          {notice}
        </div>
      ) : null}
      {testMessage ? (
        <div className="rounded-xl border border-cyan-300/30 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100">
          {testMessage}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
        <HudCard title="Signal Sources" subtitle="DirectoryIQ integrations">
          <div className="space-y-2 text-sm">
            <div className="rounded-lg border border-cyan-300/25 bg-cyan-400/10 px-3 py-2 text-cyan-100">
              Signal Sources
            </div>
            <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-slate-300">
              Connect Guide
            </div>
          </div>
          <div className="mt-3 space-y-2 text-xs text-slate-400">
            {connectGuide.map((line) => (
              <div key={line}>{line}</div>
            ))}
          </div>
        </HudCard>

        <HudCard title="Signal Sources Integrations" subtitle="Configure each provider inline">
          <div className="space-y-4">
            {SECTIONS.map((section) => (
              <div key={section.title}>
                <div className="mb-2 text-xs uppercase tracking-[0.16em] text-slate-400">{section.title}</div>
                <div className="space-y-2">
                  {section.items.map((item) => {
                    const provider = item.provider;
                    const connected = !item.locked && statusByProvider[provider].status === "connected";
                    const expanded = expandedProvider === provider && !item.locked;
                    const savedAt = statusByProvider[provider].savedAt;
                    const masked = statusByProvider[provider].masked;
                    return (
                      <article key={item.id ?? provider} className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <div className="text-sm font-semibold text-slate-100">{item.name}</div>
                              <span
                                className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                                  item.locked
                                    ? "border-amber-300/35 bg-amber-400/15 text-amber-100"
                                    : connected
                                      ? "border-emerald-300/35 bg-emerald-400/10 text-emerald-100"
                                      : "border-white/20 bg-white/5 text-slate-200"
                                }`}
                              >
                                {item.locked ? "LOCKED" : stateLabel(provider)}
                              </span>
                            </div>
                            <p className="mt-1 text-sm text-slate-300">{item.description}</p>
                            {connected ? (
                              <div className="mt-1 text-xs text-slate-400">
                                {masked ? `${masked} · ` : ""}Saved {savedAt ? new Date(savedAt).toLocaleString() : "-"}
                              </div>
                            ) : null}
                            {item.locked ? (
                              <div className="mt-1 text-xs text-slate-400">Coming soon</div>
                            ) : null}
                          </div>
                          <div className="flex gap-2">
                            {item.locked ? (
                              <NeonButton variant="secondary" disabled>
                                Coming soon
                              </NeonButton>
                            ) : (
                              <NeonButton variant="secondary" onClick={() => setExpandedProvider(expanded ? null : provider)}>
                                {expanded ? "Close" : connected ? "Edit" : "Configure"}
                              </NeonButton>
                            )}
                          </div>
                        </div>

                        {expanded ? (
                          <div className="mt-3 border-t border-white/10 pt-3">
                            {provider === "brilliant_directories" ? (
                              <div className="grid gap-2 md:grid-cols-2">
                                <label className="text-xs text-slate-300">
                                  Base URL <span className="text-rose-200">*</span>
                                </label>
                                <label className="text-xs text-slate-300">
                                  X-Api-Key <span className="text-rose-200">*</span>
                                </label>
                                <input
                                  value={bdBaseUrl}
                                  onChange={(event) => setBdBaseUrl(event.target.value)}
                                  placeholder="Base URL (e.g. https://your-bd-site.com)"
                                  className="rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2 text-sm text-slate-100"
                                />
                                <input
                                  value={bdApiKey}
                                  onChange={(event) => setBdApiKey(event.target.value)}
                                  type="password"
                                  placeholder="X-Api-Key"
                                  className="rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2 text-sm text-slate-100"
                                />
                                <input
                                  value={bdSiteLabel}
                                  onChange={(event) => setBdSiteLabel(event.target.value)}
                                  placeholder="Default directory site label (optional)"
                                  className="rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2 text-sm text-slate-100 md:col-span-2"
                                />
                              </div>
                            ) : null}

                            {provider === "openai" ? (
                              <div className="space-y-2">
                                <label className="text-xs text-slate-300">
                                  API Key <span className="text-rose-200">*</span>
                                </label>
                                <input
                                  value={openAiApiKey}
                                  onChange={(event) => setOpenAiApiKey(event.target.value)}
                                  type="password"
                                  placeholder="OpenAI API key"
                                  className="w-full rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2 text-sm text-slate-100"
                                />
                              </div>
                            ) : null}

                            {provider === "ga4" ? (
                              <div className="grid gap-2 md:grid-cols-2">
                                <label className="text-xs text-slate-300">
                                  Measurement ID <span className="text-rose-200">*</span>
                                </label>
                                <label className="text-xs text-slate-300">
                                  API Secret <span className="text-rose-200">*</span>
                                </label>
                                <input
                                  value={ga4MeasurementId}
                                  onChange={(event) => setGa4MeasurementId(event.target.value)}
                                  placeholder="Measurement ID (e.g. G-XXXXXXX)"
                                  className="rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2 text-sm text-slate-100"
                                />
                                <input
                                  value={ga4ApiSecret}
                                  onChange={(event) => setGa4ApiSecret(event.target.value)}
                                  type="password"
                                  placeholder="API Secret"
                                  className="rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2 text-sm text-slate-100"
                                />
                              </div>
                            ) : null}

                            {provider === "serpapi" ? (
                              <div className="grid gap-2 md:grid-cols-2">
                                <label className="text-xs text-slate-300">
                                  API Key <span className="text-rose-200">*</span>
                                </label>
                                <label className="text-xs text-slate-300">Engine preference</label>
                                <input
                                  value={serpApiKey}
                                  onChange={(event) => setSerpApiKey(event.target.value)}
                                  type="password"
                                  placeholder="SerpAPI key"
                                  className="rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2 text-sm text-slate-100"
                                />
                                <input
                                  value={serpEnginePreference}
                                  onChange={(event) => setSerpEnginePreference(event.target.value)}
                                  placeholder="Engine preference (optional)"
                                  className="rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2 text-sm text-slate-100"
                                />
                              </div>
                            ) : null}

                            <div className="mt-3 flex flex-wrap gap-2">
                              <NeonButton variant="secondary" onClick={() => void test(provider)} disabled={testing === provider}>
                                {testing === provider ? "Testing..." : "Test Connection"}
                              </NeonButton>
                              <NeonButton onClick={() => void save(provider)} disabled={saving === provider}>
                                {saving === provider ? "Saving..." : "Save"}
                              </NeonButton>
                              <NeonButton variant="secondary" onClick={() => setExpandedProvider(null)}>
                                Cancel
                              </NeonButton>
                              {connected ? (
                                <button
                                  type="button"
                                  className="rounded-xl border border-rose-300/30 px-3 py-2 text-sm text-rose-200 hover:bg-rose-400/10"
                                  onClick={() => void disconnect(provider)}
                                  disabled={saving === provider}
                                >
                                  {saving === provider ? "Working..." : "Disconnect"}
                                </button>
                              ) : null}
                            </div>
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </HudCard>
      </div>
    </>
  );
}
