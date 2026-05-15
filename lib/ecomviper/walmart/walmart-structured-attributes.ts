import {
  appendUnknownSearchBrowseFields,
  buildSearchBrowseAttributesFromSources,
  getSearchBrowseFieldDefinitions,
  searchBrowseGroupLabel,
  type WalmartSearchBrowseFieldDefinition,
} from "@/lib/ecomviper/walmart/walmart-search-browse-attributes";
import type { WalmartProductRecord } from "@/lib/ecomviper/walmart/walmart-types";

export type WalmartStructuredAttributeGroup =
  | "product_identity"
  | "audience_usage"
  | "ingredients_form"
  | "dimensions_packaging"
  | "search_browse_metadata"
  | "compliance"
  | "fulfillment";

export interface WalmartStructuredAttributeDefinition {
  key: string;
  label: string;
  group: WalmartStructuredAttributeGroup;
  required: boolean;
  writable: boolean;
  searchable: boolean;
  complianceCritical: boolean;
  supplementRelevant: boolean;
  walmartSchema: "Item Setup" | "Item Maintenance" | "MP_ITEM" | "MP_MAINTENANCE";
  helperText?: string;
}

export interface WalmartStructuredAttributeValue extends WalmartStructuredAttributeDefinition {
  value: string;
  source: "walmart_current" | "walmart_catalog" | "walmart_maintenance" | "unknown";
}

export interface WalmartStructuredAttributeRegistry {
  taxonomyPlacement: string;
  productType: string;
  supplementRelevant: boolean;
  definitions: WalmartStructuredAttributeDefinition[];
  values: WalmartStructuredAttributeValue[];
  groupedValues: Array<{
    group: WalmartStructuredAttributeGroup;
    label: string;
    values: WalmartStructuredAttributeValue[];
  }>;
}

const SUPPLEMENT_KEY_HINTS = [
  "supplement_type",
  "product_type",
  "primary_ingredient",
  "serving_size",
  "servings_per_container",
  "count_per_pack",
  "form",
  "product_form",
  "flavor",
  "dietary_need",
  "health_concerns",
  "ingredient_preferences",
  "nutrients",
  "gender",
  "age_group",
  "product_line",
];

const COMPLIANCE_FIELDS: WalmartStructuredAttributeDefinition[] = [
  {
    key: "warning_text",
    label: "Warning Text",
    group: "compliance",
    required: false,
    writable: true,
    searchable: false,
    complianceCritical: true,
    supplementRelevant: true,
    walmartSchema: "Item Maintenance",
  },
  {
    key: "stop_use_indications",
    label: "Stop Use Indications",
    group: "compliance",
    required: false,
    writable: true,
    searchable: false,
    complianceCritical: true,
    supplementRelevant: true,
    walmartSchema: "Item Maintenance",
  },
  {
    key: "prop_65",
    label: "Prop 65",
    group: "compliance",
    required: false,
    writable: true,
    searchable: false,
    complianceCritical: true,
    supplementRelevant: false,
    walmartSchema: "Item Maintenance",
  },
  {
    key: "country_of_origin",
    label: "Country of Origin",
    group: "compliance",
    required: false,
    writable: true,
    searchable: true,
    complianceCritical: true,
    supplementRelevant: false,
    walmartSchema: "Item Maintenance",
  },
  {
    key: "regulatory_fields",
    label: "Regulatory Fields",
    group: "compliance",
    required: false,
    writable: true,
    searchable: false,
    complianceCritical: true,
    supplementRelevant: false,
    walmartSchema: "Item Maintenance",
    helperText: "Regulatory attributes grouped from Walmart maintenance payloads.",
  },
];

const FULFILLMENT_FIELDS: WalmartStructuredAttributeDefinition[] = [
  {
    key: "fulfillment_type",
    label: "Fulfillment Type",
    group: "fulfillment",
    required: false,
    writable: true,
    searchable: false,
    complianceCritical: false,
    supplementRelevant: false,
    walmartSchema: "MP_MAINTENANCE",
  },
  {
    key: "lag_time",
    label: "Lag Time",
    group: "fulfillment",
    required: false,
    writable: true,
    searchable: false,
    complianceCritical: false,
    supplementRelevant: false,
    walmartSchema: "MP_MAINTENANCE",
  },
  {
    key: "wfs_status",
    label: "WFS Status",
    group: "fulfillment",
    required: false,
    writable: false,
    searchable: false,
    complianceCritical: false,
    supplementRelevant: false,
    walmartSchema: "MP_ITEM",
  },
  {
    key: "shipping_template",
    label: "Shipping Template",
    group: "fulfillment",
    required: false,
    writable: true,
    searchable: false,
    complianceCritical: false,
    supplementRelevant: false,
    walmartSchema: "MP_MAINTENANCE",
  },
  {
    key: "dimensions",
    label: "Dimensions",
    group: "fulfillment",
    required: false,
    writable: true,
    searchable: false,
    complianceCritical: false,
    supplementRelevant: false,
    walmartSchema: "MP_MAINTENANCE",
  },
  {
    key: "weight",
    label: "Weight",
    group: "fulfillment",
    required: false,
    writable: true,
    searchable: false,
    complianceCritical: false,
    supplementRelevant: false,
    walmartSchema: "MP_MAINTENANCE",
  },
];

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

function firstNonEmptyString(
  source: Array<Record<string, unknown> | null>,
  keys: string[]
): string {
  for (const record of source) {
    if (!record) continue;
    for (const key of keys) {
      const value = asText(record[key]);
      if (value) return value;
    }
  }
  return "";
}

function normalizeGroup(
  group: WalmartSearchBrowseFieldDefinition["group"]
): WalmartStructuredAttributeGroup {
  return group;
}

