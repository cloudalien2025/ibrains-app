import Link from "next/link";
import DiagnosticsClient from "./diagnostics-client";

type DiagnosticsPageProps = {
  params: Promise<{ runId: string }>;
};

export default async function DiagnosticsPage({ params }: DiagnosticsPageProps) {
  const { runId } = await params;

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-white/10 bg-white/5 p-8 shadow-[0_30px_70px_rgba(2,6,23,0.5)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-slate-300/70">
              Diagnostics
            </div>
            <h2 className="mt-2 text-3xl font-semibold text-white">
              Run {runId}
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-300">
              Review discovery output, per-video diagnostics, and error streams.
            </p>
          </div>
          <Link
            href={`/runs/${runId}`}
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition hover:bg-white/10"
          >
            Back to run
          </Link>
        </div>
      </section>

      <DiagnosticsClient runId={runId} />
    </div>
  );
}
