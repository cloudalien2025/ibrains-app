import "server-only";

import {
  GLOBAL_SUPPLIER_SCOPE_USER_ID,
  getSupplierNormalizedSnapshot,
  type PersistedSupplierAssetsNormalized,
  type PersistedSupplierInventoryNormalized,
  type PersistedSupplierPricingNormalized,
  type PersistedSupplierProductNormalized,
  type PersistedSupplierSourceStatus,
  type PersistedSupplierSyncRun,
} from "@/lib/ecomviper/dropshipping/rocktomic-normalized-store";
import { normalizeRocktomicSku } from "@/lib/ecomviper/dropshipping/rocktomic-supplier-intelligence";

export type GlobalSupplierSyncStatus =
  | "synced"
  | "partially_synced"
  | "source_pending"
  | "never_synced"
  | "sync_failed";

export interface GlobalSupplierSyncSummary {
  supplierKey: string;
  globalScopeKey: string;
  productCount: number;
  pricingRecordCount: number;
  inventoryRecordCount: number;
  assetRecordCount: number;
  sourceStatuses: PersistedSupplierSourceStatus[];
  latestRun: PersistedSupplierSyncRun | null;
  detectedMembershipTiers: string[];
  syncStatus: GlobalSupplierSyncStatus;
  lastCheckedAt: string | null;
  lastSuccessfulSyncAt: string | null;
  lastAttemptedSyncAt: string | null;
  lastSyncError: string | null;
}

const REQUIRED_SOURCE_IDS = new Set([
  "catalog_pdf",
  "msrp_profit_margins_report",
  "plds_catalog",
  "inventory_report",
]);

function normalizeSupplierKey(value: string): string {
  const normalized = value.trim().toLowerCase();
  return normalized || "rocktomic";
}

function normalizeSku(value: string): string {
  return normalizeRocktomicSku(value);
}

async function getGlobalSnapshot(supplierKey: string) {
  return getSupplierNormalizedSnapshot({
    userId: GLOBAL_SUPPLIER_SCOPE_USER_ID,
    supplierId: normalizeSupplierKey(supplierKey),
  });
}

function statusIsFailure(status: string): boolean {
  return status === "sync_failed" || status === "source_inaccessible" || status === "source_auth_required";
}

function statusIsSuccess(status: string): boolean {
  return status === "synced" || status === "parsing_partial" || status === "ocr_required";
}

function resolveGlobalSyncStatus(input: {
  productCount: number;
  pricingRecordCount: number;
  inventoryRecordCount: number;
  assetRecordCount: number;
  sourceStatuses: PersistedSupplierSourceStatus[];
  latestRun: PersistedSupplierSyncRun | null;
}): GlobalSupplierSyncStatus {
  const hasAnyRecords =
    input.productCount > 0 ||
    input.pricingRecordCount > 0 ||
    input.inventoryRecordCount > 0 ||
    input.assetRecordCount > 0;
  const hasSuccessfulSync = Boolean(
    input.latestRun?.completedAt ||
      input.sourceStatuses.some((source) => source.lastSuccessfulSyncAt)
  );

  if (!hasAnyRecords && !hasSuccessfulSync) return "never_synced";

  const required = input.sourceStatuses.filter((source) => REQUIRED_SOURCE_IDS.has(source.sourceId));
  const optional = input.sourceStatuses.filter((source) => !REQUIRED_SOURCE_IDS.has(source.sourceId));

  if (required.some((source) => statusIsFailure(source.syncStatus))) return "sync_failed";
  if (required.length > 0 && required.every((source) => !statusIsSuccess(source.syncStatus))) {
    return hasAnyRecords ? "partially_synced" : "source_pending";
  }
  if (optional.some((source) => statusIsFailure(source.syncStatus) || source.lastError)) {
    return "partially_synced";
  }
  if (required.some((source) => !statusIsSuccess(source.syncStatus))) return "partially_synced";

  return "synced";
}

