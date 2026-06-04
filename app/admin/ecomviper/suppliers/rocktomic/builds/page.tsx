import Link from "next/link";
import AdminStatusBadge from "@/app/admin/_components/admin-status-badge";
import { getSupplierBuildHistory } from "@/lib/admin/ecomviper/supplier-intelligence";
import { safeIsoDate } from "@/lib/ui/safe-formatters";

export default async function RocktomicBuildHistoryPage() {
  const runs = await getSupplierBuildHistory("rocktomic", { limit: 100 });

  return (
    <section className="space-y-4" data-testid="admin-rocktomic-builds-page">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Admin / EcomViper / Rocktomic / Builds</p>
        <h2 className="mt-1 text-2xl font-semibold">Build History</h2>
        <p className="mt-2 text-sm text-slate-600">Read-only sync/build run history. This view does not trigger source sync/build execution.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/admin/ecomviper/suppliers/rocktomic" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-100">
            Back to Supplier Summary
          </Link>
          <Link href="/admin/ecomviper/suppliers/rocktomic/audit" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-100">
            Open All-SKU Audit
          </Link>
        </div>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm" data-testid="admin-rocktomic-build-history-table">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.12em] text-slate-500">
                <th className="py-2 pr-3">Run ID</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Started</th>
                <th className="py-2 pr-3">Finished</th>
                <th className="py-2 pr-3">Duration</th>
                <th className="py-2 pr-3">Products</th>
                <th className="py-2 pr-3">Pricing</th>
                <th className="py-2 pr-3">Inventory</th>
                <th className="py-2 pr-3">Assets</th>
                <th className="py-2 pr-3">Error Summary</th>
                <th className="py-2 pr-3">Source Version</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.runId} className="border-b border-slate-100 text-slate-700" data-testid="admin-rocktomic-build-history-row">
                  <td className="py-2 pr-3 font-medium">{run.runId}</td>
                  <td className="py-2 pr-3"><AdminStatusBadge status={run.status} /></td>
                  <td className="py-2 pr-3">{safeIsoDate(run.startedAt, "Never")}</td>
                  <td className="py-2 pr-3">{safeIsoDate(run.finishedAt, "-")}</td>
                  <td className="py-2 pr-3">{run.durationSeconds == null ? "-" : `${run.durationSeconds}s`}</td>
                  <td className="py-2 pr-3">{run.productCount}</td>
                  <td className="py-2 pr-3">{run.pricingCount}</td>
                  <td className="py-2 pr-3">{run.inventoryCount}</td>
                  <td className="py-2 pr-3">{run.assetCount}</td>
                  <td className="py-2 pr-3">{run.errorSummary || "-"}</td>
                  <td className="py-2 pr-3">{run.sourceVersion || "-"}</td>
                </tr>
              ))}
              {runs.length === 0 ? (
                <tr>
                  <td className="py-3 text-slate-500" colSpan={11}>No build runs found for this supplier.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
