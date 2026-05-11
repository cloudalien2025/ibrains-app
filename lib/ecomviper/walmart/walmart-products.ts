import "server-only";

import crypto from "crypto";
import { normalizeWalmartProduct } from "@/lib/ecomviper/core/product-normalizer";
import { appendActivityLog, listActivityLogs } from "@/lib/ecomviper/core/activity-log";
import { getWalmartConnectionHealth, requestWalmartTokenForUser } from "@/lib/ecomviper/walmart/walmart-auth";
import { WALMART_PRODUCTION_BASE_URL } from "@/lib/ecomviper/walmart/walmart-client";
import { enrichProductsFromItemReport } from "@/lib/ecomviper/walmart/walmart-item-report";
import { enrichWalmartImageFromItemSearch } from "@/lib/ecomviper/walmart/walmart-item-search";
import { resolveWalmartCatalogImage } from "@/lib/ecomviper/walmart/walmart-image-providers";
import { runPublicListingImageEnrichmentQueue } from "@/lib/ecomviper/walmart/walmart-import-enrichment";
import { extractWalmartPublicProductIdFromUrl } from "@/lib/ecomviper/walmart/serpapi-walmart-images";
import { discardWalmartDraftsForSkuForUser, listWalmartDraftsForUser } from "@/lib/ecomviper/walmart/walmart-drafts";
import {
  getLastImportAt,
  getProductBySku,
  getWalmartRuntimeMode,
  listFeeds,
  listDrafts,
  listProducts,
  replaceProducts,
} from "@/lib/ecomviper/walmart/walmart-store";
import {
  archivePersistedWalmartProductBySku,
  clearPersistedWalmartProducts,
  getPersistedWalmartLastImportAt,
  getPersistedWalmartProductBySku,
  getPersistedWalmartProductBySkuWithArchiveState,
  listPersistedWalmartProducts,
  replacePersistedWalmartProducts,
} from "@/lib/ecomviper/walmart/walmart-product-repository";
import type {
  WalmartDashboardSnapshot,
  WalmartImportErrorCategory,
  WalmartImportFailurePhase,
  WalmartImageMatchMethod,
  WalmartImageSyncStatus,
  WalmartImportResult,
  WalmartInventoryStatus,
  WalmartProductRecord,
  WalmartSerpApiProviderStatus,
} from "@/lib/ecomviper/walmart/walmart-types";

const WALMART_IMPORT_PAGE_LIMIT = 100;
const WALMART_IMPORT_MAX_PAGES = 5;
const WALMART_IMPORT_MAX_PAGES_BOUNDED = 1;
const WALMART_IMAGE_ENRICHMENT_CONCURRENCY = 4;
const WALMART_HOST_SUFFIX = ".walmart.com";
const WALMART_IMPORT_FAILURE_NAME = "WalmartImportFailureError";
const WALMART_CATALOG_REQUEST_TIMEOUT_MS = 12_000;
const WALMART_INVENTORY_REQUEST_TIMEOUT_MS = 4_500;
const WALMART_INVENTORY_REQUEST_TIMEOUT_MS_BOUNDED = 2_500;
const WALMART_IMPORT_MAX_IMAGE_ENRICHMENT_PRODUCTS = 45;
const WALMART_IMPORT_MAX_IMAGE_ENRICHMENT_PRODUCTS_BOUNDED = 4;
const WALMART_IMPORT_MAX_INVENTORY_LOOKUPS = 250;
const WALMART_IMPORT_MAX_INVENTORY_LOOKUPS_BOUNDED = 0;

type WalmartImportPartialProgress = {
  importedCount: number;
  fetchedCount: number;
  processedCount: number;
  queuedCount: number;
  imageFoundCount: number;
  imageMissingCount: number;
  imageNotFoundCount: number;
  imageAmbiguousCount: number;
  imageFailedCount: number;
  imageSkippedNoProviderCount: number;
};

export interface WalmartImportFailureError extends Error {
  name: typeof WALMART_IMPORT_FAILURE_NAME;
  category: WalmartImportErrorCategory;
  phase: WalmartImportFailurePhase;
  statusCode?: number;
  correlationId?: string | null;
  endpointFamily?: string | null;
  responseShapeSummary?: string | null;
  partialProgress?: WalmartImportPartialProgress;
}

interface WalmartImportOptions {
  boundedRuntime?: boolean;
  maxImageEnrichmentProducts?: number;
  maxInventoryLookups?: number;
  maxCatalogPages?: number;
}

function createWalmartImportFailure(input: {
  category: WalmartImportErrorCategory;
  phase: WalmartImportFailurePhase;
  reason: string;
  statusCode?: number;
  correlationId?: string | null;
  endpointFamily?: string | null;
  responseShapeSummary?: string | null;
  partialProgress?: WalmartImportPartialProgress;
}): WalmartImportFailureError {
  const error = new Error(input.reason) as WalmartImportFailureError;
  error.name = WALMART_IMPORT_FAILURE_NAME;
  error.category = input.category;
  error.phase = input.phase;
  error.statusCode = input.statusCode;
  error.correlationId = input.correlationId ?? null;
  error.endpointFamily = input.endpointFamily ?? null;
  error.responseShapeSummary = input.responseShapeSummary ?? null;
  error.partialProgress = input.partialProgress ? { ...input.partialProgress } : undefined;
  return error;
}

export function isWalmartImportFailureError(error: unknown): error is WalmartImportFailureError {
  return (
    error instanceof Error &&
    (error as WalmartImportFailureError).name === WALMART_IMPORT_FAILURE_NAME &&
    typeof (error as WalmartImportFailureError).category === "string" &&
    typeof (error as WalmartImportFailureError).phase === "string"
  );
}

function normalizeUnknownErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  if (typeof error === "string" && error.trim()) return error.trim();
  if (error && typeof error === "object") {
    const candidate = (error as { message?: unknown }).message;
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return fallback;
}

function isLikelyDatabaseError(error: unknown): boolean {
  const message = normalizeUnknownErrorMessage(error, "").toLowerCase();
  if (!message) return false;
  return (
    message.includes("database") ||
    message.includes("relation") ||
    message.includes("sql") ||
    message.includes("postgres") ||
    message.includes("query failed") ||
    message.includes("connection refused") ||
    message.includes("timeout")
  );
}

export function listWalmartProducts(): WalmartProductRecord[] {
  return listProducts();
}

export function getWalmartProductBySku(sku: string): WalmartProductRecord | null {
  return getProductBySku(sku);
}

export async function listWalmartProductsForUser(userId: string): Promise<WalmartProductRecord[]> {
  return listPersistedWalmartProducts(userId);
}

export async function getWalmartProductBySkuForUser(
  userId: string,
  sku: string
): Promise<WalmartProductRecord | null> {
  return getPersistedWalmartProductBySku(userId, sku);
}

export async function isWalmartProductArchivedForUser(userId: string, sku: string): Promise<boolean> {
  const lookup = await getPersistedWalmartProductBySkuWithArchiveState({ userId, sku });
  return lookup.archived;
}

export async function replaceWalmartProductsForUser(input: {
  userId: string;
  products: WalmartProductRecord[];
  importedAt: string | null;
}): Promise<void> {
  await replacePersistedWalmartProducts(input);
  replaceProducts(input.products, input.importedAt);
}

export async function clearWalmartProductsForUser(userId: string): Promise<{
  clearedProductCount: number;
  clearedImportStateCount: number;
  clearedImageMetadataCount: number;
}> {
  const result = await clearPersistedWalmartProducts(userId);
  replaceProducts([], null);
  return {
    clearedProductCount: result.clearedProductCount,
    clearedImportStateCount: result.clearedImportStateCount,
    clearedImageMetadataCount: result.clearedProductCount,
  };
}

export interface WalmartLocalProductRemovalResult {
  sku: string;
  removed: boolean;
  archived: boolean;
  affectedDraftCount: number;
  productTitle: string;
}

export async function removeWalmartProductFromCatalogForUser(input: {
  userId: string;
  sku: string;
}): Promise<WalmartLocalProductRemovalResult | null> {
  const lookup = await getPersistedWalmartProductBySkuWithArchiveState({
    userId: input.userId,
    sku: input.sku,
  });
  if (!lookup.product) {
    return null;
  }

  const affectedDraftCount = await discardWalmartDraftsForSkuForUser(input.userId, lookup.product.sku);
  const removed = await archivePersistedWalmartProductBySku({
    userId: input.userId,
    sku: lookup.product.sku,
  });

  if (removed) {
    appendActivityLog({
      marketplace: "walmart",
      sku: lookup.product.sku,
      actionType: "product_remove_local",
      result: "warning",
      message:
        affectedDraftCount > 0
          ? `Product removed from EcomViper catalog. ${affectedDraftCount} local draft(s) were discarded.`
          : "Product removed from EcomViper catalog.",
      afterPayload: {
        sku: lookup.product.sku,
        title: lookup.product.title,
        affectedDraftCount,
      },
    });
  }

  return {
    sku: lookup.product.sku,
    removed,
    archived: removed,
    affectedDraftCount,
    productTitle: lookup.product.title,
  };
}

function asString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "bigint") return value.toString();
  return "";
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function asObjectArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => asObject(entry))
    .filter((entry): entry is Record<string, unknown> => entry !== null);
}

function firstNonEmptyString(...values: unknown[]): string {
  for (const value of values) {
    const candidate = asString(value);
    if (candidate) return candidate;
  }
  return "";
}

function firstNumber(...values: unknown[]): number | null {
  for (const value of values) {
    const candidate = asNumber(value);
    if (candidate !== null) return candidate;
  }
  return null;
}

