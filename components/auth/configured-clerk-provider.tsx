"use client";

import type { ReactNode } from "react";
import { ClerkProvider } from "@clerk/nextjs";
import { resolveClerkRuntimeContract } from "@/lib/auth/clerkEnvContract";

type ConfiguredClerkProviderProps = {
  children: ReactNode;
};

export default function ConfiguredClerkProvider({ children }: ConfiguredClerkProviderProps) {
  const runtimeContract = resolveClerkRuntimeContract();

  if (!runtimeContract.publishableKey) {
    return <>{children}</>;
  }

  return (
    <ClerkProvider
      publishableKey={runtimeContract.publishableKey}
      proxyUrl={process.env.NEXT_PUBLIC_CLERK_PROXY_URL}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/apps"
      signUpFallbackRedirectUrl="/apps"
    >
      {children}
    </ClerkProvider>
  );
}
