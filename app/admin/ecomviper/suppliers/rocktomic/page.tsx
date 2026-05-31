import Link from "next/link";
import AdminStatusBadge from "@/app/admin/_components/admin-status-badge";
import { getSupplierAdminSummary } from "@/lib/admin/ecomviper/supplier-intelligence";
import { safeIsoDate } from "@/lib/ui/safe-formatters";

export default async function RocktomicAdminSummaryPage() {
  const summary = await getSupplierAdminSummary("rocktomic");

  return (
    <section className="space-y-4" data-testid="admin-rocktomic-summary-page">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Admin / EcomViper / Suppliers / Rocktomic</p>
        <h2 className="mt-1 text-2xl font-semibold">Rocktomic Supplier Intelligence</h2>
        <p className="mt-2 text-sm text-slate-600">Internal diagnostics for global supplier dataset health and source sync state.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/admin/ecomviper/suppliers/rocktomic/audit" className="rounded-lg border border-slate-900 bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800">
            All-SKU Audit
          </Link>
          <Link href="/admin/ecomviper/suppliers/rocktomic/builds" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-100">
            Build History
          </Link>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Source Registry Status</p>
          <div className="mt-2"><AdminStatusBadge status={summary.sourceRegistryStatus} /></div>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Current Dataset Summary</p>
          <p className="mt-2 text-sm text-slate-700">Products: {summary.productCount}</p>
          <p className="text-sm text-slate-700">Pricing: {summary.pricingCount}</p>
          <p className="text-sm text-slate-700">Inventory: {summary.inventoryCount}</p>
          <p className="text-sm text-slate-700">Assets: {summary.assetCount}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Last Successful Sync/Build</p>
          <p className="mt-2 text-sm text-slate-700">{safeIsoDate(summary.lastSuccessfulSyncAt, "Never")}</p>
          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Last Failed Sync/Build</p>
          <p className="mt-2 text-sm text-slate-700">{safeIsoDate(summary.lastFailedSyncAt, "Never")}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Published Dataset Version</p>
          <p className="mt-2 text-sm text-slate-700">{summary.currentPublishedDatasetVersion || "Not available"}</p>
          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Release Build Metadata</p>
          <p className="mt-2 text-sm text-slate-700">{summary.currentReleaseBuildId || "Not available"}</p>
        </article>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold">Source Registry</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm" data-testid="admin-rocktomic-source-registry-table">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.12em] text-slate-500">
                <th className="py-2 pr-3">Source</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Configured</th>
                <th className="py-2 pr-3">Fetchable</th>
                <th className="py-2 pr-3">Parsed</th>
                <th className="py-2 pr-3">Records</th>
                <th className="py-2 pr-3">Last Checked</th>
                <th className="py-2 pr-3">Last Success</th>
                <th className="py-2 pr-3">Error</th>
              </tr>
            </thead>
            <tbody>
              {summary.sourceStatuses.map((source) => (
                <tr key={source.sourceId} className="border-b border-slate-100 text-slate-700">
                  <td className="py-2 pr-3">{source.sourceLabel}</td>
                  <td className="py-2 pr-3"><AdminStatusBadge status={source.syncStatus} /></td>
                  <td className="py-2 pr-3">{source.configured ? "Yes" : "No"}</td>
                  <td className="py-2 pr-3">{source.fetchable ? "Yes" : "No"}</td>
                  <td className="py-2 pr-3">{source.parsed ? "Yes" : "No"}</td>
                  <td className="py-2 pr-3">{source.recordCount}</td>
                  <td className="py-2 pr-3">{safeIsoDate(source.lastCheckedAt, "Never")}</td>
                  <td className="py-2 pr-3">{safeIsoDate(source.lastSuccessfulSyncAt, "Never")}</td>
                  <td className="py-2 pr-3">{source.lastError || "-"}</td>
                </tr>
              ))}
              {summary.sourceStatuses.length === 0 ? (
                <tr>
                  <td className="py-3 text-slate-500" colSpan={9}>No source registry rows found.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
