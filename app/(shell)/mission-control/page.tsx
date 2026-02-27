import MissionControlClient from "./mission-control-client";

export default function MissionControlPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-white/10 bg-white/5 p-8 shadow-[0_30px_70px_rgba(2,6,23,0.5)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-slate-300/70">
              Mission Control
            </div>
            <h2 className="mt-2 text-3xl font-semibold text-white">
              One-click verification
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-300">
              Validate system health, proxy stability, run creation, and diagnostics
              without leaving the console.
            </p>
          </div>
        </div>
      </section>

      <MissionControlClient />
    </div>
  );
}
