type LoadingStateProps = {
  title?: string;
  subtitle?: string;
};

export default function LoadingState({
  title = "Loading workspace",
  subtitle = "Preparing the latest operational telemetry.",
}: LoadingStateProps) {
  return (
    <div className="rounded-3xl border border-[#D9E4F0] bg-white/95 p-8 shadow-[0_14px_36px_rgba(15,23,42,0.08)]">
      <div className="h-2 w-24 animate-pulse rounded-full bg-[#22D3EE]/45" />
      <h2 className="mt-4 text-2xl font-semibold text-[#0F172A]">{title}</h2>
      <p className="mt-2 text-sm text-[#334155]">{subtitle}</p>
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="h-20 rounded-2xl bg-[#EAF1F8]" />
        <div className="h-20 rounded-2xl bg-[#EAF1F8]" />
        <div className="h-20 rounded-2xl bg-[#EAF1F8]" />
      </div>
    </div>
  );
}
