import type { WalmartProductRecord } from "@/lib/ecomviper/walmart/walmart-types";
import {
  extractCanonicalProductFacts,
  type ProductFactSource,
} from "@/lib/ecomviper/walmart/product-facts-agent";
import { normalizeSearchBrowseAttributes } from "@/lib/ecomviper/walmart/walmart-search-browse-attributes";
import { sanitizeCustomerFacingText } from "@/lib/ecomviper/walmart/walmart-truth-guard";

export type WalmartLabelFactSource =
  | "label_payload"
  | "vision_extraction"
  | "image_text"
  | "draft_payload"
  | "search_browse"
  | "attributes"
  | "manual_entry"
  | "product_payload"
  | "unknown";

type WalmartLabelFactField =
  | "servingSize"
  | "servingsPerContainer"
  | "capsuleTabletGummyCount"
  | "dosageStrength"
  | "activeIngredients"
  | "proprietaryBlendName"
  | "proprietaryBlendAmount"
  | "suggestedUse"
  | "directions"
  | "cautionsWarnings"
  | "inactiveIngredients"
  | "allergenFreeStatements"
  | "verifiedQualityBadges"
  | "labelDisclaimers";

export interface WalmartLabelFacts {
  servingSize: string;
  servingsPerContainer: string;
  capsuleTabletGummyCount: string;
  dosageStrength: string;
  activeIngredients: string[];
  proprietaryBlendName: string;
  proprietaryBlendAmount: string;
  suggestedUse: string;
  directions: string;
  cautionsWarnings: string;
  inactiveIngredients: string[];
  allergenFreeStatements: string[];
  verifiedQualityBadges: string[];
  labelDisclaimers: string[];
  evidence: Partial<Record<WalmartLabelFactField, string>>;
  sourceByField: Partial<Record<WalmartLabelFactField, WalmartLabelFactSource>>;
}

export interface WalmartOptimizationFactPack {
  labelFacts: WalmartLabelFacts;
  hasTrustedLabelFacts: boolean;
  sourceSummary: "label_facts_available" | "docket_only";
  warnings: string[];
}

interface ExtractLabelFactInput {
  product: WalmartProductRecord;
  draftPayload?: Record<string, unknown> | null;
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function asText(value: unknown): string {
  if (typeof value === "string") return sanitizeCustomerFacingText(value);
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function asList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return unique(
      value
        .map((entry) => asText(entry))
        .flatMap((entry) => splitList(entry))
    );
  }
  return splitList(asText(value));
}

function splitList(value: string): string[] {
  if (!value.trim()) return [];
  return unique(
    value
      .split(/\r?\n|[;,|]+/)
      .map((entry) => sanitizeCustomerFacingText(entry))
      .filter(Boolean)
  );
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((entry) => entry.trim()).filter(Boolean)));
}

function normalizeWhitespace(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}

function firstNonEmpty(...values: string[]): string {
  for (const value of values) {
    const normalized = normalizeWhitespace(value);
    if (normalized) return normalized;
  }
  return "";
}

function normalizeCount(value: string): string {
  const text = normalizeWhitespace(value).toLowerCase();
  if (!text) return "";
  const match = text.match(/\b(\d{1,4})\s*(capsules?|tablets?|softgels?|gummies?|count|ct)\b/i);
  if (!match) return text;
  const amount = match[1];
  const unit = match[2].toLowerCase();
  if (unit === "ct" || unit === "count") return `${amount} count`;
  return `${amount} ${unit}`;
}

function sourceFromProductFactSource(source: ProductFactSource | undefined): WalmartLabelFactSource {
  if (!source) return "unknown";
  if (source === "label_image") return "label_payload";
  if (source === "vision_extraction") return "vision_extraction";
  if (source === "image_text") return "image_text";
  if (source === "walmart_draft") return "draft_payload";
  if (source === "manual") return "manual_entry";
  if (source === "shopify" || source === "walmart_product") return "product_payload";
  return "unknown";
}

function findFirstInRecord(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = asText(record[key]);
    if (value) return value;
  }
  return "";
}

