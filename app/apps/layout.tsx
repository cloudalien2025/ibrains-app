import type { ReactNode } from "react";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import ConfiguredClerkProvider from "@/components/auth/configured-clerk-provider";
import { resolveClerkRuntimeContract } from "@/lib/auth/clerkEnvContract";

export default async function AppsLayout({ children }: { children: ReactNode }) {
  const e2eMockGraph = process.env.E2E_MOCK_GRAPH === "1";
  const runtimeContract = resolveClerkRuntimeContract();
  const { userId } = e2eMockGraph ? { userId: "e2e-admin" } : await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  return (
    <ConfiguredClerkProvider publishableKey={runtimeContract.publishableKey}>
      {children}
    </ConfiguredClerkProvider>
  );
}
