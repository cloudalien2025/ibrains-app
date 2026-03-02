import type { ReactNode } from "react";

type HudCardProps = {
  title?: string;
  subtitle?: string;
  rightSlot?: ReactNode;
  className?: string;
  children: ReactNode;
};

export default function HudCard({ title, subtitle, rightSlot, className, children }: HudCardProps) {
  return (
    <section className={`rounded-xl border border-white/10 bg-white/[0.03] p-4 ${className ?? ""}`}>
      {(title || rightSlot) && (
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            {title ? <h2 className="text-sm font-semibold text-white">{title}</h2> : null}
            {subtitle ? <p className="mt-0.5 text-xs text-slate-300">{subtitle}</p> : null}
          </div>
          {rightSlot ? <div className="shrink-0">{rightSlot}</div> : null}
        </div>
      )}
      <div className="text-slate-200">{children}</div>
    </section>
  );
}
