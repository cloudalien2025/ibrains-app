import "server-only";

import crypto from "crypto";
import type { WalmartDraftRecord, WalmartDraftStatus, WalmartProductRecord } from "@/lib/ecomviper/walmart/walmart-types";
import { evaluateWalmartListingCompliance } from "@/lib/ecomviper/walmart/walmart-compliance";

export interface DraftDiffItem {
  field: string;
  before: unknown;
  after: unknown;
}

export function buildDraftDiff(
  original: Partial<WalmartProductRecord>,
  draftPayload: Record<string, unknown>
): DraftDiffItem[] {
  return Object.entries(draftPayload)
    .map(([field, after]) => ({
      field,
      before: (original as Record<string, unknown>)[field],
      after,
    }))
    .filter((item) => JSON.stringify(item.before) !== JSON.stringify(item.after));
}

export function summarizeDraftChanges(diff: DraftDiffItem[]): string {
  if (!diff.length) return "No material changes";
  const fields = diff.map((item) => item.field);
  return `${fields.length} change${fields.length === 1 ? "" : "s"}: ${fields.join(", ")}`;
}

export function validateDraftPayload(draftPayload: Record<string, unknown>): {
  status: WalmartDraftStatus;
  valid: boolean;
  violations: string[];
  warnings: string[];
  suggestions: string[];
} {
  const violations: string[] = [];
  const warnings: string[] = [];
  const title = typeof draftPayload.title === "string" ? draftPayload.title.trim() : "";
  const price = typeof draftPayload.price === "number" ? draftPayload.price : Number.NaN;
  const inventory =
    typeof draftPayload.inventoryQuantity === "number"
      ? draftPayload.inventoryQuantity
      : typeof draftPayload.inventory === "number"
        ? draftPayload.inventory
        : Number.NaN;

  if (!title) violations.push("Title cannot be empty.");
  if (!Number.isFinite(price) || price <= 0) violations.push("Price must be greater than zero.");
  if (!Number.isFinite(inventory) || inventory < 0) violations.push("Inventory must be zero or greater.");

  const imageUrl = typeof draftPayload.imageUrl === "string" ? draftPayload.imageUrl.trim() : null;
  if (imageUrl !== null && !imageUrl) {
    violations.push("Primary image URL cannot be empty.");
  } else if (imageUrl && !/^https?:\/\//i.test(imageUrl)) {
    warnings.push("Primary image URL should use an http/https URL.");
  }

  const compliance = evaluateWalmartListingCompliance(draftPayload);
  const mergedViolations = Array.from(new Set([...violations, ...compliance.violations]));
  const mergedWarnings = Array.from(new Set([...warnings, ...compliance.warnings]));

  if (mergedViolations.length) {
    return {
      status: "failed",
      valid: false,
      violations: mergedViolations,
      warnings: mergedWarnings,
      suggestions: compliance.suggestions,
    };
  }

  return {
    status: "validated",
    valid: true,
    violations: mergedViolations,
    warnings: mergedWarnings,
    suggestions: compliance.suggestions,
  };
}

export function createDraftRecord(params: {
  sku: string;
  title: string;
  productId: string;
  draftPayload: Record<string, unknown>;
  changeSummary: string;
  createdBy?: string | null;
  status?: WalmartDraftStatus;
  validationResult?: {
    valid: boolean;
    violations?: string[];
    warnings: string[];
    suggestions?: string[];
  };
}): WalmartDraftRecord {
  const now = new Date().toISOString();
  return {
    id: `ev_draft_${crypto.randomUUID()}`,
    productId: params.productId,
    marketplace: "walmart",
    sku: params.sku,
    productTitle: params.title,
    draftPayload: params.draftPayload,
    changeSummary: params.changeSummary,
    createdBy: params.createdBy ?? "operator",
    status: params.status ?? "draft",
    validationResult: params.validationResult ?? {
      valid: false,
      violations: ["Not validated"],
      warnings: ["Not validated"],
      suggestions: [],
    },
    publishStatus: params.status === "synced" ? "synced" : "pending",
    createdAt: now,
    updatedAt: now,
  };
}
