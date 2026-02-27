import Link from "next/link";
import EmptyState from "../../_components/EmptyState";

type BrainDetailProps = {
  params: Promise<{ id: string }>;
};

export default async function BrainDetailPage({ params }: BrainDetailProps) {
  const { id } = await params;
  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-white/10 bg-white/5 p-8 shadow-[0_30px_70px_rgba(2,6,23,0.5)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-slate-300/70">
              Brain profile
            </div>
            <h2 className="mt-2 text-3xl font-semibold text-white">
              Brain {id}
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-300">
              This view will summarize configuration, last run status, and
              recommended actions for the selected brain.
            </p>
          </div>
          <Link
            href="/brains"
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition hover:bg-white/10"
          >
            Back to brains
          </Link>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-[24px] border border-white/10 bg-white/4 p-6">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-300/70">
            Summary
          </div>
          <p className="mt-3 text-sm text-slate-300">
            Run telemetry and health status will populate this card once the
            brain data stream is connected.
          </p>
        </div>
        <div className="rounded-[24px] border border-white/10 bg-white/4 p-6">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-300/70">
            Recent runs
          </div>
          <p className="mt-3 text-sm text-slate-300">
            Recent run history appears here so you can jump straight into
            diagnostics.
          </p>
        </div>
      </div>

      <EmptyState
        title="No runs launched yet"
        description="Start a run from the Brains list to begin collecting discovery and ingestion telemetry."
        action={
          <Link
            href="/brains"
            className="inline-flex items-center rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white ring-1 ring-inset ring-white/15 transition hover:bg-white/15"
          >
            Launch a run
          </Link>
        }
      />
    </div>
  );
}
