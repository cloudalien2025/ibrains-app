import type { ReactNode } from "react";
import IbrainsGlobalHeader from "@/components/ibrains/ibrains-global-header";

type IbrainsWorkspaceShellProps = {
  sidebar: ReactNode;
  children: ReactNode;
  sidebarTestId?: string;
  workspaceTestId?: string;
};

export default function IbrainsWorkspaceShell({
  sidebar,
  children,
  sidebarTestId,
  workspaceTestId,
}: IbrainsWorkspaceShellProps) {
  return (
    <div className="ibrains-shell min-h-screen text-[#0F172A]">
      <IbrainsGlobalHeader />

      <div className="mx-auto w-full max-w-[1600px] px-3 py-4 sm:px-5">
        <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside
            className="h-fit rounded-2xl border border-[#D2E3F8] bg-white p-3 shadow-[0_10px_28px_rgba(15,23,42,0.06)]"
            data-testid={sidebarTestId}
          >
            {sidebar}
          </aside>

          <section className="min-w-0" data-testid={workspaceTestId}>
            {children}
          </section>
        </div>
      </div>
    </div>
  );
}
