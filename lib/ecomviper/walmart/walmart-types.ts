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

export type WalmartProductStatus = "active" | "attention" | "draft" | "sync_failed";
export type WalmartInventoryStatus = "known" | "unknown" | "out_of_stock";

export interface WalmartProductRecord {
  id: string;
  marketplace: "walmart";
  sku: string;
  externalItemId: string;
  title: string;
  brand: string;
  category: string;
  price: number;
  inventoryQuantity: number;
  inventoryStatus: WalmartInventoryStatus;
  status: WalmartProductStatus;
  imageUrl: string;
  issues: string[];
  attributes: Record<string, string>;
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
  suggestedDescription: string;
  suggestedBullets: string[];
  missingAttributes: string[];
  complianceWarnings: string[];
  disclaimer: string;
}
