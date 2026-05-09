import "server-only";

import type {
  WalmartImageMatchMethod,
  WalmartImageSource,
  WalmartImageStatus,
  WalmartImageSyncStatus,
  WalmartInventoryStatus,
  WalmartProductRecord,
} from "@/lib/ecomviper/walmart/walmart-types";

export interface NormalizeProductInput {
  sku: string;
  title: string;
  brand: string;
  upc?: string;
  gtin?: string;
  wpid?: string;
  itemId?: string;
  publishedStatus?: string;
  price: number;
  inventoryQuantity?: number | null;
  inventoryStatus?: WalmartInventoryStatus;
  imageUrl?: string;
  galleryImageUrls?: string[];
  variantImageUrls?: string[];
  imageStatus?: WalmartImageStatus;
  imageSyncStatus?: WalmartImageSyncStatus;
  imageMatchMethod?: WalmartImageMatchMethod;
  matchedItemId?: string;
  lastImageSyncedAt?: string | null;
  imageSource?: WalmartImageSource;
  imageStatusMessage?: WalmartProductRecord["imageStatusMessage"];
  status?: WalmartProductRecord["status"];
  issues?: string[];
  rawPayload?: unknown;
  attributes?: Record<string, string>;
  description?: string;
  shortDescription?: string;
  bulletPoints?: string[];
}

const IMAGE_ISSUE_MESSAGES = [
  "Image not provided by Walmart catalog",
  "Image enrichment source not configured",
  "Image not provided by Walmart Item Search",
  "Image match ambiguous",
  "Image sync failed",
  "Image enrichment not synced",
] as const;

function normalizeImageIssue(message: string): string | null {
  const trimmed = message.trim();
  if (!trimmed) return null;
  return IMAGE_ISSUE_MESSAGES.find((entry) => entry === trimmed) ?? null;
}

export function normalizeWalmartProduct(input: NormalizeProductInput): WalmartProductRecord {
  const now = new Date().toISOString();
  const hasImage = Boolean(input.imageUrl);
  const imageStatus: WalmartImageStatus =
    input.imageStatus ?? (hasImage ? "image_available" : "catalog_missing");
  const imageSyncStatus: WalmartImageSyncStatus =
    input.imageSyncStatus ?? (hasImage ? "found" : imageStatus === "enrichment_unconfigured" ? "not_synced" : "not_found");
  const imageStatusMessage =
    input.imageStatusMessage ??
    (imageStatus === "image_available"
      ? "Image available"
      : imageStatus === "catalog_missing"
        ? "Image not provided by Walmart catalog"
        : "Image enrichment source not configured");

  const inventoryQuantity =
    typeof input.inventoryQuantity === "number" && Number.isFinite(input.inventoryQuantity)
      ? input.inventoryQuantity
      : 0;
  const inventoryStatus = input.inventoryStatus ?? "known";
  const issues: string[] = (input.issues ?? [])
    .map((issue) => issue.trim())
    .filter((issue) => issue.length > 0);

  if (issues.length === 0) {
    const normalizedImageIssue = normalizeImageIssue(imageStatusMessage);
    if (normalizedImageIssue) {
      issues.push(normalizedImageIssue);
      if (
        normalizedImageIssue === "Image not provided by Walmart catalog" &&
        imageStatus === "enrichment_unconfigured"
      ) {
        issues.push("Image enrichment source not configured");
      }
    } else if (imageStatus === "catalog_missing") {
      issues.push("Image not provided by Walmart catalog");
    } else if (imageStatus === "enrichment_unconfigured") {
      issues.push("Image not provided by Walmart catalog");
      issues.push("Image enrichment source not configured");
    }
  }
  if (!input.price || input.price <= 0) issues.push("Price missing");
  if (inventoryStatus === "out_of_stock" || (inventoryStatus === "known" && inventoryQuantity <= 0)) {
    issues.push("Out of stock");
  }
  const dedupedIssues = Array.from(new Set(issues));

  return {
    id: `walmart_${input.sku.toLowerCase()}`,
    marketplace: "walmart",
    sku: input.sku,
    externalItemId: `wm_${input.sku.toLowerCase()}`,
    upc: input.upc?.trim() || undefined,
    gtin: input.gtin?.trim() || undefined,
    wpid: input.wpid?.trim() || undefined,
    itemId: input.itemId?.trim() || undefined,
    publishedStatus: input.publishedStatus?.trim() || undefined,
    title: input.title,
    brand: input.brand,
    category: "Supplements",
    price: Number(input.price.toFixed(2)),
    inventoryQuantity,
    inventoryStatus,
    status: input.status ?? (issues.length ? "attention" : "active"),
    imageUrl: input.imageUrl ?? "",
    galleryImageUrls: input.galleryImageUrls ?? [],
    variantImageUrls: input.variantImageUrls ?? [],
    imageStatus,
    imageStatusMessage,
    imageSyncStatus,
    imageMatchMethod: input.imageMatchMethod,
    matchedItemId: input.matchedItemId?.trim() || undefined,
    lastImageSyncedAt: input.lastImageSyncedAt ?? null,
    imageSource: input.imageSource ?? (imageStatus === "image_available" ? "walmart_catalog" : "none"),
    issues: dedupedIssues,
    attributes: input.attributes ?? {},
    shortDescription: input.shortDescription ?? "",
    longDescription: input.description ?? "",
    bulletPoints: input.bulletPoints ?? [],
    rawPayload: input.rawPayload ?? {
      sku: input.sku,
      title: input.title,
      brand: input.brand,
      price: input.price,
      inventory: inventoryQuantity,
      inventoryStatus,
    },
    normalizedPayload: {
      sku: input.sku,
      title: input.title,
      brand: input.brand,
      price: input.price,
      inventoryQuantity,
      inventoryStatus,
      imageSyncStatus,
      attributes: input.attributes ?? {},
    },
    lastSyncedAt: now,
    createdAt: now,
    updatedAt: now,
  };
}
