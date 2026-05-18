"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { siteforgeSidebarItems } from "@/lib/siteforge/siteforge-nav";

export default function SiteForgeSidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="rounded-2xl border border-[#D9E4F0] bg-white/90 p-3 shadow-[0_12px_30px_rgba(15,23,42,0.06)]"
      data-testid="siteforge-command-center-sidebar"
    >
      <div className="mb-3 border-b border-[#E2E8F0] pb-3">
        <p className="text-[11px] uppercase tracking-[0.16em] text-[#64748B]">SITEFORGE</p>
        <h2 className="mt-1 text-base font-semibold text-[#0F172A]">Website Command Center</h2>
        <p className="mt-1 text-xs text-[#64748B]">Connect, describe, and launch in one workspace</p>
      </div>

      <nav className="grid gap-1" data-testid="siteforge-command-center-nav">
        {siteforgeSidebarItems.map((item) => {
          if (item.kind === "route") {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={`${item.kind}-${item.label}`}
                href={item.href}
                className={`rounded-lg border px-3 py-2 text-sm transition ${
                  active
                    ? "border-[#BFDBFE] bg-[#EFF6FF] text-[#0F172A]"
                    : "border-transparent text-[#334155] hover:border-[#D9E4F0] hover:bg-white"
                }`}
              >
                <div className="font-medium">{item.label}</div>
                <div className="mt-0.5 text-xs text-[#64748B]">{item.description}</div>
              </Link>
            );
          }

          return (
            <div
              key={`${item.kind}-${item.label}`}
              className="rounded-lg border border-[#E2E8F0] bg-[#F8FBFF] px-3 py-2"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-[#0F172A]">{item.label}</span>
                <span className="rounded-full border border-[#D9E4F0] bg-white px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] text-[#64748B]">
                  In Workspace
                </span>
              </div>
              <div className="mt-0.5 text-xs text-[#64748B]">{item.description}</div>
            </div>
          );
        })}
      </nav>

      <div className="mt-3 rounded-lg border border-dashed border-[#D9E4F0] bg-[#F8FBFF] p-3">
        <p className="text-[11px] uppercase tracking-[0.14em] text-[#64748B]">Scope</p>
        <p className="mt-1 text-xs text-[#475569]">
          This shell frames existing SiteForge workflows only. Build and publishing behavior remains unchanged.
        </p>
      </div>
    </aside>
  );
}
