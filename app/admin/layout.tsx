import type { ReactNode } from "react";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin/require-admin";
import AdminSidebar from "@/app/admin/_components/admin-sidebar";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const adminSession = await requireAdmin({ redirectPath: "/admin" });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900" data-testid="ibrains-admin-layout">
      <div className="mx-auto flex w-full max-w-7xl gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <aside className="hidden w-72 shrink-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:block">
          <div className="mb-6 space-y-2 border-b border-slate-100 pb-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Internal Operations</p>
            <h1 className="text-xl font-semibold">iBrains Admin</h1>
            <p className="text-sm text-slate-600">Platform-level operations console.</p>
          </div>
          <AdminSidebar />
        </aside>

        <div className="min-w-0 flex-1 space-y-4">
          <header className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm sm:px-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">iBrains Internal</p>
                <p className="text-base font-semibold">Admin Console</p>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1" data-testid="admin-user-email">
                  {adminSession.email}
                </span>
                <Link href="/brains" className="rounded-full border border-slate-200 bg-white px-3 py-1 hover:bg-slate-100">
                  iBrains Dashboard
                </Link>
              </div>
            </div>
            <div className="mt-3 block md:hidden">
              <AdminSidebar />
            </div>
          </header>

          <main className="space-y-4">{children}</main>
        </div>
      </div>
    </div>
  );
}
