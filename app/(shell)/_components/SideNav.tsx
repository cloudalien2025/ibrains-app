"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/apps", label: "Apps" },
  { href: "/brains", label: "Brains" },
  { href: "/runs", label: "Runs" },
  { href: "/mission-control", label: "Mission Control" },
];

export default function SideNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-2">
      {navItems.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`group flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-medium transition ${
              isActive
                ? "bg-[#EAF1F8] text-[#0F172A] shadow-[0_10px_28px_rgba(15,23,42,0.08)]"
                : "text-[#334155] hover:bg-white/80 hover:text-[#0F172A]"
            }`}
          >
            <span>{item.label}</span>
            <span
              className={`h-2 w-2 rounded-full ${
                isActive ? "bg-[#22D3EE] shadow-[0_0_12px_rgba(34,211,238,0.45)]" : "bg-[#D9E4F0]"
              }`}
            />
          </Link>
        );
      })}
    </nav>
  );
}
