import type { ReactNode } from "react";
import Link from "next/link";
import WalmartSidebar from "@/app/apps/ecomviper/walmart/_components/walmart-sidebar";

export const dynamic = "force-dynamic";

export default function WalmartLayout({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto max-w-[1320px] px-4 py-6 sm:px-6" data-testid="ecomviper-walmart-layout">
      <div className="mb-4 flex items-center justify-between">
        <Link href="/apps/ecomviper" className="text-sm text-[#2563EB] hover:text-[#1D4ED8]">
          ← Back to EcomViper
        </Link>
        <div className="inline-flex items-center rounded-full border border-[#D9E4F0] bg-white/90 px-3 py-1 text-xs text-[#475569]">
          Agentic Commerce Command Center
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-[236px_minmax(0,1fr)]">
        <WalmartSidebar />
        <section className="space-y-4">{children}</section>
      </div>
    </main>
  );
}
