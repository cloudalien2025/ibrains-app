import "server-only";

import {
  getWalmartSerpApiConnectionStatusForUser,
  getWalmartSerpApiKeyForUser,
} from "@/lib/ecomviper/walmart/walmart-serpapi-connection";
import {
  extractSerpApiErrorDetail,
  sanitizeSerpApiErrorDetail,
} from "@/lib/ecomviper/walmart/serpapi-safety";
import {
  extractWalmartPublicProductIdFromUrl as extractWalmartPublicProductIdFromUrlShared,
  isLikelyGtinOrUpc,
  normalizeWalmartPublicUrl,
  resolveCanonicalWalmartIdentifierFromProductRecord,
  type WalmartPublicIdentifierType,
} from "@/lib/ecomviper/walmart/walmart-public-identifier";
import type {
  WalmartImageMatchMethod,
  WalmartImageSyncStatus,
  WalmartProductRecord,
} from "@/lib/ecomviper/walmart/walmart-types";

const SERPAPI_ENDPOINT = "https://serpapi.com/search.json";
const SERPAPI_REQUEST_TIMEOUT_MS = 16_000;
const SERPAPI_RETRY_BACKOFF_MS = [450, 1_200] as const;

type SerpApiEndpointFamily = "walmart_product" | "walmart_search";
type SerpApiProductIdentifierType = WalmartPublicIdentifierType;
type SerpApiStatusCategory =
  | "ok"
  | "not_found"
  | "ambiguous"
  | "validation_error"
  | "invalid_key"
  | "forbidden"
  | "rate_limited"
  | "provider_error"
  | "network_error"
  | "malformed_response"
  | "not_configured";

type SerpApiResolveErrorCode =
  | "SERPAPI_NOT_CONNECTED"
  | "INVALID_PUBLIC_WALMART_URL"
  | "INVALID_PUBLIC_WALMART_PRODUCT_ID"
  | "SERPAPI_INVALID_KEY"
  | "SERPAPI_FORBIDDEN"
  | "SERPAPI_AUTH_FAILED"
  | "SERPAPI_RATE_LIMITED"
  | "SERPAPI_BAD_REQUEST"
  | "SERPAPI_PROVIDER_ERROR"
  | "SERPAPI_NETWORK_ERROR"
  | "SERPAPI_MALFORMED_RESPONSE"
  | "SERPAPI_REQUEST_FAILED"
  | "SERPAPI_NO_IMAGES_FOUND"
  | "SERPAPI_AMBIGUOUS_MATCH"
  | "SERPAPI_NOT_FOUND";

interface SerpApiRequestDiagnostics {
  provider: "serpapi";
  endpointFamily: SerpApiEndpointFamily;
  statusCategory: SerpApiStatusCategory;
  productId: string | null;
  productIdentifierType?: SerpApiProductIdentifierType;
  productPageUrl?: string | null;
  queryUsed?: string | null;
  candidateCount: number;
  imageCount: number;
  matchMethod: WalmartImageMatchMethod | null;
  topCandidateTitle?: string | null;
  topCandidateProductId?: string | null;
}

export interface WalmartPublicListingImageResolution {
  imageSyncStatus: WalmartImageSyncStatus;
  imageSource: "public_walmart_listing_serpapi";
  statusReason: string;
  imageMatchMethod: WalmartImageMatchMethod | null;
  publicWalmartUrl: string;
  publicWalmartProductId: string;
  primaryImageUrl: string;
  galleryImageUrls: string[];
  variantImageUrls: string[];
  lastImageSyncedAt: string;
  diagnostics: SerpApiRequestDiagnostics;
  errorCode?: SerpApiResolveErrorCode;
}

export interface WalmartSearchCandidate {
  productId: string;
  title: string;
  brand: string;
  upc: string;
  gtin: string;
  primaryImageUrl: string;
  galleryImageUrls: string[];
  variantImageUrls: string[];
  raw: Record<string, unknown>;
}

export interface SerpApiWalmartBrandSearchListing {
  sourceQuery: string;
  page: number;
  rank: number;
  title: string;
  thumbnail: string;
  productPageUrl: string;
  usItemId: string;
  productId: string;
  upc: string;
  sellerId: string;
  sellerName: string;
  brand: string;
  manufacturer: string;
  raw: Record<string, unknown>;
}

export interface SerpApiWalmartBrandSearchHarvestResult {
  ok: boolean;
  statusCategory: SerpApiStatusCategory;
  errorCode?: SerpApiResolveErrorCode;
  statusReason: string;
  query: string;
  pagesFetched: number;
  resultsHarvested: number;
  listings: SerpApiWalmartBrandSearchListing[];
}

export interface SerpApiWalmartBrandSearchMatchResult {
  status: "matched" | "ambiguous" | "no_confident_match";
  confidence: "high" | "medium" | "low";
  score: number;
  matchedListing: SerpApiWalmartBrandSearchListing | null;
  runnerUpListing: SerpApiWalmartBrandSearchListing | null;
  runnerUpScore: number;
  titleCoverage: number;
  titleJaccard: number;
  keyTokenOverlap: number;
  exactTitle: boolean;
}

interface SerpApiProductImageResult {
  ok: boolean;
  statusCategory: SerpApiStatusCategory;
  errorCode?: SerpApiResolveErrorCode;
  statusReason: string;
  productId: string;
  productPageUrl: string;
  title: string;
  brand: string;
  primaryImageUrl: string;
  galleryImageUrls: string[];
  variantImageUrls: string[];
}

function asString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "bigint") return value.toString();
  return "";
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
    const text = asString(value);
    if (text) return text;
  }
  return "";
}

function normalizeIdentifier(value: string): string {
  return value.replace(/[^0-9a-z]/gi, "").toUpperCase();
}

function normalizeWalmartPublicProductId(value: unknown): string {
  const text = asString(value);
  if (!text) return "";
  if (!/^\d{6,20}$/.test(text)) return "";
  return text;
}

function sanitizePublicWalmartUrl(value: unknown): string {
  return normalizeWalmartPublicUrl(value);
}

function derivePublicWalmartUrl(productId: string): string {
  const normalized = normalizeWalmartPublicProductId(productId);
  if (!normalized) return "";
  return `https://www.walmart.com/ip/${normalized}`;
}

export function extractWalmartPublicProductIdFromUrl(url: string): string | null {
  return extractWalmartPublicProductIdFromUrlShared(url);
}

function normalizeImageUrl(value: unknown): string {
  const candidate = asString(value);
  if (!candidate) return "";

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return "";
    }
    parsed.protocol = "https:";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return "";
  }
}

function imageKey(url: string): string {
  try {
    const parsed = new URL(url);
    const safeParams = new URLSearchParams();
    for (const [key, value] of parsed.searchParams.entries()) {
      if (/^(w|h|odnHeight|odnWidth|odnBg|format|fit|qlt)$/i.test(key)) {
        safeParams.set(key, value);
      }
    }
    const normalizedParams = safeParams.toString();
    const search = normalizedParams ? `?${normalizedParams}` : "";
    return `${parsed.protocol}//${parsed.hostname.toLowerCase()}${parsed.pathname}${search}`;
  } catch {
    return url;
  }
}

function isPreferredWalmartImageHost(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host.includes("walmartimages.com");
  } catch {
    return false;
  }
}

function dedupeImageUrls(urls: unknown[]): string[] {
  const indexed = new Map<string, { key: string; url: string; score: number; order: number }>();

  urls.forEach((value, index) => {
    const normalized = normalizeImageUrl(value);
    if (!normalized) return;

    const key = imageKey(normalized);
    const score = isPreferredWalmartImageHost(normalized) ? 2 : 1;
    const existing = indexed.get(key);
    if (!existing || score > existing.score) {
      indexed.set(key, { key, url: normalized, score, order: index });
    }
  });

  return Array.from(indexed.values())
    .sort((left, right) => {
      if (left.score !== right.score) return right.score - left.score;
      return left.order - right.order;
    })
    .map((entry) => entry.url);
}

function resolveSerpApiProductPageMetadata(input: {
  payload: Record<string, unknown>;
  fallbackProductId: string;
}): {
  publicWalmartUrl: string;
  resolvedProductId: string;
} {
  const productResult = asObject(input.payload.product_result);
  const productPageUrl = sanitizePublicWalmartUrl(
    firstNonEmptyString(
      productResult?.product_page_url,
      productResult?.productPageUrl,
      input.payload.product_page_url,
      input.payload.productPageUrl
    )
  );
  const productIdFromPageUrl = productPageUrl
    ? extractWalmartPublicProductIdFromUrl(productPageUrl) ?? ""
    : "";

  const productIdFromPayload = normalizeWalmartPublicProductId(
    firstNonEmptyString(
      productResult?.us_item_id,
      productResult?.usItemId,
      productResult?.item_id,
      productResult?.itemId,
      productResult?.product_id,
      productResult?.productId,
      input.payload.us_item_id,
      input.payload.usItemId,
      input.payload.item_id,
      input.payload.itemId,
      input.payload.product_id,
      input.payload.productId
    )
  );

  const resolvedProductId =
    productIdFromPageUrl ||
    productIdFromPayload ||
    normalizeWalmartPublicProductId(input.fallbackProductId);
  const resolvedUrl = productPageUrl || derivePublicWalmartUrl(resolvedProductId);
  return {
    publicWalmartUrl: resolvedUrl,
    resolvedProductId,
  };
}

