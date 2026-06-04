const WALMART_HOST_SUFFIX = ".walmart.com";

type WalmartPublicListingSource =
  | "explicit_url"
  | "item_id"
  | "serpapi_result"
  | "walmart_search_result"
  | "hydration_diagnostic"
  | "media_source"
  | "unavailable";

type WalmartPublicListingConfidence = "exact" | "derived" | "unavailable";

export interface WalmartListingUrlSourceLike {
  explicitUrl?: unknown;
  explicitUrlCandidates?: unknown[];
  itemId?: unknown;
  itemIdCandidates?: unknown[];
  serpapiResult?: unknown;
  walmartSearchResult?: unknown;
  hydrationDiagnostic?: unknown;
  mediaSource?: unknown;
}

export interface WalmartPublicListingUrlResolution {
  url: string | null;
  itemId: string | null;
  source: WalmartPublicListingSource;
  confidence: WalmartPublicListingConfidence;
  warnings: string[];
}

const PLACEHOLDER_VALUES = new Set([
  "",
  "na",
  "n/a",
  "none",
  "null",
  "undefined",
  "unknown",
  "not available",
  "not_available",
  "not linked",
  "no link",
  "no listing",
  "unavailable",
]);
const LOOKUP_ONLY_IDENTIFIER_TYPES = new Set(["GTIN", "UPC", "EAN", "ISBN", "BARCODE", "SKU"]);
const LOOKUP_IDENTIFIER_HINT_REGEX = /\b(gtin|upc|ean|isbn|barcode|sku)\b/i;
const TRUSTED_ITEM_ID_HINT_REGEX =
  /\b(item[_\s-]?id|us[_\s-]?item[_\s-]?id|walmart[_\s-]?item[_\s-]?id|public[_\s-]?walmart[_\s-]?(item|product)[_\s-]?id)\b/i;

function asString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "bigint") return value.toString();
  return "";
}

function isPlaceholder(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return PLACEHOLDER_VALUES.has(normalized);
}

function normalizeWalmartItemId(value: unknown): string | null {
  const raw = asString(value);
  if (!raw || isPlaceholder(raw)) return null;
  return /^\d{6,20}$/.test(raw) ? raw : null;
}

function normalizeIdentifierType(value: unknown): string {
  const raw = asString(value);
  if (!raw) return "";
  return raw.replace(/[^a-z0-9_]/gi, "").toUpperCase();
}

interface ItemIdCandidateDescriptor {
  rawValue: string;
  provenance: string;
  productIdType: string;
  hadInput: boolean;
}

function describeItemIdCandidate(value: unknown): ItemIdCandidateDescriptor {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const node = value as Record<string, unknown>;
    const valueKeys = [
      "value",
      "itemId",
      "usItemId",
      "walmartItemId",
      "publicWalmartProductId",
      "publicWalmartItemId",
      "productId",
      "id",
    ];
    let selectedKey = "";
    let selectedValue = "";
    for (const key of valueKeys) {
      const candidate = asString(node[key]);
      if (!candidate) continue;
      selectedKey = key;
      selectedValue = candidate;
      break;
    }

    const explicitProvenance = asString(node.provenance ?? node.source ?? node.field ?? node.key);
    const provenance = explicitProvenance || selectedKey;
    const productIdType = normalizeIdentifierType(
      node.productIdType ?? node.product_id_type ?? (selectedKey === "productId" ? node.type : undefined)
    );
    const hadInput = Boolean(selectedValue) && !isPlaceholder(selectedValue);

    return {
      rawValue: selectedValue,
      provenance,
      productIdType,
      hadInput,
    };
  }

  const rawValue = asString(value);
  return {
    rawValue,
    provenance: "",
    productIdType: "",
    hadInput: Boolean(rawValue) && !isPlaceholder(rawValue),
  };
}

