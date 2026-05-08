import type { ReactNode } from "react";
import ConfiguredClerkProvider from "@/components/auth/configured-clerk-provider";
import { resolveClerkRuntimeContract } from "@/lib/auth/clerkEnvContract";

export default function AppsLayout({ children }: { children: ReactNode }) {
  const runtimeContract = resolveClerkRuntimeContract();

  return (
    <ConfiguredClerkProvider
      publishableKey={runtimeContract.publishableKey}
      proxyUrl={process.env.NEXT_PUBLIC_CLERK_PROXY_URL}
    >
      {children}
    </ConfiguredClerkProvider>
  );
}