function collectImageLikeUrls(value: unknown, keyHint = "", depth = 0): string[] {
  if (depth > 6 || value === null || value === undefined) {
    return [];
  }

  if (typeof value === "string") {
    if (!/(image|media|thumb|gallery|asset)/i.test(keyHint)) return [];
    const normalized = normalizeImageUrl(value);
    return normalized ? [normalized] : [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) => collectImageLikeUrls(entry, keyHint, depth + 1));
  }

  const node = asObject(value);
  if (!node) return [];

  const urls: string[] = [];
  for (const [key, child] of Object.entries(node)) {
    const nextHint = keyHint ? `${keyHint}.${key}` : key;

    if (typeof child === "string") {
      if (/(image|media|thumb|gallery|asset)/i.test(nextHint)) {
        const normalized = normalizeImageUrl(child);
        if (normalized) {
          urls.push(normalized);
        }
      }
      continue;
    }

    urls.push(...collectImageLikeUrls(child, nextHint, depth + 1));
  }

  return urls;
}

export function normalizeSerpApiWalmartImages(response: unknown): {
  primaryImageUrl: string;
  galleryImageUrls: string[];
  variantImageUrls: string[];
} {
  const root = asObject(response) ?? {};
  const productResult = asObject(root.product_result);

  const primaryCandidates = [
    productResult?.image,
    productResult?.image_url,
    productResult?.imageUrl,
    productResult?.primary_image,
    productResult?.primaryImage,
    productResult?.product_image,
    productResult?.productImage,
    productResult?.main_image,
    productResult?.mainImage,
    productResult?.thumbnail,
    root.image,
    root.image_url,
    root.imageUrl,
    root.primary_image,
    root.primaryImage,
    root.product_image,
    root.productImage,
    root.main_image,
    root.mainImage,
    root.thumbnail,
  ];

  const galleryCandidates = [
    ...(Array.isArray(productResult?.images) ? productResult?.images : []),
    ...(Array.isArray(productResult?.image_urls) ? productResult?.image_urls : []),
    ...(Array.isArray(productResult?.imageUrls) ? productResult?.imageUrls : []),
    ...(Array.isArray(productResult?.product_images) ? productResult?.product_images : []),
    ...(Array.isArray(productResult?.productImages) ? productResult?.productImages : []),
    ...(Array.isArray(productResult?.thumbnails) ? productResult?.thumbnails : []),
    ...(Array.isArray(productResult?.media) ? productResult?.media : []),
    ...(Array.isArray(root.images) ? root.images : []),
    ...(Array.isArray(root.image_urls) ? root.image_urls : []),
    ...(Array.isArray(root.imageUrls) ? root.imageUrls : []),
    ...(Array.isArray(root.product_images) ? root.product_images : []),
    ...(Array.isArray(root.productImages) ? root.productImages : []),
    ...(Array.isArray(root.thumbnails) ? root.thumbnails : []),
    ...(Array.isArray(root.media) ? root.media : []),
    ...collectImageLikeUrls(productResult?.media, "product_result.media"),
    ...collectImageLikeUrls(productResult?.images, "product_result.images"),
    ...collectImageLikeUrls(root, "root"),
  ];

  const variantCandidates = [
    ...collectImageLikeUrls(productResult?.variants, "product_result.variants"),
    ...collectImageLikeUrls(root.variants, "root.variants"),
  ];

  const primaryList = dedupeImageUrls(primaryCandidates);
  const galleryList = dedupeImageUrls([...primaryList, ...galleryCandidates]);
  const variantList = dedupeImageUrls(variantCandidates);
  const mergedGallery = dedupeImageUrls([...galleryList, ...variantList]);
  const primaryImageUrl = primaryList[0] ?? mergedGallery[0] ?? "";

  return {
    primaryImageUrl,
    galleryImageUrls: mergedGallery,
    variantImageUrls: variantList,
  };
}

function withSafeProviderDetail(base: string, detail: string | null): string {
  if (!detail) return base;
  if (base.endsWith(".")) {
    return `${base.slice(0, -1)}: ${detail}`;
  }
  return `${base}: ${detail}`;
}

function sanitizeSerpApiHttpError(status: number, safeDetail: string | null): {
  statusCategory: SerpApiStatusCategory;
  errorCode: SerpApiResolveErrorCode;
  message: string;
  retryable: boolean;
} {
  if (status === 400 || status === 422) {
    return {
      statusCategory: "validation_error",
      errorCode: "SERPAPI_BAD_REQUEST",
      message: withSafeProviderDetail("SerpApi bad request.", safeDetail),
      retryable: false,
    };
  }
  if (status === 402) {
    return {
      statusCategory: "rate_limited",
      errorCode: "SERPAPI_RATE_LIMITED",
      message: "SerpApi account has no remaining searches.",
      retryable: false,
    };
  }
  if (status === 401) {
    return {
      statusCategory: "invalid_key",
      errorCode: "SERPAPI_INVALID_KEY",
      message: "SerpApi key was rejected.",
      retryable: false,
    };
  }
  if (status === 403) {
    return {
      statusCategory: "forbidden",
      errorCode: "SERPAPI_FORBIDDEN",
      message: "SerpApi account does not have permission.",
      retryable: false,
    };
  }
  if (status === 429) {
    return {
      statusCategory: "rate_limited",
      errorCode: "SERPAPI_RATE_LIMITED",
      message: "SerpApi rate limit reached. Retry in a moment.",
      retryable: true,
    };
  }
  if (status >= 500) {
    return {
      statusCategory: "provider_error",
      errorCode: "SERPAPI_PROVIDER_ERROR",
      message: withSafeProviderDetail(
        "SerpApi provider request failed. Try again shortly.",
        safeDetail
      ),
      retryable: true,
    };
  }

  return {
    statusCategory: "provider_error",
    errorCode: "SERPAPI_REQUEST_FAILED",
    message: withSafeProviderDetail(`SerpApi request failed with HTTP ${status}.`, safeDetail),
    retryable: false,
  };
}

