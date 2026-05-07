import "server-only";

import crypto from "crypto";
import type { RuntimeMode } from "@/lib/ecomviper/core/marketplace-types";
import { appendActivityLog, listActivityLogs } from "@/lib/ecomviper/core/activity-log";
import { createDraftRecord, validateDraftPayload } from "@/lib/ecomviper/core/draft-workflow";
import { normalizeWalmartProduct } from "@/lib/ecomviper/core/product-normalizer";
import type {
  WalmartConnectionSummary,
  WalmartDraftRecord,
  WalmartFeedSubmission,
  WalmartFeedStatus,
  WalmartMutationResult,
  WalmartProductRecord,
} from "@/lib/ecomviper/walmart/walmart-types";

interface WalmartMockStore {
  mode: RuntimeMode;
  connection: WalmartConnectionSummary;
  connectionStatus: "connected" | "not_connected";
  lastSuccessfulApiCall: string | null;
  products: WalmartProductRecord[];
  drafts: WalmartDraftRecord[];
  feeds: WalmartFeedSubmission[];
  lastImportAt: string | null;
}

declare global {
  var __ecomviper_walmart_store__: WalmartMockStore | undefined;
}

function resolveRuntimeMode(): RuntimeMode {
  const raw = (process.env.ECOMVIPER_WALMART_MODE ?? process.env.WALMART_MARKETPLACE_MODE ?? "mock")
    .trim()
    .toLowerCase();
  if (raw === "live-ready") return "live-ready";
  if (raw === "dry-run") return "dry-run";
  return "mock";
}

function seedProducts(): WalmartProductRecord[] {
  return [
    normalizeWalmartProduct({
      sku: "OPA-OMEGA3-120",
      title: "OPA Nutrition Omega-3 Daily Wellness Softgels 120ct",
      brand: "OPA Nutrition",
      price: 39.99,
      inventoryQuantity: 42,
      imageUrl: "https://images.example.com/opa-omega3-120.jpg",
      attributes: {
        flavor: "Unflavored",
        serving_size: "2 softgels",
      },
      description:
        "Premium omega-3 softgels designed to support daily wellness, heart wellness, and cognitive performance support.",
      shortDescription: "Daily omega-3 support for heart wellness and routine performance.",
      bulletPoints: [
        "Premium fish oil softgels for daily wellness",
        "Supports heart wellness and routine cognition",
        "Third-party tested quality assurance",
      ],
    }),
    normalizeWalmartProduct({
      sku: "OPA-MEN-WELL-90",
      title: "OPA Nutrition Men\'s Wellness Complex Capsules 90ct",
      brand: "OPA Nutrition",
      price: 34.5,
      inventoryQuantity: 11,
      imageUrl: "https://images.example.com/opa-mens-wellness.jpg",
      attributes: {
        serving_size: "3 capsules",
        form: "Capsules",
      },
      description:
        "Targeted men\'s wellness formula supporting circulation support, endurance support, and daily performance support.",
      shortDescription: "Men\'s wellness support blend for endurance and circulation support.",
      bulletPoints: [
        "Daily men\'s wellness support",
        "Supports circulation and endurance",
        "Made in GMP-certified facilities",
      ],
    }),
    normalizeWalmartProduct({
      sku: "OPA-SLEEP-60",
      title: "OPA Nutrition Night Restore Sleep Quality Support 60ct",
      brand: "OPA Nutrition",
      price: 0,
      inventoryQuantity: 0,
      imageUrl: "",
      attributes: {
        serving_size: "2 capsules",
      },
      description:
        "Sleep quality support formula crafted for evening routines, relaxation support, and next-day recovery.",
      shortDescription: "Evening wellness capsules for sleep quality support.",
      bulletPoints: [
        "Supports evening relaxation",
        "Built for nightly routines",
      ],
      status: "attention",
    }),
  ];
}

function defaultConnection(mode: RuntimeMode): WalmartConnectionSummary {
  return {
    accountNickname: process.env.WALMART_ACCOUNT_NICKNAME?.trim() || "Walmart Account",
    environment: process.env.WALMART_MARKETPLACE_ENV?.trim().toLowerCase() === "production" ? "production" : "sandbox",
    region: "US",
    maskedClientId: process.env.WALMART_CLIENT_ID
      ? `${process.env.WALMART_CLIENT_ID.slice(0, 2)}***${process.env.WALMART_CLIENT_ID.slice(-4)}`
      : "Not configured",
    clientSecretStored: Boolean(process.env.WALMART_CLIENT_SECRET),
    lastSuccessfulAuth: null,
    lastApiError: null,
    tokenStatus: "unknown",
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
  };
}

