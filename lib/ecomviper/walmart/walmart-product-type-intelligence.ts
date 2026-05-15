export type WalmartTaxonomyConfidence = "high" | "medium" | "low";

export interface WalmartProductTypeFieldMetadata {
  key: string;
  required: boolean;
  optional: boolean;
  searchable: boolean;
  filterable: boolean;
  complianceCritical: boolean;
  writable: boolean;
  discoverabilityImpact: "high" | "medium" | "low";
  supplementRelevant: boolean;
  taxonomyRelevant: boolean;
}

export interface WalmartProductTypeIntelligence {
  productTypeGroup: string;
  productType: string;
  taxonomyPlacement: string;
  taxonomyConfidence: WalmartTaxonomyConfidence;
  requiredFields: string[];
  optionalFields: string[];
  searchableFields: string[];
  filterableFields: string[];
  complianceFields: string[];
  writableFields: string[];
  discoverabilityFields: string[];
  fieldMetadata: Record<string, WalmartProductTypeFieldMetadata>;
  supplementSchema: boolean;
}

export interface WalmartProductTypeCoverageAnalysis {
  missingRequiredFields: string[];
  missingSearchableFields: string[];
  missingComplianceFields: string[];
  missingDiscoverabilityFields: string[];
  nonWritableFieldsPresent: string[];
}

interface ProductTypePreset {
  productTypeGroup: string;
  productType: string;
  taxonomyPlacement: string;
  taxonomyConfidence: WalmartTaxonomyConfidence;
  requiredFields: string[];
  optionalFields: string[];
  searchableFields: string[];
  filterableFields: string[];
  complianceFields: string[];
  writableFields: string[];
  discoverabilityFields: string[];
  supplementSchema: boolean;
}

const SUPPLEMENT_REQUIRED_FIELDS = [
  "product_name",
  "product_type",
  "supplement_type",
  "brand",
  "product_form",
  "serving_size",
  "servings_per_container",
  "count_per_pack",
  "primary_ingredient",
  "ingredients_statement",
];

const SUPPLEMENT_OPTIONAL_FIELDS = [
  "dosage",
  "vitamin_type",
  "nutrients",
  "ingredient_preferences",
  "dietary_need",
  "allergen_free_statements",
  "health_concerns",
  "flavor",
  "form",
  "product_line",
  "gender",
  "age_group",
  "search_keywords",
  "search_terms",
  "support_areas",
  "target_audience",
  "main_ingredients",
  "ingredients_list",
];

const SUPPLEMENT_SEARCHABLE_FIELDS = [
  "product_name",
  "product_type",
  "supplement_type",
  "brand",
  "primary_ingredient",
  "ingredients_statement",
  "vitamin_type",
  "nutrients",
  "dietary_need",
  "health_concerns",
  "ingredient_preferences",
  "flavor",
  "product_form",
  "form",
  "search_keywords",
  "search_terms",
  "support_areas",
  "product_line",
  "gender",
  "age_group",
];

const SUPPLEMENT_FILTERABLE_FIELDS = [
  "product_type",
  "supplement_type",
  "product_form",
  "flavor",
  "dietary_need",
  "health_concerns",
  "ingredient_preferences",
  "gender",
  "age_group",
  "product_line",
];

const SUPPLEMENT_COMPLIANCE_FIELDS = [
  "warning_text",
  "stop_use_indications",
  "prop_65",
  "country_of_origin",
  "regulatory_fields",
  "allergen_free_statements",
  "ingredients_statement",
];

const SUPPLEMENT_WRITABLE_FIELDS = [
  ...SUPPLEMENT_REQUIRED_FIELDS,
  ...SUPPLEMENT_OPTIONAL_FIELDS,
  ...SUPPLEMENT_COMPLIANCE_FIELDS,
  "fulfillment_type",
  "lag_time",
  "shipping_template",
  "dimensions",
  "weight",
];

const SUPPLEMENT_DISCOVERABILITY_FIELDS = [
  "product_name",
  "product_type",
  "supplement_type",
  "brand",
  "primary_ingredient",
  "vitamin_type",
  "nutrients",
  "dietary_need",
  "health_concerns",
  "ingredient_preferences",
  "support_areas",
  "search_keywords",
  "search_terms",
  "product_form",
  "flavor",
  "product_line",
  "gender",
  "age_group",
];

