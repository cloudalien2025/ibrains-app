"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navGroups = [
  {
    label: "Overview",
    links: [{ href: "/admin", label: "iBrains Admin" }],
  },
  {
    label: "EcomViper",
    links: [
      { href: "/admin/ecomviper", label: "Overview" },
      { href: "/admin/ecomviper/suppliers", label: "Suppliers" },
      { href: "/admin/ecomviper/suppliers/rocktomic", label: "Rocktomic" },
      { href: "/admin/ecomviper/suppliers/rocktomic/audit", label: "All-SKU Audit" },
      { href: "/admin/ecomviper/suppliers/rocktomic/builds", label: "Build History" },
    ],
  },
  {
    label: "Future Brains",
    links: [
      { href: "/admin/optizon", label: "OptiZon (placeholder)" },
      { href: "/admin/optibay", label: "OptiBay (placeholder)" },
      { href: "/admin/directoryiq", label: "DirectoryIQ (placeholder)" },
      { href: "/admin/casaflix", label: "CasaFlix (placeholder)" },
      { href: "/admin/siteforge", label: "SiteForge (placeholder)" },
    ],
  },
] as const;

function isActivePath(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  if (href === "/admin") return pathname === "/admin";
  return pathname.startsWith(`${href}/`);
}

export default function AdminSidebar() {
  const pathname = usePathname() || "";

  return (
    <nav className="space-y-5" aria-label="Admin navigation" data-testid="admin-sidebar">
      {navGroups.map((group) => (
        <div key={group.label} className="space-y-2">
          <p className="px-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{group.label}</p>
          <ul className="space-y-1">
            {group.links.map((link) => {
              const active = isActivePath(pathname, link.href);
              const placeholder = link.href.startsWith("/admin/") &&
                ["/admin/optizon", "/admin/optibay", "/admin/directoryiq", "/admin/casaflix", "/admin/siteforge"].includes(link.href);

              return (
                <li key={link.href}>
                  <Link
                    href={placeholder ? "/admin" : link.href}
                    className={`block rounded-lg px-3 py-2 text-sm transition ${
                      active
                        ? "bg-slate-900 text-white"
                        : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