function classifySerpApiProviderErrorMessage(message: string): {
  statusCategory: SerpApiStatusCategory;
  errorCode: SerpApiResolveErrorCode;
  statusReason: string;
  retryable: boolean;
} {
  const lowered = message.toLowerCase();
  const safeDetail = sanitizeSerpApiErrorDetail(message);

  if (
    lowered.includes("api_key is required") ||
    lowered.includes("api key is required") ||
    lowered.includes("no api key") ||
    lowered.includes("missing api key")
  ) {
    return {
      statusCategory: "invalid_key",
      errorCode: "SERPAPI_INVALID_KEY",
      statusReason: "SerpApi key is missing or invalid.",
      retryable: false,
    };
  }

  if (lowered.includes("api key") || lowered.includes("unauthorized") || lowered.includes("authentication")) {
    return {
      statusCategory: "invalid_key",
      errorCode: "SERPAPI_INVALID_KEY",
      statusReason: "SerpApi key was rejected.",
      retryable: false,
    };
  }
  if (
    lowered.includes("forbidden") ||
    lowered.includes("permission") ||
    lowered.includes("not allowed") ||
    lowered.includes("account deleted") ||
    lowered.includes("plan") ||
    lowered.includes("upgrade")
  ) {
    return {
      statusCategory: "forbidden",
      errorCode: "SERPAPI_FORBIDDEN",
      statusReason: "SerpApi account does not include Walmart API access.",
      retryable: false,
    };
  }
  if (
    lowered.includes("rate") ||
    lowered.includes("too many") ||
    lowered.includes("out of searches") ||
    lowered.includes("no searches") ||
    lowered.includes("insufficient credits") ||
    lowered.includes("quota")
  ) {
    return {
      statusCategory: "rate_limited",
      errorCode: "SERPAPI_RATE_LIMITED",
      statusReason: "SerpApi account has no remaining searches.",
      retryable: false,
    };
  }

  if (
    lowered.includes("product has not found") ||
    lowered.includes("product not found") ||
    lowered.includes("no product found")
  ) {
    return {
      statusCategory: "not_found",
      errorCode: "SERPAPI_NOT_FOUND",
      statusReason: withSafeProviderDetail(
        "No public Walmart listing images were found for this product ID.",
        safeDetail
      ),
      retryable: false,
    };
  }

  if (lowered.includes("parameter") || lowered.includes("missing") || lowered.includes("invalid")) {
    return {
      statusCategory: "validation_error",
      errorCode: "SERPAPI_BAD_REQUEST",
      statusReason: withSafeProviderDetail("SerpApi bad request.", safeDetail),
      retryable: false,
    };
  }

  if (
    lowered.includes("unable to process") ||
    lowered.includes("product_id is required") ||
    lowered.includes("engine is required") ||
    lowered.includes("unsupported engine") ||
    lowered.includes("not supported")
  ) {
    return {
      statusCategory: "validation_error",
      errorCode: "SERPAPI_BAD_REQUEST",
      statusReason: withSafeProviderDetail("SerpApi bad request.", safeDetail),
      retryable: false,
    };
  }

  if (
    lowered.includes("econnreset") ||
    lowered.includes("etimedout") ||
    lowered.includes("timeout while") ||
    lowered.includes("connection reset")
  ) {
    return {
      statusCategory: "network_error",
      errorCode: "SERPAPI_NETWORK_ERROR",
      statusReason: withSafeProviderDetail("SerpApi request failed due to a network error.", safeDetail),
      retryable: false,
    };
  }

  if (
    lowered.includes("timeout") ||
    lowered.includes("temporarily unavailable") ||
    lowered.includes("try again later") ||
    lowered.includes("internal error") ||
    lowered.includes("server error")
  ) {
    return {
      statusCategory: "provider_error",
      errorCode: "SERPAPI_PROVIDER_ERROR",
      statusReason: withSafeProviderDetail(
        "SerpApi provider is temporarily unavailable. Retry in a moment.",
        safeDetail
      ),
      retryable: true,
    };
  }

  if (lowered.includes("invalid json") || lowered.includes("malformed")) {
    return {
      statusCategory: "malformed_response",
      errorCode: "SERPAPI_MALFORMED_RESPONSE",
      statusReason: withSafeProviderDetail("SerpApi returned a malformed response.", safeDetail),
      retryable: false,
    };
  }

  return {
    statusCategory: "provider_error",
    errorCode: "SERPAPI_PROVIDER_ERROR",
    statusReason: withSafeProviderDetail("SerpApi returned a provider error.", safeDetail),
    retryable: false,
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchSerpApiJson(params: {
  apiKey: string;
  endpointFamily: SerpApiEndpointFamily;
  productId?: string;
  query?: string;
  page?: number;
  walmartDomain?: string;
  device?: string;
}): Promise<{
  ok: boolean;
  statusCategory: SerpApiStatusCategory;
  payload: unknown;
  errorCode?: SerpApiResolveErrorCode;
  statusReason?: string;
}> {
  const url = new URL(SERPAPI_ENDPOINT);
  url.searchParams.set("api_key", params.apiKey);
  if (params.endpointFamily === "walmart_product") {
    url.searchParams.set("engine", "walmart_product");
    url.searchParams.set("product_id", params.productId ?? "");
    url.searchParams.set("walmart_domain", "walmart.com");
  } else {
    url.searchParams.set("engine", "walmart");
    url.searchParams.set("query", params.query ?? "");
    url.searchParams.set("walmart_domain", params.walmartDomain ?? "walmart.com");
    url.searchParams.set("device", params.device ?? "desktop");
    if (typeof params.page === "number" && Number.isFinite(params.page) && params.page > 0) {
      url.searchParams.set("page", String(Math.trunc(params.page)));
    }
  }

  for (let attempt = 0; attempt <= SERPAPI_RETRY_BACKOFF_MS.length; attempt += 1) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), SERPAPI_REQUEST_TIMEOUT_MS);
      const response = await fetch(url.toString(), {
        method: "GET",
        cache: "no-store",
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout));

      const responseText = await response.text();
      let payload: unknown = {};
      let payloadParseFailed = false;
      if (responseText.trim()) {
        try {
          payload = JSON.parse(responseText) as unknown;
        } catch {
          payloadParseFailed = true;
          payload = {};
        }
      }

      if (!response.ok) {
        const safeProviderDetail =
          extractSerpApiErrorDetail(payload, { includeGenericMessage: true }) ??
          sanitizeSerpApiErrorDetail(responseText);
        const mapped = sanitizeSerpApiHttpError(response.status, safeProviderDetail);
        if (mapped.retryable && attempt < SERPAPI_RETRY_BACKOFF_MS.length) {
          await sleep(SERPAPI_RETRY_BACKOFF_MS[attempt]);
          continue;
        }
        return {
          ok: false,
          payload,
          statusCategory: mapped.statusCategory,
          errorCode: mapped.errorCode,
          statusReason: mapped.message,
        };
      }

      if (payloadParseFailed) {
        return {
          ok: false,
          payload: {},
          statusCategory: "malformed_response",
          errorCode: "SERPAPI_MALFORMED_RESPONSE",
          statusReason: "SerpApi returned a malformed response.",
        };
      }

      const payloadObject = asObject(payload);
      const providerError =
        asString(payloadObject?.error) || extractSerpApiErrorDetail(payloadObject ?? {}, { includeGenericMessage: false }) || "";
      if (providerError) {
        const classified = classifySerpApiProviderErrorMessage(providerError);
        if (classified.retryable && attempt < SERPAPI_RETRY_BACKOFF_MS.length) {
          await sleep(SERPAPI_RETRY_BACKOFF_MS[attempt]);
          continue;
        }
        return {
          ok: false,
          payload,
          statusCategory: classified.statusCategory,
          errorCode: classified.errorCode,
          statusReason: classified.statusReason,
        };
      }

      return {
        ok: true,
        payload,
        statusCategory: "ok",
      };
    } catch (error) {
      const isTimeout = isAbortError(error);
      const safeDetail =
        sanitizeSerpApiErrorDetail(error instanceof Error ? error.message : String(error)) ?? null;
      if (attempt < SERPAPI_RETRY_BACKOFF_MS.length) {
        await sleep(SERPAPI_RETRY_BACKOFF_MS[attempt]);
        continue;
      }
      return {
        ok: false,
        payload: {},
        statusCategory: "network_error",
        errorCode: "SERPAPI_NETWORK_ERROR",
        statusReason: isTimeout
          ? withSafeProviderDetail("SerpApi request timed out. Retry in a moment.", safeDetail)
          : withSafeProviderDetail("SerpApi request failed due to a network error.", safeDetail),
      };
    }
  }

  return {
    ok: false,
    payload: {},
    statusCategory: "network_error",
    errorCode: "SERPAPI_NETWORK_ERROR",
    statusReason: "SerpApi request failed due to a network error.",
  };
}

function extractSerpApiSearchCandidates(payload: unknown): WalmartSearchCandidate[] {
  const root = asObject(payload) ?? {};
  const inlineShoppingResults = asObject(root.inline_shopping_results);
  const shoppingResults = asObject(root.shopping_results);
  const candidateSources = [
    root.organic_results,
    root.search_results,
    root.items,
    root.products,
    inlineShoppingResults?.items,
    inlineShoppingResults?.results,
    root.inline_shopping_results,
    shoppingResults?.items,
    shoppingResults?.results,
    root.shopping_results,
    asObject(root.pagination)?.items,
  ];

  const rows = candidateSources
    .flatMap((candidate) => asObjectArray(candidate))
    .filter((candidate, index, all) => {
      const candidateProduct = asObject(candidate.product);
      const id = firstNonEmptyString(
        candidate.product_id,
        candidate.productId,
        candidate.item_id,
        candidate.us_item_id,
        candidate.offer_id,
        candidate.id,
        candidateProduct?.product_id,
        candidateProduct?.productId,
        candidateProduct?.item_id,
        candidateProduct?.us_item_id,
        candidateProduct?.offer_id,
        candidateProduct?.id
      );
      if (!id) return false;
      const normalized = normalizeWalmartPublicProductId(id);
      if (!normalized) return false;
      return all.findIndex((entry) => {
        const entryProduct = asObject(entry.product);
        const entryId = normalizeWalmartPublicProductId(
          firstNonEmptyString(
            entry.product_id,
            entry.productId,
            entry.item_id,
            entry.us_item_id,
            entry.offer_id,
            entry.id,
            entryProduct?.product_id,
            entryProduct?.productId,
            entryProduct?.item_id,
            entryProduct?.us_item_id,
            entryProduct?.offer_id,
            entryProduct?.id
          )
        );
        return entryId === normalized;
      }) === index;
    });

  return rows.map((row) => {
    const rowProduct = asObject(row.product);
    const productId = normalizeWalmartPublicProductId(
      firstNonEmptyString(
        row.product_id,
        row.productId,
        row.item_id,
        row.us_item_id,
        row.offer_id,
        row.id,
        rowProduct?.product_id,
        rowProduct?.productId,
        rowProduct?.item_id,
        rowProduct?.us_item_id,
        rowProduct?.offer_id,
        rowProduct?.id
      )
    );
    const title = firstNonEmptyString(
      row.title,
      row.name,
      asObject(row.product_result)?.title,
      rowProduct?.title,
      rowProduct?.name
    );
    const brand = firstNonEmptyString(
      row.brand,
      row.brand_name,
      asObject(row.product_result)?.brand,
      rowProduct?.brand
    );
    const upc = firstNonEmptyString(row.upc, asObject(row.identifiers)?.upc, rowProduct?.upc);
    const gtin = firstNonEmptyString(row.gtin, asObject(row.identifiers)?.gtin, rowProduct?.gtin);

    const normalizedImages = normalizeSerpApiWalmartImages(row);

    return {
      productId,
      title,
      brand,
      upc,
      gtin,
      primaryImageUrl: normalizedImages.primaryImageUrl,
      galleryImageUrls: normalizedImages.galleryImageUrls,
      variantImageUrls: normalizedImages.variantImageUrls,
      raw: row,
    };
  });
}

function normalizeSerpApiSearchProductId(value: unknown): string {
  const candidate = asString(value);
  if (!candidate) return "";
  const normalized = candidate.replace(/[^0-9a-z_-]/gi, "");
  return normalized.length >= 3 ? normalized : "";
}

