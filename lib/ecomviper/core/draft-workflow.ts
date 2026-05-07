import "server-only";

import crypto from "crypto";
import type { WalmartDraftRecord, WalmartDraftStatus, WalmartProductRecord } from "@/lib/ecomviper/walmart/walmart-types";

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
  warnings: string[];
} {
  const warnings: string[] = [];
  const title = typeof draftPayload.title === "string" ? draftPayload.title.trim() : "";
  const price = typeof draftPayload.price === "number" ? draftPayload.price : Number.NaN;
  const inventory =
    typeof draftPayload.inventoryQuantity === "number"
      ? draftPayload.inventoryQuantity
      : typeof draftPayload.inventory === "number"
        ? draftPayload.inventory
        : Number.NaN;

  if (!title) warnings.push("Title is empty");
  if (title.length > 200) warnings.push("Title exceeds Walmart recommended length");
  if (!Number.isFinite(price) || price <= 0) warnings.push("Price must be greater than zero");
  if (!Number.isFinite(inventory) || inventory < 0) warnings.push("Inventory must be zero or greater");

  if (warnings.length) {
    return {
      status: "failed",
      valid: false,
      warnings,
    };
  }

  return {
    status: "validated",
    valid: true,
    warnings,
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
  validationResult?: { valid: boolean; warnings: string[] };
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
      warnings: ["Not validated"],
    },
    publishStatus: params.status === "synced" ? "synced" : "pending",
    createdAt: now,
    updatedAt: now,
  };
}
