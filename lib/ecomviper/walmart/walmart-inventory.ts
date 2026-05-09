import "server-only";

import { appendActivityLog } from "@/lib/ecomviper/core/activity-log";
import { getProductBySku, getRecentInventoryChanges, listProducts, upsertDraftForSku } from "@/lib/ecomviper/walmart/walmart-store";
import type { WalmartInventoryUpdateRequest } from "@/lib/ecomviper/walmart/walmart-types";

export function updateWalmartInventory(input: WalmartInventoryUpdateRequest) {
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
        inventoryQuantity: input.quantity,
      },
    });

    return {
      ok: true,
      sku,
      mode: "live-ready" as const,
      writeEnabled: false,
      message: "Inventory change saved as draft.",
    };
  }

  appendActivityLog({
    marketplace: "walmart",
    sku,
    actionType: "inventory_update",
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

export function getInventoryView() {
  const products = listProducts();

  return {
    lowStock: products.filter(
      (product) => product.inventoryStatus === "known" && product.inventoryQuantity > 0 && product.inventoryQuantity <= 15
    ),
    outOfStock: products.filter(
      (product) =>
        product.inventoryStatus === "out_of_stock" ||
        (product.inventoryStatus === "known" && product.inventoryQuantity === 0)
    ),
    recentChanges: getRecentInventoryChanges(),
  };
}
