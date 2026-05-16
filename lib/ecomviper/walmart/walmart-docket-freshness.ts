import type { WalmartNormalizedDocket } from "@/lib/ecomviper/walmart/walmart-docket";
import type { WalmartDocketFieldSource } from "@/lib/ecomviper/walmart/walmart-docket-source-metadata";
import type { WalmartProductRecord } from "@/lib/ecomviper/walmart/walmart-types";

export type WalmartDocketFreshnessStatus =
  | "fresh"
  | "stale"
  | "missing"
  | "pending_report"
  | "report_ready"
  | "report_failed"
  | "unknown";

export type WalmartItemReportBackfillStatus =
  | "not_requested"
  | "request_blocked_no_credentials"
  | "request_blocked_cooldown"
  | "request_failed"
  | "requested"
  | "submitted"
  | "in_progress"
  | "ready"
  | "download_failed"
  | "downloaded"
  | "parse_failed"
  | "applied"
  | "applied_with_warnings"
  | "no_matching_rows"
  | "expired"
  | "unavailable";

export interface WalmartDocketFieldFreshness {
  field: string;
  status: WalmartDocketFreshnessStatus;
  source: WalmartDocketFieldSource | "unknown";
  retrievedAt: string | null;
  updatedAt: string | null;
}

export interface WalmartDocketFreshnessSectionSummary {
  section: "content" | "media" | "pricing_inventory" | "search_browse";
  status: WalmartDocketFreshnessStatus;
  lastUpdatedAt: string | null;
  populatedCount: number;
  totalCount: number;
  coveragePercent: number;
}

export interface WalmartDocketFreshnessSummary {
  overallStatus: WalmartDocketFreshnessStatus;
  importListFreshness: WalmartDocketFreshnessStatus;
  itemDetailFreshness: WalmartDocketFreshnessStatus;
  itemReportFreshness: WalmartDocketFreshnessStatus;
  sections: WalmartDocketFreshnessSectionSummary[];
  fields: WalmartDocketFieldFreshness[];
  reportBackfillStatus: WalmartItemReportBackfillStatus;
  reportRequestedAt: string | null;
  reportDownloadedAt: string | null;
  reportAppliedAt: string | null;
  lastReportRequestId: string | null;
}

const STALE_AFTER_MS = 1000 * 60 * 60 * 24 * 14;
const NON_MEANINGFUL = new Set(["", "unknown", "not available", "n/a", "na", "none", "null", "undefined"]);

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

function backfillStatusToFreshness(status: WalmartItemReportBackfillStatus): WalmartDocketFreshnessStatus {
  if (["requested", "submitted", "in_progress", "downloaded"].includes(status)) return "pending_report";
  if (status === "ready") return "report_ready";
  if (
    [
      "request_blocked_no_credentials",
      "request_blocked_cooldown",
      "request_failed",
      "download_failed",
      "parse_failed",
      "expired",
      "unavailable",
    ].includes(status)
  ) {
    return "report_failed";
  }
  if (["applied", "applied_with_warnings"].includes(status)) return "fresh";
  if (status === "no_matching_rows") return "missing";
  return "unknown";
}

function computeFieldStatus(input: {
  meaningful: boolean;
  newestAt: number | null;
  reportFreshness: WalmartDocketFreshnessStatus;
  nowMs: number;
}): WalmartDocketFreshnessStatus {
  if (!input.meaningful) {
    if (input.reportFreshness === "pending_report") return "pending_report";
    if (input.reportFreshness === "report_ready") return "report_ready";
    if (input.reportFreshness === "report_failed") return "report_failed";
    return "missing";
  }

  if (typeof input.newestAt === "number") {
    if (input.nowMs - input.newestAt > STALE_AFTER_MS) return "stale";
    return "fresh";
  }

  return "unknown";
}

function normalizeBackfillStatus(value: unknown): WalmartItemReportBackfillStatus {
  const text = asText(value);
  const allowed: WalmartItemReportBackfillStatus[] = [
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
  ];
  return allowed.includes(text as WalmartItemReportBackfillStatus)
    ? (text as WalmartItemReportBackfillStatus)
    : "not_requested";
}

