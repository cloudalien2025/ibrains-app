import { normalizeSearchBrowseAttributes } from "@/lib/ecomviper/walmart/walmart-search-browse-attributes";

export type WalmartAiAttributeSkipReason =
  | "protected_field"
  | "not_allowlisted"
  | "low_confidence";

export interface WalmartAiAttributeSkip {
  key: string;
  reason: WalmartAiAttributeSkipReason;
}

const DEFAULT_SEARCH_BROWSE_ALLOWLIST = new Set([
  "brand",
  "manufacturer",
  "age_group",
  "target_audience",
  "directions_suggested_use",
  "safety_warnings",
  "assembled_product_depth",
  "assembled_product_height",
  "assembled_product_width",
  "count",
  "count_per_pack",
  "allergen_free_statements",
  "support_areas",
  "supplement_type",
  "product_form",
  "flavor",
  "main_ingredients",
  "ingredients_list",
  "serving_size",
  "servings_per_container",
  "search_keywords",
  "search_terms",
  "suggested_use",
  "product_name",
  "dosage_strength",
  "count_per_package",
  "servings",
  "form",
  "category",
  "keywords",
  "browse_path",
  "category_path",
  "walmart_category",
  "department",
  "subcategory",
  "product_type",
]);

const PROTECTED_AI_FIELD_KEYS = new Set([
  "sku",
  "upc",
  "gtin",
  "barcode",
  "wpid",
  "item_id",
  "itemid",
  "external_item_id",
  "public_walmart_url",
  "public_walmart_product_id",
  "price",
  "inventory",
  "inventory_quantity",
  "image_url",
  "primary_image_url",
  "additional_image_urls",
  "gallery_image_urls",
  "variant_image_urls",
]);

export function normalizeWalmartAiFieldKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function isLowConfidenceAiFieldValue(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;

  if (/^(unknown|n\/a|na|none|null|undefined|tbd)$/i.test(trimmed)) return true;
  if (/^(not provided|not available|unsure)$/i.test(trimmed)) return true;
  if (/needs\s+(product\s+label|confirmation|review)/i.test(trimmed)) return true;

  return false;
}

export function pickMeaningfulAiText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || isLowConfidenceAiFieldValue(trimmed)) return null;
  return trimmed;
}

function isGenericSearchBrowseKey(key: string): boolean {
  return /^[a-z][a-z0-9_]{1,63}$/.test(key);
}

function toCandidateText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (Array.isArray(value)) {
    return value
      .map((entry) => toCandidateText(entry))
      .filter(Boolean)
      .join(", ")
      .trim();
  }
  if (value && typeof value === "object") {
    const row = value as Record<string, unknown>;
    return (
      toCandidateText(row.value) ||
      toCandidateText(row.label) ||
      toCandidateText(row.name) ||
      toCandidateText(row.text)
    );
  }
  return "";
}

export function sanitizeWalmartAiSearchBrowseAttributes(input: {
  candidates: Record<string, unknown>;
  existingKeys?: Iterable<string>;
  allowlistKeys?: Iterable<string>;
}): {
  accepted: Record<string, string>;
  skipped: WalmartAiAttributeSkip[];
} {
  const normalizedCandidates = normalizeSearchBrowseAttributes(input.candidates);
  const existingKeys = new Set(
    Array.from(input.existingKeys ?? []).map((entry) =>
      normalizeWalmartAiFieldKey(entry)
    )
  );
  const allowlist = new Set(DEFAULT_SEARCH_BROWSE_ALLOWLIST);
  for (const entry of input.allowlistKeys ?? []) {
    const normalized = normalizeWalmartAiFieldKey(entry);
    if (normalized) allowlist.add(normalized);
  }

  const accepted: Record<string, string> = {};
  const skipped: WalmartAiAttributeSkip[] = [];
  const lowConfidenceFromRaw: WalmartAiAttributeSkip[] = [];

  for (const [rawKey, rawValue] of Object.entries(input.candidates ?? {})) {
    const key = normalizeWalmartAiFieldKey(rawKey);
    if (!key) continue;
    const value = toCandidateText(rawValue);
    if (!value) continue;
    if (isLowConfidenceAiFieldValue(value)) {
      lowConfidenceFromRaw.push({ key, reason: "low_confidence" });
    }
  }

  for (const [rawKey, rawValue] of Object.entries(normalizedCandidates)) {
    const key = normalizeWalmartAiFieldKey(rawKey);
    const value = String(rawValue ?? "").trim();
    if (!key) continue;

    if (PROTECTED_AI_FIELD_KEYS.has(key)) {
      skipped.push({ key, reason: "protected_field" });
      continue;
    }

    if (!allowlist.has(key) && !existingKeys.has(key) && !isGenericSearchBrowseKey(key)) {
      skipped.push({ key, reason: "not_allowlisted" });
      continue;
    }

    if (isLowConfidenceAiFieldValue(value)) {
      skipped.push({ key, reason: "low_confidence" });
      continue;
    }

    accepted[key] = value;
  }

  for (const entry of lowConfidenceFromRaw) {
    if (accepted[entry.key]) continue;
    if (skipped.some((existing) => existing.key === entry.key)) continue;
    skipped.push(entry);
  }

  return { accepted, skipped };
}
