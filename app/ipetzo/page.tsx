export const dynamic = "force-dynamic";

export default function IPetzoPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10" data-testid="ipetzo-brain-page">
      <section className="rounded-[2rem] border border-[#D9E4F0] bg-white/95 p-8 shadow-[0_24px_56px_rgba(15,23,42,0.08)]">
        <div className="inline-flex rounded-full border border-[#D9E4F0] bg-[#EFF4F9] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#475569]">
          iPetzo
        </div>
        <h1 className="mt-4 text-4xl font-semibold tracking-[-0.03em] text-[#0F172A]">iPetzo Brain Workspace</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[#475569]">
          iPetzo is mounted as an independent top-level brain workspace. Product workflows continue in upcoming implementation sprints.
        </p>
      </section>
    </main>
  );
}