function extractSerpApiBrandSearchListings(
  payload: unknown,
  context: { sourceQuery: string; page: number }
): SerpApiWalmartBrandSearchListing[] {
  const root = asObject(payload) ?? {};
  const featuredItem = asObject(root.featured_item);
  const organicResults = asObjectArray(root.organic_results);
  const rows: Array<{ row: Record<string, unknown>; rank: number }> = [];

  if (featuredItem) {
    rows.push({ row: featuredItem, rank: 0 });
  }
  organicResults.forEach((row, index) => {
    rows.push({ row, rank: index + 1 });
  });

  const uniqueListings = new Map<string, SerpApiWalmartBrandSearchListing>();

  for (const { row, rank } of rows) {
    const rowProduct = asObject(row.product);
    const primaryOffer = asObject(row.primary_offer);
    const identifierNode = asObject(row.identifiers);
    const title = firstNonEmptyString(row.title, row.name, rowProduct?.title, rowProduct?.name);

    const usItemIdRaw = firstNonEmptyString(
      row.us_item_id,
      row.usItemId,
      row.item_id,
      row.itemId,
      rowProduct?.us_item_id,
      rowProduct?.usItemId,
      rowProduct?.item_id,
      rowProduct?.itemId,
      primaryOffer?.us_item_id,
      primaryOffer?.item_id
    );
    const usItemId = normalizeWalmartPublicProductId(usItemIdRaw);
    const productId = normalizeSerpApiSearchProductId(
      firstNonEmptyString(
        row.product_id,
        row.productId,
        rowProduct?.product_id,
        rowProduct?.productId,
        primaryOffer?.product_id
      )
    );
    const rawProductPageUrl = sanitizePublicWalmartUrl(
      firstNonEmptyString(
        row.product_page_url,
        row.productPageUrl,
        row.product_url,
        row.productUrl,
        row.link,
        row.url,
        rowProduct?.product_page_url,
        rowProduct?.productPageUrl,
        rowProduct?.product_url,
        rowProduct?.productUrl
      )
    );
    const extractedIdFromUrl = rawProductPageUrl
      ? extractWalmartPublicProductIdFromUrl(rawProductPageUrl) ?? ""
      : "";
    const resolvedUsItemId = usItemId || extractedIdFromUrl;
    const productPageUrl =
      rawProductPageUrl || (resolvedUsItemId ? derivePublicWalmartUrl(resolvedUsItemId) : "");

    if (!resolvedUsItemId && !productId && !productPageUrl) {
      continue;
    }

    const thumbnail = normalizeImageUrl(
      firstNonEmptyString(
        row.thumbnail,
        row.image,
        row.image_url,
        row.imageUrl,
        row.primary_image,
        row.primaryImage,
        rowProduct?.thumbnail,
        rowProduct?.image,
        rowProduct?.image_url,
        rowProduct?.imageUrl
      )
    );

    const listing: SerpApiWalmartBrandSearchListing = {
      sourceQuery: context.sourceQuery,
      page: context.page,
      rank,
      title,
      thumbnail,
      productPageUrl,
      usItemId: resolvedUsItemId,
      productId,
      upc: normalizeIdentifier(
        firstNonEmptyString(
          row.upc,
          row.gtin,
          identifierNode?.upc,
          identifierNode?.gtin,
          rowProduct?.upc,
          rowProduct?.gtin
        )
      ),
      sellerId: firstNonEmptyString(
        row.seller_id,
        row.sellerId,
        primaryOffer?.seller_id,
        primaryOffer?.sellerId
      ),
      sellerName: firstNonEmptyString(
        row.seller_name,
        row.sellerName,
        primaryOffer?.seller_name,
        primaryOffer?.sellerName
      ),
      brand: firstNonEmptyString(row.brand, row.brand_name, rowProduct?.brand, rowProduct?.brand_name),
      manufacturer: firstNonEmptyString(
        row.manufacturer,
        row.manufacturer_name,
        rowProduct?.manufacturer,
        rowProduct?.manufacturer_name
      ),
      raw: row,
    };

    const key = listing.usItemId || listing.productId || listing.productPageUrl;
    if (!key || uniqueListings.has(key)) continue;
    uniqueListings.set(key, listing);
  }

  return Array.from(uniqueListings.values());
}

function normalizeMatchText(value: string): string {
  return asString(value)
    .toLowerCase()
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeMatchText(value: string): string[] {
  return normalizeMatchText(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 1);
}

function listingLikelyMatchesBrandQuery(
  listing: SerpApiWalmartBrandSearchListing,
  queryTokens: string[]
): boolean {
  if (queryTokens.length === 0) return true;
  const haystack = normalizeMatchText(
    `${listing.title} ${listing.brand} ${listing.manufacturer} ${listing.sellerName}`
  );
  const matches = queryTokens.filter((token) => haystack.includes(token));
  if (queryTokens.includes("opa")) {
    return matches.includes("opa");
  }
  return matches.length >= Math.min(2, queryTokens.length);
}

export async function harvestWalmartBrandSearchListingsViaSerpApi(input: {
  apiKey: string;
  query: string;
  maxPages?: number;
  maxResults?: number;
}): Promise<SerpApiWalmartBrandSearchHarvestResult> {
  const query = asString(input.query);
  if (!query) {
    return {
      ok: false,
      statusCategory: "validation_error",
      errorCode: "SERPAPI_BAD_REQUEST",
      statusReason: "Brand search query is required.",
      query: "",
      pagesFetched: 0,
      resultsHarvested: 0,
      listings: [],
    };
  }

  const maxPages = Math.max(1, Math.min(6, input.maxPages ?? 3));
  const maxResults = Math.max(1, Math.min(300, input.maxResults ?? 120));
  const queryTokens = tokenizeMatchText(query).filter((token) => token.length > 2);
  const collected = new Map<string, SerpApiWalmartBrandSearchListing>();
  let pagesFetched = 0;

  for (let page = 1; page <= maxPages && collected.size < maxResults; page += 1) {
    const response = await fetchSerpApiJson({
      apiKey: input.apiKey,
      endpointFamily: "walmart_search",
      query,
      page,
      walmartDomain: "walmart.com",
      device: "desktop",
    });

    if (!response.ok) {
      return {
        ok: false,
        statusCategory: response.statusCategory,
        errorCode: response.errorCode,
        statusReason: response.statusReason ?? "SerpApi brand search failed.",
        query,
        pagesFetched,
        resultsHarvested: collected.size,
        listings: Array.from(collected.values()),
      };
    }

    const pageListings = extractSerpApiBrandSearchListings(response.payload, {
      sourceQuery: query,
      page,
    });
    pagesFetched = page;
    if (pageListings.length === 0) break;

    for (const listing of pageListings) {
      if (collected.size >= maxResults) break;
      const key = listing.usItemId || listing.productId || listing.productPageUrl;
      if (!key || collected.has(key)) continue;
      collected.set(key, listing);
    }

    const hasPlausibleListings = pageListings.some((listing) =>
      listingLikelyMatchesBrandQuery(listing, queryTokens)
    );
    if (page > 1 && !hasPlausibleListings) {
      break;
    }
  }

  const listings = Array.from(collected.values());
  return {
    ok: true,
    statusCategory: listings.length > 0 ? "ok" : "not_found",
    statusReason:
      listings.length > 0
        ? `Harvested ${listings.length} brand-search public listing candidate(s).`
        : "No brand-search public listing candidates found.",
    query,
    pagesFetched,
    resultsHarvested: listings.length,
    listings,
  };
}

function normalizeCandidateScore(candidate: WalmartSearchCandidate, product: WalmartProductRecord): {
  score: number;
  titleCoverage: number;
  titleJaccard: number;
  brandEquivalent: boolean;
} {
  const leftTokens = tokenizeText(product.title);
  const rightTokens = tokenizeText(candidate.title);
  const overlap = leftTokens.filter((token) => rightTokens.includes(token));

  const titleCoverage = leftTokens.length > 0 ? overlap.length / leftTokens.length : 0;
  const unionCount = new Set([...leftTokens, ...rightTokens]).size;
  const titleJaccard = unionCount > 0 ? overlap.length / unionCount : 0;

  const brandEquivalent = isLikelyBrandEquivalent(product.brand, candidate.brand);

  let score = 0;
  score += Math.round(titleCoverage * 70 + titleJaccard * 30);
  if (brandEquivalent) score += 35;
  if (candidate.primaryImageUrl || candidate.galleryImageUrls.length > 0) {
    score += 20;
  }

  return {
    score,
    titleCoverage,
    titleJaccard,
    brandEquivalent,
  };
}

function tokenizeText(value: string): string[] {
  return asString(value)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1);
}

const BRAND_SEARCH_TITLE_NOISE_TOKENS = new Set([
  "supplement",
  "supplements",
  "capsule",
  "capsules",
  "tablet",
  "tablets",
  "gummy",
  "gummies",
  "daily",
  "wellness",
  "support",
  "count",
  "ct",
]);
const BRAND_SEARCH_PRODUCT_SIGNAL_TOKENS = new Set([
  "magnesium",
  "glycinate",
  "sleep",
  "joint",
  "flex",
  "turmeric",
  "rhino",
  "prostate",
  "inositol",
  "berberine",
  "coffee",
  "green",
  "cortisol",
  "focus",
]);

