"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type IbrainsShellNavItem = {
  href: string;
  label: string;
  disabled?: boolean;
};

type IbrainsShellNavProps = {
  items: IbrainsShellNavItem[];
};

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function IbrainsShellNav({ items }: IbrainsShellNavProps) {
  const pathname = usePathname() || "";

  return (
    <nav className="grid gap-1" aria-label="Workspace navigation">
      {items.map((item) => {
        const active = !item.disabled && isActive(pathname, item.href);
        const className = active
          ? "block rounded-lg border border-[#B8D4FF] bg-[#EAF2FF] px-3 py-2 text-sm font-medium text-[#0F172A]"
          : "block rounded-lg border border-transparent px-3 py-2 text-sm text-[#334155] transition hover:border-[#D2E3F8] hover:bg-[#F5FAFF]";

        if (item.disabled) {
          return (
            <span
              key={`${item.href}:${item.label}`}
              className="block cursor-not-allowed rounded-lg border border-transparent px-3 py-2 text-sm text-[#94A3B8]"
            >
              {item.label}
            </span>
          );
        }

        return (
          <Link key={`${item.href}:${item.label}`} href={item.href} className={className}>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
