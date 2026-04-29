import { validateDomaraImageUrls } from "@/lib/studio/domara/image-handling";
import type {
  CasaHudListingCandidate,
  CasaHudListingImageStatus,
  CasaHudListingManualCompletionStatus,
  CasaHudListingNeedsReviewField,
} from "@/lib/studio/domara/campaigns";

const BANNED_VIEWER_TERMS = [
  /\bcandidate listing pattern\b/gi,
  /\blisting pattern\b/gi,
  /\blocation signal\b/gi,
  /\btitle promise\b/gi,
  /\bvalidation phase\b/gi,
  /\bsource-backed discovery\b/gi,
  /\bdeterministic fallback\b/gi,
  /\bprovider metadata\b/gi,
  /\benough media\b/gi,
  /\bnext validation phase\b/gi,
  /\bfallback provider\b/gi,
  /\bmock\b/gi,
  /\bdemo workflow\b/gi,
];

function cleanText(value?: string | null) {
  if (typeof value !== "string") return undefined;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized || undefined;
}

function uniqueStrings(values: Array<string | undefined | null>): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => cleanText(value))
        .filter((value): value is string => Boolean(value)),
    ),
  );
}

function hasMeaningfulValue(value?: string | null) {
  const normalized = cleanText(value);
  return Boolean(normalized && !/needs review|pending/i.test(normalized));
}

function sanitizeViewerCopy(value?: string | null): string | undefined {
  let current = cleanText(value);
  if (!current) return undefined;

  for (const pattern of BANNED_VIEWER_TERMS) {
    current = current.replace(pattern, " ");
  }

  current = current.replace(/\s+/g, " ").replace(/\s+([,.;:!?])/g, "$1").trim();
  return current || undefined;
}

function firstStructuredImage(value: unknown): string | undefined {
  if (!value) return undefined;
  if (typeof value === "string") return cleanText(value);
  if (Array.isArray(value)) {
    for (const item of value) {
      const image = firstStructuredImage(item);
      if (image) return image;
    }
    return undefined;
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["url", "src", "image", "contentUrl", "thumbnailUrl"]) {
      const candidate = cleanText(typeof record[key] === "string" ? record[key] : undefined);
      if (candidate) return candidate;
    }
  }
  return undefined;
}

function formatListingPrice(price?: number, currency?: string, existingText?: string) {
  if (existingText && existingText.trim()) return existingText.trim();
  if (typeof price !== "number" || !Number.isFinite(price)) return undefined;
  if ((currency || "EUR").toUpperCase() === "EUR") return `€${price.toLocaleString("en-US")}`;
  if ((currency || "").toUpperCase() === "USD") return `$${price.toLocaleString("en-US")}`;
  return `${currency || "EUR"} ${price.toLocaleString("en-US")}`;
}

function buildKeyFeatures(listing: CasaHudListingCandidate): string[] {
  return uniqueStrings([
    listing.propertyType,
    typeof listing.rooms === "number" ? `${listing.rooms}+ rooms` : undefined,
    typeof listing.bedrooms === "number" ? `${listing.bedrooms} bedrooms` : undefined,
    typeof listing.bathrooms === "number" ? `${listing.bathrooms} bathrooms` : undefined,
    typeof listing.sizeSqm === "number" ? `${Math.round(listing.sizeSqm)} m² interior` : undefined,
    typeof listing.commercialSurfaceSqm === "number" ? `${Math.round(listing.commercialSurfaceSqm)} m² commercial` : undefined,
    typeof listing.landSizeSqm === "number" ? `${Math.round(listing.landSizeSqm).toLocaleString("en-US")} m² land` : undefined,
    listing.garageParking,
    listing.balcony ? "Balcony" : undefined,
    listing.terrace ? "Terrace" : undefined,
    listing.condition,
    listing.heating,
    listing.airConditioning,
    listing.energyClass,
  ]).slice(0, 8);
}

function buildLifestyleHighlights(listing: CasaHudListingCandidate): string[] {
  const manualAngle = sanitizeViewerCopy(listing.manualLifestyleAngle);
  if (manualAngle) return [manualAngle];

  return uniqueStrings([
    ...(listing.lifestyleHighlights || []),
    sanitizeViewerCopy(listing.summary),
    sanitizeViewerCopy(listing.descriptionSnippet),
  ]).slice(0, 4);
}

