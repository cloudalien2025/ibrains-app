import "server-only";

import { listShopifyProductsForUser } from "@/lib/ecomviper/shopify/shopify-import";
import {
  normalizeDigitString,
  normalizeUpperTrimmed,
} from "@/lib/ecomviper/shopify/shopify-domain";
import type {
  ShopifyProductRecord,
  ShopifyVariantRecord,
  WalmartShopifyPerProductDiagnostic,
  WalmartShopifyReconcileResult,
  ShopifyWalmartMatchMethod,
} from "@/lib/ecomviper/shopify/shopify-types";
import type { WalmartProductRecord } from "@/lib/ecomviper/walmart/walmart-types";

interface MatchVariantCandidate {
  product: ShopifyProductRecord;
  variant: ShopifyVariantRecord;
}

interface WalmartShopifyMatchResult {
  method: ShopifyWalmartMatchMethod;
  product: ShopifyProductRecord | null;
  variant: ShopifyVariantRecord | null;
  ambiguousCandidateCount: number;
}

export interface ReconcileWalmartProductsWithShopifyInput {
  walmartProducts: WalmartProductRecord[];
  shopifyProducts: ShopifyProductRecord[];
  applyMode?: "missing_first" | "prefer_shopify";
  diagnosticsLimit?: number;
}

const IMAGE_ISSUES = new Set([
  "Image not provided by Walmart catalog",
  "Image enrichment source not configured",
  "Image not provided by Walmart Item Search",
  "Image match ambiguous",
  "Image sync failed",
  "Image enrichment not synced",
]);

function asString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const entry of values) {
    const normalized = entry.trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    output.push(normalized);
  }
  return output;
}

function stripImageIssues(issues: string[]): string[] {
  return issues.filter((issue) => !IMAGE_ISSUES.has(issue));
}

function normalizeTokenKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value: string): Set<string> {
  const normalized = normalizeTokenKey(value);
  if (!normalized) return new Set<string>();
  return new Set(
    normalized
      .split(" ")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 1)
  );
}

function jaccardSimilarity(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 || right.size === 0) return 0;
  let intersection = 0;
  for (const token of left) {
    if (right.has(token)) intersection += 1;
  }
  const union = left.size + right.size - intersection;
  if (union <= 0) return 0;
  return intersection / union;
}

function containsSimilarity(left: string, right: string): number {
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (left.includes(right) || right.includes(left)) return 0.9;
  return 0;
}

function titleVendorSimilarity(input: {
  walmartTitle: string;
  walmartBrand: string;
  shopifyTitle: string;
  shopifyVendor: string;
}): number {
  const walmartTitleKey = normalizeTokenKey(input.walmartTitle);
  const walmartBrandKey = normalizeTokenKey(input.walmartBrand);
  const shopifyTitleKey = normalizeTokenKey(input.shopifyTitle);
  const shopifyVendorKey = normalizeTokenKey(input.shopifyVendor);

  const titleScore = Math.max(
    jaccardSimilarity(tokenize(walmartTitleKey), tokenize(shopifyTitleKey)),
    containsSimilarity(walmartTitleKey, shopifyTitleKey)
  );
  const vendorScore = Math.max(
    jaccardSimilarity(tokenize(walmartBrandKey), tokenize(shopifyVendorKey)),
    containsSimilarity(walmartBrandKey, shopifyVendorKey)
  );

  if (!walmartTitleKey || !shopifyTitleKey) return 0;

  return titleScore * 0.82 + vendorScore * 0.18;
}

function barcodeNormalizationSet(value: string): Set<string> {
  const digits = normalizeDigitString(value);
  if (!digits) return new Set<string>();

  const set = new Set<string>();
  set.add(digits);

  const stripped = digits.replace(/^0+/, "") || "0";
  set.add(stripped);

  for (const length of [12, 13, 14]) {
    if (stripped.length <= length) {
      set.add(stripped.padStart(length, "0"));
    }
  }

  return set;
}

