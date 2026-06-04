import "server-only";

export const SHOPIFY_POLICY_FIELDS = [
  "privacyPolicy",
  "refundPolicy",
  "shippingPolicy",
  "termsOfService",
] as const;

export type ShopifyPolicyField = (typeof SHOPIFY_POLICY_FIELDS)[number];
export type ShopifyUnsupportedExtractionSource = "none" | "path" | "message" | "mixed";

export interface ShopifyUnsupportedPolicyFieldExtractionResult {
  unsupportedPolicyFields: ShopifyPolicyField[];
  extractionSource: ShopifyUnsupportedExtractionSource;
}

export interface ShopifyPolicyCapabilitySnapshot {
  storeDomain: string;
  apiVersion: string;
  supportedPolicyFields: ShopifyPolicyField[];
  unsupportedPolicyFields: ShopifyPolicyField[];
  detectedAt: string;
  detectionSource: "probe_success" | "probe_error_parse" | "runtime_refresh";
}

interface CachedPolicyCapability {
  snapshot: ShopifyPolicyCapabilitySnapshot;
  cachedAtMs: number;
}

const POLICY_CAPABILITY_CACHE_TTL_MS = 15 * 60 * 1_000;

declare global {
  var __ecomviper_shopify_policy_capability_cache__: Map<string, CachedPolicyCapability> | undefined;
}

function getCacheStore(): Map<string, CachedPolicyCapability> {
  if (!globalThis.__ecomviper_shopify_policy_capability_cache__) {
    globalThis.__ecomviper_shopify_policy_capability_cache__ = new Map<string, CachedPolicyCapability>();
  }
  return globalThis.__ecomviper_shopify_policy_capability_cache__;
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

export function shopifyPolicyCapabilityCacheKey(storeDomain: string, apiVersion: string): string {
  return `${normalize(storeDomain)}:${normalize(apiVersion)}`;
}

function uniquePolicyFields(fields: ShopifyPolicyField[]): ShopifyPolicyField[] {
  const seen = new Set<ShopifyPolicyField>();
  const deduped: ShopifyPolicyField[] = [];

  for (const field of fields) {
    if (seen.has(field)) continue;
    seen.add(field);
    deduped.push(field);
  }

  return deduped;
}

function sortPolicyFields(fields: ShopifyPolicyField[]): ShopifyPolicyField[] {
  const order = new Map<ShopifyPolicyField, number>(
    SHOPIFY_POLICY_FIELDS.map((field, index) => [field, index])
  );
  return [...fields].sort((left, right) => (order.get(left) ?? 999) - (order.get(right) ?? 999));
}

export function getCachedShopifyPolicyCapability(
  storeDomain: string,
  apiVersion: string
): ShopifyPolicyCapabilitySnapshot | null {
  const key = shopifyPolicyCapabilityCacheKey(storeDomain, apiVersion);
  const cached = getCacheStore().get(key);
  if (!cached) return null;

  if (Date.now() - cached.cachedAtMs > POLICY_CAPABILITY_CACHE_TTL_MS) {
    getCacheStore().delete(key);
    return null;
  }

  return cached.snapshot;
}

export function saveShopifyPolicyCapability(snapshot: ShopifyPolicyCapabilitySnapshot): void {
  const key = shopifyPolicyCapabilityCacheKey(snapshot.storeDomain, snapshot.apiVersion);
  getCacheStore().set(key, {
    snapshot: {
      ...snapshot,
      supportedPolicyFields: sortPolicyFields(uniquePolicyFields(snapshot.supportedPolicyFields)),
      unsupportedPolicyFields: sortPolicyFields(uniquePolicyFields(snapshot.unsupportedPolicyFields)),
    },
    cachedAtMs: Date.now(),
  });
}

function parsePolicyFieldName(value: unknown): ShopifyPolicyField | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized) return null;

  const known = SHOPIFY_POLICY_FIELDS.find((field) => field.toLowerCase() === normalized.toLowerCase());
  return known ?? null;
}

function extractUnsupportedFromMessage(message: string): ShopifyPolicyField[] {
  const fields: ShopifyPolicyField[] = [];
  const regex = /field\s+['"]?([a-zA-Z0-9_]+)['"]?\s+(?:doesn't exist|cannot be queried)/gi;

  let match: RegExpExecArray | null = null;
  while ((match = regex.exec(message)) !== null) {
    const parsed = parsePolicyFieldName(match[1]);
    if (parsed) fields.push(parsed);
  }

  return uniquePolicyFields(fields);
}

function extractUnsupportedFromPath(path: unknown): ShopifyPolicyField[] {
  if (!Array.isArray(path)) return [];

  const fields: ShopifyPolicyField[] = [];
  for (const segment of path) {
    const parsed = parsePolicyFieldName(segment);
    if (parsed) fields.push(parsed);
  }

  return uniquePolicyFields(fields);
}

export function extractUnsupportedPolicyFieldsFromGraphqlErrorsWithMetadata(
  errors: Array<{ message?: unknown; path?: unknown }>
): ShopifyUnsupportedPolicyFieldExtractionResult {
  const unsupported: ShopifyPolicyField[] = [];
  let usedPath = false;
  let usedMessage = false;

  for (const error of errors) {
    const fromPath = extractUnsupportedFromPath(error.path);
    if (fromPath.length > 0) {
      unsupported.push(...fromPath);
      usedPath = true;
      continue;
    }

    const fromMessage =
      typeof error.message === "string" ? extractUnsupportedFromMessage(error.message) : [];
    if (fromMessage.length > 0) {
      unsupported.push(...fromMessage);
      usedMessage = true;
    }
  }

  const unsupportedPolicyFields = sortPolicyFields(uniquePolicyFields(unsupported));
  const extractionSource: ShopifyUnsupportedExtractionSource = usedPath
    ? usedMessage
      ? "mixed"
      : "path"
    : usedMessage
      ? "message"
      : "none";

  return {
    unsupportedPolicyFields,
    extractionSource,
  };
}

export function extractUnsupportedPolicyFieldsFromGraphqlErrors(
  errors: Array<{ message?: unknown; path?: unknown }>
): ShopifyPolicyField[] {
  return extractUnsupportedPolicyFieldsFromGraphqlErrorsWithMetadata(errors).unsupportedPolicyFields;
}

export function buildShopPolicySelection(fields: ShopifyPolicyField[]): string {
  return fields
    .map(
      (field) => `      ${field} {
        id
        title
        body
        url
      }`
    )
    .join("\n");
}

export function buildShopPolicyQuery(
  fields: ShopifyPolicyField[],
  operationName = "ShopifyShopPolicyHydration"
): string {
  const selection = buildShopPolicySelection(fields);
  return `#graphql
  query ${operationName} {
    shop {
      id
${selection}
    }
  }
`;
}
