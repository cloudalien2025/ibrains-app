type LoadingStateProps = {
  title?: string;
  subtitle?: string;
};

export default function LoadingState({
  title = "Loading workspace",
  subtitle = "Preparing the latest operational telemetry.",
}: LoadingStateProps) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
      <div className="h-2 w-24 animate-pulse rounded-full bg-white/20" />
      <h2 className="mt-4 text-2xl font-semibold text-white">{title}</h2>
      <p className="mt-2 text-sm text-slate-300">{subtitle}</p>
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="h-20 rounded-2xl bg-white/5" />
        <div className="h-20 rounded-2xl bg-white/5" />
        <div className="h-20 rounded-2xl bg-white/5" />
      </div>
    </div>
  );
}
