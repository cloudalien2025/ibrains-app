import type { ReactNode } from "react";
import { ClerkProvider } from "@clerk/nextjs";
import { resolveClerkRouteContract, resolveClerkRuntimeContract } from "@/lib/auth/clerkEnvContract";

type ConfiguredClerkProviderProps = {
  children: ReactNode;
};

export default function ConfiguredClerkProvider({ children }: ConfiguredClerkProviderProps) {
  const runtimeContract = resolveClerkRuntimeContract();
  const routeContract = resolveClerkRouteContract();

  if (!runtimeContract.publishableKey) {
    return <>{children}</>;
  }

  return (
    <ClerkProvider
      publishableKey={runtimeContract.publishableKey}
      signInUrl={routeContract.signInUrl}
      signUpUrl={routeContract.signUpUrl}
      signInFallbackRedirectUrl={routeContract.signInFallbackRedirectUrl}
      signUpFallbackRedirectUrl={routeContract.signUpFallbackRedirectUrl}
    >
      {children}
    </ClerkProvider>
  );
}
