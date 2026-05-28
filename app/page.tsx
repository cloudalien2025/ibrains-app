import Link from "next/link";
import FrontdoorHeaderActions from "@/components/frontdoor/frontdoor-header-actions";
import HomepageHealthPanel from "@/components/frontdoor/homepage-health-panel";

export const dynamic = "force-dynamic";

const DEFAULT_WORKER_URL = "https://api.ibrains.ai";

export default function Home() {
  const workerUrl =
    (process.env.NEXT_PUBLIC_WORKER_URL || "").trim() || DEFAULT_WORKER_URL;

  return (
    <div className="ibrains-shell min-h-screen text-[#0F172A]">
      <div className="mx-auto max-w-5xl px-6 py-16">
        <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="inline-flex items-center">
            <span className="inline-flex items-center rounded-full border border-[#D9E4F0] bg-white px-3 py-1 text-xs font-medium text-[#2563EB]">
              Platform Intelligence Engine
            </span>
          </div>
          <FrontdoorHeaderActions currentPath="/" />
        </div>

        <div className="rounded-3xl border border-[#D9E4F0] bg-white/95 p-10 shadow-[0_24px_56px_rgba(15,23,42,0.09)]">
          <div className="rounded-2xl bg-[linear-gradient(135deg,rgba(37,99,235,0.10)_0%,rgba(34,211,238,0.08)_45%,rgba(255,255,255,0)_100%)] p-6">
            <h1 className="text-4xl font-semibold tracking-tight text-[#0F172A]">iBrains</h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-[#334155]">
              iBrains is building the intelligence layer for complex platforms.
              First specialization: <span className="font-semibold text-[#0F172A]">Brilliant Directories Brain</span>.
            </p>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-2xl border border-[#D9E4F0] bg-[#EAF1F8]/75 p-5">
              <div className="text-xs text-[#64748B]">Brains</div>
              <div className="mt-1 text-sm font-medium text-[#0F172A]">DirectoryIQ + PageBolt</div>
              <div className="mt-2 text-xs text-[#64748B]">Integrated under the iBrains brain workspace launcher.</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href="/directoryiq"
                  className="rounded-full border border-[#D9E4F0] bg-white px-3 py-1.5 text-xs text-[#334155] transition hover:bg-[#F8FBFF]"
                >
                  Open DirectoryIQ
                </Link>
                <Link
                  href="/pagebolt"
                  className="rounded-full border border-[#D9E4F0] bg-white px-3 py-1.5 text-xs text-[#334155] transition hover:bg-[#F8FBFF]"
                >
                  Open PageBolt
                </Link>
              </div>
            </div>
          </div>

          <HomepageHealthPanel workerUrl={workerUrl} />

          <div className="mt-10 text-xs text-[#64748B]">© iBrains</div>
        </div>
      </div>
    </div>
  );
}
