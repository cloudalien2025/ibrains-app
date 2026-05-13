import type { WalmartGeneratedImageType } from "@/lib/ecomviper/walmart/walmart-types";

const MAX_FILENAME_BASE_LENGTH = 140;
const MAX_ALT_TEXT_LENGTH = 180;
const MAX_SLUG_SEGMENT_LENGTH = 56;

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function stripDiacritics(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
}

function slugify(value: string, maxLength = MAX_SLUG_SEGMENT_LENGTH): string {
  const normalized = stripDiacritics(normalizeWhitespace(value)).toLowerCase();
  const slug = normalized
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");
  return slug;
}

function dedupeOrdered(values: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const value of values) {
    const normalized = value.trim();
    if (!normalized) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    output.push(normalized);
  }
  return output;
}

function imageTypeSlug(imageType: WalmartGeneratedImageType): string {
  if (imageType === "supplement_facts") return "supplement-facts";
  if (imageType === "ingredient_spotlight") return "ingredient-spotlight";
  if (imageType === "product_hero") return "product-hero";
  return "lifestyle";
}

function normalizeExtension(extension: string): string {
  const normalized = extension.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (normalized === "jpeg") return "jpg";
  if (normalized === "jpg") return "jpg";
  if (normalized === "webp") return "webp";
  if (normalized === "gif") return "gif";
  if (normalized === "avif") return "avif";
  if (normalized === "png") return "png";
  return "png";
}

export function extensionFromMimeType(mimeType: string): string {
  const normalized = normalizeWhitespace(mimeType).toLowerCase().split(";")[0] || "";
  if (normalized === "image/jpeg" || normalized === "image/jpg") return "jpg";
  if (normalized === "image/webp") return "webp";
  if (normalized === "image/gif") return "gif";
  if (normalized === "image/avif") return "avif";
  return "png";
}

export function sanitizeSeoFilename(value: string, mimeType: string): string {
  const normalized = normalizeWhitespace(value).toLowerCase();
  const extensionFromMime = extensionFromMimeType(mimeType);
  if (!normalized) {
    return `generated-media.${extensionFromMime}`;
  }

  const lastDot = normalized.lastIndexOf(".");
  const basenameRaw = lastDot > 0 ? normalized.slice(0, lastDot) : normalized;
  const extensionRaw = lastDot > 0 ? normalized.slice(lastDot + 1) : "";

  const basename = slugify(basenameRaw, MAX_FILENAME_BASE_LENGTH) || "generated-media";
  const extension = extensionRaw ? normalizeExtension(extensionRaw) : extensionFromMime;

  return `${basename}.${extension}`;
}

export function buildGeneratedMediaSeoFilename(input: {
  brand?: string;
  productTitle?: string;
  sku: string;
  imageType: WalmartGeneratedImageType;
  mimeType: string;
}): string {
  const parts = dedupeOrdered(
    [
      slugify(input.brand ?? ""),
      slugify(input.productTitle ?? "", 72),
      slugify(input.sku ?? "", 32),
      imageTypeSlug(input.imageType),
    ].filter(Boolean)
  );

  let basename = parts.join("-").replace(/-+/g, "-").replace(/^-+|-+$/g, "");
  if (!basename) {
    basename = `generated-media-${imageTypeSlug(input.imageType)}`;
  }
  if (basename.length > MAX_FILENAME_BASE_LENGTH) {
    basename = basename.slice(0, MAX_FILENAME_BASE_LENGTH).replace(/-+$/g, "");
  }

  return `${basename}.${extensionFromMimeType(input.mimeType)}`;
}

function combineBrandAndTitle(brand: string, title: string): string {
  const cleanedBrand = normalizeWhitespace(brand);
  const cleanedTitle = normalizeWhitespace(title);
  if (!cleanedBrand && !cleanedTitle) return "";
  if (!cleanedBrand) return cleanedTitle;
  if (!cleanedTitle) return cleanedBrand;

  const brandLower = cleanedBrand.toLowerCase();
  const titleLower = cleanedTitle.toLowerCase();
  if (titleLower.includes(brandLower)) {
    return cleanedTitle;
  }
  return `${cleanedBrand} ${cleanedTitle}`;
}

function withSku(identity: string, sku: string): string {
  const cleanedIdentity = normalizeWhitespace(identity);
  const cleanedSku = normalizeWhitespace(sku);
  if (!cleanedSku) return cleanedIdentity;
  if (!cleanedIdentity) return cleanedSku;
  if (cleanedIdentity.toLowerCase().includes(cleanedSku.toLowerCase())) {
    return cleanedIdentity;
  }
  return `${cleanedIdentity} ${cleanedSku}`;
}

function clampAltText(value: string): string {
  const cleaned = normalizeWhitespace(value);
  if (cleaned.length <= MAX_ALT_TEXT_LENGTH) return cleaned;
  return `${cleaned.slice(0, MAX_ALT_TEXT_LENGTH - 1).trim()}…`;
}

export function buildGeneratedMediaAltText(input: {
  brand?: string;
  productTitle?: string;
  sku: string;
  imageType: WalmartGeneratedImageType;
}): string {
  const identity = combineBrandAndTitle(input.brand ?? "", input.productTitle ?? "");
  const identityWithSku = withSku(identity, input.sku);
  const fallbackIdentity = withSku(input.brand ?? "", input.sku) || withSku(input.productTitle ?? "", input.sku) || "Walmart product";
  const resolvedIdentity = identityWithSku || fallbackIdentity;

  if (input.imageType === "supplement_facts") {
    return clampAltText(`${resolvedIdentity} supplement facts image`);
  }
  if (input.imageType === "ingredient_spotlight") {
    return clampAltText(`${resolvedIdentity} ingredient spotlight image for Walmart listing`);
  }
  if (input.imageType === "product_hero") {
    return clampAltText(`${resolvedIdentity} product hero image for Walmart listing`);
  }
  return clampAltText(`${resolvedIdentity} lifestyle product image for Walmart listing`);
}

export function buildGeneratedMediaPreviewPath(assetId: string, seoFilename?: string): string {
  const normalizedAssetId = normalizeWhitespace(assetId);
  if (!normalizedAssetId) return "/api/ecomviper/walmart/generated-media";
  const normalizedSeoFilename = seoFilename ? sanitizeSeoFilename(seoFilename, "image/png") : "";
  return normalizedSeoFilename
    ? `/api/ecomviper/walmart/generated-media/${encodeURIComponent(normalizedAssetId)}/${encodeURIComponent(normalizedSeoFilename)}`
    : `/api/ecomviper/walmart/generated-media/${encodeURIComponent(normalizedAssetId)}`;
}