function asHttpUrl(value: unknown): string {
  const candidate = asString(value);
  if (!candidate) return "";
  return /^https?:\/\//i.test(candidate) ? candidate : "";
}

function normalizeWalmartPublicUrl(value: unknown): string {
  const candidate = asHttpUrl(value);
  if (!candidate) return "";
  try {
    const parsed = new URL(candidate);
    const host = parsed.hostname.toLowerCase();
    if (!(host === "walmart.com" || host.endsWith(WALMART_HOST_SUFFIX))) {
      return "";
    }
    parsed.protocol = "https:";
    return parsed.toString();
  } catch {
    return "";
  }
}

function normalizeWalmartPublicProductId(value: unknown): string {
  const candidate = asString(value);
  if (!candidate) return "";
  return /^\d{6,20}$/.test(candidate) ? candidate : "";
}

function firstPublicWalmartProductId(...values: unknown[]): string {
  for (const value of values) {
    const candidate = normalizeWalmartPublicProductId(value);
    if (candidate) return candidate;
  }
  return "";
}

function firstHttpUrl(...values: unknown[]): string {
  for (const value of values) {
    const candidate = asHttpUrl(value);
    if (candidate) return candidate;
  }
  return "";
}

function normalizeSkuKey(sku: string): string {
  return sku.trim().toUpperCase();
}

function extractSku(item: Record<string, unknown>): string {
  return firstNonEmptyString(item.sku, item.SKU, item.sellerSku, item.sellerPartNumber);
}

const IMAGE_ISSUES = new Set([
  "Image not provided by Walmart catalog",
  "Image enrichment source not configured",
  "Image not provided by Walmart Item Search",
  "Image match ambiguous",
  "Image sync failed",
  "Image enrichment not synced",
]);

function stripImageIssues(issues: string[]): string[] {
  return issues.filter((issue) => !IMAGE_ISSUES.has(issue));
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.trim().length > 0)));
}

function imageIssueBySyncStatus(
  status: WalmartImageSyncStatus,
  source: WalmartProductRecord["imageSource"]
): string | null {
  if (status === "not_found") {
    if (source === "walmart_item_search") return "Image not provided by Walmart Item Search";
    return "Image not provided by Walmart catalog";
  }
  if (status === "ambiguous") return "Image match ambiguous";
  if (status === "failed") return "Image sync failed";
  if (status === "not_synced") return "Image enrichment not synced";
  return null;
}

function imageStatusMessageBySyncStatus(
  status: WalmartImageSyncStatus,
  reason?: string | null
): WalmartProductRecord["imageStatusMessage"] {
  if (status === "found") return "Image available";
  const safeReason = reason?.trim();
  if (safeReason) return safeReason;
  if (status === "not_found") return "Image not provided by Walmart catalog";
  if (status === "ambiguous") return "Image match ambiguous";
  if (status === "failed") return "Image sync failed";
  return "Image enrichment not synced";
}

function extractCatalogIdentifiers(item: Record<string, unknown>): {
  upc: string;
  gtin: string;
  wpid: string;
  itemId: string;
  publishedStatus: string;
} {
  const identifiers =
    asObject(item.identifiers) ?? asObject(item.productIdentifiers) ?? asObject(item.productIds) ?? asObject(item.ids);

  return {
    upc: firstNonEmptyString(item.upc, item.UPC, identifiers?.upc, identifiers?.UPC),
    gtin: firstNonEmptyString(item.gtin, item.GTIN, identifiers?.gtin, identifiers?.GTIN),
    wpid: firstNonEmptyString(item.wpid, item.wpID, item.WPID, identifiers?.wpid, identifiers?.wpID),
    itemId: firstNonEmptyString(item.itemId, item.usItemId, item.id, identifiers?.itemId, identifiers?.usItemId),
    publishedStatus: firstNonEmptyString(item.publishedStatus, item.published, item.lifecycleStatus),
  };
}

function extractPublicListingReference(item: Record<string, unknown>): {
  publicWalmartUrl: string;
  publicWalmartProductId: string;
} {
  const product = asObject(item.product);
  const content = asObject(item.content);
  const links = asObject(item.links);
  const identifiers =
    asObject(item.identifiers) ?? asObject(item.productIdentifiers) ?? asObject(item.productIds) ?? asObject(item.ids);

  const publicWalmartUrl = [
    item.publicWalmartUrl,
    item.productPageUrl,
    item.productUrl,
    item.canonicalUrl,
    item.url,
    item.itemUrl,
    item.shareUrl,
    item.buyUrl,
    product?.publicWalmartUrl,
    product?.productPageUrl,
    product?.productUrl,
    product?.canonicalUrl,
    product?.url,
    content?.productUrl,
    content?.canonicalUrl,
    links?.product,
    links?.canonical,
    asObjectArray(item.links)[0]?.href,
  ]
    .map((value) => normalizeWalmartPublicUrl(value))
    .find(Boolean) ?? "";

  const productIdFromUrl = publicWalmartUrl ? extractWalmartPublicProductIdFromUrl(publicWalmartUrl) ?? "" : "";

  const publicWalmartProductId = firstPublicWalmartProductId(
    item.publicWalmartProductId,
    item.productId,
    item.usItemId,
    item.itemId,
    item.id,
    item.usItemID,
    item.product_id,
    product?.publicWalmartProductId,
    product?.productId,
    product?.itemId,
    product?.usItemId,
    content?.productId,
    identifiers?.publicWalmartProductId,
    identifiers?.productId,
    identifiers?.itemId,
    identifiers?.usItemId,
    productIdFromUrl
  );

  return {
    publicWalmartUrl,
    publicWalmartProductId,
  };
}

function optionalHeader(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function buildWalmartApiHeaders(accessToken: string, correlationId: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "WM_SEC.ACCESS_TOKEN": accessToken,
    "WM_QOS.CORRELATION_ID": correlationId,
    "WM_SVC.NAME": "Walmart Marketplace",
  };

  const consumerChannelType = optionalHeader(process.env.WALMART_CONSUMER_CHANNEL_TYPE);
  const partnerId = optionalHeader(process.env.WALMART_PARTNER_ID);

  if (consumerChannelType) {
    headers["WM_CONSUMER.CHANNEL.TYPE"] = consumerChannelType;
  }
  if (partnerId) {
    headers["WM_PARTNER.ID"] = partnerId;
  }

  return headers;
}

function extractItemNodes(payload: unknown): { items: Record<string, unknown>[]; payloadShape: string } {
  const root = asObject(payload);
  if (!root) {
    return { items: [], payloadShape: "invalid_root" };
  }

  const candidates: Array<{ value: unknown; shape: string }> = [];
  const itemResponse = asObject(root.ItemResponse);

  candidates.push({ value: root.items, shape: "root.items" });
  candidates.push({ value: root.Item, shape: "root.Item" });
  candidates.push({ value: root.payload, shape: "root.payload" });
  candidates.push({ value: root.ItemResponse, shape: "root.ItemResponse.array" });
  candidates.push({ value: itemResponse?.items, shape: "root.ItemResponse.items" });
  candidates.push({ value: itemResponse?.item, shape: "root.ItemResponse.item" });
  candidates.push({ value: itemResponse?.Item, shape: "root.ItemResponse.Item" });
  candidates.push({ value: itemResponse?.payload, shape: "root.ItemResponse.payload" });
  candidates.push({ value: asObject(root.data)?.items, shape: "root.data.items" });

  for (const candidate of candidates) {
    const arrayEntries = asObjectArray(candidate.value);
    if (arrayEntries.length > 0) {
      return { items: arrayEntries, payloadShape: candidate.shape };
    }
  }

  if (Array.isArray(root.ItemResponse)) {
    return { items: [], payloadShape: "root.ItemResponse.array_empty" };
  }
  if (itemResponse) {
    return { items: [], payloadShape: "root.ItemResponse.object_empty" };
  }

  return { items: [], payloadShape: "unknown" };
}

function extractNextCursor(payload: unknown): string | null {
  const root = asObject(payload);
  if (!root) return null;
  const itemResponse = asObject(root.ItemResponse);

  const cursor = firstNonEmptyString(
    root.nextCursor,
    root.nextPageCursor,
    asObject(root.meta)?.nextCursor,
    itemResponse?.nextCursor,
    itemResponse?.nextPageCursor
  );

  return cursor || null;
}

function toAttributeMap(value: unknown): Record<string, string> {
  const direct = asObject(value);
  if (direct) {
    const mapped: Record<string, string> = {};
    for (const [key, raw] of Object.entries(direct)) {
      const normalized = firstNonEmptyString(
        asObject(raw)?.value,
        asObject(raw)?.name,
        typeof raw === "number" ? String(raw) : raw
      );
      if (normalized) {
        mapped[key] = normalized;
      }
    }
    return mapped;
  }

  if (Array.isArray(value)) {
    const mapped: Record<string, string> = {};
    for (const entry of value) {
      const row = asObject(entry);
      if (!row) continue;
      const name = firstNonEmptyString(row.name, row.attributeName, row.key, row.id);
      const valueText = firstNonEmptyString(row.value, row.attributeValue, row.text);
      if (name && valueText) {
        mapped[name] = valueText;
      }
    }
    return mapped;
  }

  return {};
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => firstNonEmptyString(entry, asObject(entry)?.value, asObject(entry)?.text))
    .filter((entry) => entry.length > 0);
}

