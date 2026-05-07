import "server-only";

import type { RuntimeMode } from "@/lib/ecomviper/core/marketplace-types";
import { appendActivityLog, listActivityLogs } from "@/lib/ecomviper/core/activity-log";
import { createDraftRecord, validateDraftPayload } from "@/lib/ecomviper/core/draft-workflow";
import type {
  WalmartApiError,
  WalmartConnectionStatus,
  WalmartConnectionSummary,
  WalmartDraftRecord,
  WalmartFeedSubmission,
  WalmartProductRecord,
} from "@/lib/ecomviper/walmart/walmart-types";

interface WalmartStore {
  mode: RuntimeMode;
  connectionStatus: WalmartConnectionStatus;
  connectionSummary: WalmartConnectionSummary;
  lastSuccessfulApiCall: string | null;
  lastApiError: WalmartApiError | null;
  products: WalmartProductRecord[];
  drafts: WalmartDraftRecord[];
  feeds: WalmartFeedSubmission[];
  lastImportAt: string | null;
}

declare global {
  var __ecomviper_walmart_store__: WalmartStore | undefined;
}

function resolveRuntimeMode(): RuntimeMode {
  return "live-ready";
}

function defaultConnectionSummary(mode: RuntimeMode): WalmartConnectionSummary {
  const clientId = process.env.WALMART_CLIENT_ID?.trim() ?? "";

  return {
    accountNickname: process.env.WALMART_ACCOUNT_NICKNAME?.trim() || "Walmart Account",
    environment: "production",
    region: "US",
    maskedClientId: clientId ? `${clientId.slice(0, 2)}***${clientId.slice(-4)}` : "Not configured",
    clientSecretStored: Boolean(process.env.WALMART_CLIENT_SECRET),
    lastSuccessfulAuth: null,
    lastSuccessfulRead: null,
    lastApiError: null,
    tokenStatus: "unknown",
    safeReadStatus: "unknown",
    permissionChecks: [
      { id: "catalog_read", label: "Items / Catalog read", state: "unknown" },
      { id: "item_maintenance", label: "Item maintenance / content update", state: "unknown" },
      { id: "inventory_update", label: "Inventory update", state: "unknown" },
      { id: "pricing_update", label: "Pricing update", state: "unknown" },
      { id: "feeds_submit_read", label: "Feeds submit/read", state: "unknown" },
      { id: "feed_error_reports", label: "Feed error reports", state: "unknown" },
    ],
    credentialStorageMode: process.env.WALMART_CLIENT_SECRET ? "env" : "memory",
    mode,
    diagnostic: {
      environment: "production",
      baseUrl: "https://marketplace.walmartapis.com",
      tokenStatus: "unknown",
      safeReadStatus: "unknown",
      httpStatus: null,
      correlationId: null,
      walmartErrorCode: null,
      walmartErrorMessage: null,
      timestamp: null,
    },
  };
}

function getStore(): WalmartStore {
  if (!globalThis.__ecomviper_walmart_store__) {
    const mode = resolveRuntimeMode();
    globalThis.__ecomviper_walmart_store__ = {
      mode,
      connectionStatus: "not_connected",
      connectionSummary: defaultConnectionSummary(mode),
      lastSuccessfulApiCall: null,
      lastApiError: null,
      products: [],
      drafts: [],
      feeds: [],
      lastImportAt: null,
    };
  }

  return globalThis.__ecomviper_walmart_store__;
}

export function getWalmartRuntimeMode(): RuntimeMode {
  return getStore().mode;
}

export function getWalmartConnectionState() {
  const store = getStore();
  return {
    connectionStatus: store.connectionStatus,
    summary: store.connectionSummary,
    lastSuccessfulApiCall: store.lastSuccessfulApiCall,
    lastApiError: store.lastApiError,
  };
}

