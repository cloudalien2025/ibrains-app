import Link from "next/link";
import AdminStatusBadge from "@/app/admin/_components/admin-status-badge";
import {
  ADMIN_AUDIT_FILTER_OPTIONS,
  type AdminAuditFilter,
  getSupplierAuditData,
} from "@/lib/admin/ecomviper/supplier-intelligence";
import { safeIsoDate } from "@/lib/ui/safe-formatters";

const filterLookup = new Set<AdminAuditFilter>(ADMIN_AUDIT_FILTER_OPTIONS.map((option) => option.value));

function resolveFilter(value: string | undefined): AdminAuditFilter {
  if (!value) return "all";
  return filterLookup.has(value as AdminAuditFilter) ? (value as AdminAuditFilter) : "all";
}

interface RocktomicAuditPageProps {
  searchParams: Promise<{ filter?: string; q?: string }>;
}

export default async function RocktomicAuditPage({ searchParams }: RocktomicAuditPageProps) {
  const params = await searchParams;
  const filter = resolveFilter(params.filter);
  const q = (params.q || "").trim();

  const audit = await getSupplierAuditData({
    supplierId: "rocktomic",
    filter,
    searchTerm: q,
  });

  return (
    <section className="space-y-4" data-testid="admin-rocktomic-audit-page">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Admin / EcomViper / Rocktomic / Audit</p>
        <h2 className="mt-1 text-2xl font-semibold">All-SKU Source Audit</h2>
        <p className="mt-2 text-sm text-slate-600">
          Read-only global supplier audit. No OCR, extraction, or sync operations run in this route render.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/admin/ecomviper/suppliers/rocktomic" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-100">
            Back to Supplier Summary
          </Link>
          <Link href="/admin/ecomviper/suppliers/rocktomic/builds" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-100">
            Build History
          </Link>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" data-testid="admin-rocktomic-audit-summary-cards">
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs uppercase tracking-[0.12em] text-slate-500">Total Supplier SKUs</p><p className="mt-2 text-lg font-semibold">{audit.summary.totalSupplierSkus}</p></article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs uppercase tracking-[0.12em] text-slate-500">Ready SKUs</p><p className="mt-2 text-lg font-semibold">{audit.summary.readySkus}</p></article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs uppercase tracking-[0.12em] text-slate-500">Partial SKUs</p><p className="mt-2 text-lg font-semibold">{audit.summary.partialSkus}</p></article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs uppercase tracking-[0.12em] text-slate-500">Missing COA</p><p className="mt-2 text-lg font-semibold">{audit.summary.missingCoa}</p></article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs uppercase tracking-[0.12em] text-slate-500">Missing Pricing</p><p className="mt-2 text-lg font-semibold">{audit.summary.missingPricing}</p></article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs uppercase tracking-[0.12em] text-slate-500">Missing Inventory</p><p className="mt-2 text-lg font-semibold">{audit.summary.missingInventory}</p></article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:col-span-2 xl:col-span-2"><p className="text-xs uppercase tracking-[0.12em] text-slate-500">Supplement Facts Not Extracted</p><p className="mt-2 text-lg font-semibold">{audit.summary.supplementFactsNotExtracted}</p></article>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <form className="flex flex-col gap-3 lg:flex-row lg:items-end" method="get" data-testid="admin-rocktomic-audit-filters">
          <label className="flex min-w-48 flex-col gap-1 text-sm text-slate-700">
            Filter
            <select name="filter" defaultValue={filter} className="rounded-lg border border-slate-300 px-3 py-2">
              {ADMIN_AUDIT_FILTER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className="flex min-w-72 flex-1 flex-col gap-1 text-sm text-slate-700">
            Search SKU / Product Name
            <input name="q" defaultValue={q} placeholder="ROC948 or product name" className="rounded-lg border border-slate-300 px-3 py-2" />
          </label>
          <button type="submit" className="rounded-lg border border-slate-900 bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800">
            Apply
          </button>
          <button type="button" disabled className="rounded-lg border border-slate-200 bg-slate-100 px-4 py-2 text-sm text-slate-500" data-testid="admin-rocktomic-audit-export-disabled">
            CSV/JSON Export (coming soon)
          </button>
        </form>
        <p className="mt-3 text-sm text-slate-600">Showing {audit.filteredCount} of {audit.summary.totalSupplierSkus} SKUs.</p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm" data-testid="admin-rocktomic-audit-table">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.12em] text-slate-500">
                <th className="py-2 pr-3">SKU</th>
                <th className="py-2 pr-3">Product Name</th>
                <th className="py-2 pr-3">Product Facts</th>
                <th className="py-2 pr-3">Pricing</th>
                <th className="py-2 pr-3">Inventory</th>
                <th className="py-2 pr-3">COA Link</th>
                <th className="py-2 pr-3">Label/Mockup</th>
                <th className="py-2 pr-3">Supplement Facts</th>
                <th className="py-2 pr-3">Key Features</th>
                <th className="py-2 pr-3">Generate Readiness</th>
                <th className="py-2 pr-3">Last Synced</th>
              </tr>
            </thead>
            <tbody>
              {audit.rows.map((row) => (
                <tr key={row.sku} className="border-b border-slate-100 align-top text-slate-700" data-testid="admin-rocktomic-audit-row">
                  <td className="py-2 pr-3 font-medium">{row.sku}</td>
                  <td className="py-2 pr-3">{row.productName}</td>
                  <td className="py-2 pr-3"><AdminStatusBadge status={row.productFactsStatus} /></td>
                  <td className="py-2 pr-3"><AdminStatusBadge status={row.pricingStatus} /></td>
                  <td className="py-2 pr-3"><AdminStatusBadge status={row.inventoryStatus} /></td>
                  <td className="py-2 pr-3"><AdminStatusBadge status={row.coaLinkStatus} /></td>
                  <td className="py-2 pr-3"><AdminStatusBadge status={row.labelMockupStatus} /></td>
                  <td className="py-2 pr-3"><AdminStatusBadge status={row.supplementFactsStatus} /></td>
                  <td className="py-2 pr-3"><AdminStatusBadge status={row.keyFeaturesStatus} /></td>
                  <td className="py-2 pr-3"><AdminStatusBadge status={row.generateReadiness} /></td>
                  <td className="py-2 pr-3">{safeIsoDate(row.lastSyncedAt, "Never")}</td>
                </tr>
              ))}
              {audit.rows.length === 0 ? (
                <tr>
                  <td className="py-3 text-slate-500" colSpan={11}>No SKU rows matched the current filter/search.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