function findImageUrlInNode(value: unknown, inImageContext = false, depth = 0): string {
  if (depth > 6) return "";

  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = findImageUrlInNode(entry, inImageContext, depth + 1);
      if (found) return found;
    }
    return "";
  }

  if (typeof value === "string") {
    return inImageContext ? asHttpUrl(value) : "";
  }

  const node = asObject(value);
  if (!node) return "";

  const entries = Object.entries(node);

  for (const [key, child] of entries) {
    const nextInImageContext = inImageContext || /(image|asset|thumbnail)/i.test(key);
    if (typeof child === "string" && nextInImageContext) {
      const asUrl = asHttpUrl(child);
      if (asUrl) return asUrl;
    }
  }

  for (const [key, child] of entries) {
    const nextInImageContext = inImageContext || /(image|asset|thumbnail)/i.test(key);
    const found = findImageUrlInNode(child, nextInImageContext, depth + 1);
    if (found) return found;
  }

  return "";
}

function extractImageUrl(item: Record<string, unknown>): string {
  const product = asObject(item.product);
  const content = asObject(item.content);
  const images = asObject(item.images);
  const direct = firstHttpUrl(
    item.mainImageUrl,
    item.imageUrl,
    item.productImageUrl,
    item.itemImageUrl,
    product?.mainImageUrl,
    product?.imageUrl,
    product?.productImageUrl,
    product?.primaryImageUrl,
    content?.mainImageUrl,
    content?.imageUrl,
    images?.primaryImageUrl
  );
  if (direct) return direct;

  const fromArrays = firstHttpUrl(
    asObjectArray(item.images)[0]?.url,
    asObjectArray(item.images)[0]?.imageUrl,
    asObjectArray(item.assets)[0]?.url,
    asObjectArray(item.assets)[0]?.imageUrl,
    asObjectArray(item.productAssets)[0]?.url,
    asObjectArray(item.productAssets)[0]?.imageUrl
  );
  if (fromArrays) return fromArrays;

  const deepNodes: unknown[] = [
    item.images,
    item.assets,
    item.productAssets,
    product?.images,
    product?.assets,
    content?.images,
    content?.assets,
    item,
  ];

  for (const node of deepNodes) {
    const candidate = findImageUrlInNode(node);
    if (candidate) return candidate;
  }

  return "";
}

interface InventorySnapshot {
  status: WalmartInventoryStatus;
  quantity: number;
  source: string;
}

function availabilityToInventoryStatus(value: unknown): WalmartInventoryStatus | null {
  const text = firstNonEmptyString(value, asObject(value)?.status, asObject(value)?.availabilityStatus).toLowerCase();
  if (!text) return null;
  if (text.includes("out_of_stock") || text.includes("outofstock") || text.includes("out of stock")) {
    return "out_of_stock";
  }
  if (text.includes("in_stock") || text.includes("instock") || text.includes("in stock")) {
    return "unknown";
  }
  return null;
}

function resolveCatalogInventory(item: Record<string, unknown>): InventorySnapshot {
  const quantity = firstNumber(
    item.inventoryQuantity,
    item.quantity,
    asObject(item.inventory)?.quantity,
    asObject(asObject(item.inventory)?.quantity)?.amount,
    asObject(item.availability)?.quantity,
    asObject(asObject(item.availability)?.quantity)?.amount,
    asObject(item.fulfillment)?.quantity,
    asObject(asObject(item.fulfillment)?.quantity)?.amount
  );
  if (quantity !== null) {
    return {
      status: "known",
      quantity: Math.max(0, quantity),
      source: "catalog_quantity",
    };
  }

  const availabilityStatus = availabilityToInventoryStatus(item.availability);
  if (availabilityStatus === "out_of_stock") {
    return {
      status: "out_of_stock",
      quantity: 0,
      source: "catalog_availability",
    };
  }

  return {
    status: "unknown",
    quantity: 0,
    source: "catalog_missing",
  };
}

function mergeInventorySnapshots(
  catalogSnapshot: InventorySnapshot,
  inventoryApiSnapshot: InventorySnapshot | null
): InventorySnapshot {
  if (!inventoryApiSnapshot) return catalogSnapshot;
  if (catalogSnapshot.status === "known") return catalogSnapshot;
  if (inventoryApiSnapshot.status === "known") return inventoryApiSnapshot;
  if (catalogSnapshot.status === "out_of_stock") return catalogSnapshot;
  if (inventoryApiSnapshot.status === "out_of_stock") return inventoryApiSnapshot;
  return inventoryApiSnapshot;
}

function extractInventoryQuantity(payload: unknown): number | null {
  const root = asObject(payload);
  if (!root) return null;
  return firstNumber(
    root.quantity,
    asObject(root.quantity)?.amount,
    root.inventoryQuantity,
    asObject(root.inventory)?.quantity,
    asObject(asObject(root.inventory)?.quantity)?.amount,
    root.availableToSellQty,
    asObject(root.availableToSellQty)?.amount,
    root.onHandQuantity,
    asObject(root.onHandQuantity)?.amount
  );
}

async function fetchInventorySnapshotForSku(
  accessToken: string,
  sku: string,
  timeoutMs = WALMART_INVENTORY_REQUEST_TIMEOUT_MS
): Promise<InventorySnapshot> {
  const url = new URL("/v3/inventory", `${WALMART_PRODUCTION_BASE_URL}/`);
  url.searchParams.set("sku", sku);

  const correlationId = crypto.randomUUID();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const response = await fetch(url.toString(), {
    method: "GET",
    headers: buildWalmartApiHeaders(accessToken, correlationId),
    cache: "no-store",
    signal: controller.signal,
  }).finally(() => clearTimeout(timeout));

  if (!response.ok) {
    return {
      status: "unknown",
      quantity: 0,
      source: `inventory_api_http_${response.status}`,
    };
  }

  const text = await response.text();
  let payload: unknown = {};
  if (text.trim()) {
    try {
      payload = JSON.parse(text) as unknown;
    } catch {
      return {
        status: "unknown",
        quantity: 0,
        source: "inventory_api_invalid_json",
      };
    }
  }
  const quantity = extractInventoryQuantity(payload);
  if (quantity !== null) {
    return {
      status: "known",
      quantity: Math.max(0, quantity),
      source: "inventory_api",
    };
  }

  const availabilityStatus = availabilityToInventoryStatus(asObject(payload)?.availability);
  if (availabilityStatus === "out_of_stock") {
    return {
      status: "out_of_stock",
      quantity: 0,
      source: "inventory_api_availability",
    };
  }

  return {
    status: "unknown",
    quantity: 0,
    source: "inventory_api_missing_quantity",
  };
}

async function fetchInventorySnapshotsForItems(
  accessToken: string,
  items: Record<string, unknown>[],
  options?: { maxLookups?: number; timeoutMs?: number }
): Promise<Map<string, InventorySnapshot>> {
  const bySku = new Map<string, string>();
  for (const item of items) {
    const sku = extractSku(item);
    if (!sku) continue;
    const catalogInventory = resolveCatalogInventory(item);
    if (catalogInventory.status === "known") continue;
    bySku.set(normalizeSkuKey(sku), sku);
  }

  const snapshots = new Map<string, InventorySnapshot>();
  const configuredMaxLookups = options?.maxLookups ?? WALMART_IMPORT_MAX_INVENTORY_LOOKUPS;
  const maxLookups = Math.max(0, configuredMaxLookups);
  if (maxLookups === 0) return snapshots;
  const timeoutMs = Math.max(500, options?.timeoutMs ?? WALMART_INVENTORY_REQUEST_TIMEOUT_MS);
  const skus = Array.from(bySku.entries()).slice(0, maxLookups);
  const concurrency = 8;

  for (let index = 0; index < skus.length; index += concurrency) {
    const batch = skus.slice(index, index + concurrency);
    const results = await Promise.all(
      batch.map(async ([key, sku]) => {
        try {
          const snapshot = await fetchInventorySnapshotForSku(accessToken, sku, timeoutMs);
          return [key, snapshot] as const;
        } catch {
          return [
            key,
            {
              status: "unknown",
              quantity: 0,
              source: "inventory_api_exception",
            } satisfies InventorySnapshot,
          ] as const;
        }
      })
    );

    for (const [key, snapshot] of results) {
      snapshots.set(key, snapshot);
    }
  }

  return snapshots;
}