function latestSourceCheck(statuses: PersistedSupplierSourceStatus[]): string | null {
  return statuses
    .map((source) => source.lastCheckedAt)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1) ?? null;
}

function latestSourceSuccess(statuses: PersistedSupplierSourceStatus[]): string | null {
  return statuses
    .map((source) => source.lastSuccessfulSyncAt)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1) ?? null;
}

export async function getGlobalSupplierProductBySku(
  supplierKey: string,
  sku: string
): Promise<PersistedSupplierProductNormalized | null> {
  const snapshot = await getGlobalSnapshot(supplierKey);
  const normalizedSku = normalizeSku(sku);
  return snapshot?.products.find((product) => product.sku === normalizedSku) ?? null;
}

export async function getGlobalSupplierInventoryBySku(
  supplierKey: string,
  sku: string
): Promise<PersistedSupplierInventoryNormalized | null> {
  const snapshot = await getGlobalSnapshot(supplierKey);
  return snapshot?.inventoryBySku.get(normalizeSku(sku)) ?? null;
}

export async function getGlobalSupplierPricingBySku(
  supplierKey: string,
  sku: string
): Promise<PersistedSupplierPricingNormalized | null> {
  const snapshot = await getGlobalSnapshot(supplierKey);
  return snapshot?.pricingBySku.get(normalizeSku(sku)) ?? null;
}

export async function getGlobalSupplierAssetsBySku(
  supplierKey: string,
  sku: string
): Promise<PersistedSupplierAssetsNormalized | null> {
  const snapshot = await getGlobalSnapshot(supplierKey);
  return snapshot?.assetsBySku.get(normalizeSku(sku)) ?? null;
}

export async function getGlobalSupplierMembershipTiers(supplierKey: string): Promise<string[]> {
  const snapshot = await getGlobalSnapshot(supplierKey);
  if (!snapshot) return [];
  return Array.from(
    new Set(
      Array.from(snapshot.pricingBySku.values()).flatMap((pricing) => pricing.detectedMembershipTiers)
    )
  ).filter(Boolean);
}

export async function getGlobalSupplierSyncSummary(supplierKey: string): Promise<GlobalSupplierSyncSummary> {
  const normalizedSupplierKey = normalizeSupplierKey(supplierKey);
  const snapshot = await getGlobalSnapshot(normalizedSupplierKey);
  const products = snapshot?.products ?? [];
  const sourceStatuses = snapshot?.sourceStatuses ?? [];
  const latestRun = snapshot?.latestRun ?? null;
  const pricingRecordCount = snapshot?.pricingBySku.size ?? 0;
  const inventoryRecordCount = snapshot?.inventoryBySku.size ?? 0;
  const assetRecordCount = snapshot?.assetsBySku.size ?? 0;
  const detectedMembershipTiers = await getGlobalSupplierMembershipTiers(normalizedSupplierKey);
  const syncStatus = resolveGlobalSyncStatus({
    productCount: products.length,
    pricingRecordCount,
    inventoryRecordCount,
    assetRecordCount,
    sourceStatuses,
    latestRun,
  });

  return {
    supplierKey: normalizedSupplierKey,
    globalScopeKey: GLOBAL_SUPPLIER_SCOPE_USER_ID,
    productCount: products.length,
    pricingRecordCount,
    inventoryRecordCount,
    assetRecordCount,
    sourceStatuses,
    latestRun,
    detectedMembershipTiers,
    syncStatus,
    lastCheckedAt: latestRun?.completedAt || latestSourceCheck(sourceStatuses),
    lastSuccessfulSyncAt: latestSourceSuccess(sourceStatuses),
    lastAttemptedSyncAt: latestRun?.attemptedAt || null,
    lastSyncError:
      syncStatus === "sync_failed"
        ? latestRun?.lastError || sourceStatuses.find((source) => statusIsFailure(source.syncStatus))?.lastError || null
        : sourceStatuses.find((source) => !REQUIRED_SOURCE_IDS.has(source.sourceId) && source.lastError)?.lastError || null,
  };
}
