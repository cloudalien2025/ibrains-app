import "server-only";

import type { WalmartInventoryStatus, WalmartProductRecord } from "@/lib/ecomviper/walmart/walmart-types";

export interface NormalizeProductInput {
  sku: string;
  title: string;
  brand: string;
  price: number;
  inventoryQuantity?: number | null;
  inventoryStatus?: WalmartInventoryStatus;
  imageUrl?: string;
  status?: WalmartProductRecord["status"];
  rawPayload?: unknown;
  attributes?: Record<string, string>;
  description?: string;
  shortDescription?: string;
  bulletPoints?: string[];
}

export function normalizeWalmartProduct(input: NormalizeProductInput): WalmartProductRecord {
  const now = new Date().toISOString();
  const hasImage = Boolean(input.imageUrl);
  const inventoryQuantity =
    typeof input.inventoryQuantity === "number" && Number.isFinite(input.inventoryQuantity)
      ? input.inventoryQuantity
      : 0;
  const inventoryStatus = input.inventoryStatus ?? "known";
  const issues: string[] = [];

  if (!hasImage) issues.push("Image not provided by Walmart catalog");
  if (!input.price || input.price <= 0) issues.push("Price missing");
  if (inventoryStatus === "out_of_stock" || (inventoryStatus === "known" && inventoryQuantity <= 0)) {
    issues.push("Out of stock");
  }

  return {
    id: `walmart_${input.sku.toLowerCase()}`,
    marketplace: "walmart",
    sku: input.sku,
    externalItemId: `wm_${input.sku.toLowerCase()}`,
    title: input.title,
    brand: input.brand,
    category: "Supplements",
    price: Number(input.price.toFixed(2)),
    inventoryQuantity,
    inventoryStatus,
    status: input.status ?? (issues.length ? "attention" : "active"),
    imageUrl: input.imageUrl ?? "",
    issues,
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
      attributes: input.attributes ?? {},
    },
    lastSyncedAt: now,
    createdAt: now,
    updatedAt: now,
  };
}