function pickFeaturedImage(listing: CasaHudListingCandidate) {
  const candidates = uniqueStrings([
    listing.manualFeaturedImageUrl,
    listing.featuredImageUrl,
    listing.metadataImageUrl,
    ...(listing.imageUrls || []),
    firstStructuredImage(listing.images),
    firstStructuredImage(listing.photos),
    firstStructuredImage(listing.gallery),
    firstStructuredImage(listing.photoUrls),
    firstStructuredImage(listing.photo_urls),
    listing.thumbnailUrl,
    listing.sourceThumbnailUrl,
  ]);
  const validated = validateDomaraImageUrls(candidates);
  const featuredImageUrl = validated.acceptedUrls[0];
  const imageUrls = validated.acceptedUrls;
  const imageStatus: CasaHudListingImageStatus =
    featuredImageUrl ? "available" : validated.skippedUrls.length > 0 ? "invalid" : "missing";

  return {
    featuredImageUrl,
    imageUrls,
    imageStatus,
    warnings: validated.warnings,
  };
}

function buildShortSummary(listing: CasaHudListingCandidate): string | undefined {
  const place = cleanText(listing.city || listing.locationText);
  const propertyType = cleanText(listing.propertyType)?.toLowerCase() || "home";
  const priceText = formatListingPrice(listing.price, listing.currency, listing.priceText);
  const facts = uniqueStrings([
    priceText ? `listed at ${priceText}` : undefined,
    typeof listing.bedrooms === "number" ? `${listing.bedrooms} bedrooms` : undefined,
    typeof listing.bathrooms === "number" ? `${listing.bathrooms} bathrooms` : undefined,
    typeof listing.rooms === "number" ? `${listing.rooms}+ rooms` : undefined,
    typeof listing.sizeSqm === "number" ? `${Math.round(listing.sizeSqm)} m² of interior space` : undefined,
    typeof listing.commercialSurfaceSqm === "number" ? `${Math.round(listing.commercialSurfaceSqm)} m² commercial surface` : undefined,
    typeof listing.landSizeSqm === "number" ? `${Math.round(listing.landSizeSqm).toLocaleString("en-US")} m² of land` : undefined,
    listing.garageParking,
  ]);
  const opener = place ? `In ${place}, this ${propertyType}` : `This ${propertyType}`;
  if (facts.length === 0) return sanitizeViewerCopy(listing.manualLifestyleAngle || listing.descriptionSnippet);
  return sanitizeViewerCopy(`${opener} is ${facts.join(", ")}.`);
}

function buildNarrationSeed(listing: CasaHudListingCandidate): string | undefined {
  const priceText = formatListingPrice(listing.price, listing.currency, listing.priceText);
  const place = cleanText(listing.city || listing.locationText);
  const propertyType = cleanText(listing.propertyType)?.toLowerCase() || "home";
  const lifestyleAngle = sanitizeViewerCopy(listing.manualLifestyleAngle) || buildLifestyleHighlights(listing)[0];
  const body = uniqueStrings([
    priceText ? `${priceText} for a ${cleanText(listing.condition)?.toLowerCase() || ""} ${propertyType}`.replace(/\s+/g, " ").trim() : undefined,
    typeof listing.bedrooms === "number" ? `${listing.bedrooms} bedrooms` : undefined,
    typeof listing.bathrooms === "number" ? `${listing.bathrooms} bathrooms` : undefined,
    typeof listing.sizeSqm === "number" ? `${Math.round(listing.sizeSqm)} m² of interior space` : undefined,
    typeof listing.landSizeSqm === "number" ? `${Math.round(listing.landSizeSqm).toLocaleString("en-US")} m² of land` : undefined,
    listing.garageParking,
  ]);

  const opening = place ? `In ${place}, this ${propertyType}` : `This ${propertyType}`;
  const seed = body.length > 0 ? `${opening} gives the viewer a grounded frame: ${body.join(", ")}.` : buildShortSummary(listing);
  return sanitizeViewerCopy(`${seed || ""}${lifestyleAngle ? ` ${lifestyleAngle}` : ""}`);
}

function buildNeedsReviewFields(
  listing: CasaHudListingCandidate,
  imageStatus: CasaHudListingImageStatus,
): CasaHudListingNeedsReviewField[] {
  const fields: CasaHudListingNeedsReviewField[] = [];
  if (listing.price === undefined) fields.push("price");
  if (!hasMeaningfulValue(listing.locationText)) fields.push("location");
  if (!hasMeaningfulValue(listing.propertyType)) fields.push("property_type");
  if (listing.bedrooms === undefined || listing.bathrooms === undefined) fields.push("bedrooms_bathrooms");
  if (listing.sizeSqm === undefined && listing.commercialSurfaceSqm === undefined) fields.push("size");
  if (listing.rooms === undefined) fields.push("rooms");
  if (listing.landSizeSqm === undefined) fields.push("land_size");
  if (!cleanText(listing.floorText) && listing.floorCount === undefined) fields.push("floor");
  if (!cleanText(listing.garageParking)) fields.push("parking");
  if (!cleanText(listing.condition)) fields.push("condition");
  if (!cleanText(listing.energyClass)) fields.push("energy");
  if (imageStatus !== "available") fields.push("images");
  if (!cleanText(listing.summary) && !cleanText(listing.descriptionSnippet) && !cleanText(listing.manualLifestyleAngle)) fields.push("summary");
  return fields;
}

