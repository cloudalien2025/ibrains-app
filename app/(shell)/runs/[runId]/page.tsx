import Link from "next/link";
import RunStatusBadge from "../_components/RunStatusBadge";
import RunDetailClient from "./run-detail-client";

type RunDetailProps = {
  params: Promise<{ runId: string }>;
};

export default async function RunDetailPage({ params }: RunDetailProps) {
  const { runId } = await params;
  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-white/10 bg-white/5 p-8 shadow-[0_30px_70px_rgba(2,6,23,0.5)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-slate-300/70">
              Run detail
            </div>
            <h2 className="mt-2 text-3xl font-semibold text-white">
              Run {runId}
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-300">
              Status cards, stage transitions, and live counters will appear
              here as the run progresses.
            </p>
          </div>
          <Link
            href="/runs"
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition hover:bg-white/10"
          >
            Back to runs
          </Link>
        </div>
      </section>

      <RunDetailClient
        runId={runId}
        fallback={
          <div className="grid gap-6 lg:grid-cols-3">
            {["Status", "Stage", "Counters"].map((label) => (
              <div
                key={label}
                className="rounded-[24px] border border-white/10 bg-white/4 p-6"
              >
                <div className="text-xs uppercase tracking-[0.2em] text-slate-300/70">
                  {label}
                </div>
                <p className="mt-3 text-sm text-slate-300">
                  Awaiting live data from the worker.
                </p>
              </div>
            ))}
          </div>
        }
      >
        {(state) => (
          <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="rounded-[24px] border border-white/10 bg-white/5 p-6">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-300/70">
                  Status
                </div>
                <div className="mt-3">
                  <RunStatusBadge status={state.status} />
                </div>
                <p className="mt-3 text-xs text-slate-400">
                  Updated {state.lastUpdated}
                </p>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-white/5 p-6">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-300/70">
                  Stage
                </div>
                <p className="mt-3 text-lg font-semibold text-white">
                  {state.stage || "Awaiting stage"}
                </p>
                <p className="mt-2 text-xs text-slate-400">
                  Step: {state.step || "Pending"}
                </p>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-white/5 p-6">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-300/70">
                  Counters
                </div>
                <div className="mt-3 grid gap-2 text-sm text-slate-200">
                  <div className="flex items-center justify-between">
                    <span>Ingested</span>
                    <span className="font-mono text-xs text-slate-300">
                      {state.counters.ingested ?? "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Transcripts ok</span>
                    <span className="font-mono text-xs text-slate-300">
                      {state.counters.transcriptsOk ?? "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Transcripts failed</span>
                    <span className="font-mono text-xs text-slate-300">
                      {state.counters.transcriptsFailed ?? "—"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-white/10 bg-white/5 p-5">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-slate-300/70">
                  Diagnostics
                </div>
                <p className="mt-2 text-sm text-slate-300">
                  Dive into per-video telemetry and error streams.
                </p>
              </div>
              <Link
                href={`/runs/${runId}/diagnostics`}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
              >
                View diagnostics
              </Link>
            </div>
          </div>
        )}
      </RunDetailClient>
    </div>
  );
}
