"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import WalmartPageHeader from "@/app/apps/ecomviper/walmart/_components/page-header";
import StatusBadge from "@/app/apps/ecomviper/walmart/_components/status-badge";
import { filterWalmartProductsWithType } from "@/lib/ecomviper/walmart/walmart-product-filters";
import {
  extractWalmartPublicProductIdFromUrl,
  resolveCanonicalWalmartPublicIdentifier,
} from "@/lib/ecomviper/walmart/walmart-public-identifier";
import type { WalmartEffectiveProductRecord } from "@/lib/ecomviper/walmart/walmart-product-display";

interface ProductsClientProps {
  products: WalmartEffectiveProductRecord[];
  loadError?: string | null;
}

const filters = [
  { id: "all", label: "All" },
  { id: "needs_attention", label: "Needs attention" },
  { id: "out_of_stock", label: "Out of stock" },
  { id: "low_stock", label: "Low stock" },
  { id: "missing_image", label: "Image missing" },
  { id: "missing_attributes", label: "Missing attributes" },
  { id: "price_missing", label: "Price missing" },
  { id: "sync_failed", label: "Sync failed" },
  { id: "draft_pending", label: "Draft pending" },
] as const;

function formatInventory(product: WalmartEffectiveProductRecord): string {
  if (product.inventoryStatus === "unknown") return "—";
  if (product.inventoryStatus === "out_of_stock") return "Out of stock";
  return String(product.inventoryQuantity);
}

function normalizeSkuKey(sku: string): string {
  return sku.trim().toUpperCase();
}

function safeString(value: unknown, fallback = ""): string {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || fallback;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
}

function safeNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function safeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => safeString(entry)).filter((entry) => entry.length > 0);
}

function deriveWalmartListingUrlFromId(productId: string): string {
  const normalized = safeString(productId);
  if (!/^\d{6,20}$/.test(normalized)) return "";
  return `https://www.walmart.com/ip/${normalized}`;
}

function resolveVerifiedWalmartListingUrl(product: WalmartEffectiveProductRecord): string {
  const normalizedPayload = asObject(product.normalizedPayload);
  const rawPayload = asObject(product.rawPayload);

  const resolved = resolveCanonicalWalmartPublicIdentifier({
    publicWalmartUrlCandidates: [
      product.publicWalmartUrl,
      normalizedPayload?.publicWalmartUrl,
      normalizedPayload?.walmartProductUrl,
      normalizedPayload?.product_page_url,
      normalizedPayload?.productPageUrl,
      normalizedPayload?.canonicalUrl,
      rawPayload?.publicWalmartUrl,
      rawPayload?.walmartProductUrl,
      rawPayload?.product_page_url,
      rawPayload?.productPageUrl,
      rawPayload?.productUrl,
      rawPayload?.canonicalUrl,
      rawPayload?.url,
    ],
    explicitWalmartProductIdCandidates: [
      product.publicWalmartProductId,
      normalizedPayload?.publicWalmartProductId,
      rawPayload?.publicWalmartProductId,
    ],
    walmartItemIdCandidates: [
      product.itemId,
      normalizedPayload?.itemId,
      normalizedPayload?.usItemId,
      rawPayload?.itemId,
      rawPayload?.usItemId,
      rawPayload?.us_item_id,
    ],
    walmartPayloadProductIdCandidates: [
      normalizedPayload?.productId,
      normalizedPayload?.product_id,
      rawPayload?.productId,
      rawPayload?.product_id,
    ],
    upcCandidates: [product.upc, normalizedPayload?.upc, rawPayload?.upc],
    gtinCandidates: [product.gtin, normalizedPayload?.gtin, rawPayload?.gtin],
    nestedPayloadCandidates: [normalizedPayload, rawPayload],
  });

  const canUseIdentifier =
    resolved.preferredIdentifierType !== "missing_product_identifier" &&
    resolved.preferredIdentifierType !== "search_title_brand" &&
    resolved.preferredIdentifierType !== "gtin_skipped_for_product_lookup" &&
    resolved.preferredIdentifierType !== "upc_skipped_for_product_lookup";

  if (resolved.normalizedPublicWalmartUrl) {
    const productIdFromUrl = extractWalmartPublicProductIdFromUrl(resolved.normalizedPublicWalmartUrl);
    if (productIdFromUrl) {
      return resolved.normalizedPublicWalmartUrl;
    }
  }

  if (!canUseIdentifier) return "";
  return deriveWalmartListingUrlFromId(resolved.preferredWalmartProductId);
}

type SkuSortDirection = "none" | "asc" | "desc";
type ImportPanelStage =
  | "idle"
  | "importing_products"
  | "normalizing_catalog"
  | "enriching_images"
  | "complete"
  | "completed_with_warnings"
  | "failed";

interface ImportPanelState {
  stage: ImportPanelStage;
  percent: number;
  importedCount: number;
  fetchedCount: number;
  processedCount: number;
  queuedCount: number;
  foundCount: number;
  fromImportPayloadCount: number;
  enrichedCount: number;
  walmartSearchResolvedCount: number;
  walmartSearchImageFoundCount: number;
  serpApiBrandSearchThumbnailImageFoundCount: number;
  serpApiBrandSearchPublicListingMatchedCount: number;
  serpApiBrandSearchAmbiguousCount: number;
  serpApiBrandSearchNoConfidentMatchCount: number;
  serpApiFallbackImageFoundCount: number;
  serpApiProductGalleryImageFoundCount: number;
  serpApiSearchFallbackImageFoundCount: number;
  perProductSerpApiSearchesAttempted: number;
  perProductSerpApiMatches: number;
  perProductSerpApiThumbnailsSaved: number;
  noConfidentMatchContinuedToFallback: number;
  ambiguousContinuedToFallback: number;
  ambiguousSkippedCount: number;
  walmartItemSearchExactIdentifierMatchCount: number;
  walmartItemSearchIdentifierNormalizedMatchCount: number;
  walmartItemSearchIdentifierAssistedMatchCount: number;
  walmartItemSearchMultipleCandidatesRejectedCount: number;
  walmartItemSearchSingleCandidateNoImageCount: number;
  walmartSearchNotFoundCount: number;
  queuedForRemainingRetryCount: number;
  stillMissingCount: number;
  missingCount: number;
  notFoundCount: number;
  ambiguousCount: number;
  failedCount: number;
  skippedNoProviderCount: number;
  providerConnected: boolean;
  providerStatus:
    | "connected"
    | "not_connected"
    | "invalid_key"
    | "forbidden"
    | "rate_limited"
    | "bad_request"
    | "network_error"
    | "malformed_response"
    | "provider_error"
    | "unknown_error";
  providerStatusReason: string | null;
  providerCanAttempt: boolean;
  noImageReason: string | null;
  enrichmentBounded: boolean;
  enrichmentBoundedLimit: number | null;
  enrichmentDeferredCount: number;
  importErrorCategory:
    | "none"
    | "walmart_credentials_missing"
    | "walmart_auth_failed"
    | "walmart_token_failed"
    | "walmart_products_fetch_failed"
    | "walmart_products_response_invalid"
    | "walmart_products_empty"
    | "product_normalization_failed"
    | "product_persistence_failed"
    | "user_scope_failed"
    | "database_failed"
    | "import_request_invalid"
    | "import_gateway_timeout"
    | "import_unknown_error";
  importErrorReason: string | null;
  importErrorPhase:
    | "request_validation"
    | "user_scope"
    | "walmart_credentials"
    | "walmart_auth"
    | "walmart_token"
    | "walmart_products_fetch"
    | "walmart_products_parse"
    | "product_normalization"
    | "product_persistence"
    | "database"
    | "gateway_timeout"
    | "import_unknown"
    | null;
  importErrorStatusCode: number | null;
  importErrorEndpointFamily: string | null;
  importErrorCorrelationId: string | null;
  importErrorResponseShape: string | null;
  existingProductsShownCount: number;
  summary: string;
  running: boolean;
}

const ALLOWED_INVENTORY_STATUSES = new Set<WalmartEffectiveProductRecord["inventoryStatus"]>([
  "known",
  "unknown",
  "out_of_stock",
]);

const ALLOWED_PRODUCT_STATUSES = new Set<WalmartEffectiveProductRecord["status"]>([
  "active",
  "attention",
  "draft",
  "sync_failed",
]);

const ALLOWED_IMAGE_SYNC_STATUSES = new Set<
  NonNullable<WalmartEffectiveProductRecord["imageSyncStatus"]>
>(["found", "not_found", "ambiguous", "failed", "not_synced"]);

const ALLOWED_IMAGE_SOURCES = new Set<NonNullable<WalmartEffectiveProductRecord["imageSource"]>>([
  "walmart_item_report",
  "walmart_catalog",
  "walmart_item_search",
  "serpapi_walmart_brand_search",
  "public_walmart_listing_serpapi",
  "manual",
  "shopify_placeholder",
  "manual_placeholder",
  "none",
]);

function safeEnum<T extends string>(value: unknown, allowed: Set<T>, fallback: T): T {
  const candidate = safeString(value);
  if (!candidate) return fallback;
  return allowed.has(candidate as T) ? (candidate as T) : fallback;
}

function safeSkuRouteSegment(sku: string): string {
  try {
    return encodeURIComponent(sku);
  } catch {
    const withoutSurrogates = sku.replace(/[\uD800-\uDFFF]/g, "");
    const fallback = withoutSurrogates.trim() || "UNKNOWN-SKU";
    return encodeURIComponent(fallback);
  }
}

function compareSkuNatural(
  left: WalmartEffectiveProductRecord,
  right: WalmartEffectiveProductRecord,
  direction: Exclude<SkuSortDirection, "none">
): number {
  const compared = left.sku.localeCompare(right.sku, undefined, {
    numeric: true,
    sensitivity: "base",
  });
  return direction === "asc" ? compared : compared * -1;
}

