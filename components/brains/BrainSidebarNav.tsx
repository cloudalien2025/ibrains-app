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

  return (
    <nav className="flex flex-col gap-2">
      {items.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={`${item.href}:${item.label}`}
            href={item.href}
            className={`group flex items-center justify-between rounded-xl border px-3 py-2 text-sm font-medium transition ${
              isActive
                ? "border-cyan-300/45 bg-cyan-400/18 text-cyan-100 shadow-[0_0_22px_rgba(34,211,238,0.22)]"
                : "border-transparent text-slate-300 hover:border-white/10 hover:bg-white/8 hover:text-white"
            }`}
          >
            <span>{item.label}</span>
            <span className={`h-2 w-2 rounded-full ${isActive ? "bg-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.8)]" : "bg-white/15"}`} />
          </Link>
        );
      })}
    </nav>
  );
}
