import EcomViperDashboardClient from "@/app/ecomviper/ecomviper-dashboard-client";
import { requireSignedInUser } from "@/lib/auth/requireSignedInUser";
import { toEcomViperProductInventoryRows } from "@/lib/ecomviper/shopify/shopify-inventory-foundation";
import { getShopifyConnectionStatusForUser } from "@/lib/ecomviper/shopify/shopify-connection";
import { getShopifyImportStateForUser, listShopifyProductsForUser } from "@/lib/ecomviper/shopify/shopify-import";

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
  let lastImportAt: string | null = null;
  let rows = [] as ReturnType<typeof toEcomViperProductInventoryRows>;
  const sourceWarnings: string[] = [];

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
      const products = await listShopifyProductsForUser(userId);
      rows = toEcomViperProductInventoryRows(products);
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
    />
  );
}
