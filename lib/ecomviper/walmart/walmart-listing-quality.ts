import crypto from "crypto";
import type {
  WalmartAiSuggestion,
  WalmartListingQualityAssessment,
  WalmartListingRecommendation,
  WalmartOptimizationProposalRecord,
  WalmartProductRecord,
} from "@/lib/ecomviper/walmart/walmart-types";

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function inferShortDescriptionFromLongDescription(longDescription: string): string {
  const trimmed = longDescription.trim();
  if (!trimmed) return "";
  const firstSentence = trimmed.split(/[.!?]/).find((entry) => entry.trim().length > 0);
  const compact = (firstSentence ?? trimmed).trim();
  return compact.length > 180 ? `${compact.slice(0, 177)}...` : compact;
}

function toStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((entry) => asText(entry))
      .filter((entry) => entry.length > 0);
  }

  const normalized = asText(value);
  if (!normalized) return [];

  return normalized
    .split(/\r?\n|[;|]+/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function toAttributeRecord(value: unknown): Record<string, string> {
  const direct = asObject(value);
  if (direct) {
    const mapped: Record<string, string> = {};
    for (const [key, raw] of Object.entries(direct)) {
      const normalizedKey = key.trim();
      const normalizedValue = asText(raw);
      if (!normalizedKey || !normalizedValue) continue;
      mapped[normalizedKey] = normalizedValue;
    }
    return mapped;
  }

  const asString = asText(value);
  if (!asString) return {};

  try {
    const parsed = JSON.parse(asString) as unknown;
    const parsedObject = asObject(parsed);
    if (!parsedObject) return {};

    const mapped: Record<string, string> = {};
    for (const [key, raw] of Object.entries(parsedObject)) {
      const normalizedKey = key.trim();
      const normalizedValue = asText(raw);
      if (!normalizedKey || !normalizedValue) continue;
      mapped[normalizedKey] = normalizedValue;
    }
    return mapped;
  } catch {
    return {};
  }
}

function countMeaningfulAttributes(attributes: Record<string, string>): number {
  return Object.values(attributes).filter((value) => value.trim().length > 0).length;
}

function readDraftString(draft: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(draft, key)) continue;
    return asText(draft[key]);
  }
  return null;
}

function readDraftNumber(draft: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(draft, key)) continue;
    const value = asNumber(draft[key]);
    if (value !== null) return value;
  }
  return null;
}

function readDraftList(draft: Record<string, unknown>, keys: string[]): string[] | null {
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(draft, key)) continue;
    return toStringList(draft[key]);
  }
  return null;
}

function readDraftAttributes(
  draft: Record<string, unknown>,
  keys: string[]
): Record<string, string> | null {
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(draft, key)) continue;
    return toAttributeRecord(draft[key]);
  }
  return null;
}

export function mergeWalmartDraftPayloadIntoProduct(
  product: WalmartProductRecord,
  draftPayload: unknown
): WalmartProductRecord {
  const draft = asObject(draftPayload);
  if (!draft) return product;

  const title = readDraftString(draft, ["title"]) ?? product.title;
  const shortDescription =
    readDraftString(draft, ["shortDescription", "short_desc"]) ??
    product.shortDescription;
  const longDescription =
    readDraftString(draft, [
      "longDescription",
      "suggestedLongDescription",
      "suggestedDescription",
      "description",
      "productDescription",
    ]) ?? product.longDescription;

  const bulletPointsFromDraft = readDraftList(draft, [
    "bulletPoints",
    "suggestedBullets",
    "suggestedBulletPoints",
    "keyFeatures",
    "bullets",
  ]);

  const bulletPoints =
    bulletPointsFromDraft && bulletPointsFromDraft.length > 0
      ? bulletPointsFromDraft
      : product.bulletPoints;

  const brandCandidate = readDraftString(draft, ["brand", "brandName", "suggestedBrand"]);
  const brand =
    brandCandidate && brandCandidate.toLowerCase() !== "unknown"
      ? brandCandidate
      : product.brand;

  const attributeOverrides =
    readDraftAttributes(draft, [
      "attributes",
      "suggestedAttributes",
      "keyAttributes",
      "proposedKeyAttributes",
    ]) ?? {};

  const priceCandidate = readDraftNumber(draft, ["price"]);
  const inventoryCandidate = readDraftNumber(draft, ["inventoryQuantity", "inventory", "quantity"]);

  const shortDescriptionWithFallback =
    shortDescription ||
    inferShortDescriptionFromLongDescription(longDescription) ||
    product.shortDescription;

  return {
    ...product,
    title: title || product.title,
    shortDescription: shortDescriptionWithFallback,
    longDescription,
    bulletPoints,
    brand,
    attributes: {
      ...product.attributes,
      ...attributeOverrides,
    },
    price:
      priceCandidate !== null && Number.isFinite(priceCandidate)
        ? priceCandidate
        : product.price,
    inventoryQuantity:
      inventoryCandidate !== null && Number.isFinite(inventoryCandidate) && inventoryCandidate >= 0
        ? inventoryCandidate
        : product.inventoryQuantity,
  };
}

