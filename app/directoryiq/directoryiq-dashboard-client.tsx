"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  brain_id: "directoryiq",
  status: "needs_connection",
  updated_at: null,
  metrics: metricTemplate("directoryiq", "loading"),
  hints: [],
  last_error: null,
};

export default function DirectoryIqDashboardClient({ userLabel }: { userLabel: string }) {
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
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
      const response = await fetch("/api/directoryiq/snapshot", { cache: "no-store" });
      const json = (await response.json()) as SnapshotResponse & { error?: string };
      if (!response.ok) throw new Error(json.error ?? "Failed to load snapshot");
      setSnapshot(json);
      return json;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown snapshot error");
      return null;
    }
  }

  function startPolling() {
    clearPolling();
    const startedAt = Date.now();
    pollTimerRef.current = setInterval(async () => {
      const next = await loadSnapshot();
      if (!next) return;

      const done = next.status === "up_to_date" || next.status === "error";
      const timedOut = Date.now() - startedAt > 20_000;
      if (done || timedOut) {
        clearPolling();
        setAnalyzing(false);
      }
    }, 1500);
  }

  async function refreshSnapshot() {
    await fetch("/api/directoryiq/snapshot/refresh", { method: "POST" });
    setSnapshot((prev) => ({
      ...prev,
      status: "updating",
      metrics: prev.metrics.map((metric) => ({
        ...metric,
        state: metric.value == null ? "loading" : "stale",
      })),
    }));
  }

  async function handleConnect() {
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/directoryiq/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base_url: websiteUrl, api_key: apiKey }),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error ?? "Failed to connect website");

      setAnalyzing(true);
      setSnapshot((prev) => ({
        ...prev,
        status: "updating",
        metrics: metricTemplate("directoryiq", "loading"),
      }));

      setTimeout(() => {
        void loadSnapshot();
        startPolling();
      }, 1200);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown connection error");
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    void (async () => {
      const first = await loadSnapshot();
      if (!first) return;
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
        breadcrumbs={["Home", "DirectoryIQ", "AI Travel Selection Engine"]}
        searchPlaceholder="Search travel entity, surface, or authority blueprint..."
        userLabel={userLabel}
      />

      <SnapshotStatusStrip connected={connected} status={statusForStrip} updatedAt={snapshot.updated_at} />

      {!connected ? (
        <ConnectPanel
          title="Connect your Brilliant Directories Website"
          subtitle="Add your website URL and key so we can start your snapshot automatically."
          buttonLabel="Connect your Brilliant Directories Website"
          onSubmit={handleConnect}
          submitting={submitting}
          error={error}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              value={websiteUrl}
              onChange={(event) => setWebsiteUrl(event.target.value)}
              placeholder="yourdomain.com"
              className="rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2.5 text-sm text-slate-100 outline-none ring-cyan-300/40 transition focus:border-cyan-300/40 focus:ring-2"
            />
            <input
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder="Paste your API key"
              type="password"
              className="rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2.5 text-sm text-slate-100 outline-none ring-cyan-300/40 transition focus:border-cyan-300/40 focus:ring-2"
            />
          </div>
        </ConnectPanel>
      ) : null}

      {analyzing ? (
        <HudCard title="Analyzing..." subtitle="Your snapshot shell is ready. Metrics will fill in as results arrive.">
          <div className="h-1" />
        </HudCard>
      ) : null}

      {connected ? (
        <SnapshotCard
          title="AI Travel Agent Discovery Snapshot"
          snapshot={snapshot}
          ctaLabel="Select a Listing to Optimize"
          ctaHref="/directoryiq/listings"
        />
      ) : null}
    </>
  );
}
