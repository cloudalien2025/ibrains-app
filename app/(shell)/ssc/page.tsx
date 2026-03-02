import SscDashboardClient from "./ssc-dashboard-client";

export default function SscPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-white/10 bg-white/5 p-8 shadow-[0_30px_70px_rgba(2,6,23,0.5)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-slate-300/70">
              Ferrari Dashboard
            </div>
            <h2 className="mt-2 text-3xl font-semibold text-white">
              SSC v1 prompt packs
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-300">
              Active versions and hash locks for DB, EB, and Visual storyboard packs.
            </p>
          </div>
        </div>
      </section>

      <SscDashboardClient />
    </div>
  );
}