function formatImageStatus(product: WalmartEffectiveProductRecord): string {
  if (product.imageStatusMessage?.trim()) {
    const message = product.imageStatusMessage.trim();
    if (message === "SerpApi returned an error response.") {
      return "SerpApi provider error.";
    }
    if (message.includes("Connect your SerpApi key")) {
      return "SerpApi key missing.";
    }
    return message;
  }
  if (product.imageSyncStatus === "not_found") {
    if (product.imageSource === "walmart_item_report") return "No matching row found in Walmart Item Report.";
    if (product.imageSource === "serpapi_walmart_brand_search")
      return "No confident public listing match from SerpApi brand search.";
    if (product.imageSource === "public_walmart_listing_serpapi")
      return "No safe public Walmart image match found.";
    if (product.imageSource === "manual") return "Manual image URL not provided.";
    return "Item Search returned no usable image.";
  }
  if (product.imageSyncStatus === "ambiguous") {
    if (product.imageSource === "serpapi_walmart_brand_search")
      return "SerpApi brand-search listing match is ambiguous.";
    if (product.imageSource === "public_walmart_listing_serpapi")
      return "Public Walmart listing image match is ambiguous.";
    return "Multiple Walmart Item Search candidates matched this product.";
  }
  if (product.imageSyncStatus === "failed") {
    if (product.imageSource === "walmart_item_report") return "Walmart Item Report request failed.";
    if (product.imageSource === "public_walmart_listing_serpapi")
      return "SerpApi provider error.";
    return "Item Search request failed after retry.";
  }
  if (product.imageSyncStatus === "not_synced") {
    if (product.imageSource === "public_walmart_listing_serpapi")
      return "SerpApi key missing.";
    if (product.imageSource === "manual") return "Manual image URL not provided.";
    return "Image enrichment not synced.";
  }
  if (product.imageUrl) return "Image available";
  return "Image enrichment not synced.";
}

function formatImageSource(product: WalmartEffectiveProductRecord): string {
  if (product.imageSource === "walmart_item_report") return "Walmart Item Report";
  if (product.imageSource === "walmart_catalog") return "Walmart Seller Catalog Search";
  if (product.imageSource === "walmart_item_search") return "Walmart Item Search";
  if (product.imageSource === "serpapi_walmart_brand_search")
    return "SerpApi Walmart brand search";
  if (product.imageSource === "public_walmart_listing_serpapi")
    return "Public Walmart listing via SerpApi";
  if (product.imageSource === "manual") return "Manual image URL";
  return "Not synced";
}

function hasPendingDraftImage(product: WalmartEffectiveProductRecord): boolean {
  if (!product.hasDraftChanges) return false;
  const current = product.imageUrl?.trim() ?? "";
  const live = product.liveImageUrl?.trim() ?? "";
  return current !== live;
}

function importStageLabel(stage: ImportPanelStage): string {
  if (stage === "importing_products") return "Importing products";
  if (stage === "normalizing_catalog") return "Normalizing catalog";
  if (stage === "enriching_images") return "Enriching images";
  if (stage === "complete") return "Complete";
  if (stage === "completed_with_warnings") return "Completed with warnings";
  if (stage === "failed") return "Failed";
  return "Idle";
}

function formatSerpApiProviderStatus(
  status: ImportPanelState["providerStatus"],
  fallbackConnected: boolean
): string {
  if (status === "connected") return "Connected";
  if (status === "not_connected") return "Not connected";
  if (status === "invalid_key") return "Invalid key";
  if (status === "forbidden") return "Forbidden";
  if (status === "rate_limited") return "Rate limited";
  if (status === "bad_request") return "Bad request";
  if (status === "network_error") return "Network error";
  if (status === "malformed_response") return "Malformed response";
  if (status === "provider_error") return "Provider error";
  if (status === "unknown_error") return "Unknown error";
  return fallbackConnected ? "Connected" : "Not connected";
}

function normalizeProductForRender(product: WalmartEffectiveProductRecord): WalmartEffectiveProductRecord {
  const normalizedImageUrl = safeString(product.imageUrl);
  const normalizedLiveImageUrl = safeString(product.liveImageUrl);
  return {
    ...product,
    sku: safeString(product.sku, "UNKNOWN-SKU"),
    title: safeString(product.title, "Untitled product"),
    brand: safeString(product.brand, "Unknown"),
    price: safeNumber(product.price, 0),
    inventoryQuantity: Math.max(0, safeNumber(product.inventoryQuantity, 0)),
    inventoryStatus: safeEnum(product.inventoryStatus, ALLOWED_INVENTORY_STATUSES, "unknown"),
    status: safeEnum(product.status, ALLOWED_PRODUCT_STATUSES, "attention"),
    imageUrl: normalizedImageUrl,
    liveImageUrl: normalizedLiveImageUrl,
    imageStatusMessage: safeString(product.imageStatusMessage) || undefined,
    imageSource: safeEnum(product.imageSource, ALLOWED_IMAGE_SOURCES, "none"),
    imageSyncStatus: safeEnum(product.imageSyncStatus, ALLOWED_IMAGE_SYNC_STATUSES, "not_synced"),
    issues: safeStringArray(product.issues),
    lastSyncedAt: safeString(product.lastSyncedAt, "—"),
    publicWalmartUrl: safeString(product.publicWalmartUrl) || undefined,
    publicWalmartProductId: safeString(product.publicWalmartProductId) || undefined,
    liveBrand: safeString(product.liveBrand) || undefined,
    liveTitle: safeString(product.liveTitle) || undefined,
    livePrice: safeNumber(product.livePrice, 0),
    liveInventoryQuantity: Math.max(0, safeNumber(product.liveInventoryQuantity, 0)),
    liveGalleryImageUrls: safeStringArray(product.liveGalleryImageUrls),
    galleryImageUrls: safeStringArray(product.galleryImageUrls),
    variantImageUrls: safeStringArray(product.variantImageUrls),
    draftUpdatedAt: safeString(product.draftUpdatedAt) || null,
    hasDraftChanges: Boolean(product.hasDraftChanges),
  };
}

