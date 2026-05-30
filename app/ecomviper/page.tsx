import EcomViperDashboardClient from "@/app/ecomviper/ecomviper-dashboard-client";
import { requireSignedInUser } from "@/lib/auth/requireSignedInUser";
import { getRocktomicSourceIngestionSnapshot } from "@/lib/ecomviper/dropshipping/rocktomic-source-ingestion";
import { toEcomViperProductInventoryRows } from "@/lib/ecomviper/shopify/shopify-inventory-foundation";
import { getShopifyConnectionStatusForUser } from "@/lib/ecomviper/shopify/shopify-connection";
import { getShopifyImportStateForUser, listShopifyProductsForUser } from "@/lib/ecomviper/shopify/shopify-import";
import { getShopifyOpenAiConnectionStatusForUser } from "@/lib/ecomviper/shopify/openai-connection";

export const dynamic = "force-dynamic";

export default async function EcomViperDashboardPage() {
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
  let storeDomain = "";
  let shopifyStatusLabel = "Not connected";
  let openAiStatusLabel = "Not connected";
  let lastImportAt: string | null = null;
  let rows = [] as ReturnType<typeof toEcomViperProductInventoryRows>;
  const sourceWarnings: string[] = [];

  const rocktomicSnapshot = await getRocktomicSourceIngestionSnapshot({ userId }).catch((error) => {
    sourceWarnings.push(error instanceof Error ? error.message : "Could not load supplier source diagnostics.");
    return null;
  });

  if (userId) {
    try {
      const connection = await getShopifyConnectionStatusForUser(userId);
      shopifyConnected = connection.connected;
      storeDomain = connection.storeDomain;
      shopifyStatusLabel = connection.connected ? "Connected" : "Not connected";
    } catch (error) {
      sourceWarnings.push(error instanceof Error ? error.message : "Could not load Shopify connection status.");
    }

    try {
      const importState = await getShopifyImportStateForUser(userId);
      lastImportAt = importState.lastImportAt;
    } catch (error) {
      sourceWarnings.push(error instanceof Error ? error.message : "Could not load Shopify import state.");
    }

    try {
      const openAiStatus = await getShopifyOpenAiConnectionStatusForUser(userId);
      openAiStatusLabel = openAiStatus.connected ? "Connected" : "Not connected";
    } catch {
      openAiStatusLabel = "Not connected";
    }

    try {
      const products = await listShopifyProductsForUser(userId);
      rows = toEcomViperProductInventoryRows(products, {
        supplierProducts: rocktomicSnapshot?.products,
        rocktomicInventoryAvailable: rocktomicSnapshot?.inventoryAvailable ?? false,
      });
    } catch (error) {
      sourceWarnings.push(error instanceof Error ? error.message : "Could not load Shopify products.");
    }
  }

  return (
    <EcomViperDashboardClient
      shopifyConnected={shopifyConnected}
      storeDomain={storeDomain}
      shopifyStatusLabel={shopifyStatusLabel}
      lastImportAt={lastImportAt}
      productCount={rows.length}
      sourceWarnings={sourceWarnings}
      rows={rows}
      rocktomicProductCount={rocktomicSnapshot?.productCount ?? 0}
      rocktomicStatusLabel={
        rocktomicSnapshot
          ? rocktomicSnapshot.usedSeedFallback
            ? "Connected (fallback)"
            : "Connected"
          : "Unavailable"
      }
      rocktomicLastCheckedAt={rocktomicSnapshot?.lastCheckedAt ?? null}
      openAiStatusLabel={openAiStatusLabel}
    />
  );
}
