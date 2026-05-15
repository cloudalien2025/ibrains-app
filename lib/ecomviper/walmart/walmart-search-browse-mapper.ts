import {
  isLowConfidenceAiFieldValue,
  sanitizeWalmartAiSearchBrowseAttributes,
} from "@/lib/ecomviper/walmart/walmart-ai-field-sanitization";
import { normalizeSearchBrowseAttributes } from "@/lib/ecomviper/walmart/walmart-search-browse-attributes";
import type {
  CanonicalProductFacts,
  ProductFactReplacement,
  ProductFactSource,
} from "@/lib/ecomviper/walmart/product-facts-agent";
import type { AgenticReferralCopyOutput } from "@/lib/ecomviper/walmart/agentic-referral-copy-agent";

export interface SearchBrowseMapperResult {
  mappedAttributes: Record<string, string>;
  updatedFields: string[];
  replacedFields: string[];
  clearedFields: string[];
  skippedProtectedFields: string[];
  skippedLowConfidenceFields: string[];
  skippedNotAllowlistedFields: string[];
  sourceByField: Record<string, string>;
}

export interface SearchBrowseMapperInput {
  facts: CanonicalProductFacts;
  copy: AgenticReferralCopyOutput;
  existingSearchBrowse?: Record<string, string>;
  aiCandidates?: Record<string, unknown>;
  staleFieldReplacements?: ProductFactReplacement[];
  usedSources?: ProductFactSource[];
}

const DEFAULT_LABEL_FALLBACK_DIRECTIONS = "Use only as directed on the product label.";
const DEFAULT_SUPPLEMENT_WARNING =
  "Consult your healthcare professional before use if you are pregnant, nursing, taking medication, or have a medical condition. Keep out of reach of children.";

function asString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((entry) => entry.trim()).filter(Boolean)));
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s{2,}/g, " ").replace(/\s+([,.!?;:])/g, "$1").trim();
}

function splitList(value: string): string[] {
  if (!value) return [];
  return unique(
    value
      .split(/\r?\n|[;,|]+/)
      .map((entry) => entry.trim())
      .filter(Boolean)
  );
}

function normalizeFormForSearchBrowse(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return "";
  if (normalized === "gummies" || normalized === "gummy") return "Gummy";
  if (normalized === "capsules" || normalized === "capsule") return "Capsule";
  if (normalized === "tablets" || normalized === "tablet") return "Tablet";
  if (normalized === "softgels" || normalized === "softgel") return "Softgel";
  if (normalized === "powder") return "Powder";
  if (normalized === "liquid") return "Liquid";
  return value.trim();
}

function normalizeIngredientName(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const withoutAmount = trimmed.replace(/\s*[:\-]\s*\d.*$/i, "");
  return normalizeWhitespace(withoutAmount || trimmed);
}

function normalizeIngredientList(values: string[]): string[] {
  return unique(values.map((entry) => normalizeIngredientName(entry)).filter(Boolean));
}

function shouldSetValue(value: unknown): boolean {
  const trimmed = asString(value);
  if (!trimmed) return false;
  if (isLowConfidenceAiFieldValue(trimmed)) return false;
  return true;
}

function setValue(
  target: Record<string, string>,
  sourceByField: Record<string, string>,
  key: string,
  value: unknown,
  source: string
) {
  if (!shouldSetValue(value)) return;
  target[key] = normalizeWhitespace(asString(value));
  sourceByField[key] = source;
}

function mapStaleFieldToSearchBrowseKeys(field: string): string[] {
  if (field === "brand") return ["brand"];
  if (field === "manufacturer") return ["manufacturer"];
  if (field === "form") return ["product_form", "form"];
  if (field === "flavor") return ["flavor"];
  if (field === "count") return ["count", "count_per_pack", "count_per_package"];
  if (field === "productName") return ["supplement_type", "product_type"];
  if (field === "servingSize") return ["serving_size"];
  if (field === "servingsPerContainer") return ["servings_per_container", "servings"];
  if (field === "dosageStrength") return ["dosage_strength"];
  if (field === "suggestedUse") return ["suggested_use", "directions_suggested_use"];
  if (field === "warnings") return ["safety_warnings"];
  if (field === "activeIngredients") return ["main_ingredients", "ingredients_list"];
  return [];
}