function readLabelPayloads(input: ExtractLabelFactInput): Record<string, unknown>[] {
  const productNormalized = asObject(input.product.normalizedPayload);
  const productRaw = asObject(input.product.rawPayload);
  const draft = asObject(input.draftPayload ?? null);

  const fromDraft = [
    asObject(draft?.labelFacts),
    asObject(draft?.productLabelFacts),
    asObject(draft?.imageVisionExtraction),
    asObject(draft?.visionFactPayload),
  ];
  const fromProduct = [
    asObject(productNormalized?.labelFacts),
    asObject(productRaw?.labelFacts),
    asObject(productRaw?.productLabelFacts),
    asObject(productNormalized?.productLabelFacts),
    asObject(productNormalized?.label),
    asObject(productRaw?.label),
    asObject(productNormalized?.imageVisionExtraction),
    asObject(productRaw?.imageVisionExtraction),
    asObject(productNormalized?.visionFactPayload),
    asObject(productRaw?.visionFactPayload),
  ];

  return [...fromDraft, ...fromProduct].filter(
    (value): value is Record<string, unknown> => value !== null
  );
}

function readCombinedLabelText(payloads: Record<string, unknown>[]): string {
  const lines: string[] = [];
  for (const payload of payloads) {
    lines.push(
      findFirstInRecord(payload, ["labelText", "supplementFactsText", "ocrText", "text"]),
      findFirstInRecord(payload, ["suggestedUse", "suggested_use", "directions"]),
      findFirstInRecord(payload, ["warnings", "safetyWarnings", "safety_warnings"]),
      JSON.stringify(asObject(payload.supplementFacts) ?? {}),
      asList(payload.activeIngredients).join(", "),
      asList(payload.otherIngredients).join(", ")
    );
  }
  return normalizeWhitespace(lines.filter(Boolean).join("\n"));
}

function findFirstAcrossPayloads(payloads: Record<string, unknown>[], keys: string[]): string {
  for (const payload of payloads) {
    const direct = findFirstInRecord(payload, keys);
    if (direct) return direct;
  }
  return "";
}

function parseProprietaryBlend(input: string): { name: string; amount: string } {
  const match = input.match(
    /\b([A-Za-z][A-Za-z0-9&()\-\s]{2,}proprietary blend)\b[^0-9]{0,24}(\d+(?:\.\d+)?)\s*(mg|g|mcg|iu)\b/i
  );
  if (!match) return { name: "", amount: "" };
  return {
    name: normalizeWhitespace(match[1]),
    amount: `${match[2]} ${match[3].toLowerCase()}`,
  };
}

function parseServingSizeFromText(input: string): string {
  const match = input.match(/serving\s*size\s*[:\-]?\s*([^\n.;]+)/i);
  return normalizeWalmartServingSize(match?.[1] ?? "");
}

function parseServingsFromText(input: string): string {
  const match = input.match(/servings?\s*per\s*container\s*[:\-]?\s*([^\n.;]+)/i);
  return normalizeWalmartServings(match?.[1] ?? "");
}

function parseQualityBadges(input: string): string[] {
  const text = input.toLowerCase();
  const badges: string[] = [];
  if (/\bfda\s+registered\b/.test(text)) badges.push("FDA registered facility");
  if (/\blab\s+tested\b/.test(text)) badges.push("Lab tested");
  if (/\bgmp\b/.test(text) || /\bgood\s+manufacturing\s+practice\b/.test(text)) {
    badges.push("GMP");
  }
  if (/\bmade\s+in\s+usa\b/.test(text)) badges.push("Made in USA");
  if (/\brecyclable\b/.test(text)) badges.push("Recyclable");
  return unique(badges);
}

function parseDisclaimers(input: string): string[] {
  const disclaimers: string[] = [];
  if (/these statements have not been evaluated by the food and drug administration/i.test(input)) {
    disclaimers.push(
      "These statements have not been evaluated by the Food and Drug Administration."
    );
  }
  if (/not intended to diagnose, treat, cure, or prevent/i.test(input)) {
    disclaimers.push(
      "This product is not intended to diagnose, treat, cure, or prevent any disease."
    );
  }
  return disclaimers;
}

