import type { ReactNode } from "react";
import EbaySidebar from "@/app/optibay/_components/ebay-sidebar";
import BackToBrainsLink from "@/components/brains/back-to-brains-link";

export const dynamic = "force-dynamic";

export default function EbayLayout({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto max-w-[1320px] px-4 py-6 sm:px-6" data-testid="ecomviper-ebay-layout">
      <div className="mb-4 flex items-center justify-between">
        <BackToBrainsLink />
        <div className="inline-flex items-center rounded-full border border-[#D9E4F0] bg-white/90 px-3 py-1 text-xs text-[#475569]">
          OptiBay Brain Console
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-[236px_minmax(0,1fr)]">
        <EbaySidebar />
        <section className="space-y-4">{children}</section>
      </div>
    </main>
  );
}