function syncAliasPair(input: {
  attributes: Record<string, string>;
  sourceByField: Record<string, string>;
  canonicalKey: string;
  aliasKey: string;
}) {
  const canonicalValue = asString(input.attributes[input.canonicalKey]);
  const aliasValue = asString(input.attributes[input.aliasKey]);
  const canonicalSource = input.sourceByField[input.canonicalKey] ?? "alias_sync";
  const aliasSource = input.sourceByField[input.aliasKey] ?? "alias_sync";

  if (canonicalValue && !aliasValue) {
    input.attributes[input.aliasKey] = canonicalValue;
    input.sourceByField[input.aliasKey] = canonicalSource;
    return;
  }

  if (!canonicalValue && aliasValue) {
    input.attributes[input.canonicalKey] = aliasValue;
    input.sourceByField[input.canonicalKey] = aliasSource;
    return;
  }

  if (
    canonicalValue &&
    aliasValue &&
    normalizeWhitespace(canonicalValue).toLowerCase() !==
      normalizeWhitespace(aliasValue).toLowerCase()
  ) {
    input.attributes[input.aliasKey] = canonicalValue;
    input.sourceByField[input.aliasKey] = canonicalSource;
  }
}

function buildCanonicalSearchBrowseFromFacts(input: {
  facts: CanonicalProductFacts;
  copy: AgenticReferralCopyOutput;
  usedSources: ProductFactSource[];
}): {
  attributes: Record<string, string>;
  sourceByField: Record<string, string>;
} {
  const attributes: Record<string, string> = {};
  const sourceByField: Record<string, string> = {};
  const facts = input.facts;

  setValue(attributes, sourceByField, "brand", facts.brand, "product_facts");
  setValue(
    attributes,
    sourceByField,
    "manufacturer",
    facts.manufacturer || facts.brand,
    facts.manufacturer ? "product_facts" : "product_facts_inferred"
  );
  setValue(
    attributes,
    sourceByField,
    "supplement_type",
    facts.productType || facts.category,
    "product_facts"
  );
  setValue(
    attributes,
    sourceByField,
    "product_type",
    facts.productType || facts.category,
    "product_facts"
  );
  setValue(
    attributes,
    sourceByField,
    "category",
    facts.category || facts.productType,
    "product_facts"
  );
  setValue(
    attributes,
    sourceByField,
    "product_name",
    facts.productName,
    "product_facts"
  );
  setValue(
    attributes,
    sourceByField,
    "product_form",
    normalizeFormForSearchBrowse(facts.form),
    "product_facts"
  );
  setValue(
    attributes,
    sourceByField,
    "form",
    normalizeFormForSearchBrowse(facts.form),
    "product_facts"
  );
  setValue(attributes, sourceByField, "flavor", facts.flavor, "product_facts");
  setValue(attributes, sourceByField, "count", facts.count, "product_facts");
  setValue(attributes, sourceByField, "count_per_package", facts.count, "product_facts");
  setValue(attributes, sourceByField, "count_per_pack", facts.count, "product_facts");
  setValue(attributes, sourceByField, "serving_size", facts.servingSize, "product_facts");
  setValue(
    attributes,
    sourceByField,
    "servings_per_container",
    facts.servingsPerContainer,
    "product_facts"
  );
  setValue(
    attributes,
    sourceByField,
    "servings",
    facts.servingsPerContainer,
    "product_facts"
  );
  setValue(
    attributes,
    sourceByField,
    "dosage_strength",
    facts.dosageStrength,
    "product_facts"
  );

  const mainIngredients = normalizeIngredientList([
    ...facts.activeIngredients,
    ...Object.keys(facts.supplementFacts),
  ]).slice(0, 8);
  if (mainIngredients.length > 0) {
    setValue(
      attributes,
      sourceByField,
      "main_ingredients",
      mainIngredients.join(", "),
      "product_facts"
    );
  }

  if (facts.otherIngredients.length > 0) {
    setValue(
      attributes,
      sourceByField,
      "ingredients_list",
      facts.otherIngredients.join(", "),
      "product_facts"
    );
  } else if (mainIngredients.length > 0) {
    setValue(
      attributes,
      sourceByField,
      "ingredients_list",
      mainIngredients.join(", "),
      "product_facts_inferred"
    );
  }

  if (facts.allergenOrDoesNotContainStatements.length > 0) {
    setValue(
      attributes,
      sourceByField,
      "allergen_free_statements",
      facts.allergenOrDoesNotContainStatements.join(", "),
      "product_facts"
    );
  }

  if (facts.targetAudience) {
    setValue(attributes, sourceByField, "target_audience", facts.targetAudience, "product_facts");
  }

  const inferredDirections =
    facts.suggestedUse ||
    (input.usedSources.some((source) => source === "label_image")
      ? DEFAULT_LABEL_FALLBACK_DIRECTIONS
      : "");
  setValue(
    attributes,
    sourceByField,
    "directions_suggested_use",
    inferredDirections,
    facts.suggestedUse ? "product_facts" : "product_facts_fallback"
  );
  setValue(
    attributes,
    sourceByField,
    "suggested_use",
    inferredDirections,
    facts.suggestedUse ? "product_facts" : "product_facts_fallback"
  );

  setValue(
    attributes,
    sourceByField,
    "safety_warnings",
    facts.warnings || DEFAULT_SUPPLEMENT_WARNING,
    facts.warnings ? "product_facts" : "product_facts_fallback"
  );

  if (input.copy.compliantBenefitClusters.length > 0) {
    setValue(
      attributes,
      sourceByField,
      "support_areas",
      input.copy.compliantBenefitClusters.join(", "),
      "agentic_copy"
    );
  }

  if (input.copy.searchKeywords.length > 0) {
    const keywords = input.copy.searchKeywords.join(", ");
    setValue(attributes, sourceByField, "search_keywords", keywords, "agentic_copy");
    setValue(attributes, sourceByField, "search_terms", keywords, "agentic_copy");
  }

  return {
    attributes,
    sourceByField,
  };
}

