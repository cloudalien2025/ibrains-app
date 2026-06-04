import BackToBrainsLink from "@/components/brains/back-to-brains-link";

export const dynamic = "force-dynamic";

export default function EcomViperAmazonPlaceholderPage() {
  return (
    <main className="ibrains-shell min-h-screen text-[#0F172A]">
      <div className="mx-auto max-w-[1320px] px-4 py-6 sm:px-6">
        <div className="mb-4 flex items-center justify-between">
          <BackToBrainsLink />
          <div className="inline-flex items-center rounded-full border border-[#D9E4F0] bg-white/90 px-3 py-1 text-xs text-[#475569]">
            OptiZon Brain Console
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[236px_minmax(0,1fr)]">
          <aside className="rounded-2xl border border-[#D9E4F0] bg-white/90 p-3 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
            <div className="mb-3 border-b border-[#E2E8F0] pb-3">
              <p className="text-[11px] uppercase tracking-[0.16em] text-[#64748B]">OPTIZON</p>
              <h2 className="mt-1 text-base font-semibold text-[#0F172A]">Marketplace Workspace</h2>
              <p className="mt-1 text-xs text-[#64748B]">Amazon lane planning and launch readiness.</p>
            </div>
          </aside>

          <section className="space-y-4">
            <section className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-8 shadow-[0_18px_42px_rgba(15,23,42,0.08)]">
              <h1 className="text-3xl font-semibold text-[#0F172A]">OptiZon marketplace module is coming soon</h1>
              <p className="mt-2 text-sm text-[#475569]">This placeholder route is reserved for the next OptiZon marketplace lane.</p>
            </section>
          </section>
        </div>
      </div>
    </main>
  );
}