function getStore(): WalmartMockStore {
  if (!globalThis.__ecomviper_walmart_store__) {
    const mode = resolveRuntimeMode();
    globalThis.__ecomviper_walmart_store__ = {
      mode,
      connection: defaultConnection(mode),
      connectionStatus: process.env.WALMART_CLIENT_ID && process.env.WALMART_CLIENT_SECRET ? "connected" : "not_connected",
      lastSuccessfulApiCall: null,
      products: seedProducts(),
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
    summary: store.connection,
    lastSuccessfulApiCall: store.lastSuccessfulApiCall,
    lastApiError: store.connection.lastApiError,
  };
}

export function setWalmartConnectionSummary(
  summary: WalmartConnectionSummary,
  status: "connected" | "not_connected"
): WalmartConnectionSummary {
  const store = getStore();
  store.connection = {
    ...summary,
    mode: store.mode,
  };
  store.connectionStatus = status;
  store.lastSuccessfulApiCall = summary.lastSuccessfulAuth;
  return store.connection;
}

export function disconnectWalmartConnection(): void {
  const store = getStore();
  store.connectionStatus = "not_connected";
  store.connection = {
    ...store.connection,
    tokenStatus: "unknown",
    lastApiError: null,
    lastSuccessfulAuth: null,
    maskedClientId: "Not configured",
    clientSecretStored: false,
  };
}

export function listMockProducts(): WalmartProductRecord[] {
  return [...getStore().products];
}

export function getMockProductBySku(sku: string): WalmartProductRecord | null {
  const normalized = sku.trim().toUpperCase();
  return getStore().products.find((item) => item.sku.toUpperCase() === normalized) ?? null;
}

export function importMockProducts(): { importedCount: number; lastImportAt: string; mode: RuntimeMode } {
  const store = getStore();
  const now = new Date().toISOString();
  store.products = seedProducts().map((item) => ({
    ...item,
    lastSyncedAt: now,
    updatedAt: now,
  }));
  store.lastImportAt = now;
  appendActivityLog({
    marketplace: "walmart",
    actionType: "product_import",
    result: "success",
    message: `Imported ${store.products.length} products (${store.mode}).`,
  });
  return {
    importedCount: store.products.length,
    lastImportAt: now,
    mode: store.mode,
  };
}

export function getLastImportAt(): string | null {
  return getStore().lastImportAt;
}

export function replaceProduct(product: WalmartProductRecord): void {
  const store = getStore();
  const index = store.products.findIndex((entry) => entry.sku === product.sku);
  if (index >= 0) {
    store.products[index] = product;
  } else {
    store.products.unshift(product);
  }
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
  const product = getMockProductBySku(params.sku);
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
  if (!draft) throw new Error("Draft not found");

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
  const store = getStore();
  const draft = getDraftById(id);
  if (!draft) throw new Error("Draft not found");

  const product = getMockProductBySku(draft.sku);
  if (!product) throw new Error("Product not found for draft");

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

  if (store.mode === "mock") {
    const merged = {
      ...product,
      ...draft.draftPayload,
      updatedAt: new Date().toISOString(),
      status: "active" as const,
    } satisfies WalmartProductRecord;
    replaceProduct(merged);
    draft.status = "synced";
    draft.publishStatus = "synced";
  }

  appendActivityLog({
    marketplace: "walmart",
    sku: draft.sku,
    actionType: "draft_submit",
    result: store.mode === "mock" ? "success" : "warning",
    message:
      store.mode === "mock"
        ? "Draft synced to mock catalog."
        : `Draft submitted in ${store.mode} mode without live Walmart write.`,
    afterPayload: draft,
  });

  return draft;
}

export function discardDraft(id: string): WalmartDraftRecord {
  const draft = getDraftById(id);
  if (!draft) throw new Error("Draft not found");
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

export function mutateInventory(params: { sku: string; quantity: number; saveAsDraft?: boolean }): WalmartMutationResult {
  const store = getStore();
  const product = getMockProductBySku(params.sku);
  if (!product) {
    return {
      ok: false,
      sku: params.sku,
      mode: store.mode,
      dryRun: store.mode !== "mock",
      message: "SKU not found.",
    };
  }

  if (params.saveAsDraft) {
    upsertDraftForSku({ sku: params.sku, draftPayload: { inventoryQuantity: params.quantity } });
    return {
      ok: true,
      sku: params.sku,
      mode: store.mode,
      dryRun: true,
      message: "Inventory change saved as draft.",
    };
  }

  const dryRun = store.mode !== "mock";
  if (!dryRun) {
    product.inventoryQuantity = params.quantity;
    product.updatedAt = new Date().toISOString();
  }

  appendActivityLog({
    marketplace: "walmart",
    sku: params.sku,
    actionType: "inventory_update",
    result: dryRun ? "warning" : "success",
    message: dryRun
      ? `Dry-run only: inventory would update to ${params.quantity}.`
      : `Inventory updated to ${params.quantity}.`,
  });

  return {
    ok: true,
    sku: params.sku,
    mode: store.mode,
    dryRun,
    message: dryRun
      ? `Dry-run only: inventory would update to ${params.quantity}.`
      : `Inventory updated to ${params.quantity}.`,
  };
}

export function mutatePricing(params: { sku: string; price: number; saveAsDraft?: boolean }): WalmartMutationResult {
  const store = getStore();
  const product = getMockProductBySku(params.sku);
  if (!product) {
    return {
      ok: false,
      sku: params.sku,
      mode: store.mode,
      dryRun: store.mode !== "mock",
      message: "SKU not found.",
    };
  }

  if (params.saveAsDraft) {
    upsertDraftForSku({ sku: params.sku, draftPayload: { price: params.price } });
    return {
      ok: true,
      sku: params.sku,
      mode: store.mode,
      dryRun: true,
      message: "Price change saved as draft.",
    };
  }

  const dryRun = store.mode !== "mock";
  if (!dryRun) {
    product.price = params.price;
    product.updatedAt = new Date().toISOString();
  }

  appendActivityLog({
    marketplace: "walmart",
    sku: params.sku,
    actionType: "pricing_update",
    result: dryRun ? "warning" : "success",
    message: dryRun
      ? `Dry-run only: price would update to ${params.price.toFixed(2)}.`
      : `Price updated to ${params.price.toFixed(2)}.`,
  });

  return {
    ok: true,
    sku: params.sku,
    mode: store.mode,
    dryRun,
    message: dryRun
      ? `Dry-run only: price would update to ${params.price.toFixed(2)}.`
      : `Price updated to ${params.price.toFixed(2)}.`,
  };
}

function nextFeedStatus(mode: RuntimeMode): WalmartFeedStatus {
  if (mode === "mock") return "PROCESSED";
  if (mode === "dry-run") return "RECEIVED";
  return "UNKNOWN";
}

export function submitMaintenanceFeed(payload: unknown): WalmartFeedSubmission {
  const store = getStore();
  const now = new Date().toISOString();
  const status = nextFeedStatus(store.mode);

  const submission: WalmartFeedSubmission = {
    id: `feed_submission_${crypto.randomUUID()}`,
    marketplace: "walmart",
    feedId: `wm_feed_${crypto.randomUUID().slice(0, 12)}`,
    feedType: "MP_MAINTENANCE",
    status,
    submittedPayload: payload,
    responsePayload: {
      note:
        store.mode === "mock"
          ? "Mock mode: feed processed in-memory."
          : `Mode ${store.mode}: feed not sent to Walmart yet.`,
    },
    errorReport: [],
    submittedAt: now,
    completedAt: status === "PROCESSED" ? now : null,
  };

  store.feeds.unshift(submission);

  appendActivityLog({
    marketplace: "walmart",
    actionType: "feed_submit",
    result: status === "PROCESSED" ? "success" : "warning",
    message:
      store.mode === "mock"
        ? "Maintenance feed processed in mock mode."
        : `Maintenance feed captured in ${store.mode} mode.`,
    afterPayload: submission,
  });

  return submission;
}

export function listFeeds(): WalmartFeedSubmission[] {
  return [...getStore().feeds];
}

export function getFeedById(feedId: string): WalmartFeedSubmission | null {
  return getStore().feeds.find((feed) => feed.feedId === feedId) ?? null;
}

export function checkFeedStatus(feedId: string): WalmartFeedSubmission {
  const submission = getFeedById(feedId);
  if (!submission) {
    throw new Error("Feed not found");
  }

  if (submission.status === "RECEIVED") {
    submission.status = "INPROGRESS";
  } else if (submission.status === "INPROGRESS") {
    submission.status = "PROCESSED";
    submission.completedAt = new Date().toISOString();
  }

  appendActivityLog({
    marketplace: "walmart",
    actionType: "feed_status_check",
    result: submission.status === "ERROR" ? "error" : "success",
    message: `Feed ${submission.feedId} is ${submission.status}.`,
    afterPayload: { feedId: submission.feedId, status: submission.status },
  });

  return submission;
}

export function clearMockProducts(): void {
  const store = getStore();
  store.products = [];
  store.lastImportAt = null;
}

export function clearDrafts(): void {
  getStore().drafts = [];
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
