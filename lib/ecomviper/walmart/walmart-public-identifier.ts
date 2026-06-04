import type { WalmartProductRecord } from "@/lib/ecomviper/walmart/walmart-types";
import {
  buildWalmartPublicListingUrlFromItemId,
  extractWalmartItemIdFromUrl,
  normalizeWalmartPublicListingUrl,
} from "@/lib/ecomviper/walmart/walmart-public-listing-url";

export type WalmartPublicIdentifierType =
  | "url_product_id"
  | "explicit_product_id"
  | "walmart_public_product_id"
  | "walmart_item_id"
  | "walmart_payload_product_id"
  | "search_title_brand"
  | "gtin_skipped_for_product_lookup"
  | "upc_skipped_for_product_lookup"
  | "missing_product_identifier";

export interface ResolvedWalmartPublicIdentifier {
  normalizedPublicWalmartUrl: string;
  walmartProductIdFromUrl: string;
  preferredWalmartProductId: string;
  preferredIdentifierType: WalmartPublicIdentifierType;
  upc: string;
  gtin: string;
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

function normalizeIdentifier(value: unknown): string {
  return asString(value).replace(/[^0-9a-z]/gi, "").toUpperCase();
}

function normalizeWalmartPublicProductId(value: unknown): string {
  const candidate = asString(value);
  if (!candidate) return "";
  return /^\d{6,20}$/.test(candidate) ? candidate : "";
}

function isLikelyGtinFamilyLength(value: string): boolean {
  return value.length === 8 || value.length === 12 || value.length === 13 || value.length === 14;
}

export function isLikelyGtinOrUpc(value: unknown): boolean {
  const digitsOnly = asString(value).replace(/\D/g, "");
  if (!isLikelyGtinFamilyLength(digitsOnly)) return false;

  let sum = 0;
  let useWeightThree = true;
  for (let index = digitsOnly.length - 2; index >= 0; index -= 1) {
    const digit = Number(digitsOnly[index] ?? "");
    if (!Number.isFinite(digit)) return false;
    sum += digit * (useWeightThree ? 3 : 1);
    useWeightThree = !useWeightThree;
  }

  const expectedCheckDigit = (10 - (sum % 10)) % 10;
  const actualCheckDigit = Number(digitsOnly[digitsOnly.length - 1] ?? "");
  return Number.isFinite(actualCheckDigit) && expectedCheckDigit === actualCheckDigit;
}

function firstNormalizedIdentifier(values: unknown[]): string {
  for (const value of values) {
    const candidate = normalizeIdentifier(value);
    if (candidate) return candidate;
  }
  return "";
}

function isLikelyWalmartUrlCandidate(value: string, keyHint: string): boolean {
  const lowered = value.toLowerCase();
  if (lowered.includes("walmart.com/ip/")) return true;
  if (lowered.startsWith("/ip/")) return true;
  if (/walmart/.test(lowered) && /(url|link|canonical|product)/i.test(keyHint)) return true;
  return false;
}

function collectUrlCandidates(
  value: unknown,
  bucket: string[],
  keyHint = "",
  depth = 0
): void {
  if (depth > 5 || value === null || value === undefined) return;

  if (typeof value === "string" || typeof value === "number" || typeof value === "bigint") {
    const candidate = asString(value);
    if (!candidate) return;
    if (isLikelyWalmartUrlCandidate(candidate, keyHint)) {
      bucket.push(candidate);
    }
    return;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      collectUrlCandidates(entry, bucket, keyHint, depth + 1);
    }
    return;
  }

  const node = asObject(value);
  if (!node) return;
  for (const [key, child] of Object.entries(node)) {
    const nextHint = keyHint ? `${keyHint}.${key}` : key;
    collectUrlCandidates(child, bucket, nextHint, depth + 1);
  }
}

export function normalizeWalmartPublicUrl(value: unknown): string {
  return normalizeWalmartPublicListingUrl(value) ?? "";
}

export function extractWalmartPublicProductIdFromUrl(url: string): string | null {
  return extractWalmartItemIdFromUrl(url);
}

function firstWalmartProductIdExcludingBarcode(input: {
  values: unknown[];
  upc: string;
  gtin: string;
}): string {
  for (const value of input.values) {
    const candidate = normalizeWalmartPublicProductId(value);
    if (!candidate) continue;
    const normalizedCandidate = normalizeIdentifier(candidate);
    if (input.upc && normalizedCandidate === input.upc) continue;
    if (input.gtin && normalizedCandidate === input.gtin) continue;
    return candidate;
  }
  return "";
}

