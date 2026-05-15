import type { ReactNode } from "react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function ShopifyLayout({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto max-w-[1320px] px-4 py-6 sm:px-6">
      <div className="mb-4 flex items-center justify-between">
        <Link href="/apps/ecomviper" className="text-sm text-[#2563EB] hover:text-[#1D4ED8]">
          ← Back to EcomViper
        </Link>
      </div>
      {children}
    </main>
  );
}
