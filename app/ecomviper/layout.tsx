import type { ReactNode } from "react";
import ConfiguredClerkProvider from "@/components/auth/configured-clerk-provider";
import EcomViperSidebar from "@/components/ibrains/ecomviper-sidebar";
import IbrainsWorkspaceShell from "@/components/ibrains/ibrains-workspace-shell";
import { resolveClerkRuntimeContract } from "@/lib/auth/clerkEnvContract";

export const dynamic = "force-dynamic";

export default function EcomViperLayout({ children }: { children: ReactNode }) {
  const runtimeContract = resolveClerkRuntimeContract();

  return (
    <ConfiguredClerkProvider publishableKey={runtimeContract.effectivePublishableKey}>
      <IbrainsWorkspaceShell
        sidebar={<EcomViperSidebar />}
        sidebarTestId="ecomviper-shell-sidebar"
        workspaceTestId="ecomviper-shell-workspace"
      >
        {children}
      </IbrainsWorkspaceShell>
    </ConfiguredClerkProvider>
  );
}