export function setWalmartConnectionState(params: {
  summary: WalmartConnectionSummary;
  connectionStatus: WalmartConnectionStatus;
  lastSuccessfulApiCall: string | null;
  lastApiError: WalmartApiError | null;
}) {
  const store = getStore();
  store.connectionSummary = {
    ...params.summary,
    mode: store.mode,
  };
  store.connectionStatus = params.connectionStatus;
  store.lastSuccessfulApiCall = params.lastSuccessfulApiCall;
  store.lastApiError = params.lastApiError;
  return store.connectionSummary;
}

export function disconnectWalmartConnection(): void {
  const store = getStore();
  store.connectionStatus = "not_connected";
  store.lastSuccessfulApiCall = null;
  store.lastApiError = null;
  store.connectionSummary = {
    ...store.connectionSummary,
    environment: "production",
    tokenStatus: "unknown",
    safeReadStatus: "unknown",
    clientSecretStored: false,
    maskedClientId: "Not configured",
    lastSuccessfulAuth: null,
    lastSuccessfulRead: null,
    lastApiError: null,
    diagnostic: {
      ...store.connectionSummary.diagnostic,
      environment: "production",
      tokenStatus: "unknown",
      safeReadStatus: "unknown",
      httpStatus: null,
      correlationId: null,
      walmartErrorCode: null,
      walmartErrorMessage: null,
      timestamp: new Date().toISOString(),
    },
  };
}

export function listProducts(): WalmartProductRecord[] {
  return [...getStore().products];
}

export function getProductBySku(sku: string): WalmartProductRecord | null {
  const normalized = sku.trim().toUpperCase();
  return getStore().products.find((item) => item.sku.toUpperCase() === normalized) ?? null;
}

export function replaceProducts(products: WalmartProductRecord[], importedAt: string | null): void {
  const store = getStore();
  store.products = [...products];
  store.lastImportAt = importedAt;
}

export function getLastImportAt(): string | null {
  return getStore().lastImportAt;
}

export function clearProducts(): void {
  const store = getStore();
  store.products = [];
  store.lastImportAt = null;
}

export function listDrafts(): WalmartDraftRecord[] {
  return [...getStore().drafts];
}

export function getDraftById(id: string): WalmartDraftRecord | null {
  return getStore().drafts.find((draft) => draft.id === id) ?? null;
}

export function upsertDraftForSku(params: {
  sku: string;
  draftPayload: Record<string, unknown>;
  createdBy?: string | null;
}): WalmartDraftRecord {
  const store = getStore();
  const product = getProductBySku(params.sku);
  if (!product) {
    throw new Error(`Unknown SKU: ${params.sku}`);
  }

  const existing = store.drafts.find((entry) => entry.sku === product.sku && entry.status !== "discarded");
  const validation = validateDraftPayload(params.draftPayload);
  const now = new Date().toISOString();

  if (existing) {
    existing.draftPayload = params.draftPayload;
    existing.validationResult = {
      valid: validation.valid,
      warnings: validation.warnings,
    };
    existing.status = validation.valid ? "validated" : "draft";
    existing.changeSummary = `${Object.keys(params.draftPayload).length} staged field(s)`;
    existing.updatedAt = now;

    appendActivityLog({
      marketplace: "walmart",
      sku: product.sku,
      actionType: "draft_update",
      result: validation.valid ? "success" : "warning",
      message: "Draft updated.",
      afterPayload: existing,
    });

    return existing;
  }

  const draft = createDraftRecord({
    sku: product.sku,
    title: product.title,
    productId: product.id,
    draftPayload: params.draftPayload,
    changeSummary: `${Object.keys(params.draftPayload).length} staged field(s)`,
    createdBy: params.createdBy,
    status: validation.valid ? "validated" : "draft",
    validationResult: {
      valid: validation.valid,
      warnings: validation.warnings,
    },
  });

  store.drafts.unshift(draft);

  appendActivityLog({
    marketplace: "walmart",
    sku: product.sku,
    actionType: "draft_create",
    result: validation.valid ? "success" : "warning",
    message: "Draft created.",
    afterPayload: draft,
  });

  return draft;
}

