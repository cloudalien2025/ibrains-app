import "server-only";

import crypto from "crypto";
import { WALMART_PRODUCTION_BASE_URL } from "@/lib/ecomviper/walmart/walmart-client";
import type {
  WalmartImageMatchMethod,
  WalmartImageSyncStatus,
  WalmartProductRecord,
} from "@/lib/ecomviper/walmart/walmart-types";

const TRANSIENT_HTTP_STATUS = new Set([429, 500, 502, 503, 504]);
const ITEM_SEARCH_RETRY_BACKOFF_MS = [200, 450] as const;
const ITEM_SEARCH_TIMEOUT_MS = 9_000;

interface ItemSearchAttempt {
  method: WalmartImageMatchMethod;
  value: string;
}

type ItemSearchFailureReason =
  | "none"
  | "http_non_retryable"
  | "transient_http_exhausted"
  | "network_non_retryable"
  | "network_retry_exhausted"
  | "parse_error";

export interface WalmartItemSearchAttemptDiagnostic {
  method: WalmartImageMatchMethod;
  httpStatus: number | null;
  resultCount: number;
  ok: boolean;
  retryCount: number;
  transientRetries: number;
  failureReason: ItemSearchFailureReason;
}

export interface WalmartItemSearchDecisionDiagnostic {
  outcome: WalmartImageSyncStatus;
  reason: string;
  matchMethod: WalmartImageMatchMethod | null;
  candidateCount: number;
  selectedScore: number | null;
  runnerUpScore: number | null;
  acceptedBy:
    | "identifier_exact"
    | "identifier_normalized"
    | "identifier_assisted"
    | "title_brand_strong"
    | "none";
  decisionCode:
    | "walmart_item_search_exact_identifier_match"
    | "walmart_item_search_identifier_normalized_match"
    | "walmart_item_search_identifier_assisted_match"
    | "walmart_item_search_multiple_candidates_rejected"
    | "walmart_item_search_single_candidate_no_image"
    | "walmart_item_search_query_title_brand_match"
    | "walmart_item_search_query_low_confidence"
    | "walmart_item_search_query_ambiguous"
    | "walmart_item_search_not_found"
    | "walmart_item_search_provider_failed"
    | "walmart_item_search_not_synced";
}

export interface WalmartItemSearchImageEnrichment {
  imageSyncStatus: WalmartImageSyncStatus;
  imageSource: "walmart_item_search";
  statusReason: string;
  primaryImageUrl: string;
  galleryImageUrls: string[];
  variantImageUrls: string[];
  matchedItemId: string | null;
  matchMethod: WalmartImageMatchMethod | null;
  lastImageSyncedAt: string;
  diagnostics: {
    attempts: WalmartItemSearchAttemptDiagnostic[];
    decision: WalmartItemSearchDecisionDiagnostic;
  };
}

interface SearchIntent {
  itemId: string;
  wpid: string;
  upc: string;
  gtin: string;
  title: string;
  brand: string;
}

interface SearchCandidate {
  item: Record<string, unknown>;
  itemId: string;
  wpid: string;
  upc: string;
  gtin: string;
  title: string;
  brand: string;
  images: {
    primaryImageUrl: string;
    galleryImageUrls: string[];
    variantImageUrls: string[];
  };
  hasUsableImage: boolean;
  exactGtin: boolean;
  exactUpc: boolean;
  normalizedGtin: boolean;
  normalizedUpc: boolean;
  exactItemId: boolean;
  exactWpid: boolean;
  titleCoverage: number;
  titleJaccard: number;
  brandScore: number;
  brandEquivalent: boolean;
  score: number;
}

