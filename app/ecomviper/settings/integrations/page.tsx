"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Cable } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import HudCard from "@/components/ecomviper/HudCard";
import NeonButton from "@/components/ecomviper/NeonButton";
import TopBar from "@/components/ecomviper/TopBar";
import { aiSelectionCopy } from "@/lib/copy/aiSelectionCopy";
import { ecomviperSignalSources } from "@/lib/copy/signalSourcesCatalog";

type Integration = {
  id: string;
  provider: string;
  shop_domain: string;
  scopes: string;
  status: string;
  installed_at: string;
  last_verified_at: string | null;
};

type IngestRun = {
  id: string;
  integration_id: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  products_count: number;
  articles_count: number;
  pages_count: number;
  collections_count: number;
  error_message: string | null;
};

type ByoProvider = "openai" | "ga4" | "serpapi";

type ProviderState = {
  provider: ByoProvider;
  label: string | null;
  connected: boolean;
  masked_key: string;
  updated_at: string | null;
};

const providerMeta: Record<ByoProvider, { name: string; placeholder: string }> = {
  openai: { name: "OpenAI API (BYO)", placeholder: "Paste OpenAI API key" },
  ga4: { name: "GA4", placeholder: "Paste GA4 credential or property token" },
  serpapi: { name: "SerpAPI", placeholder: "Paste SerpAPI key" },
};

const idAlias: Record<string, ByoProvider> = {
  openai: "openai",
  ga4: "ga4",
  serpapi: "serpapi",
};

const reverseAlias: Record<ByoProvider, string> = {
  openai: "openai",
  ga4: "ga4",
  serpapi: "serpapi",
};

const categoryOrder = ["Core", "Recommended", "Optional"] as const;

function resolveProvider(id: string): ByoProvider | null {
  if (id === "openai" || id === "ga4" || id === "serpapi") return id;
  return null;
}

