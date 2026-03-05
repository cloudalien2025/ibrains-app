"use client";

import { useState } from "react";
import AuthoritySectionNav from "@/app/(brains)/directoryiq/authority/_components/authority-section-nav";
import HudCard from "@/components/ecomviper/HudCard";
import NeonButton from "@/components/ecomviper/NeonButton";

type Summary = {
  orphan_listings_count: number;
  leaks_count: number;
  missing_backlinks_count: number;
  avg_anchor_diversity: number;
  last_computed_at: string | null;
};

type BacklinkCandidate = {
  listing_id: string;
  blog_url: string;
  status: string;
};

type LeakRow = {
  blog_url: string | null;
  listing_url: string | null;
  listing_id: string;
};

type IntegrityClientProps = {
  tenantId: string;
  summary: Summary;
  backlinkCandidates: BacklinkCandidate[];
  leaks: LeakRow[];
};

export default function IntegrityClient({ tenantId, summary, backlinkCandidates, leaks }: IntegrityClientProps) {
  const [currentSummary, setCurrentSummary] = useState(summary);
  const [currentBacklinks, setCurrentBacklinks] = useState(backlinkCandidates);
  const [currentLeaks, setCurrentLeaks] = useState(leaks);
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runIntegrityCheck() {
    setRunning(true);
    setNotice(null);
    setError(null);

    try {
      const response = await fetch("/api/directoryiq/graph-integrity/rebuild", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, mode: "dry_run" }),
      });
      const json = (await response.json()) as { ok?: boolean; error?: { message?: string } };
      if (!response.ok || !json.ok) {
        throw new Error(json.error?.message ?? "Integrity check failed");
      }

      const summaryRes = await fetch(`/api/directoryiq/graph-integrity/summary?tenantId=${encodeURIComponent(tenantId)}`);
      const summaryJson = (await summaryRes.json()) as {
        ok?: boolean;
        summary?: Summary;
        backlinkCandidates?: BacklinkCandidate[];
        leaks?: LeakRow[];
      };
      if (summaryRes.ok && summaryJson.ok) {
        setCurrentSummary(summaryJson.summary ?? currentSummary);
        setCurrentBacklinks(summaryJson.backlinkCandidates ?? []);
        setCurrentLeaks(summaryJson.leaks ?? []);
      }

      setNotice("Integrity check completed (dry run). Updated summary loaded.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Integrity check failed");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
        <h1 className="text-xl font-semibold text-slate-100">Authority Integrity</h1>
        <p className="mt-1 text-sm text-slate-300">
          Deterministic backlink compliance and authority leak enforcement signals.
        </p>
      </section>

      <AuthoritySectionNav />

      {notice ? <div className="rounded-xl border border-emerald-300/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">{notice}</div> : null}
      {error ? <div className="rounded-xl border border-rose-300/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">{error}</div> : null}

      <HudCard
        title="Integrity Summary"
        subtitle={`Anchor diversity avg ${currentSummary.avg_anchor_diversity}% · Last computed ${currentSummary.last_computed_at ?? "n/a"}`}
        actions={
          <NeonButton onClick={() => void runIntegrityCheck()} disabled={running}>
            {running ? "Running..." : "Run Integrity Check"}
          </NeonButton>
        }
      >
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <div className="text-xs text-slate-400">Orphan Listings</div>
            <div className="mt-1 text-2xl font-semibold text-slate-100">{currentSummary.orphan_listings_count}</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <div className="text-xs text-slate-400">Missing Backlinks</div>
            <div className="mt-1 text-2xl font-semibold text-slate-100">{currentSummary.missing_backlinks_count}</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <div className="text-xs text-slate-400">Authority Leaks</div>
            <div className="mt-1 text-2xl font-semibold text-slate-100">{currentSummary.leaks_count}</div>
          </div>
        </div>
      </HudCard>

      <HudCard title="Listings Missing Backlinks" subtitle="Top 20 listings that need backlink reinforcement.">
        {currentBacklinks.length === 0 ? (
          <div className="text-sm text-slate-300">No missing backlinks detected.</div>
        ) : (
          <div className="space-y-2 text-sm">
            {currentBacklinks.map((row) => (
              <div key={`${row.listing_id}-${row.blog_url}`} className="rounded-lg border border-white/10 bg-white/[0.03] p-2">
                <div className="text-slate-100">Listing {row.listing_id}</div>
                <div className="text-xs text-slate-400">Blog: {row.blog_url}</div>
              </div>
            ))}
          </div>
        )}
      </HudCard>

      <HudCard title="Authority Leaks" subtitle="Top 20 unlinked mentions.">
        {currentLeaks.length === 0 ? (
          <div className="text-sm text-slate-300">No authority leaks detected.</div>
        ) : (
          <div className="space-y-2 text-sm">
            {currentLeaks.map((row) => (
              <div key={`${row.listing_id}-${row.blog_url ?? "unknown"}`} className="rounded-lg border border-white/10 bg-white/[0.03] p-2">
                <div className="text-slate-100">Listing {row.listing_id}</div>
                <div className="text-xs text-slate-400">Blog: {row.blog_url ?? "unknown"}</div>
              </div>
            ))}
          </div>
        )}
      </HudCard>
    </div>
  );
}