function buildVariantIndexes(shopifyProducts: ShopifyProductRecord[]): {
  bySku: Map<string, MatchVariantCandidate[]>;
  byBarcodeExact: Map<string, MatchVariantCandidate[]>;
  byBarcodeNormalized: Map<string, MatchVariantCandidate[]>;
} {
  const bySku = new Map<string, MatchVariantCandidate[]>();
  const byBarcodeExact = new Map<string, MatchVariantCandidate[]>();
  const byBarcodeNormalized = new Map<string, MatchVariantCandidate[]>();

  for (const product of shopifyProducts) {
    for (const variant of product.variants) {
      const candidate: MatchVariantCandidate = { product, variant };
      const skuKey = normalizeUpperTrimmed(variant.sku);
      if (skuKey) {
        const existing = bySku.get(skuKey) ?? [];
        existing.push(candidate);
        bySku.set(skuKey, existing);
      }

      const barcodeDigits = normalizeDigitString(variant.barcode);
      if (barcodeDigits) {
        const exact = byBarcodeExact.get(barcodeDigits) ?? [];
        exact.push(candidate);
        byBarcodeExact.set(barcodeDigits, exact);

        for (const normalized of barcodeNormalizationSet(barcodeDigits)) {
          const normalizedEntries = byBarcodeNormalized.get(normalized) ?? [];
          normalizedEntries.push(candidate);
          byBarcodeNormalized.set(normalized, normalizedEntries);
        }
      }
    }
  }

  return {
    bySku,
    byBarcodeExact,
    byBarcodeNormalized,
  };
}