function isBrandSearchNoiseToken(token: string): boolean {
  if (BRAND_SEARCH_TITLE_NOISE_TOKENS.has(token)) return true;
  if (/^\d+(ct|count)$/i.test(token)) return true;
  if (/^\d+$/.test(token)) return true;
  return false;
}

function titleTokensForBrandSearchMatching(value: string): string[] {
  return tokenizeMatchText(value).filter((token) => !isBrandSearchNoiseToken(token));
}

function brandSearchCompositeText(listing: SerpApiWalmartBrandSearchListing): string {
  return normalizeMatchText(
    `${listing.title} ${listing.brand} ${listing.manufacturer} ${listing.sellerName}`
  );
}

function scoreBrandSearchListingMatch(input: {
  product: WalmartProductRecord;
  listing: SerpApiWalmartBrandSearchListing;
  sourceQuery: string;
}): {
  score: number;
  confidence: "high" | "medium" | "low";
  titleCoverage: number;
  titleJaccard: number;
  keyTokenOverlap: number;
  exactTitle: boolean;
} {
  const productTokens = titleTokensForBrandSearchMatching(input.product.title);
  const listingTokens = titleTokensForBrandSearchMatching(input.listing.title);
  const listingTokenSet = new Set(listingTokens);
  const overlapTokens = Array.from(new Set(productTokens.filter((token) => listingTokenSet.has(token))));
  const titleCoverage = productTokens.length > 0 ? overlapTokens.length / productTokens.length : 0;
  const unionCount = new Set([...productTokens, ...listingTokens]).size;
  const titleJaccard = unionCount > 0 ? overlapTokens.length / unionCount : 0;
  const keyTokenOverlap = overlapTokens.filter((token) =>
    BRAND_SEARCH_PRODUCT_SIGNAL_TOKENS.has(token)
  ).length;
  const exactTitle = normalizeMatchText(input.product.title) === normalizeMatchText(input.listing.title);

  const listingComposite = brandSearchCompositeText(input.listing);
  const productBrandTokens = tokenizeBrand(input.product.brand);
  const queryBrandTokens = tokenizeBrand(input.sourceQuery);
  const requiredBrandTokens = new Set([...productBrandTokens, ...queryBrandTokens]);
  const requiresOpaSignal = requiredBrandTokens.has("opa");
  const hasOpaSignal = listingComposite.includes("opa");
  const brandTokenOverlap = Array.from(requiredBrandTokens.values()).filter((token) =>
    listingComposite.includes(token)
  ).length;
  const brandSignal = requiresOpaSignal ? hasOpaSignal : brandTokenOverlap > 0;
  const sellerSignal = normalizeMatchText(input.listing.sellerName).includes("opa");

  const productBarcode = normalizeIdentifier(
    firstNonEmptyString(input.product.upc, input.product.gtin)
  );
  const listingBarcode = normalizeIdentifier(input.listing.upc);
  const upcMatch = Boolean(productBarcode && listingBarcode && productBarcode === listingBarcode);

  let score = Math.round(titleCoverage * 70 + titleJaccard * 20);
  if (exactTitle) score += 30;
  if (brandSignal) score += 18;
  if (sellerSignal) score += 8;
  if (upcMatch) score += 24;
  if (keyTokenOverlap > 0) score += Math.min(14, keyTokenOverlap * 5);
  if (input.listing.thumbnail) score += 4;

  let confidence: "high" | "medium" | "low" = "low";
  if (
    (exactTitle && brandSignal) ||
    (upcMatch && brandSignal && titleCoverage >= 0.55) ||
    (brandSignal && titleCoverage >= 0.74 && keyTokenOverlap >= 2 && score >= 78)
  ) {
    confidence = "high";
  } else if (
    brandSignal &&
    titleCoverage >= 0.58 &&
    (keyTokenOverlap >= 1 || exactTitle || titleJaccard >= 0.45)
  ) {
    confidence = "medium";
  }

  return {
    score,
    confidence,
    titleCoverage,
    titleJaccard,
    keyTokenOverlap,
    exactTitle,
  };
}

export function matchImportedWalmartProductToBrandSearchListings(input: {
  product: WalmartProductRecord;
  listings: SerpApiWalmartBrandSearchListing[];
  sourceQuery: string;
}): SerpApiWalmartBrandSearchMatchResult {
  const listings = Array.isArray(input.listings) ? input.listings : [];
  if (listings.length === 0) {
    return {
      status: "no_confident_match",
      confidence: "low",
      score: 0,
      matchedListing: null,
      runnerUpListing: null,
      runnerUpScore: 0,
      titleCoverage: 0,
      titleJaccard: 0,
      keyTokenOverlap: 0,
      exactTitle: false,
    };
  }

  const scored = listings
    .map((listing) => {
      const score = scoreBrandSearchListingMatch({
        product: input.product,
        listing,
        sourceQuery: input.sourceQuery,
      });
      return {
        listing,
        ...score,
      };
    })
    .filter((entry) => entry.confidence !== "low" || entry.exactTitle)
    .sort((left, right) => right.score - left.score);

  if (scored.length === 0) {
    return {
      status: "no_confident_match",
      confidence: "low",
      score: 0,
      matchedListing: null,
      runnerUpListing: null,
      runnerUpScore: 0,
      titleCoverage: 0,
      titleJaccard: 0,
      keyTokenOverlap: 0,
      exactTitle: false,
    };
  }

  const top = scored[0]!;
  const runnerUp = scored[1] ?? null;

  if (top.confidence !== "high") {
    return {
      status: "no_confident_match",
      confidence: top.confidence,
      score: top.score,
      matchedListing: null,
      runnerUpListing: runnerUp?.listing ?? null,
      runnerUpScore: runnerUp?.score ?? 0,
      titleCoverage: top.titleCoverage,
      titleJaccard: top.titleJaccard,
      keyTokenOverlap: top.keyTokenOverlap,
      exactTitle: top.exactTitle,
    };
  }

  if (runnerUp) {
    const delta = top.score - runnerUp.score;
    const highAmbiguous = runnerUp.confidence === "high" && delta < 10;
    const mediumAmbiguous =
      runnerUp.confidence === "medium" && delta < 6 && runnerUp.titleCoverage >= 0.68;
    if (highAmbiguous || mediumAmbiguous) {
      return {
        status: "ambiguous",
        confidence: top.confidence,
        score: top.score,
        matchedListing: top.listing,
        runnerUpListing: runnerUp.listing,
        runnerUpScore: runnerUp.score,
        titleCoverage: top.titleCoverage,
        titleJaccard: top.titleJaccard,
        keyTokenOverlap: top.keyTokenOverlap,
        exactTitle: top.exactTitle,
      };
    }
  }

  return {
    status: "matched",
    confidence: "high",
    score: top.score,
    matchedListing: top.listing,
    runnerUpListing: runnerUp?.listing ?? null,
    runnerUpScore: runnerUp?.score ?? 0,
    titleCoverage: top.titleCoverage,
    titleJaccard: top.titleJaccard,
    keyTokenOverlap: top.keyTokenOverlap,
    exactTitle: top.exactTitle,
  };
}

const BRAND_STOPWORDS = new Set(["inc", "llc", "co", "company", "corp", "corporation", "ltd", "the"]);

function tokenizeBrand(value: string): string[] {
  return tokenizeText(value).filter((token) => !BRAND_STOPWORDS.has(token));
}

function isLikelyBrandEquivalent(left: string, right: string): boolean {
  const leftNormalized = asString(left).toLowerCase();
  const rightNormalized = asString(right).toLowerCase();
  if (!leftNormalized || !rightNormalized) return false;
  if (leftNormalized === rightNormalized) return true;

  const leftTokens = new Set(tokenizeBrand(leftNormalized));
  const rightTokens = new Set(tokenizeBrand(rightNormalized));
  if (leftTokens.size === 0 || rightTokens.size === 0) return false;

  const overlap = Array.from(leftTokens.values()).filter((token) => rightTokens.has(token)).length;
  const ratio = overlap / Math.max(leftTokens.size, rightTokens.size);
  return ratio >= 0.7;
}

function asFoundResolution(input: {
  statusReason: string;
  matchMethod: WalmartImageMatchMethod;
  publicWalmartUrl: string;
  publicWalmartProductId: string;
  primaryImageUrl: string;
  galleryImageUrls: string[];
  variantImageUrls: string[];
  diagnostics: SerpApiRequestDiagnostics;
}): WalmartPublicListingImageResolution {
  return {
    imageSyncStatus: "found",
    imageSource: "public_walmart_listing_serpapi",
    statusReason: input.statusReason,
    imageMatchMethod: input.matchMethod,
    publicWalmartUrl: input.publicWalmartUrl,
    publicWalmartProductId: input.publicWalmartProductId,
    primaryImageUrl: input.primaryImageUrl,
    galleryImageUrls: input.galleryImageUrls,
    variantImageUrls: input.variantImageUrls,
    lastImageSyncedAt: new Date().toISOString(),
    diagnostics: input.diagnostics,
  };
}