const SUPPLEMENT_PRESET: ProductTypePreset = {
  productTypeGroup: "Health & Wellness",
  productType: "Supplements",
  taxonomyPlacement: "Health/Nutrition/Supplements",
  taxonomyConfidence: "high",
  requiredFields: SUPPLEMENT_REQUIRED_FIELDS,
  optionalFields: SUPPLEMENT_OPTIONAL_FIELDS,
  searchableFields: SUPPLEMENT_SEARCHABLE_FIELDS,
  filterableFields: SUPPLEMENT_FILTERABLE_FIELDS,
  complianceFields: SUPPLEMENT_COMPLIANCE_FIELDS,
  writableFields: SUPPLEMENT_WRITABLE_FIELDS,
  discoverabilityFields: SUPPLEMENT_DISCOVERABILITY_FIELDS,
  supplementSchema: true,
};

const GENERIC_PRESET: ProductTypePreset = {
  productTypeGroup: "General Merchandise",
  productType: "General",
  taxonomyPlacement: "General",
  taxonomyConfidence: "low",
  requiredFields: ["product_name", "product_type", "brand"],
  optionalFields: ["search_keywords", "search_terms", "product_line"],
  searchableFields: ["product_name", "product_type", "brand", "search_keywords", "search_terms"],
  filterableFields: ["product_type", "brand"],
  complianceFields: ["country_of_origin"],
  writableFields: [
    "product_name",
    "product_type",
    "brand",
    "search_keywords",
    "search_terms",
    "product_line",
    "country_of_origin",
  ],
  discoverabilityFields: ["product_name", "product_type", "brand", "search_keywords", "search_terms"],
  supplementSchema: false,
};

const PRESSETS_BY_PRODUCT_TYPE: Array<{
  matcher: RegExp;
  preset: ProductTypePreset;
}> = [
  {
    matcher: /(supplement|vitamin|nutrition|nutraceutical|wellness|dietary)/i,
    preset: SUPPLEMENT_PRESET,
  },
];

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => normalizeKey(value)).filter(Boolean)));
}

function asText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function resolvePreset(input: {
  productType: string;
  supplementType: string;
  category: string;
  taxonomyPlacement: string;
  title: string;
}): ProductTypePreset {
  const haystack = [
    input.productType,
    input.supplementType,
    input.category,
    input.taxonomyPlacement,
    input.title,
  ]
    .map((entry) => entry.toLowerCase())
    .join(" ");

  for (const candidate of PRESSETS_BY_PRODUCT_TYPE) {
    if (candidate.matcher.test(haystack)) {
      return candidate.preset;
    }
  }

  return GENERIC_PRESET;
}

function buildFieldMetadata(input: {
  preset: ProductTypePreset;
}): Record<string, WalmartProductTypeFieldMetadata> {
  const required = new Set(unique(input.preset.requiredFields));
  const optional = new Set(unique(input.preset.optionalFields));
  const searchable = new Set(unique(input.preset.searchableFields));
  const filterable = new Set(unique(input.preset.filterableFields));
  const compliance = new Set(unique(input.preset.complianceFields));
  const writable = new Set(unique(input.preset.writableFields));
  const discoverability = new Set(unique(input.preset.discoverabilityFields));

  const allKeys = unique([
    ...Array.from(required),
    ...Array.from(optional),
    ...Array.from(searchable),
    ...Array.from(filterable),
    ...Array.from(compliance),
    ...Array.from(writable),
    ...Array.from(discoverability),
  ]);

  return Object.fromEntries(
    allKeys.map((key) => {
      const discoverabilityImpact: WalmartProductTypeFieldMetadata["discoverabilityImpact"] =
        discoverability.has(key) ? "high" : searchable.has(key) ? "medium" : "low";
      return [
        key,
        {
          key,
          required: required.has(key),
          optional: optional.has(key) || !required.has(key),
          searchable: searchable.has(key),
          filterable: filterable.has(key),
          complianceCritical: compliance.has(key),
          writable: writable.has(key),
          discoverabilityImpact,
          supplementRelevant: input.preset.supplementSchema,
          taxonomyRelevant: required.has(key) || searchable.has(key) || filterable.has(key),
        },
      ];
    })
  );
}