function uniqueCandidates(candidates: MatchVariantCandidate[]): MatchVariantCandidate[] {
  const seen = new Set<string>();
  const output: MatchVariantCandidate[] = [];
  for (const candidate of candidates) {
    const key = `${candidate.product.id}:${candidate.variant.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(candidate);
  }
  return output;
}

function pickTitleVendorFallbackMatch(input: {
  walmartProduct: WalmartProductRecord;
  shopifyProducts: ShopifyProductRecord[];
}): WalmartShopifyMatchResult {
  const walmartTitle = asString(input.walmartProduct.title);
  const walmartBrand = asString(input.walmartProduct.brand);
  if (!walmartTitle) {
    return {
      method: "shopify_no_match",
      product: null,
      variant: null,
      ambiguousCandidateCount: 0,
    };
  }

  const scored = input.shopifyProducts
    .map((product) => ({
      product,
      score: titleVendorSimilarity({
        walmartTitle,
        walmartBrand,
        shopifyTitle: product.title,
        shopifyVendor: product.vendor,
      }),
    }))
    .filter((entry) => entry.score >= 0.72)
    .sort((left, right) => right.score - left.score);

  if (scored.length === 0) {
    return {
      method: "shopify_no_match",
      product: null,
      variant: null,
      ambiguousCandidateCount: 0,
    };
  }

  const top = scored[0];
  const second = scored[1] ?? null;
  const scoreGap = second ? top.score - second.score : top.score;

  if (top.score >= 0.82 && scoreGap >= 0.08) {
    const preferredVariant = top.product.variants.find((variant) => variant.imageUrl) ?? top.product.variants[0] ?? null;
    return {
      method: "shopify_title_vendor_high",
      product: top.product,
      variant: preferredVariant,
      ambiguousCandidateCount: 0,
    };
  }

  return {
    method: "shopify_ambiguous",
    product: null,
    variant: null,
    ambiguousCandidateCount: scored.filter((entry) => entry.score >= Math.max(0.72, top.score - 0.08)).length,
  };
}

function resolveMatchForWalmartProduct(input: {
  walmartProduct: WalmartProductRecord;
  shopifyProducts: ShopifyProductRecord[];
  indexes: ReturnType<typeof buildVariantIndexes>;
}): WalmartShopifyMatchResult {
  const walmartSkuKey = normalizeUpperTrimmed(input.walmartProduct.sku);
  if (walmartSkuKey) {
    const skuMatches = uniqueCandidates(input.indexes.bySku.get(walmartSkuKey) ?? []);
    if (skuMatches.length === 1) {
      return {
        method: "shopify_sku_exact",
        product: skuMatches[0].product,
        variant: skuMatches[0].variant,
        ambiguousCandidateCount: 0,
      };
    }
    if (skuMatches.length > 1) {
      return {
        method: "shopify_ambiguous",
        product: null,
        variant: null,
        ambiguousCandidateCount: skuMatches.length,
      };
    }
  }

  const walmartBarcodeValues = dedupeStrings([
    normalizeDigitString(input.walmartProduct.upc ?? ""),
    normalizeDigitString(input.walmartProduct.gtin ?? ""),
  ]);

  for (const barcodeValue of walmartBarcodeValues) {
    const exactMatches = uniqueCandidates(input.indexes.byBarcodeExact.get(barcodeValue) ?? []);
    if (exactMatches.length === 1) {
      return {
        method: "shopify_barcode_exact",
        product: exactMatches[0].product,
        variant: exactMatches[0].variant,
        ambiguousCandidateCount: 0,
      };
    }
    if (exactMatches.length > 1) {
      return {
        method: "shopify_ambiguous",
        product: null,
        variant: null,
        ambiguousCandidateCount: exactMatches.length,
      };
    }
  }

  const normalizedBarcodeMatches: MatchVariantCandidate[] = [];
  for (const barcodeValue of walmartBarcodeValues) {
    for (const normalized of barcodeNormalizationSet(barcodeValue)) {
      const matches = input.indexes.byBarcodeNormalized.get(normalized) ?? [];
      normalizedBarcodeMatches.push(...matches);
    }
  }

  const uniqueNormalizedMatches = uniqueCandidates(normalizedBarcodeMatches);
  if (uniqueNormalizedMatches.length === 1) {
    return {
      method: "shopify_barcode_normalized",
      product: uniqueNormalizedMatches[0].product,
      variant: uniqueNormalizedMatches[0].variant,
      ambiguousCandidateCount: 0,
    };
  }
  if (uniqueNormalizedMatches.length > 1) {
    return {
      method: "shopify_ambiguous",
      product: null,
      variant: null,
      ambiguousCandidateCount: uniqueNormalizedMatches.length,
    };
  }

  return pickTitleVendorFallbackMatch({
    walmartProduct: input.walmartProduct,
    shopifyProducts: input.shopifyProducts,
  });
}

function selectBestShopifyImage(match: {
  product: ShopifyProductRecord | null;
  variant: ShopifyVariantRecord | null;
}): {
  source: "shopify_variant" | "shopify_product" | null;
  imageUrl: string;
  galleryImageUrls: string[];
  variantImageUrls: string[];
} {
  const product = match.product;
  const variant = match.variant;
  if (!product) {
    return {
      source: null,
      imageUrl: "",
      galleryImageUrls: [],
      variantImageUrls: [],
    };
  }

  if (variant?.imageUrl) {
    const gallery = dedupeStrings([
      variant.imageUrl,
      ...variant.imageUrls,
      ...product.galleryImageUrls,
    ]);
    return {
      source: "shopify_variant",
      imageUrl: variant.imageUrl,
      galleryImageUrls: gallery,
      variantImageUrls: dedupeStrings([variant.imageUrl, ...variant.imageUrls]),
    };
  }

  const productPrimary = product.primaryImageUrl || product.galleryImageUrls[0] || "";
  if (!productPrimary) {
    return {
      source: null,
      imageUrl: "",
      galleryImageUrls: [],
      variantImageUrls: [],
    };
  }

  return {
    source: "shopify_product",
    imageUrl: productPrimary,
    galleryImageUrls: dedupeStrings([productPrimary, ...product.galleryImageUrls]),
    variantImageUrls: [],
  };
}

function shouldApplyShopifyImage(input: {
  product: WalmartProductRecord;
  applyMode: "missing_first" | "prefer_shopify";
}): boolean {
  if (input.product.imageSource === "manual" || input.product.imageSource === "manual_placeholder") {
    return false;
  }

  const hasExistingImage = Boolean(input.product.imageUrl.trim());
  if (input.applyMode === "missing_first") {
    return !hasExistingImage;
  }

  return true;
}

function patchProductWithShopifyMatch(input: {
  product: WalmartProductRecord;
  match: WalmartShopifyMatchResult;
  imageSelection: ReturnType<typeof selectBestShopifyImage>;
  applyImage: boolean;
  syncedAt: string;
}): WalmartProductRecord {
  const nextProduct = { ...input.product };

  if (input.match.product) {
    nextProduct.shopifyProductId = input.match.product.id;
    nextProduct.imageMatchMethod = input.match.method;
  }
  if (input.match.variant) {
    nextProduct.shopifyVariantId = input.match.variant.id;
  }

  if (!input.applyImage || !input.imageSelection.imageUrl || !input.imageSelection.source) {
    return nextProduct;
  }

  const source = input.imageSelection.source;

  const cleanedIssues = stripImageIssues(nextProduct.issues);
  nextProduct.imageUrl = input.imageSelection.imageUrl;
  nextProduct.primaryImageUrl = input.imageSelection.imageUrl;
  nextProduct.galleryImageUrls = input.imageSelection.galleryImageUrls;
  nextProduct.variantImageUrls = input.imageSelection.variantImageUrls;
  nextProduct.imageStatus = "image_available";
  nextProduct.imageStatusMessage = "Image available";
  nextProduct.imageSyncStatus = "found";
  nextProduct.imageSyncReason = source === "shopify_variant"
    ? "Shopify variant image matched and applied."
    : "Shopify product image matched and applied.";
  nextProduct.imageSource = source;
  nextProduct.lastImageSyncedAt = input.syncedAt;
  nextProduct.issues = cleanedIssues;

  const normalizedPayload =
    nextProduct.normalizedPayload && typeof nextProduct.normalizedPayload === "object"
      ? (nextProduct.normalizedPayload as Record<string, unknown>)
      : {};

  nextProduct.normalizedPayload = {
    ...normalizedPayload,
    imageUrl: nextProduct.imageUrl,
    primaryImageUrl: nextProduct.primaryImageUrl,
    galleryImageUrls: [...nextProduct.galleryImageUrls],
    variantImageUrls: [...nextProduct.variantImageUrls],
    imageStatus: nextProduct.imageStatus,
    imageStatusMessage: nextProduct.imageStatusMessage,
    imageSyncStatus: nextProduct.imageSyncStatus,
    imageSyncReason: nextProduct.imageSyncReason,
    imageSource: nextProduct.imageSource,
    imageMatchMethod: nextProduct.imageMatchMethod,
    shopifyProductId: nextProduct.shopifyProductId ?? null,
    shopifyVariantId: nextProduct.shopifyVariantId ?? null,
  };

  return nextProduct;
}

function countUniqueShopifyImages(products: ShopifyProductRecord[]): number {
  const images = new Set<string>();
  for (const product of products) {
    for (const url of product.galleryImageUrls) {
      if (url) images.add(url);
    }
  }
  return images.size;
}

export function reconcileWalmartProductsWithShopify(
  input: ReconcileWalmartProductsWithShopifyInput
): { products: WalmartProductRecord[]; result: WalmartShopifyReconcileResult } {
  const applyMode = input.applyMode ?? "missing_first";
  const diagnosticsLimit = Math.max(0, input.diagnosticsLimit ?? 300);
  const indexes = buildVariantIndexes(input.shopifyProducts);
  const syncedAt = new Date().toISOString();

  let walmartProductsMatchedToShopify = 0;
  let imagesAppliedFromShopify = 0;
  let ambiguousShopifyMatches = 0;
  let shopifyNoMatch = 0;
  let shopifyNoImageAvailable = 0;

  const diagnosticsEvents = {
    shopifyVariantSkuMatch: 0,
    shopifyVariantBarcodeMatch: 0,
    shopifyBarcodeNormalizedMatch: 0,
    shopifyTitleVendorMatch: 0,
    shopifyAmbiguousMatch: 0,
    shopifyNoMatch: 0,
    shopifyImageApplied: 0,
    shopifyNoImageAvailable: 0,
  };

  const diagnostics: WalmartShopifyPerProductDiagnostic[] = [];

  const products = input.walmartProducts.map((product) => {
    const match = resolveMatchForWalmartProduct({
      walmartProduct: product,
      shopifyProducts: input.shopifyProducts,
      indexes,
    });

    if (match.method === "shopify_no_match") {
      shopifyNoMatch += 1;
      diagnosticsEvents.shopifyNoMatch += 1;
    }

    if (match.method === "shopify_ambiguous") {
      ambiguousShopifyMatches += 1;
      diagnosticsEvents.shopifyAmbiguousMatch += 1;
    }

    if (match.method === "shopify_sku_exact") diagnosticsEvents.shopifyVariantSkuMatch += 1;
    if (match.method === "shopify_barcode_exact") diagnosticsEvents.shopifyVariantBarcodeMatch += 1;
    if (match.method === "shopify_barcode_normalized") diagnosticsEvents.shopifyBarcodeNormalizedMatch += 1;
    if (match.method === "shopify_title_vendor_high") diagnosticsEvents.shopifyTitleVendorMatch += 1;

    if (match.product) {
      walmartProductsMatchedToShopify += 1;
    }

    const imageSelection = selectBestShopifyImage({ product: match.product, variant: match.variant });
    const canApply = shouldApplyShopifyImage({ product, applyMode });
    const applyImage = Boolean(match.product && canApply && imageSelection.imageUrl);

    if (match.product && !imageSelection.imageUrl) {
      shopifyNoImageAvailable += 1;
      diagnosticsEvents.shopifyNoImageAvailable += 1;
    }

    if (applyImage) {
      imagesAppliedFromShopify += 1;
      diagnosticsEvents.shopifyImageApplied += 1;
    }

    const patched = patchProductWithShopifyMatch({
      product,
      match,
      imageSelection,
      applyImage,
      syncedAt,
    });

    if (diagnostics.length < diagnosticsLimit) {
      diagnostics.push({
        walmartSku: product.sku,
        walmartUpcOrGtin: product.upc?.trim() || product.gtin?.trim() || "",
        matchedShopifyProductTitle: match.product?.title ?? "",
        matchedShopifyProductId: match.product?.id ?? "",
        matchedShopifyVariantId: match.variant?.id ?? "",
        matchMethod: match.method,
        imageApplied: applyImage,
        ambiguousCandidateCount: match.ambiguousCandidateCount,
      });
    }

    return patched;
  });

  const stillMissingAfterShopify = products.filter((product) => !product.imageUrl.trim()).length;

  return {
    products,
    result: {
      shopifyProductsImported: input.shopifyProducts.length,
      shopifyImagesImported: countUniqueShopifyImages(input.shopifyProducts),
      walmartProductsMatchedToShopify,
      imagesAppliedFromShopify,
      ambiguousShopifyMatches,
      shopifyNoMatch,
      shopifyNoImageAvailable,
      stillMissingAfterShopify,
      diagnosticsEvents,
      diagnostics,
    },
  };
}

export async function reconcileWalmartProductsWithShopifyForUser(input: {
  userId: string;
  walmartProducts: WalmartProductRecord[];
  applyMode?: "missing_first" | "prefer_shopify";
  diagnosticsLimit?: number;
}): Promise<{ products: WalmartProductRecord[]; result: WalmartShopifyReconcileResult }> {
  const shopifyProducts = await listShopifyProductsForUser(input.userId);

  return reconcileWalmartProductsWithShopify({
    walmartProducts: input.walmartProducts,
    shopifyProducts,
    applyMode: input.applyMode,
    diagnosticsLimit: input.diagnosticsLimit,
  });
}
