import "server-only";

import { mutatePricing, getRecentPriceChanges, listMockProducts } from "@/lib/ecomviper/walmart/walmart-mock-data";
import type { WalmartPriceUpdateRequest } from "@/lib/ecomviper/walmart/walmart-types";

export function updateWalmartPrice(input: WalmartPriceUpdateRequest) {
  return mutatePricing({
    sku: input.sku,
    price: input.price,
    saveAsDraft: input.saveAsDraft,
  });
}

export function getPricingView() {
  const products = listMockProducts();
  return {
    products,
    validationWarnings: products
      .filter((item) => item.price <= 0)
      .map((item) => ({ sku: item.sku, message: "Price must be greater than 0." })),
    recentChanges: getRecentPriceChanges(),
  };
}
