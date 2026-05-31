import Link from "next/link";

const adminCards = [
  {
    title: "EcomViper Admin",
    href: "/admin/ecomviper",
    description: "Supplier intelligence operations, audit, and build history.",
    enabled: true,
  },
  {
    title: "OptiZon Admin",
    href: "#",
    description: "Placeholder for future internal operations.",
    enabled: false,
  },
  {
    title: "OptiBay Admin",
    href: "#",
    description: "Placeholder for future internal operations.",
    enabled: false,
  },
  {
    title: "DirectoryIQ Admin",
    href: "#",
    description: "Placeholder for future internal operations.",
    enabled: false,
  },
  {
    title: "CasaFlix Admin",
    href: "#",
    description: "Placeholder for future internal operations.",
    enabled: false,
  },
  {
    title: "SiteForge Admin",
    href: "#",
    description: "Placeholder for future internal operations.",
    enabled: false,
  },
] as const;

export default function AdminOverviewPage() {
  return (
    <section className="space-y-4" data-testid="admin-overview-page">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Overview</p>
        <h2 className="mt-1 text-2xl font-semibold">iBrains Admin</h2>
        <p className="mt-2 text-sm text-slate-600">
          Internal surface for platform-owned operations. Merchant routes remain on standalone brain paths.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {adminCards.map((card) => (
          <article key={card.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" data-testid="admin-app-card">
            <h3 className="text-base font-semibold">{card.title}</h3>
            <p className="mt-2 text-sm text-slate-600">{card.description}</p>
            {card.enabled ? (
              <Link href={card.href} className="mt-4 inline-flex rounded-lg border border-slate-900 bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800">
                Open
              </Link>
            ) : (
              <span className="mt-4 inline-flex rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-500">
                Coming soon
              </span>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
