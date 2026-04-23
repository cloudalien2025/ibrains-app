type RunStatusBadgeProps = {
  status?: string | null;
};

const toneMap: Record<string, { bg: string; text: string }> = {
  running: { bg: "bg-amber-100", text: "text-amber-700" },
  queued: { bg: "bg-sky-100", text: "text-sky-700" },
  completed: { bg: "bg-emerald-100", text: "text-emerald-700" },
  failed: { bg: "bg-rose-100", text: "text-rose-700" },
  cancelled: { bg: "bg-slate-100", text: "text-slate-700" },
};

export default function RunStatusBadge({ status }: RunStatusBadgeProps) {
  const key = (status || "unknown").toLowerCase();
  const tone = toneMap[key] || { bg: "bg-[#EAF1F8]", text: "text-[#334155]" };

  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${tone.bg} ${tone.text}`}
    >
      {status || "Unknown"}
    </span>
  );
}
