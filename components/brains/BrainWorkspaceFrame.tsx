import type { ReactNode } from "react";
import Link from "next/link";
import { Home } from "lucide-react";
import BrainSidebarNav from "@/components/brains/BrainSidebarNav";

type BrainWorkspaceFrameProps = {
  brainLabel: string;
  subtitle: string;
  navItems: { href: string; label: string }[];
  children: ReactNode;
};

export default function BrainWorkspaceFrame({
  brainLabel,
  subtitle,
  navItems,
  children,
}: BrainWorkspaceFrameProps) {
  return (
    <div className="ecomviper-hud min-h-screen text-slate-100">
      <div className="ecomviper-vignette pointer-events-none fixed inset-0" />
      <div className="ecomviper-grid pointer-events-none fixed inset-0 opacity-40" />

      <div className="relative mx-auto flex min-h-screen max-w-[1500px] gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <aside className="hidden w-72 shrink-0 rounded-2xl border border-cyan-300/20 bg-slate-950/60 p-5 backdrop-blur-xl shadow-[0_24px_60px_rgba(2,6,23,0.72)] lg:flex lg:flex-col">
          <Link href="/brains" className="mb-6 rounded-xl border border-cyan-300/20 bg-cyan-400/10 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-cyan-300">Brain Dock</div>
            <div className="mt-1 text-xl font-semibold text-slate-100">{brainLabel}</div>
            <p className="mt-2 text-sm text-slate-400">{subtitle}</p>
          </Link>

          <BrainSidebarNav items={navItems} />

          <div className="mt-auto flex items-center justify-between rounded-xl border border-cyan-300/15 bg-slate-900/70 p-3 text-xs text-slate-400">
            <span>Status: <span className="text-cyan-200">Ready</span></span>
            <Link href="/brains" className="inline-flex items-center gap-1 text-cyan-200 hover:text-cyan-100">
              <Home className="h-3.5 w-3.5" />
              Dock
            </Link>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-4">{children}</div>
      </div>
    </div>
  );
}