function normalizeImportedItem(
  item: Record<string, unknown>,
  inventorySnapshotsBySku: Map<string, InventorySnapshot>
): WalmartProductRecord | null {
  const sku = extractSku(item);
  if (!sku) return null;
  const identifiers = extractCatalogIdentifiers(item);
  const publicListingReference = extractPublicListingReference(item);

  const title = firstNonEmptyString(
    item.productName,
    item.title,
    item.name,
    asObject(item.product)?.title,
    asObject(item.product)?.name
  );
  const brand = firstNonEmptyString(item.brand, item.brandName, asObject(item.product)?.brand);
  const category = firstNonEmptyString(
    item.category,
    item.productType,
    item.shelf,
    asObject(item.classification)?.category
  );
  const imageUrl = extractImageUrl(item);
  const imageResolution = resolveWalmartCatalogImage({
    sku,
    catalogImageUrl: imageUrl,
  });

  const price = firstNumber(
    item.price,
    asObject(item.price)?.amount,
    asObject(item.currentPrice)?.amount,
    asObject(item.priceInfo)?.currentPrice
  ) ?? 0;

  const catalogInventory = resolveCatalogInventory(item);
  const inventorySnapshot = mergeInventorySnapshots(
    catalogInventory,
    inventorySnapshotsBySku.get(normalizeSkuKey(sku)) ?? null
  );

  const shortDescription = firstNonEmptyString(item.shortDescription, item.short_desc, item.synopsis);
  const longDescription = firstNonEmptyString(item.longDescription, item.description, item.productDescription);
  const bulletPoints = toStringArray(item.bulletPoints).length
    ? toStringArray(item.bulletPoints)
    : toStringArray(item.keyFeatures);

  const normalized = normalizeWalmartProduct({
    sku,
    title: title || `Walmart item ${sku}`,
    brand: brand || "Unknown",
    upc: identifiers.upc,
    gtin: identifiers.gtin,
    wpid: identifiers.wpid,
    itemId: identifiers.itemId,
    publishedStatus: identifiers.publishedStatus,
    price,
    inventoryQuantity: inventorySnapshot.quantity,
    inventoryStatus: inventorySnapshot.status,
    imageUrl: imageResolution.imageUrl,
    galleryImageUrls: imageResolution.imageUrl ? [imageResolution.imageUrl] : [],
    variantImageUrls: [],
    imageStatus: imageResolution.imageStatus,
    imageStatusMessage: imageResolution.imageStatusMessage,
    imageSource: imageResolution.imageSource,
    imageSyncStatus: imageResolution.imageUrl ? "found" : "not_synced",
    imageMatchMethod: imageResolution.imageUrl ? "catalog" : undefined,
    matchedItemId: identifiers.itemId,
    publicWalmartUrl: publicListingReference.publicWalmartUrl || undefined,
    publicWalmartProductId: publicListingReference.publicWalmartProductId || undefined,
    lastImageSyncedAt: null,
    attributes: toAttributeMap(item.attributes),
    description: longDescription,
    shortDescription,
    bulletPoints,
    rawPayload: item,
  });

  const externalItemId = firstNonEmptyString(
    item.wpID,
    item.wpid,
    item.itemId,
    item.usItemId,
    item.id,
    item.productId,
    asObject(item.identifiers)?.itemId,
    asObject(item.identifiers)?.usItemId,
    asObject(item.identifiers)?.productId,
    publicListingReference.publicWalmartProductId
  );

  return {
    ...normalized,
    externalItemId: externalItemId || normalized.externalItemId,
    upc: identifiers.upc || normalized.upc,
    gtin: identifiers.gtin || normalized.gtin,
    wpid: identifiers.wpid || normalized.wpid,
    itemId: identifiers.itemId || normalized.itemId,
    publishedStatus: identifiers.publishedStatus || normalized.publishedStatus,
    publicWalmartUrl: publicListingReference.publicWalmartUrl || normalized.publicWalmartUrl,
    publicWalmartProductId:
      publicListingReference.publicWalmartProductId || normalized.publicWalmartProductId,
    category: category || normalized.category,
    rawPayload: item,
    normalizedPayload: {
      sku: normalized.sku,
      externalItemId: externalItemId || normalized.externalItemId,
      upc: identifiers.upc || normalized.upc,
      gtin: identifiers.gtin || normalized.gtin,
      wpid: identifiers.wpid || normalized.wpid,
      itemId: identifiers.itemId || normalized.itemId,
      publishedStatus: identifiers.publishedStatus || normalized.publishedStatus,
      publicWalmartUrl: publicListingReference.publicWalmartUrl || normalized.publicWalmartUrl,
      publicWalmartProductId:
        publicListingReference.publicWalmartProductId || normalized.publicWalmartProductId,
      title: normalized.title,
      brand: normalized.brand,
      category: category || normalized.category,
      price: normalized.price,
      inventoryQuantity: normalized.inventoryQuantity,
      inventoryStatus: normalized.inventoryStatus,
      inventorySource: inventorySnapshot.source,
      imageUrl: normalized.imageUrl,
      galleryImageUrls: normalized.galleryImageUrls ?? [],
      variantImageUrls: normalized.variantImageUrls ?? [],
      imageStatus: normalized.imageStatus,
      imageSyncStatus: normalized.imageSyncStatus,
      imageStatusMessage: normalized.imageStatusMessage,
      imageSource: normalized.imageSource,
      imageMatchMethod: normalized.imageMatchMethod,
      matchedItemId: normalized.matchedItemId,
      lastImageSyncedAt: normalized.lastImageSyncedAt,
      imageProvider: imageResolution.enrichmentProvider,
      attributes: normalized.attributes,
      shortDescription: normalized.shortDescription,
      longDescription: normalized.longDescription,
      bulletPoints: normalized.bulletPoints,
    },
  };
}

function summarizeWalmartResponseShape(payload: unknown): string {
  if (Array.isArray(payload)) return `array(${payload.length})`;
  if (!payload || typeof payload !== "object") return typeof payload;
  const keys = Object.keys(payload as Record<string, unknown>).slice(0, 8);
  if (keys.length === 0) return "object_empty";
  return `object:${keys.join("|")}`;
}

function parseWalmartError(responseBody: string, status: number): {
  reason: string;
  responseShapeSummary: string;
} {
  try {
    const parsed = JSON.parse(responseBody) as Record<string, unknown>;
    const errors = Array.isArray(parsed.errors) ? parsed.errors : [];
    const first = asObject(errors[0]);
    const code = firstNonEmptyString(first?.code, first?.errorCode);
    const description = firstNonEmptyString(
      first?.description,
      first?.message,
      parsed.message,
      parsed.error_description
    );
    if (description) {
      return {
        reason: code ? `${description} (${code})` : description,
        responseShapeSummary: summarizeWalmartResponseShape(parsed),
      };
    }
    return {
      reason: `Walmart catalog read failed with HTTP ${status}.`,
      responseShapeSummary: summarizeWalmartResponseShape(parsed),
    };
  } catch {
    // Fallback below when upstream payload is not JSON.
  }
  return {
    reason: `Walmart catalog read failed with HTTP ${status}.`,
    responseShapeSummary: responseBody.trim().length > 0 ? "non_json" : "empty",
  };
}

async function fetchCatalogPage(accessToken: string, nextCursor?: string | null): Promise<{
  items: Record<string, unknown>[];
  nextCursor: string | null;
  payloadShape: string;
}> {
  const url = new URL("/v3/items", `${WALMART_PRODUCTION_BASE_URL}/`);
  url.searchParams.set("limit", String(WALMART_IMPORT_PAGE_LIMIT));
  if (nextCursor) {
    url.searchParams.set("nextCursor", nextCursor);
  }

  const correlationId = crypto.randomUUID();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), WALMART_CATALOG_REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method: "GET",
      headers: buildWalmartApiHeaders(accessToken, correlationId),
      cache: "no-store",
      signal: controller.signal,
    });
  } catch {
    const error = new Error("Walmart catalog request timed out or failed.") as Error & {
      statusCode?: number;
      correlationId?: string | null;
      endpointFamily?: string;
      responseShapeSummary?: string;
    };
    error.statusCode = 504;
    error.correlationId = correlationId;
    error.endpointFamily = "walmart_catalog_items";
    error.responseShapeSummary = "network_or_timeout";
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  const responseBody = await response.text();
  if (!response.ok) {
    const parsedError = parseWalmartError(responseBody, response.status);
    const error = new Error(parsedError.reason) as Error & {
      statusCode?: number;
      correlationId?: string | null;
      endpointFamily?: string;
      responseShapeSummary?: string;
    };
    error.statusCode = response.status;
    error.correlationId =
      response.headers.get("WM_QOS.CORRELATION_ID") ??
      response.headers.get("wm_qos.correlation_id") ??
      null;
    error.endpointFamily = "walmart_catalog_items";
    error.responseShapeSummary = parsedError.responseShapeSummary;
    throw error;
  }

  let payload: unknown = {};
  if (responseBody.trim().length > 0) {
    try {
      payload = JSON.parse(responseBody) as unknown;
    } catch {
      const error = new Error("Walmart products response was not valid JSON.") as Error & {
        statusCode?: number;
        correlationId?: string | null;
        endpointFamily?: string;
        responseShapeSummary?: string;
      };
      error.statusCode = response.status;
      error.correlationId =
        response.headers.get("WM_QOS.CORRELATION_ID") ??
        response.headers.get("wm_qos.correlation_id") ??
        null;
      error.endpointFamily = "walmart_catalog_items";
      error.responseShapeSummary = "invalid_json";
      throw error;
    }
  }
  const extracted = extractItemNodes(payload);
  return {
    items: extracted.items,
    nextCursor: extractNextCursor(payload),
    payloadShape: extracted.payloadShape,
  };
}

interface ImageEnrichmentStats {
  found: number;
  notFound: number;
  ambiguous: number;
  failed: number;
  noImageReason: string | null;
  sourceBreakdown: {
    walmartItemReport: number;
    walmartSellerCatalogSearch: number;
    walmartItemSearch: number;
    publicWalmartListingSerpApi: number;
  };
  publicListing: {
    providerConnected: boolean;
    providerStatus: WalmartSerpApiProviderStatus;
    providerStatusReason: string | null;
    providerCanAttempt: boolean;
    queuedCount: number;
    completedCount: number;
    foundCount: number;
    notFoundCount: number;
    ambiguousCount: number;
    failedCount: number;
    skippedNoProviderCount: number;
    lastEnrichedAt: string | null;
    errorCategories: {
      invalidKeyCount: number;
      forbiddenCount: number;
      rateLimitedCount: number;
      badRequestCount: number;
      providerErrorCount: number;
      networkErrorCount: number;
      malformedResponseCount: number;
      unknownErrorCount: number;
    };
  };
  itemReport: {
    requested: boolean;
    downloaded: boolean;
    rowsParsed: number;
    requestId: string | null;
    requestEndpointTried: string[];
    requestEndpointUsed: string | null;
    requestStatusCode: number | null;
    statusEndpointUsed: string | null;
    downloadEndpointUsed: string | null;
    failureCategory:
      | "none"
      | "auth_or_permission"
      | "not_found_endpoint"
      | "timeout"
      | "report_failed"
      | "download_failed"
      | "parse_failed"
      | "no_rows"
      | "no_image_columns"
      | "unavailable";
  };
}

