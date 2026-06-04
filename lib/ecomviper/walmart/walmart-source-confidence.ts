import type { WalmartCatalogMatchConfidence } from "@/lib/ecomviper/walmart/walmart-catalog-candidate-scoring";

export type WalmartFieldSourceLabel =
  | "seller_native"
  | "walmart_item_api"
  | "walmart_item_search"
  | "walmart_public_catalog"
  | "serpapi_public_listing"
  | "shopify_import_snapshot"
  | "user_draft"
  | "fallback"
  | "unknown";

export type WalmartCatalogBackfillFieldAction =
  | "kept_seller_native"
  | "filled_missing"
  | "replaced_placeholder"
  | "skipped_lower_confidence"
  | "skipped_conflict"
  | "skipped_user_edited";

export interface WalmartCatalogBackfillFieldSource {
  field: string;
  source: WalmartFieldSourceLabel;
  confidence: WalmartCatalogMatchConfidence;
  note: string;
}

export interface WalmartCatalogBackfillFieldPatch {
  field: string;
  currentValue: string | number | string[] | null;
  proposedValue: string | number | string[] | null;
  currentSource: WalmartFieldSourceLabel;
  proposedSource: WalmartFieldSourceLabel;
  confidence: WalmartCatalogMatchConfidence;
  action: WalmartCatalogBackfillFieldAction;
  explanation: string;
}

export interface WalmartCatalogBackfillSourceConfidence {
  overallConfidence: WalmartCatalogMatchConfidence;
  totalFields: number;
  actionableFields: number;
  byAction: Record<WalmartCatalogBackfillFieldAction, number>;
  byConfidence: Record<WalmartCatalogMatchConfidence, number>;
}

function isMeaningfulText(value: unknown): boolean {
  if (typeof value === "number" && Number.isFinite(value)) return true;
  if (Array.isArray(value)) {
    return value.some((entry) => isMeaningfulText(entry));
  }
  if (typeof value !== "string") return false;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return false;
  return !new Set(["unknown", "not available", "n/a", "na", "none", "null", "undefined"]).has(normalized);
}

function isPlaceholderValue(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const normalized = value.trim().toLowerCase();
  return new Set(["unknown", "not available", "n/a", "na", "none", "null", "undefined"]).has(normalized);
}

function normalizeForCompare(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (Array.isArray(value)) {
    return value
      .map((entry) => normalizeForCompare(entry))
      .filter(Boolean)
      .join("|");
  }
  if (typeof value === "string") return value.trim().toLowerCase();
  return "";
}

export function classifyWalmartFieldSourceConfidence(input: {
  field: string;
  currentValue: string | number | string[] | null;
  currentSource: WalmartFieldSourceLabel;
  proposedValue: string | number | string[] | null;
  proposedSource: WalmartFieldSourceLabel;
  candidateConfidence: WalmartCatalogMatchConfidence;
  sellerNativePresent: boolean;
  userEdited: boolean;
}): WalmartCatalogBackfillFieldPatch {
  if (input.userEdited) {
    return {
      field: input.field,
      currentValue: input.currentValue,
      proposedValue: input.proposedValue,
      currentSource: "user_draft",
      proposedSource: input.proposedSource,
      confidence: input.candidateConfidence,
      action: "skipped_user_edited",
      explanation: "Skipped because a user-edited draft value exists.",
    };
  }

  if (input.sellerNativePresent && isMeaningfulText(input.currentValue)) {
    return {
      field: input.field,
      currentValue: input.currentValue,
      proposedValue: input.proposedValue,
      currentSource: "seller_native",
      proposedSource: input.proposedSource,
      confidence: input.candidateConfidence,
      action: "kept_seller_native",
      explanation: "Kept seller-native value because it is already populated.",
    };
  }

  const currentComparable = normalizeForCompare(input.currentValue);
  const proposedComparable = normalizeForCompare(input.proposedValue);
  if (!proposedComparable) {
    return {
      field: input.field,
      currentValue: input.currentValue,
      proposedValue: input.proposedValue,
      currentSource: input.currentSource,
      proposedSource: input.proposedSource,
      confidence: input.candidateConfidence,
      action: "skipped_lower_confidence",
      explanation: "No usable candidate value was available.",
    };
  }

  if (!currentComparable) {
    return {
      field: input.field,
      currentValue: input.currentValue,
      proposedValue: input.proposedValue,
      currentSource: input.currentSource,
      proposedSource: input.proposedSource,
      confidence: input.candidateConfidence,
      action: "filled_missing",
      explanation: "Filled missing field from catalog/public source.",
    };
  }

  if (isPlaceholderValue(input.currentValue)) {
    return {
      field: input.field,
      currentValue: input.currentValue,
      proposedValue: input.proposedValue,
      currentSource: input.currentSource,
      proposedSource: input.proposedSource,
      confidence: input.candidateConfidence,
      action: "replaced_placeholder",
      explanation: "Replaced placeholder with catalog/public value.",
    };
  }

  if (currentComparable !== proposedComparable) {
    return {
      field: input.field,
      currentValue: input.currentValue,
      proposedValue: input.proposedValue,
      currentSource: input.currentSource,
      proposedSource: input.proposedSource,
      confidence: input.candidateConfidence,
      action: "skipped_conflict",
      explanation: "Skipped due to conflict with existing non-placeholder value.",
    };
  }

  return {
    field: input.field,
    currentValue: input.currentValue,
    proposedValue: input.proposedValue,
    currentSource: input.currentSource,
    proposedSource: input.proposedSource,
    confidence: input.candidateConfidence,
    action: "skipped_lower_confidence",
    explanation: "Existing value already matches candidate value.",
  };
}

export function buildWalmartSourceConfidenceRows(input: {
  fieldPatches: WalmartCatalogBackfillFieldPatch[];
}): WalmartCatalogBackfillFieldPatch[] {
  return [...input.fieldPatches].sort((left, right) => left.field.localeCompare(right.field));
}

export function summarizeWalmartSourceConfidence(input: {
  fieldPatches: WalmartCatalogBackfillFieldPatch[];
  overallConfidence?: WalmartCatalogMatchConfidence;
}): WalmartCatalogBackfillSourceConfidence {
  const byAction: Record<WalmartCatalogBackfillFieldAction, number> = {
    kept_seller_native: 0,
    filled_missing: 0,
    replaced_placeholder: 0,
    skipped_lower_confidence: 0,
    skipped_conflict: 0,
    skipped_user_edited: 0,
  };
  const byConfidence: Record<WalmartCatalogMatchConfidence, number> = {
    exact: 0,
    strong: 0,
    moderate: 0,
    weak: 0,
    none: 0,
  };

  for (const patch of input.fieldPatches) {
    byAction[patch.action] += 1;
    byConfidence[patch.confidence] += 1;
  }

  const actionableFields =
    byAction.filled_missing + byAction.replaced_placeholder + byAction.kept_seller_native;
  const totalFields = input.fieldPatches.length;

  let overallConfidence: WalmartCatalogMatchConfidence =
    input.overallConfidence ??
    (byConfidence.exact > 0
      ? "exact"
      : byConfidence.strong > 0
        ? "strong"
        : byConfidence.moderate > 0
          ? "moderate"
          : byConfidence.weak > 0
            ? "weak"
            : "none");

  if (totalFields === 0) {
    overallConfidence = input.overallConfidence ?? "none";
  }

  return {
    overallConfidence,
    totalFields,
    actionableFields,
    byAction,
    byConfidence,
  };
}
