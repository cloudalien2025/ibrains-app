"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/apps/directoryiq/authority", label: "Overview" },
  { href: "/apps/directoryiq/authority/blogs", label: "Blog Posts" },
  { href: "/apps/directoryiq/authority/listings", label: "Listings" },
  { href: "/apps/directoryiq/authority/integrity", label: "Integrity" },
  { href: "/apps/directoryiq/authority/authority-support", label: "Leak Scanner" },
];

export default function AuthoritySectionNav() {
  const pathname = usePathname();

  return (
    <section data-testid="authority-section-nav" className="rounded-xl border border-[#D9E4F0] bg-white/95 p-3">
      <div className="flex flex-wrap gap-2 text-sm">
        {LINKS.map((link) => {
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              prefetch={false}
              className={`rounded-lg border px-3 py-1.5 ${active ? "border-[#93C5FD] bg-[#DBEAFE] text-[#1D4ED8]" : "border-[#D9E4F0] bg-white text-[#334155] hover:bg-[#F8FBFF]"}`}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
