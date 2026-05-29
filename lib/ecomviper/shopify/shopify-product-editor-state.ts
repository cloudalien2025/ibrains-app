import "server-only";

import { buildShopifyAgenticDemoWorkspaceState } from "@/lib/ecomviper/shopify/shopify-agentic-demo-data";
import { getShopifyConnectionStatusForUser } from "@/lib/ecomviper/shopify/shopify-connection";
import { hydrateShopifyLiveWorkspaceForUser } from "@/lib/ecomviper/shopify/shopify-live-hydrator";
import { getShopifyOpenAiConnectionStatusForUser } from "@/lib/ecomviper/shopify/openai-connection";
import { matchRocktomicBySkus } from "@/lib/ecomviper/dropshipping/rocktomic-supplier-intelligence";
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
  const supplierMatch = matchRocktomicBySkus(skus);

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
      pdpIntelligence && supplierMatch.product
        ? {
            ...pdpIntelligence,
            supplier: supplierMatch.product.supplier,
            supplier_sku: supplierMatch.product.sku,
          }
        : pdpIntelligence,
  };
}
