import Link from "next/link";
import type { ReactNode } from "react";

type DirectoryIqTopNavProps = {
  title?: string;
  rightSlot?: ReactNode;
  className?: string;
  connected?: boolean;
  verticalDetected?: string;
  verticalOverride?: string | null;
  lastAnalyzedAt?: string | null;
  onRefresh?: () => Promise<void> | void;
  onVerticalOverride?: (next: string | null) => Promise<void> | void;
};

export default function DirectoryIqTopNav({
  title = "DirectoryIQ",
  rightSlot,
  className,
  connected,
  verticalDetected,
  verticalOverride,
  lastAnalyzedAt,
  onRefresh,
  onVerticalOverride,
}: DirectoryIqTopNavProps) {
  return (
    <div className={`mb-4 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 ${className ?? ""}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="text-sm font-semibold text-white">{title}</div>
          <nav className="hidden items-center gap-3 text-xs text-slate-300 sm:flex">
            <Link className="hover:text-white" href="/directoryiq">Dashboard</Link>
          </nav>
          {connected !== undefined ? (
            <span className="text-xs text-slate-300">{connected ? "Connected" : "Not connected"}</span>
          ) : null}
          {verticalDetected ? <span className="text-xs text-slate-300">Vertical: {verticalOverride ?? verticalDetected}</span> : null}
          {lastAnalyzedAt ? <span className="text-xs text-slate-300">Updated: {new Date(lastAnalyzedAt).toLocaleString()}</span> : null}
        </div>
        <div className="shrink-0 flex items-center gap-2">
          {onVerticalOverride ? (
            <button
              type="button"
              onClick={() => void onVerticalOverride(null)}
              className="rounded-md border border-white/15 px-2 py-1 text-xs text-slate-200"
            >
              Auto Vertical
            </button>
          ) : null}
          {onRefresh ? (
            <button
              type="button"
              onClick={() => void onRefresh()}
              className="rounded-md border border-cyan-300/30 bg-cyan-400/10 px-2 py-1 text-xs text-cyan-100"
            >
              Refresh
            </button>
          ) : null}
          {rightSlot ? <div>{rightSlot}</div> : null}
        </div>
      </div>
    </div>
  );
}
