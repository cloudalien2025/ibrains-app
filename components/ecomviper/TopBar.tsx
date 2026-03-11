import { ChevronRight, Search, User } from "lucide-react";

interface TopBarProps {
  breadcrumbs: string[];
  searchPlaceholder?: string;
  userLabel?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
}

export default function TopBar({
  breadcrumbs,
  searchPlaceholder = "Search product reasoning nodes...",
  userLabel = "Ariel Viper",
  searchValue,
  onSearchChange,
}: TopBarProps) {
  return (
    <header
      data-testid="ecomviper-topbar"
      className="rounded-2xl border border-cyan-300/20 bg-slate-950/55 p-4 backdrop-blur-xl shadow-[0_20px_45px_rgba(2,6,23,0.75)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-1 text-xs uppercase tracking-[0.12em] text-slate-400">
          {breadcrumbs.map((crumb, index) => (
            <span key={`${crumb}-${index}`} className="flex items-center gap-1">
              {index > 0 ? <ChevronRight className="h-3.5 w-3.5 text-cyan-300/80" /> : null}
              <span
                className={index === breadcrumbs.length - 1 ? "text-cyan-200" : "text-slate-400"}
              >
                {crumb}
              </span>
            </span>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative w-64 max-w-[60vw]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="search"
              placeholder={searchPlaceholder}
              value={searchValue}
              onChange={onSearchChange ? (event) => onSearchChange(event.target.value) : undefined}
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2 pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-500 outline-none ring-cyan-300/40 transition focus:border-cyan-300/40 focus:ring-2"
            />
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-cyan-300/25 bg-cyan-400/10 px-3 py-2 text-xs font-medium tracking-[0.08em] text-cyan-100 uppercase">
            <User className="h-4 w-4" />
            {userLabel}
          </div>
        </div>
      </div>
    </header>
  );
}
