import "server-only";

import crypto from "crypto";
import { normalizeWalmartProduct } from "@/lib/ecomviper/core/product-normalizer";
import { appendActivityLog } from "@/lib/ecomviper/core/activity-log";
import { getWalmartConnectionHealth, requestWalmartTokenForUser } from "@/lib/ecomviper/walmart/walmart-auth";
import { WALMART_PRODUCTION_BASE_URL } from "@/lib/ecomviper/walmart/walmart-client";
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

function extractItemNodes(payload: unknown): Record<string, unknown>[] {
  const root = asObject(payload);
  if (!root) return [];

  const candidates: unknown[] = [];
  const itemResponse = asObject(root.ItemResponse);

  candidates.push(root.items);
  candidates.push(root.Item);
  candidates.push(root.payload);
  candidates.push(itemResponse?.items);
  candidates.push(itemResponse?.item);
  candidates.push(itemResponse?.Item);
  candidates.push(itemResponse?.payload);
  candidates.push(asObject(root.data)?.items);

  for (const candidate of candidates) {
    const arrayEntries = asObjectArray(candidate);
    if (arrayEntries.length > 0) {
      return arrayEntries;
    }
  }

  return [];
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

function normalizeImportedItem(item: Record<string, unknown>): WalmartProductRecord | null {
  const sku = firstNonEmptyString(item.sku, item.SKU, item.sellerSku, item.sellerPartNumber);
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
  const imageUrl = firstNonEmptyString(
    item.mainImageUrl,
    item.imageUrl,
    asObjectArray(item.images)[0]?.url,
    asObjectArray(item.images)[0]?.imageUrl
  );

  const price = firstNumber(
    item.price,
    asObject(item.price)?.amount,
    asObject(item.currentPrice)?.amount,
    asObject(item.priceInfo)?.currentPrice
  ) ?? 0;

  const inventoryQuantity = firstNumber(
    item.inventoryQuantity,
    item.quantity,
    asObject(item.inventory)?.quantity,
    asObject(item.availability)?.quantity
  ) ?? 0;

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
    inventoryQuantity,
    imageUrl,
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
      imageUrl: normalized.imageUrl,
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
  return {
    items: extractItemNodes(payload),
    nextCursor: extractNextCursor(payload),
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
  let nextCursor: string | null = null;

  for (let pageIndex = 0; pageIndex < WALMART_IMPORT_MAX_PAGES; pageIndex += 1) {
    const page = await fetchCatalogPage(token.accessToken, nextCursor);
    collected.push(...page.items);

    if (!page.nextCursor || page.nextCursor === nextCursor || page.items.length === 0) {
      break;
    }
    nextCursor = page.nextCursor;
  }

  const bySku = new Map<string, WalmartProductRecord>();
  let skippedCount = 0;
  for (const item of collected) {
    const normalized = normalizeImportedItem(item);
    if (!normalized) {
      skippedCount += 1;
      continue;
    }
    bySku.set(normalized.sku.toUpperCase(), normalized);
  }

  const products = Array.from(bySku.values());
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
