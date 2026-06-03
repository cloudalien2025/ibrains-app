import type { ReactNode } from "react";
import ConfiguredClerkProvider from "@/components/auth/configured-clerk-provider";
import FileIqSidebar from "@/app/fileiq/_components/fileiq-sidebar";
import IbrainsWorkspaceShell from "@/components/ibrains/ibrains-workspace-shell";
import { resolveClerkRuntimeContract } from "@/lib/auth/clerkEnvContract";

export const dynamic = "force-dynamic";

export default function FileIqLayout({ children }: { children: ReactNode }) {
  const runtimeContract = resolveClerkRuntimeContract();

  return (
    <ConfiguredClerkProvider publishableKey={runtimeContract.effectivePublishableKey}>
      <IbrainsWorkspaceShell
        sidebar={<FileIqSidebar />}
        sidebarTestId="fileiq-shell-sidebar"
        workspaceTestId="fileiq-shell-workspace"
      >
        {children}
      </IbrainsWorkspaceShell>
    </ConfiguredClerkProvider>
  );
}
