"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  href: string;
  label: string;
};

type BrainSidebarNavProps = {
  items: NavItem[];
};

export default function BrainSidebarNav({ items }: BrainSidebarNavProps) {
  const pathname = usePathname();
  const disablePrefetch = pathname.startsWith("/directoryiq/authority");

  return (
    <nav className="flex flex-col gap-2">
      {items.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={`${item.href}:${item.label}`}
            href={item.href}
            prefetch={disablePrefetch ? false : undefined}
            className={`group flex items-center justify-between rounded-xl border px-3 py-2 text-sm font-medium transition ${
              isActive
                ? "border-[#22D3EE]/40 bg-[#22D3EE]/12 text-[#0F172A] shadow-[0_0_20px_rgba(34,211,238,0.2)]"
                : "border-transparent text-[#334155] hover:border-[#D9E4F0] hover:bg-white/80 hover:text-[#0F172A]"
            }`}
          >
            <span>{item.label}</span>
            <span className={`h-2 w-2 rounded-full ${isActive ? "bg-[#22D3EE] shadow-[0_0_10px_rgba(34,211,238,0.55)]" : "bg-[#D9E4F0]"}`} />
          </Link>
        );
      })}
    </nav>
  );
}
