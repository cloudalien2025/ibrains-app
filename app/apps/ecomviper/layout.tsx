import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

export default function EcomViperLayout({ children }: { children: ReactNode }) {
  return <div className="ibrains-shell min-h-screen text-[#0F172A]">{children}</div>;
}
