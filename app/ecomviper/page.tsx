import EcomViperDashboardClient from "@/app/ecomviper/ecomviper-dashboard-client";
import { requireSignedInUser } from "@/lib/auth/requireSignedInUser";
import { getRocktomicSourceIngestionSnapshot } from "@/lib/ecomviper/dropshipping/rocktomic-source-ingestion";
import { toEcomViperProductInventoryRows } from "@/lib/ecomviper/shopify/shopify-inventory-foundation";
import { getShopifyConnectionStatusForUser } from "@/lib/ecomviper/shopify/shopify-connection";
import { getShopifyImportStateForUser, listShopifyProductsForUser } from "@/lib/ecomviper/shopify/shopify-import";
import { getShopifyOpenAiConnectionStatusForUser } from "@/lib/ecomviper/shopify/openai-connection";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
const ROCKTOMIC_SOFT_TIMEOUT_MS = 3_500;

export default async function EcomViperDashboardPage() {
  let userId: string;
  try {
    const auth = await requireSignedInUser();
    if (auth.unauthorizedResponse || !auth.userId) {
      redirect("/sign-in");
    }
    userId = auth.userId;
  } catch {
    redirect("/sign-in");
  }

  let shopifyConnected = false;
  let storeDomain = "";
  let shopifyStatusLabel = "Not connected";
  let openAiStatusLabel = "Not connected";
  let lastImportAt: string | null = null;
  let rows = [] as ReturnType<typeof toEcomViperProductInventoryRows>;
  const sourceWarnings: string[] = [];

  const [connectionResult, importStateResult, openAiStatusResult] = await Promise.all([
    getShopifyConnectionStatusForUser(userId)
      .then((connection) => ({ ok: true as const, connection }))
      .catch((error) => ({ ok: false as const, error })),
    getShopifyImportStateForUser(userId)
      .then((importState) => ({ ok: true as const, importState }))
      .catch((error) => ({ ok: false as const, error })),
    getShopifyOpenAiConnectionStatusForUser(userId)
      .then((openAiStatus) => ({ ok: true as const, openAiStatus }))
      .catch((error) => ({ ok: false as const, error })),
  ]);

  if (connectionResult.ok) {
    shopifyConnected = connectionResult.connection.connected;
    storeDomain = connectionResult.connection.storeDomain;
    shopifyStatusLabel = connectionResult.connection.connected ? "Connected" : "Not connected";
  } else {
    sourceWarnings.push(
      connectionResult.error instanceof Error
        ? connectionResult.error.message
        : "Could not load Shopify connection status."
    );
  }

  if (importStateResult.ok) {
    lastImportAt = importStateResult.importState.lastImportAt;
  } else {
    sourceWarnings.push(
      importStateResult.error instanceof Error
        ? importStateResult.error.message
        : "Could not load Shopify import state."
    );
  }

  if (openAiStatusResult.ok) {
    openAiStatusLabel = openAiStatusResult.openAiStatus.connected ? "Connected" : "Not connected";
  } else {
    openAiStatusLabel = "Not connected";
  }

  let rocktomicSnapshot: Awaited<ReturnType<typeof getRocktomicSourceIngestionSnapshot>> | null = null;
  if (shopifyConnected) {
    const rocktomicResultPromise = getRocktomicSourceIngestionSnapshot({ userId })
      .then((snapshot) => ({ kind: "ok" as const, snapshot }))
      .catch((error) => ({ kind: "error" as const, error }));
    const rocktomicSoftTimeout = new Promise<{ kind: "timeout" }>((resolve) => {
      setTimeout(() => resolve({ kind: "timeout" }), ROCKTOMIC_SOFT_TIMEOUT_MS);
    });
    const rocktomicResult = await Promise.race([rocktomicResultPromise, rocktomicSoftTimeout]);
    if (rocktomicResult.kind === "ok") {
      rocktomicSnapshot = rocktomicResult.snapshot;
    } else if (rocktomicResult.kind === "error") {
      sourceWarnings.push(
        rocktomicResult.error instanceof Error
          ? rocktomicResult.error.message
          : "Could not load supplier source diagnostics."
      );
    } else {
      sourceWarnings.push("Supplier source diagnostics timed out. Showing Shopify inventory without supplier enrichment.");
    }
  }

  if (shopifyConnected) {
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