function createInitialImageEnrichmentStats(): ImageEnrichmentStats {
  return {
    found: 0,
    notFound: 0,
    ambiguous: 0,
    failed: 0,
    noImageReason: null,
    sourceBreakdown: {
      walmartItemReport: 0,
      walmartSellerCatalogSearch: 0,
      walmartItemSearch: 0,
      publicWalmartListingSerpApi: 0,
    },
    publicListing: {
      providerConnected: false,
      providerStatus: "not_connected",
      providerStatusReason: null,
      providerCanAttempt: false,
      queuedCount: 0,
      completedCount: 0,
      foundCount: 0,
      notFoundCount: 0,
      ambiguousCount: 0,
      failedCount: 0,
      skippedNoProviderCount: 0,
      lastEnrichedAt: null,
      errorCategories: {
        invalidKeyCount: 0,
        forbiddenCount: 0,
        rateLimitedCount: 0,
        badRequestCount: 0,
        providerErrorCount: 0,
        networkErrorCount: 0,
        malformedResponseCount: 0,
        unknownErrorCount: 0,
      },
    },
    itemReport: {
      requested: false,
      downloaded: false,
      rowsParsed: 0,
      requestId: null,
      requestEndpointTried: [],
      requestEndpointUsed: null,
      requestStatusCode: null,
      statusEndpointUsed: null,
      downloadEndpointUsed: null,
      failureCategory: "none",
    },
  };
}

function firstIdentifierCount(products: WalmartProductRecord[]): {
  withPublicProductId: number;
  withPublicUrl: number;
  withUpcOrGtin: number;
} {
  let withPublicProductId = 0;
  let withPublicUrl = 0;
  let withUpcOrGtin = 0;
  for (const product of products) {
    if (product.publicWalmartProductId?.trim() || product.itemId?.trim() || product.wpid?.trim()) {
      withPublicProductId += 1;
    }
    if (product.publicWalmartUrl?.trim()) {
      withPublicUrl += 1;
    }
    if (product.upc?.trim() || product.gtin?.trim()) {
      withUpcOrGtin += 1;
    }
  }
  return {
    withPublicProductId,
    withPublicUrl,
    withUpcOrGtin,
  };
}

function withImageEnrichment(
  product: WalmartProductRecord,
  enrichment: {
    imageSyncStatus: WalmartImageSyncStatus;
    statusReason?: string;
    imageSource: WalmartProductRecord["imageSource"];
    primaryImageUrl: string;
    galleryImageUrls: string[];
    variantImageUrls: string[];
    matchedItemId: string | null;
    matchMethod: WalmartImageMatchMethod | null;
    lastImageSyncedAt: string;
    diagnostics: {
      attempts: Array<{
        method: WalmartImageMatchMethod;
        httpStatus: number | null;
        resultCount: number;
        ok: boolean;
        retryCount?: number;
        transientRetries?: number;
        failureReason?: string;
      }>;
      decision?: {
        outcome: WalmartImageSyncStatus;
        reason: string;
        matchMethod: WalmartImageMatchMethod | null;
        candidateCount: number;
        selectedScore: number | null;
        runnerUpScore: number | null;
        acceptedBy: "identifier_exact" | "title_brand_strong" | "none";
      };
    };
  }
): WalmartProductRecord {
  const hasExistingImage = Boolean(product.imageUrl.trim());
  const imageIssue = imageIssueBySyncStatus(enrichment.imageSyncStatus, enrichment.imageSource);
  const baseIssues = stripImageIssues(product.issues);

  if (enrichment.imageSyncStatus === "found" && enrichment.primaryImageUrl) {
    const primaryImageUrl = hasExistingImage ? product.imageUrl : enrichment.primaryImageUrl;
    const galleryImageUrls = unique([
      primaryImageUrl,
      ...(product.galleryImageUrls ?? []),
      ...enrichment.galleryImageUrls,
    ]);
    const variantImageUrls = unique([...(product.variantImageUrls ?? []), ...enrichment.variantImageUrls]);

    return {
      ...product,
      imageUrl: primaryImageUrl,
      galleryImageUrls,
      variantImageUrls,
      imageStatus: "image_available",
      imageStatusMessage: "Image available",
      imageSource: enrichment.imageSource ?? product.imageSource ?? "walmart_item_search",
      imageSyncStatus: "found",
      imageMatchMethod: enrichment.matchMethod ?? product.imageMatchMethod,
      matchedItemId: enrichment.matchedItemId ?? product.matchedItemId,
      lastImageSyncedAt: enrichment.lastImageSyncedAt,
      issues: baseIssues,
      normalizedPayload: {
        ...(asObject(product.normalizedPayload) ?? {}),
        imageUrl: primaryImageUrl,
        galleryImageUrls,
        variantImageUrls,
        imageStatus: "image_available",
        imageStatusMessage: "Image available",
        imageSource: enrichment.imageSource ?? product.imageSource ?? "walmart_item_search",
        imageSyncStatus: "found",
        imageMatchMethod: enrichment.matchMethod ?? product.imageMatchMethod ?? null,
        matchedItemId: enrichment.matchedItemId ?? product.matchedItemId ?? null,
        lastImageSyncedAt: enrichment.lastImageSyncedAt,
        imageSyncDiagnostics: enrichment.diagnostics.attempts,
        imageSyncDecision: enrichment.diagnostics.decision ?? null,
        imageSyncReason: enrichment.statusReason ?? null,
      },
    };
  }

  // Never replace an existing valid image with empty/not_found data.
  if (hasExistingImage) {
    return {
      ...product,
      imageStatus: "image_available",
      imageStatusMessage: "Image available",
      imageSyncStatus: enrichment.imageSyncStatus,
      imageSource: product.imageSource ?? enrichment.imageSource ?? "walmart_catalog",
      imageMatchMethod: enrichment.matchMethod ?? product.imageMatchMethod,
      matchedItemId: enrichment.matchedItemId ?? product.matchedItemId,
      lastImageSyncedAt: enrichment.lastImageSyncedAt,
      issues: baseIssues,
      normalizedPayload: {
        ...(asObject(product.normalizedPayload) ?? {}),
        imageSyncStatus: enrichment.imageSyncStatus,
        imageMatchMethod: enrichment.matchMethod ?? product.imageMatchMethod ?? null,
        matchedItemId: enrichment.matchedItemId ?? product.matchedItemId ?? null,
        lastImageSyncedAt: enrichment.lastImageSyncedAt,
        imageSyncDiagnostics: enrichment.diagnostics.attempts,
        imageSyncDecision: enrichment.diagnostics.decision ?? null,
        imageSyncReason: enrichment.statusReason ?? null,
      },
    };
  }

  const imageIssues = imageIssue ? [imageIssue] : [];
  const imageStatus =
    enrichment.imageSyncStatus === "not_synced" ? "enrichment_unconfigured" : "catalog_missing";
  const imageStatusMessage = imageStatusMessageBySyncStatus(enrichment.imageSyncStatus, enrichment.statusReason);
  const nextIssues = unique([...baseIssues, ...imageIssues]);

  return {
    ...product,
    imageUrl: "",
    galleryImageUrls: [],
    variantImageUrls: [],
    imageStatus,
    imageStatusMessage,
    imageSource: enrichment.imageSource ?? "walmart_item_search",
    imageSyncStatus: enrichment.imageSyncStatus,
    imageMatchMethod: enrichment.matchMethod ?? undefined,
    matchedItemId: enrichment.matchedItemId ?? undefined,
    lastImageSyncedAt: enrichment.lastImageSyncedAt,
    issues: nextIssues,
    normalizedPayload: {
      ...(asObject(product.normalizedPayload) ?? {}),
      imageUrl: "",
      galleryImageUrls: [],
      variantImageUrls: [],
      imageStatus,
      imageStatusMessage,
      imageSource: enrichment.imageSource ?? "walmart_item_search",
      imageSyncStatus: enrichment.imageSyncStatus,
      imageMatchMethod: enrichment.matchMethod ?? null,
      matchedItemId: enrichment.matchedItemId ?? null,
      lastImageSyncedAt: enrichment.lastImageSyncedAt,
      imageSyncDiagnostics: enrichment.diagnostics.attempts,
      imageSyncDecision: enrichment.diagnostics.decision ?? null,
      imageSyncReason: enrichment.statusReason ?? null,
    },
  };
}

