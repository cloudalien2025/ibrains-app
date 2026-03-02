"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Cable } from "lucide-react";
import NeonButton from "@/components/ecomviper/NeonButton";
import { directoryIqSignalSources } from "@/lib/copy/signalSourcesCatalog";
import type { DirectoryIqConnector, DirectoryIqCredentialStatus } from "@/lib/directoryiq/signalSourceCredentials";

const connectorMeta: Record<DirectoryIqConnector, { name: string; placeholder: string }> = {
  brilliant_directories_api: {
    name: "Brilliant Directories API",
    placeholder: "Paste Brilliant Directories API key",
  },
  openai: {
    name: "OpenAI API (BYO)",
    placeholder: "Paste OpenAI API key",
  },
  serpapi: {
    name: "SerpAPI",
    placeholder: "Paste SerpAPI key",
  },
  ga4: {
    name: "GA4",
    placeholder: "Paste GA4 credential or property token",
  },
};

const idAlias: Record<string, DirectoryIqConnector> = {
  "brilliant-directories": "brilliant_directories_api",
  brilliant_directories_api: "brilliant_directories_api",
  openai: "openai",
  serpapi: "serpapi",
  ga4: "ga4",
};

const reverseAlias: Record<DirectoryIqConnector, string> = {
  brilliant_directories_api: "brilliant-directories",
  openai: "openai",
  serpapi: "serpapi",
  ga4: "ga4",
};

type IngestRun = {
  id: string;
  status: string;
  source_base_url: string | null;
  started_at: string;
  finished_at: string | null;
  listings_count: number;
  blog_posts_count: number;
  error_message: string | null;
};

const categoryOrder = ["Core", "Recommended", "Optional"] as const;

function resolveConnector(id: string): DirectoryIqConnector | null {
  if (id === "brilliant-directories") return "brilliant_directories_api";
  if (id === "openai" || id === "serpapi" || id === "ga4") return id;
  return null;
}

export default function DirectoryIqSignalSourcesClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedConnector = idAlias[(searchParams.get("connector") ?? "").toLowerCase()] ?? null;

  const [states, setStates] = useState<Record<DirectoryIqConnector, DirectoryIqCredentialStatus>>({
    brilliant_directories_api: {
      connector_id: "brilliant_directories_api",
      connected: false,
      label: null,
      masked_secret: "",
      updated_at: null,
      config: null,
    },
    openai: { connector_id: "openai", connected: false, label: null, masked_secret: "", updated_at: null, config: null },
    serpapi: { connector_id: "serpapi", connected: false, label: null, masked_secret: "", updated_at: null, config: null },
    ga4: { connector_id: "ga4", connected: false, label: null, masked_secret: "", updated_at: null, config: null },
  });

  const [values, setValues] = useState<Record<DirectoryIqConnector, string>>({
    brilliant_directories_api: "",
    openai: "",
    serpapi: "",
    ga4: "",
  });

  const [labels, setLabels] = useState<Record<DirectoryIqConnector, string>>({
    brilliant_directories_api: "",
    openai: "",
    serpapi: "",
    ga4: "",
  });

  const [saving, setSaving] = useState<DirectoryIqConnector | null>(null);
  const [runningIngest, setRunningIngest] = useState(false);
  const [runs, setRuns] = useState<IngestRun[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [bdConfig, setBdConfig] = useState<{ baseUrl: string; listingsPath: string; blogPostsPath: string }>({
    baseUrl: "",
    listingsPath: "/api/v2/users_portfolio_groups/search",
    blogPostsPath: "/api/v2/data_posts/search",
  });

  async function load() {
    setError(null);
    try {
      const response = await fetch("/api/directoryiq/signal-sources", { cache: "no-store" });
      const json = (await response.json()) as {
        connectors?: DirectoryIqCredentialStatus[];
        error?: string;
      };

      if (!response.ok) throw new Error(json.error ?? "Failed to load credentials");

      const next = { ...states };
      for (const connector of json.connectors ?? []) {
        next[connector.connector_id] = connector;
      }
      setStates(next);
      const bd = next.brilliant_directories_api;
      const cfg = bd.config ?? {};
      setBdConfig((prev) => ({
        baseUrl: typeof cfg.base_url === "string" ? cfg.base_url : prev.baseUrl,
        listingsPath: typeof cfg.listings_path === "string" ? cfg.listings_path : prev.listingsPath,
        blogPostsPath: typeof cfg.blog_posts_path === "string" ? cfg.blog_posts_path : prev.blogPostsPath,
      }));

      setLabels((prev) => {
        const updated = { ...prev };
        for (const connector of json.connectors ?? []) {
          if (connector.label) updated[connector.connector_id] = connector.label;
        }
        return updated;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown load error");
    }
  }

  async function loadRuns() {
    try {
      const response = await fetch("/api/directoryiq/ingest/runs", { cache: "no-store" });
      const json = (await response.json()) as { runs?: IngestRun[]; error?: string };
      if (!response.ok) throw new Error(json.error ?? "Failed to load ingest runs");
      setRuns(json.runs ?? []);
    } catch {
      setRuns([]);
    }
  }

  useEffect(() => {
    void load();
    void loadRuns();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setExpandedConnector(connectorId: DirectoryIqConnector | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (connectorId) {
      params.set("connector", reverseAlias[connectorId]);
    } else {
      params.delete("connector");
    }
    const nextQuery = params.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
  }

  async function save(connectorId: DirectoryIqConnector) {
    const secret = values[connectorId].trim();
    if (!secret) {
      setError(`Enter a value for ${connectorMeta[connectorId].name}.`);
      return;
    }

    setSaving(connectorId);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch("/api/directoryiq/signal-sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connector_id: connectorId,
          secret,
          label: labels[connectorId] || null,
          config:
            connectorId === "brilliant_directories_api"
              ? {
                  base_url: bdConfig.baseUrl.trim(),
                  listings_path: bdConfig.listingsPath.trim(),
                  blog_posts_path: bdConfig.blogPostsPath.trim(),
                }
              : null,
        }),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error ?? "Failed to save credential");

      setValues((prev) => ({ ...prev, [connectorId]: "" }));
      await load();
      setNotice(`${connectorMeta[connectorId].name} connected.`);
      setExpandedConnector(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown save error");
    } finally {
      setSaving(null);
    }
  }

  async function runIngest() {
    setRunningIngest(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch("/api/ingest/directoryiq/run", { method: "POST" });
      const json = (await response.json()) as {
        run_id?: string;
        status?: string;
        counts?: { listings: number; blogPosts: number };
        error?: string;
        error_message?: string | null;
      };

      if (!response.ok) throw new Error(json.error ?? json.error_message ?? "DirectoryIQ ingest failed");

      if (json.status === "failed") {
        throw new Error(json.error_message ?? "DirectoryIQ ingest failed");
      }

      setNotice(
        `Ingest completed. Listings: ${json.counts?.listings ?? 0}, Blog posts: ${json.counts?.blogPosts ?? 0}.`
      );
      await loadRuns();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown ingest error");
      await loadRuns();
    } finally {
      setRunningIngest(false);
    }
  }

  async function remove(connectorId: DirectoryIqConnector) {
    setSaving(connectorId);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(`/api/directoryiq/signal-sources?connector_id=${connectorId}`, {
        method: "DELETE",
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error ?? "Failed to remove credential");

      await load();
      setNotice(`${connectorMeta[connectorId].name} removed.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown delete error");
    } finally {
      setSaving(null);
    }
  }

  return (
    <>
      <section className="rounded-2xl border border-cyan-300/20 bg-slate-950/55 p-6 backdrop-blur-xl shadow-[inset_0_1px_0_rgba(148,163,184,0.14),0_24px_50px_rgba(2,6,23,0.7),0_0_36px_rgba(34,211,238,0.08)]">
        <header className="mb-4 border-b border-cyan-300/15 pb-4">
          <div className="text-xs uppercase tracking-[0.18em] text-cyan-300/80">Signal Sources</div>
          <h2 className="mt-2 text-xl font-semibold text-white">DirectoryIQ Signal Sources</h2>
          <p className="mt-1 text-sm text-slate-300">
            Configure each source inline. Save collapses the panel and updates connection status.
          </p>
        </header>

        {notice ? (
          <div className="mb-4 rounded-xl border border-emerald-300/35 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
            {notice}
          </div>
        ) : null}
        {error ? (
          <div className="mb-4 rounded-xl border border-rose-300/35 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        ) : null}

        <div className="space-y-5">
          {categoryOrder.map((category) => {
            const items = directoryIqSignalSources.filter((connector) => connector.category === category);
            if (items.length === 0) return null;

            return (
              <div key={category}>
                <div className="mb-2 text-xs uppercase tracking-[0.16em] text-slate-400">{category}</div>
                <div className="space-y-2">
                  {items.map((connector) => {
                    const connectorId = resolveConnector(connector.id);
                    const state = connectorId ? states[connectorId] : null;
                    const connected = Boolean(state?.connected);
                    const expanded = connectorId ? selectedConnector === connectorId : false;
                    const locked = connector.status === "locked" || !connectorId;

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
                            {state?.connected ? (
                              <p className="mt-1 text-xs text-slate-400">
                                {state.masked_secret}
                                {state.updated_at ? ` · Saved ${new Date(state.updated_at).toLocaleString()}` : ""}
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
                              onClick={() => setExpandedConnector(expanded ? null : connectorId)}
                              className="inline-flex items-center rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-100 transition hover:bg-white/10"
                            >
                              {expanded ? "Close" : connected ? "Edit" : "Configure"}
                            </button>
                          )}
                        </div>

                        {expanded && connectorId ? (
                          <div className="mt-3 border-t border-white/10 pt-3">
                            <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto]">
                              <input
                                value={values[connectorId]}
                                onChange={(event) =>
                                  setValues((prev) => ({ ...prev, [connectorId]: event.target.value }))
                                }
                                placeholder={connectorMeta[connectorId].placeholder}
                                className="rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2 text-sm text-slate-100 outline-none ring-cyan-300/40 focus:border-cyan-300/40 focus:ring-2"
                              />
                              <input
                                value={labels[connectorId]}
                                onChange={(event) =>
                                  setLabels((prev) => ({ ...prev, [connectorId]: event.target.value }))
                                }
                                placeholder="Optional label"
                                className="rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2 text-sm text-slate-100 outline-none ring-cyan-300/40 focus:border-cyan-300/40 focus:ring-2"
                              />
                              <NeonButton onClick={() => save(connectorId)} disabled={saving === connectorId}>
                                {saving === connectorId ? "Saving..." : "Save"}
                              </NeonButton>
                              <NeonButton
                                variant="secondary"
                                onClick={() => remove(connectorId)}
                                disabled={saving === connectorId || !connected}
                              >
                                Delete
                              </NeonButton>
                            </div>

                            {connectorId === "brilliant_directories_api" ? (
                              <div className="mt-3 grid gap-2 md:grid-cols-3">
                                <input
                                  value={bdConfig.baseUrl}
                                  onChange={(event) => setBdConfig((prev) => ({ ...prev, baseUrl: event.target.value }))}
                                  placeholder="Base URL (e.g. https://example.com)"
                                  className="rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2 text-sm text-slate-100 outline-none ring-cyan-300/40 focus:border-cyan-300/40 focus:ring-2"
                                />
                                <input
                                  value={bdConfig.listingsPath}
                                  onChange={(event) => setBdConfig((prev) => ({ ...prev, listingsPath: event.target.value }))}
                                  placeholder="Listings search endpoint (e.g. /api/v2/users_portfolio_groups/search)"
                                  className="rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2 text-sm text-slate-100 outline-none ring-cyan-300/40 focus:border-cyan-300/40 focus:ring-2"
                                />
                                <input
                                  value={bdConfig.blogPostsPath}
                                  onChange={(event) => setBdConfig((prev) => ({ ...prev, blogPostsPath: event.target.value }))}
                                  placeholder="Data posts search endpoint (e.g. /api/v2/data_posts/search)"
                                  className="rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2 text-sm text-slate-100 outline-none ring-cyan-300/40 focus:border-cyan-300/40 focus:ring-2"
                                />
                              </div>
                            ) : null}
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
      </section>

      <article className="mt-6 rounded-xl border border-cyan-300/25 bg-cyan-400/8 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-white">Ingest Listings + Blog Posts</h3>
            <p className="text-xs text-slate-300">
              Runs a full DirectoryIQ pull from Brilliant Directories API and blog source paths.
            </p>
          </div>
          <NeonButton onClick={runIngest} disabled={runningIngest || !states.brilliant_directories_api.connected}>
            {runningIngest ? "Ingesting..." : "Ingest All"}
          </NeonButton>
        </div>

        <div className="mt-3 space-y-2">
          {runs.length === 0 ? (
            <div className="text-xs text-slate-400">No ingest runs recorded yet.</div>
          ) : (
            runs.slice(0, 5).map((run) => (
              <div key={run.id} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-slate-300">
                {run.status.toUpperCase()} · Listings {run.listings_count} · Blog posts {run.blog_posts_count}
                {run.error_message ? ` · Error: ${run.error_message}` : ""}
              </div>
            ))
          )}
        </div>
      </article>
    </>
  );
}
