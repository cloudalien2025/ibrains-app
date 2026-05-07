import type { RuntimeMode } from "@/lib/ecomviper/core/marketplace-types";

export type WalmartEnvironment = "sandbox" | "production";
export type WalmartRegion = "US";

export type WalmartConnectionStatus = "connected" | "not_connected";
export type WalmartTokenStatus = "valid" | "expired" | "unknown";

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
  environment: WalmartEnvironment;
  region: WalmartRegion;
  notes?: string;
}

export interface WalmartConnectionSummary {
  accountNickname: string;
  environment: WalmartEnvironment;
  region: WalmartRegion;
  maskedClientId: string;
  clientSecretStored: boolean;
  lastSuccessfulAuth: string | null;
  lastApiError: string | null;
  tokenStatus: WalmartTokenStatus;
  permissionChecks: WalmartPermissionCheck[];
  credentialStorageMode: "env" | "memory" | "encrypted-db";
  mode: RuntimeMode;
}

export interface WalmartConnectionHealth {
  connectionStatus: WalmartConnectionStatus;
  summary: WalmartConnectionSummary;
  lastSuccessfulApiCall: string | null;
  lastApiError: string | null;
}

export type WalmartProductStatus = "active" | "attention" | "draft" | "sync_failed";

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
    warnings: string[];
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
  lastImportAt: string;
  mode: RuntimeMode;
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
  dryRun: boolean;
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
