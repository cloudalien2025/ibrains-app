import StoryboardClient from "./storyboard-client";

type EntityPageProps = {
  params: Promise<{ entityType: string; entityId: string }>;
};

export default async function EntityPage({ params }: EntityPageProps) {
  const { entityType, entityId } = await params;

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-white/10 bg-white/5 p-8 shadow-[0_30px_70px_rgba(2,6,23,0.5)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-slate-300/70">
              Entity Reasoning Hub
            </div>
            <h2 className="mt-2 text-3xl font-semibold text-white">
              {entityType} / {entityId}
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-300">
              Visual storyboard scoring, prompt pack status, and run outputs.
            </p>
          </div>
        </div>
      </section>

      <StoryboardClient entityType={entityType} entityId={entityId} />
    </div>
  );
}
