import Link from "next/link";
import EmptyState from "../_components/EmptyState";

export default function BrainsPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-white/10 bg-white/5 p-8 shadow-[0_30px_70px_rgba(2,6,23,0.5)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-slate-300/70">
              Brains catalog
            </div>
            <h2 className="mt-2 text-3xl font-semibold text-white">Brains</h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-300">
              Track every configured brain, monitor readiness, and launch runs
              directly from the console.
            </p>
          </div>
          <Link
            href="/runs"
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition hover:bg-white/10"
          >
            View latest runs
          </Link>
        </div>
      </section>

      <EmptyState
        title="Awaiting first brain sync"
        description="Once the worker connection returns brains, they will appear here with quick actions for run launches and diagnostics."
        action={
          <Link
            href="/"
            className="inline-flex items-center rounded-full bg-emerald-400/10 px-4 py-2 text-sm font-medium text-emerald-200 ring-1 ring-inset ring-emerald-400/30 transition hover:bg-emerald-400/20"
          >
            Review system health
          </Link>
        }
      />
    </div>
  );
}