function parseSupplementFactsIngredients(
  facts: Record<string, string>
): { active: string[]; proprietaryBlendName: string; proprietaryBlendAmount: string } {
  const active: string[] = [];
  let proprietaryBlendName = "";
  let proprietaryBlendAmount = "";

  for (const [key, rawValue] of Object.entries(facts)) {
    const label = normalizeWhitespace(key);
    const value = normalizeWhitespace(rawValue);
    if (!label || !value) continue;
    const blendMatch = `${label} ${value}`.match(
      /\b([A-Za-z][A-Za-z0-9&()\-\s]{2,}proprietary blend)\b[^0-9]{0,24}(\d+(?:\.\d+)?)\s*(mg|g|mcg|iu)\b/i
    );
    if (blendMatch) {
      proprietaryBlendName = normalizeWhitespace(blendMatch[1]);
      proprietaryBlendAmount = `${blendMatch[2]} ${blendMatch[3].toLowerCase()}`;
      continue;
    }
    if (/calories?|total|added|daily value|sodium|cholesterol|fat|carbohydrate|sugar/i.test(label)) {
      continue;
    }
    active.push(`${label} ${value}`);
  }

  return {
    active: unique(active),
    proprietaryBlendName,
    proprietaryBlendAmount,
  };
}

function normalizeIngredientEntry(value: string): string {
  return normalizeWhitespace(value.replace(/\s*[:\-]\s*/g, " "));
}

export function normalizeWalmartServingSize(value: string): string {
  const text = normalizeWhitespace(value).toLowerCase();
  if (!text) return "";
  const match = text.match(
    /\b(\d+(?:\.\d+)?)\s*(capsules?|tablets?|softgels?|gummies?|scoops?|drops?|ml|mg|g)\b/i
  );
  if (!match) return text;
  return `${match[1]} ${match[2].toLowerCase()}`;
}

export function normalizeWalmartServings(value: string): string {
  const text = normalizeWhitespace(value);
  if (!text) return "";
  const match = text.match(/\b(\d{1,4})\b/);
  return match?.[1] ?? "";
}

export function normalizeWalmartSuggestedUse(value: string): string {
  const text = normalizeWhitespace(value);
  if (!text) return "";
  const next = text.replace(/\s+or\s+as\s+directed.*/i, (segment) => segment.trim());
  if (/[.!?]$/.test(next)) return next;
  return `${next}.`;
}

export function normalizeWalmartWarnings(value: string): string {
  const text = normalizeWhitespace(value);
  if (!text) return "";
  if (/[.!?]$/.test(text)) return text;
  return `${text}.`;
}

export function normalizeWalmartMainIngredients(value: unknown): string[] {
  const items = asList(value).map((entry) => normalizeIngredientEntry(entry));
  return unique(items);
}

export function normalizeVerifiedAllergenFreeStatements(value: unknown): string[] {
  const statements = asList(value).map((entry) => normalizeWhitespace(entry));
  return unique(
    statements.filter((entry) =>
      /\b(gluten[-\s]?free|dairy[-\s]?free|soy[-\s]?free|nut[-\s]?free|peanut[-\s]?free|tree nut[-\s]?free|vegan|vegetarian|non[-\s]?gmo|gmo[-\s]?free|allergen[-\s]?free)\b/i.test(
        entry
      )
    )
  );
}

export function normalizeWalmartDosageStrength(facts: {
  activeIngredients: string[];
  proprietaryBlendName?: string;
  proprietaryBlendAmount?: string;
}): string {
  const dosageParts: string[] = [];
  const mgEntries = facts.activeIngredients
    .map((entry) => normalizeWhitespace(entry))
    .filter((entry) => /\b\d+(?:\.\d+)?\s*(mg|g|mcg|iu)\b/i.test(entry))
    .slice(0, 8);
  const melatoninFirst = mgEntries.find((entry) => /\bmelatonin\b/i.test(entry));
  if (melatoninFirst) dosageParts.push(melatoninFirst);
  for (const entry of mgEntries) {
    if (dosageParts.includes(entry)) continue;
    dosageParts.push(entry);
    if (dosageParts.length >= 3) break;
  }
  if (facts.proprietaryBlendName && facts.proprietaryBlendAmount) {
    dosageParts.push(
      `${normalizeWhitespace(facts.proprietaryBlendName)} ${normalizeWhitespace(
        facts.proprietaryBlendAmount
      )}`
    );
  }
  return unique(dosageParts).join("; ");
}

