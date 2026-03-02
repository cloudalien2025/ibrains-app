import type { ReactNode } from "react";

type TopBarProps = {
  title?: string;
  subtitle?: string;
  leftSlot?: ReactNode;
  rightSlot?: ReactNode;
  className?: string;
  breadcrumbs?: string[];
  searchPlaceholder?: string;
};

export default function TopBar({
  title,
  subtitle,
  leftSlot,
  rightSlot,
  className,
  breadcrumbs,
  searchPlaceholder,
}: TopBarProps) {
  const resolvedTitle = title ?? (breadcrumbs && breadcrumbs.length > 0 ? breadcrumbs[breadcrumbs.length - 1] : undefined);
  const resolvedSubtitle = subtitle ?? (breadcrumbs && breadcrumbs.length > 0 ? breadcrumbs.join(" / ") : undefined);
  return (
    <header className={`rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 ${className ?? ""}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {leftSlot ? <div className="shrink-0">{leftSlot}</div> : null}
          <div>
            {resolvedTitle ? <div className="text-sm font-semibold text-white">{resolvedTitle}</div> : null}
            {resolvedSubtitle ? <div className="text-xs text-slate-300">{resolvedSubtitle}</div> : null}
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          {searchPlaceholder ? (
            <input
              aria-label={searchPlaceholder}
              placeholder={searchPlaceholder}
              className="w-56 rounded-md border border-white/15 bg-white/5 px-2 py-1 text-xs text-slate-100 placeholder:text-slate-400"
            />
          ) : null}
          {rightSlot ? <div>{rightSlot}</div> : null}
        </div>
      </div>
    </header>
  );
}
