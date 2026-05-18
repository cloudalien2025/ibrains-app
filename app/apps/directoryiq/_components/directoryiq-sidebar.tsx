"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { directoryIqNavItems } from "@/lib/directoryiq/navItems";

export default function DirectoryIqSidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="hidden rounded-2xl border border-[#D9E4F0] bg-white/90 p-3 shadow-[0_12px_30px_rgba(15,23,42,0.06)] lg:block"
      data-testid="directoryiq-shell-sidebar"
    >
      <div className="mb-3 border-b border-[#E2E8F0] pb-3">
        <p className="text-[11px] uppercase tracking-[0.16em] text-[#64748B]">DIRECTORYIQ</p>
        <h2 className="mt-1 text-base font-semibold text-[#0F172A]">Directory Intelligence Workspace</h2>
        <p className="mt-1 text-xs text-[#64748B]">Listing authority and readiness command center</p>
      </div>

      <nav className="grid gap-1">
        {directoryIqNavItems.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== "/apps/directoryiq" && pathname.startsWith(`${item.href}/`));

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
        <p className="text-[11px] uppercase tracking-[0.14em] text-[#64748B]">Workspace Scope</p>
        <p className="mt-1 text-xs text-[#475569]">
          This shell organizes existing DirectoryIQ workflows without changing current API or data behavior.
        </p>
      </div>
    </aside>
  );
}
