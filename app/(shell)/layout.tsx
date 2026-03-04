import type { ReactNode } from "react";
import Link from "next/link";
import SideNav from "./_components/SideNav";

export default function ShellLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-7xl gap-6 px-6 py-8">
        <aside className="hidden w-64 flex-col gap-8 rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-[0_40px_80px_rgba(2,6,23,0.6)] lg:flex">
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-300/70">
              iBrains
            </div>
            <div className="text-2xl font-semibold text-white">Mission Control</div>
            <p className="text-sm text-slate-300">
              Live command center for brains, runs, and operational telemetry.
            </p>
          </div>
          <SideNav />
          <div className="mt-auto rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-slate-300">
            <div className="uppercase tracking-[0.2em] text-slate-400/80">Status</div>
            <div className="mt-2 text-sm text-slate-100">Worker link active</div>
            <div className="mt-1 text-[11px] text-slate-400">
              Check <span className="font-mono">/api/health</span> for upstream state.
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <header className="flex flex-wrap items-center justify-between gap-4 rounded-[28px] border border-white/10 bg-white/5 px-6 py-4 shadow-[0_30px_70px_rgba(2,6,23,0.5)]">
            <div className="space-y-1">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-300/70">
                Operational Intelligence
              </div>
              <h1 className="text-2xl font-semibold text-white">iBrains Console</h1>
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-300">
              <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 sm:flex">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                Live system
              </div>
              <Link
                href="/"
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition hover:bg-white/10"
              >
                Home
              </Link>
            </div>
          </header>

          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </div>
    </div>
  );
}