export default function EcomViperIntegrationsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedProvider = idAlias[(searchParams.get("connector") ?? "").toLowerCase()] ?? null;

  const [callbackParams, setCallbackParams] = useState<{
    connected: boolean;
    shop: string | null;
    error: string | null;
  }>({ connected: false, shop: null, error: null });
  const [shop, setShop] = useState("");
  const [loading, setLoading] = useState(false);
  const [ingestingId, setIngestingId] = useState<string | null>(null);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [runs, setRuns] = useState<IngestRun[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [providers, setProviders] = useState<Partial<Record<ByoProvider, ProviderState>>>({});
  const [keyValues, setKeyValues] = useState<Record<ByoProvider, string>>({ openai: "", ga4: "", serpapi: "" });
  const [keyLabels, setKeyLabels] = useState<Record<ByoProvider, string>>({ openai: "", ga4: "", serpapi: "" });
  const [savingProvider, setSavingProvider] = useState<ByoProvider | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/ecomviper/integrations", { cache: "no-store" });
      const json = (await response.json()) as {
        integrations?: Integration[];
        runs?: IngestRun[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(json.error ?? "Failed to load integrations");
      }
      setIntegrations(json.integrations ?? []);
      setRuns(json.runs ?? []);

      const providersResponse = await fetch("/api/ecomviper/byo-keys", { cache: "no-store" });
      const providersJson = (await providersResponse.json()) as { providers?: ProviderState[]; error?: string };
      if (!providersResponse.ok) {
        throw new Error(providersJson.error ?? "Failed to load credential providers");
      }
      const nextProviders: Partial<Record<ByoProvider, ProviderState>> = {};
      for (const provider of providersJson.providers ?? []) {
        nextProviders[provider.provider] = provider;
      }
      setProviders(nextProviders);
      setKeyLabels((prev) => ({
        openai: nextProviders.openai?.label ?? prev.openai,
        ga4: nextProviders.ga4?.label ?? prev.ga4,
        serpapi: nextProviders.serpapi?.label ?? prev.serpapi,
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown load error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
    const params = new URLSearchParams(window.location.search);
    setCallbackParams({
      connected: params.get("connected") === "1",
      shop: params.get("shop"),
      error: params.get("error"),
    });
  }, []);

  const runsByIntegration = useMemo(() => {
    const map = new Map<string, IngestRun>();
    for (const run of runs) {
      if (!map.has(run.integration_id)) {
        map.set(run.integration_id, run);
      }
    }
    return map;
  }, [runs]);

  function normalizeHostname(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/\/.*$/, "")
      .replace(/\.$/, "");
  }

  function setExpandedProvider(provider: ByoProvider | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (provider) {
      params.set("connector", reverseAlias[provider]);
    } else {
      params.delete("connector");
    }
    const nextQuery = params.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
  }

  async function onConnect() {
    const normalized = normalizeHostname(shop);
    if (!normalized) {
      setError("Enter your Shopify domain first (for example: yourstore.myshopify.com).");
      return;
    }

    const hostnamePattern = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;
    if (!hostnamePattern.test(normalized)) {
      setError("Please enter a valid hostname like yourstore.myshopify.com.");
      return;
    }

    if (!normalized.endsWith(".myshopify.com")) {
      setError(
        `Please enter ${normalized.split(".")[0] || "yourstore"}.myshopify.com (Shopify's canonical domain).`
      );
      return;
    }

    setError(null);
    const response = await fetch(
      `/api/auth/shopify/start?shop=${encodeURIComponent(normalized)}&dry_run=1`,
      { method: "GET" }
    );

    if (response.status === 500) {
      setError("Shopify connect is temporarily unavailable (server not configured).");
      return;
    }

    let message = "Unable to start Shopify connection.";
    try {
      const json = (await response.json()) as { error?: string; ok?: boolean; redirect_to?: string };
      if (response.ok && json.ok && json.redirect_to) {
        window.location.href = json.redirect_to;
        return;
      }
      if (json.error) message = json.error;
    } catch {
      // no-op
    }
    setError(message);
  }

  async function onIngest(integrationId: string) {
    setIngestingId(integrationId);
    setError(null);
    try {
      const response = await fetch("/api/ingest/shopify/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ integration_id: integrationId, mode: "full" }),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(json.error ?? "Ingest failed");
      }
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown ingest error");
    } finally {
      setIngestingId(null);
    }
  }

  async function saveProvider(provider: ByoProvider) {
    const apiKey = keyValues[provider]?.trim() ?? "";
    if (!apiKey) {
      setFormError(`Enter a key for ${provider.toUpperCase()}.`);
      return;
    }

    setSavingProvider(provider);
    setFormError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/ecomviper/byo-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, api_key: apiKey, label: keyLabels[provider] || null }),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error ?? "Failed to save key");

      setKeyValues((prev) => ({ ...prev, [provider]: "" }));
      await loadData();
      setNotice(`${providerMeta[provider].name} connected.`);
      setExpandedProvider(null);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Unknown save error");
    } finally {
      setSavingProvider(null);
    }
  }

  async function deleteProvider(provider: ByoProvider) {
    setSavingProvider(provider);
    setFormError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/ecomviper/byo-keys?provider=${provider}`, { method: "DELETE" });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error ?? "Failed to delete key");
      await loadData();
      setNotice(`${providerMeta[provider].name} removed.`);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Unknown delete error");
    } finally {
      setSavingProvider(null);
    }
  }

  return (
    <>
      <TopBar
        breadcrumbs={["Home", "EcomViper", "Signal Sources"]}
        searchPlaceholder="Search connector or signal source..."
      />

      <HudCard
        title={aiSelectionCopy.ecomviper.integrationsTitle}
        subtitle={aiSelectionCopy.ecomviper.integrationsSubtitle}
      >
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <input
            value={shop}
            onChange={(event) => setShop(event.target.value)}
            placeholder="yourstore.myshopify.com"
            className="rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2.5 text-sm text-slate-100 outline-none ring-cyan-300/40 transition focus:border-cyan-300/40 focus:ring-2"
          />
          <NeonButton onClick={onConnect}>Connect Shopify (OAuth)</NeonButton>
        </div>

        <div className="mt-3 text-xs text-slate-400">
          Use the <span className="font-mono">.myshopify.com</span> domain (found in Shopify admin).
        </div>

        {callbackParams.connected && callbackParams.shop ? (
          <div className="mt-4 rounded-xl border border-emerald-300/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
            Connected to <span className="font-medium">{callbackParams.shop}</span>
          </div>
        ) : null}

        {callbackParams.error ? (
          <div className="mt-4 rounded-xl border border-rose-300/35 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
            OAuth callback error: {callbackParams.error}
          </div>
        ) : null}

        {error ? (
          <div className="mt-4 rounded-xl border border-rose-300/35 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        ) : null}
        <div className="mt-6 border-t border-cyan-300/15 pt-5">
          <p className="mb-4 text-sm text-slate-300">Configure connector credentials inline.</p>
          {notice ? (
            <div className="mb-4 rounded-xl border border-emerald-300/35 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
              {notice}
            </div>
          ) : null}
          {formError ? (
            <div className="mb-4 rounded-xl border border-rose-300/35 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
              {formError}
            </div>
          ) : null}

          <div className="space-y-5">
            {categoryOrder.map((category) => {
              const items = ecomviperSignalSources.filter((connector) => connector.category === category);
              if (items.length === 0) return null;

              return (
                <div key={category}>
                  <div className="mb-2 text-xs uppercase tracking-[0.16em] text-slate-400">{category}</div>
                  <div className="space-y-2">
                    {items.map((connector) => {
                      const provider = resolveProvider(connector.id);
                      const providerState = provider ? providers[provider] : null;
                      const connected = Boolean(providerState?.connected);
                      const expanded = provider ? selectedProvider === provider : false;
                      const locked = connector.status === "locked" || !provider;

                      return (
                        <article key={connector.id} className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-100">
                                  <Cable className="h-4 w-4 text-cyan-200" />
                                  {connector.name}
                                </div>
                                <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.1em] ${
                                  connected
                                    ? "border-emerald-300/35 bg-emerald-400/10 text-emerald-100"
                                    : locked
                                      ? "border-amber-300/35 bg-amber-400/15 text-amber-100"
                                      : "border-white/20 bg-white/5 text-slate-200"
                                }`}>
                                  {connected ? "Connected" : locked ? "Locked" : "Disconnected"}
                                </span>
                              </div>
                              <p className="mt-1 text-sm text-slate-300">{connector.description}</p>
                              {providerState?.connected ? (
                                <p className="mt-1 text-xs text-slate-400">
                                  {providerState.masked_key}
                                  {providerState.updated_at ? ` · Saved ${new Date(providerState.updated_at).toLocaleString()}` : ""}
                                </p>
                              ) : null}
                              {connector.disabledReason ? (
                                <p className="mt-1 text-xs text-slate-400">{connector.disabledReason}</p>
                              ) : null}
                            </div>

                            {locked ? (
                              <button
                                type="button"
                                disabled
                                className="inline-flex cursor-not-allowed items-center rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-400"
                              >
                                {connector.actionLabel}
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setExpandedProvider(expanded ? null : provider)}
                                className="inline-flex items-center rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-100 transition hover:bg-white/10"
                              >
                                {expanded ? "Close" : connected ? "Edit" : "Configure"}
                              </button>
                            )}
                          </div>

                          {expanded && provider ? (
                            <div className="mt-3 border-t border-white/10 pt-3">
                              <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto]">
                                <input
                                  value={keyValues[provider]}
                                  onChange={(event) =>
                                    setKeyValues((prev) => ({ ...prev, [provider]: event.target.value }))
                                  }
                                  placeholder={providerMeta[provider].placeholder}
                                  className="rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2 text-sm text-slate-100 outline-none ring-cyan-300/40 focus:border-cyan-300/40 focus:ring-2"
                                />
                                <input
                                  value={keyLabels[provider]}
                                  onChange={(event) =>
                                    setKeyLabels((prev) => ({ ...prev, [provider]: event.target.value }))
                                  }
                                  placeholder="Optional label"
                                  className="rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2 text-sm text-slate-100 outline-none ring-cyan-300/40 focus:border-cyan-300/40 focus:ring-2"
                                />
                                <NeonButton onClick={() => saveProvider(provider)} disabled={savingProvider === provider}>
                                  {savingProvider === provider ? "Saving..." : "Save"}
                                </NeonButton>
                                <NeonButton
                                  variant="secondary"
                                  onClick={() => deleteProvider(provider)}
                                  disabled={savingProvider === provider || !connected}
                                >
                                  Delete
                                </NeonButton>
                              </div>
                            </div>
                          ) : null}
                        </article>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </HudCard>

      <HudCard title="Connected Stores" subtitle="Run full ingest to hydrate the reasoning graph.">
        {loading ? (
          <div className="text-sm text-slate-300">Loading integrations...</div>
        ) : integrations.length === 0 ? (
          <div className="text-sm text-slate-400">No Shopify integration connected yet.</div>
        ) : (
          <div className="space-y-3">
            {integrations.map((integration) => {
              const latestRun = runsByIntegration.get(integration.id);
              return (
                <div
                  key={integration.id}
                  className="rounded-xl border border-cyan-300/20 bg-slate-900/60 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-slate-100">{integration.shop_domain}</div>
                      <div className="mt-1 text-xs text-slate-400">
                        Scopes: {integration.scopes || "read_products,read_content"}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <NeonButton
                        onClick={() => onIngest(integration.id)}
                        disabled={ingestingId === integration.id}
                      >
                        {ingestingId === integration.id ? "Ingesting..." : "Ingest All Pages"}
                      </NeonButton>
                      <Link
                        href="/ecomviper/products/opa-coq10-200mg/reasoning-hub"
                        className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs text-slate-200 transition hover:bg-white/10"
                      >
                        Open Reasoning Hub
                      </Link>
                    </div>
                  </div>

                  {latestRun ? (
                    <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-slate-300">
                      Last run: {latestRun.status.toUpperCase()} | Products {latestRun.products_count} |
                      Articles {latestRun.articles_count} | Pages {latestRun.pages_count} | Collections {" "}
                      {latestRun.collections_count}
                      {latestRun.error_message ? ` | Error: ${latestRun.error_message}` : ""}
                    </div>
                  ) : (
                    <div className="mt-3 text-xs text-slate-400">No ingest run recorded yet.</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </HudCard>
    </>
  );
}
