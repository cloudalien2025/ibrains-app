import type { WalmartProductRecord } from "@/lib/ecomviper/walmart/walmart-types";
import {
  buildSearchBrowseAttributesFromSources,
  isSupplementLikeProduct,
  normalizeSearchBrowseAttributes,
} from "@/lib/ecomviper/walmart/walmart-search-browse-attributes";

export const SUPPLEMENT_FDA_DISCLAIMER =
  "These statements have not been evaluated by the Food and Drug Administration. This product is not intended to diagnose, treat, cure, or prevent any disease.";

const RISKY_CLAIM_PATTERNS = [
  /\barthritis\b/i,
  /\bpain\s+relief\b/i,
  /\binflammation\s+treatment\b/i,
  /\bcartilage\s+repair\b/i,
  /\bcure\b/i,
  /\btreat\b/i,
  /\bprevent\b/i,
  /\banti[-\s]?inflammatory\b/i,
  /\bworks\s+like\s+medication\b/i,
  /\bdiabetes\b/i,
  /\binsomnia\b/i,
  /\bdepression\b/i,
  /\bhypertension\b/i,
  /\banxiety\b/i,
];

const SAFE_BENEFITS = [
  "supports joint comfort",
  "supports flexibility",
  "supports mobility",
  "supports active lifestyles",
  "daily joint wellness",
  "healthy movement support",
  "supports relaxation",
  "supports sleep quality",
  "supports digestive wellness",
  "supports immune wellness",
  "supports heart wellness",
];

export interface WalmartVisibilityEntitySet {
  brand: string;
  productName: string;
  category: string;
  keyIngredients: string[];
  form: string;
  count: string;
  audience: string;
  supportedBenefits: string[];
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function tokenizeText(value: string): string[] {
  return value
    .split(/[^a-zA-Z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1);
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((entry) => entry.trim()).filter(Boolean)));
}

function extractCountFromTitle(title: string): string {
  const countMatch = title.match(/\b(\d{1,4})\s*(ct|count|capsules?|softgels?|gummies?|tablets?)\b/i);
  if (!countMatch) return "";
  return `${countMatch[1]} ${countMatch[2]}`.replace(/\s+/g, " ").trim();
}

