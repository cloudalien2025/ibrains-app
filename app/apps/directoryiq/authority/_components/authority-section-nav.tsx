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
    <section data-testid="authority-section-nav" className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <div className="flex flex-wrap gap-2 text-sm">
        {LINKS.map((link) => {
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              prefetch={false}
              className={`rounded-lg border px-3 py-1.5 ${active ? "border-cyan-300/45 bg-cyan-400/15 text-cyan-100" : "border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.07]"}`}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
