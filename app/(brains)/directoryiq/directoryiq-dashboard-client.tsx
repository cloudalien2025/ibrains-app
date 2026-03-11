"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import HudCard from "@/components/ecomviper/HudCard";
import DirectoryIqTopNav from "@/components/directoryiq/DirectoryIqTopNav";
import { deriveDashboardUiState } from "./dashboard-client-state";

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
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progressIndex, setProgressIndex] = useState(0);

  const progressLabel = useMemo(() => {
    const progressMessages = data?.progress_messages ?? EMPTY.progress_messages;
    if (!loading) return null;
    if (!progressMessages.length) return "Evaluating selection signals...";
    return progressMessages[progressIndex % progressMessages.length];
  }, [data, loading, progressIndex]);

  const uiState = deriveDashboardUiState({
    hasData: data !== null,
    loading,
    error,
    listingsCount: data?.listings.length ?? 0,
  });

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/directoryiq/dashboard", { cache: "no-store" });
      const json = (await response.json()) as DashboardResponse & { error?: string };
      if (!response.ok) throw new Error(json.error ?? "Failed to load DirectoryIQ dashboard");
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown dashboard error");
    } finally {
      setLoading(false);
    }
  }

  async function refreshAnalysis() {
    await fetch("/api/directoryiq/dashboard", { method: "POST" });
    await load();
  }

  async function saveVerticalOverride(next: string | null) {
    await fetch("/api/directoryiq/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vertical_override: next,
        risk_tier_overrides: {},
        image_style_preference: "editorial clean",
      }),
    });
    await load();
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!loading) return;
    const timer = setInterval(() => setProgressIndex((value) => value + 1), 1200);
    return () => clearInterval(timer);
  }, [loading]);

  return (
    <>
      <section className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
        <h1 className="text-xl font-semibold text-slate-100">DirectoryIQ Dashboard</h1>
        <p className="mt-1 text-sm text-slate-300">
          Monitor site readiness and move one listing at a time into optimization.
        </p>
      </section>

      {data ? (
        <DirectoryIqTopNav
          connected={data.connected}
          verticalDetected={data.vertical_detected}
          verticalOverride={data.vertical_override}
          lastAnalyzedAt={data.last_analyzed_at}
          onRefresh={refreshAnalysis}
          onVerticalOverride={saveVerticalOverride}
        />
      ) : null}

      <HudCard title="AI Agent Selection Readiness" subtitle="Site-level read-only snapshot">
        {uiState.showReadinessMetrics && data ? (
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
        ) : null}

        {uiState.showLoading ? <div className="mt-4 text-sm text-cyan-200">{progressLabel}</div> : null}
        {uiState.showError ? <div className="mt-4 text-sm text-rose-200">{error}</div> : null}
      </HudCard>

      <HudCard title="Listings" subtitle="Per-listing optimization only. No bulk updates.">
        {uiState.showListingsZeroState ? (
          <div className="text-sm text-slate-300">No listings found yet. Connect and refresh analysis.</div>
        ) : null}
        {uiState.showListingsTable && data ? (
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
        ) : null}
        {uiState.showError && !data ? <div className="text-sm text-rose-200">{error}</div> : null}
      </HudCard>
    </>
  );
}
