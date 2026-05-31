import Link from "next/link";
import AdminStatusBadge from "@/app/admin/_components/admin-status-badge";
import { getSupplierAdminSummary } from "@/lib/admin/ecomviper/supplier-intelligence";

export default async function EcomViperAdminSuppliersPage() {
  const summary = await getSupplierAdminSummary("rocktomic");

  return (
    <section className="space-y-4" data-testid="admin-ecomviper-suppliers-page">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Admin / EcomViper / Suppliers</p>
        <h2 className="mt-1 text-2xl font-semibold">Supplier Registry</h2>
        <p className="mt-2 text-sm text-slate-600">Platform-owned supplier datasets only. Merchant UI does not expose this diagnostics surface.</p>
      </header>

      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" data-testid="admin-supplier-card-rocktomic">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">Rocktomic</h3>
            <p className="text-sm text-slate-600">Products: {summary.productCount} · Pricing: {summary.pricingCount} · Inventory: {summary.inventoryCount} · Assets: {summary.assetCount}</p>
          </div>
          <AdminStatusBadge status={summary.sourceRegistryStatus} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/admin/ecomviper/suppliers/rocktomic" className="rounded-lg border border-slate-900 bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800">
            Open Summary
          </Link>
          <Link href="/admin/ecomviper/suppliers/rocktomic/audit" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-100">
            All-SKU Audit
          </Link>
          <Link href="/admin/ecomviper/suppliers/rocktomic/builds" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-100">
            Build History
          </Link>
        </div>
      </article>
    </section>
  );
}