interface CandidateEvaluation {
  outcome: "found" | "ambiguous" | "continue";
  reason: string;
  acceptedBy: WalmartItemSearchDecisionDiagnostic["acceptedBy"];
  decisionCode: WalmartItemSearchDecisionDiagnostic["decisionCode"];
  candidate: SearchCandidate | null;
  candidateCount: number;
  selectedScore: number | null;
  runnerUpScore: number | null;
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

function normalizeBarcodeDigits(value: string): string {
  return value.replace(/\D/g, "");
}

function barcodeVariants(value: string): string[] {
  const digits = normalizeBarcodeDigits(value);
  if (!digits) return [];

  const variants = new Set<string>();
  const stripped = digits.replace(/^0+/, "") || "0";
  variants.add(digits);
  variants.add(stripped);

  for (const length of [12, 13, 14] as const) {
    if (digits.length >= length) {
      variants.add(digits.slice(-length));
    } else {
      variants.add(digits.padStart(length, "0"));
    }

    if (stripped.length <= length) {
      variants.add(stripped.padStart(length, "0"));
    }
  }

  return Array.from(variants.values()).filter(Boolean);
}

function areBarcodeValuesEquivalent(left: string, right: string): boolean {
  const leftVariants = new Set(barcodeVariants(left));
  const rightVariants = barcodeVariants(right);
  if (leftVariants.size === 0 || rightVariants.length === 0) return false;
  return rightVariants.some((entry) => leftVariants.has(entry));
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
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    output.push(normalized);
  }

  return output;
}

function extractSearchItems(payload: unknown): Record<string, unknown>[] {
  const root = asObject(payload);
  if (!root) return [];

  const itemResponse = asObject(root.ItemResponse);
  const data = asObject(root.data);
  const searchResult = asObject(root.searchResult);
  const candidates = [
    root.items,
    root.ItemResponse,
    itemResponse?.items,
    itemResponse?.item,
    itemResponse?.Item,
    itemResponse?.searchResult,
    asObject(itemResponse?.searchResult)?.items,
    data?.items,
    searchResult?.items,
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
    title: firstNonEmptyString(
      item.productName,
      item.title,
      item.name,
      asObject(item.product)?.title,
      asObject(item.product)?.productName
    ),
    brand: firstNonEmptyString(item.brand, item.brandName, asObject(item.product)?.brand),
  };
}

function flattenImageValuesFromRows(rows: Record<string, unknown>[]): unknown[] {
  return rows.flatMap((entry) => {
    const nestedAsset = asObject(entry.asset);
    return [
      entry.url,
      entry.imageUrl,
      entry.mainImageUrl,
      entry.productImageUrl,
      entry.itemImageUrl,
      entry.thumbnailUrl,
      entry.thumbnailImageUrl,
      entry.largeImageUrl,
      entry.assetUrl,
      nestedAsset?.url,
      nestedAsset?.imageUrl,
    ];
  });
}

function extractItemImages(item: Record<string, unknown>): {
  primaryImageUrl: string;
  galleryImageUrls: string[];
  variantImageUrls: string[];
} {
  const product = asObject(item.product);
  const properties = asObject(item.properties);
  const itemVariants = asObject(properties?.variants);
  const imageInfo = asObject(item.imageInfo);
  const content = asObject(item.content);
  const media = asObject(item.media);

  const galleryRows = [
    ...asObjectArray(item.images),
    ...asObjectArray(item.assets),
    ...asObjectArray(item.productAssets),
    ...asObjectArray(item.additionalImages),
    ...asObjectArray(imageInfo?.images),
    ...asObjectArray(product?.images),
    ...asObjectArray(content?.images),
    ...asObjectArray(media?.images),
  ];

  const variantRows = [
    ...asObjectArray(itemVariants?.variantData),
    ...asObjectArray(asObject(asObject(product?.properties)?.variants)?.variantData),
  ];

  const variantImageUrls = dedupeUrls([
    ...flattenImageValuesFromRows(variantRows),
    ...variantRows.flatMap((entry) => flattenImageValuesFromRows(asObjectArray(entry.images))),
  ]);

  const galleryImageUrls = dedupeUrls([
    ...flattenImageValuesFromRows(galleryRows),
    item.imageUrl,
    item.mainImageUrl,
    item.productImageUrl,
    item.itemImageUrl,
    item.thumbnailImageUrl,
    item.largeImageUrl,
    imageInfo?.imageUrl,
    imageInfo?.mainImageUrl,
    imageInfo?.thumbnailImageUrl,
    product?.imageUrl,
    product?.mainImageUrl,
    product?.productImageUrl,
    content?.imageUrl,
    content?.mainImageUrl,
  ]);

  const mergedGallery = dedupeUrls([...galleryImageUrls, ...variantImageUrls]);
  const primaryImageUrl = mergedGallery[0] ?? "";

  return {
    primaryImageUrl,
    galleryImageUrls: mergedGallery,
    variantImageUrls,
  };
}