function isSupplementRelevantProduct(input: {
  product: WalmartProductRecord;
  searchBrowseAttributes: Record<string, string>;
}): boolean {
  const attributeKeys = Object.keys(input.searchBrowseAttributes).map((key) => key.toLowerCase());
  const attributeSignal = SUPPLEMENT_KEY_HINTS.some((hint) => attributeKeys.includes(hint));
  if (attributeSignal) return true;

  const haystack = [
    input.product.category,
    input.product.title,
    input.product.shortDescription,
    input.product.longDescription,
  ]
    .map((value) => value.trim().toLowerCase())
    .join(" ");

  return /(supplement|vitamin|gummy|capsule|softgel|nutrition|wellness)/i.test(haystack);
}

function toStructuredDefinition(input: {
  field: WalmartSearchBrowseFieldDefinition;
  supplementRelevant: boolean;
}): WalmartStructuredAttributeDefinition {
  const key = input.field.key;
  const requiredSupplementKeys = new Set([
    "product_type",
    "supplement_type",
    "product_form",
    "serving_size",
    "servings_per_container",
  ]);
  const searchableKeys = new Set([
    "product_type",
    "supplement_type",
    "product_name",
    "brand",
    "main_ingredients",
    "support_areas",
    "search_keywords",
    "search_terms",
    "dietary_need",
    "health_concerns",
    "ingredient_preferences",
    "nutrients",
    "age_group",
    "gender",
    "product_line",
  ]);
  const complianceKeys = new Set([
    "warning_text",
    "stop_use_indications",
    "safety_warnings",
    "prop_65",
    "country_of_origin",
    "regulatory_fields",
  ]);

  return {
    key,
    label: input.field.label,
    group: normalizeGroup(input.field.group),
    required: input.supplementRelevant && requiredSupplementKeys.has(key),
    writable: true,
    searchable: searchableKeys.has(key),
    complianceCritical: complianceKeys.has(key),
    supplementRelevant: input.supplementRelevant,
    walmartSchema:
      input.field.group === "search_browse_metadata" ? "Item Setup" : "Item Maintenance",
    helperText: input.field.helperText,
  };
}

function toUniqueDefinitions(
  definitions: WalmartStructuredAttributeDefinition[]
): WalmartStructuredAttributeDefinition[] {
  const seen = new Set<string>();
  const output: WalmartStructuredAttributeDefinition[] = [];
  for (const definition of definitions) {
    const key = definition.key.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push(definition);
  }
  return output;
}

export function resolveWalmartStructuredAttributeRegistry(input: {
  product: WalmartProductRecord;
  draftPayload?: unknown;
  sourceAttributes?: Record<string, string>;
}): WalmartStructuredAttributeRegistry {
  const sourceAttributes =
    input.sourceAttributes ??
    buildSearchBrowseAttributesFromSources({
      product: input.product,
      draftPayload: input.draftPayload,
    });

  const supplementRelevant = isSupplementRelevantProduct({
    product: input.product,
    searchBrowseAttributes: sourceAttributes,
  });

  const knownFieldDefinitions = getSearchBrowseFieldDefinitions(input.product);
  const unknownFieldDefinitions = appendUnknownSearchBrowseFields({
    product: input.product,
    attributes: sourceAttributes,
  });

  const structuredDefinitions = toUniqueDefinitions([
    ...knownFieldDefinitions.map((field) =>
      toStructuredDefinition({ field, supplementRelevant })
    ),
    ...unknownFieldDefinitions.map((field) =>
      toStructuredDefinition({ field, supplementRelevant })
    ),
    ...COMPLIANCE_FIELDS,
    ...FULFILLMENT_FIELDS,
  ]);

  const normalizedPayload = asObject(input.product.normalizedPayload);
  const rawPayload = asObject(input.product.rawPayload);
  const rawProductPayload = asObject(rawPayload?.product);
  const records = [normalizedPayload, rawPayload, rawProductPayload];

  const taxonomyPlacement =
    sourceAttributes.taxonomy_placement ||
    firstNonEmptyString(records, ["taxonomy", "taxonomyPlacement", "taxonomyNode", "categoryPath"]) ||
    input.product.category;
  const productType =
    sourceAttributes.product_type ||
    sourceAttributes.supplement_type ||
    firstNonEmptyString(records, ["productType", "product_type", "itemType"]) ||
    input.product.category;

  const values: WalmartStructuredAttributeValue[] = structuredDefinitions.map((definition) => {
    const fromAttributes = sourceAttributes[definition.key] ?? "";
    const fromPayload = firstNonEmptyString(records, [definition.key, definition.key.toLowerCase()]);
    const value = fromAttributes || fromPayload;

    let source: WalmartStructuredAttributeValue["source"] = "unknown";
    if (fromAttributes) {
      source = "walmart_current";
    } else if (fromPayload) {
      source = "walmart_catalog";
    }

    return {
      ...definition,
      value,
      source,
    };
  });

  const groups: WalmartStructuredAttributeGroup[] = [
    "product_identity",
    "audience_usage",
    "ingredients_form",
    "dimensions_packaging",
    "search_browse_metadata",
    "compliance",
    "fulfillment",
  ];

  const groupedValues = groups
    .map((group) => ({
      group,
      label: group === "compliance" || group === "fulfillment" ? group : searchBrowseGroupLabel(group),
      values: values.filter((value) => value.group === group && value.value.trim().length > 0),
    }))
    .filter((entry) => entry.values.length > 0);

  return {
    taxonomyPlacement,
    productType,
    supplementRelevant,
    definitions: structuredDefinitions,
    values,
    groupedValues,
  };
}
