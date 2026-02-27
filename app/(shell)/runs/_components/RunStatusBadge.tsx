type RunStatusBadgeProps = {
  status?: string | null;
};

const toneMap: Record<string, { bg: string; text: string }> = {
  running: { bg: "bg-amber-400/15", text: "text-amber-200" },
  queued: { bg: "bg-sky-400/15", text: "text-sky-200" },
  completed: { bg: "bg-emerald-400/15", text: "text-emerald-200" },
  failed: { bg: "bg-rose-400/15", text: "text-rose-200" },
  cancelled: { bg: "bg-zinc-400/20", text: "text-zinc-200" },
};

export default function RunStatusBadge({ status }: RunStatusBadgeProps) {
  const key = (status || "unknown").toLowerCase();
  const tone = toneMap[key] || { bg: "bg-white/10", text: "text-slate-200" };

  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${tone.bg} ${tone.text}`}
    >
      {status || "Unknown"}
    </span>
  );
}
