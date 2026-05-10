import type { WalmartDraftRecord, WalmartProductRecord } from "@/lib/ecomviper/walmart/walmart-types";
import { mergeWalmartDraftPayloadIntoProduct } from "@/lib/ecomviper/walmart/walmart-listing-quality";

function normalizeSkuKey(sku: string): string {
  return sku.trim().toUpperCase();
}

function asEpoch(value: string): number {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export interface WalmartEffectiveProductRecord extends WalmartProductRecord {
  hasDraftChanges?: boolean;
  draftUpdatedAt?: string | null;
  liveBrand?: string;
  liveTitle?: string;
  livePrice?: number;
  liveInventoryQuantity?: number;
}

export function mergeProductsWithLatestDrafts(input: {
  products: WalmartProductRecord[];
  drafts: WalmartDraftRecord[];
}): WalmartEffectiveProductRecord[] {
  const latestDraftBySku = new Map<string, WalmartDraftRecord>();

  for (const draft of input.drafts) {
    if (draft.status === "discarded") continue;

    const skuKey = normalizeSkuKey(draft.sku);
    if (!skuKey) continue;

    const existing = latestDraftBySku.get(skuKey);
    if (!existing || asEpoch(draft.updatedAt) > asEpoch(existing.updatedAt)) {
      latestDraftBySku.set(skuKey, draft);
    }
  }

  return input.products.map((product) => {
    const skuKey = normalizeSkuKey(product.sku);
    const latestDraft = latestDraftBySku.get(skuKey) ?? null;
    const merged = latestDraft
      ? mergeWalmartDraftPayloadIntoProduct(product, latestDraft.draftPayload)
      : product;

    return {
      ...merged,
      hasDraftChanges: Boolean(latestDraft),
      draftUpdatedAt: latestDraft?.updatedAt ?? null,
      liveBrand: product.brand,
      liveTitle: product.title,
      livePrice: product.price,
      liveInventoryQuantity: product.inventoryQuantity,
    };
  });
}
