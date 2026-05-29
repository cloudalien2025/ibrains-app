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

export async function matchPrimarySupplierBySkus(skus: string[]): Promise<SupplierSkuMatchResult> {
  const snapshot = await getPrimarySupplierCatalogSnapshot();
  return {
    platform: snapshot.platform,
    supplierName: snapshot.supplierName,
    match: matchRocktomicBySkus(skus, snapshot.products),
    inventoryAvailable: snapshot.inventoryAvailable,
    lastCheckedAt: snapshot.lastCheckedAt,
  };
}
