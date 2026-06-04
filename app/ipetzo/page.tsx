import Link from "next/link";
import BackToBrainsLink from "@/components/brains/back-to-brains-link";

export const dynamic = "force-dynamic";

export default function IPetzoPage() {
  return (
    <main className="ibrains-shell min-h-screen text-[#0F172A]" data-testid="ipetzo-brain-page">
      <div className="mx-auto max-w-[1320px] px-4 py-6 sm:px-6">
        <div className="mb-4 flex items-center justify-between">
          <BackToBrainsLink />
          <div className="inline-flex items-center rounded-full border border-[#D9E4F0] bg-white/90 px-3 py-1 text-xs text-[#475569]">
            iPetzo Brain Console
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[236px_minmax(0,1fr)]">
          <aside
            className="rounded-2xl border border-[#D9E4F0] bg-white/90 p-3 shadow-[0_12px_30px_rgba(15,23,42,0.06)]"
            data-testid="ipetzo-brain-sidebar"
          >
            <div className="mb-3 border-b border-[#E2E8F0] pb-3">
              <p className="text-[11px] uppercase tracking-[0.16em] text-[#64748B]">IPETZO</p>
              <h2 className="mt-1 text-base font-semibold text-[#0F172A]">Brain Workspace</h2>
              <p className="mt-1 text-xs text-[#64748B]">Pet-intelligence operations and roadmap controls.</p>
            </div>
            <nav className="grid gap-1" aria-label="iPetzo workspace navigation">
              <Link href="/ipetzo" className="rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-2 text-sm text-[#0F172A]">
                Overview
              </Link>
              <Link href="/brains" className="rounded-lg border border-transparent px-3 py-2 text-sm text-[#334155] transition hover:border-[#D9E4F0] hover:bg-white">
                My Brains
              </Link>
            </nav>
          </aside>

          <section className="space-y-4" data-testid="ipetzo-brain-workspace">
            <section className="rounded-[2rem] border border-[#D9E4F0] bg-white/95 p-8 shadow-[0_24px_56px_rgba(15,23,42,0.08)]">
              <div className="inline-flex rounded-full border border-[#D9E4F0] bg-[#EFF4F9] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#475569]">
                iPetzo
              </div>
              <h1 className="mt-4 text-4xl font-semibold tracking-[-0.03em] text-[#0F172A]">iPetzo Brain Workspace</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[#475569]">
                iPetzo is mounted as an independent top-level brain workspace. Product workflows continue in upcoming implementation sprints.
              </p>
            </section>
          </section>
        </div>
      </div>
    </main>
  );
}
