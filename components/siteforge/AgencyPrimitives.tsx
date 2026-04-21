import { ReactNode } from "react";
import { AgencyStatus, ConfidenceLevel } from "@/lib/siteforge/agencyWorkspace";

function statusTone(status: AgencyStatus): string {
  if (status === "Approved" || status === "Built") return "border-emerald-300/45 bg-emerald-500/15 text-emerald-100";
  if (status === "Awaiting approval" || status === "Recommended") return "border-amber-300/45 bg-amber-500/15 text-amber-100";
  if (status === "Blocked" || status === "Needs revision") return "border-rose-300/45 bg-rose-500/15 text-rose-100";
  if (status === "Building") return "border-cyan-300/45 bg-cyan-500/15 text-cyan-100";
  return "border-white/20 bg-white/10 text-slate-100";
}

function confidenceTone(confidence: ConfidenceLevel): string {
  if (confidence === "Verified") return "border-emerald-300/45 bg-emerald-500/15 text-emerald-100";
  if (confidence === "High") return "border-cyan-300/45 bg-cyan-500/15 text-cyan-100";
  if (confidence === "Medium") return "border-amber-300/45 bg-amber-500/15 text-amber-100";
  return "border-rose-300/45 bg-rose-500/15 text-rose-100";
}

export function SurfaceCard({ title, owner, status, confidence, children, actions }: {
  title: string;
  owner?: string;
  status?: AgencyStatus;
  confidence?: ConfidenceLevel;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/12 bg-slate-950/60 p-5 shadow-[0_8px_30px_rgba(2,8,23,0.35)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-white">{title}</h3>
          {owner ? <div className="mt-1 text-xs text-slate-300">Owner: {owner}</div> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {status ? <span className={`rounded-full border px-2 py-1 ${statusTone(status)}`}>{status}</span> : null}
          {confidence ? <span className={`rounded-full border px-2 py-1 ${confidenceTone(confidence)}`}>{confidence}</span> : null}
        </div>
      </div>
      <div className="mt-4">{children}</div>
      {actions ? <div className="mt-4 flex flex-wrap gap-2">{actions}</div> : null}
    </section>
  );
}

export function ActionButton({ label, tone = "neutral", onClick, disabled = false }: {
  label: string;
  tone?: "neutral" | "primary" | "danger";
  onClick?: () => void;
  disabled?: boolean;
}) {
  const base = "rounded-lg border px-3 py-2 text-xs font-medium transition";
  const toneClass =
    tone === "primary"
      ? "border-cyan-300/45 bg-cyan-500/20 text-cyan-100 hover:bg-cyan-500/30"
      : tone === "danger"
        ? "border-rose-300/45 bg-rose-500/15 text-rose-100 hover:bg-rose-500/25"
        : "border-white/20 bg-white/10 text-slate-100 hover:bg-white/20";
  return (
    <button type="button" className={`${base} ${toneClass} ${disabled ? "cursor-not-allowed opacity-60" : ""}`} disabled={disabled} onClick={onClick}>
      {label}
    </button>
  );
}
