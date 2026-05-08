import "server-only";

import { appendActivityLog, listActivityLogs } from "@/lib/ecomviper/core/activity-log";
import type { RuntimeMode } from "@/lib/ecomviper/core/marketplace-types";
import { createDraftRecord, validateDraftPayload } from "@/lib/ecomviper/core/draft-workflow";
import type {
  WalmartDraftRecord,
  WalmartFeedSubmission,
  WalmartProductRecord,
} from "@/lib/ecomviper/walmart/walmart-types";

interface WalmartStore {
  mode: RuntimeMode;
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

function getStore(): WalmartStore {
  if (!globalThis.__ecomviper_walmart_store__) {
    globalThis.__ecomviper_walmart_store__ = {
      mode: resolveRuntimeMode(),
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
      violations: validation.violations,
      warnings: validation.warnings,
      suggestions: validation.suggestions,
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
      violations: validation.violations,
      warnings: validation.warnings,
      suggestions: validation.suggestions,
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
    violations: validation.violations,
    warnings: validation.warnings,
    suggestions: validation.suggestions,
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

  const hasBlockingIssues = !draft.validationResult.valid || (draft.validationResult.violations?.length ?? 0) > 0;
  if (hasBlockingIssues) {
    draft.status = "failed";
    draft.publishStatus = "failed";
    draft.updatedAt = new Date().toISOString();

    appendActivityLog({
      marketplace: "walmart",
      sku: draft.sku,
      actionType: "draft_submit",
      result: "error",
      message: "Draft submit blocked by validation/compliance issues.",
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
