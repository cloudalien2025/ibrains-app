import type { ReactNode } from "react";

interface HudCardProps {
  children: ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
}

export default function HudCard({
  children,
  className = "",
  title,
  subtitle,
  actions,
}: HudCardProps) {
  return (
    <section
      className={`rounded-2xl border border-[#D9E4F0] bg-white/95 p-5 shadow-[0_18px_42px_rgba(15,23,42,0.08)] ${className}`.trim()}
    >
      {(title || subtitle || actions) && (
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-[#D9E4F0] pb-4">
          <div>
            {title ? <h2 className="text-base font-semibold text-[#0F172A]">{title}</h2> : null}
            {subtitle ? <p className="mt-1 text-sm text-[#64748B]">{subtitle}</p> : null}
          </div>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </header>
      )}
      {children}
    </section>
  );
}
