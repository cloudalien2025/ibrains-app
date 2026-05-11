import "server-only";

import {
  getWalmartSerpApiConnectionStatusForUser,
  getWalmartSerpApiKeyForUser,
} from "@/lib/ecomviper/walmart/walmart-serpapi-connection";
import {
  extractSerpApiErrorDetail,
  sanitizeSerpApiErrorDetail,
} from "@/lib/ecomviper/walmart/serpapi-safety";
import type {
  WalmartImageMatchMethod,
  WalmartImageSyncStatus,
  WalmartProductRecord,
} from "@/lib/ecomviper/walmart/walmart-types";

const SERPAPI_ENDPOINT = "https://serpapi.com/search.json";
const SERPAPI_REQUEST_TIMEOUT_MS = 16_000;
const SERPAPI_RETRY_BACKOFF_MS = [450, 1_200] as const;
const WALMART_HOST_SUFFIX = ".walmart.com";

type SerpApiEndpointFamily = "walmart_product" | "walmart_search";
type SerpApiProductIdentifierType =
  | "explicit_public_product_id"
  | "public_url_product_id"
  | "product_record_public_product_id"
  | "product_record_item_id"
  | "none";
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
  candidateCount: number;
  imageCount: number;
  matchMethod: WalmartImageMatchMethod | null;
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

interface SerpApiProductImageResult {
  ok: boolean;
  statusCategory: SerpApiStatusCategory;
  errorCode?: SerpApiResolveErrorCode;
  statusReason: string;
  productId: string;
  title: string;
  brand: string;
  primaryImageUrl: string;
  galleryImageUrls: string[];
  variantImageUrls: string[];
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
  const raw = asString(value);
  if (!raw) return "";

  try {
    const parsed = new URL(raw);
    const host = parsed.hostname.toLowerCase();
    if (!(host === "walmart.com" || host.endsWith(WALMART_HOST_SUFFIX))) {
      return "";
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return "";
    }

    parsed.protocol = "https:";
    return parsed.toString();
  } catch {
    return "";
  }
}

