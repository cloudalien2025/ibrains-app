import "server-only";

import { appendActivityLog } from "@/lib/ecomviper/core/activity-log";
import { getPersistedWalmartProductBySku } from "@/lib/ecomviper/walmart/walmart-product-repository";
import { getRecentInventoryChanges, upsertDraftForSku } from "@/lib/ecomviper/walmart/walmart-store";
import type {
  WalmartInventoryUpdateRequest,
  WalmartMutationResult,
  WalmartProductRecord,
} from "@/lib/ecomviper/walmart/walmart-types";

export async function updateWalmartInventoryForUser(input: {
  userId: string;
  update: WalmartInventoryUpdateRequest;
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
        inventoryQuantity: input.update.quantity,
      },
      createdBy: input.userId,
      productOverride: product,
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

export function getInventoryView(products: WalmartProductRecord[]) {
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
