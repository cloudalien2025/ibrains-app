import type { ReactNode } from "react";
import { requireAdmin } from "@/lib/admin/require-admin";
import AdminSidebar from "@/app/admin/_components/admin-sidebar";
import ConfiguredClerkProvider from "@/components/auth/configured-clerk-provider";
import IbrainsWorkspaceShell from "@/components/ibrains/ibrains-workspace-shell";
import { resolveClerkRuntimeContract } from "@/lib/auth/clerkEnvContract";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const adminSession = await requireAdmin({ redirectPath: "/admin" });
  const runtimeContract = resolveClerkRuntimeContract();

  return (
    <ConfiguredClerkProvider publishableKey={runtimeContract.effectivePublishableKey}>
      <IbrainsWorkspaceShell
        sidebar={
          <div className="space-y-4">
            <div className="rounded-xl border border-[#D2E3F8] bg-[#F3F8FF] p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#1D4ED8]">Internal Operations</p>
              <h1 className="mt-1 text-lg font-semibold text-[#0F172A]">iBrains Admin</h1>
              <p className="mt-1 text-xs text-[#475569]">Platform operations console.</p>
              <p
                className="mt-2 inline-flex rounded-md border border-[#CBDFF8] bg-white px-2 py-1 text-xs text-[#334155]"
                data-testid="admin-user-email"
              >
                {adminSession.email}
              </p>
            </div>
            <AdminSidebar />
          </div>
        }
        sidebarTestId="admin-shell-sidebar"
        workspaceTestId="admin-shell-workspace"
      >
        <main className="space-y-4">{children}</main>
      </IbrainsWorkspaceShell>
    </ConfiguredClerkProvider>
  );
}
