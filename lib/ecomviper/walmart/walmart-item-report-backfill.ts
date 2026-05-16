import "server-only";

import {
  createEmptyWalmartDocket,
  type WalmartNormalizedDocket,
} from "@/lib/ecomviper/walmart/walmart-docket";
import {
  hydrateWalmartDocketFromSources,
} from "@/lib/ecomviper/walmart/walmart-docket-hydration";
import {
  buildWalmartDocketFreshnessSummary,
  type WalmartDocketFreshnessSummary,
  type WalmartDocketFieldFreshness,
  type WalmartItemReportBackfillStatus,
} from "@/lib/ecomviper/walmart/walmart-docket-freshness";
import {
  getPersistedWalmartLastImportAt,
  getPersistedWalmartProductBySku,
  listPersistedWalmartProducts,
  replacePersistedWalmartProducts,
} from "@/lib/ecomviper/walmart/walmart-product-repository";
import {
  createLiveWalmartItemReportProvider,
  type WalmartItemReportApplyResult as ProviderItemReportApplyResult,
  type WalmartItemReportBackfillDiagnostic,
  type WalmartItemReportBackfillPollResult as ProviderItemReportBackfillPollResult,
  type WalmartItemReportBackfillRequest,
  type WalmartItemReportDownloadResult as ProviderItemReportDownloadResult,
  type WalmartItemReportProvider,
  type WalmartItemReportCredentialMode,
  type WalmartItemReportBackfillSource,
} from "@/lib/ecomviper/walmart/walmart-item-report-provider";
import {
  itemReportRowToDocketSourcePayload,
  type WalmartItemReportRow,
} from "@/lib/ecomviper/walmart/walmart-item-report";
import type {
  WalmartProductRecord,
} from "@/lib/ecomviper/walmart/walmart-types";

const REPORT_REQUEST_COOLDOWN_MS = 60 * 60 * 1000;
const APPLY_CONTENT_MAX_CHARS = 2_000_000;

const NON_MEANINGFUL = new Set(["", "unknown", "not available", "n/a", "na", "none", "null", "undefined"]);

export interface WalmartItemReportBackfillJob {
  status: WalmartItemReportBackfillStatus;
  requestId: string | null;
  reportType: "ITEM";
  reportVersion: string | null;
  requestedAt: string | null;
  lastCheckedAt: string | null;
  readyAt: string | null;
  downloadedAt: string | null;
  appliedAt: string | null;
  expiresAt: string | null;
  source: WalmartItemReportBackfillSource;
  credentialMode: WalmartItemReportCredentialMode;
  cooldownUntil: string | null;
  rowCount: number;
  appliedSkuCount: number;
  warningCount: number;
  errorCount: number;
  diagnostics: WalmartItemReportBackfillDiagnostic[];
  reportContent: string | null;
  reportContentType: string | null;
}

export interface WalmartItemReportBackfillRequestResult {
  ok: boolean;
  job: WalmartItemReportBackfillJob;
  freshness: WalmartDocketFreshnessSummary;
}

export interface WalmartItemReportBackfillPollResult {
  ok: boolean;
  job: WalmartItemReportBackfillJob;
  freshness: WalmartDocketFreshnessSummary;
}

export interface WalmartItemReportDownloadResult {
  ok: boolean;
  job: WalmartItemReportBackfillJob;
  freshness: WalmartDocketFreshnessSummary;
}

export interface WalmartItemReportFieldApplyDiagnostic {
  field: string;
  previousValue: unknown;
  newValue: unknown;
  previousSource: string;
  newSource: string;
  confidence: "high" | "medium" | "low" | "unknown";
  action:
    | "filled_missing"
    | "replaced_placeholder"
    | "replaced_lower_confidence"
    | "kept_user_edit"
    | "kept_item_detail"
    | "skipped_conflict"
    | "unchanged";
  warnings: string[];
}