function resolveConfirmedItemIdCandidate(value: unknown): {
  itemId: string | null;
  hadInput: boolean;
  warning: string | null;
} {
  const descriptor = describeItemIdCandidate(value);
  if (!descriptor.hadInput) {
    return {
      itemId: null,
      hadInput: false,
      warning: null,
    };
  }

  if (descriptor.productIdType && LOOKUP_ONLY_IDENTIFIER_TYPES.has(descriptor.productIdType)) {
    return {
      itemId: null,
      hadInput: true,
      warning: "GTIN/UPC is a lookup identifier, not a Walmart public item ID.",
    };
  }

  if (descriptor.provenance && LOOKUP_IDENTIFIER_HINT_REGEX.test(descriptor.provenance)) {
    return {
      itemId: null,
      hadInput: true,
      warning: "GTIN/UPC is a lookup identifier, not a Walmart public item ID.",
    };
  }

  const itemId = normalizeWalmartItemId(descriptor.rawValue);
  if (!itemId) {
    return {
      itemId: null,
      hadInput: true,
      warning: "Item ID candidates were present but invalid.",
    };
  }

  if (descriptor.productIdType === "ITEM_ID") {
    return {
      itemId,
      hadInput: true,
      warning: null,
    };
  }

  if (!descriptor.provenance || !TRUSTED_ITEM_ID_HINT_REGEX.test(descriptor.provenance)) {
    return {
      itemId: null,
      hadInput: true,
      warning: "Item ID candidate lacked trusted Walmart ITEM_ID provenance.",
    };
  }

  return {
    itemId,
    hadInput: true,
    warning: null,
  };
}

function isWalmartHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === "walmart.com" || host.endsWith(WALMART_HOST_SUFFIX);
}

function toUrlCandidate(value: string): string | null {
  if (!value || isPlaceholder(value)) return null;

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  if (/^(?:www\.)?walmart\.com\//i.test(value)) {
    return `https://${value.replace(/^https?:\/\//i, "")}`;
  }

  if (/^\/?ip\//i.test(value)) {
    return `https://www.walmart.com/${value.replace(/^\/+/, "")}`;
  }

  return null;
}

