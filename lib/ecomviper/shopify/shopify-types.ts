export const DEFAULT_SHOPIFY_API_VERSION = "2025-10";

export type ShopifyConnectionState = "connected" | "disconnected";

export interface ShopifyConnectionStatus {
  connected: boolean;
  status: ShopifyConnectionState;
  storeDomain: string;
  apiVersion: string;
  maskedAccessToken: string;
  updatedAt: string | null;
  saveSupported: boolean;
}

export interface ShopifyConnectionTestResult {
  ok: boolean;
  connectionStatus: ShopifyConnectionState;
  requiredScope: "read_products";
  missingScope: boolean;
  statusCode: number | null;
  storeDomain: string;
  apiVersion: string;
  requestId: string | null;
  message: string;
  diagnosticEvent: "shopify_connection_test_success" | "shopify_connection_missing_scope";
}

export interface ShopifySelectedOption {
  name: string;
  value: string;
}

export interface ShopifyImageRecord {
  id: string;
  url: string;
  altText: string | null;
  width: number | null;
  height: number | null;
  source: "product" | "variant";
  variantId: string | null;
}

export interface ShopifyVariantRecord {
  id: string;
  productId: string;
  title: string;
  sku: string;
  barcode: string;
  price: number | null;
  compareAtPrice: number | null;
  inventoryQuantity: number | null;
  selectedOptions: ShopifySelectedOption[];
  imageUrl: string;
  imageAltText: string | null;
  imageUrls: string[];
}

export interface ShopifyProductRecord {
  id: string;
  storeDomain: string;
  title: string;
  handle: string;
  vendor: string;
  productType: string;
  status: string;
  tags: string[];
  description: string;
  descriptionHtml: string;
  onlineStoreUrl: string;
  primaryImageUrl: string;
  galleryImageUrls: string[];
  galleryImages: ShopifyImageRecord[];
  createdAt: string;
  updatedAt: string;
  variants: ShopifyVariantRecord[];
}

export interface ShopifyImportDiagnostics {
  importedCount: number;
  imageCount: number;
  pageCount: number;
  hasNextPage: boolean;
  fetchedNodeCount: number;
  diagnosticsEventProductsImported: "shopify_products_imported";
  diagnosticsEventImagesImported: "shopify_images_imported";
}

export interface ShopifyImportState {
  lastImportAt: string | null;
  lastImportStatus: "success" | "failed" | "unknown";
  lastImportMessage: string | null;
  productCount: number;
  imageCount: number;
  updatedAt: string | null;
}

export interface ShopifyImportResult {
  importedCount: number;
  imageCount: number;
  pageCount: number;
  hasNextPage: boolean;
  fetchedNodeCount: number;
  lastImportAt: string;
  diagnostics: ShopifyImportDiagnostics;
}

export type ShopifyWalmartMatchMethod =
  | "shopify_sku_exact"
  | "shopify_barcode_exact"
  | "shopify_barcode_normalized"
  | "shopify_title_vendor_high"
  | "shopify_ambiguous"
  | "shopify_no_match";

export interface WalmartShopifyPerProductDiagnostic {
  walmartSku: string;
  walmartUpcOrGtin: string;
  matchedShopifyProductTitle: string;
  matchedShopifyProductId: string;
  matchedShopifyVariantId: string;
  matchMethod: ShopifyWalmartMatchMethod;
  imageApplied: boolean;
  ambiguousCandidateCount: number;
}

export interface WalmartShopifyReconcileResult {
  shopifyProductsImported: number;
  shopifyImagesImported: number;
  walmartProductsMatchedToShopify: number;
  imagesAppliedFromShopify: number;
  ambiguousShopifyMatches: number;
  shopifyNoMatch: number;
  shopifyNoImageAvailable: number;
  stillMissingAfterShopify: number;
  diagnosticsEvents: {
    shopifyVariantSkuMatch: number;
    shopifyVariantBarcodeMatch: number;
    shopifyBarcodeNormalizedMatch: number;
    shopifyTitleVendorMatch: number;
    shopifyAmbiguousMatch: number;
    shopifyNoMatch: number;
    shopifyImageApplied: number;
    shopifyNoImageAvailable: number;
  };
  diagnostics: WalmartShopifyPerProductDiagnostic[];
}
