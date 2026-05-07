import "server-only";

import { appendActivityLog } from "@/lib/ecomviper/core/activity-log";
import { getWalmartConnectionHealth } from "@/lib/ecomviper/walmart/walmart-auth";
import {
  getDashboardCounts,
  getLastImportAt,
  getProductBySku,
  getWalmartRuntimeMode,
  listDrafts,
  listProducts,
  replaceProducts,
} from "@/lib/ecomviper/walmart/walmart-store";
import type { WalmartDashboardSnapshot, WalmartImportResult, WalmartProductRecord } from "@/lib/ecomviper/walmart/walmart-types";

export function listWalmartProducts(): WalmartProductRecord[] {
  return listProducts();
}

export function getWalmartProductBySku(sku: string): WalmartProductRecord | null {
  return getProductBySku(sku);
}

export function importWalmartProducts(): WalmartImportResult {
  const now = new Date().toISOString();
  // Production import seam: replace with Walmart item list/search read implementation.
  replaceProducts([], now);

  appendActivityLog({
    marketplace: "walmart",
    actionType: "product_import",
    result: "warning",
    message: "Production product import is not configured yet. No products were imported.",
  });

  return {
    importedCount: 0,
    lastImportAt: now,
    mode: getWalmartRuntimeMode(),
  };
}

export function getWalmartDashboardSnapshot(): WalmartDashboardSnapshot {
  const counts = getDashboardCounts();
  const connection = getWalmartConnectionHealth();

  return {
    mode: getWalmartRuntimeMode(),
    connection,
    productsImported: counts.productsImported,
    lastImportAt: getLastImportAt(),
    draftChanges: counts.draftChanges,
    feedErrors: counts.feedErrors,
    listingsNeedingAttention: counts.listingsNeedingAttention,
    recentProducts: counts.recentProducts,
    recentActivity: counts.recentActivity,
    attentionProducts: counts.attentionProducts,
  };
}

export function getEcomViperMarketplaceMetrics() {
  const products = listProducts();
  const drafts = listDrafts();
  const attention = products.filter((item) => item.issues.length > 0 || item.status !== "active");

  return {
    connectedMarketplaces: getWalmartConnectionHealth().connectionStatus === "connected" ? 1 : 0,
    productsImported: products.length,
    draftChanges: drafts.filter((draft) => draft.status !== "discarded").length,
    syncErrors: attention.filter((item) => item.status === "sync_failed").length,
    listingsNeedingAttention: attention.length,
  };
}

export function logWalmartProductSync(sku: string, message: string): void {
  appendActivityLog({
    marketplace: "walmart",
    sku,
    actionType: "product_sync",
    result: "success",
    message,
  });
}