export function extractWalmartLabelFactsFromDocket(input: ExtractLabelFactInput): WalmartLabelFacts {
  const canonical = extractCanonicalProductFacts({
    product: input.product,
    draftPayload: input.draftPayload ?? null,
  });
  const draft = asObject(input.draftPayload ?? null) ?? {};
  const searchBrowse = normalizeSearchBrowseAttributes({
    ...(input.product.searchBrowseAttributes ?? {}),
    ...(input.product.attributes ?? {}),
    ...(asObject(draft.searchBrowseAttributes) ?? {}),
    ...(asObject(draft.attributes) ?? {}),
  });
  const payloads = readLabelPayloads(input);
  const combinedLabelText = readCombinedLabelText(payloads);
  const directServingSize = findFirstAcrossPayloads(payloads, ["servingSize", "serving_size"]);
  const directServings = findFirstAcrossPayloads(payloads, [
    "servingsPerContainer",
    "servings_per_container",
    "servings",
  ]);
  const directCount = findFirstAcrossPayloads(payloads, ["count", "countPerContainer", "count_per_pack"]);
  const directSuggestedUse = findFirstAcrossPayloads(payloads, [
    "suggestedUse",
    "suggested_use",
    "directions",
    "directions_suggested_use",
  ]);
  const directWarnings = findFirstAcrossPayloads(payloads, [
    "warnings",
    "safetyWarnings",
    "safety_warnings",
  ]);
  const directAllergen = findFirstAcrossPayloads(payloads, [
    "allergenFreeStatements",
    "allergen_free_statements",
    "doesNotContain",
    "does_not_contain",
  ]);

  const canonicalSupplementFacts = canonical.facts.supplementFacts ?? {};
  const supplementalIngredients = parseSupplementFactsIngredients(canonicalSupplementFacts);
  const textBlend = parseProprietaryBlend(combinedLabelText);
  const proprietaryBlendName = firstNonEmpty(
    supplementalIngredients.proprietaryBlendName,
    textBlend.name
  );
  const proprietaryBlendAmount = firstNonEmpty(
    supplementalIngredients.proprietaryBlendAmount,
    textBlend.amount
  );

  const activeIngredients = unique(
    normalizeWalmartMainIngredients(canonical.facts.activeIngredients).concat(
      supplementalIngredients.active
    )
  );

  const inactiveIngredients = normalizeWalmartMainIngredients(canonical.facts.otherIngredients);
  const servingSize = firstNonEmpty(
    normalizeWalmartServingSize(directServingSize),
    normalizeWalmartServingSize(canonical.facts.servingSize),
    normalizeWalmartServingSize(searchBrowse.serving_size ?? ""),
    parseServingSizeFromText(combinedLabelText)
  );
  const servingsPerContainer = firstNonEmpty(
    normalizeWalmartServings(directServings),
    normalizeWalmartServings(canonical.facts.servingsPerContainer),
    normalizeWalmartServings(searchBrowse.servings_per_container ?? searchBrowse.servings ?? ""),
    parseServingsFromText(combinedLabelText)
  );
  const capsuleTabletGummyCount = firstNonEmpty(
    normalizeCount(directCount),
    normalizeCount(canonical.facts.count),
    normalizeCount(searchBrowse.count ?? "")
  );
  const suggestedUse = firstNonEmpty(
    normalizeWalmartSuggestedUse(directSuggestedUse),
    normalizeWalmartSuggestedUse(canonical.facts.suggestedUse),
    normalizeWalmartSuggestedUse(
      searchBrowse.suggested_use ?? searchBrowse.directions_suggested_use ?? ""
    )
  );
  const cautionsWarnings = firstNonEmpty(
    normalizeWalmartWarnings(directWarnings),
    normalizeWalmartWarnings(canonical.facts.warnings),
    normalizeWalmartWarnings(searchBrowse.safety_warnings ?? searchBrowse.warnings ?? "")
  );
  const directions = firstNonEmpty(suggestedUse, normalizeWalmartSuggestedUse(searchBrowse.directions_suggested_use ?? ""));

  const allergenFreeStatements = normalizeVerifiedAllergenFreeStatements([
    ...asList(directAllergen),
    ...canonical.facts.allergenOrDoesNotContainStatements,
    ...(asList(searchBrowse.allergen_free_statements) ?? []),
  ]);
  const dosageStrength = firstNonEmpty(
    normalizeWalmartDosageStrength({
      activeIngredients,
      proprietaryBlendName,
      proprietaryBlendAmount,
    }),
    normalizeWhitespace(canonical.facts.dosageStrength)
  );

  const labelDisclaimers = parseDisclaimers(combinedLabelText);
  const verifiedQualityBadges = parseQualityBadges(combinedLabelText);
  const evidenceFromCanonical = canonical.facts.sourceEvidence;
  const sourceByField: Partial<Record<WalmartLabelFactField, WalmartLabelFactSource>> = {
    servingSize: directServingSize
      ? "label_payload"
      : sourceFromProductFactSource(evidenceFromCanonical.servingSize?.[0]),
    servingsPerContainer: sourceFromProductFactSource(
      directServings ? "label_image" : evidenceFromCanonical.servingsPerContainer?.[0]
    ),
    capsuleTabletGummyCount: sourceFromProductFactSource(
      directCount ? "label_image" : evidenceFromCanonical.count?.[0]
    ),
    dosageStrength:
      dosageStrength && payloads.length > 0
        ? "label_payload"
        : sourceFromProductFactSource(evidenceFromCanonical.dosageStrength?.[0]),
    activeIngredients: sourceFromProductFactSource(evidenceFromCanonical.activeIngredients?.[0]),
    suggestedUse: directSuggestedUse
      ? "label_payload"
      : sourceFromProductFactSource(evidenceFromCanonical.suggestedUse?.[0]),
    directions: directSuggestedUse
      ? "label_payload"
      : sourceFromProductFactSource(evidenceFromCanonical.suggestedUse?.[0]),
    cautionsWarnings: directWarnings
      ? "label_payload"
      : sourceFromProductFactSource(evidenceFromCanonical.warnings?.[0]),
    inactiveIngredients: sourceFromProductFactSource(evidenceFromCanonical.otherIngredients?.[0]),
    allergenFreeStatements:
      directAllergen || allergenFreeStatements.length > 0
        ? "label_payload"
        : sourceFromProductFactSource(evidenceFromCanonical.allergenOrDoesNotContainStatements?.[0]),
    proprietaryBlendName: payloads.length > 0 ? "label_payload" : "unknown",
    proprietaryBlendAmount: payloads.length > 0 ? "label_payload" : "unknown",
    verifiedQualityBadges: payloads.length > 0 ? "label_payload" : "unknown",
    labelDisclaimers: payloads.length > 0 ? "label_payload" : "unknown",
  };

  const evidence: Partial<Record<WalmartLabelFactField, string>> = {};
  for (const [fieldKey, source] of Object.entries(sourceByField)) {
    const typedField = fieldKey as WalmartLabelFactField;
    if (source && source !== "unknown") {
      evidence[typedField] = `sourced from ${source}`;
    }
  }

  return {
    servingSize,
    servingsPerContainer,
    capsuleTabletGummyCount,
    dosageStrength,
    activeIngredients,
    proprietaryBlendName,
    proprietaryBlendAmount,
    suggestedUse,
    directions,
    cautionsWarnings,
    inactiveIngredients,
    allergenFreeStatements,
    verifiedQualityBadges,
    labelDisclaimers,
    evidence,
    sourceByField,
  };
}

export function buildWalmartOptimizationFactPack(
  docket: ExtractLabelFactInput
): WalmartOptimizationFactPack {
  const labelFacts = extractWalmartLabelFactsFromDocket(docket);
  const hasTrustedLabelFacts = Boolean(
    labelFacts.servingSize ||
      labelFacts.servingsPerContainer ||
      labelFacts.dosageStrength ||
      labelFacts.activeIngredients.length > 0 ||
      labelFacts.suggestedUse ||
      labelFacts.cautionsWarnings
  );
  const warnings: string[] = [];

  if (!labelFacts.allergenFreeStatements.length) {
    warnings.push("No allergen-free statement verified from label.");
  }
  if (!labelFacts.servingSize) {
    warnings.push("Serving size not found in trusted label facts.");
  }
  if (!labelFacts.servingsPerContainer) {
    warnings.push("Servings per container not found in trusted label facts.");
  }

  return {
    labelFacts,
    hasTrustedLabelFacts,
    sourceSummary: hasTrustedLabelFacts ? "label_facts_available" : "docket_only",
    warnings,
  };
}