export function mergeWalmartAiSuggestionIntoProduct(
  product: WalmartProductRecord,
  suggestion: WalmartAiSuggestion
): WalmartProductRecord {
  const title = suggestion.suggestedTitle.trim() || product.title;
  const suggestedLongDescription = suggestion.suggestedDescription.trim();
  const longDescription = suggestedLongDescription || product.longDescription;
  const shortDescription =
    suggestion.suggestedShortDescription?.trim() ||
    product.shortDescription.trim() ||
    inferShortDescriptionFromLongDescription(longDescription);
  const suggestedBullets = suggestion.suggestedBullets
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  const bulletPoints = suggestedBullets.length > 0 ? suggestedBullets : product.bulletPoints;
  const suggestedBrand = suggestion.suggestedBrand?.trim() ?? "";
  const brand =
    suggestedBrand && suggestedBrand.toLowerCase() !== "unknown"
      ? suggestedBrand
      : product.brand;
  const suggestedAttributes = Object.fromEntries(
    Object.entries(suggestion.suggestedAttributes ?? {})
      .map(([key, value]) => [key.trim(), value.trim()] as const)
      .filter(([key, value]) => key.length > 0 && value.length > 0)
  );

  return {
    ...product,
    title,
    shortDescription,
    longDescription,
    bulletPoints,
    brand,
    attributes: {
      ...product.attributes,
      ...suggestedAttributes,
    },
  };
}

function toImageStatusMessage(
  product: WalmartProductRecord
):
  | "Image available"
  | "Image not provided by Walmart catalog"
  | "Image enrichment source not configured"
  | "Image not provided by Walmart Item Search"
  | "Image found in Walmart Item Report."
  | "Item Report row found, but no usable image URL was provided."
  | "No matching row found in Walmart Item Report."
  | "Walmart Item Report request failed."
  | "Walmart Item Report was unavailable or timed out."
  | "Item Search returned no usable image."
  | "Multiple Walmart Item Search candidates matched this product."
  | "Item Search request failed after retry."
  | "Image match ambiguous"
  | "Image sync failed"
  | "Image enrichment not synced" {
  if (product.imageStatus === "image_available" || Boolean(product.imageUrl)) {
    return "Image available";
  }

  if (product.imageStatusMessage?.trim()) {
    const explicit = product.imageStatusMessage.trim();
    if (
      explicit === "Image found in Walmart Item Report." ||
      explicit === "Item Report row found, but no usable image URL was provided." ||
      explicit === "No matching row found in Walmart Item Report." ||
      explicit === "Walmart Item Report request failed." ||
      explicit === "Walmart Item Report was unavailable or timed out." ||
      explicit === "Item Search returned no usable image." ||
      explicit === "Multiple Walmart Item Search candidates matched this product." ||
      explicit === "Item Search request failed after retry." ||
      explicit === "Image not provided by Walmart Item Search" ||
      explicit === "Image not provided by Walmart catalog" ||
      explicit === "Image match ambiguous" ||
      explicit === "Image sync failed" ||
      explicit === "Image enrichment not synced" ||
      explicit === "Image enrichment source not configured"
    ) {
      return explicit;
    }
  }

  if (product.imageSyncStatus === "not_found" || product.issues.includes("Image not provided by Walmart Item Search")) {
    return "Image not provided by Walmart Item Search";
  }
  if (product.imageSyncStatus === "ambiguous" || product.issues.includes("Image match ambiguous")) {
    return "Image match ambiguous";
  }
  if (product.imageSyncStatus === "failed" || product.issues.includes("Image sync failed")) {
    return "Image sync failed";
  }
  if (product.imageSyncStatus === "not_synced" || product.issues.includes("Image enrichment not synced")) {
    return "Image enrichment not synced";
  }

  if (
    product.imageStatus === "enrichment_unconfigured" ||
    product.issues.includes("Image enrichment source not configured")
  ) {
    return "Image enrichment source not configured";
  }

  if (product.imageStatus === "catalog_missing" || product.issues.includes("Image not provided by Walmart catalog")) {
    return "Image not provided by Walmart catalog";
  }
  return "Image not provided by Walmart catalog";
}

