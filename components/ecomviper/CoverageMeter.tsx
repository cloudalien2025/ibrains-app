interface CoverageMeterProps {
  value: number;
}

export default function CoverageMeter({ value }: CoverageMeterProps) {
  const safeValue = Math.max(0, Math.min(100, value));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs uppercase tracking-[0.16em] text-slate-400">
        <span>Reasoning Coverage</span>
        <span className="font-semibold tracking-[0.06em] text-cyan-200">{safeValue}%</span>
      </div>
      <div className="h-3 rounded-full border border-cyan-300/25 bg-slate-900/80 p-0.5">
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,rgba(16,185,129,0.9),rgba(34,211,238,1))] shadow-[0_0_18px_rgba(20,184,166,0.45)]"
          style={{ width: `${safeValue}%` }}
        />
      </div>
    </div>
  );
}
