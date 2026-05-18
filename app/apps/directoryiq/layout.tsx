import type { ReactNode } from "react";
import Link from "next/link";
import DirectoryIqMobileNav from "@/components/directoryiq/DirectoryIqMobileNav";
import DirectoryIqSidebar from "@/app/apps/directoryiq/_components/directoryiq-sidebar";
import { directoryIqNavItems } from "@/lib/directoryiq/navItems";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default function DirectoryIqLayout({ children }: { children: ReactNode }) {
  return (
    <main className="directoryiq-app-theme ibrains-shell min-h-screen text-[#0F172A]" data-testid="directoryiq-layout-shell">
      <div className="mx-auto max-w-[1320px] px-4 py-6 sm:px-6">
        <div className="mb-4 flex items-center justify-between">
          <Link href="/apps" className="text-sm text-[#2563EB] hover:text-[#1D4ED8]">
            ← Back to Apps
          </Link>
          <div className="inline-flex items-center rounded-full border border-[#D9E4F0] bg-white/90 px-3 py-1 text-xs text-[#475569]">
            Directory Intelligence Command Center
          </div>
        </div>
        <DirectoryIqMobileNav items={directoryIqNavItems} />
        <div className="mt-4 grid gap-4 lg:grid-cols-[236px_minmax(0,1fr)]">
          <DirectoryIqSidebar />
          <section className="min-w-0 space-y-4">{children}</section>
        </div>
      </div>
    </main>
  );
}
