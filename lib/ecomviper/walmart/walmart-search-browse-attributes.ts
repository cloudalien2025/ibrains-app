import type { WalmartProductRecord } from "@/lib/ecomviper/walmart/walmart-types";

export type WalmartSearchBrowseFieldType =
  | "text"
  | "textarea"
  | "select"
  | "multi-select"
  | "number-unit";

export interface WalmartSearchBrowseFieldDefinition {
  key: string;
  label: string;
  type: WalmartSearchBrowseFieldType;
  group:
    | "product_identity"
    | "audience_usage"
    | "ingredients_form"
    | "dimensions_packaging"
    | "search_browse_metadata";
  placeholder?: string;
  options?: string[];
  helperText?: string;
}

const MULTI_VALUE_DELIMITER = ", ";

const BASE_FIELDS: WalmartSearchBrowseFieldDefinition[] = [
  {
    key: "brand",
    label: "Brand",
    type: "text",
    group: "product_identity",
    placeholder: "Brand",
  },
  {
    key: "manufacturer",
    label: "Manufacturer",
    type: "text",
    group: "product_identity",
    placeholder: "Manufacturer",
  },
  {
    key: "age_group",
    label: "Age Group",
    type: "select",
    group: "audience_usage",
    options: ["Adult", "Teen", "Child", "Senior", "All Ages"],
  },
  {
    key: "target_audience",
    label: "Target Audience",
    type: "multi-select",
    group: "audience_usage",
    placeholder: "Adults, active lifestyle",
  },
  {
    key: "directions_suggested_use",
    label: "Directions / Suggested Use",
    type: "textarea",
    group: "audience_usage",
    placeholder: "Use exactly as listed on product label.",
  },
  {
    key: "safety_warnings",
    label: "Safety / Warnings",
    type: "textarea",
    group: "audience_usage",
    placeholder: "Warnings from label",
  },
  {
    key: "assembled_product_depth",
    label: "Assembled Product Depth",
    type: "number-unit",
    group: "dimensions_packaging",
    placeholder: "4.0 in",
  },
  {
    key: "assembled_product_height",
    label: "Assembled Product Height",
    type: "number-unit",
    group: "dimensions_packaging",
    placeholder: "6.0 in",
  },
  {
    key: "assembled_product_width",
    label: "Assembled Product Width",
    type: "number-unit",
    group: "dimensions_packaging",
    placeholder: "2.0 in",
  },
  {
    key: "count",
    label: "Count",
    type: "text",
    group: "dimensions_packaging",
    placeholder: "60",
  },
  {
    key: "count_per_pack",
    label: "Count Per Pack",
    type: "text",
    group: "dimensions_packaging",
    placeholder: "1",
  },
  {
    key: "allergen_free_statements",
    label: "Allergen-Free Statements",
    type: "multi-select",
    group: "search_browse_metadata",
    placeholder: "Gluten-free, dairy-free",
  },
  {
    key: "support_areas",
    label: "Benefits / Support Areas",
    type: "multi-select",
    group: "search_browse_metadata",
    placeholder: "Joint comfort, mobility",
  },
];

const SUPPLEMENT_FIELDS: WalmartSearchBrowseFieldDefinition[] = [
  {
    key: "supplement_type",
    label: "Supplement Type / Product Type",
    type: "text",
    group: "product_identity",
    placeholder: "Joint Support Supplement",
  },
  {
    key: "product_form",
    label: "Product Form",
    type: "select",
    group: "ingredients_form",
    options: ["Capsule", "Tablet", "Softgel", "Gummy", "Powder", "Liquid", "Other"],
  },
  {
    key: "flavor",
    label: "Flavor",
    type: "text",
    group: "ingredients_form",
    placeholder: "Mixed berry",
  },
  {
    key: "main_ingredients",
    label: "Main Ingredients",
    type: "multi-select",
    group: "ingredients_form",
    placeholder: "Turmeric, glucosamine, chondroitin",
  },
  {
    key: "ingredients_list",
    label: "Ingredients List",
    type: "textarea",
    group: "ingredients_form",
    placeholder: "Complete ingredients from label",
  },
  {
    key: "serving_size",
    label: "Serving Size",
    type: "text",
    group: "ingredients_form",
    placeholder: "2 capsules",
  },
  {
    key: "servings_per_container",
    label: "Servings",
    type: "text",
    group: "ingredients_form",
    placeholder: "30",
  },
];

const FIELD_BY_KEY = new Map<string, WalmartSearchBrowseFieldDefinition>(
  [...BASE_FIELDS, ...SUPPLEMENT_FIELDS].map((field) => [field.key, field])
);

