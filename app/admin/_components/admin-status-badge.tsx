interface AdminStatusBadgeProps {
  status: string;
}

const STATUS_STYLES: Record<string, string> = {
  pass: "border-emerald-200 bg-emerald-50 text-emerald-700",
  pass_with_warnings: "border-amber-200 bg-amber-50 text-amber-700",
  fail: "border-rose-200 bg-rose-50 text-rose-700",
  ready: "border-emerald-200 bg-emerald-50 text-emerald-700",
  usable: "border-emerald-200 bg-emerald-50 text-emerald-700",
  usable_with_warnings: "border-amber-200 bg-amber-50 text-amber-700",
  blocked: "border-rose-200 bg-rose-50 text-rose-700",
  extraction_error: "border-rose-200 bg-rose-50 text-rose-700",
  synced: "border-emerald-200 bg-emerald-50 text-emerald-700",
  healthy: "border-emerald-200 bg-emerald-50 text-emerald-700",
  partial: "border-amber-200 bg-amber-50 text-amber-700",
  degraded: "border-amber-200 bg-amber-50 text-amber-700",
  missing: "border-slate-200 bg-slate-100 text-slate-700",
  extraction_failed: "border-rose-200 bg-rose-50 text-rose-700",
  sync_failed: "border-rose-200 bg-rose-50 text-rose-700",
  extraction_needed: "border-amber-200 bg-amber-50 text-amber-700",
  not_applicable: "border-slate-200 bg-slate-100 text-slate-700",
  present: "border-emerald-200 bg-emerald-50 text-emerald-700",
  source_error: "border-rose-200 bg-rose-50 text-rose-700",
  unreferenced: "border-slate-200 bg-slate-100 text-slate-700",
};

export default function AdminStatusBadge({ status }: AdminStatusBadgeProps) {
  const normalized = status.trim().toLowerCase();
  const className = STATUS_STYLES[normalized] || "border-slate-200 bg-slate-100 text-slate-700";

  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${className}`}>
      {status}
    </span>
  );
}
