import "server-only";

import crypto from "crypto";
import { WALMART_PRODUCTION_BASE_URL } from "@/lib/ecomviper/walmart/walmart-client";
import type {
  WalmartImageMatchMethod,
  WalmartImageSyncStatus,
  WalmartProductRecord,
} from "@/lib/ecomviper/walmart/walmart-types";

interface ItemSearchAttempt {
  method: WalmartImageMatchMethod;
  value: string;
}

export interface WalmartItemSearchAttemptDiagnostic {
  method: WalmartImageMatchMethod;
  httpStatus: number | null;
  resultCount: number;
  ok: boolean;
}

export interface WalmartItemSearchImageEnrichment {
  imageSyncStatus: WalmartImageSyncStatus;
  imageSource: "walmart_item_search";
  primaryImageUrl: string;
  galleryImageUrls: string[];
  variantImageUrls: string[];
  matchedItemId: string | null;
  matchMethod: WalmartImageMatchMethod | null;
  lastImageSyncedAt: string;
  diagnostics: {
    attempts: WalmartItemSearchAttemptDiagnostic[];
  };
}

interface SearchCandidate {
  item: Record<string, unknown>;
  itemId: string;
  wpid: string;
  upc: string;
  gtin: string;
  title: string;
  brand: string;
  score: number;
}

interface SearchIntent {
  itemId: string;
  wpid: string;
  upc: string;
  gtin: string;
  title: string;
  brand: string;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
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

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeIdentifier(value: string): string {
  return value.replace(/[^a-z0-9]/gi, "").toUpperCase();
}

function normalizeImageUrl(value: unknown): string {
  const trimmed = asString(value);
  if (!trimmed) return "";

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "";
    }
    if (parsed.protocol === "http:") {
      parsed.protocol = "https:";
    }
    return parsed.toString();
  } catch {
    return "";
  }
}

function dedupeUrls(values: unknown[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const raw of values) {
    const normalized = normalizeImageUrl(raw);
    if (!normalized) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    output.push(normalized);
  }

  return output;
}

function extractSearchItems(payload: unknown): Record<string, unknown>[] {
  const root = asObject(payload);
  if (!root) return [];

  const itemResponse = asObject(root.ItemResponse);
  const candidates = [
    root.items,
    root.ItemResponse,
    itemResponse?.items,
    itemResponse?.item,
    itemResponse?.Item,
    asObject(root.data)?.items,
  ];

  for (const candidate of candidates) {
    const arrayEntries = asObjectArray(candidate);
    if (arrayEntries.length > 0) return arrayEntries;
  }

  return [];
}

function extractItemIdentifiers(item: Record<string, unknown>) {
  const identifiers = asObject(item.identifiers) ?? asObject(item.productIdentifiers) ?? asObject(item.productIds);

  return {
    itemId: firstNonEmptyString(item.itemId, item.usItemId, item.id, identifiers?.itemId, identifiers?.usItemId),
    wpid: firstNonEmptyString(item.wpid, item.wpID, item.WPID, identifiers?.wpid, identifiers?.wpID),
    upc: firstNonEmptyString(item.upc, identifiers?.upc, identifiers?.UPC),
    gtin: firstNonEmptyString(item.gtin, item.GTIN, identifiers?.gtin, identifiers?.GTIN),
    title: firstNonEmptyString(item.productName, item.title, item.name, asObject(item.product)?.title),
    brand: firstNonEmptyString(item.brand, item.brandName, asObject(item.product)?.brand),
  };
}

function extractItemImages(item: Record<string, unknown>): {
  primaryImageUrl: string;
  galleryImageUrls: string[];
  variantImageUrls: string[];
} {
  const imageRows = asObjectArray(item.images);
  const galleryImageUrls = dedupeUrls([
    ...imageRows.flatMap((entry) => [entry.url, entry.imageUrl, entry.mainImageUrl]),
    item.imageUrl,
    item.mainImageUrl,
    item.productImageUrl,
    asObject(item.product)?.imageUrl,
    asObject(item.product)?.mainImageUrl,
  ]);

  const variantRows = asObjectArray(asObject(asObject(item.properties)?.variants)?.variantData);
  const variantImageUrls = dedupeUrls(
    variantRows.flatMap((entry) => [entry.productImageUrl, entry.imageUrl, entry.mainImageUrl])
  );

  const primaryImageUrl = galleryImageUrls[0] ?? variantImageUrls[0] ?? "";

  return {
    primaryImageUrl,
    galleryImageUrls,
    variantImageUrls,
  };
}

