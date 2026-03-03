"use client";

import { useEffect, useMemo, useState } from "react";
import HudCard from "@/components/ecomviper/HudCard";
import NeonButton from "@/components/ecomviper/NeonButton";

type GraphIssue = {
  type: "orphan_listing" | "mention_without_link" | "weak_anchor";
  severity: "low" | "medium" | "high";
  from?: {
    title?: string | null;
    canonicalUrl?: string | null;
    externalId?: string;
  };
  to?: {
    title?: string | null;
    canonicalUrl?: string | null;
    externalId?: string;
  };
  evidence?: {
    sourceUrl: string;
    targetUrl?: string | null;
    anchorText?: string | null;
    contextSnippet?: string | null;
    domPath?: string | null;
    locationHint?: "body" | "sidebar" | "footer" | "unknown" | null;
  } | null;
  details: {
    summary: string;
    suggestedFix: string;
  };
};

type GraphIssuesPayload = {
  orphans: GraphIssue[];
  mentions_without_links: GraphIssue[];
  weak_anchors: GraphIssue[];
  lastRun: {
    id: string;
    status: string;
    startedAt: string;
    completedAt: string | null;
    stats: Record<string, unknown>;
  } | null;
};

type ApiError = {
  error?: {
    message?: string;
    code?: string;
    reqId?: string;
  };
};

const EMPTY: GraphIssuesPayload = {
  orphans: [],
  mentions_without_links: [],
  weak_anchors: [],
  lastRun: null,
};

type ActiveCard = "orphans" | "mentions_without_links" | "weak_anchors";

function safeLabel(value: string | null | undefined, fallback: string): string {
  if (!value || !value.trim()) return fallback;
  return value;
}

function formatStats(stats: Record<string, unknown> | null): string {
  if (!stats) return "No scans yet.";

  const nodes = typeof stats.nodesCreated === "number" ? stats.nodesCreated : 0;
  const edges = typeof stats.edgesUpserted === "number" ? stats.edgesUpserted : 0;
  const evidence = typeof stats.evidenceCount === "number" ? stats.evidenceCount : 0;
  return `Nodes ${nodes} · Edges ${edges} · Evidence ${evidence}`;
}