function deriveManualCompletionStatus(listing: CasaHudListingCandidate, imageStatus: CasaHudListingImageStatus): CasaHudListingManualCompletionStatus {
  const completeness = [
    Boolean(cleanText(listing.title)),
    hasMeaningfulValue(listing.locationText),
    typeof listing.price === "number",
    hasMeaningfulValue(listing.propertyType),
    listing.rooms !== undefined || listing.bedrooms !== undefined || listing.bathrooms !== undefined,
    listing.sizeSqm !== undefined || listing.commercialSurfaceSqm !== undefined || listing.landSizeSqm !== undefined,
    Boolean(cleanText(listing.descriptionSnippet) || cleanText(listing.summary) || cleanText(listing.manualLifestyleAngle)),
    imageStatus === "available",
  ].filter(Boolean).length;

  if (completeness >= 7) return "completed";
  if (completeness >= 3 || (listing.manuallyCompletedFields || []).length > 0) return "partially_completed";
  return "incomplete";
}

export function normalizeImportedListingCandidate(
  listing: CasaHudListingCandidate,
  options?: {
    manuallyCompletedFields?: string[];
    manualUpdatedAt?: string;
  },
): CasaHudListingCandidate {
  if (listing.sourceType !== "imported_url") return listing;

  const featured = pickFeaturedImage(listing);
  const keyFeatures = listing.keyFeatures?.length ? uniqueStrings(listing.keyFeatures) : buildKeyFeatures(listing);
  const lifestyleHighlights = buildLifestyleHighlights(listing);
  const summary = buildShortSummary(listing) || sanitizeViewerCopy(listing.summary);
  const narrationSeed =
    buildNarrationSeed({
      ...listing,
      summary,
      keyFeatures,
      lifestyleHighlights,
    }) || sanitizeViewerCopy(listing.casaHudNarrationSeed || listing.preliminaryMatchNotes);
  const manuallyCompletedFields = uniqueStrings([...(listing.manuallyCompletedFields || []), ...(options?.manuallyCompletedFields || [])]);

  const normalized: CasaHudListingCandidate = {
    ...listing,
    title: cleanText(listing.title) || cleanText(listing.casaHudDisplayTitle) || `Imported listing from ${listing.sourceLabel || listing.sourceHost || "source URL"}`,
    priceText: formatListingPrice(listing.price, listing.currency, listing.priceText),
    featuredImageUrl: featured.featuredImageUrl || listing.featuredImageUrl,
    imageUrls: featured.imageUrls.length > 0 ? featured.imageUrls : listing.imageUrls,
    imageCount: featured.imageUrls.length > 0 ? Math.max(listing.imageCount || 0, featured.imageUrls.length) : listing.imageCount,
    imageStatus: featured.imageStatus,
    photoAvailability:
      featured.imageUrls.length >= 2 ? "available" : featured.imageUrls.length === 1 ? "limited" : listing.photoAvailability || "none",
    keyFeatures,
    lifestyleHighlights,
    summary,
    casaHudDisplayTitle: cleanText(listing.title) || cleanText(listing.casaHudDisplayTitle) || undefined,
    casaHudShortSummary: sanitizeViewerCopy(listing.casaHudShortSummary) || summary,
    casaHudNarrationSeed: narrationSeed,
    preliminaryMatchNotes: narrationSeed || summary || listing.preliminaryMatchNotes,
    extractionWarnings: uniqueStrings([...(listing.extractionWarnings || []), ...featured.warnings]),
    manuallyCompletedFields,
    manualUpdatedAt: options?.manualUpdatedAt || listing.manualUpdatedAt,
  };

  normalized.needsReviewFields = buildNeedsReviewFields(normalized, normalized.imageStatus || "missing");
  normalized.manualCompletionStatus = deriveManualCompletionStatus(normalized, normalized.imageStatus || "missing");
  normalized.features = uniqueStrings([...(listing.features || []), ...keyFeatures, ...lifestyleHighlights]).slice(0, 10);
  return normalized;
}
