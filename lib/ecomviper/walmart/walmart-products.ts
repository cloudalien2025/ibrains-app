import "server-only";

import { appendActivityLog } from "@/lib/ecomviper/core/activity-log";
import { getWalmartConnectionHealth } from "@/lib/ecomviper/walmart/walmart-auth";
import {
  getDashboardCounts,
  getLastImportAt,
  getWalmartRuntimeMode,
  getMockProductBySku,
  importMockProducts,
  listDrafts,
  listMockProducts,
} from "@/lib/ecomviper/walmart/walmart-mock-data";
import type { WalmartDashboardSnapshot, WalmartImportResult, WalmartProductRecord } from "@/lib/ecomviper/walmart/walmart-types";

export function listWalmartProducts(): WalmartProductRecord[] {
  return listMockProducts();
}

export function getWalmartProductBySku(sku: string): WalmartProductRecord | null {
  return getMockProductBySku(sku);
}

export function importWalmartProducts(): WalmartImportResult {
  return importMockProducts();
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
  const products = listMockProducts();
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
