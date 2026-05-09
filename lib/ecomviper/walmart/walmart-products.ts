import "server-only";

import crypto from "crypto";
import { normalizeWalmartProduct } from "@/lib/ecomviper/core/product-normalizer";
import { appendActivityLog } from "@/lib/ecomviper/core/activity-log";
import { getWalmartConnectionHealth, requestWalmartTokenForUser } from "@/lib/ecomviper/walmart/walmart-auth";
import { WALMART_PRODUCTION_BASE_URL } from "@/lib/ecomviper/walmart/walmart-client";
import { resolveWalmartCatalogImage } from "@/lib/ecomviper/walmart/walmart-image-providers";
import {
  getDashboardCounts,
  getLastImportAt,
  getProductBySku,
  getWalmartRuntimeMode,
  listDrafts,
  listProducts,
  replaceProducts,
} from "@/lib/ecomviper/walmart/walmart-store";
import type {
  WalmartDashboardSnapshot,
  WalmartImportResult,
  WalmartInventoryStatus,
  WalmartProductRecord,
} from "@/lib/ecomviper/walmart/walmart-types";

const WALMART_IMPORT_PAGE_LIMIT = 100;
const WALMART_IMPORT_MAX_PAGES = 5;

export function listWalmartProducts(): WalmartProductRecord[] {
  return listProducts();
}

export function getWalmartProductBySku(sku: string): WalmartProductRecord | null {
  return getProductBySku(sku);
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
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

async function fetchInventorySnapshotForSku(accessToken: string, sku: string): Promise<InventorySnapshot> {
  const url = new URL("/v3/inventory", `${WALMART_PRODUCTION_BASE_URL}/`);
  url.searchParams.set("sku", sku);

  const correlationId = crypto.randomUUID();
  const response = await fetch(url.toString(), {
    method: "GET",
    headers: buildWalmartApiHeaders(accessToken, correlationId),
    cache: "no-store",
  });

  if (!response.ok) {
    return {
      status: "unknown",
      quantity: 0,
      source: `inventory_api_http_${response.status}`,
    };
  }

  const text = await response.text();
  const payload = text ? (JSON.parse(text) as unknown) : {};
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
  items: Record<string, unknown>[]
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
  const skus = Array.from(bySku.entries());
  const concurrency = 8;

  for (let index = 0; index < skus.length; index += concurrency) {
    const batch = skus.slice(index, index + concurrency);
    const results = await Promise.all(
      batch.map(async ([key, sku]) => {
        try {
          const snapshot = await fetchInventorySnapshotForSku(accessToken, sku);
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
    price,
    inventoryQuantity: inventorySnapshot.quantity,
    inventoryStatus: inventorySnapshot.status,
    imageUrl: imageResolution.imageUrl,
    imageStatus: imageResolution.imageStatus,
    imageStatusMessage: imageResolution.imageStatusMessage,
    imageSource: imageResolution.imageSource,
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
    item.id
  );

  return {
    ...normalized,
    externalItemId: externalItemId || normalized.externalItemId,
    category: category || normalized.category,
    rawPayload: item,
    normalizedPayload: {
      sku: normalized.sku,
      externalItemId: externalItemId || normalized.externalItemId,
      title: normalized.title,
      brand: normalized.brand,
      category: category || normalized.category,
      price: normalized.price,
      inventoryQuantity: normalized.inventoryQuantity,
      inventoryStatus: normalized.inventoryStatus,
      inventorySource: inventorySnapshot.source,
      imageUrl: normalized.imageUrl,
      imageStatus: normalized.imageStatus,
      imageStatusMessage: normalized.imageStatusMessage,
      imageSource: normalized.imageSource,
      imageProvider: imageResolution.enrichmentProvider,
      attributes: normalized.attributes,
      shortDescription: normalized.shortDescription,
      longDescription: normalized.longDescription,
      bulletPoints: normalized.bulletPoints,
    },
  };
}

function parseWalmartError(responseBody: string, status: number): string {
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
      return code ? `${description} (${code})` : description;
    }
  } catch {
    // Fallback below when upstream payload is not JSON.
  }
  return `Walmart catalog read failed with HTTP ${status}.`;
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
  const response = await fetch(url.toString(), {
    method: "GET",
    headers: buildWalmartApiHeaders(accessToken, correlationId),
    cache: "no-store",
  });

  const responseBody = await response.text();
  if (!response.ok) {
    throw new Error(parseWalmartError(responseBody, response.status));
  }

  const payload = responseBody ? (JSON.parse(responseBody) as unknown) : {};
  const extracted = extractItemNodes(payload);
  return {
    items: extracted.items,
    nextCursor: extractNextCursor(payload),
    payloadShape: extracted.payloadShape,
  };
}

export async function importWalmartProducts(userId: string): Promise<WalmartImportResult> {
  const token = await requestWalmartTokenForUser(userId, { forceRefresh: true });
  if (!token.ok || !token.accessToken) {
    throw new Error(
      token.lastError?.message ??
        "Walmart is not connected. Save credentials in Walmart Connect before importing products."
    );
  }

  const now = new Date().toISOString();
  const collected: Record<string, unknown>[] = [];
  const payloadShapes = new Set<string>();
  let pageCount = 0;
  let nextCursor: string | null = null;

  for (let pageIndex = 0; pageIndex < WALMART_IMPORT_MAX_PAGES; pageIndex += 1) {
    const page = await fetchCatalogPage(token.accessToken, nextCursor);
    collected.push(...page.items);
    payloadShapes.add(page.payloadShape);
    pageCount += 1;

    if (!page.nextCursor || page.nextCursor === nextCursor || page.items.length === 0) {
      break;
    }
    nextCursor = page.nextCursor;
  }

  const inventorySnapshotsBySku = await fetchInventorySnapshotsForItems(token.accessToken, collected);

  const bySku = new Map<string, WalmartProductRecord>();
  let skippedCount = 0;
  for (const item of collected) {
    const normalized = normalizeImportedItem(item, inventorySnapshotsBySku);
    if (!normalized) {
      skippedCount += 1;
      continue;
    }
    bySku.set(normalized.sku.toUpperCase(), normalized);
  }

  const products = Array.from(bySku.values());
  const inventoryKnownCount = products.filter((product) => product.inventoryStatus === "known").length;
  const inventoryOutOfStockCount = products.filter((product) => product.inventoryStatus === "out_of_stock").length;
  const inventoryUnknownCount = products.filter((product) => product.inventoryStatus === "unknown").length;
  replaceProducts(products, now);

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
    },
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
