import "server-only";

import { mutateInventory, getRecentInventoryChanges, listMockProducts } from "@/lib/ecomviper/walmart/walmart-mock-data";
import type { WalmartInventoryUpdateRequest } from "@/lib/ecomviper/walmart/walmart-types";

export function updateWalmartInventory(input: WalmartInventoryUpdateRequest) {
  return mutateInventory({
    sku: input.sku,
    quantity: input.quantity,
    saveAsDraft: input.saveAsDraft,
  });
}

export function getInventoryView() {
  const products = listMockProducts();
  return {
    lowStock: products.filter((product) => product.inventoryQuantity > 0 && product.inventoryQuantity <= 15),
    outOfStock: products.filter((product) => product.inventoryQuantity === 0),
    recentChanges: getRecentInventoryChanges(),
  };
}