function overlapScore(left: string, right: string): number {
  const leftTokens = normalizeText(left)
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2);
  const rightTokens = new Set(
    normalizeText(right)
      .split(/[^a-z0-9]+/)
      .map((token) => token.trim())
      .filter((token) => token.length > 2)
  );

  if (leftTokens.length === 0 || rightTokens.size === 0) return 0;
  const matches = leftTokens.filter((token) => rightTokens.has(token)).length;
  return Math.round((matches / leftTokens.length) * 20);
}

function scoreSearchCandidate(item: Record<string, unknown>, intent: SearchIntent): SearchCandidate {
  const identifiers = extractItemIdentifiers(item);
  const candidate = {
    item,
    itemId: identifiers.itemId,
    wpid: identifiers.wpid,
    upc: identifiers.upc,
    gtin: identifiers.gtin,
    title: identifiers.title,
    brand: identifiers.brand,
    score: 0,
  };

  if (intent.gtin && normalizeIdentifier(intent.gtin) === normalizeIdentifier(candidate.gtin)) {
    candidate.score += 140;
  }
  if (intent.upc && normalizeIdentifier(intent.upc) === normalizeIdentifier(candidate.upc)) {
    candidate.score += 120;
  }
  if (intent.itemId && normalizeIdentifier(intent.itemId) === normalizeIdentifier(candidate.itemId)) {
    candidate.score += 100;
  }
  if (intent.wpid && normalizeIdentifier(intent.wpid) === normalizeIdentifier(candidate.wpid)) {
    candidate.score += 90;
  }

  if (intent.title) {
    candidate.score += overlapScore(intent.title, candidate.title);
  }
  if (intent.brand && normalizeText(intent.brand) === normalizeText(candidate.brand)) {
    candidate.score += 18;
  }

  const images = extractItemImages(item);
  if (!images.primaryImageUrl) {
    candidate.score -= 25;
  }

  return candidate;
}

function buildSearchUrl(attempt: ItemSearchAttempt): string {
  const url = new URL("/v3/items/walmart/search", `${WALMART_PRODUCTION_BASE_URL}/`);

  if (attempt.method === "gtin") {
    url.searchParams.set("gtin", attempt.value);
  } else if (attempt.method === "upc") {
    url.searchParams.set("upc", attempt.value);
  } else {
    // itemId/wpid are routed via query search because dedicated params are not verified here.
    url.searchParams.set("query", attempt.value);
  }

  return url.toString();
}

async function searchWalmartItems(
  accessToken: string,
  attempt: ItemSearchAttempt
): Promise<{ items: Record<string, unknown>[]; diagnostic: WalmartItemSearchAttemptDiagnostic }> {
  const correlationId = crypto.randomUUID();
  const url = buildSearchUrl(attempt);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: buildWalmartApiHeaders(accessToken, correlationId),
      cache: "no-store",
    });

    const responseBody = await response.text();
    const payload = responseBody ? (JSON.parse(responseBody) as unknown) : {};
    const items = response.ok ? extractSearchItems(payload) : [];

    return {
      items,
      diagnostic: {
        method: attempt.method,
        httpStatus: response.status,
        resultCount: items.length,
        ok: response.ok,
      },
    };
  } catch {
    return {
      items: [],
      diagnostic: {
        method: attempt.method,
        httpStatus: null,
        resultCount: 0,
        ok: false,
      },
    };
  }
}

