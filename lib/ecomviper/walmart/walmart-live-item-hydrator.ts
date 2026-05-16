import "server-only";

import crypto from "crypto";
import { requestWalmartTokenForUser } from "@/lib/ecomviper/walmart/walmart-auth";
import { WALMART_PRODUCTION_BASE_URL } from "@/lib/ecomviper/walmart/walmart-client";
import { hydrateCurrentWalmartState, type WalmartHydrationStatus } from "@/lib/ecomviper/walmart/walmart-native-state";
import { normalizeSearchBrowseAttributes } from "@/lib/ecomviper/walmart/walmart-search-browse-attributes";
import type { WalmartProductRecord } from "@/lib/ecomviper/walmart/walmart-types";
import type { WalmartNativeState } from "@/lib/ecomviper/walmart/walmart-native-state";

const LIVE_HYDRATION_TTL_MS = 5 * 60 * 1000;
const LIVE_HYDRATION_TIMEOUT_MS = 10_000;

interface WalmartLiveHydrationCacheEntry {
  expiresAt: number;
  result: WalmartLiveHydrationResult;
  lastKnownGood: WalmartLiveHydrationResult | null;
}

interface LiveHydrationMetadata {
  status: WalmartHydrationStatus;
  source: "live_walmart_api" | "imported_snapshot" | "stale_live_cache";
  liveHydrated: boolean;
  partialHydration: boolean;
  snapshotFallback: boolean;
  stale: boolean;
  hydratedAt: string;
  fallbackReason: string;
  cacheState: "hit" | "miss" | "stale";
  cacheTtlMs: number;
  missingLiveFields: string[];
  sourceProvenance: string[];
  rawPayloadAvailable: boolean;
}

export interface WalmartLiveHydrationResult {
  currentWalmartState: WalmartNativeState;
  diagnostics: LiveHydrationMetadata;
  rawLivePayload: Record<string, unknown> | null;
}

declare global {
  var __ecomviper_walmart_live_hydration_cache__:
    | Map<string, WalmartLiveHydrationCacheEntry>
    | undefined;
}

function getCacheStore(): Map<string, WalmartLiveHydrationCacheEntry> {
  if (!globalThis.__ecomviper_walmart_live_hydration_cache__) {
    globalThis.__ecomviper_walmart_live_hydration_cache__ = new Map();
  }
  return globalThis.__ecomviper_walmart_live_hydration_cache__;
}

