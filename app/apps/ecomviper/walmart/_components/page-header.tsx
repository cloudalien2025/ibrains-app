import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  subtitle: string;
  mode?: string;
  actions?: ReactNode;
}

export default function WalmartPageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <header className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="inline-flex items-center rounded-full border border-[#D9E4F0] bg-[#EFF4F9] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#475569]">
            Walmart Marketplace
          </div>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-[#0F172A]">{title}</h1>
          <p className="mt-1 text-sm text-[#475569]">{subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-[#D9E4F0] bg-[#F8FBFF] px-3 py-1 text-xs font-medium text-[#334155]" data-testid="ecomviper-mode-badge">
            Environment: Production
          </span>
          {actions}
        </div>
      </div>
    </header>
  );
}
