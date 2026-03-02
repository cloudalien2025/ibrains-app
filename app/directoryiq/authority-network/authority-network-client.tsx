"use client";

import { useEffect, useMemo, useState } from "react";
import HudCard from "@/components/ecomviper/HudCard";
import TopBar from "@/components/ecomviper/TopBar";
import NeonButton from "@/components/ecomviper/NeonButton";

type Summary = {
  networkHealthScore: number;
  leaks: number;
  weakAnchors: number;
  orphanListings: number;
  hubCoveragePercent: number;
  coveredListings: number;
  totalListings: number;
};

type Leak = {
  blogNodeId: string;
  blogTitle: string;
  blogUrl: string;
  listingNodeId: string;
  listingTitle: string;
  listingUrl: string;
  evidenceSnippet: string;
  strengthScore: number;
};

type PreviewPayload = {
  diffJson: { insertions: number; changed: boolean };
  renderedPreviewHtml: string;
  beforeHtml: string;
  afterHtml: string;
  linkChecks: { blogToListing: "ok" | "missing"; listingToBlog: "ok" | "missing" };
};

const EMPTY_SUMMARY: Summary = {
  networkHealthScore: 0,
  leaks: 0,
  weakAnchors: 0,
  orphanListings: 0,
  hubCoveragePercent: 0,
  coveredListings: 0,
  totalListings: 0,
};

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <div className="text-xs uppercase tracking-[0.08em] text-slate-400">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-cyan-100">{value}</div>
    </div>
  );
}

