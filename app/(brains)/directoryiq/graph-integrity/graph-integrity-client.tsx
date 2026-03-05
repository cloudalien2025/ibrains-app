"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import HudCard from "@/components/ecomviper/HudCard";
import NeonButton from "@/components/ecomviper/NeonButton";

type LeakRow = {
  id: string;
  leakType: string;
  severity: number;
  status: "open" | "ignored" | "resolved";
  evidence: { mentionText?: string; anchorText?: string; snippet?: string };
  lastDetectedAt: string;
  blog: { id: string; title: string | null; url: string | null } | null;
  listing: { id: string; title: string | null; url: string | null } | null;
};

type LeakApiResponse = { ok?: boolean; leaks?: LeakRow[]; error?: { message?: string } };

type ScanStats = {
  blogsScanned: number;
  leaksInserted: number;
  leaksUpdated: number;
  leaksResolved: number;
  durationMs: number;
};

type ScanResponse = { ok?: boolean; stats?: ScanStats; error?: { message?: string } };

const STATUS_FILTERS = ["all", "open", "ignored", "resolved"] as const;
const TYPE_FILTERS = ["all", "mention_without_link", "weak_anchor_text", "orphan_listing"] as const;

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export default function GraphIntegrityClient({ tenantId }: { tenantId: string }) {
  const [leaks, setLeaks] = useState<LeakRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>("open");
  const [typeFilter, setTypeFilter] = useState<(typeof TYPE_FILTERS)[number]>("all");
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState<"all" | "changed">("all");

  const loadLeaks = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/directoryiq/graph/leaks?tenantId=${encodeURIComponent(tenantId)}&limit=200`);
      const json = (await res.json()) as LeakApiResponse;
      if (!res.ok || !json.ok) {
        throw new Error(json.error?.message ?? "Unable to load leaks");
      }
      setLeaks(json.leaks ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load leaks");
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void loadLeaks();
  }, [loadLeaks]);

  const runScan = useCallback(async () => {
    setRunning(true);
    setNotice(null);
    setError(null);

    try {
      const res = await fetch("/api/directoryiq/graph/leaks/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, scope }),
      });
      const json = (await res.json()) as ScanResponse;
      if (!res.ok || !json.ok) {
        throw new Error(json.error?.message ?? "Leak scan failed");
      }
      const stats = json.stats;
      setNotice(
        stats
          ? `Scan complete. Blogs ${stats.blogsScanned} · Inserts ${stats.leaksInserted} · Updates ${stats.leaksUpdated} · Resolved ${stats.leaksResolved}`
          : "Scan complete."
      );
      await loadLeaks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Leak scan failed");
    } finally {
      setRunning(false);
    }
  }, [tenantId, scope, loadLeaks]);

  const updateStatus = useCallback(
    async (id: string, status: "open" | "ignored" | "resolved") => {
      try {
        const res = await fetch(`/api/directoryiq/graph/leaks/${id}/status`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tenantId, status }),
        });
        const json = (await res.json()) as { ok?: boolean; error?: { message?: string } };
        if (!res.ok || !json.ok) {
          throw new Error(json.error?.message ?? "Status update failed");
        }
        setLeaks((prev) => prev.map((leak) => (leak.id === id ? { ...leak, status } : leak)));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Status update failed");
      }
    },
    [tenantId]
  );

  const filteredLeaks = useMemo(() => {
    const query = search.trim().toLowerCase();
    return leaks.filter((leak) => {
      if (statusFilter !== "all" && leak.status !== statusFilter) return false;
      if (typeFilter !== "all" && leak.leakType !== typeFilter) return false;
      if (!query) return true;
      const listing = leak.listing?.title ?? leak.listing?.url ?? "";
      const blog = leak.blog?.title ?? leak.blog?.url ?? "";
      const evidence = leak.evidence?.mentionText ?? leak.evidence?.anchorText ?? leak.evidence?.snippet ?? "";
      return `${listing} ${blog} ${evidence}`.toLowerCase().includes(query);
    });
  }, [leaks, statusFilter, typeFilter, search]);

  const summary = useMemo(() => {
    const counts = { mention_without_link: 0, weak_anchor_text: 0, orphan_listing: 0 };
    for (const leak of leaks) {
      if (leak.status !== "open") continue;
      if (leak.leakType in counts) {
        counts[leak.leakType as keyof typeof counts] += 1;
      }
    }
    return counts;
  }, [leaks]);

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
        <h1 className="text-xl font-semibold text-slate-100">Graph Integrity</h1>
        <p className="mt-1 text-sm text-slate-300">Scan authority leaks from persisted blog content only.</p>
      </section>

      {notice ? (
        <div className="rounded-xl border border-emerald-300/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
          {notice}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-xl border border-rose-300/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      <HudCard
        title="Leak Scanner"
        subtitle="Deterministic detection for mentions without links, weak anchors, and orphan listings."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200"
              value={scope}
              onChange={(event) => setScope(event.target.value as "all" | "changed")}
            >
              <option value="all">All blogs</option>
              <option value="changed">Changed blogs</option>
            </select>
            <NeonButton onClick={() => void runScan()} disabled={running}>
              {running ? "Running..." : "Run Leak Scan"}
            </NeonButton>
          </div>
        }
      >
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <div className="text-xs text-slate-400">Mentions Without Links</div>
            <div className="mt-1 text-2xl font-semibold text-slate-100">{summary.mention_without_link}</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <div className="text-xs text-slate-400">Weak Anchors</div>
            <div className="mt-1 text-2xl font-semibold text-slate-100">{summary.weak_anchor_text}</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <div className="text-xs text-slate-400">Orphan Listings</div>
            <div className="mt-1 text-2xl font-semibold text-slate-100">{summary.orphan_listing}</div>
          </div>
        </div>
      </HudCard>

      <HudCard title="Leaks" subtitle="Filter and resolve detected authority leaks." actions={
        <div className="flex flex-wrap items-center gap-2">
          <button
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200"
            onClick={() => void loadLeaks()}
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      }>
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-200">
          <select
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as (typeof STATUS_FILTERS)[number])}
          >
            {STATUS_FILTERS.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          <select
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2"
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value as (typeof TYPE_FILTERS)[number])}
          >
            {TYPE_FILTERS.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          <input
            className="min-w-[180px] flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2"
            placeholder="Search listing, blog, or evidence"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-200">
            <thead className="border-b border-white/10 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-3 py-2">Leak Type</th>
                <th className="px-3 py-2">Listing</th>
                <th className="px-3 py-2">Blog</th>
                <th className="px-3 py-2">Evidence</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Last Detected</th>
              </tr>
            </thead>
            <tbody>
              {filteredLeaks.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-slate-400">
                    {loading ? "Loading leaks..." : "No leaks match this filter."}
                  </td>
                </tr>
              ) : (
                filteredLeaks.map((leak) => {
                  const listingLabel = leak.listing?.title ?? leak.listing?.url ?? "Unknown";
                  const blogLabel = leak.blog?.title ?? leak.blog?.url ?? "Unknown";
                  const evidence = leak.evidence?.mentionText ?? leak.evidence?.anchorText ?? leak.evidence?.snippet ?? "";
                  return (
                    <tr key={leak.id} className="border-b border-white/5">
                      <td className="px-3 py-2 text-slate-100">{leak.leakType}</td>
                      <td className="px-3 py-2">{listingLabel}</td>
                      <td className="px-3 py-2">{blogLabel}</td>
                      <td className="px-3 py-2 text-slate-300">{evidence}</td>
                      <td className="px-3 py-2">
                        <select
                          className="rounded-lg border border-white/10 bg-white/5 px-2 py-1"
                          value={leak.status}
                          onChange={(event) => void updateStatus(leak.id, event.target.value as LeakRow["status"])}
                        >
                          {STATUS_FILTERS.filter((s) => s !== "all").map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2 text-slate-400">{formatDate(leak.lastDetectedAt)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </HudCard>
    </div>
  );
}
