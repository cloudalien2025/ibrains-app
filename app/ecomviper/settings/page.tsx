import Link from "next/link";
import { requireSignedInUser } from "@/lib/auth/requireSignedInUser";
import { getShopifyConnectionStatusForUser } from "@/lib/ecomviper/shopify/shopify-connection";
import { getShopifyImportStateForUser } from "@/lib/ecomviper/shopify/shopify-import";
import { getShopifyOpenAiConnectionStatusForUser } from "@/lib/ecomviper/shopify/openai-connection";
import { getMerchantSupplierMembershipTier } from "@/lib/ecomviper/settings/supplier-membership";
import {
  getGlobalSupplierSyncSummary,
  type GlobalSupplierSyncSummary,
} from "@/lib/ecomviper/suppliers/global-supplier-data";
import { safeIsoDate } from "@/lib/ui/safe-formatters";
import SupplierMembershipTierForm from "@/app/ecomviper/settings/supplier-membership-tier-form";
import RocktomicSourceSyncTrigger from "@/app/ecomviper/dropshipping/rocktomic/source-sync-trigger";

export const dynamic = "force-dynamic";

function asIso(value: string | null): string {
  return safeIsoDate(value, "Never");
}

function emptySupplierSummary(): GlobalSupplierSyncSummary {
  return {
    supplierKey: "rocktomic",
    globalScopeKey: "__global__",
    productCount: 0,
    pricingRecordCount: 0,
    inventoryRecordCount: 0,
    assetRecordCount: 0,
    sourceStatuses: [],
    latestRun: null,
    detectedMembershipTiers: [],
    syncStatus: "never_synced",
    lastCheckedAt: null,
    lastSuccessfulSyncAt: null,
    lastAttemptedSyncAt: null,
    lastSyncError: null,
  };
}