function asFailureResolution(input: {
  imageSyncStatus: WalmartImageSyncStatus;
  statusReason: string;
  errorCode: SerpApiResolveErrorCode;
  matchMethod: WalmartImageMatchMethod | null;
  publicWalmartUrl: string;
  publicWalmartProductId: string;
  diagnostics: SerpApiRequestDiagnostics;
}): WalmartPublicListingImageResolution {
  return {
    imageSyncStatus: input.imageSyncStatus,
    imageSource: "public_walmart_listing_serpapi",
    statusReason: input.statusReason,
    imageMatchMethod: input.matchMethod,
    publicWalmartUrl: input.publicWalmartUrl,
    publicWalmartProductId: input.publicWalmartProductId,
    primaryImageUrl: "",
    galleryImageUrls: [],
    variantImageUrls: [],
    lastImageSyncedAt: new Date().toISOString(),
    diagnostics: input.diagnostics,
    errorCode: input.errorCode,
  };
}

export async function getSerpApiCredentialsForUser(userId: string): Promise<{
  connected: boolean;
  apiKey: string | null;
  status: "connected" | "not_connected";
  statusReason: string | null;
}> {
  const status = await getWalmartSerpApiConnectionStatusForUser(userId);
  if (!status.connected) {
    return {
      connected: false,
      apiKey: null,
      status: "not_connected",
      statusReason: "SerpApi key is missing.",
    };
  }

  const apiKey = await getWalmartSerpApiKeyForUser(userId);
  const connected = Boolean(apiKey?.trim());
  return {
    connected,
    apiKey: apiKey?.trim() || null,
    status: connected ? "connected" : "not_connected",
    statusReason: connected ? null : "SerpApi key is missing.",
  };
}

export async function fetchWalmartProductImagesViaSerpApi(input: {
  apiKey: string;
  productId: string;
}): Promise<SerpApiProductImageResult> {
  const productId = normalizeWalmartPublicProductId(input.productId);
  if (!productId) {
    return {
      ok: false,
      statusCategory: "validation_error",
      errorCode: "INVALID_PUBLIC_WALMART_PRODUCT_ID",
      statusReason: "Public Walmart product ID is invalid.",
      productId: "",
      productPageUrl: "",
      title: "",
      brand: "",
      primaryImageUrl: "",
      galleryImageUrls: [],
      variantImageUrls: [],
    };
  }

  const response = await fetchSerpApiJson({
    apiKey: input.apiKey,
    endpointFamily: "walmart_product",
    productId,
  });

  if (!response.ok) {
    return {
      ok: false,
      statusCategory: response.statusCategory,
      errorCode: response.errorCode,
      statusReason: response.statusReason ?? "SerpApi request failed.",
      productId,
      productPageUrl: "",
      title: "",
      brand: "",
      primaryImageUrl: "",
      galleryImageUrls: [],
      variantImageUrls: [],
    };
  }

  const payloadObject = asObject(response.payload) ?? {};
  const productResult = asObject(payloadObject.product_result);
  const productPageMetadata = resolveSerpApiProductPageMetadata({
    payload: payloadObject,
    fallbackProductId: productId,
  });
  const title = firstNonEmptyString(productResult?.title, payloadObject.title);
  const brand = firstNonEmptyString(productResult?.brand, payloadObject.brand);
  const normalized = normalizeSerpApiWalmartImages(response.payload);

  if (!normalized.primaryImageUrl && normalized.galleryImageUrls.length === 0) {
    return {
      ok: false,
      statusCategory: "not_found",
      errorCode: "SERPAPI_NO_IMAGES_FOUND",
      statusReason: "No public Walmart listing images were found for this product ID.",
      productId: productPageMetadata.resolvedProductId || productId,
      productPageUrl: productPageMetadata.publicWalmartUrl,
      title,
      brand,
      primaryImageUrl: "",
      galleryImageUrls: [],
      variantImageUrls: [],
    };
  }

  return {
    ok: true,
    statusCategory: "ok",
    statusReason: "Public Walmart listing images found via SerpApi.",
    productId: productPageMetadata.resolvedProductId || productId,
    productPageUrl: productPageMetadata.publicWalmartUrl,
    title,
    brand,
    primaryImageUrl: normalized.primaryImageUrl,
    galleryImageUrls: normalized.galleryImageUrls,
    variantImageUrls: normalized.variantImageUrls,
  };
}

export async function searchWalmartProductCandidatesViaSerpApi(input: {
  apiKey: string;
  query: string;
}): Promise<{
  ok: boolean;
  statusCategory: SerpApiStatusCategory;
  errorCode?: SerpApiResolveErrorCode;
  statusReason: string;
  candidates: WalmartSearchCandidate[];
}> {
  const query = asString(input.query);
  if (!query) {
    return {
      ok: false,
      statusCategory: "validation_error",
      errorCode: "SERPAPI_NOT_FOUND",
      statusReason: "Search query is required.",
      candidates: [],
    };
  }

  const response = await fetchSerpApiJson({
    apiKey: input.apiKey,
    endpointFamily: "walmart_search",
    query,
  });

  if (!response.ok) {
    return {
      ok: false,
      statusCategory: response.statusCategory,
      errorCode: response.errorCode,
      statusReason: response.statusReason ?? "SerpApi search failed.",
      candidates: [],
    };
  }

  const candidates = extractSerpApiSearchCandidates(response.payload).filter((candidate) => Boolean(candidate.productId));

  return {
    ok: true,
    statusCategory: candidates.length > 0 ? "ok" : "not_found",
    statusReason:
      candidates.length > 0
        ? `Found ${candidates.length} public Walmart listing candidate(s).`
        : "No public Walmart listing candidates found.",
    candidates,
  };
}

function productIdentifiersForSearch(product: WalmartProductRecord): {
  productId: string;
  productIdentifierType: SerpApiProductIdentifierType;
  upc: string;
  gtin: string;
  normalizedPublicWalmartUrl: string;
} {
  const resolved = resolveCanonicalWalmartIdentifierFromProductRecord({ product });
  return {
    productId: resolved.preferredWalmartProductId,
    productIdentifierType: resolved.preferredIdentifierType,
    upc: resolved.upc,
    gtin: resolved.gtin,
    normalizedPublicWalmartUrl: resolved.normalizedPublicWalmartUrl,
  };
}

function isBarcodeEquivalentProductId(input: {
  productId: string;
  upc: string;
  gtin: string;
}): boolean {
  const normalizedProductId = normalizeIdentifier(input.productId);
  if (!normalizedProductId) return false;
  return (
    (input.upc.length > 0 && normalizedProductId === input.upc) ||
    (input.gtin.length > 0 && normalizedProductId === input.gtin)
  );
}

function identifierTypeForBarcodeLike(value: string): SerpApiProductIdentifierType {
  return /^\d{12}$/.test(value) ? "upc_skipped_for_product_lookup" : "gtin_skipped_for_product_lookup";
}

function resolvePreferredProductIdentifierContext(input: {
  explicitProductId: string;
  requestedProductIdFromUrl: string | null;
  productRecord: ReturnType<typeof productIdentifiersForSearch>;
}): { productId: string; identifierType: SerpApiProductIdentifierType } {
  if (input.requestedProductIdFromUrl) {
    return {
      productId: input.requestedProductIdFromUrl,
      identifierType: "url_product_id",
    };
  }

  if (
    input.explicitProductId &&
    !isBarcodeEquivalentProductId({
      productId: input.explicitProductId,
      upc: input.productRecord.upc,
      gtin: input.productRecord.gtin,
    })
  ) {
    if (isLikelyGtinOrUpc(input.explicitProductId)) {
      return {
        productId: "",
        identifierType: identifierTypeForBarcodeLike(input.explicitProductId),
      };
    }
    return {
      productId: input.explicitProductId,
      identifierType: "explicit_product_id",
    };
  }

  if (
    input.explicitProductId &&
    isBarcodeEquivalentProductId({
      productId: input.explicitProductId,
      upc: input.productRecord.upc,
      gtin: input.productRecord.gtin,
    })
  ) {
    return {
      productId: "",
      identifierType:
        input.productRecord.upc &&
        normalizeIdentifier(input.explicitProductId) === input.productRecord.upc
          ? "upc_skipped_for_product_lookup"
          : "gtin_skipped_for_product_lookup",
    };
  }

  if (input.productRecord.productId) {
    if (
      input.productRecord.productIdentifierType === "explicit_product_id" &&
      isLikelyGtinOrUpc(input.productRecord.productId)
    ) {
      return {
        productId: "",
        identifierType: identifierTypeForBarcodeLike(input.productRecord.productId),
      };
    }
    return {
      productId: input.productRecord.productId,
      identifierType: input.productRecord.productIdentifierType,
    };
  }

  return {
    productId: "",
    identifierType: input.productRecord.productIdentifierType || "missing_product_identifier",
  };
}

function firstExactCandidateByProductId(input: {
  candidates: WalmartSearchCandidate[];
  productId: string;
}): WalmartSearchCandidate | null {
  const normalizedProductId = normalizeWalmartPublicProductId(input.productId);
  if (!normalizedProductId) return null;

  const exact = input.candidates.find(
    (candidate) =>
      normalizeWalmartPublicProductId(candidate.productId) === normalizedProductId &&
      Boolean(candidate.primaryImageUrl || candidate.galleryImageUrls.length)
  );

  return exact ?? null;
}

