import "server-only";

import { buildShopifyAgenticDemoWorkspaceState } from "@/lib/ecomviper/shopify/shopify-agentic-demo-data";
import { getShopifyConnectionStatusForUser } from "@/lib/ecomviper/shopify/shopify-connection";
import { hydrateShopifyLiveWorkspaceForUser } from "@/lib/ecomviper/shopify/shopify-live-hydrator";
import { getShopifyOpenAiConnectionStatusForUser } from "@/lib/ecomviper/shopify/openai-connection";
import type { RocktomicSupplierProduct } from "@/lib/ecomviper/dropshipping/rocktomic-supplier-intelligence";
import { matchPrimarySupplierBySkus } from "@/lib/ecomviper/suppliers/supplier-intelligence";
import {
  buildCurrentShopifyListingDocket,
  buildEditableShopifyDraft,
  type ShopifyCurrentListingDocket,
  type ShopifyEditableDraftDocket,
  type ShopifyOptimizedProposalDocket,
} from "@/lib/ecomviper/shopify/shopify-product-docket";
import type { ShopifyPdpIntelligenceRecord } from "@/lib/ecomviper/shopify/shopify-pdp-intelligence";
import { getPersistedShopifyPdpIntelligenceForProduct } from "@/lib/ecomviper/shopify/shopify-pdp-intelligence-repository";
import {
  sourceLabel,
  sourceToHydrationMode,
  type ShopifyWorkspaceHydrationMode,
  type ShopifyWorkspaceSource,
  type ShopifyWorkspaceSourceLabel,
} from "@/lib/ecomviper/shopify/shopify-source-provenance";
import { listShopifyProductsForUser } from "@/lib/ecomviper/shopify/shopify-import";
import type { ShopifyProductRecord } from "@/lib/ecomviper/shopify/shopify-types";

interface BuildProductEditorStateOptions {
  userId: string | null;
  productReference: string;
  demoMode?: boolean;
}

interface ResolvedProduct {
  product: ShopifyProductRecord | null;
  source: ShopifyWorkspaceSource;
  sourceLabel: ShopifyWorkspaceSourceLabel;
  hydrationMode: ShopifyWorkspaceHydrationMode;
  lastSyncedAt: string | null;
  warnings: string[];
}

