import Link from "next/link";

export const dynamic = "force-dynamic";

const studioApps = [
  {
    id: "casaflix",
    name: "CasaFlix",
    description: "Real-estate YouTube content engine.",
    status: "Active",
    href: "/apps/studio/casaflix",
    actionLabel: "Open CasaFlix",
    disabled: false,
  },
  {
    id: "uap-forge",
    name: "UAP Forge",
    description: "UAP video and story creation engine.",
    status: "Coming Soon",
    href: "/apps/studio/uap-forge",
    actionLabel: "Coming Soon",
    disabled: true,
  },
  {
    id: "future-apps",
    name: "Future Studio Apps",
    description: "Reserved for upcoming media engines and operator tools.",
    status: "Planned",
    href: "/apps/studio",
    actionLabel: "Planned",
    disabled: true,
  },
] as const;

function statusClasses(status: string) {
  if (status === "Active") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "Coming Soon") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

export default function StudioAppPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(189,212,229,0.35),transparent_38%),linear-gradient(180deg,#F8FBFD_0%,#F2F5F9_100%)] text-[#0F172A]">
      <div className="mx-auto max-w-6xl px-6 py-14 md:px-8">
        <section
          className="rounded-[2rem] border border-[#D9E4F0] bg-white/90 p-8 shadow-[0_28px_60px_rgba(15,23,42,0.08)]"
          data-testid="studio-app-launcher"
        >
          <div className="inline-flex rounded-full border border-[#D7E3EF] bg-[#EFF4F9] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#475569]">
            Studio
          </div>
          <h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-[#0F172A]">Studio</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#475569]">
            AI media and content engines for iBrains.
          </p>
        </section>

        <section className="mt-8 grid gap-5 lg:grid-cols-3">
          {studioApps.map((app) => (
            <article
              key={app.id}
              className="rounded-[1.75rem] border border-[#D9E4F0] bg-white/95 p-6 shadow-[0_20px_45px_rgba(15,23,42,0.08)]"
              data-testid={app.id === "casaflix" ? "studio-app-card-casaflix" : app.id === "uap-forge" ? "studio-app-card-uap-forge" : undefined}
            >
              <div className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusClasses(app.status)}`}>
                {app.status}
              </div>
              <h2 className="mt-4 text-2xl font-semibold tracking-[-0.03em] text-[#0F172A]">{app.name}</h2>
              <p className="mt-3 text-sm leading-6 text-[#475569]">{app.description}</p>
              <div className="mt-6">
                {app.disabled ? (
                  <span
                    aria-disabled="true"
                    className="inline-flex rounded-full border border-[#D8E0E8] bg-[#F8FAFC] px-4 py-2 text-sm font-medium text-[#64748B]"
                  >
                    {app.actionLabel}
                  </span>
                ) : (
                  <Link
                    href={app.href}
                    className="inline-flex rounded-full border border-[#0F172A] bg-[#0F172A] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#1E293B]"
                  >
                    {app.actionLabel}
                  </Link>
                )}
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