function recommendationSeverity(weight: number): "high" | "medium" | "low" {
  if (weight >= 12) return "high";
  if (weight >= 7) return "medium";
  return "low";
}

function sanitizedTitle(product: WalmartProductRecord): string {
  const base = product.title.trim() || `Walmart item ${product.sku}`;
  if (base.length >= 40 && base.length <= 170) return base;
  if (base.length < 40) return `${base} - ${product.brand || "Walmart"} Daily Wellness Formula`;
  return base.slice(0, 170).trim();
}

function sanitizedDescription(product: WalmartProductRecord): string {
  const long = product.longDescription.trim();
  const short = product.shortDescription.trim();
  if (long) return long;
  if (short) return `${short} Crafted for clear, compliant Walmart catalog communication.`;
  return `${product.brand || "This product"} is optimized for factual, compliant listing content with clear feature communication and customer-facing usage context.`;
}

function sanitizedBullets(product: WalmartProductRecord): string[] {
  if (product.bulletPoints.length >= 3) {
    return product.bulletPoints.slice(0, 6);
  }

  const generated = unique(
    [
      `${product.brand || "Walmart"} quality-focused catalog listing`,
      `SKU ${product.sku} with structured feature highlights`,
      "Compliant, factual messaging for Marketplace shoppers",
      product.category ? `${product.category} category alignment` : "",
    ].filter(Boolean)
  );

  return generated.slice(0, 6);
}

function sanitizedAttributes(product: WalmartProductRecord): Record<string, string> {
  if (countMeaningfulAttributes(product.attributes) > 0) return product.attributes;
  return {
    brand: product.brand || "Unknown",
    category: product.category || "Uncategorized",
    sku: product.sku,
  };
}

