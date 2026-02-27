import type { ReactNode } from "react";

type EmptyStateProps = {
  title: string;
  description: string;
  action?: ReactNode;
};

export default function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/8 via-white/4 to-transparent p-8 shadow-[0_30px_80px_rgba(15,23,42,0.45)]">
      <div className="text-xs uppercase tracking-[0.2em] text-slate-300/70">
        Ready for signal
      </div>
      <h2 className="mt-3 text-2xl font-semibold text-white">{title}</h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">
        {description}
      </p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
