"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { walmartNavItems } from "@/lib/ecomviper/walmart/walmart-nav";

export default function WalmartSidebar() {
  const pathname = usePathname();

  return (
    <aside className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-4 shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
      <div className="mb-4 border-b border-[#D9E4F0] pb-3">
        <p className="text-xs uppercase tracking-[0.14em] text-[#64748B]">EcomViper</p>
        <h2 className="mt-1 text-lg font-semibold text-[#0F172A]">Walmart</h2>
      </div>
      <nav className="grid gap-1.5" data-testid="ecomviper-walmart-sidebar">
        {walmartNavItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-lg border px-3 py-2 text-sm transition ${
                active
                  ? "border-[#93C5FD] bg-[#EAF1F8] text-[#0F172A]"
                  : "border-transparent text-[#334155] hover:border-[#D9E4F0] hover:bg-white"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
