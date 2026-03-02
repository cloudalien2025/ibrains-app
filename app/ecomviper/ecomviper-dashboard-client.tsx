"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import TopBar from "@/components/ecomviper/TopBar";
import ConnectPanel from "@/components/connect/ConnectPanel";
import SnapshotCard from "@/components/snapshots/SnapshotCard";
import SnapshotStatusStrip from "@/components/snapshots/SnapshotStatusStrip";
import HudCard from "@/components/ecomviper/HudCard";
import {
  type SnapshotResponse,
  isSnapshotStale,
  metricTemplate,
  type SnapshotStatus,
} from "@/lib/snapshots/types";

const EMPTY_SNAPSHOT: SnapshotResponse = {
  brain_id: "ecomviper",
  status: "needs_connection",
  updated_at: null,
  metrics: metricTemplate("ecomviper", "loading"),
  hints: [],
  last_error: null,
};

export default function EcomViperDashboardClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [shopDomain, setShopDomain] = useState("");
  const [siteDomain, setSiteDomain] = useState("");
  const [sitemapOverride, setSitemapOverride] = useState("");
  const [useDecodo, setUseDecodo] = useState(false);
  const [respectRobots, setRespectRobots] = useState(true);
  const [sitemapConnecting, setSitemapConnecting] = useState(false);
  const [connectedSiteId, setConnectedSiteId] = useState<string | null>(null);
  const [progressMessage, setProgressMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<SnapshotResponse>(EMPTY_SNAPSHOT);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const connected = snapshot.status !== "needs_connection";

  function clearPolling() {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }

  async function loadSnapshot(): Promise<SnapshotResponse | null> {
    try {
      const response = await fetch("/api/ecomviper/snapshot", { cache: "no-store" });
      const json = (await response.json()) as SnapshotResponse & { error?: string };
      if (!response.ok) throw new Error(json.error ?? "Failed to load snapshot");
      setSnapshot(json);
      return json;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown snapshot error");
      return null;
    }
  }

  function startPolling(siteId?: string | null) {
    clearPolling();
    const startedAt = Date.now();
    pollTimerRef.current = setInterval(async () => {
      const next = await loadSnapshot();
      if (!next) return;

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
          // Keep polling snapshot even if status endpoint intermittently fails.
        }
      }

      const done = next.status === "up_to_date" || next.status === "error";
      const timedOut = Date.now() - startedAt > 180_000;
      if (done || timedOut) {
        clearPolling();
        setAnalyzing(false);
        setConnectedSiteId(null);
      }
    }, 1500);
  }

  async function refreshSnapshot() {
    await fetch("/api/ecomviper/snapshot/refresh", { method: "POST" });
    setSnapshot((prev) => ({
      ...prev,
      status: "updating",
      metrics: prev.metrics.map((metric) => ({
        ...metric,
        state: metric.value == null ? "loading" : "stale",
      })),
    }));
  }

  function normalizeHostname(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/\/.*$/, "")
      .replace(/\.$/, "");
  }

  async function handleConnect() {
    setSubmitting(true);
    setError(null);

    try {
      const normalized = normalizeHostname(shopDomain);
      if (!normalized) throw new Error("Enter your Shopify domain first.");

      const response = await fetch(
        `/api/auth/shopify/start?shop=${encodeURIComponent(normalized)}&dry_run=1`,
        { method: "GET" }
      );
      const json = (await response.json()) as { redirect_to?: string; error?: string };
      if (!response.ok || !json.redirect_to) {
        throw new Error(json.error ?? "Unable to start Shopify connection.");
      }

      window.location.href = json.redirect_to;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown connect error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSitemapConnect() {
    setSitemapConnecting(true);
    setError(null);
    setProgressMessage("Discovering sitemap...");
    try {
      if (!siteDomain.trim()) throw new Error("Enter a website domain first.");

      const response = await fetch("/api/connect/sitemap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brain_id: "ecomviper",
          base_url: siteDomain.trim(),
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
      setSitemapConnecting(false);
    }
  }

  useEffect(() => {
    void (async () => {
      const first = await loadSnapshot();
      if (!first) return;

      const justConnected = searchParams.get("connected") === "1";
      if (justConnected) {
        setAnalyzing(true);
        await refreshSnapshot();
        startPolling();

        const params = new URLSearchParams(searchParams.toString());
        params.delete("connected");
        params.delete("shop");
        params.delete("error");
        const nextQuery = params.toString();
        router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
        return;
      }

      if (first.status === "needs_connection") return;
      if (first.status === "updating" || isSnapshotStale(first.updated_at)) {
        await refreshSnapshot();
        startPolling();
      }
    })();

    return () => clearPolling();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const statusForStrip = useMemo<SnapshotStatus>(() => {
    if (analyzing && snapshot.status !== "needs_connection") return "updating";
    return snapshot.status;
  }, [analyzing, snapshot.status]);

  return (
    <>
      <TopBar
        breadcrumbs={["Home", "EcomViper", "AI Product Selection Engine"]}
        searchPlaceholder="Search product entity, signal, or selection blueprint..."
      />

      <SnapshotStatusStrip
        connected={connected}
        status={statusForStrip}
        updatedAt={snapshot.updated_at}
        connectionType={snapshot.connection_type ?? null}
      />

      {!connected ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <ConnectPanel
            title="Connect your Shopify Store"
            subtitle="Primary flow for full catalog + order-aware product signal discovery."
            buttonLabel="Connect your Shopify Store"
            onSubmit={handleConnect}
            submitting={submitting}
            error={error}
          >
            <input
              value={shopDomain}
              onChange={(event) => setShopDomain(event.target.value)}
              placeholder="yourstore.myshopify.com"
              className="w-full rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2.5 text-sm text-slate-100 outline-none ring-cyan-300/40 transition focus:border-cyan-300/40 focus:ring-2"
            />
          </ConnectPanel>

          <ConnectPanel
            title="Connect Website via Sitemap"
            subtitle="Works on any website. Sitemap discovery + bounded page signal extraction."
            buttonLabel="Connect Website"
            onSubmit={handleSitemapConnect}
            submitting={sitemapConnecting}
            error={error}
          >
            <input
              value={siteDomain}
              onChange={(event) => setSiteDomain(event.target.value)}
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

      {analyzing ? (
        <HudCard title="Analyzing..." subtitle="Your snapshot shell is ready. Metrics will fill in as results arrive.">
          <div className="text-sm text-slate-200">{progressMessage ?? "Building AI discovery snapshot..."}</div>
        </HudCard>
      ) : null}

      {connected ? (
        <SnapshotCard
          title="AI Product Agent Discovery Snapshot"
          snapshot={snapshot}
          ctaLabel="Select a Product to Optimize"
          ctaHref="/ecomviper/products"
        />
      ) : null}
    </>
  );
}