export default async function EcomViperSettingsPage() {
  let userId: string | null = null;
  try {
    const auth = await requireSignedInUser();
    if (!auth.unauthorizedResponse && auth.userId) {
      userId = auth.userId;
    }
  } catch {
    userId = null;
  }

  let shopifyConnected = false;
  let shopifyStore = "Not connected";
  let lastImportAt: string | null = null;
  let openAiLabel = "Not connected";
  let supplierSummary = emptySupplierSummary();
  const selectedMembershipTier = userId
    ? await getMerchantSupplierMembershipTier({ userId, supplierKey: "rocktomic" }).catch(() => null)
    : null;
  if (userId) {
    supplierSummary = await getGlobalSupplierSyncSummary("rocktomic").catch(() => emptySupplierSummary());
  }

  if (userId) {
    const [shopifyStatus, importState, openAiStatus] = await Promise.allSettled([
      getShopifyConnectionStatusForUser(userId),
      getShopifyImportStateForUser(userId),
      getShopifyOpenAiConnectionStatusForUser(userId),
    ]);

    if (shopifyStatus.status === "fulfilled") {
      shopifyConnected = shopifyStatus.value.connected;
      shopifyStore = shopifyStatus.value.storeDomain || "Connected";
    }

    if (importState.status === "fulfilled") {
      lastImportAt = importState.value.lastImportAt;
    }

    if (openAiStatus.status === "fulfilled") {
      openAiLabel = openAiStatus.value.connected ? "Connected" : "Not connected";
    }

  }

  return (
    <div className="space-y-4" data-testid="ecomviper-settings-page">
        <header className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-[#64748B]">EcomViper / Settings</p>
          <h1 className="mt-1 text-xl font-semibold text-[#0F172A]">Shopify + Supplier Configuration</h1>
          <p className="mt-1 text-sm text-[#475569]">
            `/ecomviper/shopify` now redirects to this settings surface so Shopify no longer runs as a separate child workspace.
          </p>
          <div className="mt-3 flex flex-wrap gap-3 text-sm">
            <Link href="/ecomviper" className="text-[#1D4ED8] hover:underline">Back to EcomViper Dashboard</Link>
            <Link href="/ecomviper/dropshipping/rocktomic" className="text-[#1D4ED8] hover:underline">Open supplier diagnostics</Link>
          </div>
        </header>

        <section className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-4">
          <h2 className="text-base font-semibold text-[#0F172A]">Connection Status</h2>
          <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <p className="rounded-lg border border-[#E2E8F0] bg-[#F8FBFF] px-3 py-2">Shopify: {shopifyConnected ? "Connected" : "Not connected"}</p>
            <p className="rounded-lg border border-[#E2E8F0] bg-[#F8FBFF] px-3 py-2">Store: {shopifyStore}</p>
            <p className="rounded-lg border border-[#E2E8F0] bg-[#F8FBFF] px-3 py-2">OpenAI: {openAiLabel}</p>
            <p className="rounded-lg border border-[#E2E8F0] bg-[#F8FBFF] px-3 py-2">Last Shopify sync: {asIso(lastImportAt)}</p>
          </div>
        </section>

        <SupplierMembershipTierForm
          detectedTiers={supplierSummary.detectedMembershipTiers}
          initialTier={selectedMembershipTier}
        />

        <section className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-4">
          <h2 className="text-base font-semibold text-[#0F172A]">Supplier Source Diagnostics</h2>
          <p className="mt-1 text-sm text-[#475569]">
            Product records: {supplierSummary.productCount} · Pricing records: {supplierSummary.pricingRecordCount} · Inventory records: {supplierSummary.inventoryRecordCount} · Assets records: {supplierSummary.assetRecordCount}
          </p>
          <p className="mt-1 text-sm text-[#475569]">
            Last checked: {asIso(supplierSummary.lastCheckedAt)} · Last attempted sync: {asIso(supplierSummary.lastAttemptedSyncAt)} · Last successful sync: {asIso(supplierSummary.lastSuccessfulSyncAt)} · Sync status: {supplierSummary.syncStatus}
          </p>
          {supplierSummary.lastSyncError ? <p className="mt-1 text-xs text-amber-700">Latest source note: {supplierSummary.lastSyncError}</p> : null}
          {supplierSummary.pricingRecordCount > 0 && !selectedMembershipTier ? (
            <p className="mt-1 text-xs text-[#64748B]">Select membership tier to calculate product cost and profit.</p>
          ) : null}
          {supplierSummary.pricingRecordCount === 0 ? (
            <p className="mt-1 text-xs text-[#64748B]">Run source sync to detect membership tiers.</p>
          ) : null}
          <div className="mt-2">
            <RocktomicSourceSyncTrigger />
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-[0.1em] text-[#64748B]">
                <tr>
                  <th className="py-2 pr-3">Source</th>
                  <th className="py-2 pr-3">Configured</th>
                  <th className="py-2 pr-3">Fetchable</th>
                  <th className="py-2 pr-3">Parsed</th>
                  <th className="py-2 pr-3">Sync status</th>
                  <th className="py-2 pr-3">Records</th>
                  <th className="py-2 pr-3">Last checked</th>
                  <th className="py-2 pr-3">Last successful sync</th>
                  <th className="py-2 pr-3">Error</th>
                </tr>
              </thead>
              <tbody>
                {supplierSummary.sourceStatuses.map((source) => (
                  <tr key={source.sourceId} className="border-t border-[#E2E8F0] text-[#334155]">
                    <td className="py-3 pr-3">{source.sourceLabel}</td>
                    <td className="py-3 pr-3">{source.configured ? "Yes" : "No"}</td>
                    <td className="py-3 pr-3">{source.fetchable ? "Yes" : "No"}</td>
                    <td className="py-3 pr-3">{source.parsed ? "Yes" : "No"}</td>
                    <td className="py-3 pr-3">{source.syncStatus}</td>
                    <td className="py-3 pr-3">{source.recordCount}</td>
                    <td className="py-3 pr-3">{asIso(source.lastCheckedAt)}</td>
                    <td className="py-3 pr-3">{asIso(source.lastSuccessfulSyncAt)}</td>
                    <td className="py-3 pr-3">{source.lastError || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
    </div>
  );
}