export default function AuthoritySupportClient() {
  const [issues, setIssues] = useState<GraphIssuesPayload>(EMPTY);
  const [activeCard, setActiveCard] = useState<ActiveCard>("orphans");
  const [selectedIssue, setSelectedIssue] = useState<GraphIssue | null>(null);
  const [scanBusy, setScanBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeRows = useMemo(() => issues[activeCard], [activeCard, issues]);

  async function loadIssues() {
    setLoading(true);
    setError(null);

    const res = await fetch("/api/directoryiq/graph/issues", { cache: "no-store" });
    const json = (await res.json().catch(() => ({}))) as { issues?: GraphIssuesPayload } & ApiError;

    if (!res.ok || !json.issues) {
      setError(json.error?.message ?? "Failed to load authority graph issues.");
      setLoading(false);
      return;
    }

    setIssues(json.issues);
    setLoading(false);
  }

  async function scanForLeaks() {
    setScanBusy(true);
    setError(null);
    setNotice(null);

    const res = await fetch("/api/directoryiq/graph/rebuild", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "scan" }),
    });

    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      stats?: Record<string, unknown>;
    } & ApiError;

    if (!res.ok || !json.ok) {
      setError(json.error?.message ?? "Scan failed.");
      setScanBusy(false);
      return;
    }

    setNotice(`Scan completed. ${formatStats((json.stats as Record<string, unknown>) ?? {})}`);
    await loadIssues();
    setScanBusy(false);
  }

  useEffect(() => {
    void loadIssues();
  }, []);

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
        <h1 className="text-xl font-semibold text-slate-100">Authority Support</h1>
        <p className="mt-1 text-sm text-slate-300">
          Deterministic authority leak scan for listing link coverage and evidence-backed issues.
        </p>
      </section>

      <HudCard
        title="Authority Leak Scanner"
        subtitle="One click scan. Three issue buckets. Evidence drilldown."
        actions={
          <NeonButton onClick={() => void scanForLeaks()} disabled={scanBusy}>
            {scanBusy ? "Scanning..." : "Scan for Authority Leaks"}
          </NeonButton>
        }
      >
        <div className="text-sm text-slate-300">
          <div>
            Last run: {issues.lastRun?.completedAt ? new Date(issues.lastRun.completedAt).toLocaleString() : "Never"}
          </div>
          <div className="mt-1">{formatStats((issues.lastRun?.stats as Record<string, unknown>) ?? null)}</div>
        </div>
      </HudCard>

      {notice ? (
        <div className="rounded-xl border border-emerald-300/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">{notice}</div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-rose-300/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">{error}</div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-3">
        <button
          type="button"
          onClick={() => setActiveCard("orphans")}
          className={`rounded-xl border p-4 text-left ${activeCard === "orphans" ? "border-cyan-300/40 bg-cyan-400/10" : "border-white/10 bg-white/[0.03]"}`}
        >
          <div className="text-sm text-slate-300">Orphan Listings</div>
          <div className="mt-1 text-2xl font-semibold text-slate-100">{issues.orphans.length}</div>
        </button>

        <button
          type="button"
          onClick={() => setActiveCard("mentions_without_links")}
          className={`rounded-xl border p-4 text-left ${activeCard === "mentions_without_links" ? "border-cyan-300/40 bg-cyan-400/10" : "border-white/10 bg-white/[0.03]"}`}
        >
          <div className="text-sm text-slate-300">Mentions Without Links</div>
          <div className="mt-1 text-2xl font-semibold text-slate-100">{issues.mentions_without_links.length}</div>
        </button>

        <button
          type="button"
          onClick={() => setActiveCard("weak_anchors")}
          className={`rounded-xl border p-4 text-left ${activeCard === "weak_anchors" ? "border-cyan-300/40 bg-cyan-400/10" : "border-white/10 bg-white/[0.03]"}`}
        >
          <div className="text-sm text-slate-300">Weak Anchors</div>
          <div className="mt-1 text-2xl font-semibold text-slate-100">{issues.weak_anchors.length}</div>
        </button>
      </div>

      <HudCard title="Issue Details" subtitle="Click a row to inspect evidence.">
        {loading ? (
          <div className="text-sm text-slate-300">Loading issues...</div>
        ) : activeRows.length === 0 ? (
          <div className="text-sm text-slate-300">No issues in this bucket.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.08em] text-slate-400">
                <tr>
                  <th className="py-2 pr-3">Source (blog)</th>
                  <th className="py-2 pr-3">Target (listing)</th>
                  <th className="py-2 pr-3">Evidence snippet</th>
                  <th className="py-2 pr-3">Suggested fix</th>
                </tr>
              </thead>
              <tbody>
                {activeRows.map((issue, index) => (
                  <tr key={`${issue.type}-${index}`} className="border-t border-white/10">
                    <td className="py-2 pr-3">
                      <button
                        type="button"
                        onClick={() => setSelectedIssue(issue)}
                        className="text-left text-cyan-100 underline-offset-2 hover:underline"
                      >
                        {safeLabel(issue.from?.title, issue.from?.externalId ?? "-")}
                      </button>
                    </td>
                    <td className="py-2 pr-3">{safeLabel(issue.to?.title, issue.to?.externalId ?? "-")}</td>
                    <td className="py-2 pr-3">{issue.evidence?.contextSnippet ?? "-"}</td>
                    <td className="py-2 pr-3">{issue.details.suggestedFix}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </HudCard>

      {selectedIssue ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/65">
          <div className="h-full w-full max-w-xl border-l border-white/10 bg-slate-950 p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-100">Evidence</h3>
              <NeonButton variant="ghost" onClick={() => setSelectedIssue(null)}>Close</NeonButton>
            </div>

            <div className="space-y-3 text-sm text-slate-200">
              <div>
                <div className="text-xs uppercase tracking-[0.08em] text-slate-400">source_url</div>
                <div>{selectedIssue.evidence?.sourceUrl ?? "-"}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.08em] text-slate-400">target_url</div>
                <div>{selectedIssue.evidence?.targetUrl ?? "-"}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.08em] text-slate-400">anchor_text</div>
                <div>{selectedIssue.evidence?.anchorText ?? "-"}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.08em] text-slate-400">context_snippet</div>
                <div>{selectedIssue.evidence?.contextSnippet ?? "-"}</div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