function isProductNotFoundProviderMessage(statusReason: string): boolean {
  const lowered = statusReason.toLowerCase();
  return (
    lowered.includes("product has not found") ||
    lowered.includes("product not found") ||
    lowered.includes("no product found")
  );
}

function firstMatchedCandidateByTitleBrand(candidates: WalmartSearchCandidate[], product: WalmartProductRecord): {
  status: "found" | "ambiguous" | "none";
  candidate: WalmartSearchCandidate | null;
  topCandidate: WalmartSearchCandidate | null;
  candidateCount: number;
} {
  const scored = candidates
    .map((candidate) => {
      const score = normalizeCandidateScore(candidate, product);
      return {
        candidate,
        ...score,
      };
    })
    .filter(
      (entry) =>
        entry.brandEquivalent &&
        entry.titleCoverage >= 0.55 &&
        entry.titleJaccard >= 0.3 &&
        Boolean(entry.candidate.primaryImageUrl || entry.candidate.galleryImageUrls.length)
    )
    .sort((left, right) => right.score - left.score);

  if (scored.length === 0) {
    return {
      status: "none",
      candidate: null,
      topCandidate: null,
      candidateCount: 0,
    };
  }

  if (scored.length === 1) {
    return {
      status: "found",
      candidate: scored[0]?.candidate ?? null,
      topCandidate: scored[0]?.candidate ?? null,
      candidateCount: scored.length,
    };
  }

  const top = scored[0];
  const runnerUp = scored[1];
  if (top && runnerUp && top.score >= 70 && top.score - runnerUp.score >= 12) {
    return {
      status: "found",
      candidate: top.candidate,
      topCandidate: top.candidate,
      candidateCount: scored.length,
    };
  }

  return {
    status: "ambiguous",
    candidate: null,
    topCandidate: top?.candidate ?? null,
    candidateCount: scored.length,
  };
}

