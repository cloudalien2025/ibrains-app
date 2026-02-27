import Link from "next/link";
import EmptyState from "../../_components/EmptyState";

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

      <EmptyState
        title="Diagnostics stream ready"
        description="When the run reports diagnostics, this page will surface issues, ingestion summaries, and error timelines."
        action={
          <Link
            href="/runs"
            className="inline-flex items-center rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white ring-1 ring-inset ring-white/15 transition hover:bg-white/15"
          >
            Review recent runs
          </Link>
        }
      />
    </div>
  );
}
