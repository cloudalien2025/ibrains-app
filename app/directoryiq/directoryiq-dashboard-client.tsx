"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import HudCard from "@/components/ecomviper/HudCard";
import DirectoryIqTopNav from "@/components/directoryiq/DirectoryIqTopNav";
import ConnectPanel from "@/components/connect/ConnectPanel";
import SnapshotCard from "@/components/snapshots/SnapshotCard";
import SnapshotStatusStrip from "@/components/snapshots/SnapshotStatusStrip";
import {
  type SnapshotResponse,
  metricTemplate,
  isSnapshotStale,
  type SnapshotStatus,
} from "@/lib/snapshots/types";

type DashboardResponse = {
  connected: boolean;
  readiness: number;
  pillars: {
    structure: number;
    clarity: number;
    trust: number;
    authority: number;
    actionability: number;
  };
  listings: Array<{
    listing_id: string;
    listing_name: string;
    score: number;
    authority_status: string;
    trust_status: string;
    last_optimized: string | null;
  }>;
  vertical_detected: string;
  vertical_override: string | null;
  last_analyzed_at: string | null;
  progress_messages: string[];
};

const EMPTY: DashboardResponse = {
  connected: false,
  readiness: 0,
  pillars: { structure: 0, clarity: 0, trust: 0, authority: 0, actionability: 0 },
  listings: [],
  vertical_detected: "general",
  vertical_override: null,
  last_analyzed_at: null,
  progress_messages: [],
};

const EMPTY_SNAPSHOT: SnapshotResponse = {
  brain_id: "directoryiq",
  status: "needs_connection",
  updated_at: null,
  connection_type: null,
  metrics: metricTemplate("directoryiq", "loading"),
  hints: [],
  last_error: null,
};

