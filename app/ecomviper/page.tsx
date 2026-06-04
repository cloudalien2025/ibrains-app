import EcomViperDashboardClient from "@/app/ecomviper/ecomviper-dashboard-client";
import { requireSignedInUser } from "@/lib/auth/requireSignedInUser";
import {
  toEcomViperProductInventoryRows,
  type EcomViperProductInventoryRow,
} from "@/lib/ecomviper/shopify/shopify-inventory-foundation";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
const ROCKTOMIC_SOFT_TIMEOUT_MS = 3_500;
const SHOPIFY_SOFT_TIMEOUT_MS = 3_500;

type AsyncResult<T> = { ok: true; value: T } | { ok: false; error: unknown };

function timeoutResult(label: string): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`${label} timed out.`)), SHOPIFY_SOFT_TIMEOUT_MS);
  });
}

async function guarded<T>(label: string, work: () => Promise<T>): Promise<AsyncResult<T>> {
  try {
    return { ok: true, value: await Promise.race([work(), timeoutResult(label)]) };
  } catch (error) {
    return { ok: false, error };
  }
}

function warningMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim().length ? error.message : fallback;
}

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
  let rows: EcomViperProductInventoryRow[] = [];
  const sourceWarnings: string[] = [];

  const [connectionResult, importStateResult, openAiStatusResult] = await Promise.all([
    guarded("Shopify connection status", async () => {
      const mod = await import("@/lib/ecomviper/shopify/shopify-connection");
      return mod.getShopifyConnectionStatusForUser(userId);
    }),
    guarded("Shopify import state", async () => {
      const mod = await import("@/lib/ecomviper/shopify/shopify-import");
      return mod.getShopifyImportStateForUser(userId);
    }),
    guarded("OpenAI connection status", async () => {
      const mod = await import("@/lib/ecomviper/shopify/openai-connection");
      return mod.getShopifyOpenAiConnectionStatusForUser(userId);
    }),
  ]);

  if (connectionResult.ok) {
    shopifyConnected = connectionResult.value.connected;
    storeDomain = connectionResult.value.storeDomain;
    shopifyStatusLabel = connectionResult.value.connected ? "Connected" : "Not connected";
  } else {
    sourceWarnings.push(
      warningMessage(connectionResult.error, "Could not load Shopify connection status.")
    );
  }

  if (importStateResult.ok) {
    lastImportAt = importStateResult.value.lastImportAt;
  } else {
    sourceWarnings.push(
      warningMessage(importStateResult.error, "Could not load Shopify import state.")
    );
  }

  if (openAiStatusResult.ok) {
    openAiStatusLabel = openAiStatusResult.value.connected ? "Connected" : "Not connected";
  } else {
    openAiStatusLabel = "Not connected";
  }

  let rocktomicSnapshot: Awaited<
    ReturnType<
      (typeof import("@/lib/ecomviper/dropshipping/rocktomic-source-ingestion"))["getRocktomicSourceIngestionSnapshot"]
    >
  > | null = null;
  if (shopifyConnected) {
    const rocktomicResultPromise = import("@/lib/ecomviper/dropshipping/rocktomic-source-ingestion")
      .then((mod) =>
        mod.getRocktomicSourceIngestionSnapshot({
          userId,
          allowRefresh: false,
          triggerBackgroundRefresh: false,
          includeSeedFallbackProducts: false,
        })
      )
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
        warningMessage(rocktomicResult.error, "Could not load supplier source diagnostics.")
      );
    } else {
      sourceWarnings.push("Supplier source diagnostics timed out. Showing Shopify inventory without supplier enrichment.");
    }
  }

  if (shopifyConnected) {
    const productsResult = await guarded("Shopify product listing", async () => {
      const mod = await import("@/lib/ecomviper/shopify/shopify-import");
      return mod.listShopifyProductsForUser(userId);
    });
    if (productsResult.ok) {
      rows = toEcomViperProductInventoryRows(productsResult.value, {
        supplierProducts: rocktomicSnapshot?.products,
        rocktomicInventoryAvailable: rocktomicSnapshot?.inventoryAvailable ?? false,
      });
    } else {
      sourceWarnings.push(warningMessage(productsResult.error, "Could not load Shopify products."));
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
