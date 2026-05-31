import Link from "next/link";
import RocktomicSourceSyncTrigger from "@/app/ecomviper/dropshipping/rocktomic/source-sync-trigger";
import { requireSignedInUser } from "@/lib/auth/requireSignedInUser";
import { getRocktomicSourceIngestionSnapshot } from "@/lib/ecomviper/dropshipping/rocktomic-source-ingestion";
import { lookupRocktomicSupplierProductBySku } from "@/lib/ecomviper/dropshipping/rocktomic-supplier-intelligence";
import { safeIsoDate } from "@/lib/ui/safe-formatters";

export const dynamic = "force-dynamic";

interface RocktomicDropshippingPageProps {
  searchParams: Promise<{ sku?: string }>;
}

function asIso(value: string | null): string {
  return safeIsoDate(value, "Never");
}

export default async function RocktomicDropshippingPage({ searchParams }: RocktomicDropshippingPageProps) {
  const auth = await requireSignedInUser().catch(() => ({ userId: null, unauthorizedResponse: null }));
  if (!auth.userId) {
    return (
      <div data-testid="ecomviper-rocktomic-page">
        <article className="mx-auto max-w-3xl rounded-2xl border border-[#D9E4F0] bg-white/95 p-6">
          <h1 className="text-2xl font-semibold text-[#0F172A]">Supplier diagnostics unavailable</h1>
          <p className="mt-2 text-sm text-[#475569]">Sign in before loading supplier feed diagnostics.</p>
          <Link href="/brains" className="mt-4 inline-flex text-sm text-[#1D4ED8] hover:underline">
            Back to iBrains Dashboard
          </Link>
        </article>
      </div>
    );
  }
  const snapshot = await getRocktomicSourceIngestionSnapshot({
    userId: auth.userId,
    allowRefresh: false,
    triggerBackgroundRefresh: false,
    includeSeedFallbackProducts: false,
  });
  const params = await searchParams;
  const sku = (params.sku || "").trim();
  const lookup = sku ? lookupRocktomicSupplierProductBySku(sku, snapshot.products) : null;

  return (
    <div className="space-y-4" data-testid="ecomviper-rocktomic-page">
        <header className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-6">
          <p className="text-xs uppercase tracking-[0.14em] text-[#64748B]">EcomViper / Dropshipping / Supplier Feed</p>
          <h1 className="mt-2 text-2xl font-semibold text-[#0F172A]">Supplier Feed Diagnostics</h1>
          <p className="mt-2 text-sm text-[#475569]">
            Source-backed catalog, pricing, inventory, and asset ingestion diagnostics. Merchants do not upload supplier files in normal workflow.
          </p>
          <div className="mt-4 flex flex-wrap gap-3 text-sm">
            <Link href="/ecomviper" className="text-[#1D4ED8] hover:underline">
              Back to EcomViper
            </Link>
            <Link href="/ecomviper/settings" className="text-[#1D4ED8] hover:underline">
              Open EcomViper Settings
            </Link>
          </div>
          <div className="mt-3">
            <RocktomicSourceSyncTrigger />
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2">
          <article className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5">
            <h2 className="text-base font-semibold text-[#0F172A]">Source Status</h2>
            <p className="mt-2 text-sm text-[#475569]">Product count: {snapshot.productCount}</p>
            <p className="text-sm text-[#475569]">Catalog SKU count: {snapshot.catalogSkuCount}</p>
            <p className="text-sm text-[#475569]">Inventory SKU count: {snapshot.inventorySkuCount}</p>
            <p className="text-sm text-[#475569]">Inventory availability: {snapshot.inventoryAvailable ? "Available" : "Unavailable"}</p>
            <p className="text-sm text-[#475569]">Fallback mode: {snapshot.usedSeedFallback ? "Enabled" : "Disabled"}</p>
            <p className="text-sm text-[#475569]">Last source check: {asIso(snapshot.lastCheckedAt)}</p>
            <p className="text-sm text-[#475569]">Last attempted sync: {asIso(snapshot.lastAttemptedSyncAt)}</p>
            <p className="text-sm text-[#475569]">Last successful sync: {asIso(snapshot.lastSuccessfulSyncAt)}</p>
            <p className="text-sm text-[#475569]">Sync status: {snapshot.syncStatus}</p>
            <p className="text-sm text-[#475569]">Last sync error: {snapshot.lastSyncError || "-"}</p>
            <p className="text-sm text-[#475569]">Cache state: {snapshot.cacheState || "unknown"}</p>
            <p className="text-sm text-[#475569]">Refresh state: {snapshot.refreshState || "idle"}</p>
          </article>

          <article className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5">
            <h2 className="text-base font-semibold text-[#0F172A]">SKU Lookup</h2>
            <form className="mt-2 flex gap-2" method="get">
              <input
                name="sku"
                defaultValue={sku}
                placeholder="Search SKU (e.g. ROC948)"
                className="w-full rounded-lg border border-[#D9E4F0] px-3 py-2 text-sm"
              />
              <button type="submit" className="rounded-lg border border-[#1D4ED8] bg-[#1D4ED8] px-3 py-2 text-sm font-medium text-white">
                Lookup
              </button>
            </form>
            {lookup ? (
              <div className="mt-3 rounded-lg border border-[#E2E8F0] bg-[#F8FBFF] px-3 py-2 text-sm text-[#334155]" data-testid="rocktomic-sku-lookup-result">
                <p>Input SKU: {lookup.skuInput || "-"}</p>
                <p>Normalized SKU: {lookup.normalizedSku || "-"}</p>
                <p>Match status: {lookup.status}</p>
                <p>Match confidence: {Math.round(lookup.matchConfidence * 100)}%</p>
                <p>Match reason: {lookup.matchReason}</p>
                <p>Product: {lookup.product?.productName || "-"}</p>
                <p>Inventory status: {lookup.product?.inventoryStatus || "-"}</p>
              </div>
            ) : (
              <p className="mt-3 text-sm text-[#475569]">Run a SKU lookup to test exact Rocktomic matching against parsed sources.</p>
            )}
          </article>
        </section>

        <section className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5">
          <h2 className="text-base font-semibold text-[#0F172A]">Catalog Source References</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-[0.1em] text-[#64748B]">
                <tr>
                  <th className="py-2 pr-3">Reference</th>
                  <th className="py-2 pr-3">Configured</th>
                  <th className="py-2 pr-3">Fetchable</th>
                  <th className="py-2 pr-3">Parsed</th>
                  <th className="py-2 pr-3">Sync status</th>
                  <th className="py-2 pr-3">Record count</th>
                  <th className="py-2 pr-3">Last checked</th>
                  <th className="py-2 pr-3">Last successful sync</th>
                  <th className="py-2 pr-3">Last error</th>
                  <th className="py-2 pr-3">Source</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.sourceDiagnostics.map((reference) => (
                  <tr key={reference.id} className="border-t border-[#E2E8F0] text-[#334155]">
                    <td className="py-3 pr-3">{reference.label}</td>
                    <td className="py-3 pr-3">{reference.configured ? "Yes" : "No"}</td>
                    <td className="py-3 pr-3">{reference.fetchable ? "Yes" : "No"}</td>
                    <td className="py-3 pr-3">{reference.parsed ? "Yes" : "No"}</td>
                    <td className="py-3 pr-3">{reference.syncStatus}</td>
                    <td className="py-3 pr-3">{reference.recordCount}</td>
                    <td className="py-3 pr-3">{asIso(reference.lastCheckedAt)}</td>
                    <td className="py-3 pr-3">{asIso(reference.lastSuccessfulSyncAt)}</td>
                    <td className="py-3 pr-3">{reference.lastError || "-"}</td>
                    <td className="py-3 pr-3">
                      {reference.sourceUrl ? (
                        <a href={reference.sourceUrl} target="_blank" rel="noreferrer" className="text-[#1D4ED8] hover:underline">
                          Open source
                        </a>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
    </div>
  );
}