export function validateDraft(id: string): WalmartDraftRecord {
  const draft = getDraftById(id);
  if (!draft) {
    throw new Error("Draft not found");
  }

  const validation = validateDraftPayload(draft.draftPayload);
  draft.validationResult = {
    valid: validation.valid,
    warnings: validation.warnings,
  };
  draft.status = validation.valid ? "validated" : "failed";
  draft.updatedAt = new Date().toISOString();

  appendActivityLog({
    marketplace: "walmart",
    sku: draft.sku,
    actionType: "draft_validate",
    result: validation.valid ? "success" : "warning",
    message: validation.valid ? "Draft validation passed." : "Draft validation failed.",
    afterPayload: draft,
  });

  return draft;
}

export function submitDraft(id: string): WalmartDraftRecord {
  const draft = getDraftById(id);
  if (!draft) {
    throw new Error("Draft not found");
  }

  if (!draft.validationResult.valid) {
    draft.status = "failed";
    draft.publishStatus = "failed";
    draft.updatedAt = new Date().toISOString();

    appendActivityLog({
      marketplace: "walmart",
      sku: draft.sku,
      actionType: "draft_submit",
      result: "error",
      message: "Draft submit blocked by validation warnings.",
    });

    return draft;
  }

  draft.status = "submitted";
  draft.publishStatus = "submitted";
  draft.updatedAt = new Date().toISOString();

  appendActivityLog({
    marketplace: "walmart",
    sku: draft.sku,
    actionType: "draft_submit",
    result: "warning",
    message: "Production write disabled until preview/validation is complete.",
    afterPayload: draft,
  });

  return draft;
}

export function discardDraft(id: string): WalmartDraftRecord {
  const draft = getDraftById(id);
  if (!draft) {
    throw new Error("Draft not found");
  }

  draft.status = "discarded";
  draft.publishStatus = "failed";
  draft.updatedAt = new Date().toISOString();

  appendActivityLog({
    marketplace: "walmart",
    sku: draft.sku,
    actionType: "draft_discard",
    result: "warning",
    message: "Draft discarded.",
    afterPayload: draft,
  });

  return draft;
}

export function clearDrafts(): void {
  getStore().drafts = [];
}

export function listFeeds(): WalmartFeedSubmission[] {
  return [...getStore().feeds];
}

export function getFeedById(feedId: string): WalmartFeedSubmission | null {
  return getStore().feeds.find((feed) => feed.feedId === feedId) ?? null;
}

export function prependFeed(submission: WalmartFeedSubmission): WalmartFeedSubmission {
  const store = getStore();
  store.feeds.unshift(submission);
  return submission;
}

export function updateFeed(feedId: string, update: Partial<WalmartFeedSubmission>): WalmartFeedSubmission {
  const feed = getFeedById(feedId);
  if (!feed) {
    throw new Error("Feed not found");
  }

  Object.assign(feed, update);
  return feed;
}

export function clearFeeds(): void {
  getStore().feeds = [];
}

export function getDashboardCounts() {
  const store = getStore();
  const attentionProducts = store.products.filter((product) => product.issues.length > 0 || product.status !== "active");
  const feedErrors = store.feeds.reduce((sum, feed) => sum + feed.errorReport.length, 0);

  return {
    productsImported: store.products.length,
    draftChanges: store.drafts.filter((draft) => draft.status !== "discarded").length,
    feedErrors,
    listingsNeedingAttention: {
      count: attentionProducts.length,
      categories: Array.from(new Set(attentionProducts.flatMap((product) => product.issues))).slice(0, 5),
    },
    recentProducts: store.products.slice(0, 5),
    attentionProducts: attentionProducts.slice(0, 5),
    recentActivity: listActivityLogs({ marketplace: "walmart", limit: 8 }).map((entry) => ({
      time: entry.createdAt,
      action: entry.actionType,
      result: entry.result,
      sku: entry.sku,
      message: entry.message,
    })),
  };
}

export function getRecentInventoryChanges() {
  return listActivityLogs({ marketplace: "walmart", limit: 20 }).filter((entry) => entry.actionType === "inventory_update");
}

export function getRecentPriceChanges() {
  return listActivityLogs({ marketplace: "walmart", limit: 20 }).filter((entry) => entry.actionType === "pricing_update");
}