const KEY_ALIASES: Record<string, string> = {
  agegroup: "age_group",
  age_group: "age_group",
  allergenfree: "allergen_free_statements",
  allergen_free: "allergen_free_statements",
  allergen_free_statements: "allergen_free_statements",
  assembledproductdepth: "assembled_product_depth",
  assembled_product_depth: "assembled_product_depth",
  assembledproductheight: "assembled_product_height",
  assembled_product_height: "assembled_product_height",
  assembledproductwidth: "assembled_product_width",
  assembled_product_width: "assembled_product_width",
  productform: "product_form",
  form: "product_form",
  product_form: "product_form",
  count: "count",
  countperpack: "count_per_pack",
  count_per_pack: "count_per_pack",
  flavor: "flavor",
  mainingredients: "main_ingredients",
  main_ingredients: "main_ingredients",
  ingredientshighlights: "main_ingredients",
  ingredients_highlights: "main_ingredients",
  supplementtype: "supplement_type",
  supplement_type: "supplement_type",
  producttype: "supplement_type",
  targetaudience: "target_audience",
  target_audience: "target_audience",
  benefits: "support_areas",
  benefitareas: "support_areas",
  supportareas: "support_areas",
  support_areas: "support_areas",
  brand: "brand",
  manufacturer: "manufacturer",
  servingsize: "serving_size",
  serving_size: "serving_size",
  servings: "servings_per_container",
  servings_per_container: "servings_per_container",
  ingredientslist: "ingredients_list",
  ingredients_list: "ingredients_list",
  directions: "directions_suggested_use",
  suggesteduse: "directions_suggested_use",
  directions_suggested_use: "directions_suggested_use",
  warnings: "safety_warnings",
  safety_warnings: "safety_warnings",
};

const FIELD_VALUE_ALIASES: Record<string, Record<string, string>> = {
  age_group: {
    adult: "Adult",
    adults: "Adult",
    teen: "Teen",
    teens: "Teen",
    child: "Child",
    children: "Child",
    kids: "Child",
    kid: "Child",
    senior: "Senior",
    seniors: "Senior",
    all_ages: "All Ages",
    all_age: "All Ages",
    all: "All Ages",
  },
  product_form: {
    capsule: "Capsule",
    capsules: "Capsule",
    tablet: "Tablet",
    tablets: "Tablet",
    softgel: "Softgel",
    softgels: "Softgel",
    gummy: "Gummy",
    gummies: "Gummy",
    powder: "Powder",
    liquid: "Liquid",
    other: "Other",
  },
};

