import type {
  WalmartImageMatchMethod,
  WalmartImageSource,
  WalmartImageSyncStatus,
  WalmartProductRecord,
} from "@/lib/ecomviper/walmart/walmart-types";

export interface WalmartNormalizedDraftImageFields {
  imageUrl?: string;
  primaryImageUrl?: string;
  additionalImageUrls?: string[];
  galleryImageUrls?: string[];
  variantImageUrls?: string[];
  imageSource?: WalmartImageSource;
  imageMatchMethod?: WalmartImageMatchMethod;
  imageSyncStatus?: WalmartImageSyncStatus;
  imageSyncReason?: string;
  publicWalmartUrl?: string;
  publicWalmartProductId?: string;
  lastImageSyncedAt?: string;
}

const WALMART_IMAGE_SOURCES = new Set<WalmartImageSource>([
  "walmart_item_report",
  "walmart_catalog",
  "walmart_item_search",
  "serpapi_walmart_brand_search",
  "public_walmart_listing_serpapi",
  "manual",
  "shopify_placeholder",
  "manual_placeholder",
  "none",
]);

const WALMART_IMAGE_SYNC_STATUSES = new Set<WalmartImageSyncStatus>([
  "found",
  "not_found",
  "ambiguous",
  "failed",
  "not_synced",
]);

const WALMART_IMAGE_MATCH_METHODS = new Set<WalmartImageMatchMethod>([
  "gtin",
  "upc",
  "itemId",
  "wpid",
  "query",
  "catalog",
  "public_url_product_id",
  "serpapi_product_id",
  "serpapi_search_upc",
  "serpapi_search_gtin",
  "serpapi_search_title_brand",
  "item_report_sku",
  "item_report_productid",
  "item_report_itemid",
  "item_report_wpid",
  "item_report_title_brand",
]);

function asObject(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeHttpsImageUrl(value: unknown): string {
  const raw = asString(value);
  if (!raw) return "";

  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
    parsed.protocol = "https:";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return "";
  }
}

function listFromUnknown(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => listFromUnknown(entry));
  }

  const asNode = asObject(value);
  if (asNode) {
    return listFromUnknown(
      asNode.url ??
        asNode.imageUrl ??
        asNode.primaryImageUrl ??
        asNode.src ??
        asNode.value ??
        asNode.href ??
        ""
    );
  }

  const raw = asString(value);
  if (!raw) return [];
  return raw
    .split(/\r?\n|[;,|]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function normalizeWalmartImageUrlList(values: unknown[]): string[] {
  const normalized: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    for (const candidate of listFromUnknown(value)) {
      const httpsUrl = normalizeHttpsImageUrl(candidate);
      if (!httpsUrl || seen.has(httpsUrl)) continue;
      seen.add(httpsUrl);
      normalized.push(httpsUrl);
    }
  }

  return normalized;
}

export function normalizeDraftImageFields(input: unknown): WalmartNormalizedDraftImageFields {
  const record = asObject(input) ?? {};
  const primaryCandidates = [
    record.imageUrl,
    record.primaryImageUrl,
    record.mainImageUrl,
  ];

  const initialPrimary = normalizeWalmartImageUrlList(primaryCandidates)[0] ?? "";
  const galleryCandidates = normalizeWalmartImageUrlList([
    record.additionalImageUrls,
    record.galleryImageUrls,
    record.imageUrls,
    record.additionalImages,
    record.variantImageUrls,
  ]);

  const variantImageUrls = normalizeWalmartImageUrlList([record.variantImageUrls]);
  const galleryImageUrls = normalizeWalmartImageUrlList([
    initialPrimary,
    ...galleryCandidates,
    ...variantImageUrls,
  ]);
  const primaryImageUrl = initialPrimary || galleryImageUrls[0] || "";
  const additionalImageUrls = galleryImageUrls.filter((entry) => entry !== primaryImageUrl);

  const imageSourceRaw = asString(record.imageSource);
  const imageSyncStatusRaw = asString(record.imageSyncStatus);
  const imageMatchMethodRaw = asString(record.imageMatchMethod);

  const imageSource = WALMART_IMAGE_SOURCES.has(imageSourceRaw as WalmartImageSource)
    ? (imageSourceRaw as WalmartImageSource)
    : undefined;
  const imageSyncStatus = WALMART_IMAGE_SYNC_STATUSES.has(
    imageSyncStatusRaw as WalmartImageSyncStatus
  )
    ? (imageSyncStatusRaw as WalmartImageSyncStatus)
    : undefined;
  const imageMatchMethod = WALMART_IMAGE_MATCH_METHODS.has(
    imageMatchMethodRaw as WalmartImageMatchMethod
  )
    ? (imageMatchMethodRaw as WalmartImageMatchMethod)
    : undefined;

  const imageSyncReason = asString(record.imageSyncReason) || undefined;
  const publicWalmartUrl = asString(record.publicWalmartUrl) || undefined;
  const publicWalmartProductId = asString(record.publicWalmartProductId) || undefined;
  const lastImageSyncedAt = asString(record.lastImageSyncedAt) || undefined;

  return {
    imageUrl: primaryImageUrl || undefined,
    primaryImageUrl: primaryImageUrl || undefined,
    additionalImageUrls:
      additionalImageUrls.length > 0 ? additionalImageUrls : undefined,
    galleryImageUrls: galleryImageUrls.length > 0 ? galleryImageUrls : undefined,
    variantImageUrls: variantImageUrls.length > 0 ? variantImageUrls : undefined,
    imageSource,
    imageSyncStatus,
    imageMatchMethod,
    imageSyncReason,
    publicWalmartUrl,
    publicWalmartProductId,
    lastImageSyncedAt,
  };
}