export async function enrichProductImagesFromPublicWalmartListing(input: {
  userId: string;
  product: WalmartProductRecord;
  publicWalmartUrl?: string;
  publicWalmartProductId?: string;
  searchTitleBrandQuery?: string;
  skipProductLookup?: boolean;
}): Promise<WalmartPublicListingImageResolution> {
  const credentials = await getSerpApiCredentialsForUser(input.userId);

  const requestedUrl = sanitizePublicWalmartUrl(
    input.publicWalmartUrl ?? input.product.publicWalmartUrl
  );
  const requestedProductIdFromUrl = requestedUrl
    ? extractWalmartPublicProductIdFromUrl(requestedUrl)
    : null;
  const productIdentifiers = productIdentifiersForSearch(input.product);
  const effectiveRequestedUrl = requestedUrl || productIdentifiers.normalizedPublicWalmartUrl;

  if ((input.publicWalmartUrl ?? "").trim() && !requestedUrl) {
    return asFailureResolution({
      imageSyncStatus: "failed",
      errorCode: "INVALID_PUBLIC_WALMART_URL",
      statusReason: "Public Walmart listing URL is invalid. Use a valid walmart.com product URL.",
      matchMethod: null,
      publicWalmartUrl: "",
      publicWalmartProductId: "",
      diagnostics: {
        provider: "serpapi",
        endpointFamily: "walmart_product",
        statusCategory: "validation_error",
        productId: null,
        candidateCount: 0,
        imageCount: 0,
        matchMethod: null,
      },
    });
  }

  if (!credentials.connected || !credentials.apiKey) {
    return asFailureResolution({
      imageSyncStatus: "not_synced",
      errorCode: "SERPAPI_NOT_CONNECTED",
      statusReason: "SerpApi key missing. Connect SerpApi to enable automated public Walmart image enrichment.",
      matchMethod: null,
      publicWalmartUrl: effectiveRequestedUrl,
      publicWalmartProductId: requestedProductIdFromUrl ?? "",
      diagnostics: {
        provider: "serpapi",
        endpointFamily: "walmart_product",
        statusCategory: "not_configured",
        productId: requestedProductIdFromUrl,
        candidateCount: 0,
        imageCount: 0,
        matchMethod: null,
      },
    });
  }

  const explicitProductId = normalizeWalmartPublicProductId(input.publicWalmartProductId);
  const preferredProductIdentifier = resolvePreferredProductIdentifierContext({
    explicitProductId,
    requestedProductIdFromUrl,
    productRecord: productIdentifiers,
  });
  const preferredProductId = preferredProductIdentifier.productId;
  const identifierStrategyNote = `Identifier strategy: ${preferredProductIdentifier.identifierType}.`;

  if ((input.publicWalmartProductId ?? "").trim() && !explicitProductId) {
    return asFailureResolution({
      imageSyncStatus: "failed",
      errorCode: "INVALID_PUBLIC_WALMART_PRODUCT_ID",
      statusReason: "Public Walmart product ID is invalid.",
      matchMethod: null,
      publicWalmartUrl: effectiveRequestedUrl,
      publicWalmartProductId: "",
      diagnostics: {
        provider: "serpapi",
        endpointFamily: "walmart_product",
        statusCategory: "validation_error",
        productId: null,
        candidateCount: 0,
        imageCount: 0,
        matchMethod: null,
      },
    });
  }

  const canUseProductLookup =
    Boolean(preferredProductId) &&
    !Boolean(input.skipProductLookup) &&
    preferredProductIdentifier.identifierType !== "upc_skipped_for_product_lookup" &&
    preferredProductIdentifier.identifierType !== "gtin_skipped_for_product_lookup" &&
    preferredProductIdentifier.identifierType !== "search_title_brand" &&
    preferredProductIdentifier.identifierType !== "missing_product_identifier";

  if (canUseProductLookup) {
    const byProductId = await fetchWalmartProductImagesViaSerpApi({
      apiKey: credentials.apiKey,
      productId: preferredProductId,
    });

    const matchMethod: WalmartImageMatchMethod =
      preferredProductIdentifier.identifierType === "url_product_id"
        ? "public_url_product_id"
        : "serpapi_product_id";

    if (byProductId.ok) {
      return asFoundResolution({
        statusReason: byProductId.statusReason,
        matchMethod,
        publicWalmartUrl: byProductId.productPageUrl || effectiveRequestedUrl,
        publicWalmartProductId: byProductId.productId,
        primaryImageUrl: byProductId.primaryImageUrl,
        galleryImageUrls: byProductId.galleryImageUrls,
        variantImageUrls: byProductId.variantImageUrls,
        diagnostics: {
          provider: "serpapi",
          endpointFamily: "walmart_product",
          statusCategory: "ok",
          productId: byProductId.productId,
          productIdentifierType: preferredProductIdentifier.identifierType,
          productPageUrl: byProductId.productPageUrl || null,
          candidateCount: 1,
          imageCount: byProductId.galleryImageUrls.length,
          matchMethod,
        },
      });
    }

    if (isProductNotFoundProviderMessage(byProductId.statusReason)) {
      console.warn("[ecomviper:walmart:serpapi] walmart_product identifier not found", {
        sku: input.product.sku,
        identifierType: preferredProductIdentifier.identifierType,
        identifierValue: preferredProductId,
        endpointFamily: "walmart_product",
      });
    }

    if (
      byProductId.statusCategory === "invalid_key" ||
      byProductId.statusCategory === "forbidden" ||
      byProductId.statusCategory === "rate_limited" ||
      byProductId.statusCategory === "provider_error" ||
      byProductId.statusCategory === "network_error" ||
      byProductId.statusCategory === "malformed_response"
    ) {
      return asFailureResolution({
        imageSyncStatus: "failed",
        errorCode: byProductId.errorCode ?? "SERPAPI_PROVIDER_ERROR",
        statusReason: `${byProductId.statusReason} ${identifierStrategyNote}`,
        matchMethod,
        publicWalmartUrl: byProductId.productPageUrl || effectiveRequestedUrl,
        publicWalmartProductId: byProductId.productId || preferredProductId,
        diagnostics: {
          provider: "serpapi",
          endpointFamily: "walmart_product",
          statusCategory: byProductId.statusCategory,
          productId: byProductId.productId || preferredProductId,
          productIdentifierType: preferredProductIdentifier.identifierType,
          productPageUrl: byProductId.productPageUrl || null,
          candidateCount: 0,
          imageCount: 0,
          matchMethod,
        },
      });
    }

    const byProductIdSearch = await searchWalmartProductCandidatesViaSerpApi({
      apiKey: credentials.apiKey,
      query: preferredProductId,
    });

    if (byProductIdSearch.ok) {
      const exactCandidate = firstExactCandidateByProductId({
        candidates: byProductIdSearch.candidates,
        productId: preferredProductId,
      });
      if (exactCandidate) {
        return asFoundResolution({
          statusReason: "Public Walmart listing image found via SerpApi search fallback.",
          matchMethod:
            preferredProductIdentifier.identifierType === "url_product_id"
              ? "public_url_product_id"
              : "serpapi_product_id",
          publicWalmartUrl: effectiveRequestedUrl || derivePublicWalmartUrl(exactCandidate.productId),
          publicWalmartProductId: exactCandidate.productId,
          primaryImageUrl: exactCandidate.primaryImageUrl || exactCandidate.galleryImageUrls[0] || "",
          galleryImageUrls: dedupeImageUrls([
            exactCandidate.primaryImageUrl,
            ...exactCandidate.galleryImageUrls,
          ]),
          variantImageUrls: exactCandidate.variantImageUrls,
          diagnostics: {
            provider: "serpapi",
            endpointFamily: "walmart_search",
            statusCategory: "ok",
            productId: exactCandidate.productId,
            productIdentifierType: preferredProductIdentifier.identifierType,
            queryUsed: preferredProductId,
            candidateCount: byProductIdSearch.candidates.length,
            imageCount: exactCandidate.galleryImageUrls.length,
            matchMethod:
              preferredProductIdentifier.identifierType === "url_product_id"
                ? "public_url_product_id"
                : "serpapi_product_id",
            topCandidateTitle: exactCandidate.title || null,
            topCandidateProductId: exactCandidate.productId || null,
          },
        });
      }
    } else if (
      byProductIdSearch.statusCategory === "invalid_key" ||
      byProductIdSearch.statusCategory === "forbidden" ||
      byProductIdSearch.statusCategory === "rate_limited" ||
      byProductIdSearch.statusCategory === "provider_error" ||
      byProductIdSearch.statusCategory === "network_error" ||
      byProductIdSearch.statusCategory === "malformed_response"
    ) {
      return asFailureResolution({
        imageSyncStatus: "failed",
        errorCode: byProductIdSearch.errorCode ?? "SERPAPI_PROVIDER_ERROR",
        statusReason: `${byProductIdSearch.statusReason} ${identifierStrategyNote}`,
        matchMethod:
          preferredProductIdentifier.identifierType === "url_product_id"
            ? "public_url_product_id"
            : "serpapi_product_id",
        publicWalmartUrl: effectiveRequestedUrl,
        publicWalmartProductId: preferredProductId,
        diagnostics: {
          provider: "serpapi",
          endpointFamily: "walmart_search",
          statusCategory: byProductIdSearch.statusCategory,
          productId: preferredProductId,
          productIdentifierType: preferredProductIdentifier.identifierType,
          queryUsed: preferredProductId,
          candidateCount: 0,
          imageCount: 0,
          matchMethod:
            preferredProductIdentifier.identifierType === "url_product_id"
              ? "public_url_product_id"
              : "serpapi_product_id",
          topCandidateTitle: null,
          topCandidateProductId: null,
        },
      });
    }
  }

  const barcodeSkipIdentifierType =
    preferredProductIdentifier.identifierType === "upc_skipped_for_product_lookup" ||
    preferredProductIdentifier.identifierType === "gtin_skipped_for_product_lookup"
      ? preferredProductIdentifier.identifierType
      : null;
  const barcodeSkipReason = barcodeSkipIdentifierType
    ? `Identifier strategy: ${barcodeSkipIdentifierType}.`
    : null;

  const titleBrandQuery =
    asString(input.searchTitleBrandQuery) ||
    `${asString(input.product.brand)} ${asString(input.product.title)}`.trim();
  if (titleBrandQuery) {
    const titleSearch = await searchWalmartProductCandidatesViaSerpApi({
      apiKey: credentials.apiKey,
      query: titleBrandQuery,
    });
    const firstSearchCandidate = titleSearch.candidates[0] ?? null;

    if (!titleSearch.ok) {
      return asFailureResolution({
        imageSyncStatus:
          titleSearch.statusCategory === "invalid_key" ||
          titleSearch.statusCategory === "forbidden" ||
          titleSearch.statusCategory === "rate_limited" ||
          titleSearch.statusCategory === "provider_error" ||
          titleSearch.statusCategory === "network_error" ||
          titleSearch.statusCategory === "malformed_response" ||
          titleSearch.statusCategory === "validation_error"
            ? "failed"
            : "not_found",
        errorCode: titleSearch.errorCode ?? "SERPAPI_PROVIDER_ERROR",
        statusReason: barcodeSkipReason
          ? `${titleSearch.statusReason} ${barcodeSkipReason}`
          : `${titleSearch.statusReason} ${identifierStrategyNote}`,
        matchMethod: "serpapi_search_title_brand",
        publicWalmartUrl: effectiveRequestedUrl,
        publicWalmartProductId: preferredProductId ?? "",
        diagnostics: {
          provider: "serpapi",
          endpointFamily: "walmart_search",
          statusCategory: titleSearch.statusCategory,
          productId: preferredProductId ?? null,
          productIdentifierType: "search_title_brand",
          queryUsed: titleBrandQuery,
          candidateCount: 0,
          imageCount: 0,
          matchMethod: "serpapi_search_title_brand",
          topCandidateTitle: null,
          topCandidateProductId: null,
        },
      });
    }

    const titleBrandMatch = firstMatchedCandidateByTitleBrand(titleSearch.candidates, input.product);
    if (titleBrandMatch.status === "found" && titleBrandMatch.candidate) {
      const found = titleBrandMatch.candidate;
      return asFoundResolution({
        statusReason: barcodeSkipReason
          ? `Public Walmart listing images found via title+brand match through SerpApi. ${barcodeSkipReason}`
          : "Public Walmart listing images found via title+brand match through SerpApi.",
        matchMethod: "serpapi_search_title_brand",
        publicWalmartUrl: effectiveRequestedUrl,
        publicWalmartProductId: found.productId,
        primaryImageUrl: found.primaryImageUrl || found.galleryImageUrls[0] || "",
        galleryImageUrls: dedupeImageUrls([
          found.primaryImageUrl,
          ...found.galleryImageUrls,
        ]),
        variantImageUrls: found.variantImageUrls,
        diagnostics: {
          provider: "serpapi",
          endpointFamily: "walmart_search",
          statusCategory: "ok",
          productId: found.productId,
          productIdentifierType: "search_title_brand",
          queryUsed: titleBrandQuery,
          candidateCount: titleSearch.candidates.length,
          imageCount: found.galleryImageUrls.length,
          matchMethod: "serpapi_search_title_brand",
          topCandidateTitle: found.title || null,
          topCandidateProductId: found.productId || null,
        },
      });
    }

    if (titleBrandMatch.status === "ambiguous") {
      const topCandidate = titleBrandMatch.topCandidate ?? firstSearchCandidate;
      return asFailureResolution({
        imageSyncStatus: "ambiguous",
        errorCode: "SERPAPI_AMBIGUOUS_MATCH",
        statusReason: barcodeSkipReason
          ? `Multiple title+brand candidates were found. Add a direct public Walmart listing URL for a confident match. ${barcodeSkipReason}`
          : "Multiple title+brand candidates were found. Add a direct public Walmart listing URL for a confident match.",
        matchMethod: "serpapi_search_title_brand",
        publicWalmartUrl: effectiveRequestedUrl,
        publicWalmartProductId: preferredProductId ?? "",
        diagnostics: {
          provider: "serpapi",
          endpointFamily: "walmart_search",
          statusCategory: "ambiguous",
          productId: preferredProductId ?? null,
          productIdentifierType: "search_title_brand",
          queryUsed: titleBrandQuery,
          candidateCount: titleSearch.candidates.length,
          imageCount: 0,
          matchMethod: "serpapi_search_title_brand",
          topCandidateTitle: topCandidate?.title || null,
          topCandidateProductId: topCandidate?.productId || null,
        },
      });
    }
  }

  const hasSafeIdentifiers = Boolean(canUseProductLookup || titleBrandQuery);

  return asFailureResolution({
    imageSyncStatus: "not_found",
    errorCode: "SERPAPI_NOT_FOUND",
    statusReason: hasSafeIdentifiers
      ? `No public Walmart listing images were found for this product. ${identifierStrategyNote}`
      : `No safe Walmart product identifier is available for lookup. ${identifierStrategyNote}`,
    matchMethod:
      preferredProductIdentifier.identifierType === "url_product_id"
        ? "public_url_product_id"
        : preferredProductId
        ? "serpapi_product_id"
        : null,
    publicWalmartUrl: effectiveRequestedUrl,
    publicWalmartProductId: preferredProductId ?? "",
    diagnostics: {
      provider: "serpapi",
      endpointFamily: preferredProductId ? "walmart_product" : "walmart_search",
      statusCategory: "not_found",
      productId: preferredProductId ?? null,
      productIdentifierType: preferredProductIdentifier.identifierType,
      queryUsed: titleBrandQuery || null,
      candidateCount: 0,
      imageCount: 0,
      matchMethod:
        preferredProductIdentifier.identifierType === "url_product_id"
          ? "public_url_product_id"
          : preferredProductId
          ? "serpapi_product_id"
          : null,
      topCandidateTitle: null,
      topCandidateProductId: null,
    },
  });
}

export const serpApiWalmartImageInternals = {
  sanitizePublicWalmartUrl,
  normalizeWalmartPublicProductId,
  normalizeSerpApiWalmartImages,
  extractSerpApiSearchCandidates,
  extractSerpApiBrandSearchListings,
  sanitizeSerpApiErrorDetail,
  extractSerpApiErrorDetail,
  normalizeIdentifier,
  normalizeMatchText,
  firstMatchedCandidateByTitleBrand,
  matchImportedWalmartProductToBrandSearchListings,
  normalizeCandidateScore,
  tokenizeText,
  isLikelyBrandEquivalent,
};