export interface WalmartItemReportApplyResult extends ProviderItemReportApplyResult {
  job: WalmartItemReportBackfillJob;
  matchedRowCount: number;
  unmatchedRowCount: number;
  duplicateSkuCount: number;
  appliedFields: WalmartItemReportFieldApplyDiagnostic[];
  freshnessBySku: Record<string, WalmartDocketFreshnessSummary>;
  updatedProduct: WalmartProductRecord | null;
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function asText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function parseIso(value: string | null | undefined): number | null {
  const text = asText(value);
  if (!text) return null;
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function isMeaningful(value: unknown): boolean {
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === "object") return Object.keys(value as Record<string, unknown>).length > 0;
  const normalized = asText(value).toLowerCase();
  if (!normalized) return false;
  return !NON_MEANINGFUL.has(normalized);
}

function isPlaceholder(value: unknown): boolean {
  const normalized = asText(value).toLowerCase();
  if (!normalized) return true;
  return NON_MEANINGFUL.has(normalized);
}

function normalizeSkuKey(sku: string): string {
  return sku.trim().toUpperCase();
}

function createEmptyBackfillJob(): WalmartItemReportBackfillJob {
  return {
    status: "not_requested",
    requestId: null,
    reportType: "ITEM",
    reportVersion: null,
    requestedAt: null,
    lastCheckedAt: null,
    readyAt: null,
    downloadedAt: null,
    appliedAt: null,
    expiresAt: null,
    source: "unavailable",
    credentialMode: "unavailable",
    cooldownUntil: null,
    rowCount: 0,
    appliedSkuCount: 0,
    warningCount: 0,
    errorCount: 0,
    diagnostics: [],
    reportContent: null,
    reportContentType: null,
  };
}

function createPlaceholderProduct(input: {
  sku: string;
  job?: WalmartItemReportBackfillJob;
}): WalmartProductRecord {
  const now = new Date().toISOString();
  const job = input.job ?? createEmptyBackfillJob();
  return {
    id: `walmart_${input.sku.toLowerCase() || "unknown"}`,
    marketplace: "walmart",
    sku: input.sku,
    externalItemId: `wm_${input.sku.toLowerCase() || "unknown"}`,
    title: input.sku || "Unknown Walmart SKU",
    brand: "",
    category: "Supplements",
    price: 0,
    inventoryQuantity: 0,
    inventoryStatus: "unknown",
    status: "attention",
    imageUrl: "",
    issues: [],
    attributes: {},
    shortDescription: "",
    longDescription: "",
    bulletPoints: [],
    docket: createEmptyWalmartDocket({ sku: input.sku || "UNKNOWN-SKU" }),
    rawPayload: { itemReportBackfill: job },
    normalizedPayload: { itemReportBackfill: job },
    lastSyncedAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

function createDiagnostic(input: WalmartItemReportBackfillDiagnostic): WalmartItemReportBackfillDiagnostic {
  return input;
}

function normalizeBackfillJob(value: unknown): WalmartItemReportBackfillJob {
  const base = createEmptyBackfillJob();
  const row = asObject(value) ?? {};
  const statusCandidate = asText(row.status);
  const allowedStatuses = new Set<WalmartItemReportBackfillStatus>([
    "not_requested",
    "request_blocked_no_credentials",
    "request_blocked_cooldown",
    "request_failed",
    "requested",
    "submitted",
    "in_progress",
    "ready",
    "download_failed",
    "downloaded",
    "parse_failed",
    "applied",
    "applied_with_warnings",
    "no_matching_rows",
    "expired",
    "unavailable",
  ]);
  const sourceCandidate = asText(row.source);
  const credentialModeCandidate = asText(row.credentialMode);

  return {
    ...base,
    status: allowedStatuses.has(statusCandidate as WalmartItemReportBackfillStatus)
      ? (statusCandidate as WalmartItemReportBackfillStatus)
      : base.status,
    requestId: asText(row.requestId) || null,
    reportVersion: asText(row.reportVersion) || null,
    requestedAt: asText(row.requestedAt) || null,
    lastCheckedAt: asText(row.lastCheckedAt) || null,
    readyAt: asText(row.readyAt) || null,
    downloadedAt: asText(row.downloadedAt) || null,
    appliedAt: asText(row.appliedAt) || null,
    expiresAt: asText(row.expiresAt) || null,
    source:
      sourceCandidate === "live" || sourceCandidate === "fixture" || sourceCandidate === "unavailable"
        ? (sourceCandidate as WalmartItemReportBackfillSource)
        : base.source,
    credentialMode:
      credentialModeCandidate === "byo_live" ||
      credentialModeCandidate === "mock" ||
      credentialModeCandidate === "unavailable"
        ? (credentialModeCandidate as WalmartItemReportCredentialMode)
        : base.credentialMode,
    cooldownUntil: asText(row.cooldownUntil) || null,
    rowCount:
      typeof row.rowCount === "number" && Number.isFinite(row.rowCount) ? Math.max(0, Math.floor(row.rowCount)) : 0,
    appliedSkuCount:
      typeof row.appliedSkuCount === "number" && Number.isFinite(row.appliedSkuCount)
        ? Math.max(0, Math.floor(row.appliedSkuCount))
        : 0,
    warningCount:
      typeof row.warningCount === "number" && Number.isFinite(row.warningCount)
        ? Math.max(0, Math.floor(row.warningCount))
        : 0,
    errorCount:
      typeof row.errorCount === "number" && Number.isFinite(row.errorCount)
        ? Math.max(0, Math.floor(row.errorCount))
        : 0,
    diagnostics: Array.isArray(row.diagnostics)
      ? row.diagnostics.reduce<WalmartItemReportBackfillDiagnostic[]>((acc, entry) => {
          const record = asObject(entry);
          if (!record) return acc;
          const code = asText(record.code);
          const message = asText(record.message);
          const source = asText(record.source);
          if (!code || !message) return acc;
          if (source !== "walmart_item_report" && source !== "fixture" && source !== "backfill") {
            return acc;
          }
          acc.push({
            code,
            message,
            source,
            level: ["info", "warning", "error"].includes(asText(record.level))
              ? (asText(record.level) as "info" | "warning" | "error")
              : undefined,
          });
          return acc;
        }, [])
      : [],
    reportContent: typeof row.reportContent === "string" ? row.reportContent : null,
    reportContentType: asText(row.reportContentType) || null,
  };
}

function mapLegacyBackfillStatus(status: WalmartItemReportBackfillStatus):
  | "report_backfill_pending"
  | "report_unavailable"
  | "report_applied" {
  if (status === "applied" || status === "applied_with_warnings") return "report_applied";
  if (status === "request_blocked_no_credentials" || status === "unavailable") return "report_unavailable";
  return "report_backfill_pending";
}

function mapLegacyBackfillReason(status: WalmartItemReportBackfillStatus): string {
  if (status === "applied") return "Item report rows were applied to this docket.";
  if (status === "applied_with_warnings") {
    return "Item report rows were applied with warnings. Review diagnostics for skipped/conflicting fields.";
  }
  if (status === "request_blocked_no_credentials") {
    return "Item report request is blocked because Walmart credentials are not configured.";
  }
  if (status === "request_blocked_cooldown") {
    return "Item report request is blocked by Walmart report cooldown. Try again later.";
  }
  if (status === "ready") {
    return "ITEM report is ready to download and apply.";
  }
  if (status === "downloaded") {
    return "ITEM report downloaded. Apply rows when ready.";
  }
  if (status === "no_matching_rows") {
    return "ITEM report applied, but no matching rows were found for this SKU/catalog.";
  }
  if (status === "request_failed" || status === "download_failed" || status === "parse_failed") {
    return "ITEM report backfill failed. Check diagnostics and retry.";
  }
  if (status === "unavailable") {
    return "ITEM report backfill is unavailable in this runtime/credential context.";
  }
  return "ITEM report backfill is pending or in progress.";
}

function updateDocketStatuses(docket: WalmartNormalizedDocket | undefined, status: WalmartItemReportBackfillStatus) {
  const next = docket ?? null;
  if (!next) return next;

  const statuses = new Set(next.statuses ?? []);
  if (["request_blocked_no_credentials", "unavailable"].includes(status)) {
    statuses.add("report_unavailable");
    statuses.delete("report_backfill_pending");
  } else if (["applied", "applied_with_warnings", "no_matching_rows"].includes(status)) {
    statuses.delete("report_unavailable");
    statuses.delete("report_backfill_pending");
  } else {
    statuses.delete("report_unavailable");
    statuses.add("report_backfill_pending");
  }

  return {
    ...next,
    statuses: Array.from(statuses),
  };
}

function withBackfillJob(product: WalmartProductRecord, job: WalmartItemReportBackfillJob): WalmartProductRecord {
  const normalizedPayload = asObject(product.normalizedPayload) ?? {};
  const rawPayload = asObject(product.rawPayload) ?? {};
  const nextDocket = updateDocketStatuses(product.docket, job.status);

  const nextNormalizedPayload: Record<string, unknown> = {
    ...normalizedPayload,
    itemReportBackfill: job,
    itemReportBackfillStatus: mapLegacyBackfillStatus(job.status),
    itemReportBackfillReason: mapLegacyBackfillReason(job.status),
  };

  if (nextDocket) {
    nextNormalizedPayload.docket = nextDocket;
    nextNormalizedPayload.docketHydrationStatus = [...(nextDocket.statuses ?? [])];
  }

  return {
    ...product,
    docket: nextDocket ?? product.docket,
    normalizedPayload: nextNormalizedPayload,
    rawPayload: {
      ...rawPayload,
      itemReportBackfill: job,
    },
    updatedAt: new Date().toISOString(),
  };
}

function backfillJobFromProduct(product: WalmartProductRecord): WalmartItemReportBackfillJob {
  const normalizedPayload = asObject(product.normalizedPayload) ?? {};
  return normalizeBackfillJob(normalizedPayload.itemReportBackfill);
}

function valueForField(docket: WalmartNormalizedDocket, path: string): unknown {
  const parts = path.split(".").filter(Boolean);
  let current: unknown = docket;
  for (const part of parts) {
    if (!current || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function equalValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function confidenceRank(value: string): number {
  if (value === "high") return 3;
  if (value === "medium") return 2;
  if (value === "low") return 1;
  return 0;
}

function mergeFieldAction(input: {
  previousValue: unknown;
  newValue: unknown;
  previousSource: string;
  newSource: string;
  previousConfidence: string;
  newConfidence: string;
}): WalmartItemReportFieldApplyDiagnostic["action"] {
  if (equalValue(input.previousValue, input.newValue)) {
    if (input.previousSource === "user_edit" || input.previousSource === "ai_optimized") {
      return "kept_user_edit";
    }
    if (input.previousSource === "item_detail") {
      return "kept_item_detail";
    }
    return "unchanged";
  }

  if (!isMeaningful(input.previousValue)) return "filled_missing";
  if (isPlaceholder(input.previousValue)) return "replaced_placeholder";
  if (confidenceRank(input.newConfidence) > confidenceRank(input.previousConfidence)) {
    return "replaced_lower_confidence";
  }
  return "replaced_lower_confidence";
}

function mapRowBySku(rows: WalmartItemReportRow[]): Map<string, WalmartItemReportRow[]> {
  const map = new Map<string, WalmartItemReportRow[]>();
  for (const row of rows) {
    const key = normalizeSkuKey(row.sku);
    if (!key) continue;
    map.set(key, [...(map.get(key) ?? []), row]);
  }
  return map;
}

function pickBestRow(rows: WalmartItemReportRow[]): WalmartItemReportRow | null {
  if (rows.length === 0) return null;
  return [...rows].sort((left, right) => {
    const leftScore =
      Number(Boolean(left.primaryImageUrl)) * 20 +
      (left.galleryImageUrls?.length ?? 0) * 5 +
      Number(Boolean(left.longDescription)) * 4 +
      Number(Boolean(left.shelfDescription || left.siteDescription)) * 3;
    const rightScore =
      Number(Boolean(right.primaryImageUrl)) * 20 +
      (right.galleryImageUrls?.length ?? 0) * 5 +
      Number(Boolean(right.longDescription)) * 4 +
      Number(Boolean(right.shelfDescription || right.siteDescription)) * 3;
    return rightScore - leftScore;
  })[0] ?? null;
}

function applyRowToProduct(input: {
  product: WalmartProductRecord;
  row: WalmartItemReportRow;
  now: string;
}): { product: WalmartProductRecord; diagnostics: WalmartItemReportFieldApplyDiagnostic[]; changed: boolean } {
  const baseDocket = input.product.docket ?? createEmptyWalmartDocket({ sku: input.product.sku });
  const nextDocket = hydrateWalmartDocketFromSources({
    sku: input.product.sku,
    existingDocket: baseDocket,
    hydratedAt: input.now,
    statuses: [...(baseDocket.statuses ?? []), "imported_docket_ready"],
    sources: [
      {
        source: "item_report",
        payload: itemReportRowToDocketSourcePayload(input.row),
        retrievedAt: input.now,
        updatedAt: input.now,
        confidence: "medium",
      },
    ],
  });

  const trackedFields = [
    "content.shortDescription",
    "content.longDescription",
    "content.bullets",
    "media.primaryImage",
    "media.galleryImages",
    "pricingInventory.price",
    "pricingInventory.salePrice",
    "pricingInventory.inventoryQuantity",
    "pricingInventory.inventoryStatus",
    "searchBrowse.productType",
    "searchBrowse.category",
    "searchBrowse.attributes",
  ];

  const diagnostics: WalmartItemReportFieldApplyDiagnostic[] = trackedFields.map((path) => {
    const previous = asObject(valueForField(baseDocket, path));
    const next = asObject(valueForField(nextDocket, path));

    const previousValue = previous?.value;
    const newValue = next?.value;
    const previousSource = asText(previous?.source) || "unknown";
    const newSource = asText(next?.source) || "unknown";
    const previousConfidence = asText(previous?.confidence) || "unknown";
    const newConfidence = asText(next?.confidence) || "unknown";

    return {
      field: path,
      previousValue,
      newValue,
      previousSource,
      newSource,
      confidence: (newConfidence as "high" | "medium" | "low" | "unknown") ?? "unknown",
      action: mergeFieldAction({
        previousValue,
        newValue,
        previousSource,
        newSource,
        previousConfidence,
        newConfidence,
      }),
      warnings: Array.isArray(next?.warnings)
        ? next.warnings
            .map((entry) => asText(entry))
            .filter((entry) => entry.length > 0)
        : [],
    };
  });

  const changed = diagnostics.some((entry) => !equalValue(entry.previousValue, entry.newValue));

  const normalizedPayload = asObject(input.product.normalizedPayload) ?? {};
  const rawPayload = asObject(input.product.rawPayload) ?? {};
  const itemReportHydration = asObject(normalizedPayload.itemReportHydration) ?? {};

  const imageUrl = asText(nextDocket.media.primaryImage.value) || input.product.imageUrl;
  const galleryImageUrls = Array.isArray(nextDocket.media.galleryImages.value)
    ? nextDocket.media.galleryImages.value.filter((entry) => typeof entry === "string" && entry.trim())
    : input.product.galleryImageUrls ?? [];

  const attributesFromDocket = asObject(nextDocket.searchBrowse.attributes.value) ?? {};
  const nextAttributes = {
    ...(input.product.attributes ?? {}),
    ...Object.fromEntries(
      Object.entries(attributesFromDocket)
        .map(([key, value]) => [key.trim(), asText(value)])
        .filter(([key, value]) => key.length > 0 && value.length > 0)
    ),
  };

  const nextProduct: WalmartProductRecord = {
    ...input.product,
    shortDescription: asText(nextDocket.content.shortDescription.value) || input.product.shortDescription,
    longDescription: asText(nextDocket.content.longDescription.value) || input.product.longDescription,
    bulletPoints: Array.isArray(nextDocket.content.bullets.value)
      ? nextDocket.content.bullets.value.filter((entry) => typeof entry === "string" && entry.trim())
      : input.product.bulletPoints,
    brand: asText(nextDocket.content.brand.value) || input.product.brand,
    category: asText(nextDocket.searchBrowse.category.value) || input.product.category,
    price:
      typeof nextDocket.pricingInventory.price.value === "number" && Number.isFinite(nextDocket.pricingInventory.price.value)
        ? nextDocket.pricingInventory.price.value
        : input.product.price,
    inventoryQuantity:
      typeof nextDocket.pricingInventory.inventoryQuantity.value === "number" &&
      Number.isFinite(nextDocket.pricingInventory.inventoryQuantity.value)
        ? Math.max(0, Math.floor(nextDocket.pricingInventory.inventoryQuantity.value))
        : input.product.inventoryQuantity,
    inventoryStatus: isMeaningful(nextDocket.pricingInventory.inventoryStatus.value)
      ? "known"
      : input.product.inventoryStatus,
    imageUrl,
    galleryImageUrls,
    itemId: asText(nextDocket.media.confirmedItemId.value) || input.product.itemId,
    attributes: nextAttributes,
    docket: nextDocket,
    normalizedPayload: {
      ...normalizedPayload,
      docket: nextDocket,
      docketHydrationStatus: [...(nextDocket.statuses ?? [])],
      itemReportHydration: {
        ...itemReportHydration,
        source: "item_report",
        hydratedAt: input.now,
        rowIndex: input.row.rowIndex,
        values: {
          shortDescription: asText(nextDocket.content.shortDescription.value),
          longDescription: asText(nextDocket.content.longDescription.value),
          bulletPoints: Array.isArray(nextDocket.content.bullets.value)
            ? [...nextDocket.content.bullets.value]
            : [],
          imageUrl: asText(nextDocket.media.primaryImage.value),
        },
        appliedFields: diagnostics,
      },
    },
    rawPayload: {
      ...rawPayload,
      itemReportBackfill: {
        rowIndex: input.row.rowIndex,
        hydratedAt: input.now,
      },
    },
    updatedAt: input.now,
  };

  return { product: nextProduct, diagnostics, changed };
}

async function persistProductsWithImportTimestamp(input: { userId: string; products: WalmartProductRecord[] }) {
  const lastImportAt = await getPersistedWalmartLastImportAt(input.userId);
  await replacePersistedWalmartProducts({
    userId: input.userId,
    products: input.products,
    importedAt: lastImportAt,
    pruneMissingActiveSkus: false,
  });
}

function resolveProvider(input: { userId: string; provider?: WalmartItemReportProvider }): WalmartItemReportProvider {
  return input.provider ?? createLiveWalmartItemReportProvider({ userId: input.userId });
}

function ensureCooldownNotActive(job: WalmartItemReportBackfillJob): boolean {
  const cooldownTs = parseIso(job.cooldownUntil);
  if (!cooldownTs) return true;
  return Date.now() >= cooldownTs;
}

function withRequestCooldown(now: string): string {
  return new Date(Date.parse(now) + REPORT_REQUEST_COOLDOWN_MS).toISOString();
}

export async function requestWalmartItemReportBackfillForUser(input: {
  userId: string;
  sku: string;
  provider?: WalmartItemReportProvider;
  request?: Partial<WalmartItemReportBackfillRequest>;
}): Promise<WalmartItemReportBackfillRequestResult> {
  const product = await getPersistedWalmartProductBySku(input.userId, input.sku);
  if (!product) {
    const placeholder = createEmptyBackfillJob();
    placeholder.status = "unavailable";
    placeholder.diagnostics = [
      createDiagnostic({
        code: "product_not_found",
        message: `SKU ${input.sku} was not found in the local Walmart catalog.`,
        source: "backfill",
        level: "error",
      }),
    ];
    return {
      ok: false,
      job: placeholder,
      freshness: buildWalmartDocketFreshnessSummary({
        product: createPlaceholderProduct({ sku: input.sku, job: placeholder }),
      }),
    };
  }

  const existingJob = backfillJobFromProduct(product);
  const now = new Date().toISOString();

  if (!ensureCooldownNotActive(existingJob)) {
    const blockedJob: WalmartItemReportBackfillJob = {
      ...existingJob,
      status: "request_blocked_cooldown",
      source: existingJob.source,
      credentialMode: existingJob.credentialMode,
      diagnostics: [
        ...existingJob.diagnostics,
        createDiagnostic({
          code: "cooldown_active",
          message: "ITEM report request cooldown is active.",
          source: "backfill",
          level: "warning",
        }),
      ],
    };
    const updated = withBackfillJob(product, blockedJob);
    await persistProductsWithImportTimestamp({ userId: input.userId, products: [updated] });
    return {
      ok: false,
      job: blockedJob,
      freshness: buildWalmartDocketFreshnessSummary({ product: updated }),
    };
  }

  const provider = resolveProvider(input);
  const requestResult = await provider.createItemReportRequest({
    reportType: "ITEM",
    sku: product.sku,
    ...input.request,
  });

  const nextJob: WalmartItemReportBackfillJob = {
    ...existingJob,
    status: requestResult.status,
    requestId: requestResult.requestId,
    reportType: "ITEM",
    reportVersion: requestResult.reportVersion,
    requestedAt: requestResult.requestedAt ?? now,
    lastCheckedAt: requestResult.requestedAt ?? now,
    source: requestResult.source,
    credentialMode: requestResult.credentialMode,
    cooldownUntil: requestResult.cooldownUntil ?? withRequestCooldown(now),
    diagnostics: [...requestResult.diagnostics],
    errorCount: requestResult.ok ? 0 : 1,
  };

  const updated = withBackfillJob(product, nextJob);
  await persistProductsWithImportTimestamp({ userId: input.userId, products: [updated] });

  return {
    ok: requestResult.ok,
    job: nextJob,
    freshness: buildWalmartDocketFreshnessSummary({ product: updated }),
  };
}

export async function pollWalmartItemReportBackfillForUser(input: {
  userId: string;
  sku: string;
  requestId?: string;
  provider?: WalmartItemReportProvider;
}): Promise<WalmartItemReportBackfillPollResult> {
  const product = await getPersistedWalmartProductBySku(input.userId, input.sku);
  if (!product) {
    return {
      ok: false,
      job: {
        ...createEmptyBackfillJob(),
        status: "unavailable",
        diagnostics: [
          createDiagnostic({
            code: "product_not_found",
            message: `SKU ${input.sku} was not found in the local Walmart catalog.`,
            source: "backfill",
            level: "error",
          }),
        ],
      },
      freshness: buildWalmartDocketFreshnessSummary({
        product: createPlaceholderProduct({ sku: input.sku }),
      }),
    };
  }

  const existingJob = backfillJobFromProduct(product);
  const requestId = asText(input.requestId) || existingJob.requestId || "";
  if (!requestId) {
    const nextJob = {
      ...existingJob,
      status: "not_requested" as WalmartItemReportBackfillStatus,
      diagnostics: [
        ...existingJob.diagnostics,
        createDiagnostic({
          code: "request_id_missing",
          message: "No ITEM report request ID was found for this SKU.",
          source: "backfill",
          level: "warning",
        }),
      ],
    };
    const updated = withBackfillJob(product, nextJob);
    await persistProductsWithImportTimestamp({ userId: input.userId, products: [updated] });
    return {
      ok: false,
      job: nextJob,
      freshness: buildWalmartDocketFreshnessSummary({ product: updated }),
    };
  }

  const provider = resolveProvider(input);
  const poll: ProviderItemReportBackfillPollResult = await provider.getReportRequestStatus(requestId);

  const nextJob: WalmartItemReportBackfillJob = {
    ...existingJob,
    status: poll.status,
    requestId,
    reportType: "ITEM",
    reportVersion: poll.reportVersion,
    requestedAt: existingJob.requestedAt,
    lastCheckedAt: poll.lastCheckedAt,
    readyAt: poll.readyAt ?? existingJob.readyAt,
    expiresAt: poll.expiresAt ?? existingJob.expiresAt,
    source: poll.source,
    credentialMode: poll.credentialMode,
    diagnostics: [...poll.diagnostics],
    errorCount: poll.ok ? 0 : Math.max(1, existingJob.errorCount + 1),
  };

  const updated = withBackfillJob(product, nextJob);
  await persistProductsWithImportTimestamp({ userId: input.userId, products: [updated] });

  return {
    ok: poll.ok,
    job: nextJob,
    freshness: buildWalmartDocketFreshnessSummary({ product: updated }),
  };
}

export async function downloadWalmartItemReportBackfillForUser(input: {
  userId: string;
  sku: string;
  requestId?: string;
  provider?: WalmartItemReportProvider;
}): Promise<WalmartItemReportDownloadResult> {
  const product = await getPersistedWalmartProductBySku(input.userId, input.sku);
  if (!product) {
    return {
      ok: false,
      job: {
        ...createEmptyBackfillJob(),
        status: "unavailable",
        diagnostics: [
          createDiagnostic({
            code: "product_not_found",
            message: `SKU ${input.sku} was not found in the local Walmart catalog.`,
            source: "backfill",
            level: "error",
          }),
        ],
      },
      freshness: buildWalmartDocketFreshnessSummary({
        product: createPlaceholderProduct({ sku: input.sku }),
      }),
    };
  }

  const provider = resolveProvider(input);
  const existingJob = backfillJobFromProduct(product);
  const requestId = asText(input.requestId) || existingJob.requestId || "";

  if (!requestId) {
    const nextJob = {
      ...existingJob,
      status: "not_requested" as WalmartItemReportBackfillStatus,
      diagnostics: [
        ...existingJob.diagnostics,
        createDiagnostic({
          code: "request_id_missing",
          message: "No ITEM report request ID is available for download.",
          source: "backfill",
          level: "warning",
        }),
      ],
    };
    const updated = withBackfillJob(product, nextJob);
    await persistProductsWithImportTimestamp({ userId: input.userId, products: [updated] });
    return {
      ok: false,
      job: nextJob,
      freshness: buildWalmartDocketFreshnessSummary({ product: updated }),
    };
  }

  const statusCheck = await provider.getReportDownloadUrl(requestId);
  if (!statusCheck.ok || (statusCheck.status !== "ready" && !statusCheck.downloadUrl)) {
    const nextJob = {
      ...existingJob,
      status: statusCheck.status,
      requestId,
      diagnostics: [...statusCheck.diagnostics],
      lastCheckedAt: new Date().toISOString(),
    };
    const updated = withBackfillJob(product, nextJob);
    await persistProductsWithImportTimestamp({ userId: input.userId, products: [updated] });
    return {
      ok: false,
      job: nextJob,
      freshness: buildWalmartDocketFreshnessSummary({ product: updated }),
    };
  }

  const download: ProviderItemReportDownloadResult = await provider.downloadReport({
    requestId,
    downloadUrl: statusCheck.downloadUrl,
  });

  const parsedRows = download.ok ? await provider.parseItemReport(download.content) : [];

  const nextJob: WalmartItemReportBackfillJob = {
    ...existingJob,
    status: download.ok ? "downloaded" : download.status,
    requestId,
    downloadedAt: download.downloadedAt,
    rowCount: parsedRows.length,
    source: download.source,
    credentialMode: download.credentialMode,
    diagnostics: [...download.diagnostics],
    reportContent: download.ok
      ? download.content.slice(0, APPLY_CONTENT_MAX_CHARS)
      : existingJob.reportContent,
    reportContentType: download.ok ? download.contentType : existingJob.reportContentType,
    errorCount: download.ok ? 0 : Math.max(1, existingJob.errorCount + 1),
  };

  const updated = withBackfillJob(product, nextJob);
  await persistProductsWithImportTimestamp({ userId: input.userId, products: [updated] });

  return {
    ok: download.ok,
    job: nextJob,
    freshness: buildWalmartDocketFreshnessSummary({ product: updated }),
  };
}

export async function applyWalmartItemReportBackfillForUser(input: {
  userId: string;
  sku?: string;
  applyToCatalog?: boolean;
  provider?: WalmartItemReportProvider;
}): Promise<WalmartItemReportApplyResult> {
  const provider = resolveProvider(input);
  const allProducts = await listPersistedWalmartProducts(input.userId);
  const targetSku = asText(input.sku).toUpperCase();
  const applyToCatalog = Boolean(input.applyToCatalog);

  const targetProducts = applyToCatalog
    ? [...allProducts]
    : allProducts.filter((product) => normalizeSkuKey(product.sku) === targetSku);

  const requestedProduct = targetProducts[0] ?? null;
  const baseJob = requestedProduct ? backfillJobFromProduct(requestedProduct) : createEmptyBackfillJob();

  if (!requestedProduct && !applyToCatalog) {
    return {
      status: "unavailable",
      rowCount: 0,
      appliedSkuCount: 0,
      warningCount: 0,
      errorCount: 1,
      source: "unavailable",
      credentialMode: "unavailable",
      diagnostics: [
        createDiagnostic({
          code: "product_not_found",
          message: `SKU ${targetSku || input.sku || "unknown"} was not found in local catalog.`,
          source: "backfill",
          level: "error",
        }),
      ],
      job: {
        ...baseJob,
        status: "unavailable",
      },
      matchedRowCount: 0,
      unmatchedRowCount: 0,
      duplicateSkuCount: 0,
      appliedFields: [],
      freshnessBySku: {},
      updatedProduct: null,
    };
  }

  let reportContent = baseJob.reportContent ?? "";
  let reportContentType = baseJob.reportContentType;
  let activeJob = baseJob;

  if (!reportContent.trim() && baseJob.requestId) {
    const downloaded = await downloadWalmartItemReportBackfillForUser({
      userId: input.userId,
      sku: requestedProduct?.sku ?? targetSku,
      requestId: baseJob.requestId,
      provider,
    });
    activeJob = downloaded.job;
    reportContent = downloaded.job.reportContent ?? "";
    reportContentType = downloaded.job.reportContentType;
  }

  if (!reportContent.trim()) {
    const noContentStatus: WalmartItemReportBackfillStatus =
      activeJob.status === "ready" ? "download_failed" : activeJob.status;
    return {
      status: noContentStatus,
      rowCount: 0,
      appliedSkuCount: 0,
      warningCount: 1,
      errorCount: 1,
      source: activeJob.source,
      credentialMode: activeJob.credentialMode,
      diagnostics: [
        ...activeJob.diagnostics,
        createDiagnostic({
          code: "report_content_missing",
          message: "ITEM report content is not available. Download a ready report before apply.",
          source: "backfill",
          level: "warning",
        }),
      ],
      job: {
        ...activeJob,
        status: noContentStatus,
      },
      matchedRowCount: 0,
      unmatchedRowCount: 0,
      duplicateSkuCount: 0,
      appliedFields: [],
      freshnessBySku: {},
      updatedProduct: requestedProduct,
    };
  }

  let rows: WalmartItemReportRow[] = [];
  try {
    rows = await provider.parseItemReport(reportContent);
  } catch {
    const parseJob: WalmartItemReportBackfillJob = {
      ...activeJob,
      status: "parse_failed",
      errorCount: Math.max(1, activeJob.errorCount + 1),
      diagnostics: [
        ...activeJob.diagnostics,
        createDiagnostic({
          code: "parse_failed",
          message: "Failed to parse ITEM report content.",
          source: "backfill",
          level: "error",
        }),
      ],
    };
    const updatedProducts = allProducts.map((product) => withBackfillJob(product, parseJob));
    await persistProductsWithImportTimestamp({ userId: input.userId, products: updatedProducts });
    return {
      status: "parse_failed",
      rowCount: 0,
      appliedSkuCount: 0,
      warningCount: 0,
      errorCount: parseJob.errorCount,
      source: parseJob.source,
      credentialMode: parseJob.credentialMode,
      diagnostics: [...parseJob.diagnostics],
      job: parseJob,
      matchedRowCount: 0,
      unmatchedRowCount: 0,
      duplicateSkuCount: 0,
      appliedFields: [],
      freshnessBySku: {},
      updatedProduct: requestedProduct,
    };
  }

  const rowsBySku = mapRowBySku(rows);
  const duplicateSkuCount = Array.from(rowsBySku.values()).filter((entry) => entry.length > 1).length;
  const now = new Date().toISOString();

  const freshnessBySku: Record<string, WalmartDocketFreshnessSummary> = {};
  const appliedFields: WalmartItemReportFieldApplyDiagnostic[] = [];
  let matchedRowCount = 0;
  let unmatchedRowCount = 0;
  let appliedSkuCount = 0;

  const updatedProducts = allProducts.map((product) => {
    const isTarget = applyToCatalog || normalizeSkuKey(product.sku) === normalizeSkuKey(requestedProduct?.sku ?? "");
    if (!isTarget) return product;

    const candidates = rowsBySku.get(normalizeSkuKey(product.sku)) ?? [];
    if (candidates.length === 0) {
      unmatchedRowCount += 1;
      return withBackfillJob(product, {
        ...activeJob,
        status: "no_matching_rows",
        rowCount: rows.length,
        appliedSkuCount,
      });
    }

    matchedRowCount += candidates.length;
    const selectedRow = pickBestRow(candidates);
    if (!selectedRow) {
      unmatchedRowCount += 1;
      return product;
    }

    const merged = applyRowToProduct({
      product,
      row: selectedRow,
      now,
    });

    if (merged.changed) {
      appliedSkuCount += 1;
      appliedFields.push(...merged.diagnostics);
    }

    const finalJob: WalmartItemReportBackfillJob = {
      ...activeJob,
      status: merged.changed ? "applied" : "applied_with_warnings",
      rowCount: rows.length,
      appliedSkuCount,
      appliedAt: now,
      downloadedAt: activeJob.downloadedAt ?? now,
      reportContent,
      reportContentType,
      warningCount: duplicateSkuCount,
      diagnostics: [
        ...activeJob.diagnostics,
        ...(duplicateSkuCount > 0
          ? [
              {
                code: "duplicate_sku_rows",
                message: `${duplicateSkuCount} SKU(s) had duplicate ITEM report rows; deterministic row selection applied.`,
                source: "backfill",
                level: "warning",
              } satisfies WalmartItemReportBackfillDiagnostic,
            ]
          : []),
      ],
    };

    const updated = withBackfillJob(merged.product, finalJob);
    freshnessBySku[updated.sku] = buildWalmartDocketFreshnessSummary({ product: updated });
    return updated;
  });

  await persistProductsWithImportTimestamp({
    userId: input.userId,
    products: updatedProducts,
  });

  const updatedProduct = !applyToCatalog
    ? updatedProducts.find((entry) => normalizeSkuKey(entry.sku) === normalizeSkuKey(requestedProduct?.sku ?? "")) ?? null
    : null;

  const status: WalmartItemReportBackfillStatus =
    appliedSkuCount === 0
      ? "no_matching_rows"
      : duplicateSkuCount > 0 || appliedFields.some((entry) => entry.action === "kept_user_edit" || entry.action === "kept_item_detail")
      ? "applied_with_warnings"
      : "applied";

  const finalJob: WalmartItemReportBackfillJob = {
    ...activeJob,
    status,
    rowCount: rows.length,
    appliedSkuCount,
    appliedAt: now,
    downloadedAt: activeJob.downloadedAt ?? now,
    warningCount: duplicateSkuCount,
    diagnostics: [
      ...activeJob.diagnostics,
      ...(appliedSkuCount === 0
        ? [
            {
              code: "no_matching_rows",
              message: "No matching ITEM report rows were found for the selected products.",
              source: "backfill",
              level: "warning",
            } satisfies WalmartItemReportBackfillDiagnostic,
          ]
        : []),
    ],
  };

  return {
    status,
    rowCount: rows.length,
    appliedSkuCount,
    warningCount: finalJob.warningCount,
    errorCount: finalJob.errorCount,
    source: finalJob.source,
    credentialMode: finalJob.credentialMode,
    diagnostics: [...finalJob.diagnostics],
    job: finalJob,
    matchedRowCount,
    unmatchedRowCount,
    duplicateSkuCount,
    appliedFields,
    freshnessBySku,
    updatedProduct,
  };
}

export function getWalmartItemReportBackfillJobFromProduct(product: WalmartProductRecord): WalmartItemReportBackfillJob {
  return backfillJobFromProduct(product);
}

export function getWalmartDocketFreshnessSummaryForProduct(product: WalmartProductRecord): WalmartDocketFreshnessSummary {
  return buildWalmartDocketFreshnessSummary({ product });
}

export type {
  WalmartDocketFreshnessSummary,
  WalmartDocketFieldFreshness,
  WalmartItemReportBackfillStatus,
  WalmartItemReportBackfillDiagnostic,
  WalmartItemReportBackfillRequest,
  WalmartItemReportProvider,
};
