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
  const asItemId = buildWalmartPublicListingUrlFromItemId(input as string | number | null | undefined);
  if (asItemId) return asItemId;

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

  for (const candidate of candidates) {
    const itemId = normalizeWalmartItemId(candidate);
    if (itemId) {
      return {
        url: buildWalmartPublicListingUrlFromItemId(itemId),
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
  for (const candidate of explicitItemIdCandidates) {
    const itemId = normalizeWalmartItemId(candidate);
    if (!itemId) continue;
    return {
      url: buildWalmartPublicListingUrlFromItemId(itemId),
      itemId,
      source: "item_id",
      confidence: "exact",
      warnings,
    };
  }
  if (explicitItemIdCandidates.some((entry) => asString(entry).trim().length > 0)) {
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
