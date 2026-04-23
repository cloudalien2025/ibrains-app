"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { UserButton, useAuth } from "@clerk/nextjs";

type DirectoryIqStats = {
  total_items?: number;
  youtube_items?: number;
  webdocs_items?: number;
  fill_pct?: number;
};

type State =
  | { phase: "loading" }
  | { phase: "ok"; data: DirectoryIqStats }
  | { phase: "error"; message: string };

function normalizeStats(payload: unknown): DirectoryIqStats {
  if (!payload || typeof payload !== "object") return {};
  const value = payload as Record<string, unknown>;
  return {
    total_items: typeof value.total_items === "number" ? value.total_items : 0,
    youtube_items: typeof value.youtube_items === "number" ? value.youtube_items : 0,
    webdocs_items: typeof value.webdocs_items === "number" ? value.webdocs_items : 0,
    fill_pct: typeof value.fill_pct === "number" ? Math.max(0, Math.min(100, value.fill_pct)) : 0,
  };
}

export default function DirectoryIqAppPage() {
  const { isSignedIn } = useAuth();
  const [state, setState] = useState<State>({ phase: "loading" });

  async function loadStats() {
    setState({ phase: "loading" });
    try {
      const response = await fetch("/api/brains/directoryiq/stats", {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) {
        setState({ phase: "error", message: `Stats request failed (${response.status})` });
        return;
      }
      const json = await response.json().catch(() => null);
      setState({ phase: "ok", data: normalizeStats(json) });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown stats error";
      setState({ phase: "error", message });
    }
  }

  useEffect(() => {
    void loadStats();
  }, []);

  const readiness = state.phase === "ok" ? Math.round(state.data.fill_pct ?? 0) : 0;

  return (
    <div className="ibrains-shell min-h-screen text-[#0F172A]">
      <div className="mx-auto max-w-6xl px-6 py-14">
        <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center rounded-full border border-[#D9E4F0] bg-[#EAF1F8] px-3 py-1 text-xs font-medium text-[#334155]">
              iBrains App
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#0F172A]">DirectoryIQ</h1>
            <p className="mt-2 max-w-2xl text-sm text-[#334155]">
              Directory intelligence workspace integrated into iBrains app routing and mission control.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/apps"
              className="rounded-full border border-[#D9E4F0] bg-white px-4 py-2 text-sm text-[#0F172A] transition hover:bg-[#F8FBFF]"
            >
              All apps
            </Link>
            <Link
              href="/brains/directoryiq"
              className="rounded-full border border-[#D9E4F0] bg-white px-4 py-2 text-sm text-[#0F172A] transition hover:bg-[#F8FBFF]"
            >
              Console
            </Link>
            {isSignedIn ? <UserButton /> : null}
          </div>
        </header>

        <section className="grid gap-5 md:grid-cols-3">
          <article className="rounded-3xl border border-[#D9E4F0] bg-white/95 p-6 shadow-[0_20px_45px_rgba(15,23,42,0.08)]">
            <div className="text-xs uppercase tracking-[0.14em] text-[#64748B]">Readiness</div>
            <div className="mt-2 text-4xl font-semibold text-[#0F172A]">{readiness}%</div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#EAF1F8]">
              <div className="h-full rounded-full bg-[#22D3EE]" style={{ width: `${readiness}%` }} />
            </div>
          </article>

          <article className="rounded-3xl border border-[#D9E4F0] bg-white/95 p-6 shadow-[0_20px_45px_rgba(15,23,42,0.08)]">
            <div className="text-xs uppercase tracking-[0.14em] text-[#64748B]">Total Items</div>
            <div className="mt-2 text-4xl font-semibold text-[#0F172A]">
              {state.phase === "ok" ? (state.data.total_items ?? 0).toLocaleString() : "-"}
            </div>
            <div className="mt-2 text-xs text-[#64748B]">DirectoryIQ knowledge items</div>
          </article>

          <article className="rounded-3xl border border-[#D9E4F0] bg-white/95 p-6 shadow-[0_20px_45px_rgba(15,23,42,0.08)]">
            <div className="text-xs uppercase tracking-[0.14em] text-[#64748B]">Source Mix</div>
            <div className="mt-2 text-sm text-[#334155]">
              {state.phase === "ok"
                ? `${(state.data.youtube_items ?? 0).toLocaleString()} YouTube · ${(state.data.webdocs_items ?? 0).toLocaleString()} Web Docs`
                : "Loading source metrics..."}
            </div>
          </article>
        </section>

        <section className="mt-6 rounded-3xl border border-[#D9E4F0] bg-white/95 p-6 shadow-[0_20px_45px_rgba(15,23,42,0.08)]">
          <h2 className="text-xl font-semibold text-[#0F172A]">Workspace Actions</h2>
          <p className="mt-2 text-sm text-[#334155]">
            Run discovery and ingest workflows from mission control while keeping DirectoryIQ on its dedicated database path.
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/brains/directoryiq?action=discover"
              className="rounded-full border border-[#2563EB] bg-[#2563EB] px-4 py-2 text-sm text-white transition hover:border-[#1D4ED8] hover:bg-[#1D4ED8]"
            >
              Run Discovery
            </Link>
            <Link
              href="/brains/directoryiq?action=ingest"
              className="rounded-full border border-[#D9E4F0] bg-white px-4 py-2 text-sm text-[#0F172A] transition hover:bg-[#F8FBFF]"
            >
              Run Ingest
            </Link>
            <button
              type="button"
              onClick={() => {
                void loadStats();
              }}
              className="rounded-full border border-[#D9E4F0] bg-white px-4 py-2 text-sm text-[#0F172A] transition hover:bg-[#F8FBFF]"
            >
              Refresh Stats
            </button>
          </div>

          {state.phase === "error" ? <p className="mt-4 text-sm text-rose-600">{state.message}</p> : null}
          {state.phase === "loading" ? <p className="mt-4 text-sm text-[#64748B]">Loading DirectoryIQ stats...</p> : null}
        </section>
      </div>
    </div>
  );
}
