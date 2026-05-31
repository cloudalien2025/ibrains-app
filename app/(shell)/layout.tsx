import type { ReactNode } from "react";
import { auth } from "@clerk/nextjs/server";
import ConfiguredClerkProvider from "@/components/auth/configured-clerk-provider";
import IbrainsGlobalHeader from "@/components/ibrains/ibrains-global-header";
import { resolveClerkRuntimeContract } from "@/lib/auth/clerkEnvContract";
import { resolveVerifiedClerkSessionUserId } from "@/lib/auth/clerkSessionToken";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ShellLayout({ children }: { children: ReactNode }) {
  const e2eMockGraph = process.env.E2E_MOCK_GRAPH === "1";
  const runtimeContract = resolveClerkRuntimeContract();

  if (!e2eMockGraph && runtimeContract.hasProductionConfigError) {
    redirect("/sign-in");
  }

  let userId: string | null = null;
  if (e2eMockGraph) {
    userId = "e2e-admin";
  } else {
    try {
      ({ userId } = await auth());
    } catch {
      userId = null;
    }

    if (!userId) {
      userId = await resolveVerifiedClerkSessionUserId();
    }
  }

  if (!userId) {
    redirect("/sign-in");
  }

  return (
    <ConfiguredClerkProvider publishableKey={runtimeContract.effectivePublishableKey}>
      <div className="ibrains-shell min-h-screen text-[#0F172A]" data-testid="ibrains-shell-layout">
        <IbrainsGlobalHeader />
        <main className="mx-auto w-full max-w-[1600px] px-3 py-4 sm:px-5">{children}</main>
      </div>
    </ConfiguredClerkProvider>
  );
}