async function enrichProductImages(
  accessToken: string,
  userId: string,
  products: WalmartProductRecord[],
  options?: {
    skipOfficialSources?: boolean;
  }
): Promise<{ products: WalmartProductRecord[]; stats: ImageEnrichmentStats }> {
  const enriched = [...products];
  const stats = createInitialImageEnrichmentStats();
  const skipOfficialSources = Boolean(options?.skipOfficialSources);

  if (!skipOfficialSources) {
    const reportEnrichment = await enrichProductsFromItemReport({
      accessToken,
      products: enriched,
    });

    stats.itemReport.requested = reportEnrichment.run.itemReportRequested;
    stats.itemReport.downloaded = reportEnrichment.run.itemReportDownloaded;
    stats.itemReport.rowsParsed = reportEnrichment.run.itemReportRowsParsed;
    stats.itemReport.requestId = reportEnrichment.run.reportRequestId;
    stats.itemReport.requestEndpointTried = [...reportEnrichment.run.diagnostics.requestEndpointTried];
    stats.itemReport.requestEndpointUsed = reportEnrichment.run.diagnostics.requestEndpointUsed;
    stats.itemReport.requestStatusCode = reportEnrichment.run.diagnostics.requestStatusCode;
    stats.itemReport.statusEndpointUsed = reportEnrichment.run.diagnostics.statusEndpointUsed;
    stats.itemReport.downloadEndpointUsed = reportEnrichment.run.diagnostics.downloadEndpointUsed;
    stats.itemReport.failureCategory = reportEnrichment.run.failureCategory;

    const shouldFallbackToItemSearch = new Set<string>();

    for (const [skuKey, decision] of reportEnrichment.decisionsBySku.entries()) {
      const targetIndex = enriched.findIndex((entry) => entry.sku.toUpperCase() === skuKey);
      if (targetIndex < 0) continue;

      const hasImageAfterDecision = Boolean(decision.primaryImageUrl);

      enriched[targetIndex] = withImageEnrichment(enriched[targetIndex], {
        imageSyncStatus: decision.imageSyncStatus,
        statusReason: decision.statusReason,
        imageSource: decision.imageSource,
        primaryImageUrl: decision.primaryImageUrl,
        galleryImageUrls: [...decision.galleryImageUrls],
        variantImageUrls: [...decision.variantImageUrls],
        matchedItemId: decision.matchedItemId,
        matchMethod: decision.matchMethod,
        lastImageSyncedAt: decision.lastImageSyncedAt,
        diagnostics: {
          attempts: reportEnrichment.run.diagnostics.requestAttempts.slice(0, 1).map((entry) => ({
            method: decision.matchMethod ?? "item_report_sku",
            httpStatus: entry.httpStatus,
            resultCount: reportEnrichment.run.itemReportRowsParsed,
            ok: entry.ok,
          })),
          decision: {
            outcome: decision.imageSyncStatus,
            reason: decision.statusReason,
            matchMethod: decision.matchMethod,
            candidateCount: reportEnrichment.run.itemReportRowsParsed,
            selectedScore: null,
            runnerUpScore: null,
            acceptedBy: "identifier_exact",
          },
        },
      });

      if (!hasImageAfterDecision && decision.allowItemSearchFallback) {
        shouldFallbackToItemSearch.add(skuKey);
      }
    }

    for (let index = 0; index < enriched.length; index += WALMART_IMAGE_ENRICHMENT_CONCURRENCY) {
      const batch = enriched
        .slice(index, index + WALMART_IMAGE_ENRICHMENT_CONCURRENCY)
        .filter(
          (product) => shouldFallbackToItemSearch.has(product.sku.toUpperCase()) && !product.imageUrl.trim()
        );

      if (batch.length === 0) continue;

      const fallbackResults = await Promise.all(
        batch.map(async (product) => {
          try {
            const enrichment = await enrichWalmartImageFromItemSearch({
              accessToken,
              product: {
                gtin: product.gtin,
                upc: product.upc,
                itemId: product.itemId,
                wpid: product.wpid,
                title: product.title,
                brand: product.brand,
              },
            });
            return { product, enrichment } as const;
          } catch {
            return {
              product,
              enrichment: {
                imageSyncStatus: "failed" as const,
                imageSource: "walmart_item_search" as const,
                statusReason: "Item Search request failed after retry.",
                primaryImageUrl: "",
                galleryImageUrls: [],
                variantImageUrls: [],
                matchedItemId: null,
                matchMethod: null,
                lastImageSyncedAt: new Date().toISOString(),
                diagnostics: {
                  attempts: [],
                  decision: {
                    outcome: "failed" as const,
                    reason: "Item Search request failed after retry.",
                    matchMethod: null,
                    candidateCount: 0,
                    selectedScore: null,
                    runnerUpScore: null,
                    acceptedBy: "none" as const,
                  },
                },
              },
            } as const;
          }
        })
      );

      for (const { product, enrichment } of fallbackResults) {
        const key = product.sku.toUpperCase();
        const targetIndex = enriched.findIndex((entry) => entry.sku.toUpperCase() === key);
        if (targetIndex < 0) continue;

        enriched[targetIndex] = withImageEnrichment(enriched[targetIndex], {
          imageSyncStatus: enrichment.imageSyncStatus,
          statusReason: enrichment.statusReason,
          imageSource: "walmart_item_search",
          primaryImageUrl: enrichment.primaryImageUrl,
          galleryImageUrls: [...enrichment.galleryImageUrls],
          variantImageUrls: [...enrichment.variantImageUrls],
          matchedItemId: enrichment.matchedItemId,
          matchMethod: enrichment.matchMethod,
          lastImageSyncedAt: enrichment.lastImageSyncedAt,
          diagnostics: {
            attempts: [...enrichment.diagnostics.attempts],
            decision: enrichment.diagnostics.decision,
          },
        });
      }
    }
  }

  const publicListingQueue = await runPublicListingImageEnrichmentQueue({
    userId,
    products: enriched,
    importedCount: products.length,
  });

  const finalized = publicListingQueue.products;
  stats.publicListing = {
    providerConnected: publicListingQueue.progress.providerConnected,
    providerStatus: publicListingQueue.progress.providerStatus,
    providerStatusReason: publicListingQueue.progress.providerStatusReason,
    providerCanAttempt: publicListingQueue.progress.providerCanAttempt,
    queuedCount: publicListingQueue.progress.enrichmentQueuedCount,
    completedCount: publicListingQueue.progress.enrichmentCompletedCount,
    foundCount: publicListingQueue.progress.foundCount,
    notFoundCount: publicListingQueue.progress.notFoundCount,
    ambiguousCount: publicListingQueue.progress.ambiguousCount,
    failedCount: publicListingQueue.progress.failedCount,
    skippedNoProviderCount: publicListingQueue.progress.skippedNoProviderCount,
    lastEnrichedAt: publicListingQueue.progress.lastEnrichedAt,
    errorCategories: {
      ...publicListingQueue.progress.errorCategories,
    },
  };

  stats.sourceBreakdown = {
    walmartItemReport: 0,
    walmartSellerCatalogSearch: 0,
    walmartItemSearch: 0,
    publicWalmartListingSerpApi: 0,
  };

  for (const product of finalized) {
    const source = product.imageSource ?? "none";
    if (source === "walmart_item_report" && product.imageSyncStatus === "found" && product.imageUrl.trim()) {
      stats.sourceBreakdown.walmartItemReport += 1;
    } else if (source === "walmart_item_search" && product.imageSyncStatus === "found" && product.imageUrl.trim()) {
      stats.sourceBreakdown.walmartItemSearch += 1;
    } else if (source === "walmart_catalog" && product.imageSyncStatus === "found" && product.imageUrl.trim()) {
      stats.sourceBreakdown.walmartSellerCatalogSearch += 1;
    } else if (
      source === "public_walmart_listing_serpapi" &&
      product.imageSyncStatus === "found" &&
      product.imageUrl.trim()
    ) {
      stats.sourceBreakdown.publicWalmartListingSerpApi += 1;
    }

    if (product.imageSyncStatus === "found") stats.found += 1;
    else if (product.imageSyncStatus === "not_found") stats.notFound += 1;
    else if (product.imageSyncStatus === "ambiguous") stats.ambiguous += 1;
    else if (product.imageSyncStatus === "failed") stats.failed += 1;
  }

  if (stats.found === 0) {
    const identifierCoverage = firstIdentifierCount(enriched.filter((product) => !product.imageUrl.trim()));
    const providerStatus = publicListingQueue.progress.providerStatus;
    const providerStatusReason = publicListingQueue.progress.providerStatusReason;
    const providerErrorCount =
      publicListingQueue.progress.errorCategories.invalidKeyCount +
      publicListingQueue.progress.errorCategories.forbiddenCount +
      publicListingQueue.progress.errorCategories.rateLimitedCount +
      publicListingQueue.progress.errorCategories.badRequestCount +
      publicListingQueue.progress.errorCategories.providerErrorCount +
      publicListingQueue.progress.errorCategories.networkErrorCount +
      publicListingQueue.progress.errorCategories.malformedResponseCount +
      publicListingQueue.progress.errorCategories.unknownErrorCount;

    if (providerStatus === "not_connected") {
      stats.noImageReason = "Connect SerpApi to enable automated public Walmart image enrichment.";
    } else if (providerErrorCount > 0 && providerStatusReason) {
      stats.noImageReason = providerStatusReason;
    } else if (
      identifierCoverage.withPublicProductId === 0 &&
      identifierCoverage.withPublicUrl === 0 &&
      identifierCoverage.withUpcOrGtin === 0
    ) {
      stats.noImageReason =
        "No public product IDs or UPC/GTIN matches were available for safe image matching.";
    } else if (
      publicListingQueue.progress.enrichmentCompletedCount > 0 &&
      publicListingQueue.progress.foundCount === 0
    ) {
      stats.noImageReason = "Provider returned no image-bearing matches.";
    }
  }

  return { products: finalized, stats };
}

function categorizeWalmartTokenFailure(code: string | null | undefined): WalmartImportErrorCategory {
  const normalized = (code ?? "").trim().toUpperCase();
  if (!normalized || normalized === "MISSING_CREDENTIALS") return "walmart_credentials_missing";
  if (normalized.includes("HTTP_401") || normalized.includes("HTTP_403")) return "walmart_auth_failed";
  return "walmart_token_failed";
}

