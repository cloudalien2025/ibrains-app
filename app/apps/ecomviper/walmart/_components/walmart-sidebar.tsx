"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { walmartNavItems } from "@/lib/ecomviper/walmart/walmart-nav";

export default function WalmartSidebar() {
  const pathname = usePathname();

  return (
    <aside className="rounded-2xl border border-[#D9E4F0] bg-white/90 p-3 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
      <div className="mb-3 border-b border-[#E2E8F0] pb-3">
        <p className="text-[11px] uppercase tracking-[0.16em] text-[#64748B]">ECOMVIPER</p>
        <h2 className="mt-1 text-base font-semibold text-[#0F172A]">Walmart Agentic Workspace</h2>
        <p className="mt-1 text-xs text-[#64748B]">AI discovery and referral readiness lanes</p>
      </div>
      <nav className="grid gap-1" data-testid="ecomviper-walmart-sidebar">
        {walmartNavItems.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== "/apps/ecomviper/walmart" &&
              pathname.startsWith(`${item.href}/`));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-lg border px-3 py-2 text-sm transition ${
                active
                  ? "border-[#BFDBFE] bg-[#EFF6FF] text-[#0F172A]"
                  : "border-transparent text-[#334155] hover:border-[#D9E4F0] hover:bg-white"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-3 rounded-lg border border-dashed border-[#D9E4F0] bg-[#F8FBFF] p-3">
        <p className="text-[11px] uppercase tracking-[0.14em] text-[#64748B]">Automation</p>
        <p className="mt-1 text-xs text-[#475569]">
          Queue high-impact fixes after scoring visibility, semantic gaps, and trust signals.
        </p>
      </div>
    </aside>
  );
}