export default function WalmartProductsClient({ products, loadError = null }: ProductsClientProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [skuSortDirection, setSkuSortDirection] = useState<SkuSortDirection>("none");
  const [message, setMessage] = useState<string | null>(loadError);
  const [isImporting, setIsImporting] = useState(false);
  const [importPanel, setImportPanel] = useState<ImportPanelState | null>(null);
  const [lastImportDiagnostics, setLastImportDiagnostics] = useState<{
    imageFromImportPayloadCount: number;
    imageEnrichedCount: number;
    imageFromWalmartSearchCount: number;
    imageFromSerpApiBrandSearchThumbnailCount: number;
    publicListingsDiscoveredViaSerpApiBrandSearchCount: number;
    serpApiBrandSearchAmbiguousCount: number;
    serpApiBrandSearchNoConfidentMatchCount: number;
    imageFromSerpApiFallbackCount: number;
    imageFromSerpApiProductGalleryCount: number;
    imageFromSerpApiSearchFallbackCount: number;
    imageStillMissingCount: number;
    imageNotFoundCount: number;
    imageAmbiguousCount: number;
    imageFailedCount: number;
    imageSkippedNoProviderCount: number;
    enrichmentDeferredCount: number;
  } | null>(null);
  const [locallyRemovedSkuKeys, setLocallyRemovedSkuKeys] = useState<string[]>([]);
  const [removeTarget, setRemoveTarget] = useState<{
    sku: string;
    title: string;
    hasDraftChanges: boolean;
  } | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  useEffect(() => {
    if (!loadError) return;
    setMessage(loadError);
  }, [loadError]);

  const allProducts = useMemo(
    () =>
      (Array.isArray(products) ? products : [])
        .map((product) => normalizeProductForRender(product))
        .filter((product) => !locallyRemovedSkuKeys.includes(normalizeSkuKey(product.sku))),
    [products, locallyRemovedSkuKeys]
  );

  const visibleProducts = useMemo(() => {
    const filteredProducts = filterWalmartProductsWithType(allProducts, { query, filter });
    if (skuSortDirection === "none") return filteredProducts;
    return [...filteredProducts].sort((left, right) => compareSkuNatural(left, right, skuSortDirection));
  }, [allProducts, query, filter, skuSortDirection]);

  const hasImportedProducts = allProducts.length > 0;
  const isImportEmpty = !hasImportedProducts;
  const isFilteredEmpty = hasImportedProducts && visibleProducts.length === 0;
  const showConnectedIdentifierWarning = Boolean(
    importPanel &&
      importPanel.providerConnected &&
      importPanel.providerStatus !== "not_connected" &&
      importPanel.providerStatus !== "invalid_key" &&
      importPanel.providerStatus !== "forbidden" &&
      importPanel.providerStatus !== "rate_limited" &&
      (importPanel.failedCount > 0 || importPanel.notFoundCount > 0 || importPanel.ambiguousCount > 0)
  );

  const emptyStateMessage = useMemo(() => {
    if (isImportEmpty) {
      return "No Walmart products imported yet. Connect Walmart, then import your products.";
    }
    if (!isFilteredEmpty) return null;
    if (filter === "draft_pending") {
      return "No products with pending drafts match this filter.";
    }
    return "No products match the selected filter.";
  }, [filter, isFilteredEmpty, isImportEmpty]);

  const skuSortLabel = useMemo(() => {
    if (skuSortDirection === "asc") return "SKU ↑";
    if (skuSortDirection === "desc") return "SKU ↓";
    return "SKU ↕";
  }, [skuSortDirection]);

  const skuAriaSort = useMemo(() => {
    if (skuSortDirection === "asc") return "ascending";
    if (skuSortDirection === "desc") return "descending";
    return "none";
  }, [skuSortDirection]);

  const draftLinkHrefBySku = useMemo(
    () =>
      new Map<string, string>(
        allProducts.map((product) => [
          product.sku,
          product.hasDraftChanges
            ? `/apps/ecomviper/walmart/products/${safeSkuRouteSegment(product.sku)}`
            : "/apps/ecomviper/walmart/drafts",
        ])
      ),
    [allProducts]
  );

  async function handleImport(mode: "import" | "retry_image_enrichment" = "import") {
    setIsImporting(true);
    setMessage(null);
    const stageTimers: ReturnType<typeof setTimeout>[] = [];
    setImportPanel({
      stage: mode === "retry_image_enrichment" ? "enriching_images" : "importing_products",
      percent: mode === "retry_image_enrichment" ? 42 : 12,
      importedCount: 0,
      fetchedCount: 0,
      processedCount: 0,
      queuedCount: 0,
      foundCount: 0,
      fromImportPayloadCount: 0,
      enrichedCount: 0,
      walmartSearchResolvedCount: 0,
      walmartSearchImageFoundCount: 0,
      serpApiBrandSearchThumbnailImageFoundCount: 0,
      serpApiBrandSearchPublicListingMatchedCount: 0,
      serpApiBrandSearchAmbiguousCount: 0,
      serpApiBrandSearchNoConfidentMatchCount: 0,
      serpApiFallbackImageFoundCount: 0,
      serpApiProductGalleryImageFoundCount: 0,
      serpApiSearchFallbackImageFoundCount: 0,
      perProductSerpApiSearchesAttempted: 0,
      perProductSerpApiMatches: 0,
      perProductSerpApiThumbnailsSaved: 0,
      noConfidentMatchContinuedToFallback: 0,
      ambiguousContinuedToFallback: 0,
      ambiguousSkippedCount: 0,
      walmartItemSearchExactIdentifierMatchCount: 0,
      walmartItemSearchIdentifierNormalizedMatchCount: 0,
      walmartItemSearchIdentifierAssistedMatchCount: 0,
      walmartItemSearchMultipleCandidatesRejectedCount: 0,
      walmartItemSearchSingleCandidateNoImageCount: 0,
      walmartSearchNotFoundCount: 0,
      queuedForRemainingRetryCount: 0,
      stillMissingCount: 0,
      missingCount: 0,
      notFoundCount: 0,
      ambiguousCount: 0,
      failedCount: 0,
      skippedNoProviderCount: 0,
      providerConnected: false,
      providerStatus: "not_connected",
      providerStatusReason: null,
      providerCanAttempt: false,
      noImageReason: null,
      enrichmentBounded: mode !== "retry_image_enrichment",
      enrichmentBoundedLimit: null,
      enrichmentDeferredCount: 0,
      importErrorCategory: "none",
      importErrorReason: null,
      importErrorPhase: null,
      importErrorStatusCode: null,
      importErrorEndpointFamily: null,
      importErrorCorrelationId: null,
      importErrorResponseShape: null,
      existingProductsShownCount: 0,
      summary:
        mode === "retry_image_enrichment"
          ? "Retrying image enrichment..."
          : "Importing products...",
      running: true,
    });

    if (mode !== "retry_image_enrichment") {
      stageTimers.push(
        setTimeout(() => {
          setImportPanel((current) =>
            current && current.running
              ? {
                  ...current,
                  stage: "normalizing_catalog",
                  percent: Math.max(current.percent, 36),
                  summary: "Normalizing catalog...",
                }
              : current
          );
        }, 450)
      );
    }

    stageTimers.push(
      setTimeout(() => {
        setImportPanel((current) =>
          current && current.running
            ? {
                ...current,
                stage: "enriching_images",
                percent: Math.max(current.percent, 68),
                summary: "Enriching images...",
              }
            : current
        );
      }, mode === "retry_image_enrichment" ? 350 : 900)
    );

    try {
      const response = await fetch("/api/ecomviper/walmart/products/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: mode === "retry_image_enrichment" ? "retry_image_enrichment" : "import",
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        message?: string;
        importedCount?: number;
        fetchedCount?: number;
        importProgress?: {
          stage?: "complete" | "completed_with_warnings" | "failed";
          providerConnected?: boolean;
          providerStatus?:
            | "connected"
            | "not_connected"
            | "invalid_key"
            | "forbidden"
            | "rate_limited"
            | "bad_request"
            | "network_error"
            | "malformed_response"
            | "provider_error"
            | "unknown_error";
          providerStatusReason?: string | null;
          providerCanAttempt?: boolean;
          noImageReason?: string | null;
          enrichmentBounded?: boolean;
          enrichmentBoundedLimit?: number | null;
          enrichmentDeferredCount?: number;
          importErrorCategory?:
            | "none"
            | "walmart_credentials_missing"
            | "walmart_auth_failed"
            | "walmart_token_failed"
            | "walmart_products_fetch_failed"
            | "walmart_products_response_invalid"
            | "walmart_products_empty"
            | "product_normalization_failed"
            | "product_persistence_failed"
            | "user_scope_failed"
            | "database_failed"
            | "import_request_invalid"
            | "import_gateway_timeout"
            | "import_unknown_error";
          importErrorReason?: string | null;
          importErrorPhase?:
            | "request_validation"
            | "user_scope"
            | "walmart_credentials"
            | "walmart_auth"
            | "walmart_token"
            | "walmart_products_fetch"
            | "walmart_products_parse"
            | "product_normalization"
            | "product_persistence"
            | "database"
            | "gateway_timeout"
            | "import_unknown"
            | null;
          importErrorStatusCode?: number | null;
          importErrorEndpointFamily?: string | null;
          importErrorCorrelationId?: string | null;
          importErrorResponseShape?: string | null;
          existingProductsShownCount?: number;
          totals?: {
            importedCount?: number;
            fetchedCount?: number;
            processedCount?: number;
            queuedCount?: number;
            imageFoundCount?: number;
            imageFromImportPayloadCount?: number;
            imageEnrichedCount?: number;
            imageFromWalmartSearchCount?: number;
            imageFromSerpApiBrandSearchThumbnailCount?: number;
            publicListingsDiscoveredViaSerpApiBrandSearchCount?: number;
            serpApiBrandSearchAmbiguousCount?: number;
            serpApiBrandSearchNoConfidentMatchCount?: number;
            imageFromSerpApiFallbackCount?: number;
            imageFromSerpApiProductGalleryCount?: number;
            imageFromSerpApiSearchFallbackCount?: number;
            perProductSerpApiSearchesAttempted?: number;
            perProductSerpApiMatches?: number;
            perProductSerpApiThumbnailsSaved?: number;
            noConfidentMatchContinuedToFallback?: number;
            ambiguousContinuedToFallback?: number;
            ambiguousSkippedCount?: number;
            walmartItemSearchExactIdentifierMatchCount?: number;
            walmartItemSearchIdentifierNormalizedMatchCount?: number;
            walmartItemSearchIdentifierAssistedMatchCount?: number;
            walmartItemSearchMultipleCandidatesRejectedCount?: number;
            walmartItemSearchSingleCandidateNoImageCount?: number;
            walmartSearchNotFoundCount?: number;
            imageStillMissingCount?: number;
            imageMissingCount?: number;
            imageNotFoundCount?: number;
            imageAmbiguousCount?: number;
            imageFailedCount?: number;
            imageSkippedNoProviderCount?: number;
          };
        };
        importDiagnostics?: {
          payloadShape?: string;
          fetchedCount?: number;
          inventoryUnknownCount?: number;
          imageFoundCount?: number;
          imageFromImportPayloadCount?: number;
          imageEnrichedCount?: number;
          imageFromWalmartSearchCount?: number;
          imageFromSerpApiBrandSearchThumbnailCount?: number;
          publicListingsDiscoveredViaSerpApiBrandSearchCount?: number;
          serpApiBrandSearchAmbiguousCount?: number;
          serpApiBrandSearchNoConfidentMatchCount?: number;
          imageFromSerpApiFallbackCount?: number;
          imageFromSerpApiProductGalleryCount?: number;
          imageFromSerpApiSearchFallbackCount?: number;
          perProductSerpApiSearchesAttempted?: number;
          perProductSerpApiMatches?: number;
          perProductSerpApiThumbnailsSaved?: number;
          noConfidentMatchContinuedToFallback?: number;
          ambiguousContinuedToFallback?: number;
          ambiguousSkippedCount?: number;
          walmartItemSearchExactIdentifierMatchCount?: number;
          walmartItemSearchIdentifierNormalizedMatchCount?: number;
          walmartItemSearchIdentifierAssistedMatchCount?: number;
          walmartItemSearchMultipleCandidatesRejectedCount?: number;
          walmartItemSearchSingleCandidateNoImageCount?: number;
          walmartSearchNotFoundCount?: number;
          imageStillMissingCount?: number;
          imageNotFoundCount?: number;
          imageAmbiguousCount?: number;
          imageFailedCount?: number;
          imageSkippedNoProviderCount?: number;
          enrichmentQueuedCount?: number;
          enrichmentCompletedCount?: number;
          enrichmentProcessedCount?: number;
          enrichmentProviderConnected?: boolean;
          imageEnrichmentNoImageReason?: string | null;
          serpApiStatus?:
            | "connected"
            | "not_connected"
            | "invalid_key"
            | "forbidden"
            | "rate_limited"
            | "bad_request"
            | "network_error"
            | "malformed_response"
            | "provider_error"
            | "unknown_error";
          serpApiStatusReason?: string | null;
          serpApiCanAttempt?: boolean;
          imageEnrichmentBounded?: boolean;
          imageEnrichmentImportLimit?: number | null;
          imageEnrichmentDeferredCount?: number;
          serpApiBrandSearchDiagnostics?: {
            serpapi_brand_search_checked?: number;
            serpapi_brand_search_results_harvested?: number;
            serpapi_brand_search_public_listing_matched?: number;
            serpapi_brand_search_thumbnail_saved?: number;
            serpapi_brand_search_ambiguous?: number;
            serpapi_brand_search_no_confident_match?: number;
          };
          walmartItemSearchDiagnostics?: {
            walmart_item_search_exact_identifier_match?: number;
            walmart_item_search_identifier_normalized_match?: number;
            walmart_item_search_identifier_assisted_match?: number;
            walmart_item_search_multiple_candidates_rejected?: number;
            walmart_item_search_single_candidate_no_image?: number;
          };
          serpApiPerProductDiagnostics?: {
            serpapi_per_product_searches_attempted?: number;
            serpapi_per_product_matches?: number;
            serpapi_per_product_thumbnails_saved?: number;
            no_confident_match_continued_to_fallback?: number;
            ambiguous_continued_to_fallback?: number;
            ambiguous_skipped?: number;
          };
        };
        error?: { message?: string };
      };

      if (!response.ok) {
        const isGatewayTimeout = response.status === 504;
        const failureMessage =
          payload.importProgress?.importErrorReason ??
          payload.error?.message ??
          (isGatewayTimeout
            ? "Import request timed out at the gateway before completion. Try Import Products again or run Retry image enrichment after products are imported."
            : `Import failed (HTTP ${response.status}).`);
        const totals = payload.importProgress?.totals;
        const existingProductsShownCount = payload.importProgress?.existingProductsShownCount ?? 0;
        const providerConnected = payload.importProgress?.providerConnected ?? false;
        const providerStatus =
          payload.importProgress?.providerStatus ??
          (isGatewayTimeout ? "unknown_error" : providerConnected ? "connected" : "not_connected");
        const providerStatusReason =
          payload.importProgress?.providerStatusReason ??
          (isGatewayTimeout ? "Provider status unavailable because the import request timed out." : null);
        const perProductSerpApiSearchesAttempted =
          totals?.perProductSerpApiSearchesAttempted ?? 0;
        const perProductSerpApiMatches = totals?.perProductSerpApiMatches ?? 0;
        const perProductSerpApiThumbnailsSaved = totals?.perProductSerpApiThumbnailsSaved ?? 0;
        const noConfidentMatchContinuedToFallback =
          totals?.noConfidentMatchContinuedToFallback ?? 0;
        const ambiguousContinuedToFallback = totals?.ambiguousContinuedToFallback ?? 0;
        const ambiguousSkippedCount = totals?.ambiguousSkippedCount ?? 0;
        const walmartItemSearchExactIdentifierMatchCount =
          totals?.walmartItemSearchExactIdentifierMatchCount ?? 0;
        const walmartItemSearchIdentifierNormalizedMatchCount =
          totals?.walmartItemSearchIdentifierNormalizedMatchCount ?? 0;
        const walmartItemSearchIdentifierAssistedMatchCount =
          totals?.walmartItemSearchIdentifierAssistedMatchCount ?? 0;
        const walmartItemSearchMultipleCandidatesRejectedCount =
          totals?.walmartItemSearchMultipleCandidatesRejectedCount ?? 0;
        const walmartItemSearchSingleCandidateNoImageCount =
          totals?.walmartItemSearchSingleCandidateNoImageCount ?? 0;
        const queuedForRemainingRetryCount = Math.max(
          0,
          (totals?.queuedCount ?? 0) - (totals?.processedCount ?? 0)
        );
        const summaryWithContext =
          existingProductsShownCount > 0
            ? `${failureMessage} Existing products shown below are from the previous successful import.`
            : failureMessage;
        setMessage(failureMessage);
        setImportPanel({
          stage: "failed",
          percent: 100,
          importedCount: totals?.importedCount ?? 0,
          fetchedCount: totals?.fetchedCount ?? 0,
          processedCount: totals?.processedCount ?? 0,
          queuedCount: totals?.queuedCount ?? 0,
          foundCount: totals?.imageFoundCount ?? 0,
          fromImportPayloadCount: totals?.imageFromImportPayloadCount ?? 0,
          enrichedCount: totals?.imageEnrichedCount ?? 0,
          walmartSearchResolvedCount: totals?.imageFromWalmartSearchCount ?? 0,
          walmartSearchImageFoundCount: totals?.imageFromWalmartSearchCount ?? 0,
          serpApiBrandSearchThumbnailImageFoundCount:
            totals?.imageFromSerpApiBrandSearchThumbnailCount ?? 0,
          serpApiBrandSearchPublicListingMatchedCount:
            totals?.publicListingsDiscoveredViaSerpApiBrandSearchCount ?? 0,
          serpApiBrandSearchAmbiguousCount: totals?.serpApiBrandSearchAmbiguousCount ?? 0,
          serpApiBrandSearchNoConfidentMatchCount:
            totals?.serpApiBrandSearchNoConfidentMatchCount ?? 0,
          serpApiFallbackImageFoundCount: totals?.imageFromSerpApiFallbackCount ?? 0,
          serpApiProductGalleryImageFoundCount:
            totals?.imageFromSerpApiProductGalleryCount ?? 0,
          serpApiSearchFallbackImageFoundCount:
            totals?.imageFromSerpApiSearchFallbackCount ?? 0,
          perProductSerpApiSearchesAttempted,
          perProductSerpApiMatches,
          perProductSerpApiThumbnailsSaved,
          noConfidentMatchContinuedToFallback,
          ambiguousContinuedToFallback,
          ambiguousSkippedCount,
          walmartItemSearchExactIdentifierMatchCount,
          walmartItemSearchIdentifierNormalizedMatchCount,
          walmartItemSearchIdentifierAssistedMatchCount,
          walmartItemSearchMultipleCandidatesRejectedCount,
          walmartItemSearchSingleCandidateNoImageCount,
          walmartSearchNotFoundCount: totals?.walmartSearchNotFoundCount ?? 0,
          queuedForRemainingRetryCount,
          stillMissingCount: totals?.imageStillMissingCount ?? totals?.imageMissingCount ?? 0,
          missingCount:
            totals?.imageStillMissingCount ?? totals?.imageMissingCount ?? 0,
          notFoundCount: totals?.imageNotFoundCount ?? 0,
          ambiguousCount: totals?.imageAmbiguousCount ?? 0,
          failedCount: totals?.imageFailedCount ?? 0,
          skippedNoProviderCount: totals?.imageSkippedNoProviderCount ?? 0,
          providerConnected,
          providerStatus,
          providerStatusReason,
          providerCanAttempt: payload.importProgress?.providerCanAttempt ?? providerConnected,
          noImageReason: payload.importProgress?.noImageReason ?? null,
          enrichmentBounded: payload.importProgress?.enrichmentBounded ?? false,
          enrichmentBoundedLimit: payload.importProgress?.enrichmentBoundedLimit ?? null,
          enrichmentDeferredCount: payload.importProgress?.enrichmentDeferredCount ?? 0,
          importErrorCategory:
            payload.importProgress?.importErrorCategory ??
            (isGatewayTimeout ? "import_gateway_timeout" : "import_unknown_error"),
          importErrorReason: payload.importProgress?.importErrorReason ?? failureMessage,
          importErrorPhase:
            payload.importProgress?.importErrorPhase ??
            (isGatewayTimeout ? "gateway_timeout" : "import_unknown"),
          importErrorStatusCode: payload.importProgress?.importErrorStatusCode ?? (isGatewayTimeout ? 504 : null),
          importErrorEndpointFamily:
            payload.importProgress?.importErrorEndpointFamily ?? (isGatewayTimeout ? "gateway" : null),
          importErrorCorrelationId: payload.importProgress?.importErrorCorrelationId ?? null,
          importErrorResponseShape: payload.importProgress?.importErrorResponseShape ?? null,
          existingProductsShownCount,
          summary: summaryWithContext,
          running: false,
        });
        return;
      }

      const totals = payload.importProgress?.totals;
      const importedCount = totals?.importedCount ?? payload.importedCount ?? 0;
      const hasImageDiagnostics =
        totals?.imageFoundCount !== undefined ||
        totals?.imageFromImportPayloadCount !== undefined ||
        totals?.imageEnrichedCount !== undefined ||
        totals?.imageFromWalmartSearchCount !== undefined ||
        totals?.imageFromSerpApiBrandSearchThumbnailCount !== undefined ||
        totals?.publicListingsDiscoveredViaSerpApiBrandSearchCount !== undefined ||
        totals?.serpApiBrandSearchAmbiguousCount !== undefined ||
        totals?.serpApiBrandSearchNoConfidentMatchCount !== undefined ||
        totals?.imageFromSerpApiFallbackCount !== undefined ||
        totals?.imageFromSerpApiProductGalleryCount !== undefined ||
        totals?.imageFromSerpApiSearchFallbackCount !== undefined ||
        totals?.perProductSerpApiSearchesAttempted !== undefined ||
        totals?.perProductSerpApiMatches !== undefined ||
        totals?.perProductSerpApiThumbnailsSaved !== undefined ||
        totals?.noConfidentMatchContinuedToFallback !== undefined ||
        totals?.ambiguousContinuedToFallback !== undefined ||
        totals?.ambiguousSkippedCount !== undefined ||
        totals?.walmartItemSearchExactIdentifierMatchCount !== undefined ||
        totals?.walmartItemSearchIdentifierNormalizedMatchCount !== undefined ||
        totals?.walmartItemSearchIdentifierAssistedMatchCount !== undefined ||
        totals?.walmartItemSearchMultipleCandidatesRejectedCount !== undefined ||
        totals?.walmartItemSearchSingleCandidateNoImageCount !== undefined ||
        totals?.imageStillMissingCount !== undefined ||
        totals?.imageNotFoundCount !== undefined ||
        totals?.imageAmbiguousCount !== undefined ||
        totals?.imageFailedCount !== undefined ||
        totals?.imageSkippedNoProviderCount !== undefined ||
        payload.importDiagnostics?.imageFoundCount !== undefined ||
        payload.importDiagnostics?.imageFromImportPayloadCount !== undefined ||
        payload.importDiagnostics?.imageEnrichedCount !== undefined ||
        payload.importDiagnostics?.imageFromWalmartSearchCount !== undefined ||
        payload.importDiagnostics?.imageFromSerpApiBrandSearchThumbnailCount !== undefined ||
        payload.importDiagnostics?.publicListingsDiscoveredViaSerpApiBrandSearchCount !== undefined ||
        payload.importDiagnostics?.serpApiBrandSearchAmbiguousCount !== undefined ||
        payload.importDiagnostics?.serpApiBrandSearchNoConfidentMatchCount !== undefined ||
        payload.importDiagnostics?.imageFromSerpApiFallbackCount !== undefined ||
        payload.importDiagnostics?.imageFromSerpApiProductGalleryCount !== undefined ||
        payload.importDiagnostics?.imageFromSerpApiSearchFallbackCount !== undefined ||
        payload.importDiagnostics?.perProductSerpApiSearchesAttempted !== undefined ||
        payload.importDiagnostics?.perProductSerpApiMatches !== undefined ||
        payload.importDiagnostics?.perProductSerpApiThumbnailsSaved !== undefined ||
        payload.importDiagnostics?.noConfidentMatchContinuedToFallback !== undefined ||
        payload.importDiagnostics?.ambiguousContinuedToFallback !== undefined ||
        payload.importDiagnostics?.ambiguousSkippedCount !== undefined ||
        payload.importDiagnostics?.walmartItemSearchExactIdentifierMatchCount !== undefined ||
        payload.importDiagnostics?.walmartItemSearchIdentifierNormalizedMatchCount !== undefined ||
        payload.importDiagnostics?.walmartItemSearchIdentifierAssistedMatchCount !== undefined ||
        payload.importDiagnostics?.walmartItemSearchMultipleCandidatesRejectedCount !== undefined ||
        payload.importDiagnostics?.walmartItemSearchSingleCandidateNoImageCount !== undefined ||
        payload.importDiagnostics?.imageStillMissingCount !== undefined ||
        payload.importDiagnostics?.imageNotFoundCount !== undefined ||
        payload.importDiagnostics?.imageAmbiguousCount !== undefined ||
        payload.importDiagnostics?.imageFailedCount !== undefined ||
        payload.importDiagnostics?.imageSkippedNoProviderCount !== undefined;
      const imageFoundCount = totals?.imageFoundCount ?? payload.importDiagnostics?.imageFoundCount ?? 0;
      const imageFromImportPayloadCount =
        totals?.imageFromImportPayloadCount ??
        payload.importDiagnostics?.imageFromImportPayloadCount ??
        0;
      const imageEnrichedCount =
        totals?.imageEnrichedCount ??
        payload.importDiagnostics?.imageEnrichedCount ??
        Math.max(0, imageFoundCount - imageFromImportPayloadCount);
      const imageFromWalmartSearchCount =
        totals?.imageFromWalmartSearchCount ??
        payload.importDiagnostics?.imageFromWalmartSearchCount ??
        0;
      const imageFromSerpApiBrandSearchThumbnailCount =
        totals?.imageFromSerpApiBrandSearchThumbnailCount ??
        payload.importDiagnostics?.imageFromSerpApiBrandSearchThumbnailCount ??
        0;
      const publicListingsDiscoveredViaSerpApiBrandSearchCount =
        totals?.publicListingsDiscoveredViaSerpApiBrandSearchCount ??
        payload.importDiagnostics?.publicListingsDiscoveredViaSerpApiBrandSearchCount ??
        payload.importDiagnostics?.serpApiBrandSearchDiagnostics?.serpapi_brand_search_public_listing_matched ??
        0;
      const serpApiBrandSearchAmbiguousCount =
        totals?.serpApiBrandSearchAmbiguousCount ??
        payload.importDiagnostics?.serpApiBrandSearchAmbiguousCount ??
        payload.importDiagnostics?.serpApiBrandSearchDiagnostics?.serpapi_brand_search_ambiguous ??
        0;
      const serpApiBrandSearchNoConfidentMatchCount =
        totals?.serpApiBrandSearchNoConfidentMatchCount ??
        payload.importDiagnostics?.serpApiBrandSearchNoConfidentMatchCount ??
        payload.importDiagnostics?.serpApiBrandSearchDiagnostics
          ?.serpapi_brand_search_no_confident_match ??
        0;
      const imageFromSerpApiProductGalleryCount =
        totals?.imageFromSerpApiProductGalleryCount ??
        payload.importDiagnostics?.imageFromSerpApiProductGalleryCount ??
        0;
      const imageFromSerpApiSearchFallbackCount =
        totals?.imageFromSerpApiSearchFallbackCount ??
        payload.importDiagnostics?.imageFromSerpApiSearchFallbackCount ??
        0;
      const imageFromSerpApiFallbackCount =
        totals?.imageFromSerpApiFallbackCount ??
        payload.importDiagnostics?.imageFromSerpApiFallbackCount ??
        imageFromSerpApiProductGalleryCount + imageFromSerpApiSearchFallbackCount;
      const perProductSerpApiSearchesAttempted =
        totals?.perProductSerpApiSearchesAttempted ??
        payload.importDiagnostics?.perProductSerpApiSearchesAttempted ??
        payload.importDiagnostics?.serpApiPerProductDiagnostics
          ?.serpapi_per_product_searches_attempted ??
        0;
      const perProductSerpApiMatches =
        totals?.perProductSerpApiMatches ??
        payload.importDiagnostics?.perProductSerpApiMatches ??
        payload.importDiagnostics?.serpApiPerProductDiagnostics?.serpapi_per_product_matches ??
        0;
      const perProductSerpApiThumbnailsSaved =
        totals?.perProductSerpApiThumbnailsSaved ??
        payload.importDiagnostics?.perProductSerpApiThumbnailsSaved ??
        payload.importDiagnostics?.serpApiPerProductDiagnostics
          ?.serpapi_per_product_thumbnails_saved ??
        0;
      const noConfidentMatchContinuedToFallback =
        totals?.noConfidentMatchContinuedToFallback ??
        payload.importDiagnostics?.noConfidentMatchContinuedToFallback ??
        payload.importDiagnostics?.serpApiPerProductDiagnostics
          ?.no_confident_match_continued_to_fallback ??
        0;
      const ambiguousContinuedToFallback =
        totals?.ambiguousContinuedToFallback ??
        payload.importDiagnostics?.ambiguousContinuedToFallback ??
        payload.importDiagnostics?.serpApiPerProductDiagnostics?.ambiguous_continued_to_fallback ??
        0;
      const ambiguousSkippedCount =
        totals?.ambiguousSkippedCount ??
        payload.importDiagnostics?.ambiguousSkippedCount ??
        payload.importDiagnostics?.serpApiPerProductDiagnostics?.ambiguous_skipped ??
        0;
      const walmartItemSearchExactIdentifierMatchCount =
        totals?.walmartItemSearchExactIdentifierMatchCount ??
        payload.importDiagnostics?.walmartItemSearchExactIdentifierMatchCount ??
        payload.importDiagnostics?.walmartItemSearchDiagnostics
          ?.walmart_item_search_exact_identifier_match ??
        0;
      const walmartItemSearchIdentifierNormalizedMatchCount =
        totals?.walmartItemSearchIdentifierNormalizedMatchCount ??
        payload.importDiagnostics?.walmartItemSearchIdentifierNormalizedMatchCount ??
        payload.importDiagnostics?.walmartItemSearchDiagnostics
          ?.walmart_item_search_identifier_normalized_match ??
        0;
      const walmartItemSearchIdentifierAssistedMatchCount =
        totals?.walmartItemSearchIdentifierAssistedMatchCount ??
        payload.importDiagnostics?.walmartItemSearchIdentifierAssistedMatchCount ??
        payload.importDiagnostics?.walmartItemSearchDiagnostics
          ?.walmart_item_search_identifier_assisted_match ??
        0;
      const walmartItemSearchMultipleCandidatesRejectedCount =
        totals?.walmartItemSearchMultipleCandidatesRejectedCount ??
        payload.importDiagnostics?.walmartItemSearchMultipleCandidatesRejectedCount ??
        payload.importDiagnostics?.walmartItemSearchDiagnostics
          ?.walmart_item_search_multiple_candidates_rejected ??
        0;
      const walmartItemSearchSingleCandidateNoImageCount =
        totals?.walmartItemSearchSingleCandidateNoImageCount ??
        payload.importDiagnostics?.walmartItemSearchSingleCandidateNoImageCount ??
        payload.importDiagnostics?.walmartItemSearchDiagnostics
          ?.walmart_item_search_single_candidate_no_image ??
        0;
      const walmartSearchNotFoundCount =
        totals?.walmartSearchNotFoundCount ??
        payload.importDiagnostics?.walmartSearchNotFoundCount ??
        0;
      const imageStillMissingCount =
        totals?.imageStillMissingCount ??
        payload.importDiagnostics?.imageStillMissingCount ??
        (hasImageDiagnostics ? Math.max(0, importedCount - imageFoundCount) : 0);
      const imageNotFoundCount =
        totals?.imageNotFoundCount ?? payload.importDiagnostics?.imageNotFoundCount ?? 0;
      const imageAmbiguousCount =
        totals?.imageAmbiguousCount ?? payload.importDiagnostics?.imageAmbiguousCount ?? 0;
      const imageFailedCount = totals?.imageFailedCount ?? payload.importDiagnostics?.imageFailedCount ?? 0;
      const imageSkippedNoProviderCount = totals?.imageSkippedNoProviderCount ?? payload.importDiagnostics?.imageSkippedNoProviderCount ?? 0;
      const enrichmentQueuedCount = totals?.queuedCount ?? payload.importDiagnostics?.enrichmentQueuedCount ?? 0;
      const enrichmentCompletedCount = totals?.processedCount ?? payload.importDiagnostics?.enrichmentCompletedCount ?? payload.importDiagnostics?.enrichmentProcessedCount ?? 0;
      const queuedForRemainingRetryCount = Math.max(
        0,
        enrichmentQueuedCount - enrichmentCompletedCount
      );
      const missingCount = imageStillMissingCount;
      const providerConnected =
        payload.importProgress?.providerConnected ??
        payload.importDiagnostics?.enrichmentProviderConnected ??
        false;
      const providerStatus =
        payload.importProgress?.providerStatus ??
        payload.importDiagnostics?.serpApiStatus ??
        (providerConnected ? "connected" : "not_connected");
      const providerStatusReason =
        payload.importProgress?.providerStatusReason ??
        payload.importDiagnostics?.serpApiStatusReason ??
        null;
      const providerCanAttempt =
        payload.importProgress?.providerCanAttempt ??
        payload.importDiagnostics?.serpApiCanAttempt ??
        providerConnected;
      const noImageReason =
        payload.importProgress?.noImageReason ??
        payload.importDiagnostics?.imageEnrichmentNoImageReason ??
        null;
      const enrichmentBounded =
        payload.importProgress?.enrichmentBounded ??
        payload.importDiagnostics?.imageEnrichmentBounded ??
        false;
      const enrichmentBoundedLimit =
        payload.importProgress?.enrichmentBoundedLimit ??
        payload.importDiagnostics?.imageEnrichmentImportLimit ??
        null;
      const enrichmentDeferredCount =
        payload.importProgress?.enrichmentDeferredCount ??
        payload.importDiagnostics?.imageEnrichmentDeferredCount ??
        0;
      const finalStage: ImportPanelStage =
        payload.importProgress?.stage === "completed_with_warnings" ||
        imageStillMissingCount > 0 ||
        imageAmbiguousCount > 0 ||
        imageFailedCount > 0
          ? "completed_with_warnings"
          : "complete";
      const finalSummary = `Imported ${importedCount} products. Images from import payload: ${imageFromImportPayloadCount}. Walmart Item Search images: ${imageFromWalmartSearchCount}. SerpApi brand-search thumbnails: ${imageFromSerpApiBrandSearchThumbnailCount}. SerpApi per-product searches attempted: ${perProductSerpApiSearchesAttempted}. SerpApi per-product matches: ${perProductSerpApiMatches}. SerpApi product gallery images: ${imageFromSerpApiProductGalleryCount}. SerpApi per-product search images: ${imageFromSerpApiSearchFallbackCount}. Brand-search ambiguous matches: ${serpApiBrandSearchAmbiguousCount}. Brand-search no confident match: ${serpApiBrandSearchNoConfidentMatchCount}. Processed this run: ${enrichmentCompletedCount}. Total still missing: ${imageStillMissingCount}. Queued for remaining retry: ${queuedForRemainingRetryCount}. Provider failures: ${imageFailedCount}.`;

      setLastImportDiagnostics({
        imageFromImportPayloadCount,
        imageEnrichedCount,
        imageFromWalmartSearchCount,
        imageFromSerpApiBrandSearchThumbnailCount,
        publicListingsDiscoveredViaSerpApiBrandSearchCount,
        serpApiBrandSearchAmbiguousCount,
        serpApiBrandSearchNoConfidentMatchCount,
        imageFromSerpApiFallbackCount,
        imageFromSerpApiProductGalleryCount,
        imageFromSerpApiSearchFallbackCount,
        imageStillMissingCount,
        imageNotFoundCount,
        imageAmbiguousCount,
        imageFailedCount,
        imageSkippedNoProviderCount,
        enrichmentDeferredCount,
      });

      setImportPanel({
        stage: finalStage,
        percent: 100,
        importedCount,
        fetchedCount: totals?.fetchedCount ?? payload.fetchedCount ?? 0,
        processedCount: totals?.processedCount ?? enrichmentCompletedCount,
        queuedCount: totals?.queuedCount ?? enrichmentQueuedCount,
        foundCount: totals?.imageFoundCount ?? imageFoundCount,
        fromImportPayloadCount:
          totals?.imageFromImportPayloadCount ?? imageFromImportPayloadCount,
        enrichedCount: totals?.imageEnrichedCount ?? imageEnrichedCount,
        walmartSearchResolvedCount:
          totals?.imageFromWalmartSearchCount ?? imageFromWalmartSearchCount,
        walmartSearchImageFoundCount:
          totals?.imageFromWalmartSearchCount ?? imageFromWalmartSearchCount,
        serpApiBrandSearchThumbnailImageFoundCount:
          totals?.imageFromSerpApiBrandSearchThumbnailCount ??
          imageFromSerpApiBrandSearchThumbnailCount,
        serpApiBrandSearchPublicListingMatchedCount:
          totals?.publicListingsDiscoveredViaSerpApiBrandSearchCount ??
          publicListingsDiscoveredViaSerpApiBrandSearchCount,
        serpApiBrandSearchAmbiguousCount:
          totals?.serpApiBrandSearchAmbiguousCount ?? serpApiBrandSearchAmbiguousCount,
        serpApiBrandSearchNoConfidentMatchCount:
          totals?.serpApiBrandSearchNoConfidentMatchCount ??
          serpApiBrandSearchNoConfidentMatchCount,
        serpApiFallbackImageFoundCount:
          totals?.imageFromSerpApiFallbackCount ?? imageFromSerpApiFallbackCount,
        serpApiProductGalleryImageFoundCount:
          totals?.imageFromSerpApiProductGalleryCount ?? imageFromSerpApiProductGalleryCount,
        serpApiSearchFallbackImageFoundCount:
          totals?.imageFromSerpApiSearchFallbackCount ?? imageFromSerpApiSearchFallbackCount,
        perProductSerpApiSearchesAttempted,
        perProductSerpApiMatches,
        perProductSerpApiThumbnailsSaved,
        noConfidentMatchContinuedToFallback,
        ambiguousContinuedToFallback,
        ambiguousSkippedCount,
        walmartItemSearchExactIdentifierMatchCount,
        walmartItemSearchIdentifierNormalizedMatchCount,
        walmartItemSearchIdentifierAssistedMatchCount,
        walmartItemSearchMultipleCandidatesRejectedCount,
        walmartItemSearchSingleCandidateNoImageCount,
        walmartSearchNotFoundCount:
          totals?.walmartSearchNotFoundCount ?? walmartSearchNotFoundCount,
        queuedForRemainingRetryCount,
        stillMissingCount:
          totals?.imageStillMissingCount ?? imageStillMissingCount,
        missingCount: totals?.imageStillMissingCount ?? missingCount,
        notFoundCount: totals?.imageNotFoundCount ?? imageNotFoundCount,
        ambiguousCount: totals?.imageAmbiguousCount ?? imageAmbiguousCount,
        failedCount: totals?.imageFailedCount ?? imageFailedCount,
        skippedNoProviderCount:
          totals?.imageSkippedNoProviderCount ?? imageSkippedNoProviderCount,
        providerConnected,
        providerStatus,
        providerStatusReason,
        providerCanAttempt,
        noImageReason,
        enrichmentBounded,
        enrichmentBoundedLimit,
        enrichmentDeferredCount,
        importErrorCategory: payload.importProgress?.importErrorCategory ?? "none",
        importErrorReason: payload.importProgress?.importErrorReason ?? null,
        importErrorPhase: payload.importProgress?.importErrorPhase ?? null,
        importErrorStatusCode: payload.importProgress?.importErrorStatusCode ?? null,
        importErrorEndpointFamily: payload.importProgress?.importErrorEndpointFamily ?? null,
        importErrorCorrelationId: payload.importProgress?.importErrorCorrelationId ?? null,
        importErrorResponseShape: payload.importProgress?.importErrorResponseShape ?? null,
        existingProductsShownCount: payload.importProgress?.existingProductsShownCount ?? 0,
        summary: noImageReason ? `${finalSummary} ${noImageReason}` : finalSummary,
        running: false,
      });

      if (importedCount === 0) {
        const fetchedCount = payload.importDiagnostics?.fetchedCount ?? payload.fetchedCount ?? 0;
        const payloadShape = payload.importDiagnostics?.payloadShape ?? "unknown";
        const inventoryUnknownCount = payload.importDiagnostics?.inventoryUnknownCount ?? 0;
        setMessage(
          `${
            payload.message ??
            `Import completed with zero products. fetchedCount=${fetchedCount}, payloadShape=${payloadShape}, inventoryPending=${inventoryUnknownCount}.`
          }`
        );
      } else {
        setMessage(payload.message ?? finalSummary);
      }
      router.refresh();
    } catch {
      setMessage("Import request failed before the server returned progress.");
      setImportPanel((current) => ({
        stage: "failed",
        percent: 100,
        importedCount: current?.importedCount ?? 0,
        fetchedCount: current?.fetchedCount ?? 0,
        processedCount: current?.processedCount ?? 0,
        queuedCount: current?.queuedCount ?? 0,
        foundCount: current?.foundCount ?? 0,
        fromImportPayloadCount: current?.fromImportPayloadCount ?? 0,
        enrichedCount: current?.enrichedCount ?? 0,
        walmartSearchResolvedCount: current?.walmartSearchResolvedCount ?? 0,
        walmartSearchImageFoundCount: current?.walmartSearchImageFoundCount ?? 0,
        serpApiBrandSearchThumbnailImageFoundCount:
          current?.serpApiBrandSearchThumbnailImageFoundCount ?? 0,
        serpApiBrandSearchPublicListingMatchedCount:
          current?.serpApiBrandSearchPublicListingMatchedCount ?? 0,
        serpApiBrandSearchAmbiguousCount: current?.serpApiBrandSearchAmbiguousCount ?? 0,
        serpApiBrandSearchNoConfidentMatchCount:
          current?.serpApiBrandSearchNoConfidentMatchCount ?? 0,
        serpApiFallbackImageFoundCount: current?.serpApiFallbackImageFoundCount ?? 0,
        serpApiProductGalleryImageFoundCount:
          current?.serpApiProductGalleryImageFoundCount ?? 0,
        serpApiSearchFallbackImageFoundCount:
          current?.serpApiSearchFallbackImageFoundCount ?? 0,
        perProductSerpApiSearchesAttempted: current?.perProductSerpApiSearchesAttempted ?? 0,
        perProductSerpApiMatches: current?.perProductSerpApiMatches ?? 0,
        perProductSerpApiThumbnailsSaved: current?.perProductSerpApiThumbnailsSaved ?? 0,
        noConfidentMatchContinuedToFallback:
          current?.noConfidentMatchContinuedToFallback ?? 0,
        ambiguousContinuedToFallback: current?.ambiguousContinuedToFallback ?? 0,
        ambiguousSkippedCount: current?.ambiguousSkippedCount ?? 0,
        walmartItemSearchExactIdentifierMatchCount:
          current?.walmartItemSearchExactIdentifierMatchCount ?? 0,
        walmartItemSearchIdentifierNormalizedMatchCount:
          current?.walmartItemSearchIdentifierNormalizedMatchCount ?? 0,
        walmartItemSearchIdentifierAssistedMatchCount:
          current?.walmartItemSearchIdentifierAssistedMatchCount ?? 0,
        walmartItemSearchMultipleCandidatesRejectedCount:
          current?.walmartItemSearchMultipleCandidatesRejectedCount ?? 0,
        walmartItemSearchSingleCandidateNoImageCount:
          current?.walmartItemSearchSingleCandidateNoImageCount ?? 0,
        walmartSearchNotFoundCount: current?.walmartSearchNotFoundCount ?? 0,
        queuedForRemainingRetryCount: current?.queuedForRemainingRetryCount ?? 0,
        stillMissingCount: current?.stillMissingCount ?? 0,
        missingCount: current?.missingCount ?? 0,
        notFoundCount: current?.notFoundCount ?? 0,
        ambiguousCount: current?.ambiguousCount ?? 0,
        failedCount: current?.failedCount ?? 0,
        skippedNoProviderCount: current?.skippedNoProviderCount ?? 0,
        providerConnected: current?.providerConnected ?? false,
        providerStatus: current?.providerStatus ?? "unknown_error",
        providerStatusReason: current?.providerStatusReason ?? null,
        providerCanAttempt: current?.providerCanAttempt ?? false,
        noImageReason: current?.noImageReason ?? null,
        enrichmentBounded: current?.enrichmentBounded ?? false,
        enrichmentBoundedLimit: current?.enrichmentBoundedLimit ?? null,
        enrichmentDeferredCount: current?.enrichmentDeferredCount ?? 0,
        importErrorCategory: current?.importErrorCategory ?? "import_unknown_error",
        importErrorReason:
          current?.importErrorReason ??
          "Import request failed before the server returned progress.",
        importErrorPhase: current?.importErrorPhase ?? "import_unknown",
        importErrorStatusCode: current?.importErrorStatusCode ?? null,
        importErrorEndpointFamily: current?.importErrorEndpointFamily ?? null,
        importErrorCorrelationId: current?.importErrorCorrelationId ?? null,
        importErrorResponseShape: current?.importErrorResponseShape ?? null,
        existingProductsShownCount: current?.existingProductsShownCount ?? 0,
        summary: "Import request failed before server progress was returned.",
        running: false,
      }));
    } finally {
      for (const timer of stageTimers) {
        clearTimeout(timer);
      }
      setIsImporting(false);
    }
  }

  function handleSyncClick(sku: string) {
    setMessage(`Sync request queued for ${sku}. Run Import Products to refresh catalog data.`);
  }

  function toggleSkuSort() {
    setSkuSortDirection((current) => {
      if (current === "none") return "asc";
      if (current === "asc") return "desc";
      return "asc";
    });
  }

  async function confirmRemoveFromCatalog() {
    if (!removeTarget) return;

    setIsRemoving(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/ecomviper/walmart/products/${safeSkuRouteSegment(removeTarget.sku)}`, {
        method: "DELETE",
      });

      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        sku?: string;
        affectedDraftCount?: number;
        error?: { message?: string };
      };

      if (!response.ok || !payload.ok || !payload.sku) {
        setMessage(payload.error?.message ?? "Could not remove product from local EcomViper catalog.");
        return;
      }

      const skuKey = normalizeSkuKey(payload.sku);
      setLocallyRemovedSkuKeys((current) => (current.includes(skuKey) ? current : [...current, skuKey]));
      const affectedDraftCount = payload.affectedDraftCount ?? 0;
      setMessage(
        affectedDraftCount > 0
          ? `Removed ${payload.sku} from EcomViper catalog. ${affectedDraftCount} local draft(s) were removed.`
          : `Removed ${payload.sku} from EcomViper catalog.`
      );
      setRemoveTarget(null);
      router.refresh();
    } catch {
      setMessage("Could not remove product from local EcomViper catalog.");
    } finally {
      setIsRemoving(false);
    }
  }

  return (
    <div className="space-y-4" data-testid="ecomviper-walmart-products-page">
      <WalmartPageHeader
        title="Products"
        subtitle="Search and manage Walmart catalog products with safe staging and sync workflows."
        actions={
          <button
            type="button"
            onClick={() => void handleImport("import")}
            disabled={isImporting}
            className="rounded-lg border border-[#2563EB] bg-[#2563EB] px-3 py-2 text-sm text-white"
          >
            {isImporting ? `${importStageLabel(importPanel?.stage ?? "importing_products")}...` : "Import Products"}
          </button>
        }
      />

      <section className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-4 shadow-[0_16px_36px_rgba(15,23,42,0.08)]">
        <div className="flex flex-wrap gap-2">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search SKU, title, brand, status"
            className="min-w-[220px] flex-1 rounded-lg border border-[#D9E4F0] px-3 py-2 text-sm"
          />
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            className="rounded-lg border border-[#D9E4F0] px-3 py-2 text-sm"
          >
            {filters.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {importPanel ? (
          <div className="mt-3 rounded-lg border border-[#D9E4F0] bg-[#F8FBFF] px-3 py-3 text-sm text-[#334155]">
            <div className="flex items-center justify-between gap-3">
              <p className="font-medium text-[#0F172A]">{importStageLabel(importPanel.stage)}</p>
              {!importPanel.running ? (
                <button
                  type="button"
                  onClick={() => setImportPanel(null)}
                  className="rounded-md border border-[#CBD5E1] bg-white px-2 py-1 text-xs text-[#334155]"
                >
                  Dismiss
                </button>
              ) : null}
            </div>
            <div className="mt-2 h-2 w-full rounded-full bg-[#E2E8F0]">
              <div
                className={`h-2 rounded-full transition-all ${
                  importPanel.stage === "failed"
                    ? "bg-rose-600"
                    : importPanel.stage === "completed_with_warnings"
                    ? "bg-amber-500"
                    : "bg-[#2563EB]"
                }`}
                style={{ width: `${Math.max(0, Math.min(100, importPanel.percent))}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-[#475569]">{importPanel.summary}</p>
            <div className="mt-2 grid gap-1 text-xs text-[#334155] sm:grid-cols-2">
              <p>Products imported: {importPanel.importedCount}</p>
              <p>Products fetched: {importPanel.fetchedCount}</p>
              <p>Processed this run: {importPanel.processedCount}</p>
              <p>Queued for resolver + fallback: {importPanel.queuedCount}</p>
              <p>Queued for remaining retry: {importPanel.queuedForRemainingRetryCount}</p>
              <p>Images found: {importPanel.foundCount}</p>
              <p>Images from import payload: {importPanel.fromImportPayloadCount}</p>
              <p>Resolved via Walmart Item Search: {importPanel.walmartSearchResolvedCount}</p>
              <p>Images from Walmart Item Search: {importPanel.walmartSearchImageFoundCount}</p>
              <p>
                Walmart Item Search exact identifier matches:{" "}
                {importPanel.walmartItemSearchExactIdentifierMatchCount}
              </p>
              <p>
                Walmart Item Search normalized identifier matches:{" "}
                {importPanel.walmartItemSearchIdentifierNormalizedMatchCount}
              </p>
              <p>
                Walmart Item Search identifier-assisted matches:{" "}
                {importPanel.walmartItemSearchIdentifierAssistedMatchCount}
              </p>
              <p>
                Walmart Item Search multiple-candidate rejected:{" "}
                {importPanel.walmartItemSearchMultipleCandidatesRejectedCount}
              </p>
              <p>
                Walmart Item Search single candidate no image:{" "}
                {importPanel.walmartItemSearchSingleCandidateNoImageCount}
              </p>
              <p>
                Images from SerpApi brand-search thumbnails:{" "}
                {importPanel.serpApiBrandSearchThumbnailImageFoundCount}
              </p>
              <p>
                Public listings discovered via brand search:{" "}
                {importPanel.serpApiBrandSearchPublicListingMatchedCount}
              </p>
              <p>Images from SerpApi product gallery: {importPanel.serpApiProductGalleryImageFoundCount}</p>
              <p>Images from SerpApi per-product search: {importPanel.serpApiSearchFallbackImageFoundCount}</p>
              <p>
                SerpApi per-product searches attempted: {importPanel.perProductSerpApiSearchesAttempted}
              </p>
              <p>SerpApi per-product matches: {importPanel.perProductSerpApiMatches}</p>
              <p>
                SerpApi per-product thumbnails saved: {importPanel.perProductSerpApiThumbnailsSaved}
              </p>
              <p>Images from SerpApi fallback: {importPanel.serpApiFallbackImageFoundCount}</p>
              <p>Total fallback enriched successfully: {importPanel.enrichedCount}</p>
              <p>Total still missing: {importPanel.stillMissingCount}</p>
              <p>Provider failed: {importPanel.failedCount}</p>
              <p>Missing/not found: {importPanel.missingCount}</p>
              <p>Not found: {importPanel.notFoundCount}</p>
              <p>Ambiguous match: {importPanel.ambiguousCount}</p>
              <p>Brand-search ambiguous matches: {importPanel.serpApiBrandSearchAmbiguousCount}</p>
              <p>No confident brand-search match: {importPanel.serpApiBrandSearchNoConfidentMatchCount}</p>
              <p>
                No confident match continued to fallback: {importPanel.noConfidentMatchContinuedToFallback}
              </p>
              <p>Ambiguous continued to fallback: {importPanel.ambiguousContinuedToFallback}</p>
              <p>Ambiguous skipped this run: {importPanel.ambiguousSkippedCount}</p>
              <p>Walmart Item Search not found: {importPanel.walmartSearchNotFoundCount}</p>
              <p>Skipped (SerpApi not connected): {importPanel.skippedNoProviderCount}</p>
              <p>
                SerpApi:{" "}
                {formatSerpApiProviderStatus(importPanel.providerStatus, importPanel.providerConnected)}
              </p>
            </div>
            {importPanel.enrichmentBounded &&
            importPanel.enrichmentDeferredCount > 0 &&
            importPanel.enrichmentBoundedLimit !== null ? (
              <p className="mt-2 text-xs text-[#334155]">
                Import image enrichment checks the first {importPanel.enrichmentBoundedLimit} missing-image products during import. Use Retry image enrichment to continue processing the remaining products.
              </p>
            ) : null}
            {importPanel.providerStatusReason ? (
              <p className="mt-2 text-xs text-[#7C2D12]">{importPanel.providerStatusReason}</p>
            ) : null}
            {importPanel.providerStatus === "not_connected" && importPanel.stillMissingCount > 0 ? (
              <p className="mt-2 text-xs text-[#7C2D12]">
                Connect SerpApi to enable automated public Walmart image enrichment.
              </p>
            ) : null}
            {showConnectedIdentifierWarning ? (
              <p className="mt-2 text-xs text-[#7C2D12]">
                SerpApi is connected, but Walmart did not find a product for the identifier used. Verify identifier mapping.
              </p>
            ) : null}
            {(importPanel.providerStatus === "invalid_key" ||
              importPanel.providerStatus === "forbidden" ||
              importPanel.providerStatus === "rate_limited") ? (
              <p className="mt-2 text-xs text-[#7C2D12]">
                SerpApi credentials were rejected or rate-limited. Verify the key in Connect.
              </p>
            ) : null}
            {importPanel.noImageReason ? (
              <p className="mt-2 text-xs text-[#7C2D12]">
                {importPanel.noImageReason}
              </p>
            ) : null}
            {importPanel.stage === "failed" && importPanel.importErrorReason ? (
              <p className="mt-2 text-xs text-rose-700">
                Import error ({importPanel.importErrorCategory}): {importPanel.importErrorReason}
              </p>
            ) : null}
            {importPanel.stage === "failed" && importPanel.importErrorPhase ? (
              <p className="mt-1 text-xs text-rose-700">
                Failure phase: {importPanel.importErrorPhase}
                {importPanel.importErrorStatusCode ? ` (HTTP ${importPanel.importErrorStatusCode})` : ""}
                {importPanel.importErrorEndpointFamily
                  ? ` · endpoint: ${importPanel.importErrorEndpointFamily}`
                  : ""}
              </p>
            ) : null}
            {importPanel.stage === "failed" && importPanel.existingProductsShownCount > 0 ? (
              <p className="mt-2 text-xs text-[#334155]">
                Existing products shown below are from the previous successful import.
              </p>
            ) : null}
          </div>
        ) : null}
        {message ? <p className="mt-3 text-sm text-[#334155]">{message}</p> : null}
        {!isImporting &&
        lastImportDiagnostics &&
        (lastImportDiagnostics.imageStillMissingCount > 0 ||
          lastImportDiagnostics.enrichmentDeferredCount > 0 ||
          lastImportDiagnostics.imageNotFoundCount > 0 ||
          lastImportDiagnostics.imageAmbiguousCount > 0 ||
          lastImportDiagnostics.imageFailedCount > 0) ? (
          <button
            type="button"
            onClick={() => void handleImport("retry_image_enrichment")}
            className="mt-2 rounded-lg border border-[#D9E4F0] bg-white px-3 py-2 text-xs text-[#0F172A]"
          >
            Retry image enrichment (continue remaining products)
          </button>
        ) : null}

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-[1080px] w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-[0.1em] text-[#64748B]">
              <tr>
                <th className="py-2">Image</th>
                <th className="py-2" aria-sort={skuAriaSort}>
                  <button
                    type="button"
                    onClick={toggleSkuSort}
                    className="inline-flex items-center rounded-md px-1 py-0.5 text-left text-xs uppercase tracking-[0.1em] text-[#64748B] hover:text-[#0F172A]"
                    aria-label="Sort by SKU"
                  >
                    {skuSortLabel}
                  </button>
                </th>
                <th className="py-2">Title</th>
                <th className="py-2">Brand</th>
                <th className="py-2">Price</th>
                <th className="py-2 text-center" data-testid="ecomviper-walmart-products-inventory-header">Inventory</th>
                <th className="py-2">Status</th>
                <th className="py-2">Last Synced</th>
                <th className="py-2">Issues</th>
                <th className="py-2 pr-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleProducts.map((product) => {
                const walmartListingUrl = resolveVerifiedWalmartListingUrl(product);
                return (
                  <tr key={product.sku} className="border-t border-[#E2E8F0] align-top">
                  <td className="py-2 pr-2">
                    {product.imageUrl ? (
                      <div className="space-y-1">
                        <img
                          src={product.imageUrl}
                          alt={`${product.sku} image`}
                          className="h-10 w-10 rounded border border-[#D9E4F0] bg-[#F8FBFF] object-cover"
                          loading="lazy"
                        />
                        <p className="max-w-[180px] text-[11px] text-[#475569]">{formatImageStatus(product)}</p>
                        <p className="max-w-[180px] text-[11px] text-[#64748B]">Source: {formatImageSource(product)}</p>
                        {hasPendingDraftImage(product) ? (
                          <p className="max-w-[180px] text-[11px] text-amber-700">Pending draft image</p>
                        ) : null}
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <span className="inline-flex h-10 w-10 items-center justify-center rounded border border-dashed border-[#CBD5E1] text-xs text-[#64748B]">N/A</span>
                        <p className="max-w-[180px] text-[11px] text-[#475569]">{formatImageStatus(product)}</p>
                        <p className="max-w-[180px] text-[11px] text-[#64748B]">Source: {formatImageSource(product)}</p>
                        {hasPendingDraftImage(product) ? (
                          <p className="max-w-[180px] text-[11px] text-amber-700">Pending draft image</p>
                        ) : null}
                      </div>
                    )}
                  </td>
                  <td className="py-2 pr-2 font-medium text-[#0F172A]">
                    <Link
                      href={`/apps/ecomviper/walmart/products/${safeSkuRouteSegment(product.sku)}`}
                      className="hover:text-[#1D4ED8]"
                    >
                      {product.sku}
                    </Link>
                  </td>
                  <td className="py-2 pr-2 text-[#334155]">
                    <div className="flex flex-col">
                      <Link
                        href={`/apps/ecomviper/walmart/products/${safeSkuRouteSegment(product.sku)}`}
                        className="hover:text-[#1D4ED8]"
                      >
                        {product.title}
                      </Link>
                      {walmartListingUrl ? (
                        <a
                          href={walmartListingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 text-xs font-medium text-[#2563EB] hover:text-[#1D4ED8]"
                        >
                          View Walmart Listing
                        </a>
                      ) : null}
                    </div>
                  </td>
                  <td className="py-2 pr-2 text-[#334155]">
                    <div className="flex flex-wrap items-center gap-1">
                      <span>{product.brand}</span>
                      {product.hasDraftChanges &&
                      product.brand.trim() !== (product.liveBrand ?? product.brand).trim() ? (
                        <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-amber-700">
                          Pending draft
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="py-2 pr-2 text-[#334155]">${product.price.toFixed(2)}</td>
                  <td className="py-2 px-2 text-center text-[#334155]" data-testid="ecomviper-walmart-products-inventory-cell">
                    {formatInventory(product)}
                  </td>
                  <td className="py-2 pr-2"><StatusBadge status={product.status} /></td>
                  <td className="py-2 pr-2 text-[#334155]">{product.lastSyncedAt}</td>
                  <td className="py-2 pr-2 text-[#334155]">{product.issues.join(", ") || "None"}</td>
                  <td className="py-2 pr-3 text-right">
                    <details className="relative inline-block text-left">
                      <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-lg border border-[#D9E4F0] bg-white px-2.5 py-1.5 text-xs font-medium text-[#0F172A] hover:border-[#BFDBFE] hover:bg-[#F8FAFF] [&::-webkit-details-marker]:hidden">
                        Actions
                        <span aria-hidden="true">▾</span>
                      </summary>
                      <div className="absolute right-0 z-20 mt-1 w-56 rounded-lg border border-[#D9E4F0] bg-white p-1 shadow-[0_12px_28px_rgba(15,23,42,0.16)]">
                        <Link
                          href={`/apps/ecomviper/walmart/products/${safeSkuRouteSegment(product.sku)}`}
                          className="block rounded-md px-2 py-1.5 text-left text-xs text-[#0F172A] hover:bg-[#F1F5F9]"
                        >
                          Edit Product
                        </Link>
                        <Link
                          href={draftLinkHrefBySku.get(product.sku) ?? "/apps/ecomviper/walmart/drafts"}
                          className="block rounded-md px-2 py-1.5 text-left text-xs text-[#0F172A] hover:bg-[#F1F5F9]"
                        >
                          {product.hasDraftChanges ? "View Draft" : "View Drafts"}
                        </Link>
                        <Link
                          href={`/apps/ecomviper/walmart/products/${safeSkuRouteSegment(product.sku)}`}
                          className="block rounded-md px-2 py-1.5 text-left text-xs text-[#0F172A] hover:bg-[#F1F5F9]"
                        >
                          Optimize with AI
                        </Link>
                        {!product.imageUrl && (product.publicWalmartUrl || product.publicWalmartProductId) ? (
                          <Link
                            href={`/apps/ecomviper/walmart/products/${safeSkuRouteSegment(product.sku)}`}
                            className="block rounded-md px-2 py-1.5 text-left text-xs text-[#0F172A] hover:bg-[#F1F5F9]"
                          >
                            Resolve images
                          </Link>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => handleSyncClick(product.sku)}
                          className="block w-full rounded-md px-2 py-1.5 text-left text-xs text-[#0F172A] hover:bg-[#F1F5F9]"
                        >
                          Sync
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setRemoveTarget({
                              sku: product.sku,
                              title: product.title,
                              hasDraftChanges: Boolean(product.hasDraftChanges),
                            })
                          }
                          className="block w-full rounded-md px-2 py-1.5 text-left text-xs font-medium text-rose-700 hover:bg-rose-50"
                          data-testid={`ecomviper-walmart-remove-${safeSkuRouteSegment(product.sku)}`}
                        >
                          Remove from EcomViper catalog
                        </button>
                      </div>
                    </details>
                  </td>
                  </tr>
                );
              })}
              {emptyStateMessage ? (
                <tr className="border-t border-[#E2E8F0]">
                  <td colSpan={10} className="py-6 text-center text-sm text-[#64748B]">
                    {emptyStateMessage}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {removeTarget ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#0F172A]/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-xl rounded-2xl border border-[#D9E4F0] bg-white p-5 shadow-[0_22px_48px_rgba(15,23,42,0.28)]">
            <h2 className="text-lg font-semibold text-[#0F172A]">Remove product from EcomViper catalog?</h2>
            <p className="mt-2 text-sm text-[#334155]">
              This removes the product from your EcomViper workspace only. It will not delete, retire, unpublish, or change the product on Walmart.
            </p>
            {removeTarget.hasDraftChanges ? (
              <p className="mt-2 text-sm text-[#9A3412]">
                Any local EcomViper drafts for this product will also be removed.
              </p>
            ) : null}
            <div className="mt-4 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-sm text-[#334155]">
              <p><span className="font-medium text-[#0F172A]">SKU:</span> {removeTarget.sku}</p>
              <p><span className="font-medium text-[#0F172A]">Title:</span> {removeTarget.title}</p>
            </div>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setRemoveTarget(null)}
                disabled={isRemoving}
                className="rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm text-[#334155]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmRemoveFromCatalog}
                disabled={isRemoving}
                className="rounded-lg border border-rose-700 bg-rose-700 px-3 py-2 text-sm text-white"
              >
                {isRemoving ? "Removing..." : "Remove from EcomViper"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
