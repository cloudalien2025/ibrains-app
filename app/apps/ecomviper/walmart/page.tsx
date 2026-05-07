import Link from "next/link";
import WalmartPageHeader from "@/app/apps/ecomviper/walmart/_components/page-header";
import StatusBadge from "@/app/apps/ecomviper/walmart/_components/status-badge";
import { getWalmartDashboardSnapshot } from "@/lib/ecomviper/walmart/walmart-products";

export const dynamic = "force-dynamic";

function apiErrorMessage(value: { code: string; message: string } | null): string {
  if (!value) return "None";
  return `${value.message} (${value.code})`;
}

export default function WalmartDashboardPage() {
  const snapshot = getWalmartDashboardSnapshot();

  const connectionStatus =
    snapshot.connection.connectionStatus === "connected" ? "Connected" : "Not Connected";

  return (
    <div className="space-y-4" data-testid="ecomviper-walmart-dashboard">
      <WalmartPageHeader
        title="Walmart Marketplace Manager"
        subtitle="Edit, optimize, and sync your Walmart catalog from iBrains."
        mode={snapshot.mode}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/apps/ecomviper/walmart/connect"
              className="rounded-lg border border-[#2563EB] bg-[#2563EB] px-3 py-2 text-sm font-medium text-white transition hover:border-[#1D4ED8] hover:bg-[#1D4ED8]"
            >
              Connect Walmart
            </Link>
            <Link
              href="/apps/ecomviper/walmart/products"
              className="rounded-lg border border-[#D9E4F0] bg-white px-3 py-2 text-sm text-[#0F172A] transition hover:bg-[#F8FBFF]"
            >
              Import Products
            </Link>
            <Link
              href="/apps/ecomviper/walmart/feeds"
              className="rounded-lg border border-[#D9E4F0] bg-white px-3 py-2 text-sm text-[#0F172A] transition hover:bg-[#F8FBFF]"
            >
              View Feed History
            </Link>
          </div>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5" data-testid="ecomviper-walmart-metric-cards">
        <article className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-4 shadow-[0_14px_34px_rgba(15,23,42,0.08)]">
          <p className="text-xs uppercase tracking-[0.12em] text-[#64748B]">Connection Health</p>
          <div className="mt-2"><StatusBadge status={connectionStatus} /></div>
          <p className="mt-2 text-sm text-[#334155]">
            {snapshot.connection.summary.environment === "production" ? "Production" : "Sandbox"}
          </p>
          <p className="mt-1 text-xs text-[#64748B]">Last auth: {snapshot.connection.summary.lastSuccessfulAuth ?? "Never"}</p>
          <p className="mt-1 text-xs text-[#64748B]">Last error: {apiErrorMessage(snapshot.connection.lastApiError)}</p>
        </article>
        <article className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-4 shadow-[0_14px_34px_rgba(15,23,42,0.08)]">
          <p className="text-xs uppercase tracking-[0.12em] text-[#64748B]">Products Imported</p>
          <p className="mt-2 text-3xl font-semibold text-[#0F172A]">{snapshot.productsImported}</p>
          <p className="mt-1 text-xs text-[#64748B]">Last import: {snapshot.lastImportAt ?? "Not imported yet"}</p>
        </article>
        <article className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-4 shadow-[0_14px_34px_rgba(15,23,42,0.08)]">
          <p className="text-xs uppercase tracking-[0.12em] text-[#64748B]">Draft Changes</p>
          <p className="mt-2 text-3xl font-semibold text-[#0F172A]">{snapshot.draftChanges}</p>
          <p className="mt-1 text-xs text-[#64748B]">Staged edits waiting for submit</p>
        </article>
        <article className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-4 shadow-[0_14px_34px_rgba(15,23,42,0.08)]">
          <p className="text-xs uppercase tracking-[0.12em] text-[#64748B]">Feed Errors</p>
          <p className="mt-2 text-3xl font-semibold text-[#0F172A]">{snapshot.feedErrors}</p>
          <p className="mt-1 text-xs text-[#64748B]">Recent maintenance feed errors</p>
        </article>
        <article className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-4 shadow-[0_14px_34px_rgba(15,23,42,0.08)]">
          <p className="text-xs uppercase tracking-[0.12em] text-[#64748B]">Listings Needing Attention</p>
          <p className="mt-2 text-3xl font-semibold text-[#0F172A]">{snapshot.listingsNeedingAttention.count}</p>
          <p className="mt-1 text-xs text-[#64748B]">{snapshot.listingsNeedingAttention.categories.join(", ") || "No categories"}</p>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5 shadow-[0_16px_36px_rgba(15,23,42,0.08)]">
          <h2 className="text-lg font-semibold text-[#0F172A]">Recent Products</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-[0.1em] text-[#64748B]">
                <tr>
                  <th className="py-2">SKU</th>
                  <th className="py-2">Title</th>
                  <th className="py-2">Price</th>
                  <th className="py-2">Inventory</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.recentProducts.map((product) => (
                  <tr key={product.sku} className="border-t border-[#E2E8F0] text-[#334155]">
                    <td className="py-2 pr-3 font-medium">{product.sku}</td>
                    <td className="py-2 pr-3">{product.title}</td>
                    <td className="py-2 pr-3">${product.price.toFixed(2)}</td>
                    <td className="py-2">{product.inventoryQuantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5 shadow-[0_16px_36px_rgba(15,23,42,0.08)]">
          <h2 className="text-lg font-semibold text-[#0F172A]">Recent Sync Activity</h2>
          <ul className="mt-3 space-y-2">
            {snapshot.recentActivity.length ? (
              snapshot.recentActivity.map((entry) => (
                <li key={`${entry.time}-${entry.action}`} className="rounded-lg border border-[#E2E8F0] bg-[#F8FBFF] p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-[#0F172A]">{entry.action}</span>
                    <StatusBadge status={entry.result} />
                  </div>
                  <p className="mt-1 text-[#475569]">{entry.message}</p>
                  <p className="mt-1 text-xs text-[#64748B]">{entry.time}</p>
                </li>
              ))
            ) : (
              <li className="rounded-lg border border-dashed border-[#D9E4F0] p-3 text-sm text-[#64748B]">No activity yet.</li>
            )}
          </ul>
        </article>
      </section>

      <section className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5 shadow-[0_16px_36px_rgba(15,23,42,0.08)]">
        <h2 className="text-lg font-semibold text-[#0F172A]">Products Needing Attention</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {snapshot.attentionProducts.length ? (
            snapshot.attentionProducts.map((product) => (
              <article key={product.sku} className="rounded-lg border border-[#E2E8F0] bg-[#F8FBFF] p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-[#0F172A]">{product.sku}</p>
                  <StatusBadge status={product.status} />
                </div>
                <p className="mt-1 text-sm text-[#334155]">{product.title}</p>
                <p className="mt-1 text-xs text-[#64748B]">Issues: {product.issues.join(", ") || "None"}</p>
              </article>
            ))
          ) : (
            <p className="text-sm text-[#64748B]">No products currently flagged.</p>
          )}
        </div>
      </section>
    </div>
  );
}
