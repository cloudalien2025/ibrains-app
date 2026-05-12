import type { RuntimeMode } from "@/lib/ecomviper/core/marketplace-types";

export type WalmartEnvironment = "production";
export type WalmartRegion = "US";

export type WalmartConnectionStatus =
  | "not_connected"
  | "token_valid"
  | "token_valid_read_not_configured"
  | "connected"
  | "failed";

export type WalmartTokenStatus = "valid" | "invalid" | "expired" | "unknown";
export type WalmartSafeReadStatus = "valid" | "invalid" | "not_configured" | "unknown";

export interface WalmartApiError {
  code: string;
  message: string;
}

export type WalmartPermissionId =
  | "catalog_read"
  | "item_maintenance"
  | "inventory_update"
  | "pricing_update"
  | "feeds_submit_read"
  | "feed_error_reports";

export type WalmartPermissionState = "granted" | "missing" | "unknown";

export interface WalmartPermissionCheck {
  id: WalmartPermissionId;
  label: string;
  state: WalmartPermissionState;
}

export interface WalmartConnectionInput {
  accountNickname: string;
  clientId: string;
  clientSecret: string;
  marketplaceRegion?: WalmartRegion;
  region?: WalmartRegion;
  notes?: string;
}

export interface WalmartConnectionDiagnostic {
  environment: WalmartEnvironment;
  baseUrl: string;
  tokenStatus: WalmartTokenStatus;
  safeReadStatus: WalmartSafeReadStatus;
  httpStatus: number | null;
  correlationId: string | null;
  walmartErrorCode: string | null;
  walmartErrorMessage: string | null;
  timestamp: string | null;
}

export interface WalmartConnectionSummary {
  accountNickname: string;
  environment: WalmartEnvironment;
  region: WalmartRegion;
  maskedClientId: string;
  clientSecretStored: boolean;
  lastSuccessfulAuth: string | null;
  lastSuccessfulRead: string | null;
  lastApiError: WalmartApiError | null;
  tokenStatus: WalmartTokenStatus;
  safeReadStatus: WalmartSafeReadStatus;
  permissionChecks: WalmartPermissionCheck[];
  credentialStorageMode: "env" | "memory" | "encrypted-db";
  mode: RuntimeMode;
  diagnostic: WalmartConnectionDiagnostic;
}

export interface WalmartConnectionHealth {
  connectionStatus: WalmartConnectionStatus;
  summary: WalmartConnectionSummary;
  lastSuccessfulApiCall: string | null;
  lastApiError: WalmartApiError | null;
}

export interface WalmartOpenAiConnectionStatus {
  connected: boolean;
  status: "connected" | "disconnected";
  maskedApiKey: string;
  updatedAt: string | null;
  saveSupported: boolean;
}

export interface WalmartSerpApiConnectionStatus {
  connected: boolean;
  status: "connected" | "disconnected";
  maskedApiKey: string;
  updatedAt: string | null;
  saveSupported: boolean;
}

export type WalmartSerpApiProviderStatus =
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

export interface WalmartSerpApiTestDiagnostics {
  providerStatus: WalmartSerpApiProviderStatus;
  statusCode: number | null;
  statusReason: string;
  safeProviderErrorDetail: string | null;
  usage: {
    totalSearchesLeft: number | null;
    thisMonthUsage: number | null;
    planSearchesPerMonth: number | null;
  } | null;
}

export type WalmartImportErrorCategory =
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

export type WalmartImportFailurePhase =
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
  | "import_unknown";

export type WalmartProductStatus = "active" | "attention" | "draft" | "sync_failed";
export type WalmartInventoryStatus = "known" | "unknown" | "out_of_stock";
export type WalmartImageStatus = "image_available" | "catalog_missing" | "enrichment_unconfigured";
export type WalmartImageSyncStatus = "found" | "not_found" | "ambiguous" | "failed" | "not_synced";
export type WalmartImageMatchMethod =
  | "gtin"
  | "upc"
  | "itemId"
  | "wpid"
  | "query"
  | "catalog"
  | "public_url_product_id"
  | "serpapi_product_id"
  | "serpapi_search_upc"
  | "serpapi_search_gtin"
  | "serpapi_search_title_brand"
  | "item_report_sku"
  | "item_report_productid"
  | "item_report_itemid"
  | "item_report_wpid"
  | "item_report_title_brand"
  | "shopify_sku_exact"
  | "shopify_barcode_exact"
  | "shopify_barcode_normalized"
  | "shopify_title_vendor_high"
  | "shopify_ambiguous"
  | "shopify_no_match";
