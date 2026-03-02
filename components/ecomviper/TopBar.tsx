import type { ReactNode } from "react";

type TopBarProps = {
  title?: string;
  subtitle?: string;
  leftSlot?: ReactNode;
  rightSlot?: ReactNode;
  className?: string;
};

export default function TopBar({ title, subtitle, leftSlot, rightSlot, className }: TopBarProps) {
  return (
    <header className={`rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 ${className ?? ""}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {leftSlot ? <div className="shrink-0">{leftSlot}</div> : null}
          <div>
            {title ? <div className="text-sm font-semibold text-white">{title}</div> : null}
            {subtitle ? <div className="text-xs text-slate-300">{subtitle}</div> : null}
          </div>
        </div>
        {rightSlot ? <div className="shrink-0">{rightSlot}</div> : null}
      </div>
    </header>
  );
}