export default function AuthorityNetworkClient() {
  const [summary, setSummary] = useState<Summary>(EMPTY_SUMMARY);
  const [leaks, setLeaks] = useState<Leak[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ingestJobId, setIngestJobId] = useState<string | null>(null);
  const [selectedLeak, setSelectedLeak] = useState<Leak | null>(null);
  const [preview, setPreview] = useState<PreviewPayload | null>(null);
  const [hubQuery, setHubQuery] = useState("best local services and trusted providers");

  async function loadSummaryAndLeaks() {
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const [summaryRes, leakRes] = await Promise.all([
        fetch("/api/directoryiq/authority-network/summary", { cache: "no-store" }),
        fetch("/api/directoryiq/authority-network/leaks", { cache: "no-store" }),
      ]);

      const summaryJson = (await summaryRes.json()) as Summary & { error?: string };
      const leakJson = (await leakRes.json()) as { leaks?: Leak[]; error?: string };

      if (!summaryRes.ok) throw new Error(summaryJson.error ?? "Failed to load summary");
      if (!leakRes.ok) throw new Error(leakJson.error ?? "Failed to load leaks");

      setSummary(summaryJson);
      setLeaks(Array.isArray(leakJson.leaks) ? leakJson.leaks : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown network error");
    } finally {
      setLoading(false);
    }
  }

  async function runIngestion() {
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/directoryiq/authority-network/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun: false }),
      });
      const json = (await res.json()) as { error?: string; jobId?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed to start ingestion");
      setIngestJobId(json.jobId ?? null);
      setNotice(`Ingestion job queued: ${json.jobId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown ingestion error");
    } finally {
      setLoading(false);
    }
  }

  async function scanNetwork() {
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/directoryiq/authority-network/scan", { method: "POST" });
      const json = (await res.json()) as { error?: string; leakCount?: number };
      if (!res.ok) throw new Error(json.error ?? "Failed to scan network");
      setNotice(`Scan complete. Leaks detected: ${json.leakCount ?? 0}`);
      await loadSummaryAndLeaks();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown scan error");
    } finally {
      setLoading(false);
    }
  }

  async function generateHubs() {
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/directoryiq/authority-network/hubs/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: hubQuery }),
      });
      const json = (await res.json()) as { error?: string; title?: string; coveredListings?: number };
      if (!res.ok) throw new Error(json.error ?? "Failed to generate hub");
      setNotice(`Hub generated: ${json.title ?? "Untitled"} (${json.coveredListings ?? 0} listings)`);
      await loadSummaryAndLeaks();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown hub generation error");
    } finally {
      setLoading(false);
    }
  }

  async function previewFix(leak: Leak) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/directoryiq/authority-network/fixes/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blogNodeId: leak.blogNodeId, listingNodeId: leak.listingNodeId }),
      });
      const json = (await res.json()) as PreviewPayload & { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed to preview fix");
      setSelectedLeak(leak);
      setPreview(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown preview error");
    } finally {
      setLoading(false);
    }
  }

  async function approveFix() {
    if (!selectedLeak) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/directoryiq/authority-network/fixes/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blogNodeId: selectedLeak.blogNodeId,
          listingNodeId: selectedLeak.listingNodeId,
          approved: true,
        }),
      });
      const json = (await res.json()) as { error?: string; status?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed to approve fix");
      setNotice(`Fix applied with status: ${json.status}`);
      setSelectedLeak(null);
      setPreview(null);
      await loadSummaryAndLeaks();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown approve error");
    } finally {
      setLoading(false);
    }
  }

  const dominantActionLabel = useMemo(() => {
    if (summary.leaks > 0) return "Fix Leaks";
    if (summary.hubCoveragePercent < 60) return "Generate Hubs";
    return "Scan Network";
  }, [summary.hubCoveragePercent, summary.leaks]);

  useEffect(() => {
    void loadSummaryAndLeaks();
  }, []);

  return (
    <>
      <TopBar breadcrumbs={["Home", "DirectoryIQ", "Authority Network"]} searchPlaceholder="Search authority network..." />

      {error ? (
        <div className="rounded-xl border border-rose-300/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">{error}</div>
      ) : null}
      {notice ? (
        <div className="rounded-xl border border-emerald-300/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">{notice}</div>
      ) : null}

      <HudCard title="Authority Network" subtitle="AI Authority Graph Manager">
        <div className="grid gap-3 md:grid-cols-3">
          <StatTile label="Network Health Score" value={summary.networkHealthScore} />
          <StatTile label="Authority Leaks" value={summary.leaks} />
          <StatTile label="Orphan Listings" value={summary.orphanListings} />
          <StatTile label="Weak Anchors" value={summary.weakAnchors} />
          <StatTile label="Hub Coverage" value={`${summary.hubCoveragePercent}%`} />
          <StatTile label="Listings Covered" value={`${summary.coveredListings}/${summary.totalListings}`} />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <NeonButton onClick={() => void loadSummaryAndLeaks()} disabled={loading}>Refresh</NeonButton>
          <NeonButton variant="secondary" onClick={() => void runIngestion()} disabled={loading}>Ingest Blogs</NeonButton>
          <NeonButton variant="secondary" onClick={() => void scanNetwork()} disabled={loading}>Scan Network</NeonButton>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <input
            value={hubQuery}
            onChange={(event) => setHubQuery(event.target.value)}
            className="w-full rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2 text-sm text-slate-100"
            placeholder="Hub topic query"
          />
          <NeonButton onClick={() => void generateHubs()} disabled={loading}>Generate Hubs</NeonButton>
        </div>

        <div className="mt-3 text-xs text-slate-400">Dominant CTA: {dominantActionLabel}</div>
        {ingestJobId ? <div className="mt-1 text-xs text-cyan-200">Latest ingest job: {ingestJobId}</div> : null}
      </HudCard>

      <HudCard title="Authority Leaks" subtitle="Mentions without contextual internal links">
        {leaks.length === 0 ? (
          <div className="text-sm text-slate-300">No leaks detected. Run Scan Network after ingestion.</div>
        ) : (
          <div className="space-y-3">
            {leaks.map((leak) => (
              <article key={`${leak.blogNodeId}:${leak.listingNodeId}`} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div className="text-sm text-slate-100">{leak.blogTitle}</div>
                <div className="mt-1 text-xs text-slate-400">Missing link to: {leak.listingTitle}</div>
                <div className="mt-1 text-xs text-slate-300">{leak.evidenceSnippet}</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <NeonButton variant="secondary" onClick={() => void previewFix(leak)} disabled={loading}>
                    Preview Fix
                  </NeonButton>
                </div>
              </article>
            ))}
          </div>
        )}
      </HudCard>

      {selectedLeak && preview ? (
        <HudCard title="Fix Preview" subtitle="Review diff before approval">
          <div className="mb-3 text-xs text-slate-300">
            Blog: {selectedLeak.blogTitle} → Listing: {selectedLeak.listingTitle}
          </div>
          <div className="mb-3 grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-white/10 p-3">
              <div className="mb-2 text-xs uppercase tracking-[0.08em] text-slate-400">Before</div>
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap text-xs text-slate-200">{preview.beforeHtml}</pre>
            </div>
            <div className="rounded-lg border border-white/10 p-3">
              <div className="mb-2 text-xs uppercase tracking-[0.08em] text-slate-400">After</div>
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap text-xs text-cyan-100">{preview.afterHtml}</pre>
            </div>
          </div>

          <div className="mb-3 text-xs text-slate-300">
            Insertions: {preview.diffJson.insertions} | Blog→Listing: {preview.linkChecks.blogToListing} | Listing→Blog: {preview.linkChecks.listingToBlog}
          </div>

          <div className="flex gap-2">
            <NeonButton onClick={() => void approveFix()} disabled={loading}>Approve & Apply</NeonButton>
            <NeonButton variant="secondary" onClick={() => { setSelectedLeak(null); setPreview(null); }} disabled={loading}>Close</NeonButton>
          </div>
        </HudCard>
      ) : null}
    </>
  );
}