function cacheKey(userId: string, sku: string): string {
  return `${userId.trim().toLowerCase()}::${sku.trim().toUpperCase()}`;
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function asText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function optionalHeader(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function deepClone<T>(value: T): T {
  if (typeof globalThis.structuredClone === "function") {
    return globalThis.structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

function withHydrationDiagnostics(
  result: WalmartLiveHydrationResult,
  diagnostics: LiveHydrationMetadata
): WalmartLiveHydrationResult {
  const nextState = deepClone(result.currentWalmartState);
  nextState.hydration = {
    status: diagnostics.status,
    source: diagnostics.source,
    liveHydrated: diagnostics.liveHydrated,
    snapshotFallback: diagnostics.snapshotFallback,
    partialHydration: diagnostics.partialHydration,
    stale: diagnostics.stale,
    hydratedAt: diagnostics.hydratedAt,
    fallbackReason: diagnostics.fallbackReason,
    cacheState: diagnostics.cacheState,
    cacheTtlMs: diagnostics.cacheTtlMs,
    missingLiveFields: [...diagnostics.missingLiveFields],
    sourceProvenance: [...diagnostics.sourceProvenance],
    rawPayloadAvailable: diagnostics.rawPayloadAvailable,
  };

  return {
    ...result,
    diagnostics,
    currentWalmartState: nextState,
  };
}

function buildWalmartApiHeaders(accessToken: string, correlationId: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
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

function readArrayValues(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .flatMap((entry) => {
      if (typeof entry === "string") return [entry.trim()];
      const objectEntry = asObject(entry);
      if (!objectEntry) return [];
      return [
        asText(objectEntry.url),
        asText(objectEntry.value),
        asText(objectEntry.assetUrl),
        asText(objectEntry.location),
      ].filter(Boolean);
    })
    .map((entry) => entry.trim())
    .filter((entry) => /^https?:\/\//i.test(entry));
}

function parseLiveImageUrls(liveItem: Record<string, unknown>): string[] {
  const imageInfo = asObject(liveItem.imageInfo);
  const imagesNode = imageInfo?.allImages ?? liveItem.images ?? liveItem.imageUrls;
  const parsed = readArrayValues(imagesNode);
  const primary = asText(imageInfo?.primaryImageUrl) || asText(liveItem.imageUrl);
  return unique([primary, ...parsed].filter(Boolean));
}

function parseLiveBulletPoints(liveItem: Record<string, unknown>): string[] {
  const content = asObject(liveItem.content);
  const direct =
    liveItem.keyFeatures ??
    liveItem.bulletPoints ??
    liveItem.features ??
    liveItem.highlights ??
    liveItem.aboutThisItem ??
    content?.keyFeatures ??
    content?.bulletPoints ??
    content?.features ??
    content?.highlights ??
    content?.aboutThisItem;
  if (Array.isArray(direct)) {
    return unique(
      direct
        .flatMap((entry) => {
          if (typeof entry === "string") return [entry.trim()];
          const objectEntry = asObject(entry);
          if (!objectEntry) return [];
          const value =
            asText(objectEntry.value) ||
            asText(objectEntry.text) ||
            asText(objectEntry.description) ||
            asText(objectEntry.label) ||
            asText(objectEntry.title) ||
            asText(objectEntry.name);
          return value ? [value.trim()] : [];
        })
        .filter(Boolean)
    );
  }

  const keyFeatures = asText(direct);
  if (!keyFeatures) return [];
  return keyFeatures
    .split(/\r?\n|[;|]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseLiveAttributes(liveItem: Record<string, unknown>): Record<string, string> {
  const attributesNode = liveItem.attributes ?? liveItem.specs ?? liveItem.productAttributes;

  if (Array.isArray(attributesNode)) {
    const mapped: Record<string, string> = {};
    for (const row of attributesNode) {
      const objectRow = asObject(row);
      if (!objectRow) continue;
      const key =
        asText(objectRow.name) ||
        asText(objectRow.attributeName) ||
        asText(objectRow.key) ||
        asText(objectRow.id);
      const value =
        asText(objectRow.value) ||
        asText(objectRow.attributeValue) ||
        asText(objectRow.description) ||
        asText(objectRow.text);
      if (!key || !value) continue;
      mapped[key] = value;
    }
    return normalizeSearchBrowseAttributes(mapped);
  }

  const attributesObject = asObject(attributesNode);
  if (!attributesObject) return {};

  const mapped: Record<string, string> = {};
  for (const [key, value] of Object.entries(attributesObject)) {
    const text = asText(value);
    if (!text) continue;
    mapped[key] = text;
  }

  return normalizeSearchBrowseAttributes(mapped);
}

function extractLiveItemCandidates(payload: unknown): Record<string, unknown>[] {
  const candidates: Record<string, unknown>[] = [];

  const pushCandidate = (value: unknown) => {
    const objectValue = asObject(value);
    if (objectValue) candidates.push(objectValue);
  };

  const objectPayload = asObject(payload);
  if (!objectPayload) {
    if (Array.isArray(payload)) {
      for (const entry of payload) {
        pushCandidate(entry);
      }
    }
    return candidates;
  }

  pushCandidate(objectPayload.item);
  pushCandidate(objectPayload.Item);

  const data = asObject(objectPayload.data);
  if (data) {
    pushCandidate(data.item);
    pushCandidate(data.Item);
    if (Array.isArray(data.items)) {
      for (const entry of data.items) {
        pushCandidate(entry);
      }
    }
  }

  if (Array.isArray(objectPayload.items)) {
    for (const entry of objectPayload.items) {
      pushCandidate(entry);
    }
  }

  const rootItemResponse = objectPayload.ItemResponse ?? objectPayload.itemResponse;
  if (Array.isArray(rootItemResponse)) {
    for (const entry of rootItemResponse) {
      const row = asObject(entry);
      if (!row) continue;
      pushCandidate(row.item);
      pushCandidate(row.Item);
      if (Array.isArray(row.items)) {
        for (const item of row.items) {
          pushCandidate(item);
        }
      }
      if (Object.keys(row).length > 0) {
        pushCandidate(row);
      }
    }
  }

  const itemResponse = asObject(rootItemResponse);
  if (itemResponse) {
    pushCandidate(itemResponse.item);
    pushCandidate(itemResponse.Item);
    if (Array.isArray(itemResponse.items)) {
      for (const entry of itemResponse.items) {
        pushCandidate(entry);
      }
    }
  }

  const allItems = asObject(objectPayload.itemsResponse) ?? asObject(objectPayload.ItemsResponse);
  if (allItems) {
    const rows = allItems.items;
    if (Array.isArray(rows)) {
      for (const entry of rows) {
        pushCandidate(entry);
      }
    }
  }

  const dedupedBySignature = new Map<string, Record<string, unknown>>();
  for (const candidate of candidates) {
    const signature = [
      asText(candidate.sku) || asText(candidate.SKU),
      asText(candidate.itemId) || asText(candidate.usItemId) || asText(candidate.productId),
      asText(candidate.productName) || asText(candidate.title),
    ]
      .join("::")
      .toLowerCase();
    const key = signature || JSON.stringify(Object.keys(candidate).sort());
    if (!dedupedBySignature.has(key)) {
      dedupedBySignature.set(key, candidate);
    }
  }

  return Array.from(dedupedBySignature.values());
}

function extractLiveItemCandidate(payload: unknown, requestedSku: string): Record<string, unknown> | null {
  const candidates = extractLiveItemCandidates(payload);
  if (candidates.length === 0) return null;

  const normalizedRequestedSku = requestedSku.trim().toUpperCase();
  if (!normalizedRequestedSku) return candidates[0] ?? null;

  const skuMatch = candidates.find((candidate) => {
    const candidateSku = asText(candidate.sku) || asText(candidate.SKU);
    return candidateSku.trim().toUpperCase() === normalizedRequestedSku;
  });
  if (skuMatch) return skuMatch;

  return candidates[0] ?? null;
}

async function fetchJsonWithTimeout(input: {
  url: string;
  accessToken: string;
}): Promise<{ ok: boolean; status: number; payload: unknown; reason: string; }> {
  const correlationId = crypto.randomUUID();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LIVE_HYDRATION_TIMEOUT_MS);

  try {
    const response = await fetch(input.url, {
      method: "GET",
      headers: buildWalmartApiHeaders(input.accessToken, correlationId),
      cache: "no-store",
      signal: controller.signal,
    });

    const text = await response.text();
    const payload = text.trim() ? JSON.parse(text) as unknown : {};
    if (!response.ok) {
      if (response.status === 429) {
        return {
          ok: false,
          status: response.status,
          payload,
          reason: "Walmart API rate limited live hydration request.",
        };
      }
      return {
        ok: false,
        status: response.status,
        payload,
        reason: `Walmart API returned HTTP ${response.status} during live hydration.`,
      };
    }

    return {
      ok: true,
      status: response.status,
      payload,
      reason: "",
    };
  } catch {
    return {
      ok: false,
      status: 0,
      payload: {},
      reason: "Walmart API request timed out or failed during live hydration.",
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchLiveItemBySku(input: {
  accessToken: string;
  sku: string;
}): Promise<{ item: Record<string, unknown> | null; payload: Record<string, unknown> | null; reason: string; partialHydration: boolean; missingLiveFields: string[]; }> {
  const sku = input.sku.trim();
  const encodedSku = encodeURIComponent(sku);
  const candidateUrls = [
    `${WALMART_PRODUCTION_BASE_URL}/v3/items/${encodedSku}`,
    `${WALMART_PRODUCTION_BASE_URL}/v3/items?sku=${encodedSku}`,
    `${WALMART_PRODUCTION_BASE_URL}/v3/items?limit=20`,
  ];

  let lastReason = "No Walmart item payload returned.";
  let lastPayload: Record<string, unknown> | null = null;

  for (const url of candidateUrls) {
    const response = await fetchJsonWithTimeout({
      url,
      accessToken: input.accessToken,
    });
    if (!response.ok) {
      lastReason = response.reason;
      continue;
    }

    const candidate = extractLiveItemCandidate(response.payload, sku);
    if (!candidate) {
      lastPayload = asObject(response.payload);
      lastReason = "Walmart API response did not include a recognizable item node.";
      continue;
    }

    const candidateSku = asText(candidate.sku) || asText(candidate.SKU);
    if (candidateSku && candidateSku.toUpperCase() !== sku.toUpperCase() && url.endsWith("limit=20")) {
      // limited-list endpoint is only a fallback and might not return our SKU.
      lastPayload = asObject(response.payload);
      lastReason = `Walmart API returned items but SKU ${sku} was not present in fallback page.`;
      continue;
    }

    const missingLiveFields = [
      asText(candidate.productName) || asText(candidate.product_name) || asText(candidate.title)
        ? ""
        : "product_name",
      asText(candidate.brand) || asText(candidate.brandName) ? "" : "brand",
      asNumber(candidate.price) ?? asNumber(asObject(candidate.priceInfo)?.currentPrice) ?? asNumber(asObject(candidate.priceInfo)?.price)
        ? ""
        : "price",
      asNumber(candidate.quantity) ?? asNumber(asObject(candidate.inventory)?.quantity)
        ? ""
        : "inventory",
    ].filter(Boolean);

    return {
      item: candidate,
      payload: asObject(response.payload),
      reason: "",
      partialHydration: missingLiveFields.length > 0,
      missingLiveFields,
    };
  }

  return {
    item: null,
    payload: lastPayload,
    reason: lastReason,
    partialHydration: false,
    missingLiveFields: [],
  };
}

function mergeLiveItemIntoProduct(input: {
  product: WalmartProductRecord;
  liveItem: Record<string, unknown>;
  livePayload: Record<string, unknown> | null;
}): WalmartProductRecord {
  const liveItem = input.liveItem;
  const liveContent = asObject(liveItem.content);
  const currentRaw = asObject(input.product.rawPayload) ?? {};
  const currentNormalized = asObject(input.product.normalizedPayload) ?? {};

  const title =
    asText(liveItem.productName) ||
    asText(liveItem.product_name) ||
    asText(liveItem.title) ||
    input.product.title;
  const brand =
    asText(liveItem.brand) ||
    asText(liveItem.brandName) ||
    input.product.brand;

  const shortDescription =
    asText(liveItem.shortDescription) ||
    asText(liveItem.siteDescription) ||
    asText(liveItem.short_desc) ||
    asText(liveItem.synopsis) ||
    asText(liveContent?.shortDescription) ||
    asText(liveContent?.siteDescription) ||
    input.product.shortDescription;

  const longDescription =
    asText(liveItem.longDescription) ||
    asText(liveItem.fullDescription) ||
    asText(liveItem.description) ||
    asText(liveItem.productDescription) ||
    asText(liveContent?.longDescription) ||
    asText(liveContent?.fullDescription) ||
    asText(liveContent?.description) ||
    input.product.longDescription;

  const bulletPoints = parseLiveBulletPoints(liveItem);
  const price =
    asNumber(liveItem.price) ??
    asNumber(asObject(liveItem.priceInfo)?.currentPrice) ??
    asNumber(asObject(liveItem.priceInfo)?.price) ??
    input.product.price;

  const inventoryQuantity =
    asNumber(liveItem.quantity) ??
    asNumber(asObject(liveItem.inventory)?.quantity) ??
    input.product.inventoryQuantity;

  const imageUrls = parseLiveImageUrls(liveItem);
  const primaryImageUrl = imageUrls[0] ?? input.product.imageUrl;
  const galleryImageUrls = imageUrls.length > 0 ? imageUrls : input.product.galleryImageUrls ?? [];

  const liveAttributes = parseLiveAttributes(liveItem);
  const mergedAttributes = {
    ...input.product.attributes,
    ...liveAttributes,
  };

  const mergedSearchBrowse = {
    ...(input.product.searchBrowseAttributes ?? {}),
    ...liveAttributes,
  };

  return {
    ...input.product,
    title,
    brand,
    shortDescription,
    longDescription,
    bulletPoints: bulletPoints.length > 0 ? bulletPoints : input.product.bulletPoints,
    price,
    inventoryQuantity,
    inventoryStatus: Number.isFinite(inventoryQuantity) ? "known" : input.product.inventoryStatus,
    imageUrl: primaryImageUrl,
    galleryImageUrls,
    primaryImageUrl,
    attributes: mergedAttributes,
    searchBrowseAttributes: mergedSearchBrowse,
    rawPayload: {
      ...currentRaw,
      liveItemPayload: input.livePayload ?? liveItem,
      liveItemNode: liveItem,
      liveHydrationFetchedAt: new Date().toISOString(),
    },
    normalizedPayload: {
      ...currentNormalized,
      liveHydration: {
        title,
        brand,
        shortDescription,
        longDescription,
        bulletPoints,
        price,
        inventoryQuantity,
        galleryImageUrls,
      },
      attributes: {
        ...(asObject(currentNormalized.attributes) ?? {}),
        ...mergedAttributes,
      },
    },
    updatedAt: new Date().toISOString(),
  };
}

function buildSnapshotFallbackResult(input: {
  product: WalmartProductRecord;
  fallbackReason: string;
  source: LiveHydrationMetadata["source"];
  stale: boolean;
  cacheState: LiveHydrationMetadata["cacheState"];
  missingLiveFields?: string[];
}): WalmartLiveHydrationResult {
  const hydratedAt = new Date().toISOString();
  const diagnostics: LiveHydrationMetadata = {
    status: "snapshotFallback",
    source: input.source,
    liveHydrated: false,
    partialHydration: false,
    snapshotFallback: true,
    stale: input.stale,
    hydratedAt,
    fallbackReason: input.fallbackReason,
    cacheState: input.cacheState,
    cacheTtlMs: LIVE_HYDRATION_TTL_MS,
    missingLiveFields: input.missingLiveFields ?? [],
    sourceProvenance: ["imported_snapshot_payload", "normalized_catalog_payload"],
    rawPayloadAvailable: true,
  };

  const currentWalmartState = hydrateCurrentWalmartState({
    product: input.product,
    hydrationMetadata: diagnostics,
  });

  return {
    currentWalmartState,
    diagnostics,
    rawLivePayload: null,
  };
}

export async function hydrateLiveWalmartItemStateForUser(input: {
  userId: string;
  product: WalmartProductRecord;
  forceRefresh?: boolean;
}): Promise<WalmartLiveHydrationResult> {
  if (process.env.NODE_ENV === "test") {
    return buildSnapshotFallbackResult({
      product: input.product,
      fallbackReason: "Test runtime uses snapshot fallback by design.",
      source: "imported_snapshot",
      stale: false,
      cacheState: "miss",
    });
  }

  const key = cacheKey(input.userId, input.product.sku);
  const store = getCacheStore();
  const existing = store.get(key);

  if (!input.forceRefresh && existing && existing.expiresAt > Date.now()) {
    const diagnostics: LiveHydrationMetadata = {
      ...existing.result.diagnostics,
      cacheState: "hit",
      stale: false,
    };
    return withHydrationDiagnostics(existing.result, diagnostics);
  }

  const token = await requestWalmartTokenForUser(input.userId);
  if (!token.ok || !token.accessToken) {
    const fallback = buildSnapshotFallbackResult({
      product: input.product,
      fallbackReason:
        token.lastError?.message ||
        "Walmart credentials unavailable for live hydration.",
      source: existing?.lastKnownGood ? "stale_live_cache" : "imported_snapshot",
      stale: Boolean(existing?.lastKnownGood),
      cacheState: existing?.lastKnownGood ? "stale" : "miss",
    });

    if (existing?.lastKnownGood) {
      const diagnostics: LiveHydrationMetadata = {
        ...existing.lastKnownGood.diagnostics,
        status: "partialHydration",
        source: "stale_live_cache",
        stale: true,
        partialHydration: true,
        snapshotFallback: false,
        fallbackReason: fallback.diagnostics.fallbackReason,
        cacheState: "stale",
      };
      return withHydrationDiagnostics(existing.lastKnownGood, diagnostics);
    }

    const snapshotResult = withHydrationDiagnostics(fallback, fallback.diagnostics);

    store.set(key, {
      expiresAt: Date.now() + LIVE_HYDRATION_TTL_MS,
      result: snapshotResult,
      lastKnownGood: existing?.lastKnownGood ?? null,
    });
    return snapshotResult;
  }

  const liveResponse = await fetchLiveItemBySku({
    accessToken: token.accessToken,
    sku: input.product.sku,
  });

  if (!liveResponse.item) {
    if (existing?.lastKnownGood) {
      const diagnostics: LiveHydrationMetadata = {
        ...existing.lastKnownGood.diagnostics,
        status: "partialHydration",
        source: "stale_live_cache",
        stale: true,
        partialHydration: true,
        snapshotFallback: false,
        fallbackReason: liveResponse.reason,
        cacheState: "stale",
      };
      return withHydrationDiagnostics(existing.lastKnownGood, diagnostics);
    }

    const fallback = buildSnapshotFallbackResult({
      product: input.product,
      fallbackReason: liveResponse.reason,
      source: "imported_snapshot",
      stale: false,
      cacheState: "miss",
      missingLiveFields: liveResponse.missingLiveFields,
    });
    const snapshotResult = withHydrationDiagnostics(fallback, fallback.diagnostics);

    store.set(key, {
      expiresAt: Date.now() + LIVE_HYDRATION_TTL_MS,
      result: snapshotResult,
      lastKnownGood: existing?.lastKnownGood ?? null,
    });

    return snapshotResult;
  }

  const mergedProduct = mergeLiveItemIntoProduct({
    product: input.product,
    liveItem: liveResponse.item,
    livePayload: liveResponse.payload,
  });

  const hydratedAt = new Date().toISOString();
  const diagnostics: LiveHydrationMetadata = {
    status: liveResponse.partialHydration ? "partialHydration" : "liveHydrated",
    source: "live_walmart_api",
    liveHydrated: !liveResponse.partialHydration,
    partialHydration: liveResponse.partialHydration,
    snapshotFallback: false,
    stale: false,
    hydratedAt,
    fallbackReason: liveResponse.partialHydration
      ? "Live hydration completed with partial field coverage."
      : "",
    cacheState: "miss",
    cacheTtlMs: LIVE_HYDRATION_TTL_MS,
    missingLiveFields: liveResponse.missingLiveFields,
    sourceProvenance: ["walmart_get_item_api", "walmart_get_all_items_api"],
    rawPayloadAvailable: Boolean(liveResponse.payload),
  };

  const currentWalmartState = hydrateCurrentWalmartState({
    product: mergedProduct,
    hydrationMetadata: diagnostics,
    liveItemPayload: liveResponse.payload,
  });

  const result = withHydrationDiagnostics(
    {
      currentWalmartState,
      diagnostics,
      rawLivePayload: liveResponse.payload,
    },
    diagnostics
  );

  store.set(key, {
    expiresAt: Date.now() + LIVE_HYDRATION_TTL_MS,
    result,
    lastKnownGood: result,
  });

  return result;
}
