import "server-only";

import type { WalmartDraftRecord, WalmartProductRecord } from "@/lib/ecomviper/walmart/walmart-types";

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
    imageUrl:
      typeof patch.imageUrl === "string"
        ? patch.imageUrl
        : product.imageUrl,
  };

  if (typeof inventoryQuantity === "number") {
    updates.inventoryQuantity = inventoryQuantity;
  }

  return {
    feedType: "MP_MAINTENANCE",
    sku: product.sku,
    updates,
    modeNote:
      "Maintenance payload is prepared server-side. Production write remains disabled until preview/validation is complete.",
  };
}
