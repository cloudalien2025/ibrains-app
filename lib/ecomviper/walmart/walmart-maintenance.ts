import "server-only";

import type { WalmartDraftRecord, WalmartProductRecord } from "@/lib/ecomviper/walmart/walmart-types";

function toImageUrl(value: unknown): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : "";
}

function toImageUrlList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return Array.from(
      new Set(
        value
          .map((entry) => toImageUrl(entry))
          .filter((entry) => entry.length > 0)
      )
    );
  }
  if (typeof value === "string" && value.trim()) {
    return Array.from(
      new Set(
        value
          .split(/\r?\n|[;,|]+/)
          .map((entry) => toImageUrl(entry))
          .filter((entry) => entry.length > 0)
      )
    );
  }
  return [];
}

export function buildMaintenancePayload(params: {
  draft: WalmartDraftRecord;
  product: WalmartProductRecord;
}) {
  const { draft, product } = params;
  const patch = draft.draftPayload;
  const fallbackInventoryQuantity = product.inventoryStatus === "unknown" ? null : product.inventoryQuantity;

  const inventoryQuantity =
    typeof patch.inventoryQuantity === "number"
      ? patch.inventoryQuantity
      : fallbackInventoryQuantity;

  const patchedImageUrl = typeof patch.imageUrl === "string" ? toImageUrl(patch.imageUrl) : null;
  const fallbackImageUrl = toImageUrl(product.imageUrl);
  const resolvedImageUrl = patchedImageUrl !== null ? patchedImageUrl : fallbackImageUrl;

  const patchedAdditionalImages =
    Object.prototype.hasOwnProperty.call(patch, "additionalImageUrls")
      ? toImageUrlList(patch.additionalImageUrls)
      : Object.prototype.hasOwnProperty.call(patch, "galleryImageUrls")
        ? toImageUrlList(patch.galleryImageUrls)
        : [];
  const fallbackAdditionalImages = toImageUrlList(product.galleryImageUrls ?? []);
  const resolvedAdditionalImages =
    patchedAdditionalImages.length > 0 ? patchedAdditionalImages : fallbackAdditionalImages;

  const updates: Record<string, unknown> = {
    title: typeof patch.title === "string" ? patch.title : product.title,
    shortDescription:
      typeof patch.shortDescription === "string" ? patch.shortDescription : product.shortDescription,
    longDescription:
      typeof patch.longDescription === "string" ? patch.longDescription : product.longDescription,
    bulletPoints: Array.isArray(patch.bulletPoints)
      ? patch.bulletPoints
      : product.bulletPoints,
    price: typeof patch.price === "number" ? patch.price : product.price,
    attributes:
      patch.attributes && typeof patch.attributes === "object"
        ? patch.attributes
        : product.attributes,
  };

  if (typeof inventoryQuantity === "number") {
    updates.inventoryQuantity = inventoryQuantity;
  }
  if (resolvedImageUrl) {
    updates.imageUrl = resolvedImageUrl;
  }
  if (resolvedAdditionalImages.length > 0) {
    updates.additionalImageUrls = resolvedAdditionalImages;
  }

  return {
    feedType: "MP_MAINTENANCE",
    sku: product.sku,
    updates,
    modeNote:
      "Maintenance payload is prepared server-side. Production write remains disabled until preview/validation is complete.",
  };
}