function asObject(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeKey(key: string): string {
  const collapsed = key.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return KEY_ALIASES[collapsed] ?? collapsed;
}

function normalizeValue(value: unknown): string {
  if (Array.isArray(value)) {
    const flattened = value
      .map((entry) => normalizeValue(entry))
      .filter(Boolean);
    return flattened.join(MULTI_VALUE_DELIMITER);
  }

  const objectValue = asObject(value);
  if (objectValue) {
    const direct = asString(
      objectValue.value ?? objectValue.label ?? objectValue.name ?? objectValue.text
    );
    if (direct) return direct;
    return "";
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return asString(value);
}

function normalizeFieldValue(key: string, value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";

  const aliases = FIELD_VALUE_ALIASES[key];
  if (!aliases) return trimmed;

  const normalizedAliasKey = trimmed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return aliases[normalizedAliasKey] ?? trimmed;
}

function splitCandidateText(value: string): string[] {
  if (!value) return [];
  return value
    .split(/\r?\n|[|;,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizeRecord(input: Record<string, unknown>): Record<string, string> {
  const normalized: Record<string, string> = {};

  for (const [rawKey, rawValue] of Object.entries(input)) {
    const key = normalizeKey(rawKey);
    if (!key) continue;

    const value = normalizeValue(rawValue);
    if (!value) continue;

    const field = FIELD_BY_KEY.get(key);
    if (field?.type === "multi-select") {
      const deduped = Array.from(
        new Set(
          splitCandidateText(value)
            .map((entry) => normalizeFieldValue(key, entry))
            .filter(Boolean)
        )
      ).join(MULTI_VALUE_DELIMITER);
      if (deduped) normalized[key] = deduped;
      continue;
    }

    if (field?.type === "select") {
      const canonical = normalizeFieldValue(key, value);
      if (canonical) normalized[key] = canonical;
      continue;
    }

    normalized[key] = normalizeFieldValue(key, value);
  }

  return normalized;
}

function normalizeRawAttributePairs(value: unknown): Record<string, string> {
  const objectValue = asObject(value);
  if (objectValue) {
    return normalizeRecord(objectValue);
  }

  if (!Array.isArray(value)) return {};

  const mapped: Record<string, string> = {};
  for (const entry of value) {
    const node = asObject(entry);
    if (!node) continue;
    const name = asString(node.name ?? node.attributeName ?? node.key ?? node.id);
    if (!name) continue;
    const normalized = normalizeValue(node.value ?? node.attributeValue ?? node.text ?? "");
    if (!normalized) continue;
    mapped[normalizeKey(name)] = normalized;
  }
  return mapped;
}

export function normalizeSearchBrowseAttributes(input: unknown): Record<string, string> {
  const objectValue = asObject(input);
  if (!objectValue) return {};

  const normalized = normalizeRecord(objectValue);

  return Object.fromEntries(
    Object.entries(normalized).filter(([, value]) => {
      const trimmed = value.trim();
      if (!trimmed) return false;
      if (/needs\s+(product\s+label|confirmation)/i.test(trimmed)) return false;
      if (/^(unknown|n\/a|na|null|undefined)$/i.test(trimmed)) return false;
      return true;
    })
  );
}

function merge(...records: Array<Record<string, string> | null | undefined>): Record<string, string> {
  const output: Record<string, string> = {};
  for (const record of records) {
    if (!record) continue;
    for (const [key, value] of Object.entries(record)) {
      const normalizedKey = normalizeKey(key);
      const normalizedValue = value.trim();
      if (!normalizedKey || !normalizedValue) continue;
      output[normalizedKey] = normalizedValue;
    }
  }
  return output;
}

export function buildSearchBrowseAttributesFromSources(input: {
  product: WalmartProductRecord;
  draftPayload?: unknown;
}): Record<string, string> {
  const draft = asObject(input.draftPayload) ?? {};
  const normalizedPayload = asObject(input.product.normalizedPayload) ?? {};
  const rawPayload = asObject(input.product.rawPayload) ?? {};

  const draftSearchBrowse = normalizeSearchBrowseAttributes(draft.searchBrowseAttributes);
  const draftAttributes = normalizeSearchBrowseAttributes(draft.attributes);
  const productAttributes = normalizeSearchBrowseAttributes(input.product.attributes);
  const normalizedAttributes = normalizeSearchBrowseAttributes(normalizedPayload.attributes);
  const rawAttributes = normalizeRawAttributePairs(rawPayload.attributes ?? rawPayload.keyAttributes);

  const identityDefaults: Record<string, string> = {
    brand: asString(draft.brand) || input.product.brand,
  };

  return merge(
    productAttributes,
    normalizedAttributes,
    rawAttributes,
    draftAttributes,
    draftSearchBrowse,
    identityDefaults
  );
}

export function isSupplementLikeProduct(product: WalmartProductRecord): boolean {
  const haystack = [
    product.category,
    product.title,
    product.shortDescription,
    product.longDescription,
    product.attributes?.product_type,
    product.attributes?.supplement_type,
  ]
    .map((value) => asString(value).toLowerCase())
    .join(" ");

  return /(supplement|vitamin|wellness|capsule|softgel|gummy|nutrition)/i.test(haystack);
}

export function getSearchBrowseFieldDefinitions(product: WalmartProductRecord): WalmartSearchBrowseFieldDefinition[] {
  const fields = [...BASE_FIELDS];
  if (isSupplementLikeProduct(product)) {
    fields.push(...SUPPLEMENT_FIELDS);
  }

  return fields;
}

export function appendUnknownSearchBrowseFields(input: {
  product: WalmartProductRecord;
  attributes: Record<string, string>;
}): WalmartSearchBrowseFieldDefinition[] {
  const known = new Set(getSearchBrowseFieldDefinitions(input.product).map((field) => field.key));

  const unknownKeys = Object.keys(input.attributes)
    .map((key) => normalizeKey(key))
    .filter((key) => key && !known.has(key))
    .sort((left, right) => left.localeCompare(right));

  return unknownKeys.map((key) => ({
    key,
    label: key
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" "),
    type: "text",
    group: "search_browse_metadata",
    helperText: "Imported Walmart attribute",
  }));
}

export function searchBrowseGroupLabel(
  group: WalmartSearchBrowseFieldDefinition["group"]
): string {
  if (group === "product_identity") return "Product identity";
  if (group === "audience_usage") return "Audience & usage";
  if (group === "ingredients_form") return "Ingredients & form";
  if (group === "dimensions_packaging") return "Dimensions & packaging";
  return "Search/browse metadata";
}

export function isValidNumberUnitValue(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  return /^\d+(\.\d+)?\s*[a-zA-Z%]+$/.test(trimmed) || /^\d+(\.\d+)?$/.test(trimmed);
}

export function countStagedSearchBrowseAttributes(attributes: Record<string, string>): number {
  return Object.values(attributes).filter((value) => value.trim().length > 0).length;
}

export function mergeAttributesWithSearchBrowse(input: {
  baseAttributes: Record<string, string>;
  searchBrowseAttributes: Record<string, string>;
}): Record<string, string> {
  return merge(input.baseAttributes, input.searchBrowseAttributes);
}
