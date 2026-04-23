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
    <div className="ecomviper-hud min-h-screen text-[#0F172A]">
      <div className="ecomviper-vignette pointer-events-none fixed inset-0" />
      <div className="ecomviper-grid pointer-events-none fixed inset-0 opacity-40" />

      <div className="relative mx-auto flex min-h-screen max-w-[1500px] gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <aside className="hidden w-72 shrink-0 rounded-2xl border border-[#D9E4F0] bg-white/95 p-5 backdrop-blur-md shadow-[0_18px_44px_rgba(15,23,42,0.08)] lg:flex lg:flex-col">
          <Link href="/brains" className="mb-6 rounded-xl border border-[#D9E4F0] bg-[#EAF1F8]/85 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-[#2563EB]">Brain Dock</div>
            <div className="mt-1 text-xl font-semibold text-[#0F172A]">{brainLabel}</div>
            <p className="mt-2 text-sm text-[#64748B]">{subtitle}</p>
          </Link>

          <BrainSidebarNav items={navItems} />

          <div className="mt-auto flex items-center justify-between rounded-xl border border-[#D9E4F0] bg-[#EAF1F8]/80 p-3 text-xs text-[#64748B]">
            <span>Status: <span className="text-[#1D4ED8]">Ready</span></span>
            <Link href="/brains" className="inline-flex items-center gap-1 text-[#2563EB] hover:text-[#1D4ED8]">
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
