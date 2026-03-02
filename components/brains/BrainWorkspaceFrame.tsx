import { ReactNode } from "react";
import BrainSidebarNav from "@/components/brains/BrainSidebarNav";

type NavItem = {
  href: string;
  label: string;
};

type BrainWorkspaceFrameProps = {
  brainLabel: string;
  subtitle?: string;
  navItems: NavItem[];
  children: ReactNode;
};

export default function BrainWorkspaceFrame({
  brainLabel,
  subtitle,
  navItems,
  children,
}: BrainWorkspaceFrameProps) {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <header className="mb-6 space-y-1">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-400">{brainLabel}</p>
        {subtitle ? <p className="text-sm text-slate-500">{subtitle}</p> : null}
      </header>
      <div className="grid gap-6 md:grid-cols-[220px_minmax(0,1fr)]">
        <aside>
          <BrainSidebarNav items={navItems} />
        </aside>
        <main>{children}</main>
      </div>
    </div>
  );
}
