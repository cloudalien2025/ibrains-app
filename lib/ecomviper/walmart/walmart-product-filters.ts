import type { WalmartProductRecord } from "@/lib/ecomviper/walmart/walmart-types";

export interface ProductFilterParams {
  query?: string;
  filter?: string;
}

export function filterWalmartProducts(
  products: WalmartProductRecord[],
  params: ProductFilterParams
): WalmartProductRecord[] {
  const query = (params.query ?? "").trim().toLowerCase();
  const filter = (params.filter ?? "all").trim().toLowerCase();

  return products.filter((product) => {
    const textMatch =
      !query ||
      product.sku.toLowerCase().includes(query) ||
      product.title.toLowerCase().includes(query) ||
      product.brand.toLowerCase().includes(query) ||
      product.status.toLowerCase().includes(query);

    if (!textMatch) return false;

    if (filter === "all") return true;
    if (filter === "needs_attention") return product.issues.length > 0 || product.status !== "active";
    if (filter === "out_of_stock") return product.inventoryQuantity === 0;
    if (filter === "low_stock") return product.inventoryQuantity > 0 && product.inventoryQuantity <= 15;
    if (filter === "missing_image") return !product.imageUrl;
    if (filter === "missing_attributes") return Object.keys(product.attributes).length === 0;
    if (filter === "price_missing") return product.price <= 0;
    if (filter === "sync_failed") return product.status === "sync_failed";
    if (filter === "draft_pending") return product.status === "draft";
    return true;
  });
}
