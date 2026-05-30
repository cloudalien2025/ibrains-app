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
}

export interface SupplierSkuMatchResult {
  platform: SupplierPlatform;
  supplierName: string;
  match: RocktomicSkuMatchResult;
  inventoryAvailable: boolean;
  lastCheckedAt: string;
}

export async function getPrimarySupplierCatalogSnapshot(): Promise<SupplierCatalogSnapshot> {
  const snapshot = await getRocktomicSourceIngestionSnapshot();
  return {
    platform: "rocktomic",
    supplierName: "Rocktomic",
    products: snapshot.products,
    inventoryAvailable: snapshot.inventoryAvailable,
    lastCheckedAt: snapshot.lastCheckedAt,
  };
}

export async function matchPrimarySupplierBySkus(
  skus: string[],
  options?: { userId?: string | null }
): Promise<SupplierSkuMatchResult> {
  const snapshot = await getRocktomicSourceIngestionSnapshot({ userId: options?.userId ?? null });
  return {
    platform: "rocktomic",
    supplierName: "Rocktomic",
    match: matchRocktomicBySkus(skus, snapshot.products),
    inventoryAvailable: snapshot.inventoryAvailable,
    lastCheckedAt: snapshot.lastCheckedAt,
  };
}
