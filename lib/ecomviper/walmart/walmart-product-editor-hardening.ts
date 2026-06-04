import type { WalmartDraftRecord } from "@/lib/ecomviper/walmart/walmart-types";

type DraftStatus = WalmartDraftRecord["status"];
type DraftPublishStatus = WalmartDraftRecord["publishStatus"];

const ALLOWED_DRAFT_STATUSES = new Set<DraftStatus>([
  "draft",
  "validated",
  "submitted",
  "failed",
  "synced",
  "discarded",
]);

const ALLOWED_PUBLISH_STATUSES = new Set<DraftPublishStatus>([
  "pending",
  "submitted",
  "failed",
  "synced",
]);

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

function asTextArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => asText(entry))
    .filter((entry) => entry.length > 0);
}

function asIsoTimestamp(value: unknown): string {
  const candidate = asText(value);
  if (!candidate) return "";
  const epoch = Date.parse(candidate);
  if (Number.isNaN(epoch)) return "";
  return new Date(epoch).toISOString();
}

function asValidationResult(value: unknown): WalmartDraftRecord["validationResult"] {
  const row = asObject(value);
  const warnings = asTextArray(row?.warnings);
  const violations = asTextArray(row?.violations);
  const suggestions = asTextArray(row?.suggestions);
  const valid = typeof row?.valid === "boolean" ? row.valid : violations.length === 0;

  return {
    valid,
    warnings,
    violations,
    suggestions,
  };
}

function asDraftStatus(value: unknown): DraftStatus {
  const status = asText(value) as DraftStatus;
  return ALLOWED_DRAFT_STATUSES.has(status) ? status : "draft";
}

function asPublishStatus(value: unknown): DraftPublishStatus {
  const status = asText(value) as DraftPublishStatus;
  return ALLOWED_PUBLISH_STATUSES.has(status) ? status : "pending";
}

function asDraftPayload(value: unknown): Record<string, unknown> {
  const payload = asObject(value);
  if (!payload) return {};
  return { ...payload };
}

function asSku(value: unknown): string {
  return asText(value).toUpperCase();
}

function hasAnyRepair(before: Partial<WalmartDraftRecord>, after: WalmartDraftRecord): boolean {
  return (
    asText(before.id) !== after.id ||
    asSku(before.sku) !== after.sku ||
    asText(before.productTitle) !== after.productTitle ||
    asDraftStatus(before.status) !== after.status ||
    asPublishStatus(before.publishStatus) !== after.publishStatus ||
    asIsoTimestamp(before.createdAt) !== after.createdAt ||
    asIsoTimestamp(before.updatedAt) !== after.updatedAt ||
    asText(before.changeSummary) !== after.changeSummary ||
    asText(before.createdBy) !== after.createdBy ||
    asObject(before.draftPayload) === null ||
    asObject(before.validationResult) === null
  );
}

export interface WalmartDraftHardeningDiagnostics {
  repairedCount: number;
  droppedCount: number;
  warnings: string[];
}

export function normalizeWalmartDraftsForEditor(
  drafts: unknown
): { drafts: WalmartDraftRecord[]; diagnostics: WalmartDraftHardeningDiagnostics } {
  const now = new Date().toISOString();
  const warnings: string[] = [];
  let repairedCount = 0;
  let droppedCount = 0;

  const inputRows = Array.isArray(drafts) ? drafts : [];
  const normalized: WalmartDraftRecord[] = [];
  for (let index = 0; index < inputRows.length; index += 1) {
    const rawRow = asObject(inputRows[index]);
    if (!rawRow) {
      droppedCount += 1;
      warnings.push(`draft[${index}] dropped: not an object`);
      continue;
    }

    const sku = asSku(rawRow.sku);
    if (!sku) {
      droppedCount += 1;
      warnings.push(`draft[${index}] dropped: missing sku`);
      continue;
    }

    const updatedAt = asIsoTimestamp(rawRow.updatedAt) || asIsoTimestamp(rawRow.createdAt) || now;
    const createdAt = asIsoTimestamp(rawRow.createdAt) || updatedAt;
    const normalizedDraft: WalmartDraftRecord = {
      id: asText(rawRow.id) || `legacy_draft_${sku}_${index}`,
      productId: asText(rawRow.productId) || `legacy_product_${sku}`,
      marketplace: "walmart",
      sku,
      productTitle: asText(rawRow.productTitle) || sku,
      draftPayload: asDraftPayload(rawRow.draftPayload),
      changeSummary: asText(rawRow.changeSummary) || "Legacy draft loaded",
      createdBy: asText(rawRow.createdBy) || "unknown",
      status: asDraftStatus(rawRow.status),
      validationResult: asValidationResult(rawRow.validationResult),
      publishStatus: asPublishStatus(rawRow.publishStatus),
      createdAt,
      updatedAt,
    };

    if (hasAnyRepair(rawRow as Partial<WalmartDraftRecord>, normalizedDraft)) {
      repairedCount += 1;
      warnings.push(`draft[${index}] normalized`);
    }

    normalized.push(normalizedDraft);
  }

  return {
    drafts: normalized,
    diagnostics: {
      repairedCount,
      droppedCount,
      warnings: warnings.slice(0, 25),
    },
  };
}

export function compareDraftUpdatedAtDesc(
  left: Pick<WalmartDraftRecord, "updatedAt">,
  right: Pick<WalmartDraftRecord, "updatedAt">
): number {
  const leftEpoch = Date.parse(asText(left.updatedAt));
  const rightEpoch = Date.parse(asText(right.updatedAt));
  const leftSafe = Number.isNaN(leftEpoch) ? 0 : leftEpoch;
  const rightSafe = Number.isNaN(rightEpoch) ? 0 : rightEpoch;
  return rightSafe - leftSafe;
}

