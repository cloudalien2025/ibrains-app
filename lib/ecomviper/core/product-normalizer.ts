import "server-only";

import type { WalmartProductRecord } from "@/lib/ecomviper/walmart/walmart-types";

export interface NormalizeProductInput {
  sku: string;
  title: string;
  brand: string;
  price: number;
  inventoryQuantity: number;
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
  const issues: string[] = [];

  if (!hasImage) issues.push("Missing image");
  if (!input.price || input.price <= 0) issues.push("Price missing");
  if (input.inventoryQuantity <= 0) issues.push("Out of stock");

  return {
    id: `walmart_${input.sku.toLowerCase()}`,
    marketplace: "walmart",
    sku: input.sku,
    externalItemId: `wm_${input.sku.toLowerCase()}`,
    title: input.title,
    brand: input.brand,
    category: "Supplements",
    price: Number(input.price.toFixed(2)),
    inventoryQuantity: input.inventoryQuantity,
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
      inventory: input.inventoryQuantity,
    },
    normalizedPayload: {
      sku: input.sku,
      title: input.title,
      brand: input.brand,
      price: input.price,
      inventoryQuantity: input.inventoryQuantity,
      attributes: input.attributes ?? {},
    },
    lastSyncedAt: now,
    createdAt: now,
    updatedAt: now,
  };
}