export function extractWalmartPublicProductIdFromUrl(url: string): string | null {
  const sanitized = sanitizePublicWalmartUrl(url);
  if (!sanitized) return null;

  try {
    const parsed = new URL(sanitized);
    const segments = parsed.pathname
      .split("/")
      .map((segment) => segment.trim())
      .filter(Boolean);

    const ipIndex = segments.findIndex((segment) => segment.toLowerCase() === "ip");
    if (ipIndex >= 0) {
      const trailing = segments.slice(ipIndex + 1);
      for (let index = trailing.length - 1; index >= 0; index -= 1) {
        const candidate = normalizeWalmartPublicProductId(trailing[index]);
        if (candidate) return candidate;
      }
    }

    for (let index = segments.length - 1; index >= 0; index -= 1) {
      const candidate = normalizeWalmartPublicProductId(segments[index]);
      if (candidate) return candidate;
    }

    return null;
  } catch {
    return null;
  }
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
  } else {
    url.searchParams.set("engine", "walmart");
    url.searchParams.set("query", params.query ?? "");
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
      title: "",
      brand: "",
      primaryImageUrl: "",
      galleryImageUrls: [],
      variantImageUrls: [],
    };
  }

  const payloadObject = asObject(response.payload) ?? {};
  const productResult = asObject(payloadObject.product_result);
  const title = firstNonEmptyString(productResult?.title, payloadObject.title);
  const brand = firstNonEmptyString(productResult?.brand, payloadObject.brand);
  const normalized = normalizeSerpApiWalmartImages(response.payload);

  if (!normalized.primaryImageUrl && normalized.galleryImageUrls.length === 0) {
    return {
      ok: false,
      statusCategory: "not_found",
      errorCode: "SERPAPI_NO_IMAGES_FOUND",
      statusReason: "No public Walmart listing images were found for this product ID.",
      productId,
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
    productId,
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
  upc: string;
  gtin: string;
} {
  const productId = normalizeWalmartPublicProductId(
    firstNonEmptyString(
      product.publicWalmartProductId,
      product.itemId,
      asObject(product.normalizedPayload)?.publicWalmartProductId,
      asObject(product.normalizedPayload)?.itemId,
      asObject(product.rawPayload)?.publicWalmartProductId,
      asObject(product.rawPayload)?.productId,
      asObject(product.rawPayload)?.itemId,
      asObject(product.rawPayload)?.usItemId
    )
  );

  return {
    productId,
    upc: normalizeIdentifier(firstNonEmptyString(product.upc)),
    gtin: normalizeIdentifier(firstNonEmptyString(product.gtin)),
  };
}

function resolvePreferredProductIdentifierContext(input: {
  explicitProductId: string;
  requestedProductIdFromUrl: string | null;
  productRecordProductId: string;
  product: WalmartProductRecord;
}): { productId: string; identifierType: SerpApiProductIdentifierType } {
  if (input.explicitProductId) {
    return {
      productId: input.explicitProductId,
      identifierType: "explicit_public_product_id",
    };
  }
  if (input.requestedProductIdFromUrl) {
    return {
      productId: input.requestedProductIdFromUrl,
      identifierType: "public_url_product_id",
    };
  }
  if (input.productRecordProductId) {
    if (normalizeWalmartPublicProductId(input.product.publicWalmartProductId)) {
      return {
        productId: input.productRecordProductId,
        identifierType: "product_record_public_product_id",
      };
    }
    return {
      productId: input.productRecordProductId,
      identifierType: "product_record_item_id",
    };
  }
  return {
    productId: "",
    identifierType: "none",
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

function firstMatchedCandidateByIdentifier(input: {
  candidates: WalmartSearchCandidate[];
  upc: string;
  gtin: string;
}): {
  status: "found" | "ambiguous" | "none";
  candidate: WalmartSearchCandidate | null;
} {
  const identifierMatches = input.candidates.filter((candidate) => {
    const candidateUpc = normalizeIdentifier(candidate.upc);
    const candidateGtin = normalizeIdentifier(candidate.gtin);

    if (input.upc && candidateUpc === input.upc) return true;
    if (input.gtin && candidateGtin === input.gtin) return true;
    return false;
  });

  const withImages = identifierMatches.filter(
    (candidate) => Boolean(candidate.primaryImageUrl || candidate.galleryImageUrls.length)
  );

  if (withImages.length === 1) {
    return {
      status: "found",
      candidate: withImages[0],
    };
  }

  if (withImages.length > 1) {
    return {
      status: "ambiguous",
      candidate: null,
    };
  }

  return {
    status: "none",
    candidate: null,
  };
}

function firstMatchedCandidateByTitleBrand(candidates: WalmartSearchCandidate[], product: WalmartProductRecord): {
  status: "found" | "ambiguous" | "none";
  candidate: WalmartSearchCandidate | null;
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
    };
  }

  if (scored.length === 1) {
    return {
      status: "found",
      candidate: scored[0]?.candidate ?? null,
    };
  }

  const top = scored[0];
  const runnerUp = scored[1];
  if (top && runnerUp && top.score >= 70 && top.score - runnerUp.score >= 12) {
    return {
      status: "found",
      candidate: top.candidate,
    };
  }

  return {
    status: "ambiguous",
    candidate: null,
  };
}

export async function enrichProductImagesFromPublicWalmartListing(input: {
  userId: string;
  product: WalmartProductRecord;
  publicWalmartUrl?: string;
  publicWalmartProductId?: string;
}): Promise<WalmartPublicListingImageResolution> {
  const credentials = await getSerpApiCredentialsForUser(input.userId);

  const requestedUrl = sanitizePublicWalmartUrl(
    input.publicWalmartUrl ?? input.product.publicWalmartUrl
  );
  const requestedProductIdFromUrl = requestedUrl
    ? extractWalmartPublicProductIdFromUrl(requestedUrl)
    : null;

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
      publicWalmartUrl: requestedUrl,
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

  const productIdentifiers = productIdentifiersForSearch(input.product);
  const explicitProductId = normalizeWalmartPublicProductId(input.publicWalmartProductId);
  const preferredProductIdentifier = resolvePreferredProductIdentifierContext({
    explicitProductId,
    requestedProductIdFromUrl,
    productRecordProductId: productIdentifiers.productId,
    product: input.product,
  });
  const preferredProductId = preferredProductIdentifier.productId;

  if ((input.publicWalmartProductId ?? "").trim() && !explicitProductId) {
    return asFailureResolution({
      imageSyncStatus: "failed",
      errorCode: "INVALID_PUBLIC_WALMART_PRODUCT_ID",
      statusReason: "Public Walmart product ID is invalid.",
      matchMethod: null,
      publicWalmartUrl: requestedUrl,
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

  if (preferredProductId) {
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
          statusReason: "Public Walmart listing images found via SerpApi search payload.",
          matchMethod: preferredProductIdentifier.identifierType === "public_url_product_id"
            ? "public_url_product_id"
            : "serpapi_product_id",
          publicWalmartUrl: requestedUrl,
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
            candidateCount: byProductIdSearch.candidates.length,
            imageCount: exactCandidate.galleryImageUrls.length,
            matchMethod:
              preferredProductIdentifier.identifierType === "public_url_product_id"
                ? "public_url_product_id"
                : "serpapi_product_id",
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
        statusReason: byProductIdSearch.statusReason,
        matchMethod:
          preferredProductIdentifier.identifierType === "public_url_product_id"
            ? "public_url_product_id"
            : "serpapi_product_id",
        publicWalmartUrl: requestedUrl,
        publicWalmartProductId: preferredProductId,
        diagnostics: {
          provider: "serpapi",
          endpointFamily: "walmart_search",
          statusCategory: byProductIdSearch.statusCategory,
          productId: preferredProductId,
          productIdentifierType: preferredProductIdentifier.identifierType,
          candidateCount: 0,
          imageCount: 0,
          matchMethod:
            preferredProductIdentifier.identifierType === "public_url_product_id"
              ? "public_url_product_id"
              : "serpapi_product_id",
        },
      });
    }

    const byProductId = await fetchWalmartProductImagesViaSerpApi({
      apiKey: credentials.apiKey,
      productId: preferredProductId,
    });

    const matchMethod: WalmartImageMatchMethod =
      preferredProductIdentifier.identifierType === "public_url_product_id"
        ? "public_url_product_id"
        : "serpapi_product_id";

    if (byProductId.ok) {
      return asFoundResolution({
        statusReason: byProductId.statusReason,
        matchMethod,
        publicWalmartUrl: requestedUrl,
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
        statusReason: byProductId.statusReason,
        matchMethod,
        publicWalmartUrl: requestedUrl,
        publicWalmartProductId: preferredProductId,
        diagnostics: {
          provider: "serpapi",
          endpointFamily: "walmart_product",
          statusCategory: byProductId.statusCategory,
          productId: preferredProductId,
          productIdentifierType: preferredProductIdentifier.identifierType,
          candidateCount: 0,
          imageCount: 0,
          matchMethod,
        },
      });
    }
  }

  if (productIdentifiers.upc || productIdentifiers.gtin) {
    const queryIdentifier = productIdentifiers.upc || productIdentifiers.gtin;
    const endpointMatchMethod: WalmartImageMatchMethod = productIdentifiers.upc
      ? "serpapi_search_upc"
      : "serpapi_search_gtin";

    const searchResponse = await searchWalmartProductCandidatesViaSerpApi({
      apiKey: credentials.apiKey,
      query: queryIdentifier,
    });

    if (!searchResponse.ok) {
      return asFailureResolution({
        imageSyncStatus:
          searchResponse.statusCategory === "invalid_key" ||
          searchResponse.statusCategory === "forbidden" ||
          searchResponse.statusCategory === "rate_limited" ||
          searchResponse.statusCategory === "provider_error" ||
          searchResponse.statusCategory === "network_error" ||
          searchResponse.statusCategory === "malformed_response" ||
          searchResponse.statusCategory === "validation_error"
            ? "failed"
            : "not_found",
        errorCode: searchResponse.errorCode ?? "SERPAPI_PROVIDER_ERROR",
        statusReason: searchResponse.statusReason,
        matchMethod: endpointMatchMethod,
        publicWalmartUrl: requestedUrl,
        publicWalmartProductId: preferredProductId ?? "",
        diagnostics: {
          provider: "serpapi",
          endpointFamily: "walmart_search",
          statusCategory: searchResponse.statusCategory,
          productId: preferredProductId ?? null,
          candidateCount: 0,
          imageCount: 0,
          matchMethod: endpointMatchMethod,
        },
      });
    }

    const identifierMatch = firstMatchedCandidateByIdentifier({
      candidates: searchResponse.candidates,
      upc: productIdentifiers.upc,
      gtin: productIdentifiers.gtin,
    });

    if (identifierMatch.status === "found" && identifierMatch.candidate) {
      const found = identifierMatch.candidate;
      return asFoundResolution({
        statusReason: "Public Walmart listing images found via SerpApi search.",
        matchMethod: endpointMatchMethod,
        publicWalmartUrl: requestedUrl,
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
          candidateCount: searchResponse.candidates.length,
          imageCount: found.galleryImageUrls.length,
          matchMethod: endpointMatchMethod,
        },
      });
    }

    if (identifierMatch.status === "ambiguous") {
      return asFailureResolution({
        imageSyncStatus: "ambiguous",
        errorCode: "SERPAPI_AMBIGUOUS_MATCH",
        statusReason:
          "Multiple public Walmart listing candidates matched this product identifier. Provide a direct public Walmart listing URL.",
        matchMethod: endpointMatchMethod,
        publicWalmartUrl: requestedUrl,
        publicWalmartProductId: preferredProductId ?? "",
        diagnostics: {
          provider: "serpapi",
          endpointFamily: "walmart_search",
          statusCategory: "ambiguous",
          productId: preferredProductId ?? null,
          candidateCount: searchResponse.candidates.length,
          imageCount: 0,
          matchMethod: endpointMatchMethod,
        },
      });
    }
  }

  const titleBrandQuery = `${asString(input.product.brand)} ${asString(input.product.title)}`.trim();
  if (titleBrandQuery) {
    const titleSearch = await searchWalmartProductCandidatesViaSerpApi({
      apiKey: credentials.apiKey,
      query: titleBrandQuery,
    });

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
        statusReason: titleSearch.statusReason,
        matchMethod: "serpapi_search_title_brand",
        publicWalmartUrl: requestedUrl,
        publicWalmartProductId: preferredProductId ?? "",
        diagnostics: {
          provider: "serpapi",
          endpointFamily: "walmart_search",
          statusCategory: titleSearch.statusCategory,
          productId: preferredProductId ?? null,
          candidateCount: 0,
          imageCount: 0,
          matchMethod: "serpapi_search_title_brand",
        },
      });
    }

    const titleBrandMatch = firstMatchedCandidateByTitleBrand(titleSearch.candidates, input.product);
    if (titleBrandMatch.status === "found" && titleBrandMatch.candidate) {
      const found = titleBrandMatch.candidate;
      return asFoundResolution({
        statusReason: "Public Walmart listing images found via title+brand match through SerpApi.",
        matchMethod: "serpapi_search_title_brand",
        publicWalmartUrl: requestedUrl,
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
          candidateCount: titleSearch.candidates.length,
          imageCount: found.galleryImageUrls.length,
          matchMethod: "serpapi_search_title_brand",
        },
      });
    }

    if (titleBrandMatch.status === "ambiguous") {
      return asFailureResolution({
        imageSyncStatus: "ambiguous",
        errorCode: "SERPAPI_AMBIGUOUS_MATCH",
        statusReason:
          "Multiple title+brand candidates were found. Add a direct public Walmart listing URL for a confident match.",
        matchMethod: "serpapi_search_title_brand",
        publicWalmartUrl: requestedUrl,
        publicWalmartProductId: preferredProductId ?? "",
        diagnostics: {
          provider: "serpapi",
          endpointFamily: "walmart_search",
          statusCategory: "ambiguous",
          productId: preferredProductId ?? null,
          candidateCount: titleSearch.candidates.length,
          imageCount: 0,
          matchMethod: "serpapi_search_title_brand",
        },
      });
    }
  }

  const hasSafeIdentifiers =
    Boolean(preferredProductId) || Boolean(productIdentifiers.upc) || Boolean(productIdentifiers.gtin);

  return asFailureResolution({
    imageSyncStatus: "not_found",
    errorCode: "SERPAPI_NOT_FOUND",
    statusReason: hasSafeIdentifiers
      ? "No public Walmart listing images were found for this product."
      : "No public product ID or UPC/GTIN available for safe matching.",
    matchMethod:
      preferredProductIdentifier.identifierType === "public_url_product_id"
        ? "public_url_product_id"
        : preferredProductId
        ? "serpapi_product_id"
        : null,
    publicWalmartUrl: requestedUrl,
    publicWalmartProductId: preferredProductId ?? "",
    diagnostics: {
      provider: "serpapi",
      endpointFamily: preferredProductId ? "walmart_product" : "walmart_search",
      statusCategory: "not_found",
      productId: preferredProductId ?? null,
      productIdentifierType: preferredProductIdentifier.identifierType,
      candidateCount: 0,
      imageCount: 0,
      matchMethod:
        preferredProductIdentifier.identifierType === "public_url_product_id"
          ? "public_url_product_id"
          : preferredProductId
          ? "serpapi_product_id"
          : null,
    },
  });
}

export const serpApiWalmartImageInternals = {
  sanitizePublicWalmartUrl,
  normalizeWalmartPublicProductId,
  normalizeSerpApiWalmartImages,
  extractSerpApiSearchCandidates,
  sanitizeSerpApiErrorDetail,
  extractSerpApiErrorDetail,
  normalizeIdentifier,
  firstMatchedCandidateByIdentifier,
  firstMatchedCandidateByTitleBrand,
  normalizeCandidateScore,
  tokenizeText,
  isLikelyBrandEquivalent,
};