export function buildWalmartDocketFreshnessSummary(input: {
  product: WalmartProductRecord;
  now?: string;
}): WalmartDocketFreshnessSummary {
  const docket = input.product.docket;
  const nowMs = parseIso(input.now ?? new Date().toISOString()) ?? Date.now();
  const normalizedPayload = asObject(input.product.normalizedPayload) ?? {};
  const backfill = asObject(normalizedPayload.itemReportBackfill) ?? {};
  const reportBackfillStatus = normalizeBackfillStatus(backfill.status);
  const reportFreshness = backfillStatusToFreshness(reportBackfillStatus);

  const fields: WalmartDocketFieldFreshness[] = [];

  function pushField(field: string, sourceField: Record<string, unknown> | undefined) {
    const value = sourceField?.value;
    const source = (asText(sourceField?.source) || "unknown") as WalmartDocketFieldSource | "unknown";
    const retrievedAt = asText(sourceField?.retrievedAt) || null;
    const updatedAt = asText(sourceField?.updatedAt) || null;
    const newestAt = parseIso(updatedAt) ?? parseIso(retrievedAt);
    fields.push({
      field,
      status: computeFieldStatus({
        meaningful: isMeaningful(value),
        newestAt,
        reportFreshness,
        nowMs,
      }),
      source,
      retrievedAt,
      updatedAt,
    });
  }

  const sections: WalmartDocketFreshnessSectionSummary[] = [];

  function finalizeSection(section: WalmartDocketFreshnessSectionSummary["section"], prefix: string) {
    const entries = fields.filter((entry) => entry.field.startsWith(prefix));
    const populatedCount = entries.filter((entry) => entry.status !== "missing").length;
    const totalCount = entries.length;
    const coveragePercent = totalCount > 0 ? Math.round((populatedCount / totalCount) * 100) : 0;
    const hasFresh = entries.some((entry) => entry.status === "fresh");
    const hasStale = entries.some((entry) => entry.status === "stale");
    const hasPending = entries.some((entry) => entry.status === "pending_report");
    const hasReady = entries.some((entry) => entry.status === "report_ready");
    const hasFailed = entries.some((entry) => entry.status === "report_failed");
    const lastUpdatedAt = entries
      .map((entry) => entry.updatedAt || entry.retrievedAt)
      .filter((entry): entry is string => Boolean(entry))
      .sort((a, b) => (Date.parse(b) || 0) - (Date.parse(a) || 0))[0] ?? null;

    let status: WalmartDocketFreshnessStatus = "unknown";
    if (hasFresh) status = "fresh";
    else if (hasStale) status = "stale";
    else if (hasPending) status = "pending_report";
    else if (hasReady) status = "report_ready";
    else if (hasFailed) status = "report_failed";
    else if (populatedCount === 0) status = "missing";

    sections.push({
      section,
      status,
      lastUpdatedAt,
      populatedCount,
      totalCount,
      coveragePercent,
    });
  }

  function collectFieldsFromDocket(sourceDocket: WalmartNormalizedDocket | undefined) {
    if (!sourceDocket) return;

    pushField("content.title", asObject(sourceDocket.content.title) ?? undefined);
    pushField("content.shortDescription", asObject(sourceDocket.content.shortDescription) ?? undefined);
    pushField("content.longDescription", asObject(sourceDocket.content.longDescription) ?? undefined);
    pushField("content.bullets", asObject(sourceDocket.content.bullets) ?? undefined);
    pushField("content.brand", asObject(sourceDocket.content.brand) ?? undefined);

    pushField("media.primaryImage", asObject(sourceDocket.media.primaryImage) ?? undefined);
    pushField("media.galleryImages", asObject(sourceDocket.media.galleryImages) ?? undefined);
    pushField("media.publicListingUrl", asObject(sourceDocket.media.publicListingUrl) ?? undefined);

    pushField("pricing_inventory.price", asObject(sourceDocket.pricingInventory.price) ?? undefined);
    pushField("pricing_inventory.salePrice", asObject(sourceDocket.pricingInventory.salePrice) ?? undefined);
    pushField(
      "pricing_inventory.inventoryQuantity",
      asObject(sourceDocket.pricingInventory.inventoryQuantity) ?? undefined
    );
    pushField(
      "pricing_inventory.inventoryStatus",
      asObject(sourceDocket.pricingInventory.inventoryStatus) ?? undefined
    );

    pushField("search_browse.productType", asObject(sourceDocket.searchBrowse.productType) ?? undefined);
    pushField("search_browse.category", asObject(sourceDocket.searchBrowse.category) ?? undefined);
    pushField("search_browse.gtin", asObject(sourceDocket.searchBrowse.gtin) ?? undefined);
    pushField("search_browse.upc", asObject(sourceDocket.searchBrowse.upc) ?? undefined);
    pushField("search_browse.attributes", asObject(sourceDocket.searchBrowse.attributes) ?? undefined);
  }

  collectFieldsFromDocket(docket);
  finalizeSection("content", "content.");
  finalizeSection("media", "media.");
  finalizeSection("pricing_inventory", "pricing_inventory.");
  finalizeSection("search_browse", "search_browse.");

  const itemDetailFreshness = fields
    .filter((entry) => entry.source === "item_detail")
    .some((entry) => entry.status === "fresh")
    ? "fresh"
    : fields.filter((entry) => entry.source === "item_detail").length > 0
      ? "stale"
      : "missing";
  const importListFreshness = fields
    .filter((entry) => entry.source === "items_list")
    .some((entry) => entry.status === "fresh")
    ? "fresh"
    : fields.filter((entry) => entry.source === "items_list").length > 0
      ? "stale"
      : "missing";

  const sectionStatusPriority: WalmartDocketFreshnessStatus[] = [
    "report_failed",
    "stale",
    "pending_report",
    "report_ready",
    "fresh",
    "missing",
    "unknown",
  ];
  const overallStatus =
    sectionStatusPriority.find((status) => sections.some((entry) => entry.status === status)) ?? "unknown";

  return {
    overallStatus,
    importListFreshness,
    itemDetailFreshness,
    itemReportFreshness: reportFreshness,
    sections,
    fields,
    reportBackfillStatus,
    reportRequestedAt: asText(backfill.requestedAt) || null,
    reportDownloadedAt: asText(backfill.downloadedAt) || null,
    reportAppliedAt: asText(backfill.appliedAt) || null,
    lastReportRequestId: asText(backfill.requestId) || null,
  };
}
