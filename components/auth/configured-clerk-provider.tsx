"use client";

import type { ReactNode } from "react";
import { ClerkProvider } from "@clerk/nextjs";
import { resolveClerkRouteContract } from "@/lib/auth/clerkEnvContract";

type ConfiguredClerkProviderProps = {
  children: ReactNode;
  publishableKey?: string;
};

export default function ConfiguredClerkProvider({
  children,
  publishableKey,
}: ConfiguredClerkProviderProps) {
  const resolvedPublishableKey = publishableKey ?? process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const routeContract = resolveClerkRouteContract();

  if (!resolvedPublishableKey) {
    return <>{children}</>;
  }

  return (
    <ClerkProvider
      publishableKey={resolvedPublishableKey}
      signInUrl={routeContract.signInUrl}
      signUpUrl={routeContract.signUpUrl}
      signInFallbackRedirectUrl={routeContract.signInFallbackRedirectUrl}
      signUpFallbackRedirectUrl={routeContract.signUpFallbackRedirectUrl}
    >
      {children}
    </ClerkProvider>
  );
}
