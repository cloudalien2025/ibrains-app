import type { ReactNode } from "react";
import DirectoryIqMobileNav from "@/components/directoryiq/DirectoryIqMobileNav";
import { directoryIqNavItems } from "@/lib/directoryiq/navItems";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default function DirectoryIqLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-[1200px] px-4 py-4 sm:px-6">
        <DirectoryIqMobileNav items={directoryIqNavItems} />
        {children}
      </div>
    </div>
  );
}
