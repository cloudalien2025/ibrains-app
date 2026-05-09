interface StatusBadgeProps {
  status: string;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const normalized = status.toLowerCase();
  const cls =
    normalized === "active" ||
      normalized === "connected" ||
      normalized === "processed" ||
      normalized === "synced" ||
      normalized === "granted"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : normalized === "warning" ||
          normalized === "received" ||
          normalized === "inprogress" ||
          normalized === "validated" ||
          normalized === "token valid"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : normalized === "foundation" ||
            normalized === "separate integration required"
          ? "border-amber-200 bg-amber-50 text-amber-700"
        : normalized === "error" || normalized === "failed" || normalized === "not connected" || normalized === "missing"
          ? "border-rose-200 bg-rose-50 text-rose-700"
          : "border-slate-200 bg-slate-50 text-slate-600";

  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${cls}`}>{status}</span>;
}
