import Link from "next/link";

const apps = [
  {
    id: "studio",
    name: "Studio",
    href: "/apps/studio",
    description: "Content-generation workspace for premium listing-to-video production and narrative workflows.",
    status: "Live",
  },
  {
    id: "siteforge",
    name: "SiteForge",
    href: "/apps/siteforge",
    description: "AI-assisted site building workspace for rapid WordPress launch and iteration.",
    status: "Live",
  },
  {
    id: "directoryiq",
    name: "DirectoryIQ",
    href: "/apps/directoryiq",
    description: "Directory intelligence workspace for readiness, ingestion operations, and authority workflows.",
    status: "Live",
  },
] as const;

export default function AppsIndexPage() {
  return (
    <div className="ibrains-shell min-h-screen text-[#0F172A]">
      <div className="mx-auto max-w-6xl px-6 py-14">
        <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center rounded-full border border-[#D9E4F0] bg-[#EAF1F8] px-3 py-1 text-xs font-medium text-[#334155]">
              iBrains Apps
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#0F172A]">App Launcher</h1>
            <p className="mt-2 max-w-2xl text-sm text-[#334155]">
              Open first-class iBrains apps from a single surface.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="rounded-full border border-[#D9E4F0] bg-white px-4 py-2 text-sm text-[#0F172A] transition hover:bg-[#F8FBFF]"
            >
              Home
            </Link>
            <Link
              href="/brains"
              className="rounded-full border border-[#D9E4F0] bg-white px-4 py-2 text-sm text-[#0F172A] transition hover:bg-[#F8FBFF]"
            >
              Console
            </Link>
            <Link
              href="/sign-in"
              className="rounded-full border border-[#D9E4F0] bg-white px-4 py-2 text-sm text-[#0F172A] transition hover:bg-[#F8FBFF]"
            >
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className="rounded-full border border-[#D9E4F0] bg-white px-4 py-2 text-sm text-[#0F172A] transition hover:bg-[#F8FBFF]"
            >
              Create account
            </Link>
          </div>
        </header>

        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {apps.map((app) => (
            <article
              key={app.id}
              className="rounded-3xl border border-[#D9E4F0] bg-white/95 p-6 shadow-[0_20px_45px_rgba(15,23,42,0.08)]"
            >
              <div className="mb-3 inline-flex items-center rounded-full border border-emerald-200 bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">
                {app.status}
              </div>
              <h2 className="text-2xl font-semibold text-[#0F172A]">{app.name}</h2>
              <p className="mt-2 text-sm leading-relaxed text-[#334155]">{app.description}</p>
              <div className="mt-5">
                <Link
                  href={app.href}
                  className="inline-flex rounded-full border border-[#2563EB] bg-[#2563EB] px-4 py-2 text-sm text-white transition hover:border-[#1D4ED8] hover:bg-[#1D4ED8]"
                >
                  Open {app.name}
                </Link>
              </div>
            </article>
          ))}
        </section>
      </div>
    </div>
  );
}
