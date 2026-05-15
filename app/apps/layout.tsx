import "../globals.css";
import type { ReactNode } from "react";
import ConfiguredClerkProvider from "@/components/auth/configured-clerk-provider";
import { resolveClerkRuntimeContract } from "@/lib/auth/clerkEnvContract";

export default function AppsLayout({ children }: { children: ReactNode }) {
  const runtimeContract = resolveClerkRuntimeContract();

  return (
    <ConfiguredClerkProvider publishableKey={runtimeContract.publishableKey}>
      <div className="min-h-screen text-[#0F172A]" data-testid="apps-shell-layout">
        {children}
      </div>
    </ConfiguredClerkProvider>
  );
}
