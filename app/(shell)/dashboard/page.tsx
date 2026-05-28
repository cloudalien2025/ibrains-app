import Link from "next/link";

const brainCards = [
  { name: "EcomViper", href: "/ecomviper" },
  { name: "OptiBay", href: "/optibay" },
  { name: "OptiWal", href: "/optiwal" },
  { name: "OptiZon", href: "/optizon" },
  { name: "DirectoryIQ", href: "/directoryiq" },
  { name: "CasaFlix", href: "/casaflix" },
  { name: "PageBolt", href: "/pagebolt" },
  { name: "Reelify", href: "/reelify" },
  { name: "iPetzo", href: "/ipetzo" },
] as const;

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-[#D9E4F0] bg-white/95 p-8 shadow-[0_18px_44px_rgba(15,23,42,0.08)]">
        <div className="text-xs uppercase tracking-[0.2em] text-[#64748B]">Workspace</div>
        <h2 className="mt-2 text-3xl font-semibold text-[#0F172A]">Brain Dashboard</h2>
        <p className="mt-2 max-w-2xl text-sm text-[#334155]">Open each standalone brain workspace from one authenticated surface.</p>
      </section>
      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" data-testid="brain-dashboard-cards">
        {brainCards.map((brain) => (
          <article key={brain.href} className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
            <h3 className="text-xl font-semibold text-[#0F172A]">{brain.name}</h3>
            <div className="mt-4">
              <Link href={brain.href} className="inline-flex rounded-full border border-[#2563EB] bg-[#2563EB] px-4 py-2 text-sm text-white transition hover:border-[#1D4ED8] hover:bg-[#1D4ED8]">
                Open Brain
              </Link>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
