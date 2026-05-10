import "server-only";

import { appendActivityLog } from "@/lib/ecomviper/core/activity-log";
import { getPersistedWalmartProductBySku } from "@/lib/ecomviper/walmart/walmart-product-repository";
import { getRecentPriceChanges, upsertDraftForSku } from "@/lib/ecomviper/walmart/walmart-store";
import type {
  WalmartMutationResult,
  WalmartPriceUpdateRequest,
  WalmartProductRecord,
} from "@/lib/ecomviper/walmart/walmart-types";

export async function updateWalmartPriceForUser(input: {
  userId: string;
  update: WalmartPriceUpdateRequest;
}): Promise<WalmartMutationResult> {
  const sku = input.update.sku.trim();
  const product = await getPersistedWalmartProductBySku(input.userId, sku);

  if (!product) {
    return {
      ok: false,
      sku,
      mode: "live-ready" as const,
      writeEnabled: false,
      message: "SKU not found in imported Walmart products.",
    };
  }

  if (input.update.saveAsDraft) {
    upsertDraftForSku({
      sku,
      draftPayload: {
        price: input.update.price,
      },
      createdBy: input.userId,
      productOverride: product,
    });

    return {
      ok: true,
      sku,
      mode: "live-ready" as const,
      writeEnabled: false,
      message: "Price change saved as draft.",
    };
  }

  appendActivityLog({
    marketplace: "walmart",
    sku,
    actionType: "pricing_update",
    result: "warning",
    message: "Production write disabled until preview/validation is complete.",
  });

  return {
    ok: true,
    sku,
    mode: "live-ready" as const,
    writeEnabled: false,
    message: "Production write disabled until preview/validation is complete.",
  };
}

export function getPricingView(products: WalmartProductRecord[]) {
  return {
    products,
    validationWarnings: products
      .filter((item) => item.price <= 0)
      .map((item) => ({ sku: item.sku, message: "Price must be greater than 0." })),
    recentChanges: getRecentPriceChanges(),
  };
}
