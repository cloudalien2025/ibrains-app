"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

type NavItem = {
  href: string;
  label: string;
};

export default function DirectoryIqMobileNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <section className="lg:hidden" data-testid="directoryiq-mobile-header">
      <div className="rounded-xl border border-cyan-300/20 bg-slate-950/60 px-3 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <span className="min-w-0 truncate text-sm font-semibold tracking-[0.08em] text-cyan-100">DirectoryIQ</span>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-slate-100"
            aria-label="Toggle DirectoryIQ navigation"
            aria-expanded={open}
            data-testid="directoryiq-mobile-menu-trigger"
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>

        {open ? (
          <nav className="mt-2 grid gap-2">
            {items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-lg border px-3 py-2 text-sm ${
                    active
                      ? "border-cyan-300/40 bg-cyan-400/12 text-cyan-100"
                      : "border-white/10 bg-white/[0.03] text-slate-200"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        ) : null}
      </div>
    </section>
  );
}
