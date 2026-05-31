import Link from "next/link";
import AdminStatusBadge from "@/app/admin/_components/admin-status-badge";
import { getSupplierAdminSummary } from "@/lib/admin/ecomviper/supplier-intelligence";
import { safeIsoDate } from "@/lib/ui/safe-formatters";

export default async function EcomViperAdminOverviewPage() {
  const summary = await getSupplierAdminSummary("rocktomic");

  const cards = [
    { label: "Supplier Intelligence", value: `${summary.productCount} SKU records`, status: summary.sourceRegistryStatus },
    { label: "Dataset Health", value: summary.datasetStatus, status: summary.datasetStatus },
    {
      label: "Product Mapping Health",
      value: summary.productCount > 0 ? "Mapped" : "No product records",
      status: summary.productCount > 0 ? "ready" : "missing",
    },
    {
      label: "Last Known Production Version",
      value: summary.currentPublishedDatasetVersion || "Not available",
      status: summary.currentPublishedDatasetVersion ? "ready" : "missing",
    },
  ] as const;

  return (
    <section className="space-y-4" data-testid="admin-ecomviper-overview-page">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Admin / EcomViper</p>
        <h2 className="mt-1 text-2xl font-semibold">EcomViper Admin Overview</h2>
        <p className="mt-2 text-sm text-slate-600">
          Internal-only supplier intelligence status from normalized global records.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <article key={card.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" data-testid="admin-ecomviper-summary-card">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{card.label}</p>
            <p className="mt-2 text-lg font-semibold text-slate-900">{card.value}</p>
            <div className="mt-2">
              <AdminStatusBadge status={card.status} />
            </div>
          </article>
        ))}
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">Rocktomic Supplier Intelligence</h3>
            <p className="text-sm text-slate-600">
              Last successful sync: {safeIsoDate(summary.lastSuccessfulSyncAt, "Never")}
            </p>
          </div>
          <Link href="/admin/ecomviper/suppliers/rocktomic" className="rounded-lg border border-slate-900 bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800">
            Open Rocktomic Admin
          </Link>
        </div>
      </section>
    </section>
  );
}