function splitAttributeList(value: string): string[] {
  return value
    .split(/\r?\n|[;,|]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function buildWalmartVisibilityEntitySet(product: WalmartProductRecord): WalmartVisibilityEntitySet {
  const searchBrowse = buildSearchBrowseAttributesFromSources({ product });
  const keyIngredients = splitAttributeList(searchBrowse.main_ingredients ?? "");
  const supportAreas = splitAttributeList(searchBrowse.support_areas ?? "");

  const title = asString(product.title);
  const brand = asString(searchBrowse.brand) || asString(product.brand);

  const productName = title
    .replace(new RegExp(`^${brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*`, "i"), "")
    .replace(/\s{2,}/g, " ")
    .trim();

  return {
    brand,
    productName: productName || title,
    category: asString(searchBrowse.supplement_type) || asString(product.category) || "Supplement",
    keyIngredients,
    form: asString(searchBrowse.product_form),
    count: asString(searchBrowse.count) || extractCountFromTitle(title),
    audience: asString(searchBrowse.target_audience),
    supportedBenefits: supportAreas,
  };
}

export function buildEntityRichTitle(entitySet: WalmartVisibilityEntitySet): string {
  const parts = [
    entitySet.brand,
    entitySet.productName,
    entitySet.keyIngredients.length ? entitySet.keyIngredients.join(", ") : "",
    entitySet.category,
    [entitySet.count, entitySet.form].filter(Boolean).join(" "),
  ]
    .map((entry) => entry.trim())
    .filter(Boolean);

  return parts.join(" ").replace(/\s{2,}/g, " ").slice(0, 200).trim();
}

export function buildAiAnswerShortDescription(entitySet: WalmartVisibilityEntitySet): string {
  const ingredients = entitySet.keyIngredients.length
    ? entitySet.keyIngredients.join(", ")
    : "key ingredients";
  const benefits = entitySet.supportedBenefits.length
    ? entitySet.supportedBenefits.join(", ")
    : "daily wellness";
  const audience = entitySet.audience || "adults";
  const countForm = [entitySet.count, entitySet.form].filter(Boolean).join(" ") || "one bottle";

  return `${entitySet.productName || "This product"} is a daily ${
    entitySet.category || "supplement"
  } featuring ${ingredients} to support ${benefits} for ${audience}. Each bottle includes ${countForm}.`;
}

export function ensureSingleSupplementDisclaimer(description: string): string {
  const trimmed = description.trim();
  if (!trimmed) return SUPPLEMENT_FDA_DISCLAIMER;

  const normalizedDisclaimer = SUPPLEMENT_FDA_DISCLAIMER.toLowerCase();
  const hasDisclaimer = trimmed.toLowerCase().includes(normalizedDisclaimer.toLowerCase());
  if (hasDisclaimer) return trimmed;

  return `${trimmed}\n\n${SUPPLEMENT_FDA_DISCLAIMER}`;
}

export function buildStructuredLongDescription(input: {
  entitySet: WalmartVisibilityEntitySet;
  suggestedUse?: string;
  ingredientsList?: string;
}): string {
  const benefits = input.entitySet.supportedBenefits.length
    ? input.entitySet.supportedBenefits
    : ["daily wellness support"];

  const sections = [
    `What it is: ${input.entitySet.productName || "This supplement"} from ${
      input.entitySet.brand || "the brand"
    } is a ${input.entitySet.category || "supplement"} designed for everyday use.`,
    `Who it is for: ${input.entitySet.audience || "Adults seeking daily wellness support"}.`,
    `Key ingredients: ${
      input.entitySet.keyIngredients.length
        ? input.entitySet.keyIngredients.join(", ")
        : input.ingredientsList || "See product label for complete ingredients"
    }.`,
    `Supported benefits: ${benefits.join(", ")}.`,
    `Count and form: ${[input.entitySet.count, input.entitySet.form].filter(Boolean).join(" ") || "See label"}.`,
    `Suggested use: ${input.suggestedUse || "Use as directed on product label."}`,
  ];

  const body = sections.filter(Boolean).join(" ");
  return isSupplementLikeEntity(input.entitySet)
    ? ensureSingleSupplementDisclaimer(body)
    : body;
}

function isSupplementLikeEntity(entitySet: WalmartVisibilityEntitySet): boolean {
  const haystack = [entitySet.category, entitySet.form, ...entitySet.keyIngredients].join(" ").toLowerCase();
  return /(supplement|capsule|softgel|gummy|tablet|vitamin|wellness)/.test(haystack);
}

export function detectRiskyClaims(text: string): string[] {
  const normalized = asString(text);
  if (!normalized) return [];
  return RISKY_CLAIM_PATTERNS.filter((pattern) => pattern.test(normalized)).map(
    (pattern) => pattern.source
  );
}

export function sanitizeRiskyClaims(text: string): { sanitized: string; rejectedRiskyClaims: string[] } {
  let sanitized = asString(text);
  const rejected: string[] = [];

  for (const pattern of RISKY_CLAIM_PATTERNS) {
    if (!pattern.test(sanitized)) continue;
    rejected.push(pattern.source);
    sanitized = sanitized.replace(pattern, "supports wellness");
  }

  return {
    sanitized: sanitized.replace(/\s{2,}/g, " ").trim(),
    rejectedRiskyClaims: unique(rejected),
  };
}

export function normalizeSearchBrowseSuggestions(input: unknown): Record<string, string> {
  return normalizeSearchBrowseAttributes(input);
}

export function normalizeMediaRecommendations(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return unique(
    input
      .map((entry) => asString(entry))
      .filter(Boolean)
      .slice(0, 8)
  );
}

export function buildDefaultMediaRecommendations(): string[] {
  return [
    "Front bottle image",
    "Supplement facts image",
    "Ingredient callout image",
    "Lifestyle image",
    "Benefit-support image",
  ];
}

export function buildDefaultAltText(entitySet: WalmartVisibilityEntitySet): string {
  return buildEntityRichTitle(entitySet).replace(/\s{2,}/g, " ").trim();
}

export function safeSupportedBenefits(input: string[]): string[] {
  const normalized = unique(input);
  if (normalized.length === 0) return SAFE_BENEFITS.slice(0, 3);
  return normalized.filter((entry) => !detectRiskyClaims(entry).length).slice(0, 8);
}
