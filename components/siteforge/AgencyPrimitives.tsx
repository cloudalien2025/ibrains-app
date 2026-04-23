import { ReactNode } from "react";
import { AgencyStatus, ConfidenceLevel } from "@/lib/siteforge/agencyWorkspace";

function statusTone(status: AgencyStatus): string {
  if (status === "Approved" || status === "Built") return "border-emerald-300/55 bg-emerald-100 text-emerald-700";
  if (status === "Awaiting approval" || status === "Recommended") return "border-amber-300/55 bg-amber-100 text-amber-700";
  if (status === "Blocked" || status === "Needs revision") return "border-rose-300/55 bg-rose-100 text-rose-700";
  if (status === "Building") return "border-[#22D3EE]/35 bg-[#22D3EE]/12 text-[#0F172A]";
  return "border-[#D9E4F0] bg-white text-[#334155]";
}

function confidenceTone(confidence: ConfidenceLevel): string {
  if (confidence === "Verified") return "border-emerald-300/55 bg-emerald-100 text-emerald-700";
  if (confidence === "High") return "border-[#22D3EE]/35 bg-[#22D3EE]/12 text-[#0F172A]";
  if (confidence === "Medium") return "border-amber-300/55 bg-amber-100 text-amber-700";
  return "border-rose-300/55 bg-rose-100 text-rose-700";
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
    <section className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5 shadow-[0_8px_30px_rgba(15,23,42,0.08)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-[#0F172A]">{title}</h3>
          {owner ? <div className="mt-1 text-xs text-[#334155]">Owner: {owner}</div> : null}
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
      ? "border-[#2563EB] bg-[#2563EB] text-white hover:border-[#1D4ED8] hover:bg-[#1D4ED8]"
      : tone === "danger"
        ? "border-rose-300/55 bg-rose-100 text-rose-700 hover:bg-rose-200"
        : "border-[#D9E4F0] bg-white text-[#334155] hover:bg-[#F8FBFF]";
  return (
    <button type="button" className={`${base} ${toneClass} ${disabled ? "cursor-not-allowed opacity-60" : ""}`} disabled={disabled} onClick={onClick}>
      {label}
    </button>
  );
}
