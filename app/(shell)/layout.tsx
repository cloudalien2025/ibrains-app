import type { ReactNode } from "react";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import ConfiguredClerkProvider from "@/components/auth/configured-clerk-provider";
import { resolveClerkRuntimeContract } from "@/lib/auth/clerkEnvContract";
import { resolveVerifiedClerkSessionUserId } from "@/lib/auth/clerkSessionToken";
import { redirect } from "next/navigation";
import SideNav from "./_components/SideNav";

export const dynamic = "force-dynamic";

export default async function ShellLayout({ children }: { children: ReactNode }) {
  const e2eMockGraph = process.env.E2E_MOCK_GRAPH === "1";
  const runtimeContract = resolveClerkRuntimeContract();

  if (!e2eMockGraph && runtimeContract.hasProductionConfigError) {
    redirect("/sign-in");
  }

  let userId: string | null = null;
  if (e2eMockGraph) {
    userId = "e2e-admin";
  } else {
    try {
      ({ userId } = await auth());
    } catch {
      userId = null;
    }

    if (!userId) {
      userId = await resolveVerifiedClerkSessionUserId();
    }
  }
  if (!userId) {
    redirect("/sign-in");
  }

  return (
    <ConfiguredClerkProvider publishableKey={runtimeContract.publishableKey}>
      <div className="ecomviper-hud min-h-screen text-[#0F172A]">
        <div className="ecomviper-vignette pointer-events-none fixed inset-0" />
        <div className="ecomviper-grid pointer-events-none fixed inset-0 opacity-40" />

        <div className="relative mx-auto flex min-h-screen max-w-7xl gap-6 px-6 py-8">
          <aside className="hidden w-64 flex-col gap-8 rounded-[28px] border border-[#D9E4F0] bg-white/95 p-6 shadow-[0_22px_52px_rgba(15,23,42,0.09)] lg:flex">
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-[0.2em] text-[#64748B]">
                iBrains
              </div>
              <div className="text-2xl font-semibold text-[#0F172A]">Mission Control</div>
              <p className="text-sm text-[#334155]">
                Live command center for brains, runs, and operational telemetry.
              </p>
            </div>
            <SideNav />
            <div className="mt-auto rounded-2xl border border-[#D9E4F0] bg-[#EAF1F8]/80 p-4 text-xs text-[#334155]">
              <div className="uppercase tracking-[0.2em] text-[#64748B]">Status</div>
              <div className="mt-2 text-sm text-[#0F172A]">Worker link active</div>
              <div className="mt-1 text-[11px] text-[#64748B]">
                Check <span className="font-mono">/api/health</span> for upstream state.
              </div>
            </div>
          </aside>

          <div className="flex min-w-0 flex-1 flex-col gap-6">
            <header className="flex flex-wrap items-center justify-between gap-4 rounded-[28px] border border-[#D9E4F0] bg-white/95 px-6 py-4 shadow-[0_18px_44px_rgba(15,23,42,0.08)]">
              <div className="space-y-1">
                <div className="text-xs uppercase tracking-[0.2em] text-[#64748B]">
                  Operational Intelligence
                </div>
                <h1 className="text-2xl font-semibold text-[#0F172A]">iBrains Console</h1>
              </div>
              <div className="flex items-center gap-3 text-sm text-[#334155]">
                <div className="hidden items-center gap-2 rounded-full border border-[#D9E4F0] bg-[#EAF1F8]/80 px-3 py-1 sm:flex">
                  <span className="h-2 w-2 rounded-full bg-[#22D3EE]" />
                  Live system
                </div>
                <Link
                  href="/"
                  className="rounded-full border border-[#D9E4F0] bg-white px-4 py-2 text-sm text-[#0F172A] transition hover:bg-[#F8FBFF]"
                >
                  Home
                </Link>
                <div className="rounded-full border border-[#D9E4F0] bg-white px-3 py-1 text-xs text-[#334155]">
                  {e2eMockGraph ? "E2E Admin" : "Signed in"}
                </div>
                <Link
                  href="/settings"
                  className="rounded-full border border-[#D9E4F0] bg-white px-4 py-2 text-sm text-[#0F172A] transition hover:bg-[#F8FBFF]"
                >
                  Account
                </Link>
              </div>
            </header>

            <main className="min-w-0 flex-1">{children}</main>
          </div>
        </div>
      </div>
    </ConfiguredClerkProvider>
  );
}
