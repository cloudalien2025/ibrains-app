"use client";

import type { ReactNode } from "react";
import { ClerkProvider } from "@clerk/nextjs";

type ConfiguredClerkProviderProps = {
  children: ReactNode;
  proxyUrl?: string;
  publishableKey?: string;
};

export default function ConfiguredClerkProvider({
  children,
  proxyUrl,
  publishableKey,
}: ConfiguredClerkProviderProps) {
  const resolvedPublishableKey = publishableKey ?? process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const resolvedProxyUrl = (proxyUrl ?? process.env.NEXT_PUBLIC_CLERK_PROXY_URL)?.trim();

  if (!resolvedPublishableKey) {
    return <>{children}</>;
  }

  return (
    <ClerkProvider
      publishableKey={resolvedPublishableKey}
      {...(resolvedProxyUrl ? { proxyUrl: resolvedProxyUrl } : {})}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/apps"
      signUpFallbackRedirectUrl="/apps"
    >
      {children}
    </ClerkProvider>
  );
}
