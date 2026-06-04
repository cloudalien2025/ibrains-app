import type { RocktomicSupplierProduct } from "@/lib/ecomviper/dropshipping/rocktomic-supplier-intelligence";
import { matchRocktomicBySkus, type RocktomicMatchStatus } from "@/lib/ecomviper/dropshipping/rocktomic-supplier-intelligence";
import type { ShopifyProductRecord } from "@/lib/ecomviper/shopify/shopify-types";

export type EcomViperInventoryStatus =
  | "in_stock"
  | "low_stock"
  | "out_of_stock"
  | "unknown"
  | "inventory_source_unavailable";

export type EcomViperInventorySource = "rocktomic" | "shopify" | "unknown" | "inventory_source_unavailable";

export interface EcomViperProductInventoryRow {
  id: string;
  productEditorHref: string;
  imageUrl: string | null;
  productName: string;
  sku: string | null;
  vendor: string;
  productType: string;
  shopifyStatus: string;
  supplierMatch: RocktomicMatchStatus;
  supplierMatchedSku: string | null;
  supplierMatchConfidence: number;
  supplierMatchReason: string;
  supplierProductName: string | null;
  aiPdpScore: number;
  publishedToEcomViper: boolean;
  lastUpdated: string;
  inventoryStatus: EcomViperInventoryStatus;
  inventorySource: EcomViperInventorySource;
}

interface ToInventoryRowsOptions {
  supplierProducts?: RocktomicSupplierProduct[];
  rocktomicInventoryAvailable?: boolean;
}

function safeText(value: string | null | undefined, fallback = "-"): string {
  const normalized = (value || "").trim();
  return normalized || fallback;
}

function normalizeShopifyStatus(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return "draft";
  return normalized;
}

function primarySku(product: ShopifyProductRecord): string | null {
  const direct = product.variants.find((variant) => variant.sku.trim().length > 0)?.sku.trim();
  if (direct) return direct;
  return null;
}

function collectSkus(product: ShopifyProductRecord): string[] {
  return product.variants.map((variant) => variant.sku.trim()).filter(Boolean);
}

function computeShopifyInventoryStatus(product: ShopifyProductRecord): EcomViperInventoryStatus {
  const quantities = product.variants
    .map((variant) => variant.inventoryQuantity)
    .filter((quantity): quantity is number => typeof quantity === "number" && Number.isFinite(quantity));

  if (!quantities.length) return "unknown";

  const inStockCount = quantities.filter((quantity) => quantity > 0).length;
  if (inStockCount === 0) return "out_of_stock";
  if (inStockCount === quantities.length) return "in_stock";
  return "low_stock";
}

function computeAiPdpScore(product: ShopifyProductRecord): number {
  const checks = [
    product.title.trim().length >= 8,
    product.description.trim().length >= 120,
    product.seoTitle.trim().length >= 15,
    product.seoDescription.trim().length >= 40,
    product.galleryImageUrls.length > 0,
    product.variants.some((variant) => variant.sku.trim().length > 0),
    product.vendor.trim().length > 0,
    product.productType.trim().length > 0,
  ];

  const passed = checks.filter(Boolean).length;
  return Math.round((passed / checks.length) * 100);
}

function resolveInventory(
  product: ShopifyProductRecord,
  options: { supplierProduct: RocktomicSupplierProduct | null; rocktomicInventoryAvailable: boolean }
): { status: EcomViperInventoryStatus; source: EcomViperInventorySource } {
  if (options.supplierProduct) {
    if (options.supplierProduct.inventoryStatus !== "unknown") {
      return {
        status: options.supplierProduct.inventoryStatus,
        source: "rocktomic",
      };
    }

    if (!options.rocktomicInventoryAvailable) {
      return {
        status: "inventory_source_unavailable",
        source: "inventory_source_unavailable",
      };
    }
  }

  const shopifyStatus = computeShopifyInventoryStatus(product);
  if (shopifyStatus === "unknown") {
    return {
      status: options.rocktomicInventoryAvailable ? "unknown" : "inventory_source_unavailable",
      source: options.rocktomicInventoryAvailable ? "unknown" : "inventory_source_unavailable",
    };
  }

  return {
    status: shopifyStatus,
    source: "shopify",
  };
}

export function toEcomViperProductInventoryRows(
  products: ShopifyProductRecord[],
  options?: ToInventoryRowsOptions
): EcomViperProductInventoryRow[] {
  const supplierProducts = options?.supplierProducts;
  const rocktomicInventoryAvailable = options?.rocktomicInventoryAvailable ?? false;

  return products.map((product) => {
    const skus = collectSkus(product);
    const rocktomicMatch = matchRocktomicBySkus(skus, supplierProducts);
    const handleOrId = product.handle.trim() || product.id.trim();
    const inventory = resolveInventory(product, {
      supplierProduct: rocktomicMatch.product,
      rocktomicInventoryAvailable,
    });

    return {
      id: product.id,
      productEditorHref: `/ecomviper/products/${encodeURIComponent(handleOrId)}`,
      imageUrl: product.primaryImageUrl.trim() || product.galleryImageUrls[0] || null,
      productName: safeText(product.title, "Untitled product"),
      sku: primarySku(product),
      vendor: safeText(product.vendor),
      productType: safeText(product.productType),
      shopifyStatus: normalizeShopifyStatus(product.status),
      supplierMatch: rocktomicMatch.status,
      supplierMatchedSku: rocktomicMatch.matchedSku,
      supplierMatchConfidence: rocktomicMatch.matchConfidence,
      supplierMatchReason: rocktomicMatch.matchReason,
      supplierProductName: rocktomicMatch.product?.productName ?? null,
      aiPdpScore: computeAiPdpScore(product),
      publishedToEcomViper: false,
      lastUpdated: product.updatedAt,
      inventoryStatus: inventory.status,
      inventorySource: inventory.source,
    };
  });
}
