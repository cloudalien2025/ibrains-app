import type { ReactNode } from "react";
import DirectoryIqMobileNav from "@/components/directoryiq/DirectoryIqMobileNav";
import { directoryIqNavItems } from "@/lib/directoryiq/navItems";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default function DirectoryIqLayout({ children }: { children: ReactNode }) {
  return (
    <div className="directoryiq-app-theme ibrains-shell min-h-screen text-[#0F172A]">
      <div className="mx-auto max-w-[1280px] px-4 py-4 sm:px-6">
        <DirectoryIqMobileNav items={directoryIqNavItems} />
        {children}
      </div>
    </div>
  );
}
