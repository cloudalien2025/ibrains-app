import type { ReactNode } from "react";
import ConfiguredClerkProvider from "@/components/auth/configured-clerk-provider";
import { resolveClerkRuntimeContract } from "@/lib/auth/clerkEnvContract";

export const dynamic = "force-dynamic";

export default function FileIqLayout({ children }: { children: ReactNode }) {
  const runtimeContract = resolveClerkRuntimeContract();
  return (
    <ConfiguredClerkProvider publishableKey={runtimeContract.effectivePublishableKey}>
      {children}
    </ConfiguredClerkProvider>
  );
}