function resolveTaxonomyConfidence(input: {
  taxonomyPlacement: string;
  preset: ProductTypePreset;
}): WalmartTaxonomyConfidence {
  const incoming = normalizeKey(input.taxonomyPlacement);
  const expected = normalizeKey(input.preset.taxonomyPlacement);
  if (!incoming) return "low";
  if (incoming === expected) return "high";
  if (incoming.includes(expected) || expected.includes(incoming)) return "medium";
  return input.preset.taxonomyConfidence;
}

export function resolveWalmartProductTypeIntelligence(input: {
  productType?: string;
  supplementType?: string;
  category?: string;
  taxonomyPlacement?: string;
  title?: string;
}): WalmartProductTypeIntelligence {
  const productType = asText(input.productType);
  const supplementType = asText(input.supplementType);
  const category = asText(input.category);
  const taxonomyPlacement = asText(input.taxonomyPlacement);
  const title = asText(input.title);

  const preset = resolvePreset({
    productType,
    supplementType,
    category,
    taxonomyPlacement,
    title,
  });

  const metadata = buildFieldMetadata({ preset });
  const resolvedProductType = productType || supplementType || preset.productType;
  const resolvedTaxonomyPlacement = taxonomyPlacement || preset.taxonomyPlacement;

  return {
    productTypeGroup: preset.productTypeGroup,
    productType: resolvedProductType,
    taxonomyPlacement: resolvedTaxonomyPlacement,
    taxonomyConfidence: resolveTaxonomyConfidence({
      taxonomyPlacement: resolvedTaxonomyPlacement,
      preset,
    }),
    requiredFields: unique(preset.requiredFields),
    optionalFields: unique(preset.optionalFields),
    searchableFields: unique(preset.searchableFields),
    filterableFields: unique(preset.filterableFields),
    complianceFields: unique(preset.complianceFields),
    writableFields: unique(preset.writableFields),
    discoverabilityFields: unique(preset.discoverabilityFields),
    fieldMetadata: metadata,
    supplementSchema: preset.supplementSchema,
  };
}

export function getRequiredFieldsForProductType(productType: string): string[] {
  return resolveWalmartProductTypeIntelligence({ productType }).requiredFields;
}

export function getSearchableFieldsForProductType(productType: string): string[] {
  return resolveWalmartProductTypeIntelligence({ productType }).searchableFields;
}

export function getComplianceFieldsForProductType(productType: string): string[] {
  return resolveWalmartProductTypeIntelligence({ productType }).complianceFields;
}

export function getWritableFieldsForProductType(productType: string): string[] {
  return resolveWalmartProductTypeIntelligence({ productType }).writableFields;
}

export function getDiscoverabilityFieldsForProductType(productType: string): string[] {
  return resolveWalmartProductTypeIntelligence({ productType }).discoverabilityFields;
}

export function analyzeWalmartProductTypeFieldCoverage(input: {
  intelligence: WalmartProductTypeIntelligence;
  attributes: Record<string, string>;
}): WalmartProductTypeCoverageAnalysis {
  const keysWithValue = new Set(
    Object.entries(input.attributes)
      .filter(([, value]) => asText(value).length > 0)
      .map(([key]) => normalizeKey(key))
  );

  const missingRequiredFields = input.intelligence.requiredFields.filter(
    (field) => !keysWithValue.has(normalizeKey(field))
  );
  const missingSearchableFields = input.intelligence.searchableFields.filter(
    (field) => !keysWithValue.has(normalizeKey(field))
  );
  const missingComplianceFields = input.intelligence.complianceFields.filter(
    (field) => !keysWithValue.has(normalizeKey(field))
  );
  const missingDiscoverabilityFields = input.intelligence.discoverabilityFields.filter(
    (field) => !keysWithValue.has(normalizeKey(field))
  );

  const nonWritableFieldsPresent = Array.from(keysWithValue).filter(
    (field) => !input.intelligence.writableFields.includes(field)
  );

  return {
    missingRequiredFields,
    missingSearchableFields,
    missingComplianceFields,
    missingDiscoverabilityFields,
    nonWritableFieldsPresent,
  };
}
