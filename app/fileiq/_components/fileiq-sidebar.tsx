"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { fileIqNavItems } from "@/lib/fileiq/fileiq-nav";

export default function FileIqSidebar() {
  const pathname = usePathname();

  const visibleItems = fileIqNavItems.filter((item) => item.ready);

  return (
    <div className="space-y-4" data-testid="fileiq-brain-sidebar">
      <div className="rounded-xl border border-[#D2E3F8] bg-[#F3F8FF] p-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-[#0B5FFF] text-xs font-semibold text-white">
            FQ
          </span>
          <div>
            <p className="text-sm font-semibold text-[#0F172A]">FileIQ</p>
            <p className="text-xs text-[#475569]">Internal brain workspace</p>
          </div>
        </div>
        <p className="mt-2 text-xs text-[#475569]">
          Ingest supplier source files and extract canonical product facts.
        </p>
      </div>

      <nav className="grid gap-1" aria-label="FileIQ workspace navigation" data-testid="fileiq-sidebar-nav">
        {visibleItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={
                active
                  ? "block rounded-lg border border-[#B8D4FF] bg-[#EAF2FF] px-3 py-2 text-sm font-medium text-[#0F172A]"
                  : "block rounded-lg border border-transparent px-3 py-2 text-sm text-[#334155] transition hover:border-[#D2E3F8] hover:bg-[#F5FAFF]"
              }
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
