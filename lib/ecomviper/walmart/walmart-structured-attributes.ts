import {
  appendUnknownSearchBrowseFields,
  buildSearchBrowseAttributesFromSources,
  getSearchBrowseFieldDefinitions,
  searchBrowseGroupLabel,
  type WalmartSearchBrowseFieldDefinition,
} from "@/lib/ecomviper/walmart/walmart-search-browse-attributes";
import {
  analyzeWalmartProductTypeFieldCoverage,
  resolveWalmartProductTypeIntelligence,
  type WalmartProductTypeCoverageAnalysis,
  type WalmartProductTypeIntelligence,
  type WalmartTaxonomyConfidence,
} from "@/lib/ecomviper/walmart/walmart-product-type-intelligence";
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
  productTypeGroup: string;
  productType: string;
  required: boolean;
  optional: boolean;
  searchable: boolean;
  filterable: boolean;
  complianceCritical: boolean;
  writable: boolean;
  discoverabilityImpact: "high" | "medium" | "low";
  supplementRelevant: boolean;
  taxonomyRelevant: boolean;
  walmartSchema: "Item Setup" | "Item Maintenance" | "MP_ITEM" | "MP_MAINTENANCE";
  helperText?: string;
}

export interface WalmartStructuredAttributeValue extends WalmartStructuredAttributeDefinition {
  value: string;
  source: "walmart_current" | "walmart_catalog" | "walmart_maintenance" | "unknown";
}

export interface WalmartStructuredAttributeRegistry {
  taxonomyPlacement: string;
  taxonomyConfidence: WalmartTaxonomyConfidence;
  productTypeGroup: string;
  productType: string;
  supplementRelevant: boolean;
  definitions: WalmartStructuredAttributeDefinition[];
  values: WalmartStructuredAttributeValue[];
  groupedValues: Array<{
    group: WalmartStructuredAttributeGroup;
    label: string;
    values: WalmartStructuredAttributeValue[];
  }>;
  intelligence: WalmartProductTypeIntelligence;
  gapAnalysis: WalmartProductTypeCoverageAnalysis;
}

const SUPPLEMENT_SPEC_FIELDS: Array<Pick<WalmartStructuredAttributeDefinition, "key" | "label" | "group">> = [
  { key: "primary_ingredient", label: "Primary Ingredient", group: "ingredients_form" },
  { key: "ingredients_statement", label: "Ingredients Statement", group: "ingredients_form" },
  { key: "dosage", label: "Dosage", group: "ingredients_form" },
  { key: "vitamin_type", label: "Vitamin Type", group: "ingredients_form" },
  { key: "nutrients", label: "Nutrients", group: "search_browse_metadata" },
  { key: "dietary_need", label: "Dietary Need", group: "search_browse_metadata" },
  { key: "ingredient_preferences", label: "Ingredient Preferences", group: "search_browse_metadata" },
  { key: "health_concerns", label: "Health Concerns", group: "search_browse_metadata" },
  { key: "product_line", label: "Product Line", group: "search_browse_metadata" },
  { key: "allergens", label: "Allergens", group: "search_browse_metadata" },
  { key: "allergen_free_statements", label: "Allergen-Free Statements", group: "search_browse_metadata" },
  { key: "serving_size", label: "Serving Size", group: "ingredients_form" },
  { key: "servings_per_container", label: "Servings Per Container", group: "ingredients_form" },
  { key: "count_per_pack", label: "Count Per Pack", group: "dimensions_packaging" },
  { key: "supplement_type", label: "Supplement Type", group: "product_identity" },
  { key: "product_form", label: "Product Form", group: "ingredients_form" },
  { key: "form", label: "Form", group: "ingredients_form" },
  { key: "flavor", label: "Flavor", group: "ingredients_form" },
  { key: "gender", label: "Gender", group: "audience_usage" },
  { key: "age_group", label: "Age Group", group: "audience_usage" },
];

const COMPLIANCE_FIELDS: Array<Pick<WalmartStructuredAttributeDefinition, "key" | "label" | "group" | "walmartSchema">> = [
  {
    key: "warning_text",
    label: "Warning Text",
    group: "compliance",
    walmartSchema: "Item Maintenance",
  },
  {
    key: "stop_use_indications",
    label: "Stop Use Indications",
    group: "compliance",
    walmartSchema: "Item Maintenance",
  },
  {
    key: "prop_65",
    label: "Prop 65",
    group: "compliance",
    walmartSchema: "Item Maintenance",
  },
  {
    key: "country_of_origin",
    label: "Country of Origin",
    group: "compliance",
    walmartSchema: "Item Maintenance",
  },
  {
    key: "regulatory_fields",
    label: "Regulatory Fields",
    group: "compliance",
    walmartSchema: "Item Maintenance",
  },
];

