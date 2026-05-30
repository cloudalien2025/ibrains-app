import Link from "next/link";
import { requireSignedInUser } from "@/lib/auth/requireSignedInUser";
import { getRocktomicSourceIngestionSnapshot } from "@/lib/ecomviper/dropshipping/rocktomic-source-ingestion";
import { getShopifyConnectionStatusForUser } from "@/lib/ecomviper/shopify/shopify-connection";
import { getShopifyImportStateForUser } from "@/lib/ecomviper/shopify/shopify-import";
import { getShopifyOpenAiConnectionStatusForUser } from "@/lib/ecomviper/shopify/openai-connection";
import { getSupplierMembershipTierSelectionForUser } from "@/lib/ecomviper/settings/supplier-membership";
import SupplierMembershipTierForm from "@/app/ecomviper/settings/supplier-membership-tier-form";

export const dynamic = "force-dynamic";

function asIso(value: string | null): string {
  if (!value) return "Never";
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return value;
  return new Date(parsed).toISOString();
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

  const rocktomic = await getRocktomicSourceIngestionSnapshot({ userId });
  const selectedMembershipTier = userId
    ? await getSupplierMembershipTierSelectionForUser(userId).catch(() => null)
    : null;

  let shopifyConnected = false;
  let shopifyStore = "Not connected";
  let lastImportAt: string | null = null;
  let openAiLabel = "Not connected";

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
    <main className="ibrains-shell min-h-screen p-4" data-testid="ecomviper-settings-page">
      <div className="mx-auto max-w-6xl space-y-4">
        <header className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-[#64748B]">EcomViper Settings / Diagnostics</p>
          <h1 className="mt-1 text-xl font-semibold text-[#0F172A]">Shopify + Rocktomic Configuration</h1>
          <p className="mt-1 text-sm text-[#475569]">
            `/ecomviper/shopify` now redirects to this settings surface so Shopify no longer runs as a separate child workspace.
          </p>
          <div className="mt-3 flex flex-wrap gap-3 text-sm">
            <Link href="/ecomviper" className="text-[#1D4ED8] hover:underline">Back to EcomViper Dashboard</Link>
            <Link href="/ecomviper/dropshipping/rocktomic" className="text-[#1D4ED8] hover:underline">Open Rocktomic Diagnostics</Link>
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
          detectedTiers={rocktomic.membershipTiersDetected}
          initialTier={selectedMembershipTier}
        />

        <section className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-4">
          <h2 className="text-base font-semibold text-[#0F172A]">Rocktomic Source Diagnostics</h2>
          <p className="mt-1 text-sm text-[#475569]">
            Product records: {rocktomic.productCount} · Inventory records: {rocktomic.inventorySkuCount} · Last checked: {asIso(rocktomic.lastCheckedAt)}
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-[0.1em] text-[#64748B]">
                <tr>
                  <th className="py-2 pr-3">Source</th>
                  <th className="py-2 pr-3">Configured</th>
                  <th className="py-2 pr-3">Fetchable</th>
                  <th className="py-2 pr-3">Parsed</th>
                  <th className="py-2 pr-3">Records</th>
                  <th className="py-2 pr-3">Last checked</th>
                  <th className="py-2 pr-3">Error</th>
                </tr>
              </thead>
              <tbody>
                {rocktomic.sourceDiagnostics.map((source) => (
                  <tr key={source.id} className="border-t border-[#E2E8F0] text-[#334155]">
                    <td className="py-3 pr-3">{source.label}</td>
                    <td className="py-3 pr-3">{source.configured ? "Yes" : "No"}</td>
                    <td className="py-3 pr-3">{source.fetchable ? "Yes" : "No"}</td>
                    <td className="py-3 pr-3">{source.parsed ? "Yes" : "No"}</td>
                    <td className="py-3 pr-3">{source.recordCount}</td>
                    <td className="py-3 pr-3">{asIso(source.lastCheckedAt)}</td>
                    <td className="py-3 pr-3">{source.lastError || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