export type WalmartImageSource =
  | "walmart_item_report"
  | "walmart_catalog"
  | "walmart_item_search"
  | "serpapi_walmart_brand_search"
  | "public_walmart_listing_serpapi"
  | "shopify_product"
  | "shopify_variant"
  | "manual"
  | "shopify_placeholder"
  | "manual_placeholder"
  | "none";

export interface WalmartProductRecord {
  id: string;
  marketplace: "walmart";
  sku: string;
  externalItemId: string;
  upc?: string;
  gtin?: string;
  wpid?: string;
  itemId?: string;
  publishedStatus?: string;
  title: string;
  brand: string;
  category: string;
  price: number;
  inventoryQuantity: number;
  inventoryStatus: WalmartInventoryStatus;
  status: WalmartProductStatus;
  imageUrl: string;
  galleryImageUrls?: string[];
  variantImageUrls?: string[];
  imageStatus?: WalmartImageStatus;
  imageStatusMessage?: string;
  imageSource?: WalmartImageSource;
  imageSyncStatus?: WalmartImageSyncStatus;
  imageMatchMethod?: WalmartImageMatchMethod;
  shopifyProductId?: string;
  shopifyVariantId?: string;
  matchedItemId?: string;
  publicWalmartUrl?: string;
  publicWalmartProductId?: string;
  primaryImageUrl?: string;
  lastImageSyncedAt?: string | null;
  imageSyncReason?: string | null;
  issues: string[];
  attributes: Record<string, string>;
  searchBrowseAttributes?: Record<string, string>;
  mediaRecommendations?: string[];
  altText?: string;
  shortDescription: string;
  longDescription: string;
  bulletPoints: string[];
  rawPayload: unknown;
  normalizedPayload: unknown;
  lastSyncedAt: string;
  createdAt: string;
  updatedAt: string;
}

export type WalmartDraftStatus = "draft" | "validated" | "submitted" | "failed" | "synced" | "discarded";

export interface WalmartDraftRecord {
  id: string;
  productId: string;
  marketplace: "walmart";
  sku: string;
  productTitle: string;
  draftPayload: Record<string, unknown>;
  changeSummary: string;
  createdBy: string;
  status: WalmartDraftStatus;
  validationResult: {
    valid: boolean;
    violations?: string[];
    warnings: string[];
    suggestions?: string[];
  };
  publishStatus: "pending" | "submitted" | "failed" | "synced";
  createdAt: string;
  updatedAt: string;
}

export type WalmartFeedStatus = "RECEIVED" | "INPROGRESS" | "PROCESSED" | "ERROR" | "UNKNOWN";

export interface WalmartFeedSubmission {
  id: string;
  marketplace: "walmart";
  feedId: string;
  feedType: "MP_MAINTENANCE" | string;
  status: WalmartFeedStatus;
  submittedPayload: unknown;
  responsePayload: unknown;
  errorReport: string[];
  submittedAt: string;
  completedAt: string | null;
}

export interface WalmartDashboardSnapshot {
  mode: RuntimeMode;
  connection: WalmartConnectionHealth;
  productsImported: number;
  lastImportAt: string | null;
  draftChanges: number;
  feedErrors: number;
  listingsNeedingAttention: {
    count: number;
    categories: string[];
  };
  recentProducts: WalmartProductRecord[];
  recentActivity: Array<{
    time: string;
    action: string;
    result: "success" | "warning" | "error";
    sku: string | null;
    message: string;
  }>;
  attentionProducts: WalmartProductRecord[];
}