export function assessWalmartListingQuality(product: WalmartProductRecord): WalmartListingQualityAssessment {
  const factors: string[] = [];
  const recommendations: WalmartListingRecommendation[] = [];
  let score = 100;

  const apply = (weight: number, factor: string, recommendation: Omit<WalmartListingRecommendation, "severity">) => {
    score -= weight;
    factors.push(factor);
    recommendations.push({
      ...recommendation,
      severity: recommendationSeverity(weight),
    });
  };

  const imageStatus = toImageStatusMessage(product);
  if (imageStatus !== "Image available") {
    const isImageFailure =
      imageStatus === "Image sync failed" ||
      imageStatus === "Item Search request failed after retry." ||
      imageStatus === "Walmart Item Report request failed." ||
      imageStatus === "Walmart Item Report was unavailable or timed out.";
    const isImageAmbiguous =
      imageStatus === "Image match ambiguous" ||
      imageStatus === "Multiple Walmart Item Search candidates matched this product.";
    const isImageUnsynced =
      imageStatus === "Image enrichment source not configured" || imageStatus === "Image enrichment not synced";

    const weight =
      isImageFailure
        ? 16
        : imageStatus === "Image enrichment source not configured"
          ? 18
          : isImageAmbiguous
            ? 13
            : isImageUnsynced
              ? 10
              : 12;

    const imageReason =
      imageStatus === "Image not provided by Walmart Item Search"
        ? "Walmart Item Search did not return an image for this SKU."
        : imageStatus === "No matching row found in Walmart Item Report."
          ? "No matching seller-specific row was found in Walmart Item Report."
          : imageStatus === "Item Report row found, but no usable image URL was provided."
            ? "Walmart Item Report matched this product, but did not provide a usable image URL."
            : imageStatus === "Image found in Walmart Item Report."
              ? "Walmart Item Report supplied image URLs for this SKU."
              : isImageAmbiguous
          ? "Walmart Item Search returned multiple possible image matches."
          : isImageFailure
            ? "Walmart Item Search image sync failed for this SKU."
            : imageStatus === "Image enrichment not synced"
              ? "Image enrichment has not been synced yet."
              : imageStatus === "Image enrichment source not configured"
                ? "Catalog payload has no image and no enrichment provider is configured."
                : "Catalog payload has no image URL for this SKU.";

    apply(
      weight,
      imageStatus,
      {
        id: "image_enrichment",
        title: "Resolve primary image",
        reason: imageReason,
        proposedImageAction:
          imageStatus === "Image enrichment source not configured" || imageStatus === "Image enrichment not synced"
            ? "manual_image_required"
            : "request_enrichment",
      }
    );
  }

  const title = product.title.trim();
  if (!title || title.length < 40 || title.length > 180) {
    apply(10, "Title length/clarity needs optimization", {
      id: "title_quality",
      title: "Improve title quality",
      reason: "Keep title clear and within a strong Walmart listing range (40-180 chars).",
      proposedTitle: sanitizedTitle(product),
    });
  }

  if (!product.brand.trim()) {
    apply(12, "Brand is missing", {
      id: "brand_missing",
      title: "Set brand attribute",
      reason: "Listings with explicit brand metadata perform better in catalog matching.",
      proposedKeyAttributes: { brand: "Set brand value" },
    });
  }

  if (!product.shortDescription.trim() && !product.longDescription.trim()) {
    apply(10, "Description is missing", {
      id: "description_missing",
      title: "Add compliant description",
      reason: "Description coverage is required for listing quality and shopper clarity.",
      proposedDescription: sanitizedDescription(product),
    });
  }

  if (product.bulletPoints.length < 3) {
    apply(8, "Bullets/key features are sparse", {
      id: "bullets_missing",
      title: "Expand key feature bullets",
      reason: "Add at least 3 concise key features.",
      proposedBullets: sanitizedBullets(product),
    });
  }

  const attributeCount = countMeaningfulAttributes(product.attributes);
  if (attributeCount === 0) {
    apply(8, "Key attributes are missing", {
      id: "attributes_missing",
      title: "Populate key attributes",
      reason: "Attribute coverage improves discoverability and shopper trust.",
      proposedKeyAttributes: sanitizedAttributes(product),
    });
  }

  if (product.inventoryStatus === "out_of_stock") {
    apply(14, "Inventory is out of stock", {
      id: "inventory_oos",
      title: "Restock inventory",
      reason: "Out-of-stock products suppress conversion and listing momentum.",
    });
  } else if (product.inventoryStatus === "unknown") {
    apply(7, "Inventory status is unknown", {
      id: "inventory_unknown",
      title: "Run inventory sync",
      reason: "Unknown inventory should be synced before optimization decisions.",
    });
  }

  if (!Number.isFinite(product.price) || product.price <= 0) {
    apply(16, "Price is missing", {
      id: "price_missing",
      title: "Set valid product price",
      reason: "Price is required for listing quality and conversion.",
    });
  }

  const clampedScore = Math.max(1, Math.min(100, Math.round(score)));
  return {
    score: clampedScore,
    imageStatus,
    factors: unique(factors),
    recommendations,
  };
}

export function buildDeterministicOptimizationProposal(
  product: WalmartProductRecord,
  assessment: WalmartListingQualityAssessment
): WalmartOptimizationProposalRecord {
  const topReasons = assessment.recommendations.slice(0, 3).map((entry) => entry.reason);
  const now = new Date().toISOString();

  return {
    id: `wm_opt_${crypto.createHash("sha1").update(product.sku.toUpperCase()).digest("hex").slice(0, 12)}`,
    sku: product.sku,
    source: "deterministic",
    proposedTitle: sanitizedTitle(product),
    proposedDescription: sanitizedDescription(product),
    proposedBullets: sanitizedBullets(product),
    proposedKeyAttributes: sanitizedAttributes(product),
    proposedImageUrl: product.imageUrl || "",
    proposedImageAction:
      assessment.imageStatus === "Image available"
        ? "keep"
        : assessment.imageStatus === "Image not provided by Walmart catalog" ||
            assessment.imageStatus === "Image not provided by Walmart Item Search" ||
            assessment.imageStatus === "No matching row found in Walmart Item Report." ||
            assessment.imageStatus === "Item Report row found, but no usable image URL was provided." ||
            assessment.imageStatus === "Image match ambiguous" ||
            assessment.imageStatus === "Image sync failed" ||
            assessment.imageStatus === "Walmart Item Report request failed." ||
            assessment.imageStatus === "Walmart Item Report was unavailable or timed out." ||
            assessment.imageStatus === "Multiple Walmart Item Search candidates matched this product." ||
            assessment.imageStatus === "Item Search request failed after retry." ||
            assessment.imageStatus === "Item Search returned no usable image."
          ? "request_enrichment"
          : "manual_image_required",
    recommendationReason: topReasons.join(" "),
    status: "staged",
    createdAt: now,
    updatedAt: now,
  };
}
