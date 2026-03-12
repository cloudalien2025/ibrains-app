"use client";

import { useEffect, useState } from "react";
import HudCard from "@/components/ecomviper/HudCard";
import NeonButton from "@/components/ecomviper/NeonButton";
import AuthoritySectionNav from "@/app/(brains)/directoryiq/authority/_components/authority-section-nav";

type Overview = {
  totalNodes: number;
  totalEdges: number;
  totalEvidence: number;
  blogNodes: number;
  listingNodes: number;
  lastIngestionRunAt: string | null;
  lastGraphRunAt: string | null;
  lastGraphRunStatus: string | null;
};

const EMPTY: Overview = {
  totalNodes: 0,
  totalEdges: 0,
  totalEvidence: 0,
  blogNodes: 0,
  listingNodes: 0,
  lastIngestionRunAt: null,
  lastGraphRunAt: null,
  lastGraphRunStatus: null,
};

type AuthorityOverviewClientProps = {
  initialOverview?: Overview;
  initialError?: string | null;
};

export default function AuthorityOverviewClient({
  initialOverview = EMPTY,
  initialError = null,
}: AuthorityOverviewClientProps) {
  const [overview, setOverview] = useState<Overview>(initialOverview);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const [notice, setNotice] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    const response = await fetch("/api/directoryiq/authority/overview", { cache: "no-store" });
    const json = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      overview?: Overview;
      error?: { message?: string };
    };
    if (!response.ok || json.ok === false) {
      setError(json.error?.message ?? "Failed to load overview.");
      setLoading(false);
      return;
    }
    setOverview(json.overview ?? EMPTY);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runIngestion() {
    setRunning(true);
    setError(null);
    setNotice(null);
    const response = await fetch("/api/directoryiq/authority/ingest/blogs", { method: "POST" });
    const json = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      ingest?: { counts?: { blogPosts: number }; blogPostsDataId?: number };
      error?: { message?: string };
    };

    if (!response.ok || !json.ok) {
      setError(json.error?.message ?? "Blog ingestion failed.");
      setRunning(false);
      return;
    }

    setNotice(`Blog ingestion completed. Posts: ${json.ingest?.counts?.blogPosts ?? 0}. data_id=${json.ingest?.blogPostsDataId ?? 14}`);
    await load();
    setRunning(false);
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
        <h1 className="text-xl font-semibold text-slate-100">Authority Overview</h1>
        <p className="mt-1 text-sm text-slate-300">Graph summary for blog to listing authority coverage.</p>
      </section>

      <AuthoritySectionNav />

      {notice ? <div className="rounded-xl border border-emerald-300/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">{notice}</div> : null}
      {error ? <div className="rounded-xl border border-rose-300/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">{error}</div> : null}

      <HudCard
        title="Authority Graph Summary"
        subtitle="Nodes, edges, and evidence created from ingested blog content."
        actions={
          <NeonButton onClick={() => void runIngestion()} disabled={running}>
            {running ? "Running..." : "Run Blog Ingestion"}
          </NeonButton>
        }
      >
        {loading ? <div className="text-sm text-slate-300">Loading overview...</div> : null}
        {!loading ? (
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <div className="text-xs text-slate-400">Total Nodes</div>
              <div className="mt-1 text-2xl font-semibold text-slate-100">{overview.totalNodes}</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <div className="text-xs text-slate-400">Total Edges</div>
              <div className="mt-1 text-2xl font-semibold text-slate-100">{overview.totalEdges}</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <div className="text-xs text-slate-400">Evidence Count</div>
              <div className="mt-1 text-2xl font-semibold text-slate-100">{overview.totalEvidence}</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <div className="text-xs text-slate-400">Blog Nodes</div>
              <div className="mt-1 text-2xl font-semibold text-slate-100">{overview.blogNodes}</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <div className="text-xs text-slate-400">Listing Nodes</div>
              <div className="mt-1 text-2xl font-semibold text-slate-100">{overview.listingNodes}</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-slate-300">
              <div>Last ingestion run: {overview.lastIngestionRunAt ? new Date(overview.lastIngestionRunAt).toLocaleString() : "Never"}</div>
              <div className="mt-1">Last graph run: {overview.lastGraphRunAt ? new Date(overview.lastGraphRunAt).toLocaleString() : "Never"}</div>
              <div className="mt-1">Graph status: {overview.lastGraphRunStatus ?? "n/a"}</div>
            </div>
          </div>
        ) : null}
      </HudCard>
    </div>
  );
}
