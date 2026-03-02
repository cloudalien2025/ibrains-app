import Link from "next/link";
import type { ReactNode } from "react";

type DirectoryIqTopNavProps = {
  title?: string;
  rightSlot?: ReactNode;
  className?: string;
};

export default function DirectoryIqTopNav({ title = "DirectoryIQ", rightSlot, className }: DirectoryIqTopNavProps) {
  return (
    <div className={`mb-4 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 ${className ?? ""}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="text-sm font-semibold text-white">{title}</div>
          <nav className="hidden items-center gap-3 text-xs text-slate-300 sm:flex">
            <Link className="hover:text-white" href="/directoryiq">Dashboard</Link>
          </nav>
        </div>
        {rightSlot ? <div className="shrink-0">{rightSlot}</div> : null}
      </div>
    </div>
  );
}
