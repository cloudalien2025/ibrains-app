import MissionControlClient from "./mission-control-client";

export default function MissionControlPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-[#D9E4F0] bg-white/95 p-8 shadow-[0_18px_44px_rgba(15,23,42,0.08)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-[#64748B]">
              Mission Control
            </div>
            <h2 className="mt-2 text-3xl font-semibold text-[#0F172A]">
              One-click verification
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-[#334155]">
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