function tokenizeAlnum(value: string): string[] {
  return normalizeText(value)
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1);
}

const BRAND_STOPWORDS = new Set(["inc", "llc", "co", "company", "corp", "corporation", "ltd", "the"]);

function tokenizeBrand(value: string): string[] {
  return tokenizeAlnum(value).filter((token) => !BRAND_STOPWORDS.has(token));
}

function ratioFromSets(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 || right.size === 0) return 0;
  const matches = Array.from(left.values()).filter((token) => right.has(token)).length;
  return matches / Math.max(left.size, right.size);
}

function titleSimilarity(left: string, right: string): { coverage: number; jaccard: number; score: number } {
  const leftTokens = tokenizeAlnum(left);
  const rightTokens = tokenizeAlnum(right);
  const leftSet = new Set(leftTokens);
  const rightSet = new Set(rightTokens);

  if (leftSet.size === 0 || rightSet.size === 0) {
    return { coverage: 0, jaccard: 0, score: 0 };
  }

  const overlapCount = Array.from(leftSet.values()).filter((token) => rightSet.has(token)).length;
  const coverage = overlapCount / leftSet.size;
  const unionCount = new Set([...Array.from(leftSet.values()), ...Array.from(rightSet.values())]).size;
  const jaccard = unionCount > 0 ? overlapCount / unionCount : 0;
  const score = Math.round(coverage * 80 + jaccard * 30);

  return { coverage, jaccard, score };
}

function brandSimilarity(left: string, right: string): { score: number; equivalent: boolean } {
  const normalizedLeft = normalizeText(left);
  const normalizedRight = normalizeText(right);
  if (!normalizedLeft || !normalizedRight) {
    return { score: 0, equivalent: false };
  }

  if (normalizedLeft === normalizedRight) {
    return { score: 40, equivalent: true };
  }

  const leftSet = new Set(tokenizeBrand(left));
  const rightSet = new Set(tokenizeBrand(right));
  const overlap = ratioFromSets(leftSet, rightSet);

  if (overlap >= 0.95) {
    return { score: 34, equivalent: true };
  }
  if (overlap >= 0.7) {
    return { score: 26, equivalent: true };
  }
  if (overlap >= 0.5) {
    return { score: 14, equivalent: false };
  }

  return { score: 0, equivalent: false };
}