export async function importWalmartProducts(
  userId: string,
  options?: WalmartImportOptions
): Promise<WalmartImportResult> {
  const partialProgress: WalmartImportPartialProgress = {
    importedCount: 0,
    fetchedCount: 0,
    processedCount: 0,
    queuedCount: 0,
    imageFoundCount: 0,
    imageMissingCount: 0,
    imageNotFoundCount: 0,
    imageAmbiguousCount: 0,
    imageFailedCount: 0,
    imageSkippedNoProviderCount: 0,
  };

  let token: Awaited<ReturnType<typeof requestWalmartTokenForUser>>;
  try {
    token = await requestWalmartTokenForUser(userId, { forceRefresh: true });
  } catch (error) {
    const reason = normalizeUnknownErrorMessage(
      error,
      "Unable to resolve Walmart credentials for this user."
    );
    throw createWalmartImportFailure({
      category: isLikelyDatabaseError(error) ? "database_failed" : "walmart_credentials_missing",
      phase: isLikelyDatabaseError(error) ? "database" : "walmart_credentials",
      reason,
      partialProgress,
    });
  }

  if (!token.ok || !token.accessToken) {
    throw createWalmartImportFailure({
      category: categorizeWalmartTokenFailure(token.lastError?.code),
      phase:
        categorizeWalmartTokenFailure(token.lastError?.code) === "walmart_auth_failed"
          ? "walmart_auth"
          : "walmart_token",
      reason:
        token.lastError?.message ??
        "Walmart is not connected. Save credentials in Walmart Connect before importing products.",
      statusCode: token.httpStatus ?? undefined,
      correlationId: token.correlationId,
      endpointFamily: "walmart_token",
      partialProgress,
    });
  }

  try {
    const now = new Date().toISOString();
    const collected: Record<string, unknown>[] = [];
    const payloadShapes = new Set<string>();
    let pageCount = 0;
    let nextCursor: string | null = null;
    const catalogPageCap = options?.boundedRuntime
      ? Math.max(1, Math.min(WALMART_IMPORT_MAX_PAGES, options.maxCatalogPages ?? WALMART_IMPORT_MAX_PAGES_BOUNDED))
      : WALMART_IMPORT_MAX_PAGES;

    for (let pageIndex = 0; pageIndex < catalogPageCap; pageIndex += 1) {
      let page: Awaited<ReturnType<typeof fetchCatalogPage>>;
      try {
        page = await fetchCatalogPage(token.accessToken, nextCursor);
      } catch (error) {
        const statusCode =
          error && typeof error === "object" && typeof (error as { statusCode?: unknown }).statusCode === "number"
            ? ((error as { statusCode: number }).statusCode as number)
            : undefined;
        const responseShapeSummary =
          error && typeof error === "object" && typeof (error as { responseShapeSummary?: unknown }).responseShapeSummary === "string"
            ? ((error as { responseShapeSummary: string }).responseShapeSummary as string)
            : undefined;
        const isResponseParseFailure = normalizeUnknownErrorMessage(error, "")
          .toLowerCase()
          .includes("not valid json");
        throw createWalmartImportFailure({
          category: isResponseParseFailure
            ? "walmart_products_response_invalid"
            : "walmart_products_fetch_failed",
          phase: isResponseParseFailure ? "walmart_products_parse" : "walmart_products_fetch",
          reason: normalizeUnknownErrorMessage(
            error,
            "Walmart catalog products request failed."
          ),
          statusCode,
          correlationId:
            error && typeof error === "object" && "correlationId" in error
              ? ((error as { correlationId?: string | null }).correlationId ?? null)
              : null,
          endpointFamily:
            error && typeof error === "object" && "endpointFamily" in error
              ? ((error as { endpointFamily?: string }).endpointFamily ?? "walmart_catalog_items")
              : "walmart_catalog_items",
          responseShapeSummary,
          partialProgress,
        });
      }

      collected.push(...page.items);
      payloadShapes.add(page.payloadShape);
      pageCount += 1;
      partialProgress.fetchedCount = collected.length;

      if (!page.nextCursor || page.nextCursor === nextCursor || page.items.length === 0) {
        break;
      }
      nextCursor = page.nextCursor;
    }

    const inventoryLookupCap = options?.boundedRuntime
      ? Math.max(0, options.maxInventoryLookups ?? WALMART_IMPORT_MAX_INVENTORY_LOOKUPS_BOUNDED)
      : Math.max(1, options?.maxInventoryLookups ?? WALMART_IMPORT_MAX_INVENTORY_LOOKUPS);
    const inventoryTimeoutMs = options?.boundedRuntime
      ? WALMART_INVENTORY_REQUEST_TIMEOUT_MS_BOUNDED
      : WALMART_INVENTORY_REQUEST_TIMEOUT_MS;
    const inventorySnapshotsBySku = await fetchInventorySnapshotsForItems(token.accessToken, collected, {
      maxLookups: inventoryLookupCap,
      timeoutMs: inventoryTimeoutMs,
    });

    const bySku = new Map<string, WalmartProductRecord>();
    let skippedCount = 0;
    for (const item of collected) {
      let normalized: WalmartProductRecord | null;
      try {
        normalized = normalizeImportedItem(item, inventorySnapshotsBySku);
      } catch (error) {
        const rawSku = asString((asObject(item)?.sku ?? asObject(item)?.SKU) ?? "");
        throw createWalmartImportFailure({
          category: "product_normalization_failed",
          phase: "product_normalization",
          reason: rawSku
            ? `Product normalization failed for SKU ${rawSku}.`
            : "Product normalization failed for one catalog row.",
          partialProgress,
          responseShapeSummary: normalizeUnknownErrorMessage(error, "unknown_normalization_error"),
        });
      }
      if (!normalized) {
        skippedCount += 1;
        continue;
      }
      bySku.set(normalized.sku.toUpperCase(), normalized);
    }

    const baseProducts = Array.from(bySku.values());
    partialProgress.importedCount = baseProducts.length;
    const enrichmentCap = options?.boundedRuntime
      ? Math.max(
          0,
          options.maxImageEnrichmentProducts ?? WALMART_IMPORT_MAX_IMAGE_ENRICHMENT_PRODUCTS_BOUNDED
        )
      : Math.max(1, options?.maxImageEnrichmentProducts ?? WALMART_IMPORT_MAX_IMAGE_ENRICHMENT_PRODUCTS);
    const productsForImageEnrichment = baseProducts.slice(0, enrichmentCap);
    const deferredProducts = baseProducts.slice(productsForImageEnrichment.length);
    let enrichedProducts = productsForImageEnrichment;
    let imageStats = createInitialImageEnrichmentStats();
    if (productsForImageEnrichment.length > 0) {
      const enriched = await enrichProductImages(token.accessToken, userId, productsForImageEnrichment, {
        skipOfficialSources: Boolean(options?.boundedRuntime),
      });
      enrichedProducts = enriched.products;
      imageStats = enriched.stats;
    }
    const deferredReason =
      deferredProducts.length > 0
        ? "Image enrichment deferred during import to keep this request responsive. Use Retry image enrichment to continue."
        : null;
    const deferredEnrichmentProducts =
      deferredProducts.length > 0
        ? deferredProducts.map((product) =>
            withImageEnrichment(product, {
              imageSyncStatus: product.imageUrl.trim() ? "found" : "not_synced",
              statusReason: deferredReason ?? undefined,
              imageSource: product.imageSource ?? "public_walmart_listing_serpapi",
              primaryImageUrl: product.imageUrl,
              galleryImageUrls: [...(product.galleryImageUrls ?? [])],
              variantImageUrls: [...(product.variantImageUrls ?? [])],
              matchedItemId: product.matchedItemId ?? null,
              matchMethod: product.imageMatchMethod ?? null,
              lastImageSyncedAt: new Date().toISOString(),
              diagnostics: {
                attempts: [],
                decision: {
                  outcome: product.imageUrl.trim() ? "found" : "not_synced",
                  reason:
                    deferredReason ??
                    (product.imageUrl.trim()
                      ? "Image available"
                      : "Image enrichment deferred during import."),
                  matchMethod: product.imageMatchMethod ?? null,
                  candidateCount: 0,
                  selectedScore: null,
                  runnerUpScore: null,
                  acceptedBy: "none",
                },
              },
            })
          )
        : [];
    const products = [...enrichedProducts, ...deferredEnrichmentProducts];
    const inventoryKnownCount = products.filter((product) => product.inventoryStatus === "known").length;
    const inventoryOutOfStockCount = products.filter(
      (product) => product.inventoryStatus === "out_of_stock"
    ).length;
    const inventoryUnknownCount = products.filter((product) => product.inventoryStatus === "unknown").length;
    partialProgress.importedCount = products.length;
    partialProgress.queuedCount = imageStats.publicListing.queuedCount;
    partialProgress.processedCount = imageStats.publicListing.completedCount;
    partialProgress.imageFoundCount = imageStats.found;
    partialProgress.imageNotFoundCount = imageStats.notFound;
    partialProgress.imageAmbiguousCount = imageStats.ambiguous;
    partialProgress.imageFailedCount = imageStats.failed;
    partialProgress.imageSkippedNoProviderCount = imageStats.publicListing.skippedNoProviderCount;
    partialProgress.imageMissingCount =
      imageStats.notFound + imageStats.publicListing.skippedNoProviderCount;

    try {
      await replaceWalmartProductsForUser({
        userId,
        products,
        importedAt: now,
      });
    } catch (error) {
      throw createWalmartImportFailure({
        category: isLikelyDatabaseError(error) ? "database_failed" : "product_persistence_failed",
        phase: isLikelyDatabaseError(error) ? "database" : "product_persistence",
        reason: normalizeUnknownErrorMessage(
          error,
          "Failed to persist imported Walmart products."
        ),
        partialProgress,
      });
    }

    appendActivityLog({
      marketplace: "walmart",
      actionType: "product_import",
      result: products.length > 0 ? "success" : "warning",
      message:
        products.length > 0
          ? `Imported ${products.length} Walmart product(s).`
          : "Walmart import completed with no product rows returned.",
    });

    return {
      importedCount: products.length,
      fetchedCount: collected.length,
      skippedCount,
      lastImportAt: now,
      mode: getWalmartRuntimeMode(),
      importDiagnostics: {
        fetchedCount: collected.length,
        payloadShape: payloadShapes.size > 0 ? Array.from(payloadShapes).join(", ") : "unknown",
        pageCount,
        inventoryKnownCount,
        inventoryUnknownCount,
        inventoryOutOfStockCount,
        imageFoundCount: imageStats.found,
        imageNotFoundCount: imageStats.notFound,
        imageAmbiguousCount: imageStats.ambiguous,
        imageFailedCount: imageStats.failed,
        imageSkippedNoProviderCount: imageStats.publicListing.skippedNoProviderCount,
        enrichmentQueuedCount: imageStats.publicListing.queuedCount,
        enrichmentCompletedCount: imageStats.publicListing.completedCount,
        enrichmentProviderConnected: imageStats.publicListing.providerConnected,
        serpApiStatus: imageStats.publicListing.providerStatus,
        serpApiStatusReason: imageStats.publicListing.providerStatusReason,
        serpApiCanAttempt: imageStats.publicListing.providerCanAttempt,
        enrichmentErrorCategories: {
          ...imageStats.publicListing.errorCategories,
        },
        enrichmentProcessedCount: imageStats.publicListing.completedCount,
        imageEnrichmentNoImageReason: deferredReason
          ? imageStats.noImageReason
            ? `${imageStats.noImageReason} ${deferredReason}`
            : deferredReason
          : imageStats.noImageReason,
        lastEnrichedAt: imageStats.publicListing.lastEnrichedAt,
        inventoryLookupSkippedCount: Math.max(0, bySku.size - Math.min(bySku.size, inventoryLookupCap)),
        imageEnrichmentDeferredCount: deferredProducts.length,
        imageEnrichmentImportLimit: options?.boundedRuntime ? enrichmentCap : null,
        imageEnrichmentBounded: Boolean(options?.boundedRuntime),
        imageSource: "Walmart Item Report + Walmart Item Search + Public Walmart Listing via SerpApi",
        itemReportRequested: imageStats.itemReport.requested,
        itemReportDownloaded: imageStats.itemReport.downloaded,
        itemReportRowsParsed: imageStats.itemReport.rowsParsed,
        itemReportRequestId: imageStats.itemReport.requestId,
        itemReportRequestEndpointTried: imageStats.itemReport.requestEndpointTried,
        itemReportRequestEndpointUsed: imageStats.itemReport.requestEndpointUsed,
        itemReportRequestStatusCode: imageStats.itemReport.requestStatusCode,
        itemReportStatusEndpointUsed: imageStats.itemReport.statusEndpointUsed,
        itemReportDownloadEndpointUsed: imageStats.itemReport.downloadEndpointUsed,
        itemReportFailureCategory: imageStats.itemReport.failureCategory,
        imageSourceBreakdown: {
          walmartItemReport: imageStats.sourceBreakdown.walmartItemReport,
          walmartSellerCatalogSearch: imageStats.sourceBreakdown.walmartSellerCatalogSearch,
          walmartItemSearch: imageStats.sourceBreakdown.walmartItemSearch,
          publicWalmartListingSerpApi: imageStats.sourceBreakdown.publicWalmartListingSerpApi,
        },
        importErrorCategory: "none",
        importErrorReason: null,
      },
    };
  } catch (error) {
    if (isWalmartImportFailureError(error)) {
      error.partialProgress = {
        ...partialProgress,
      };
      throw error;
    }

    throw createWalmartImportFailure({
      category: "import_unknown_error",
      phase: "import_unknown",
      reason: normalizeUnknownErrorMessage(error, "Walmart import failed due to an unknown runtime error."),
      partialProgress,
    });
  }
}