export function resolveCanonicalWalmartPublicIdentifier(input: {
  publicWalmartUrlCandidates?: unknown[];
  explicitWalmartProductIdCandidates?: unknown[];
  walmartItemIdCandidates?: unknown[];
  walmartPayloadProductIdCandidates?: unknown[];
  upcCandidates?: unknown[];
  gtinCandidates?: unknown[];
  nestedPayloadCandidates?: unknown[];
}): ResolvedWalmartPublicIdentifier {
  const urlCandidates: string[] = [];
  for (const value of input.publicWalmartUrlCandidates ?? []) {
    collectUrlCandidates(value, urlCandidates);
  }
  for (const node of input.nestedPayloadCandidates ?? []) {
    collectUrlCandidates(node, urlCandidates);
  }

  const normalizedPublicWalmartUrl = urlCandidates.map((value) => normalizeWalmartPublicUrl(value)).find(Boolean) ?? "";
  const walmartProductIdFromUrl = normalizedPublicWalmartUrl
    ? extractWalmartPublicProductIdFromUrl(normalizedPublicWalmartUrl) ?? ""
    : "";

  const upc = firstNormalizedIdentifier(input.upcCandidates ?? []);
  const gtin = firstNormalizedIdentifier(input.gtinCandidates ?? []);

  if (walmartProductIdFromUrl) {
    return {
      normalizedPublicWalmartUrl,
      walmartProductIdFromUrl,
      preferredWalmartProductId: walmartProductIdFromUrl,
      preferredIdentifierType: "url_product_id",
      upc,
      gtin,
    };
  }

  const explicitProductId = firstWalmartProductIdExcludingBarcode({
    values: input.explicitWalmartProductIdCandidates ?? [],
    upc,
    gtin,
  });
  if (explicitProductId) {
    const canonicalFromExplicitId =
      buildWalmartPublicListingUrlFromItemId(explicitProductId) ?? normalizedPublicWalmartUrl;
    return {
      normalizedPublicWalmartUrl: canonicalFromExplicitId,
      walmartProductIdFromUrl,
      preferredWalmartProductId: explicitProductId,
      preferredIdentifierType: "explicit_product_id",
      upc,
      gtin,
    };
  }

  const itemId = firstWalmartProductIdExcludingBarcode({
    values: input.walmartItemIdCandidates ?? [],
    upc,
    gtin,
  });
  if (itemId) {
    const canonicalFromItemId =
      buildWalmartPublicListingUrlFromItemId(itemId) ?? normalizedPublicWalmartUrl;
    return {
      normalizedPublicWalmartUrl: canonicalFromItemId,
      walmartProductIdFromUrl,
      preferredWalmartProductId: itemId,
      preferredIdentifierType: "walmart_item_id",
      upc,
      gtin,
    };
  }

  const payloadProductId = firstWalmartProductIdExcludingBarcode({
    values: input.walmartPayloadProductIdCandidates ?? [],
    upc,
    gtin,
  });
  if (payloadProductId) {
    const canonicalFromPayloadId =
      buildWalmartPublicListingUrlFromItemId(payloadProductId) ?? normalizedPublicWalmartUrl;
    return {
      normalizedPublicWalmartUrl: canonicalFromPayloadId,
      walmartProductIdFromUrl,
      preferredWalmartProductId: payloadProductId,
      preferredIdentifierType: "walmart_payload_product_id",
      upc,
      gtin,
    };
  }

  if (upc) {
    return {
      normalizedPublicWalmartUrl,
      walmartProductIdFromUrl,
      preferredWalmartProductId: "",
      preferredIdentifierType: "upc_skipped_for_product_lookup",
      upc,
      gtin,
    };
  }
  if (gtin) {
    return {
      normalizedPublicWalmartUrl,
      walmartProductIdFromUrl,
      preferredWalmartProductId: "",
      preferredIdentifierType: "gtin_skipped_for_product_lookup",
      upc,
      gtin,
    };
  }

  return {
    normalizedPublicWalmartUrl,
    walmartProductIdFromUrl,
    preferredWalmartProductId: "",
    preferredIdentifierType: "missing_product_identifier",
    upc,
    gtin,
  };
}

export function resolveCanonicalWalmartIdentifierFromProductRecord(input: {
  product: WalmartProductRecord;
  explicitProductId?: string;
  explicitPublicWalmartUrl?: string;
}): ResolvedWalmartPublicIdentifier {
  const product = input.product;
  const normalizedPayload =
    product.normalizedPayload && typeof product.normalizedPayload === "object"
      ? (product.normalizedPayload as Record<string, unknown>)
      : null;
  const rawPayload =
    product.rawPayload && typeof product.rawPayload === "object"
      ? (product.rawPayload as Record<string, unknown>)
      : null;

  return resolveCanonicalWalmartPublicIdentifier({
    publicWalmartUrlCandidates: [
      input.explicitPublicWalmartUrl,
      product.publicWalmartUrl,
      normalizedPayload?.publicWalmartUrl,
      rawPayload?.publicWalmartUrl,
      normalizedPayload?.itemPageUrl,
      normalizedPayload?.walmartItemPageUrl,
      rawPayload?.itemPageUrl,
      rawPayload?.walmartItemPageUrl,
      rawPayload?.productPageUrl,
      rawPayload?.productUrl,
      rawPayload?.canonicalUrl,
      rawPayload?.url,
      rawPayload?.itemUrl,
      rawPayload?.shareUrl,
      rawPayload?.buyUrl,
    ],
    explicitWalmartProductIdCandidates: [
      input.explicitProductId,
      product.publicWalmartProductId,
      normalizedPayload?.publicWalmartProductId,
      rawPayload?.publicWalmartProductId,
    ],
    walmartItemIdCandidates: [
      product.itemId,
      product.publicWalmartProductId,
      normalizedPayload?.itemId,
      normalizedPayload?.usItemId,
      rawPayload?.itemId,
      rawPayload?.usItemId,
      rawPayload?.usItemID,
      rawPayload?.id,
    ],
    walmartPayloadProductIdCandidates: [
      rawPayload?.productId,
      rawPayload?.product_id,
      normalizedPayload?.productId,
    ],
    upcCandidates: [product.upc, normalizedPayload?.upc, rawPayload?.upc],
    gtinCandidates: [product.gtin, normalizedPayload?.gtin, rawPayload?.gtin],
    nestedPayloadCandidates: [normalizedPayload, rawPayload],
  });
}
