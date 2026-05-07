import type { ReactNode } from "react";
import ConfiguredClerkProvider from "@/components/auth/configured-clerk-provider";

export default function AppsLayout({ children }: { children: ReactNode }) {
  return <ConfiguredClerkProvider>{children}</ConfiguredClerkProvider>;
}
