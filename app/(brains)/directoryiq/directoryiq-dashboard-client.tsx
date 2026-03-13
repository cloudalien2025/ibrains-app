"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import HudCard from "@/components/ecomviper/HudCard";
import DirectoryIqTopNav from "@/components/directoryiq/DirectoryIqTopNav";
import { deriveDashboardUiState } from "./dashboard-client-state";
import {
  resolveDashboardListingCategory,
  sortDashboardListings,
  toggleDashboardListingsSort,
  type DashboardListingRow,
  type DashboardListingsSort,
  type DashboardListingsSortKey,
} from "./dashboard-listings-table-model";

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
  listings: DashboardListingRow[];
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
  const [sort, setSort] = useState<DashboardListingsSort | null>(null);

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

  const visibleListings = useMemo(() => sortDashboardListings(data?.listings ?? [], sort), [data?.listings, sort]);

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

  function handleSort(key: DashboardListingsSortKey) {
    setSort((current) => toggleDashboardListingsSort(current, key));
  }

  function renderSortIndicator(key: DashboardListingsSortKey): string {
    if (sort?.key !== key) return "↕";
    return sort.direction === "asc" ? "↑" : "↓";
  }

  function renderAriaSort(key: DashboardListingsSortKey): "none" | "ascending" | "descending" {
    if (sort?.key !== key) return "none";
    return sort.direction === "asc" ? "ascending" : "descending";
  }

  return (
    <>
      <section className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
        <h1 className="text-xl font-semibold text-slate-100">AI Visibility Dashboard</h1>
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

      <HudCard title="AI Selection Readiness" subtitle="Site-level snapshot">
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

      <HudCard title="Listings" subtitle="Improve AI visibility one listing at a time.">
        {uiState.showListingsZeroState ? (
          <div className="text-sm text-slate-300">No listings found yet. Connect and refresh analysis.</div>
        ) : null}
        {uiState.showListingsTable && data ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.08em] text-slate-400">
                <tr>
                  <th className="py-2 pr-3" aria-sort={renderAriaSort("listing")}>
                    <button type="button" className="inline-flex items-center gap-1" onClick={() => handleSort("listing")}>
                      Listing <span aria-hidden="true">{renderSortIndicator("listing")}</span>
                    </button>
                  </th>
                  <th className="py-2 pr-3" aria-sort={renderAriaSort("category")}>
                    <button type="button" className="inline-flex items-center gap-1" onClick={() => handleSort("category")}>
                      Category <span aria-hidden="true">{renderSortIndicator("category")}</span>
                    </button>
                  </th>
                  <th className="py-2 pr-3" aria-sort={renderAriaSort("score")}>
                    <button type="button" className="inline-flex items-center gap-1" onClick={() => handleSort("score")}>
                      Score <span aria-hidden="true">{renderSortIndicator("score")}</span>
                    </button>
                  </th>
                  <th className="py-2 pr-3" aria-sort={renderAriaSort("authority")}>
                    <button type="button" className="inline-flex items-center gap-1" onClick={() => handleSort("authority")}>
                      Authority <span aria-hidden="true">{renderSortIndicator("authority")}</span>
                    </button>
                  </th>
                  <th className="py-2 pr-3" aria-sort={renderAriaSort("trust")}>
                    <button type="button" className="inline-flex items-center gap-1" onClick={() => handleSort("trust")}>
                      Trust <span aria-hidden="true">{renderSortIndicator("trust")}</span>
                    </button>
                  </th>
                  <th className="py-2 pr-3">Last optimized</th>
                  <th className="py-2 pr-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {visibleListings.map((listing) => (
                  <tr key={listing.listing_id} className="border-t border-white/10">
                    <td className="py-2 pr-3 text-slate-100">{listing.listing_name}</td>
                    <td className="py-2 pr-3">{resolveDashboardListingCategory(listing) ?? "-"}</td>
                    <td className="py-2 pr-3">{listing.score}</td>
                    <td className="py-2 pr-3">{humanizeState(listing.authority_status)}</td>
                    <td className="py-2 pr-3">{humanizeState(listing.trust_status)}</td>
                    <td className="py-2 pr-3">{listing.last_optimized ? new Date(listing.last_optimized).toLocaleString() : "-"}</td>
                    <td className="py-2 pr-3">
                      <Link
                        href={`/directoryiq/listings/${encodeURIComponent(listing.listing_id)}`}
                        className="rounded-lg border border-cyan-300/30 bg-cyan-400/10 px-3 py-1.5 text-xs text-cyan-100"
                      >
                          Improve
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