function parseWalmartUrl(value: string): URL | null {
  const candidate = toUrlCandidate(value);
  if (!candidate) return null;

  try {
    const parsed = new URL(candidate);
    if (!isWalmartHost(parsed.hostname)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function extractWalmartItemIdFromUrl(input: string): string | null {
  const parsed = parseWalmartUrl(input);
  if (!parsed) return null;

  const segments = parsed.pathname
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);

  const ipIndex = segments.findIndex((segment) => segment.toLowerCase() === "ip");
  if (ipIndex < 0) return null;

  const trailing = segments.slice(ipIndex + 1);
  for (let index = trailing.length - 1; index >= 0; index -= 1) {
    const match = normalizeWalmartItemId(trailing[index]);
    if (match) return match;
  }

  return null;
}

export function buildWalmartPublicListingUrlFromItemId(
  itemId: string | number | null | undefined
): string | null {
  const normalized = normalizeWalmartItemId(itemId);
  if (!normalized) return null;
  return `https://www.walmart.com/ip/${normalized}`;
}

export function normalizeWalmartPublicListingUrl(input: unknown): string | null {
  const raw = asString(input);
  if (!raw || isPlaceholder(raw)) return null;

  const itemId = extractWalmartItemIdFromUrl(raw);
  if (!itemId) return null;
  return buildWalmartPublicListingUrlFromItemId(itemId);
}

function collectCandidates(value: unknown, bucket: string[], depth = 0): void {
  if (depth > 5 || value === null || value === undefined) return;

  if (typeof value === "string" || typeof value === "number" || typeof value === "bigint") {
    const candidate = asString(value);
    if (candidate) bucket.push(candidate);
    return;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      collectCandidates(entry, bucket, depth + 1);
    }
    return;
  }

  if (value && typeof value === "object") {
    for (const child of Object.values(value as Record<string, unknown>)) {
      collectCandidates(child, bucket, depth + 1);
    }
  }
}

function tryResolveFromUnknown(
  value: unknown
): { url: string | null; itemId: string | null; hadCandidates: boolean } {
  const candidates: string[] = [];
  collectCandidates(value, candidates);

  let sawNonPlaceholder = false;
  for (const candidate of candidates) {
    if (!isPlaceholder(candidate)) {
      sawNonPlaceholder = true;
      break;
    }
  }

  for (const candidate of candidates) {
    const normalizedUrl = normalizeWalmartPublicListingUrl(candidate);
    if (normalizedUrl) {
      const itemId = extractWalmartItemIdFromUrl(normalizedUrl);
      return {
        url: normalizedUrl,
        itemId,
        hadCandidates: true,
      };
    }
  }

  return {
    url: null,
    itemId: null,
    hadCandidates: sawNonPlaceholder,
  };
}

function mergeWarnings(warnings: string[], source: WalmartPublicListingSource, text: string): void {
  warnings.push(`[${source}] ${text}`);
}

export function resolveCanonicalWalmartPublicListingUrl(
  source: WalmartListingUrlSourceLike
): WalmartPublicListingUrlResolution {
  const warnings: string[] = [];

  const explicitCandidates: unknown[] = [
    source.explicitUrl,
    ...(source.explicitUrlCandidates ?? []),
  ];
  const explicit = tryResolveFromUnknown(explicitCandidates);
  if (explicit.url && explicit.itemId) {
    return {
      url: explicit.url,
      itemId: explicit.itemId,
      source: "explicit_url",
      confidence: "exact",
      warnings,
    };
  }
  if (explicit.hadCandidates) {
    mergeWarnings(warnings, "explicit_url", "No valid walmart.com /ip/ listing URL found.");
  }

  const explicitItemIdCandidates: unknown[] = [
    source.itemId,
    ...(source.itemIdCandidates ?? []),
  ];
  let sawItemIdCandidate = false;
  for (const candidate of explicitItemIdCandidates) {
    const resolvedCandidate = resolveConfirmedItemIdCandidate(candidate);
    if (!resolvedCandidate.hadInput) continue;
    sawItemIdCandidate = true;
    if (resolvedCandidate.warning) {
      mergeWarnings(warnings, "item_id", resolvedCandidate.warning);
    }
    const itemId = resolvedCandidate.itemId;
    if (!itemId) continue;
    return {
      url: buildWalmartPublicListingUrlFromItemId(itemId),
      itemId,
      source: "item_id",
      confidence: "exact",
      warnings,
    };
  }
  if (sawItemIdCandidate && !warnings.some((warning) => warning.startsWith("[item_id]"))) {
    mergeWarnings(warnings, "item_id", "Item ID candidates were present but invalid.");
  }

  const serpapi = tryResolveFromUnknown(source.serpapiResult);
  if (serpapi.url && serpapi.itemId) {
    return {
      url: serpapi.url,
      itemId: serpapi.itemId,
      source: "serpapi_result",
      confidence: "derived",
      warnings,
    };
  }
  if (serpapi.hadCandidates) {
    mergeWarnings(warnings, "serpapi_result", "SerpApi result did not include a canonical /ip/ listing.");
  }

  const walmartSearch = tryResolveFromUnknown(source.walmartSearchResult);
  if (walmartSearch.url && walmartSearch.itemId) {
    return {
      url: walmartSearch.url,
      itemId: walmartSearch.itemId,
      source: "walmart_search_result",
      confidence: "derived",
      warnings,
    };
  }
  if (walmartSearch.hadCandidates) {
    mergeWarnings(
      warnings,
      "walmart_search_result",
      "Walmart search result did not include a canonical /ip/ listing."
    );
  }

  const hydrationDiagnostic = tryResolveFromUnknown(source.hydrationDiagnostic);
  if (hydrationDiagnostic.url && hydrationDiagnostic.itemId) {
    return {
      url: hydrationDiagnostic.url,
      itemId: hydrationDiagnostic.itemId,
      source: "hydration_diagnostic",
      confidence: "derived",
      warnings,
    };
  }
  if (hydrationDiagnostic.hadCandidates) {
    mergeWarnings(
      warnings,
      "hydration_diagnostic",
      "Hydration diagnostics did not include a canonical /ip/ listing."
    );
  }

  const mediaSource = tryResolveFromUnknown(source.mediaSource);
  if (mediaSource.url && mediaSource.itemId) {
    return {
      url: mediaSource.url,
      itemId: mediaSource.itemId,
      source: "media_source",
      confidence: "derived",
      warnings,
    };
  }
  if (mediaSource.hadCandidates) {
    mergeWarnings(
      warnings,
      "media_source",
      "Media source did not include a canonical /ip/ listing."
    );
  }

  return {
    url: null,
    itemId: null,
    source: "unavailable",
    confidence: "unavailable",
    warnings,
  };
}