export function mapCanonicalFactsToSearchBrowse(
  input: SearchBrowseMapperInput
): SearchBrowseMapperResult {
  const existing = normalizeSearchBrowseAttributes(input.existingSearchBrowse ?? {});
  const staleReplacements = input.staleFieldReplacements ?? [];
  const usedSources = input.usedSources ?? [];

  const canonical = buildCanonicalSearchBrowseFromFacts({
    facts: input.facts,
    copy: input.copy,
    usedSources,
  });

  const aiSanitized = sanitizeWalmartAiSearchBrowseAttributes({
    candidates: input.aiCandidates ?? {},
    existingKeys: [...Object.keys(existing), ...Object.keys(canonical.attributes)],
  });

  const merged = normalizeSearchBrowseAttributes({
    ...canonical.attributes,
    ...aiSanitized.accepted,
  });
  const sourceByField = { ...canonical.sourceByField };

  syncAliasPair({
    attributes: merged,
    sourceByField,
    canonicalKey: "product_form",
    aliasKey: "form",
  });
  syncAliasPair({
    attributes: merged,
    sourceByField,
    canonicalKey: "servings_per_container",
    aliasKey: "servings",
  });
  syncAliasPair({
    attributes: merged,
    sourceByField,
    canonicalKey: "suggested_use",
    aliasKey: "directions_suggested_use",
  });
  syncAliasPair({
    attributes: merged,
    sourceByField,
    canonicalKey: "count_per_pack",
    aliasKey: "count_per_package",
  });
  syncAliasPair({
    attributes: merged,
    sourceByField,
    canonicalKey: "supplement_type",
    aliasKey: "product_type",
  });

  const updatedFields: string[] = [];
  const replacedFields: string[] = [];

  for (const [key, value] of Object.entries(merged)) {
    const currentValue = asString(existing[key]);
    if (!currentValue) {
      updatedFields.push(key);
      continue;
    }

    if (normalizeWhitespace(currentValue).toLowerCase() !== normalizeWhitespace(value).toLowerCase()) {
      replacedFields.push(key);
    }
  }

  const clearedFields = new Set<string>();
  for (const replacement of staleReplacements) {
    for (const key of mapStaleFieldToSearchBrowseKeys(replacement.field)) {
      if (merged[key]) continue;
      if (!existing[key]) continue;
      clearedFields.add(key);
    }
  }

  if (!merged.flavor && existing.flavor && usedSources.includes("label_image")) {
    clearedFields.add("flavor");
  }

  return {
    mappedAttributes: merged,
    updatedFields: unique(updatedFields),
    replacedFields: unique(replacedFields),
    clearedFields: unique(Array.from(clearedFields)),
    skippedProtectedFields: unique(
      aiSanitized.skipped
        .filter((entry) => entry.reason === "protected_field")
        .map((entry) => entry.key)
    ),
    skippedLowConfidenceFields: unique(
      aiSanitized.skipped
        .filter((entry) => entry.reason === "low_confidence")
        .map((entry) => entry.key)
    ),
    skippedNotAllowlistedFields: unique(
      aiSanitized.skipped
        .filter((entry) => entry.reason === "not_allowlisted")
        .map((entry) => entry.key)
    ),
    sourceByField,
  };
}

export function splitSearchKeywordsForMapper(value: string): string[] {
  return unique(splitList(value));
}