export async function retryWalmartPublicImageEnrichmentForUser(
  userId: string
): Promise<WalmartImportResult> {
  const currentProducts = await listPersistedWalmartProducts(userId);
  const queue = await runPublicListingImageEnrichmentQueue({
    userId,
    products: currentProducts,
    importedCount: currentProducts.length,
  });

  const importedAt = await getPersistedWalmartLastImportAt(userId);
  await replaceWalmartProductsForUser({
    userId,
    products: queue.products,
    importedAt,
  });

  return {
    importedCount: queue.products.length,
    fetchedCount: queue.products.length,
    skippedCount: 0,
    lastImportAt: importedAt,
    mode: getWalmartRuntimeMode(),
    importDiagnostics: {
      fetchedCount: queue.products.length,
      payloadShape: "retry_enrichment_only",
      pageCount: 0,
      imageFoundCount: queue.progress.foundCount,
      imageNotFoundCount: queue.progress.notFoundCount,
      imageAmbiguousCount: queue.progress.ambiguousCount,
      imageFailedCount: queue.progress.failedCount,
      imageSkippedNoProviderCount: queue.progress.skippedNoProviderCount,
      enrichmentQueuedCount: queue.progress.enrichmentQueuedCount,
      enrichmentCompletedCount: queue.progress.enrichmentCompletedCount,
      enrichmentProviderConnected: queue.progress.providerConnected,
      serpApiStatus: queue.progress.providerStatus,
      serpApiStatusReason: queue.progress.providerStatusReason,
      serpApiCanAttempt: queue.progress.providerCanAttempt,
      enrichmentErrorCategories: {
        ...queue.progress.errorCategories,
      },
      enrichmentProcessedCount: queue.progress.enrichmentCompletedCount,
      imageEnrichmentNoImageReason:
        queue.progress.foundCount > 0
          ? null
          : queue.progress.providerStatus === "not_connected"
          ? "Connect SerpApi to enable automated public Walmart image enrichment."
          : queue.progress.providerStatusReason ?? "Provider returned no image-bearing matches.",
      lastEnrichedAt: queue.progress.lastEnrichedAt,
      imageEnrichmentImportLimit: null,
      imageEnrichmentBounded: false,
      imageSource: "Walmart Item Report + Walmart Item Search + Public Walmart Listing via SerpApi",
      imageSourceBreakdown: {
        walmartItemReport: queue.products.filter(
          (product) => product.imageSource === "walmart_item_report" && product.imageSyncStatus === "found"
        ).length,
        walmartSellerCatalogSearch: queue.products.filter(
          (product) => product.imageSource === "walmart_catalog" && product.imageSyncStatus === "found"
        ).length,
        walmartItemSearch: queue.products.filter(
          (product) => product.imageSource === "walmart_item_search" && product.imageSyncStatus === "found"
        ).length,
        publicWalmartListingSerpApi: queue.products.filter(
          (product) =>
            product.imageSource === "public_walmart_listing_serpapi" &&
            product.imageSyncStatus === "found"
        ).length,
      },
      importErrorCategory: "none",
      importErrorReason: null,
    },
  };
}

function buildDashboardSnapshotFromProducts(params: {
  products: WalmartProductRecord[];
  lastImportAt: string | null;
  draftChanges: number;
}): Omit<WalmartDashboardSnapshot, "connection" | "mode"> {
  const feeds = listFeeds();
  const products = params.products;
  const attentionProducts = products.filter((product) => product.issues.length > 0 || product.status !== "active");
  const feedErrors = feeds.reduce((sum, feed) => sum + feed.errorReport.length, 0);

  return {
    productsImported: products.length,
    lastImportAt: params.lastImportAt,
    draftChanges: params.draftChanges,
    feedErrors,
    listingsNeedingAttention: {
      count: attentionProducts.length,
      categories: Array.from(new Set(attentionProducts.flatMap((product) => product.issues))).slice(0, 5),
    },
    recentProducts: products.slice(0, 5),
    attentionProducts: attentionProducts.slice(0, 5),
    recentActivity: listActivityLogs({ marketplace: "walmart", limit: 8 }).map((entry) => ({
      time: entry.createdAt,
      action: entry.actionType,
      result: entry.result,
      sku: entry.sku,
      message: entry.message,
    })),
  };
}

export async function getWalmartDashboardSnapshotForUser(userId: string): Promise<WalmartDashboardSnapshot> {
  const products = await listPersistedWalmartProducts(userId);
  const lastImportAt = await getPersistedWalmartLastImportAt(userId);
  const drafts = await listWalmartDraftsForUser(userId);
  const counts = buildDashboardSnapshotFromProducts({
    products,
    lastImportAt,
    draftChanges: drafts.length,
  });
  const connection = getWalmartConnectionHealth();

  return {
    mode: getWalmartRuntimeMode(),
    connection,
    productsImported: counts.productsImported,
    lastImportAt: counts.lastImportAt,
    draftChanges: counts.draftChanges,
    feedErrors: counts.feedErrors,
    listingsNeedingAttention: counts.listingsNeedingAttention,
    recentProducts: counts.recentProducts,
    recentActivity: counts.recentActivity,
    attentionProducts: counts.attentionProducts,
  };
}

export function getWalmartDashboardSnapshot(): WalmartDashboardSnapshot {
  const products = listProducts();
  const drafts = listDrafts();
  const counts = buildDashboardSnapshotFromProducts({
    products,
    lastImportAt: getLastImportAt(),
    draftChanges: drafts.filter((draft) => draft.status !== "discarded").length,
  });
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

export async function getEcomViperMarketplaceMetricsForUser(userId: string) {
  const products = await listPersistedWalmartProducts(userId);
  const drafts = await listWalmartDraftsForUser(userId);
  const attention = products.filter((item) => item.issues.length > 0 || item.status !== "active");

  return {
    connectedMarketplaces: getWalmartConnectionHealth().connectionStatus === "connected" ? 1 : 0,
    productsImported: products.length,
    draftChanges: drafts.length,
    syncErrors: attention.filter((item) => item.status === "sync_failed").length,
    listingsNeedingAttention: attention.length,
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