export interface WalmartImportResult {
  importedCount: number;
  lastImportAt: string | null;
  mode: RuntimeMode;
  fetchedCount?: number;
  skippedCount?: number;
  importDiagnostics?: {
    fetchedCount: number;
    payloadShape: string;
    pageCount: number;
    inventoryKnownCount?: number;
    inventoryUnknownCount?: number;
    inventoryOutOfStockCount?: number;
    inventoryLookupSkippedCount?: number;
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
    lastEnrichedAt?: string | null;
    imageEnrichmentDeferredCount?: number;
    imageEnrichmentImportLimit?: number | null;
    imageEnrichmentBounded?: boolean;
    imageEnrichmentNoImageReason?: string | null;
    shopifyProductsImported?: number;
    shopifyImagesImported?: number;
    walmartProductsMatchedToShopify?: number;
    imagesAppliedFromShopify?: number;
    ambiguousShopifyMatches?: number;
    shopifyNoMatchCount?: number;
    shopifyNoImageAvailableCount?: number;
    stillMissingAfterShopify?: number;
    shopifyVariantSkuMatch?: number;
    shopifyVariantBarcodeMatch?: number;
    shopifyBarcodeNormalizedMatch?: number;
    shopifyTitleVendorMatch?: number;
    shopifyAmbiguousMatch?: number;
    shopifyNoMatch?: number;
    shopifyImageApplied?: number;
    shopifyNoImageAvailable?: number;
    shopifyMatchDiagnostics?: Array<{
      walmartSku: string;
      walmartUpcOrGtin: string;
      matchedShopifyProductTitle: string;
      matchedShopifyProductId: string;
      matchedShopifyVariantId: string;
      matchMethod:
        | "shopify_sku_exact"
        | "shopify_barcode_exact"
        | "shopify_barcode_normalized"
        | "shopify_title_vendor_high"
        | "shopify_ambiguous"
        | "shopify_no_match";
      imageApplied: boolean;
      ambiguousCandidateCount: number;
    }>;
    serpApiStatus?: WalmartSerpApiProviderStatus;
    serpApiStatusReason?: string | null;
    serpApiCanAttempt?: boolean;
    enrichmentErrorCategories?: {
      invalidKeyCount: number;
      forbiddenCount: number;
      rateLimitedCount: number;
      badRequestCount: number;
      providerErrorCount: number;
      networkErrorCount: number;
      malformedResponseCount: number;
      unknownErrorCount: number;
    };
    importErrorCategory?: WalmartImportErrorCategory;
    importErrorReason?: string | null;
    imageSource?: "Walmart Item Report + Walmart Item Search + Public Walmart Listing via SerpApi";
    itemReportRequested?: boolean;
    itemReportDownloaded?: boolean;
    itemReportRowsParsed?: number;
    itemReportRequestId?: string | null;
    itemReportRequestEndpointTried?: string[];
    itemReportRequestEndpointUsed?: string | null;
    itemReportRequestStatusCode?: number | null;
    itemReportStatusEndpointUsed?: string | null;
    itemReportDownloadEndpointUsed?: string | null;
    itemReportFailureCategory?:
      | "none"
      | "auth_or_permission"
      | "not_found_endpoint"
      | "timeout"
      | "report_failed"
      | "download_failed"
      | "parse_failed"
      | "no_rows"
      | "no_image_columns"
      | "unavailable";
    imageSourceBreakdown?: {
      walmartItemReport: number;
      walmartSellerCatalogSearch: number;
      walmartItemSearch: number;
      publicWalmartListingSerpApi?: number;
    };
    imageIdentifierPathCounts?: {
      seller_catalog_only: number;
      walmart_search_upc: number;
      walmart_search_gtin: number;
      walmart_search_title_brand: number;
      public_item_id_direct: number;
      serpapi_public_item_id: number;
      serpapi_title_brand_fallback: number;
      skipped_gtin_as_product_id: number;
      walmart_search_not_found: number;
      no_searchable_identifier: number;
    };
    serpApiProductGalleryDiagnostics?: {
      serpapi_product_gallery_checked: number;
      serpapi_product_gallery_primary_found: number;
      serpapi_product_gallery_additional_found: number;
      serpapi_product_gallery_no_images: number;
      skipped_no_verified_public_listing: number;
      skipped_non_public_identifier: number;
      skipped_gtin_as_product_id: number;
    };
    serpApiBrandSearchDiagnostics?: {
      serpapi_brand_search_checked: number;
      serpapi_brand_search_results_harvested: number;
      serpapi_brand_search_public_listing_matched: number;
      serpapi_brand_search_thumbnail_saved: number;
      serpapi_brand_search_ambiguous: number;
      serpapi_brand_search_no_confident_match: number;
    };
    walmartItemSearchDiagnostics?: {
      walmart_item_search_exact_identifier_match: number;
      walmart_item_search_identifier_normalized_match: number;
      walmart_item_search_identifier_assisted_match: number;
      walmart_item_search_multiple_candidates_rejected: number;
      walmart_item_search_single_candidate_no_image: number;
    };
    serpApiPerProductDiagnostics?: {
      serpapi_per_product_searches_attempted: number;
      serpapi_per_product_matches: number;
      serpapi_per_product_thumbnails_saved: number;
      no_confident_match_continued_to_fallback: number;
      ambiguous_continued_to_fallback: number;
      ambiguous_skipped: number;
    };
    perProductAttemptDiagnostics?: Array<{
      sku: string;
      title: string;
      attemptedMethods: string[];
      queryUsed: string | null;
      walmartItemSearchQueryOrIdentifier?: string | null;
      walmartItemSearchMethod?: string | null;
      resultCount: number;
      topCandidateTitle: string | null;
      topCandidateItemOrProductId: string | null;
      topCandidateProductId?: string | null;
      topCandidateUsItemId?: string | null;
      topCandidateThumbnailPresent?: boolean | null;
      matchScore?: number | null;
      confidence?: "high" | "medium" | "low" | null;
      rejectionReason: string | null;
      finalStatus: "found" | "not_found" | "ambiguous" | "failed" | "not_synced";
    }>;
  };
}

