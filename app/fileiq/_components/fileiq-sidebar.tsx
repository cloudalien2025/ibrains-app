"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { fileIqNavItems } from "@/lib/fileiq/fileiq-nav";

export default function FileIqSidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="rounded-2xl border border-[#D9E4F0] bg-white/90 p-3 shadow-[0_12px_30px_rgba(15,23,42,0.06)]"
      data-testid="fileiq-sidebar"
    >
      <div className="mb-3 border-b border-[#E2E8F0] pb-3">
        <p className="text-[11px] uppercase tracking-[0.16em] text-[#64748B]">FILEIQ</p>
        <h2 className="mt-1 text-base font-semibold text-[#0F172A]">Internal File Intelligence</h2>
        <p className="mt-1 text-xs text-[#64748B]">Extraction contracts, validation, provenance, and review</p>
      </div>

      <nav className="grid gap-1" data-testid="fileiq-sidebar-nav">
        {fileIqNavItems.map((item) => {
          // Phase 1.0 only ships the Command Center route. Planned routes are
          // rendered as non-navigable placeholders so signed-in users can't
          // navigate to an unbuilt route (which renders the not-found boundary).
          if (!item.ready) {
            return (
              <span
                key={item.href}
                aria-disabled="true"
                title="Coming in a later phase"
                className="flex items-center justify-between rounded-lg border border-transparent px-3 py-2 text-sm text-[#94A3B8]"
              >
                {item.label}
                <span className="ml-2 rounded-full border border-[#E2E8F0] bg-[#F8FBFF] px-1.5 py-0.5 text-[10px] uppercase tracking-[0.1em] text-[#94A3B8]">
                  Soon
                </span>
              </span>
            );
          }

          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
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
        <p className="text-[11px] uppercase tracking-[0.14em] text-[#64748B]">Boundary</p>
        <p className="mt-1 text-xs text-[#475569]">
          Phase 1.0 is contracts and dashboard foundation only. No OCR, extraction runs, or downstream execution wiring.
        </p>
      </div>
    </aside>
  );
}
