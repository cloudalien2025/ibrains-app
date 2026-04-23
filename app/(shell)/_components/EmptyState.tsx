import type { ReactNode } from "react";

type EmptyStateProps = {
  title: string;
  description: string;
  action?: ReactNode;
};

export default function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="rounded-3xl border border-[#D9E4F0] bg-gradient-to-br from-white via-[#F7FBFF] to-[#EEF5FC] p-8 shadow-[0_18px_44px_rgba(15,23,42,0.08)]">
      <div className="text-xs uppercase tracking-[0.2em] text-[#64748B]">
        Ready for signal
      </div>
      <h2 className="mt-3 text-2xl font-semibold text-[#0F172A]">{title}</h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#334155]">
        {description}
      </p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
