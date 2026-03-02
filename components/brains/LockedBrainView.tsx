type LockedBrainViewProps = {
  title: string;
  message: string;
  ctaLabel: string;
};

export default function LockedBrainView({ title, message, ctaLabel }: LockedBrainViewProps) {
  return (
    <div className="mx-auto flex min-h-[40vh] max-w-2xl flex-col items-start justify-center gap-3 px-4 py-10">
      <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
      <p className="text-sm text-slate-600">{message}</p>
      <button type="button" className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white">
        {ctaLabel}
      </button>
    </div>
  );
}
