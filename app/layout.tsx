import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import {
  DEV_PUBLISHABLE_KEY_FALLBACK,
  buildClerkProductionConfigError,
  resolveClerkRouteContract,
  resolveClerkRuntimeContract,
} from "@/lib/auth/clerkEnvContract";
import "./globals.css";

export const metadata: Metadata = {
  title: "iBrains",
  description: "Operational intelligence for platform teams.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const runtimeContract = resolveClerkRuntimeContract();
  const routeContract = resolveClerkRouteContract();
  const isProductionBuildPhase =
    process.env.NODE_ENV === "production" && process.env.NEXT_PHASE === "phase-production-build";

  if (runtimeContract.hasProductionConfigError && !isProductionBuildPhase) {
    throw new Error(buildClerkProductionConfigError(runtimeContract));
  }

  const publishableKey = runtimeContract.effectivePublishableKey ?? (isProductionBuildPhase ? DEV_PUBLISHABLE_KEY_FALLBACK : undefined);

  if (!publishableKey) {
    throw new Error("Clerk publishable key is required to initialize ClerkProvider.");
  }

  return (
    <html lang="en">
      <body className="antialiased">
        <ClerkProvider
          publishableKey={publishableKey}
          signInUrl={routeContract.signInUrl}
          signUpUrl={routeContract.signUpUrl}
          signInFallbackRedirectUrl={routeContract.signInFallbackRedirectUrl}
          signUpFallbackRedirectUrl={routeContract.signUpFallbackRedirectUrl}
        >
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