function scoreSearchCandidate(
  item: Record<string, unknown>,
  intent: SearchIntent,
  method: WalmartImageMatchMethod
): SearchCandidate {
  const identifiers = extractItemIdentifiers(item);
  const images = extractItemImages(item);
  const hasUsableImage = Boolean(images.primaryImageUrl || images.galleryImageUrls.length || images.variantImageUrls.length);

  const exactGtin = Boolean(intent.gtin) && normalizeIdentifier(intent.gtin) === normalizeIdentifier(identifiers.gtin);
  const exactUpc = Boolean(intent.upc) && normalizeIdentifier(intent.upc) === normalizeIdentifier(identifiers.upc);
  const normalizedGtin = Boolean(intent.gtin) && areBarcodeValuesEquivalent(intent.gtin, identifiers.gtin);
  const normalizedUpc = Boolean(intent.upc) && areBarcodeValuesEquivalent(intent.upc, identifiers.upc);
  const exactItemId =
    Boolean(intent.itemId) && normalizeIdentifier(intent.itemId) === normalizeIdentifier(identifiers.itemId);
  const exactWpid = Boolean(intent.wpid) && normalizeIdentifier(intent.wpid) === normalizeIdentifier(identifiers.wpid);

  const titleSignal = titleSimilarity(intent.title, identifiers.title);
  const brandSignal = brandSimilarity(intent.brand, identifiers.brand);

  let score = 0;
  if (exactGtin) score += 250;
  if (exactUpc) score += 230;
  if (!exactGtin && normalizedGtin) score += 175;
  if (!exactUpc && normalizedUpc) score += 162;
  if (exactItemId) score += 210;
  if (exactWpid) score += 200;

  score += titleSignal.score;
  score += brandSignal.score;

  if (hasUsableImage) score += 35;
  else score -= 42;

  if (method === "gtin" && intent.gtin && !exactGtin) score -= 130;
  if (method === "upc" && intent.upc && !exactUpc) score -= 120;
  if (method === "itemId" && intent.itemId && !exactItemId) score -= 115;
  if (method === "wpid" && intent.wpid && !exactWpid) score -= 108;

  if (method === "query") {
    if (brandSignal.score < 20 && intent.brand) score -= 38;
    if (titleSignal.coverage < 0.5) score -= 35;
  }

  return {
    item,
    itemId: identifiers.itemId,
    wpid: identifiers.wpid,
    upc: identifiers.upc,
    gtin: identifiers.gtin,
    title: identifiers.title,
    brand: identifiers.brand,
    images,
    hasUsableImage,
    exactGtin,
    exactUpc,
    normalizedGtin,
    normalizedUpc,
    exactItemId,
    exactWpid,
    titleCoverage: titleSignal.coverage,
    titleJaccard: titleSignal.jaccard,
    brandScore: brandSignal.score,
    brandEquivalent: brandSignal.equivalent,
    score,
  };
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

function isTransientStatus(status: number): boolean {
  return TRANSIENT_HTTP_STATUS.has(status);
}

function isTransientNetworkError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === "AbortError") return true;
  if (error instanceof TypeError) return true;
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url: string, accessToken: string): Promise<Response> {
  const correlationId = crypto.randomUUID();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ITEM_SEARCH_TIMEOUT_MS);

  try {
    return await fetch(url, {
      method: "GET",
      headers: buildWalmartApiHeaders(accessToken, correlationId),
      cache: "no-store",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function searchWalmartItems(
  accessToken: string,
  attempt: ItemSearchAttempt
): Promise<{ items: Record<string, unknown>[]; diagnostic: WalmartItemSearchAttemptDiagnostic }> {
  const url = buildSearchUrl(attempt);
  let retryCount = 0;
  let transientRetries = 0;

  while (true) {
    try {
      const response = await fetchWithTimeout(url, accessToken);
      const responseBody = await response.text();
      let payload: unknown = {};

      if (responseBody) {
        try {
          payload = JSON.parse(responseBody) as unknown;
        } catch {
          return {
            items: [],
            diagnostic: {
              method: attempt.method,
              httpStatus: response.status,
              resultCount: 0,
              ok: false,
              retryCount,
              transientRetries,
              failureReason: "parse_error",
            },
          };
        }
      }

      if (response.ok) {
        const items = extractSearchItems(payload);
        return {
          items,
          diagnostic: {
            method: attempt.method,
            httpStatus: response.status,
            resultCount: items.length,
            ok: true,
            retryCount,
            transientRetries,
            failureReason: "none",
          },
        };
      }

      if (isTransientStatus(response.status) && retryCount < ITEM_SEARCH_RETRY_BACKOFF_MS.length) {
        await sleep(ITEM_SEARCH_RETRY_BACKOFF_MS[retryCount]);
        retryCount += 1;
        transientRetries += 1;
        continue;
      }

      return {
        items: [],
        diagnostic: {
          method: attempt.method,
          httpStatus: response.status,
          resultCount: 0,
          ok: false,
          retryCount,
          transientRetries,
          failureReason: isTransientStatus(response.status) ? "transient_http_exhausted" : "http_non_retryable",
        },
      };
    } catch (error) {
      const transient = isTransientNetworkError(error);
      if (transient && retryCount < ITEM_SEARCH_RETRY_BACKOFF_MS.length) {
        await sleep(ITEM_SEARCH_RETRY_BACKOFF_MS[retryCount]);
        retryCount += 1;
        transientRetries += 1;
        continue;
      }

      return {
        items: [],
        diagnostic: {
          method: attempt.method,
          httpStatus: null,
          resultCount: 0,
          ok: false,
          retryCount,
          transientRetries,
          failureReason: transient ? "network_retry_exhausted" : "network_non_retryable",
        },
      };
    }
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

  // Prefer UPC first, then GTIN, to match Walmart Item Search parameter behavior.
  push("upc", product.upc);
  push("gtin", product.gtin);
  push("itemId", product.itemId);
  push("wpid", product.wpid);

  const query = [asString(product.title), asString(product.brand)].filter(Boolean).join(" ").trim();
  push("query", query);

  return queue;
}

function hasExactMatchForMethod(candidate: SearchCandidate, method: WalmartImageMatchMethod): boolean {
  if (method === "gtin") return candidate.exactGtin;
  if (method === "upc") return candidate.exactUpc;
  if (method === "itemId") return candidate.exactItemId;
  if (method === "wpid") return candidate.exactWpid;
  return candidate.exactGtin || candidate.exactUpc || candidate.exactItemId || candidate.exactWpid;
}

function hasNormalizedIdentifierMatchForMethod(
  candidate: SearchCandidate,
  method: WalmartImageMatchMethod
): boolean {
  if (method === "gtin") return candidate.normalizedGtin;
  if (method === "upc") return candidate.normalizedUpc;
  if (method === "itemId") return candidate.exactItemId;
  if (method === "wpid") return candidate.exactWpid;
  return (
    candidate.normalizedGtin ||
    candidate.normalizedUpc ||
    candidate.exactItemId ||
    candidate.exactWpid
  );
}

function evaluateCandidatesForAttempt(
  candidates: SearchCandidate[],
  method: WalmartImageMatchMethod
): CandidateEvaluation {
  if (candidates.length === 0) {
    return {
      outcome: "continue",
      reason: "Item Search returned no usable image.",
      acceptedBy: "none",
      decisionCode: "walmart_item_search_not_found",
      candidate: null,
      candidateCount: 0,
      selectedScore: null,
      runnerUpScore: null,
    };
  }

  const sorted = [...candidates].sort((left, right) => right.score - left.score);
  const top = sorted[0];
  const runnerUp = sorted[1] ?? null;
  const scoreGap = runnerUp ? top.score - runnerUp.score : top.score;

  const exactForMethod = hasExactMatchForMethod(top, method);
  const runnerClose = Boolean(
    runnerUp && scoreGap <= (method === "query" ? 24 : 14) && runnerUp.score >= (method === "query" ? 80 : 95)
  );
  const titleBrandStrong = top.titleCoverage >= 0.72 && top.titleJaccard >= 0.48 && top.brandScore >= 24;

  if (method !== "query") {
    const normalizedForMethod = hasNormalizedIdentifierMatchForMethod(top, method);

    if (!exactForMethod && !normalizedForMethod && sorted.length > 1) {
      return {
        outcome: "continue",
        reason: "Multiple Walmart Item Search candidates were returned for this identifier. Skipped automatic match.",
        acceptedBy: "none",
        decisionCode: "walmart_item_search_multiple_candidates_rejected",
        candidate: top,
        candidateCount: sorted.length,
        selectedScore: top.score,
        runnerUpScore: runnerUp?.score ?? null,
      };
    }

    if (!exactForMethod && !normalizedForMethod && sorted.length === 1 && top.hasUsableImage) {
      return {
        outcome: "found",
        reason: "Single Walmart Item Search candidate with usable image accepted via identifier-assisted match.",
        acceptedBy: "identifier_assisted",
        decisionCode: "walmart_item_search_identifier_assisted_match",
        candidate: top,
        candidateCount: sorted.length,
        selectedScore: top.score,
        runnerUpScore: runnerUp?.score ?? null,
      };
    }

    if (!exactForMethod && !normalizedForMethod) {
      return {
        outcome: "continue",
        reason: "No exact identifier match in Item Search result.",
        acceptedBy: "none",
        decisionCode: "walmart_item_search_not_found",
        candidate: top,
        candidateCount: sorted.length,
        selectedScore: top.score,
        runnerUpScore: runnerUp?.score ?? null,
      };
    }

    const runnerHasSameIdentifier = Boolean(
      runnerUp &&
        (hasExactMatchForMethod(runnerUp, method) ||
          hasNormalizedIdentifierMatchForMethod(runnerUp, method))
    );
    if (runnerHasSameIdentifier && scoreGap <= 12) {
      return {
        outcome: "ambiguous",
        reason: "Multiple Walmart Item Search candidates matched this product.",
        acceptedBy: "none",
        decisionCode: "walmart_item_search_multiple_candidates_rejected",
        candidate: top,
        candidateCount: sorted.length,
        selectedScore: top.score,
        runnerUpScore: runnerUp?.score ?? null,
      };
    }

    if (!top.hasUsableImage) {
      return {
        outcome: "continue",
        reason: "Item Search returned no usable image.",
        acceptedBy: "none",
        decisionCode: "walmart_item_search_single_candidate_no_image",
        candidate: top,
        candidateCount: sorted.length,
        selectedScore: top.score,
        runnerUpScore: runnerUp?.score ?? null,
      };
    }

    return {
      outcome: "found",
      reason: exactForMethod
        ? "Exact identifier match with usable Walmart Item Search image."
        : "Normalized identifier match with usable Walmart Item Search image.",
      acceptedBy: exactForMethod ? "identifier_exact" : "identifier_normalized",
      decisionCode: exactForMethod
        ? "walmart_item_search_exact_identifier_match"
        : "walmart_item_search_identifier_normalized_match",
      candidate: top,
      candidateCount: sorted.length,
      selectedScore: top.score,
      runnerUpScore: runnerUp?.score ?? null,
    };
  }

  if (runnerClose && runnerUp) {
    const runnerPlausible = runnerUp.titleCoverage >= 0.58 && runnerUp.brandScore >= 20;
    if (runnerPlausible) {
      return {
        outcome: "ambiguous",
        reason: "Multiple Walmart Item Search candidates matched this product.",
        acceptedBy: "none",
        decisionCode: "walmart_item_search_query_ambiguous",
        candidate: top,
        candidateCount: sorted.length,
        selectedScore: top.score,
        runnerUpScore: runnerUp.score,
      };
    }
  }

  if (!titleBrandStrong) {
      return {
        outcome: "continue",
        reason: "Query fallback confidence is too low for a safe image match.",
        acceptedBy: "none",
        decisionCode: "walmart_item_search_query_low_confidence",
        candidate: top,
        candidateCount: sorted.length,
        selectedScore: top.score,
      runnerUpScore: runnerUp?.score ?? null,
    };
  }

  if (!top.hasUsableImage) {
      return {
        outcome: "continue",
        reason: "Item Search returned no usable image.",
        acceptedBy: "none",
        decisionCode: "walmart_item_search_single_candidate_no_image",
        candidate: top,
        candidateCount: sorted.length,
        selectedScore: top.score,
      runnerUpScore: runnerUp?.score ?? null,
    };
  }

  return {
    outcome: "found",
    reason: "Strong title and brand match with usable Walmart Item Search image.",
    acceptedBy: "title_brand_strong",
    decisionCode: "walmart_item_search_query_title_brand_match",
    candidate: top,
    candidateCount: sorted.length,
    selectedScore: top.score,
    runnerUpScore: runnerUp?.score ?? null,
  };
}

function buildResult(params: {
  syncedAt: string;
  status: WalmartImageSyncStatus;
  reason: string;
  matchMethod: WalmartImageMatchMethod | null;
  candidate: SearchCandidate | null;
  acceptedBy?: WalmartItemSearchDecisionDiagnostic["acceptedBy"];
  candidateCount: number;
  selectedScore: number | null;
  runnerUpScore: number | null;
  diagnostics: WalmartItemSearchAttemptDiagnostic[];
  decisionCode: WalmartItemSearchDecisionDiagnostic["decisionCode"];
}): WalmartItemSearchImageEnrichment {
  return {
    imageSyncStatus: params.status,
    imageSource: "walmart_item_search",
    statusReason: params.reason,
    primaryImageUrl: params.status === "found" ? params.candidate?.images.primaryImageUrl ?? "" : "",
    galleryImageUrls: params.status === "found" ? [...(params.candidate?.images.galleryImageUrls ?? [])] : [],
    variantImageUrls: params.status === "found" ? [...(params.candidate?.images.variantImageUrls ?? [])] : [],
    matchedItemId: params.candidate?.itemId || null,
    matchMethod: params.matchMethod,
    lastImageSyncedAt: params.syncedAt,
    diagnostics: {
      attempts: params.diagnostics,
      decision: {
        outcome: params.status,
        reason: params.reason,
        matchMethod: params.matchMethod,
        candidateCount: params.candidateCount,
        selectedScore: params.selectedScore,
        runnerUpScore: params.runnerUpScore,
        acceptedBy: params.acceptedBy ?? "none",
        decisionCode: params.decisionCode,
      },
    },
  };
}

export async function enrichWalmartImageFromItemSearch(params: {
  accessToken: string;
  product: Pick<WalmartProductRecord, "gtin" | "upc" | "itemId" | "wpid" | "title" | "brand">;
}): Promise<WalmartItemSearchImageEnrichment> {
  const attempts = resolveAttempts(params.product);
  const diagnostics: WalmartItemSearchAttemptDiagnostic[] = [];
  const syncedAt = new Date().toISOString();

  if (attempts.length === 0) {
    return buildResult({
      syncedAt,
      status: "not_synced",
      reason: "Image enrichment not synced.",
      matchMethod: null,
      candidate: null,
      candidateCount: 0,
      selectedScore: null,
      runnerUpScore: null,
      diagnostics,
      decisionCode: "walmart_item_search_not_synced",
    });
  }

  let hadSuccessfulRead = false;
  let ambiguousChoice: CandidateEvaluation | null = null;
  let ambiguousMethod: WalmartImageMatchMethod | null = null;
  let notFoundReason = "Item Search returned no usable image.";
  let notFoundDecisionCode: WalmartItemSearchDecisionDiagnostic["decisionCode"] =
    "walmart_item_search_not_found";
  let notFoundCandidate: SearchCandidate | null = null;
  let notFoundMethod: WalmartImageMatchMethod | null = null;

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

    const evaluated = evaluateCandidatesForAttempt(
      result.items.map((item) => scoreSearchCandidate(item, intent, attempt.method)),
      attempt.method
    );

    if (evaluated.outcome === "found" && evaluated.candidate) {
      return buildResult({
        syncedAt,
        status: "found",
        reason: evaluated.reason,
        matchMethod: attempt.method,
        candidate: evaluated.candidate,
        acceptedBy: evaluated.acceptedBy,
        candidateCount: evaluated.candidateCount,
        selectedScore: evaluated.selectedScore,
        runnerUpScore: evaluated.runnerUpScore,
        diagnostics,
        decisionCode: evaluated.decisionCode,
      });
    }

    if (evaluated.outcome === "ambiguous") {
      if (!ambiguousChoice || (evaluated.selectedScore ?? -Infinity) > (ambiguousChoice.selectedScore ?? -Infinity)) {
        ambiguousChoice = evaluated;
        ambiguousMethod = attempt.method;
      }
      continue;
    }

    if (
      evaluated.candidate &&
      (evaluated.candidate.exactGtin ||
        evaluated.candidate.exactUpc ||
        evaluated.candidate.exactItemId ||
        evaluated.candidate.titleCoverage >= 0.72)
    ) {
      notFoundCandidate = evaluated.candidate;
      notFoundMethod = attempt.method;
    }

    if (evaluated.reason) {
      notFoundReason = evaluated.reason;
      notFoundDecisionCode = evaluated.decisionCode;
    }
  }

  if (ambiguousChoice) {
    return buildResult({
      syncedAt,
      status: "ambiguous",
      reason: ambiguousChoice.reason,
      matchMethod: ambiguousMethod,
      candidate: ambiguousChoice.candidate,
      candidateCount: ambiguousChoice.candidateCount,
      selectedScore: ambiguousChoice.selectedScore,
      runnerUpScore: ambiguousChoice.runnerUpScore,
      diagnostics,
      decisionCode: ambiguousChoice.decisionCode,
    });
  }

  if (hadSuccessfulRead) {
    return buildResult({
      syncedAt,
      status: "not_found",
      reason: notFoundReason,
      matchMethod: notFoundMethod,
      candidate: notFoundCandidate,
      candidateCount: notFoundCandidate ? 1 : 0,
      selectedScore: null,
      runnerUpScore: null,
      diagnostics,
      decisionCode: notFoundDecisionCode,
    });
  }

  return buildResult({
    syncedAt,
    status: "failed",
    reason: "Item Search request failed after retry.",
    matchMethod: null,
    candidate: null,
    candidateCount: 0,
    selectedScore: null,
    runnerUpScore: null,
    diagnostics,
    decisionCode: "walmart_item_search_provider_failed",
  });
}

export const walmartItemSearchInternals = {
  normalizeImageUrl,
  dedupeUrls,
  extractItemImages,
  extractSearchItems,
  scoreSearchCandidate,
};
