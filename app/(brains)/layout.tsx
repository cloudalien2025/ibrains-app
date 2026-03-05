import "../globals.css";
import type { ReactNode } from "react";

// IMPORTANT: This layout is for brain UIs (DirectoryIQ/EcomViper/Studio) and must NOT show Mission Control nav.
export default function BrainsLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen">{children}</div>;
}