export interface ShopifyProductEditorInitialState {
  productReference: string;
  productFound: boolean;
  notFoundMessage: string | null;
  source: ShopifyWorkspaceSource;
  sourceLabel: ShopifyWorkspaceSourceLabel;
  hydrationMode: ShopifyWorkspaceHydrationMode;
  currentShopifyListing: ShopifyCurrentListingDocket | null;
  optimizedShopifyProposal: ShopifyOptimizedProposalDocket | null;
  editableShopifyDraft: ShopifyEditableDraftDocket | null;
  openAiConnected: boolean;
  openAiStatusLabel: string;
  lastSyncedAt: string | null;
  warnings: string[];
  pdpIntelligence: ShopifyPdpIntelligenceRecord | null;
  supplierContext: {
    matched: boolean;
    matchedSku: string | null;
    matchConfidence: number;
    matchReason: string;
    platform: string | null;
    inventoryAvailable: boolean;
    lastSupplierCheckAt: string | null;
    product: RocktomicSupplierProduct | null;
  };
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeReference(value: string): string {
  try {
    return decodeURIComponent(value).trim();
  } catch {
    return value.trim();
  }
}

function fallbackDemoHandle(title: string, fallbackId: string): string {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || fallbackId || "demo-product";
}

function toDemoProductRecord(input: {
  id: string;
  handle?: string;
  title: string;
  category: string;
}): ShopifyProductRecord {
  const handle = asString(input.handle) || fallbackDemoHandle(input.title, input.id);
  return {
    id: asString(input.id) || handle,
    storeDomain: "opanutrition.myshopify.com",
    title: asString(input.title) || "Demo product",
    handle,
    vendor: "OPA Nutrition",
    productType: asString(input.category) || "Supplements",
    status: "ACTIVE",
    tags: ["demo"],
    description: "Demo product listing. Connect Shopify for live product content.",
    descriptionHtml: "<p>Demo product listing. Connect Shopify for live product content.</p>",
    seoTitle: asString(input.title) || "Demo product",
    seoDescription: "Demo listing used only when demo mode is explicitly enabled.",
    metafields: [],
    onlineStoreUrl: `https://opanutrition.myshopify.com/products/${encodeURIComponent(handle)}`,
    primaryImageUrl: "",
    galleryImageUrls: [],
    galleryImages: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    variants: [],
  };
}

function resolveByReference(
  products: ShopifyProductRecord[],
  reference: string
): ShopifyProductRecord | null {
  const normalized = normalizeReference(reference);
  if (!normalized) return null;
  const normalizedLower = normalized.toLowerCase();

  const byId = products.find((product) => asString(product.id) === normalized);
  if (byId) return byId;

  const byHandle = products.find((product) => asString(product.handle).toLowerCase() === normalizedLower);
  if (byHandle) return byHandle;

  const byGidTail = products.find((product) => {
    const id = asString(product.id);
    if (!id) return false;
    const tail = id.split("/").pop();
    return tail ? tail === normalized : false;
  });
  if (byGidTail) return byGidTail;

  return null;
}

function computeShopifyInventoryStatus(product: ShopifyProductRecord): "in_stock" | "low_stock" | "out_of_stock" | "unknown" {
  const quantities = product.variants
    .map((variant) => variant.inventoryQuantity)
    .filter((quantity): quantity is number => typeof quantity === "number" && Number.isFinite(quantity));

  if (!quantities.length) return "unknown";
  const inStockCount = quantities.filter((quantity) => quantity > 0).length;
  if (inStockCount === 0) return "out_of_stock";
  if (inStockCount === quantities.length) return "in_stock";
  return "low_stock";
}

function firstVariantPrice(product: ShopifyProductRecord): number | null {
  const priced = product.variants.find((variant) => typeof variant.price === "number" && Number.isFinite(variant.price));
  return priced?.price ?? null;
}

async function resolveProduct(
  options: BuildProductEditorStateOptions
): Promise<ResolvedProduct> {
  const reference = normalizeReference(options.productReference);

  if (options.demoMode) {
    const demoWorkspace = buildShopifyAgenticDemoWorkspaceState();
    const demoProducts = demoWorkspace.products.map((product) =>
      toDemoProductRecord({
        id: product.id,
        handle: product.handle,
        title: product.title,
        category: product.category,
      })
    );
    const demoProduct = resolveByReference(demoProducts, reference);
    return {
      product: demoProduct,
      source: "demo",
      sourceLabel: sourceLabel("demo"),
      hydrationMode: sourceToHydrationMode("demo"),
      lastSyncedAt: null,
      warnings: [],
    };
  }

  if (!options.userId) {
    return {
      product: null,
      source: "unavailable",
      sourceLabel: sourceLabel("unavailable"),
      hydrationMode: sourceToHydrationMode("unavailable"),
      lastSyncedAt: null,
      warnings: ["Sign in and connect Shopify to open product editors."],
    };
  }

  const warnings: string[] = [];

  try {
    const status = await getShopifyConnectionStatusForUser(options.userId);
    if (status.connected && status.storeDomain) {
      try {
        const live = await hydrateShopifyLiveWorkspaceForUser({
          userId: options.userId,
          productsFirst: 180,
          collectionsFirst: 40,
          pagesFirst: 20,
          blogsFirst: 10,
          articlesFirst: 10,
        });
        const liveProduct = resolveByReference(live.products, reference);
        if (liveProduct) {
          return {
            product: liveProduct,
            source: "live_shopify",
            sourceLabel: sourceLabel("live_shopify"),
            hydrationMode: sourceToHydrationMode("live_shopify"),
            lastSyncedAt: live.fetchedAt,
            warnings: live.warnings,
          };
        }
        warnings.push("Live Shopify workspace loaded, but this product was not found in the current live window.");
      } catch (error) {
        warnings.push(
          error instanceof Error && error.message.trim()
            ? error.message.trim()
            : "Live Shopify hydration failed for product editor lookup."
        );
      }
    }
  } catch {
    warnings.push("Could not load Shopify connection status.");
  }

  try {
    const fallbackProducts = await listShopifyProductsForUser(options.userId);
    const fallbackProduct = resolveByReference(fallbackProducts, reference);
    if (fallbackProduct) {
      return {
        product: fallbackProduct,
        source: "fallback_snapshot",
        sourceLabel: sourceLabel("fallback_snapshot"),
        hydrationMode: sourceToHydrationMode("fallback_snapshot"),
        lastSyncedAt: fallbackProduct.updatedAt || null,
        warnings,
      };
    }
  } catch (error) {
    warnings.push(
      error instanceof Error && error.message.trim()
        ? error.message.trim()
        : "Fallback Shopify product lookup failed."
    );
  }

  return {
    product: null,
    source: "unavailable",
    sourceLabel: sourceLabel("unavailable"),
    hydrationMode: sourceToHydrationMode("unavailable"),
    lastSyncedAt: null,
    warnings,
  };
}

export async function buildShopifyProductEditorStateForUser(
  options: BuildProductEditorStateOptions
): Promise<ShopifyProductEditorInitialState> {
  const reference = normalizeReference(options.productReference);
  const resolved = await resolveProduct(options);

  let openAiConnected = false;
  let openAiStatusLabel = "Not connected";
  if (options.userId) {
    try {
      const openAiStatus = await getShopifyOpenAiConnectionStatusForUser(options.userId);
      openAiConnected = openAiStatus.connected;
      openAiStatusLabel = openAiStatus.connected ? "Connected" : "Not connected";
    } catch {
      openAiConnected = false;
      openAiStatusLabel = "Not connected";
    }
  }

  if (!resolved.product) {
    return {
      productReference: reference,
      productFound: false,
      notFoundMessage:
        "Product not found. Sync Shopify products and confirm the product id/handle from the Products table.",
      source: resolved.source,
      sourceLabel: resolved.sourceLabel,
      hydrationMode: resolved.hydrationMode,
      currentShopifyListing: null,
      optimizedShopifyProposal: null,
      editableShopifyDraft: null,
      openAiConnected,
      openAiStatusLabel,
      lastSyncedAt: resolved.lastSyncedAt,
      warnings: resolved.warnings,
      pdpIntelligence: null,
      supplierContext: {
        matched: false,
        matchedSku: null,
        matchConfidence: 0,
        matchReason: "no_supplier_sku_match",
        platform: null,
        inventoryAvailable: false,
        lastSupplierCheckAt: null,
        product: null,
      },
    };
  }

  const currentShopifyListing = buildCurrentShopifyListingDocket(resolved.product, {
    source: resolved.source,
    sourceLabel: resolved.sourceLabel,
    hydrationMode: resolved.hydrationMode,
    lastSyncedAt: resolved.lastSyncedAt,
  });

  let pdpIntelligence: ShopifyPdpIntelligenceRecord | null = null;
  if (options.userId) {
    try {
      pdpIntelligence = await getPersistedShopifyPdpIntelligenceForProduct({
        userId: options.userId,
        shopifyProductId: currentShopifyListing.productId,
        productHandle: currentShopifyListing.handle || null,
      });
    } catch {
      pdpIntelligence = null;
    }
  }

  const skus = currentShopifyListing.variants.map((entry) => entry.sku.trim()).filter(Boolean);
  const supplierSnapshot = await matchPrimarySupplierBySkus(skus, {
    userId: options.userId,
    allowRefresh: false,
    triggerBackgroundRefresh: false,
  }).catch(() => null);
  const supplierMatch = supplierSnapshot?.match;
  const supplierProductRaw = supplierMatch?.product ?? null;
  const shopifyPrice = firstVariantPrice(resolved.product);
  const rawPricing = supplierProductRaw?.pricing;
  const supplierProduct = supplierProductRaw
    ? {
        ...supplierProductRaw,
        pricing: {
          wholesaleCost: rawPricing?.wholesaleCost ?? null,
          msrp: rawPricing?.msrp ?? null,
          estimatedProfit:
            rawPricing?.wholesaleCost != null && shopifyPrice != null
              ? Number((shopifyPrice - rawPricing.wholesaleCost).toFixed(2))
              : null,
          marginPercent:
            rawPricing?.wholesaleCost != null && shopifyPrice != null && shopifyPrice > 0
              ? Number((((shopifyPrice - rawPricing.wholesaleCost) / shopifyPrice) * 100).toFixed(2))
              : null,
          currency: rawPricing?.currency ?? "USD",
          sourceStatus: rawPricing?.sourceStatus ?? "unknown",
          membershipTier: rawPricing?.membershipTier ?? null,
          membershipTiersDetected: rawPricing?.membershipTiersDetected ?? [],
          membershipTierCosts: rawPricing?.membershipTierCosts ?? {},
          sourceSheet: rawPricing?.sourceSheet ?? null,
          sourceColumn: rawPricing?.sourceColumn ?? null,
          lastCheckedAt: rawPricing?.lastCheckedAt ?? null,
          pricingStatusLabel:
            !rawPricing?.membershipTier
              ? "membership_tier_not_selected"
              : rawPricing?.wholesaleCost == null
                ? "source_unavailable_for_selected_membership_tier"
                : rawPricing?.pricingStatusLabel || "tier_pricing_mapped",
        },
      }
    : null;
  const inventoryAvailable = supplierSnapshot?.inventoryAvailable ?? false;
  const shopifyInventoryStatus = computeShopifyInventoryStatus(resolved.product);
  const supplierInventoryStatus =
    supplierProduct?.inventoryStatus && supplierProduct.inventoryStatus !== "unknown"
      ? supplierProduct.inventoryStatus
      : inventoryAvailable
        ? shopifyInventoryStatus
        : "unknown";

  return {
    productReference: reference,
    productFound: true,
    notFoundMessage: null,
    source: resolved.source,
    sourceLabel: resolved.sourceLabel,
    hydrationMode: resolved.hydrationMode,
    currentShopifyListing,
    optimizedShopifyProposal: null,
    editableShopifyDraft: buildEditableShopifyDraft(currentShopifyListing, null),
    openAiConnected,
    openAiStatusLabel,
    lastSyncedAt: resolved.lastSyncedAt,
    warnings: resolved.warnings,
    pdpIntelligence:
      pdpIntelligence && supplierProduct
        ? {
            ...pdpIntelligence,
            supplier: supplierProduct.supplier,
            supplier_sku: supplierProduct.sku,
            inventory_status: supplierInventoryStatus,
          }
        : pdpIntelligence,
    supplierContext: {
      matched: supplierMatch?.status === "rocktomic",
      matchedSku: supplierMatch?.matchedSku ?? null,
      matchConfidence: supplierMatch?.matchConfidence ?? 0,
      matchReason: supplierMatch?.matchReason ?? "no_supplier_sku_match",
      platform: supplierSnapshot?.platform ?? null,
      inventoryAvailable,
      lastSupplierCheckAt: supplierSnapshot?.lastCheckedAt ?? null,
      product: supplierProduct,
    },
  };
}