function asFiniteNumber(value: unknown, fallback = 0): number {
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function normalizeDashboardResponse(value: unknown): DashboardResponse {
  if (!value || typeof value !== "object") return EMPTY;
  const raw = value as Record<string, unknown>;
  const rawPillars = raw.pillars && typeof raw.pillars === "object" ? (raw.pillars as Record<string, unknown>) : {};
  const listings = Array.isArray(raw.listings) ? raw.listings : [];
  return {
    connected: Boolean(raw.connected),
    readiness: asFiniteNumber(raw.readiness, 0),
    pillars: {
      structure: asFiniteNumber(rawPillars.structure, 0),
      clarity: asFiniteNumber(rawPillars.clarity, 0),
      trust: asFiniteNumber(rawPillars.trust, 0),
      authority: asFiniteNumber(rawPillars.authority, 0),
      actionability: asFiniteNumber(rawPillars.actionability, 0),
    },
    listings: listings
      .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
      .map((item) => ({
        listing_id: String(item.listing_id ?? ""),
        listing_name: String(item.listing_name ?? "Unknown listing"),
        score: asFiniteNumber(item.score, 0),
        authority_status: String(item.authority_status ?? "unknown"),
        trust_status: String(item.trust_status ?? "unknown"),
        last_optimized: typeof item.last_optimized === "string" ? item.last_optimized : null,
      })),
    vertical_detected: typeof raw.vertical_detected === "string" ? raw.vertical_detected : "general",
    vertical_override: typeof raw.vertical_override === "string" ? raw.vertical_override : null,
    last_analyzed_at: typeof raw.last_analyzed_at === "string" ? raw.last_analyzed_at : null,
    progress_messages: Array.isArray(raw.progress_messages)
      ? raw.progress_messages.filter((entry): entry is string => typeof entry === "string")
      : [],
  };
}

function normalizeSnapshotResponse(value: unknown): SnapshotResponse {
  if (!value || typeof value !== "object") return EMPTY_SNAPSHOT;
  const raw = value as Record<string, unknown>;
  const metrics = Array.isArray(raw.metrics) ? raw.metrics : metricTemplate("directoryiq", "loading");
  const status = raw.status;
  const normalizedStatus: SnapshotStatus =
    status === "up_to_date" || status === "updating" || status === "needs_connection" || status === "error"
      ? status
      : "needs_connection";

  return {
    brain_id: "directoryiq",
    status: normalizedStatus,
    updated_at: typeof raw.updated_at === "string" ? raw.updated_at : null,
    connection_type: raw.connection_type === "bd" || raw.connection_type === "shopify" || raw.connection_type === "sitemap"
      ? raw.connection_type
      : null,
    metrics: metrics
      .filter((metric): metric is Record<string, unknown> => Boolean(metric && typeof metric === "object"))
      .map((metric) => ({
        key: String(metric.key ?? "unknown"),
        label: String(metric.label ?? "Metric"),
        value:
          typeof metric.value === "string" || typeof metric.value === "number"
            ? metric.value
            : metric.value == null
              ? null
            : String(metric.value),
        unit: typeof metric.unit === "string" ? metric.unit : undefined,
        state: metric.state === "ready" || metric.state === "loading" || metric.state === "stale" ? metric.state : "loading",
      })),
    hints: Array.isArray(raw.hints) ? raw.hints.filter((entry): entry is string => typeof entry === "string") : [],
    last_error: typeof raw.last_error === "string" ? raw.last_error : null,
  };
}

function humanizeState(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function PillarBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs text-slate-300">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-800">
        <div className="h-full rounded-full bg-cyan-300/80" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}

export default function DirectoryIqDashboardClient() {
  const [data, setData] = useState<DashboardResponse>(EMPTY);
  const [snapshot, setSnapshot] = useState<SnapshotResponse>(EMPTY_SNAPSHOT);
  const [loading, setLoading] = useState(true);
  const [snapshotLoading, setSnapshotLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progressIndex, setProgressIndex] = useState(0);
  const [bdBaseUrl, setBdBaseUrl] = useState("");
  const [bdApiKey, setBdApiKey] = useState("");
  const [sitemapDomain, setSitemapDomain] = useState("");
  const [sitemapOverride, setSitemapOverride] = useState("");
  const [useDecodo, setUseDecodo] = useState(false);
  const [respectRobots, setRespectRobots] = useState(true);
  const [submittingBd, setSubmittingBd] = useState(false);
  const [submittingSitemap, setSubmittingSitemap] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [connectedSiteId, setConnectedSiteId] = useState<string | null>(null);
  const [progressMessage, setProgressMessage] = useState<string | null>(null);

  const connected = snapshot.status !== "needs_connection" || data.connected;

  const progressLabel = useMemo(() => {
    if (!loading && !analyzing) return null;
    if (progressMessage) return progressMessage;
    if (!data.progress_messages.length) return "Evaluating selection signals...";
    return data.progress_messages[progressIndex % data.progress_messages.length];
  }, [analyzing, data.progress_messages, loading, progressIndex, progressMessage]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/directoryiq/dashboard", { cache: "no-store" });
      const json = (await response.json()) as DashboardResponse & { error?: string };
      if (!response.ok) throw new Error(json.error ?? "Failed to load DirectoryIQ dashboard");
      setData(normalizeDashboardResponse(json));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown dashboard error");
      setData(EMPTY);
    } finally {
      setLoading(false);
    }
  }

  async function loadSnapshot() {
    setSnapshotLoading(true);
    try {
      const response = await fetch("/api/directoryiq/snapshot", { cache: "no-store" });
      const json = (await response.json()) as SnapshotResponse & { error?: string };
      if (!response.ok) throw new Error(json.error ?? "Failed to load snapshot");
      const normalized = normalizeSnapshotResponse(json);
      setSnapshot(normalized);
      return normalized;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown snapshot error");
      setSnapshot(EMPTY_SNAPSHOT);
      return null;
    } finally {
      setSnapshotLoading(false);
    }
  }

  async function refreshSnapshot() {
    try {
      await fetch("/api/directoryiq/snapshot/refresh", { method: "POST" });
    } catch {
      // Keep local snapshot shell visible even when refresh trigger fails.
    }
    setSnapshot((prev) => ({
      ...prev,
      status: "updating",
      metrics: prev.metrics.map((metric) => ({
        ...metric,
        state: metric.value == null ? "loading" : "stale",
      })),
    }));
  }

  function startPolling(siteId?: string | null) {
    const startedAt = Date.now();
    const timer = setInterval(async () => {
      const next = await loadSnapshot();
      const currentSiteId = siteId ?? connectedSiteId;
      if (currentSiteId) {
        try {
          const statusRes = await fetch(`/api/connect/sitemap/status?connected_site_id=${encodeURIComponent(currentSiteId)}`, { cache: "no-store" });
          const statusJson = (await statusRes.json()) as { progress_message?: string; status?: string; last_error?: string };
          if (statusRes.ok) {
            setProgressMessage(statusJson.progress_message ?? "Analyzing...");
            if (statusJson.status === "error" && statusJson.last_error) setError(statusJson.last_error);
          }
        } catch {
          // Keep polling snapshot.
        }
      }
      if (!next) return;
      const done = next.status === "up_to_date" || next.status === "error";
      const timedOut = Date.now() - startedAt > 180_000;
      if (done || timedOut) {
        clearInterval(timer);
        setAnalyzing(false);
        setConnectedSiteId(null);
      }
    }, 1500);
    return () => clearInterval(timer);
  }

  async function handleBdConnect() {
    setSubmittingBd(true);
    setError(null);
    setProgressMessage("Connecting Brilliant Directories...");
    try {
      const response = await fetch("/api/directoryiq/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base_url: bdBaseUrl, api_key: bdApiKey }),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error ?? "Unable to connect Brilliant Directories.");
      setAnalyzing(true);
      await refreshSnapshot();
      startPolling();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown connect error");
      setAnalyzing(false);
    } finally {
      setSubmittingBd(false);
    }
  }

  async function handleSitemapConnect() {
    setSubmittingSitemap(true);
    setError(null);
    setProgressMessage("Discovering sitemap...");
    try {
      const response = await fetch("/api/connect/sitemap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brain_id: "directoryiq",
          base_url: sitemapDomain.trim(),
          sitemap_url_override: sitemapOverride.trim() || null,
          use_decodo: useDecodo,
          respect_robots: respectRobots,
        }),
      });
      const json = (await response.json()) as { connected_site_id?: string; error?: string };
      if (!response.ok || !json.connected_site_id) {
        throw new Error(json.error ?? "Unable to start sitemap connection.");
      }
      setConnectedSiteId(json.connected_site_id);
      setAnalyzing(true);
      await refreshSnapshot();
      startPolling(json.connected_site_id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown sitemap connect error");
      setAnalyzing(false);
    } finally {
      setSubmittingSitemap(false);
    }
  }

  async function refreshAnalysis() {
    try {
      await fetch("/api/directoryiq/dashboard", { method: "POST" });
    } catch {
      // Continue to load best-effort state.
    }
    await load();
  }

  async function saveVerticalOverride(next: string | null) {
    try {
      await fetch("/api/directoryiq/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vertical_override: next,
          risk_tier_overrides: {},
          image_style_preference: "editorial clean",
        }),
      });
    } catch {
      setError("Unable to save vertical override right now.");
      return;
    }
    await load();
  }

  useEffect(() => {
    void load();
    void loadSnapshot();
  }, []);

  useEffect(() => {
    if (!loading && !analyzing) return;
    const timer = setInterval(() => setProgressIndex((value) => value + 1), 1200);
    return () => clearInterval(timer);
  }, [analyzing, loading]);

  useEffect(() => {
    if (!snapshotLoading && connected && (snapshot.status === "updating" || isSnapshotStale(snapshot.updated_at))) {
      void refreshSnapshot();
      const stop = startPolling();
      return stop;
    }
    return undefined;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshotLoading, connected]);

  const statusForStrip = useMemo<SnapshotStatus>(() => {
    if (analyzing && connected) return "updating";
    return snapshot.status;
  }, [analyzing, connected, snapshot.status]);

  return (
    <>
      <section className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
        <h1 className="text-xl font-semibold text-slate-100">DirectoryIQ Dashboard</h1>
        <p className="mt-1 text-sm text-slate-300">
          Monitor site readiness and move one listing at a time into optimization.
        </p>
      </section>

      <SnapshotStatusStrip
        connected={connected}
        status={statusForStrip}
        updatedAt={snapshot.updated_at}
        connectionType={snapshot.connection_type ?? null}
      />

      {!connected ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <ConnectPanel
            title="Connect your Brilliant Directories Website"
            subtitle="Primary integration for listings and authority support publishing."
            buttonLabel="Connect your Brilliant Directories Website"
            onSubmit={handleBdConnect}
            submitting={submittingBd}
            error={error}
          >
            <input
              value={bdBaseUrl}
              onChange={(event) => setBdBaseUrl(event.target.value)}
              placeholder="https://example.com"
              className="w-full rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2.5 text-sm text-slate-100 outline-none ring-cyan-300/40 transition focus:border-cyan-300/40 focus:ring-2"
            />
            <input
              value={bdApiKey}
              onChange={(event) => setBdApiKey(event.target.value)}
              placeholder="Brilliant Directories API key"
              className="w-full rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2.5 text-sm text-slate-100 outline-none ring-cyan-300/40 transition focus:border-cyan-300/40 focus:ring-2"
            />
          </ConnectPanel>

          <ConnectPanel
            title="Connect Website via Sitemap"
            subtitle="Any website ingestion via sitemap discovery, bounded crawl, and schema extraction."
            buttonLabel="Connect Website"
            onSubmit={handleSitemapConnect}
            submitting={submittingSitemap}
            error={error}
          >
            <input
              value={sitemapDomain}
              onChange={(event) => setSitemapDomain(event.target.value)}
              placeholder="example.com"
              className="w-full rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2.5 text-sm text-slate-100 outline-none ring-cyan-300/40 transition focus:border-cyan-300/40 focus:ring-2"
            />
            <input
              value={sitemapOverride}
              onChange={(event) => setSitemapOverride(event.target.value)}
              placeholder="Optional sitemap URL override"
              className="w-full rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2.5 text-sm text-slate-100 outline-none ring-cyan-300/40 transition focus:border-cyan-300/40 focus:ring-2"
            />
            <label className="flex items-center gap-2 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={useDecodo}
                onChange={(event) => setUseDecodo(event.target.checked)}
                className="h-4 w-4 rounded border-white/30 bg-slate-900"
              />
              Use Decodo proxies (recommended for reliability)
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={respectRobots}
                onChange={(event) => {
                  const next = event.target.checked;
                  if (!next) {
                    const confirmed = window.confirm("Disable robots.txt respect? This may violate site crawling rules.");
                    if (!confirmed) return;
                  }
                  setRespectRobots(next);
                }}
                className="h-4 w-4 rounded border-white/30 bg-slate-900"
              />
              Respect robots.txt
            </label>
          </ConnectPanel>
        </div>
      ) : null}

      {connected ? (
        <SnapshotCard
          title="AI Travel Agent Discovery Snapshot"
          snapshot={snapshot}
          ctaLabel="Select a Listing to Optimize"
          ctaHref="/directoryiq/listings"
        />
      ) : null}

      {analyzing ? (
        <HudCard title="Analyzing..." subtitle="Snapshot shell is live. Metrics fill progressively while signals are extracted.">
          <div className="text-sm text-slate-200">{progressLabel}</div>
        </HudCard>
      ) : null}

      {connected ? (
        <>
      <DirectoryIqTopNav
        connected={data.connected}
        verticalDetected={data.vertical_detected}
        verticalOverride={data.vertical_override}
        lastAnalyzedAt={data.last_analyzed_at}
        onRefresh={refreshAnalysis}
        onVerticalOverride={saveVerticalOverride}
      />

      <HudCard title="AI Agent Selection Readiness" subtitle="Site-level read-only snapshot">
        <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
          <div className="rounded-xl border border-cyan-300/20 bg-slate-900/60 p-4 text-center">
            <div className="text-xs uppercase tracking-[0.14em] text-slate-400">Readiness Score</div>
            <div className="mt-3 text-5xl font-semibold text-cyan-100">{data.readiness}</div>
            <div className="mt-1 text-xs text-slate-400">0-100</div>
          </div>

          <div className="space-y-3">
            <PillarBar label="Structure" value={data.pillars.structure} />
            <PillarBar label="Clarity" value={data.pillars.clarity} />
            <PillarBar label="Trust" value={data.pillars.trust} />
            <PillarBar label="Authority" value={data.pillars.authority} />
            <PillarBar label="Actionability" value={data.pillars.actionability} />
          </div>
        </div>

        {loading ? <div className="mt-4 text-sm text-cyan-200">{progressLabel}</div> : null}
        {error ? <div className="mt-4 text-sm text-rose-200">{error}</div> : null}
      </HudCard>

      <HudCard title="Listings" subtitle="Per-listing optimization only. No bulk updates.">
        {data.listings.length === 0 ? (
          <div className="text-sm text-slate-300">No listings found yet. Connect and refresh analysis.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.08em] text-slate-400">
                <tr>
                  <th className="py-2 pr-3">Listing</th>
                  <th className="py-2 pr-3">Score</th>
                  <th className="py-2 pr-3">Authority</th>
                  <th className="py-2 pr-3">Trust</th>
                  <th className="py-2 pr-3">Last optimized</th>
                  <th className="py-2 pr-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {data.listings.map((listing) => (
                  <tr key={listing.listing_id} className="border-t border-white/10">
                    <td className="py-2 pr-3 text-slate-100">{listing.listing_name}</td>
                    <td className="py-2 pr-3">{listing.score}</td>
                    <td className="py-2 pr-3">{humanizeState(listing.authority_status)}</td>
                    <td className="py-2 pr-3">{humanizeState(listing.trust_status)}</td>
                    <td className="py-2 pr-3">{listing.last_optimized ? new Date(listing.last_optimized).toLocaleString() : "-"}</td>
                    <td className="py-2 pr-3">
                      <Link
                        href={`/directoryiq/listings/${encodeURIComponent(listing.listing_id)}`}
                        className="rounded-lg border border-cyan-300/30 bg-cyan-400/10 px-3 py-1.5 text-xs text-cyan-100"
                      >
                        Optimize
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </HudCard>
      </>
      ) : null}
    </>
  );
}
