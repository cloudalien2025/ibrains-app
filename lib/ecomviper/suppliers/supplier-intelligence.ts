import "server-only";

import { getRocktomicSourceIngestionSnapshot } from "@/lib/ecomviper/dropshipping/rocktomic-source-ingestion";
import {
  matchRocktomicBySkus,
  type RocktomicSupplierProduct,
  type RocktomicSkuMatchResult,
} from "@/lib/ecomviper/dropshipping/rocktomic-supplier-intelligence";

export type SupplierPlatform = "rocktomic";

export interface SupplierCatalogSnapshot {
  platform: SupplierPlatform;
  supplierName: string;
  products: RocktomicSupplierProduct[];
  inventoryAvailable: boolean;
  lastCheckedAt: string;
  syncStatus: string;
}

export interface SupplierSkuMatchResult {
  platform: SupplierPlatform;
  supplierName: string;
  match: RocktomicSkuMatchResult;
  inventoryAvailable: boolean;
  lastCheckedAt: string;
  syncStatus: string;
}

export async function getPrimarySupplierCatalogSnapshot(options?: {
  allowRefresh?: boolean;
  triggerBackgroundRefresh?: boolean;
}): Promise<SupplierCatalogSnapshot> {
  const snapshot = await getRocktomicSourceIngestionSnapshot({
    allowRefresh: options?.allowRefresh ?? true,
    triggerBackgroundRefresh: options?.triggerBackgroundRefresh ?? true,
  });
  return {
    platform: "rocktomic",
    supplierName: "Rocktomic",
    products: snapshot.products,
    inventoryAvailable: snapshot.inventoryAvailable,
    lastCheckedAt: snapshot.lastCheckedAt,
    syncStatus: snapshot.syncStatus,
  };
}

export async function matchPrimarySupplierBySkus(
  skus: string[],
  options?: { userId?: string | null; allowRefresh?: boolean; triggerBackgroundRefresh?: boolean }
): Promise<SupplierSkuMatchResult> {
  const snapshot = await getRocktomicSourceIngestionSnapshot({
    userId: options?.userId ?? null,
    allowRefresh: options?.allowRefresh ?? true,
    triggerBackgroundRefresh: options?.triggerBackgroundRefresh ?? true,
  });
  return {
    platform: "rocktomic",
    supplierName: "Rocktomic",
    match: matchRocktomicBySkus(skus, snapshot.products),
    inventoryAvailable: snapshot.inventoryAvailable,
    lastCheckedAt: snapshot.lastCheckedAt,
    syncStatus: snapshot.syncStatus,
  };
}