const FULFILLMENT_FIELDS: Array<Pick<WalmartStructuredAttributeDefinition, "key" | "label" | "group" | "walmartSchema">> = [
  {
    key: "fulfillment_type",
    label: "Fulfillment Type",
    group: "fulfillment",
    walmartSchema: "MP_MAINTENANCE",
  },
  {
    key: "lag_time",
    label: "Lag Time",
    group: "fulfillment",
    walmartSchema: "MP_MAINTENANCE",
  },
  {
    key: "wfs_status",
    label: "WFS Status",
    group: "fulfillment",
    walmartSchema: "MP_ITEM",
  },
  {
    key: "shipping_template",
    label: "Shipping Template",
    group: "fulfillment",
    walmartSchema: "MP_MAINTENANCE",
  },
  {
    key: "dimensions",
    label: "Dimensions",
    group: "fulfillment",
    walmartSchema: "MP_MAINTENANCE",
  },
  {
    key: "weight",
    label: "Weight",
    group: "fulfillment",
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

function normalizeKey(key: string): string {
  return key.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
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

function toUniqueDefinitions(
  definitions: WalmartStructuredAttributeDefinition[]
): WalmartStructuredAttributeDefinition[] {
  const seen = new Set<string>();
  const output: WalmartStructuredAttributeDefinition[] = [];
  for (const definition of definitions) {
    const key = normalizeKey(definition.key);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push({ ...definition, key });
  }
  return output;
}

function toStructuredDefinition(input: {
  key: string;
  label: string;
  group: WalmartStructuredAttributeGroup;
  helperText?: string;
  walmartSchema?: WalmartStructuredAttributeDefinition["walmartSchema"];
  intelligence: WalmartProductTypeIntelligence;
}): WalmartStructuredAttributeDefinition {
  const normalizedKey = normalizeKey(input.key);
  const metadata = input.intelligence.fieldMetadata[normalizedKey];

  return {
    key: normalizedKey,
    label: input.label,
    group: input.group,
    productTypeGroup: input.intelligence.productTypeGroup,
    productType: input.intelligence.productType,
    required: metadata?.required ?? false,
    optional: metadata?.optional ?? true,
    searchable: metadata?.searchable ?? false,
    filterable: metadata?.filterable ?? false,
    complianceCritical: metadata?.complianceCritical ?? false,
    writable: metadata?.writable ?? true,
    discoverabilityImpact: metadata?.discoverabilityImpact ?? "low",
    supplementRelevant: metadata?.supplementRelevant ?? input.intelligence.supplementSchema,
    taxonomyRelevant: metadata?.taxonomyRelevant ?? false,
    walmartSchema:
      input.walmartSchema ??
      (input.group === "search_browse_metadata" ? "Item Setup" : "Item Maintenance"),
    helperText: input.helperText,
  };
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

  const normalizedPayload = asObject(input.product.normalizedPayload);
  const rawPayload = asObject(input.product.rawPayload);
  const rawProductPayload = asObject(rawPayload?.product);
  const records = [normalizedPayload, rawPayload, rawProductPayload];

  const taxonomyPlacement =
    sourceAttributes.taxonomy_placement ||
    input.product.category ||
    firstNonEmptyString(records, ["taxonomy", "taxonomyPlacement", "taxonomyNode", "categoryPath"]) ||
    "";
  const productType =
    sourceAttributes.product_type ||
    sourceAttributes.supplement_type ||
    firstNonEmptyString(records, ["productType", "product_type", "itemType"]) ||
    input.product.category;

  const intelligence = resolveWalmartProductTypeIntelligence({
    productType,
    supplementType: sourceAttributes.supplement_type,
    category: input.product.category,
    taxonomyPlacement,
    title: input.product.title,
  });

  const knownFieldDefinitions = getSearchBrowseFieldDefinitions(input.product);
  const unknownFieldDefinitions = appendUnknownSearchBrowseFields({
    product: input.product,
    attributes: sourceAttributes,
  });

  const schemaFieldDefinitions = intelligence.supplementSchema
    ? SUPPLEMENT_SPEC_FIELDS
    : [];

  const structuredDefinitions = toUniqueDefinitions([
    ...knownFieldDefinitions.map((field) =>
      toStructuredDefinition({
        key: field.key,
        label: field.label,
        group: normalizeGroup(field.group),
        helperText: field.helperText,
        intelligence,
      })
    ),
    ...unknownFieldDefinitions.map((field) =>
      toStructuredDefinition({
        key: field.key,
        label: field.label,
        group: normalizeGroup(field.group),
        helperText: field.helperText,
        intelligence,
      })
    ),
    ...schemaFieldDefinitions.map((field) =>
      toStructuredDefinition({
        key: field.key,
        label: field.label,
        group: field.group,
        intelligence,
      })
    ),
    ...COMPLIANCE_FIELDS.map((field) =>
      toStructuredDefinition({
        key: field.key,
        label: field.label,
        group: field.group,
        walmartSchema: field.walmartSchema,
        intelligence,
      })
    ),
    ...FULFILLMENT_FIELDS.map((field) =>
      toStructuredDefinition({
        key: field.key,
        label: field.label,
        group: field.group,
        walmartSchema: field.walmartSchema,
        intelligence,
      })
    ),
  ]);

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

  const gapAnalysis = analyzeWalmartProductTypeFieldCoverage({
    intelligence,
    attributes: sourceAttributes,
  });

  return {
    taxonomyPlacement,
    taxonomyConfidence: intelligence.taxonomyConfidence,
    productTypeGroup: intelligence.productTypeGroup,
    productType: intelligence.productType,
    supplementRelevant: intelligence.supplementSchema,
    definitions: structuredDefinitions,
    values,
    groupedValues,
    intelligence,
    gapAnalysis,
  };
}
