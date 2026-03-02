"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/brains", label: "Brains" },
  { href: "/runs", label: "Runs" },
  { href: "/ssc", label: "Ferrari" },
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
                ? "bg-white/12 text-white shadow-[0_10px_30px_rgba(15,23,42,0.45)]"
                : "text-slate-300 hover:bg-white/5 hover:text-white"
            }`}
          >
            <span>{item.label}</span>
            <span
              className={`h-2 w-2 rounded-full ${
                isActive ? "bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.6)]" : "bg-white/15"
              }`}
            />
          </Link>
        );
      })}
    </nav>
  );
}