export function applyDraftImageFieldsToProduct(input: {
  product: WalmartProductRecord;
  draftPayload: unknown;
}): WalmartProductRecord {
  const normalized = normalizeDraftImageFields(input.draftPayload);
  const hasDraftImage = Boolean(
    normalized.imageUrl ||
      (normalized.galleryImageUrls && normalized.galleryImageUrls.length > 0)
  );

  const metadataPatch: Partial<WalmartProductRecord> = {};
  if (normalized.imageSource) metadataPatch.imageSource = normalized.imageSource;
  if (normalized.imageSyncStatus) metadataPatch.imageSyncStatus = normalized.imageSyncStatus;
  if (normalized.imageMatchMethod) metadataPatch.imageMatchMethod = normalized.imageMatchMethod;
  if (normalized.imageSyncReason) metadataPatch.imageSyncReason = normalized.imageSyncReason;
  if (normalized.publicWalmartUrl) metadataPatch.publicWalmartUrl = normalized.publicWalmartUrl;
  if (normalized.publicWalmartProductId) {
    metadataPatch.publicWalmartProductId = normalized.publicWalmartProductId;
  }
  if (normalized.lastImageSyncedAt) metadataPatch.lastImageSyncedAt = normalized.lastImageSyncedAt;

  if (!hasDraftImage) {
    const metadataWithoutStatus: Partial<WalmartProductRecord> = {};
    if (normalized.publicWalmartUrl) metadataWithoutStatus.publicWalmartUrl = normalized.publicWalmartUrl;
    if (normalized.publicWalmartProductId) {
      metadataWithoutStatus.publicWalmartProductId = normalized.publicWalmartProductId;
    }

    return Object.keys(metadataWithoutStatus).length > 0
      ? { ...input.product, ...metadataWithoutStatus }
      : input.product;
  }

  const primaryImageUrl = normalized.imageUrl || input.product.imageUrl;
  const galleryImageUrls = normalizeWalmartImageUrlList([
    primaryImageUrl,
    ...(normalized.galleryImageUrls ?? []),
  ]);
  const variantImageUrls = normalizeWalmartImageUrlList([
    ...(normalized.variantImageUrls ?? []),
  ]);
  const nextIssues = input.product.issues.filter(
    (issue) =>
      issue !== "Image not provided by Walmart catalog" &&
      issue !== "Image enrichment source not configured" &&
      issue !== "Image not provided by Walmart Item Search" &&
      issue !== "Image match ambiguous" &&
      issue !== "Image sync failed" &&
      issue !== "Image enrichment not synced"
  );

  return {
    ...input.product,
    ...metadataPatch,
    imageUrl: primaryImageUrl,
    primaryImageUrl: primaryImageUrl,
    galleryImageUrls,
    variantImageUrls,
    imageStatus: "image_available",
    imageStatusMessage: "Image available",
    imageSource:
      normalized.imageSource ??
      metadataPatch.imageSource ??
      input.product.imageSource ??
      "manual",
    imageSyncStatus:
      normalized.imageSyncStatus ??
      metadataPatch.imageSyncStatus ??
      input.product.imageSyncStatus ??
      "found",
    issues: nextIssues,
  };
}
