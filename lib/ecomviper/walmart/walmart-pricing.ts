import "server-only";

import { appendActivityLog } from "@/lib/ecomviper/core/activity-log";
import { getProductBySku, getRecentPriceChanges, listProducts, upsertDraftForSku } from "@/lib/ecomviper/walmart/walmart-store";
import type { WalmartPriceUpdateRequest } from "@/lib/ecomviper/walmart/walmart-types";

export function updateWalmartPrice(input: WalmartPriceUpdateRequest) {
  const sku = input.sku.trim();
  const product = getProductBySku(sku);

  if (!product) {
    return {
      ok: false,
      sku,
      mode: "live-ready" as const,
      writeEnabled: false,
      message: "SKU not found in imported Walmart products.",
    };
  }

  if (input.saveAsDraft) {
    upsertDraftForSku({
      sku,
      draftPayload: {
        price: input.price,
      },
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

export function getPricingView() {
  const products = listProducts();

  return {
    products,
    validationWarnings: products
      .filter((item) => item.price <= 0)
      .map((item) => ({ sku: item.sku, message: "Price must be greater than 0." })),
    recentChanges: getRecentPriceChanges(),
  };
}
