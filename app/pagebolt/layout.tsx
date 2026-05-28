import type { ReactNode } from "react";
import Link from "next/link";
import SiteForgeSidebar from "@/app/pagebolt/_components/siteforge-sidebar";

export const dynamic = "force-dynamic";

export default function SiteForgeLayout({ children }: { children: ReactNode }) {
  return (
    <div className="ibrains-shell min-h-screen text-[#0F172A]" data-testid="siteforge-shell-root">
      <main className="mx-auto max-w-[1320px] px-4 py-6 sm:px-6" data-testid="siteforge-command-center-layout">
        <div className="mb-4 flex items-center justify-between">
          <Link href="/brains" className="text-sm text-[#2563EB] hover:text-[#1D4ED8]">
            ← Back to Brains
          </Link>
          <div className="inline-flex items-center rounded-full border border-[#D9E4F0] bg-white/90 px-3 py-1 text-xs text-[#475569]">
            PageBolt Command Center
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[236px_minmax(0,1fr)]">
          <SiteForgeSidebar />
          <section
            className="space-y-4"
            aria-label="PageBolt workspace"
            data-testid="siteforge-command-center-workspace"
          >
            {children}
          </section>
        </div>
      </main>
    </div>
  );
}
