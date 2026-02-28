"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import NeonButton from "@/components/ecomviper/NeonButton";
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

export default function DirectoryIqSignalSourcesClient() {
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
    listingsPath: "/wp-json/brilliantdirectories/v1/listings",
    blogPostsPath: "/wp-json/wp/v2/posts",
  });

  const orderedConnectors = useMemo(
    () => ["brilliant_directories_api", "openai", "serpapi", "ga4"] as DirectoryIqConnector[],
    []
  );

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
      setNotice(`${connectorMeta[connectorId].name} credential saved.`);
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
      setNotice(`${connectorMeta[connectorId].name} credential removed.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown delete error");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div id="credentials" className="space-y-4">
      {notice ? (
        <div className="rounded-xl border border-emerald-300/35 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
          {notice}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-xl border border-rose-300/35 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      {orderedConnectors.map((connectorId) => {
        const state = states[connectorId];
        const isActive = selectedConnector === connectorId;

        return (
          <article
            key={connectorId}
            className={`rounded-xl border p-4 ${
              isActive
                ? "border-cyan-300/45 bg-cyan-400/10"
                : "border-white/10 bg-white/[0.03]"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-white">{connectorMeta[connectorId].name}</h3>
                <p className="text-xs text-slate-400">
                  {state.connected
                    ? `Connected (${state.masked_secret})${state.updated_at ? ` · Saved ${new Date(state.updated_at).toLocaleString()}` : ""}`
                    : "Disconnected"}
                </p>
                {state.label ? <p className="text-xs text-slate-500">Label: {state.label}</p> : null}
              </div>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto]">
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
                disabled={saving === connectorId || !state.connected}
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
                  placeholder="Listings path"
                  className="rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2 text-sm text-slate-100 outline-none ring-cyan-300/40 focus:border-cyan-300/40 focus:ring-2"
                />
                <input
                  value={bdConfig.blogPostsPath}
                  onChange={(event) => setBdConfig((prev) => ({ ...prev, blogPostsPath: event.target.value }))}
                  placeholder="Blog posts path"
                  className="rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2 text-sm text-slate-100 outline-none ring-cyan-300/40 focus:border-cyan-300/40 focus:ring-2"
                />
              </div>
            ) : null}
          </article>
        );
      })}

      <article className="rounded-xl border border-cyan-300/25 bg-cyan-400/8 p-4">
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
    </div>
  );
}