export interface WalmartInventoryUpdateRequest {
  sku: string;
  quantity: number;
  saveAsDraft?: boolean;
}

export interface WalmartPriceUpdateRequest {
  sku: string;
  price: number;
  saveAsDraft?: boolean;
}

export interface WalmartMutationResult {
  ok: boolean;
  mode: RuntimeMode;
  writeEnabled: boolean;
  message: string;
  sku: string;
}

export interface WalmartAiSuggestion {
  sku: string;
  qualityScore: number;
  suggestedTitle: string;
  suggestedShortDescription?: string;
  suggestedDescription: string;
  suggestedBullets: string[];
  suggestedBrand?: string;
  suggestedAttributes?: Record<string, string>;
  searchBrowseAttributes?: Record<string, string>;
  mediaRecommendations?: string[];
  altText?: string;
  aiVisibilitySummary?: string;
  structuredProductFactsSummary?: string;
  customerFitDescriptors?: string[];
  compliantBenefitClusters?: string[];
  faqSnippets?: string[];
  complianceNotes?: string[];
  rejectedRiskyClaims?: string[];
  applyDiagnostics?: {
    factsUpdated: string[];
    factsSources: string[];
    staleFieldsReplaced: string[];
    staleFieldsCleared: string[];
    copyFieldsUpdated: string[];
    searchBrowseFieldsUpdated: string[];
    searchBrowseFieldsReplaced: string[];
    complianceChanges: string[];
    skippedProtectedFields: string[];
    skippedLowConfidenceFields: string[];
    rejectedClaims: string[];
    disclaimerStatus: "inserted" | "preserved" | "deduped" | "missing";
    finalDecision: "accepted" | "accepted_with_changes" | "rejected";
  };
  entitySet?: {
    brand: string;
    productName: string;
    category: string;
    keyIngredients: string[];
    form: string;
    count: string;
    audience: string;
    supportedBenefits: string[];
  };
  missingAttributes: string[];
  complianceWarnings: string[];
  disclaimer: string;
}

export interface WalmartListingRecommendation {
  id: string;
  title: string;
  reason: string;
  severity: "high" | "medium" | "low";
  proposedTitle?: string;
  proposedDescription?: string;
  proposedBullets?: string[];
  proposedKeyAttributes?: Record<string, string>;
  proposedImageUrl?: string;
  proposedImageAction?: "keep" | "request_enrichment" | "manual_image_required";
}

export interface WalmartListingQualityAssessment {
  score: number;
  imageStatus:
    | "Image available"
    | "Image not provided by Walmart catalog"
    | "Image enrichment source not configured"
    | "Image not provided by Walmart Item Search"
    | "Image found in Walmart Item Report."
    | "Item Report row found, but no usable image URL was provided."
    | "No matching row found in Walmart Item Report."
    | "Walmart Item Report request failed."
    | "Walmart Item Report was unavailable or timed out."
    | "Item Search returned no usable image."
    | "Multiple Walmart Item Search candidates matched this product."
    | "Item Search request failed after retry."
    | "Image match ambiguous"
    | "Image sync failed"
    | "Image enrichment not synced";
  factors: string[];
  recommendations: WalmartListingRecommendation[];
}

export type WalmartOptimizationProposalStatus = "draft" | "staged" | "approved" | "submitted";

export interface WalmartOptimizationProposalRecord {
  id: string;
  sku: string;
  source: "deterministic" | "ai";
  proposedTitle: string;
  proposedDescription: string;
  proposedBullets: string[];
  proposedKeyAttributes: Record<string, string>;
  proposedImageUrl: string;
  proposedImageAction: "keep" | "request_enrichment" | "manual_image_required";
  recommendationReason: string;
  status: WalmartOptimizationProposalStatus;
  createdAt: string;
  updatedAt: string;
}

export interface WalmartCapabilityModule {
  id:
    | "catalog_optimizer"
    | "inventory_optimizer"
    | "pricing_optimizer"
    | "feed_manager"
    | "orders_returns_intelligence"
    | "walmart_connect_ads_optimizer";
  title: string;
  description: string;
  status: "available" | "foundation" | "separate_integration_required";
  apiFamily: "marketplace" | "walmart_connect_ads";
}