function resolveAttempts(product: Pick<WalmartProductRecord, "gtin" | "upc" | "itemId" | "wpid" | "title" | "brand">): ItemSearchAttempt[] {
  const queue: ItemSearchAttempt[] = [];
  const seen = new Set<string>();

  const push = (method: WalmartImageMatchMethod, value: string | undefined) => {
    const normalizedValue = asString(value);
    if (!normalizedValue) return;
    const key = `${method}:${normalizedValue.toUpperCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    queue.push({ method, value: normalizedValue });
  };

  push("gtin", product.gtin);
  push("upc", product.upc);
  push("itemId", product.itemId);
  push("wpid", product.wpid);

  const query = [asString(product.title), asString(product.brand)].filter(Boolean).join(" ").trim();
  push("query", query);

  return queue;
}

export async function enrichWalmartImageFromItemSearch(params: {
  accessToken: string;
  product: Pick<WalmartProductRecord, "gtin" | "upc" | "itemId" | "wpid" | "title" | "brand">;
}): Promise<WalmartItemSearchImageEnrichment> {
  const attempts = resolveAttempts(params.product);
  const diagnostics: WalmartItemSearchAttemptDiagnostic[] = [];
  const syncedAt = new Date().toISOString();

  if (attempts.length === 0) {
    return {
      imageSyncStatus: "not_synced",
      imageSource: "walmart_item_search",
      primaryImageUrl: "",
      galleryImageUrls: [],
      variantImageUrls: [],
      matchedItemId: null,
      matchMethod: null,
      lastImageSyncedAt: syncedAt,
      diagnostics: { attempts: [] },
    };
  }

  let hadSuccessfulRead = false;

  const intent: SearchIntent = {
    itemId: asString(params.product.itemId),
    wpid: asString(params.product.wpid),
    upc: asString(params.product.upc),
    gtin: asString(params.product.gtin),
    title: asString(params.product.title),
    brand: asString(params.product.brand),
  };

  for (const attempt of attempts) {
    const result = await searchWalmartItems(params.accessToken, attempt);
    diagnostics.push(result.diagnostic);

    if (!result.diagnostic.ok) {
      continue;
    }

    hadSuccessfulRead = true;

    if (result.items.length === 0) {
      continue;
    }

    const candidates = result.items
      .map((item) => scoreSearchCandidate(item, intent))
      .sort((left, right) => right.score - left.score);

    const top = candidates[0];
    const second = candidates[1] ?? null;
    if (!top) {
      continue;
    }

    const scoreGap = second ? top.score - second.score : top.score;
    const lowConfidence = top.score < 30;
    const ambiguous = lowConfidence || (second !== null && scoreGap <= 8 && second.score > 20);

    const images = extractItemImages(top.item);

    if (ambiguous) {
      return {
        imageSyncStatus: "ambiguous",
        imageSource: "walmart_item_search",
        primaryImageUrl: "",
        galleryImageUrls: [],
        variantImageUrls: [],
        matchedItemId: top.itemId || null,
        matchMethod: attempt.method,
        lastImageSyncedAt: syncedAt,
        diagnostics: { attempts: diagnostics },
      };
    }

    if (!images.primaryImageUrl) {
      continue;
    }

    return {
      imageSyncStatus: "found",
      imageSource: "walmart_item_search",
      primaryImageUrl: images.primaryImageUrl,
      galleryImageUrls: images.galleryImageUrls,
      variantImageUrls: images.variantImageUrls,
      matchedItemId: top.itemId || null,
      matchMethod: attempt.method,
      lastImageSyncedAt: syncedAt,
      diagnostics: { attempts: diagnostics },
    };
  }

  return {
    imageSyncStatus: hadSuccessfulRead ? "not_found" : "failed",
    imageSource: "walmart_item_search",
    primaryImageUrl: "",
    galleryImageUrls: [],
    variantImageUrls: [],
    matchedItemId: null,
    matchMethod: null,
    lastImageSyncedAt: syncedAt,
    diagnostics: { attempts: diagnostics },
  };
}

export const walmartItemSearchInternals = {
  normalizeImageUrl,
  dedupeUrls,
  extractItemImages,
  extractSearchItems,
};
