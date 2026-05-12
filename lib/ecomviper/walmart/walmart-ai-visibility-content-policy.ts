import type { WalmartProductRecord } from "@/lib/ecomviper/walmart/walmart-types";
import {
  buildSearchBrowseAttributesFromSources,
  normalizeSearchBrowseAttributes,
} from "@/lib/ecomviper/walmart/walmart-search-browse-attributes";

export const SUPPLEMENT_FDA_DISCLAIMER =
  "These statements have not been evaluated by the Food and Drug Administration. This product is not intended to diagnose, treat, cure, or prevent any disease.";

const RISKY_CLAIM_PATTERNS = [
  /\barthritis\b/i,
  /\bpain\s+relief\b/i,
  /\binflammation\s+treatment\b/i,
  /\bcartilage\s+repair\b/i,
  /\berectile\s+dysfunction\b/i,
  /\bnatural\s+viagra\b/i,
  /\bworks\s+like\s+cialis\b/i,
  /\bworks\s+like\s+viagra\b/i,
  /\bcure\b/i,
  /\btreat\b/i,
  /\bprevent\b/i,
  /\breverse\b/i,
  /\banti[-\s]?inflammatory\b/i,
  /\bworks\s+like\s+medication\b/i,
  /\bdiabetes\b/i,
  /\binsomnia\b/i,
  /\bdepression\b/i,
  /\bhypertension\b/i,
  /\banxiety\b/i,
];

const SAFE_BENEFITS = [
  "daily wellness support",
  "performance support",
  "circulation support",
  "supports joint comfort",
  "supports flexibility",
  "supports mobility",
  "supports active lifestyles",
  "digestive wellness support",
  "immune support",
  "heart wellness support",
  "relaxation support",
  "sleep quality support",
  "men's wellness support",
  "women's wellness support",
];

const RISKY_REPLACEMENTS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /\barthritis\b/gi, replacement: "joint wellness" },
  { pattern: /\bpain\s+relief\b/gi, replacement: "comfort support" },
  { pattern: /\binflammation\s+treatment\b/gi, replacement: "recovery support" },
  { pattern: /\bcartilage\s+repair\b/gi, replacement: "joint comfort support" },
  { pattern: /\berectile\s+dysfunction\b/gi, replacement: "men's wellness" },
  { pattern: /\bnatural\s+viagra\b/gi, replacement: "men's wellness support" },
  { pattern: /\bworks\s+like\s+cialis\b/gi, replacement: "daily performance support" },
  { pattern: /\bworks\s+like\s+viagra\b/gi, replacement: "daily performance support" },
  { pattern: /\bworks\s+like\s+medication\b/gi, replacement: "daily wellness support" },
  { pattern: /\bhypertension\b/gi, replacement: "heart wellness" },
  { pattern: /\banxiety\b/gi, replacement: "relaxation support" },
  { pattern: /\binsomnia\b/gi, replacement: "sleep quality support" },
  { pattern: /\bdepression\b/gi, replacement: "daily mood balance support" },
  { pattern: /\bdiabetes\b/gi, replacement: "metabolic wellness support" },
  { pattern: /\bcure(s|d)?\b/gi, replacement: "support" },
  { pattern: /\btreat(s|ed|ment)?\b/gi, replacement: "support" },
  { pattern: /\bprevent(s|ed|ion)?\b/gi, replacement: "support" },
  { pattern: /\breverse(s|d)?\b/gi, replacement: "support" },
];

const FDA_DISCLAIMER_SENTINEL = "__ECOMVIPER_SUPPLEMENT_FDA_DISCLAIMER__";

const DISCLAIMER_REGEX = new RegExp(
  SUPPLEMENT_FDA_DISCLAIMER.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
  "gi"
);

const REPEATED_SUPPORTS_WELLNESS_REGEX = /\b(supports wellness)(?:,\s*\1)+/gi;
const REPEATED_WORD_REGEX = /\b(\w+)(\s+\1){2,}\b/gi;

const DEFAULT_SAFETY_NOTE =
  "Consult your healthcare professional before use if you are pregnant, nursing, taking medication, or have a medical condition. Keep out of reach of children.";

const DEFAULT_DIRECTIONS_NOTE = "Use as directed on product label.";

const MAX_KEYWORDS = 12;

const STOPWORDS = new Set([
  "and",
  "for",
  "with",
  "the",
  "daily",
  "support",
  "formula",
  "supplement",
  "wellness",
  "count",
  "ct",
]);

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

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((entry) => entry.trim()).filter(Boolean)));
}

function splitAttributeList(value: string): string[] {
  return value
    .split(/\r?\n|[;,|]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function extractCountFromTitle(title: string): string {
  const countMatch = title.match(/\b(\d{1,4})\s*(ct|count|capsules?|softgels?|gummies?|tablets?)\b/i);
  if (!countMatch) return "";
  return `${countMatch[1]} ${countMatch[2]}`.replace(/\s+/g, " ").trim();
}

function inferFormFromText(text: string): string {
  const normalized = text.toLowerCase();
  if (/\bcapsules?\b/.test(normalized)) return "Capsule";
  if (/\btablets?\b/.test(normalized)) return "Tablet";
  if (/\bsoftgels?\b/.test(normalized)) return "Softgel";
  if (/\bgummies?\b/.test(normalized)) return "Gummy";
  if (/\bpowder\b/.test(normalized)) return "Powder";
  if (/\bliquid\b/.test(normalized)) return "Liquid";
  return "";
}

function inferBrandFromTitle(title: string): string {
  const firstToken = title
    .trim()
    .split(/\s+/)
    .find((token) => /^[A-Za-z][A-Za-z0-9&'-]{1,20}$/.test(token));
  return firstToken ?? "";
}

function normalizeWhitespace(text: string): string {
  return text
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.!?;:])/g, "$1")
    .trim();
}

function removeDisclaimerForRiskScan(text: string): string {
  return text.replace(DISCLAIMER_REGEX, " ");
}

function sanitizeRepeatedPhrases(text: string): string {
  return normalizeWhitespace(
    text
      .replace(REPEATED_SUPPORTS_WELLNESS_REGEX, "supports wellness")
      .replace(REPEATED_WORD_REGEX, "$1")
  );
}

function trimToSentenceBoundary(text: string, maxChars: number): string {
  const normalized = normalizeWhitespace(text);
  if (normalized.length <= maxChars) return normalized;
  const sliced = normalized.slice(0, maxChars);
  const boundary = Math.max(sliced.lastIndexOf("."), sliced.lastIndexOf("!"), sliced.lastIndexOf("?"));
  if (boundary >= Math.floor(maxChars * 0.55)) {
    return sliced.slice(0, boundary + 1).trim();
  }
  return `${sliced.slice(0, Math.max(0, maxChars - 3)).trim()}...`;
}

export function safeSupportedBenefits(input: string[]): string[] {
  const normalized = unique(input)
    .map((entry) => normalizeWhitespace(entry))
    .filter((entry) => entry.length > 0)
    .filter((entry) => detectRiskyClaims(entry).length === 0)
    .map((entry) => {
      if (/\bsupports\b|\bhelps maintain\b/i.test(entry)) return entry;
      return `supports ${entry.toLowerCase()}`;
    });

  if (normalized.length === 0) return SAFE_BENEFITS.slice(0, 4);
  return unique(normalized).slice(0, 8);
}

export function buildWalmartVisibilityEntitySet(product: WalmartProductRecord): WalmartVisibilityEntitySet {
  const searchBrowse = buildSearchBrowseAttributesFromSources({ product });
  const title = asString(product.title);
  const brandCandidate = asString(searchBrowse.brand) || asString(product.brand);
  const brand =
    brandCandidate && !/^(unknown|n\/a|na|null|undefined)$/i.test(brandCandidate)
      ? brandCandidate
      : inferBrandFromTitle(title);

  const productName = title
    .replace(new RegExp(`^${brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*`, "i"), "")
    .replace(/\s{2,}/g, " ")
    .trim();

  const ingredients = unique([
    ...splitAttributeList(asString(searchBrowse.main_ingredients)),
    ...splitAttributeList(asString(searchBrowse.ingredients_list)),
  ]).slice(0, 6);

  const category =
    asString(searchBrowse.supplement_type) || asString(product.category) || "Supplement";
  const form = asString(searchBrowse.product_form) || inferFormFromText(`${title} ${category}`);
  const count = asString(searchBrowse.count) || extractCountFromTitle(title);
  const audience =
    asString(searchBrowse.target_audience) ||
    asString(searchBrowse.age_group) ||
    "Adults";
  const benefits = safeSupportedBenefits(splitAttributeList(asString(searchBrowse.support_areas)));

  return {
    brand,
    productName: productName || title || category,
    category,
    keyIngredients: ingredients,
    form,
    count,
    audience,
    supportedBenefits: benefits,
  };
}

export function buildEntityRichTitle(entitySet: WalmartVisibilityEntitySet): string {
  const ingredientHint = entitySet.keyIngredients.slice(0, 2).join(" + ");
  const countAndForm = [entitySet.count, entitySet.form].filter(Boolean).join(" ");

  const parts = [
    entitySet.brand,
    entitySet.productName,
    ingredientHint ? `with ${ingredientHint}` : "",
    countAndForm,
  ]
    .map((entry) => entry.trim())
    .filter(Boolean);

  const title = normalizeWhitespace(parts.join(" "));
  return title.slice(0, 200).trim();
}

export function buildCompliantSearchKeywords(entitySet: WalmartVisibilityEntitySet): string[] {
  const keywordPool = unique([
    entitySet.brand,
    entitySet.productName,
    entitySet.category,
    entitySet.form,
    entitySet.count,
    ...entitySet.keyIngredients,
    ...entitySet.supportedBenefits,
  ]);

  const keywords: string[] = [];
  for (const value of keywordPool) {
    const cleaned = normalizeWhitespace(value);
    if (!cleaned || detectRiskyClaims(cleaned).length > 0) continue;
    const lowered = cleaned.toLowerCase();
    if (STOPWORDS.has(lowered)) continue;
    if (cleaned.length < 3 || cleaned.length > 45) continue;
    keywords.push(cleaned);
    if (keywords.length >= MAX_KEYWORDS) break;
  }

  return keywords;
}

export function buildAiAnswerShortDescription(entitySet: WalmartVisibilityEntitySet): string {
  const ingredients =
    entitySet.keyIngredients.slice(0, 3).join(", ") ||
    "label-listed ingredients";
  const benefits = safeSupportedBenefits(entitySet.supportedBenefits)
    .slice(0, 2)
    .join(" and ");
  const countForm = [entitySet.count, entitySet.form].filter(Boolean).join(" ");
  const audience = entitySet.audience || "Adults";
  const categoryLabel = (entitySet.category || "Supplement")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/s$/i, "");

  const description =
    `${entitySet.brand || "This"} ${entitySet.productName || entitySet.category} is a ` +
    `daily ${(categoryLabel || "Supplement").toLowerCase()} featuring ${ingredients} to ${
      benefits || "support daily wellness"
    } for ${audience.toLowerCase()}.` +
    ` ${countForm ? `Each bottle includes ${countForm}.` : ""}`;

  return trimToSentenceBoundary(description, 320);
}

export function ensureSingleSupplementDisclaimer(description: string): string {
  const trimmed = description.trim();
  const withoutDisclaimer = normalizeWhitespace(
    trimmed.replace(DISCLAIMER_REGEX, " ").replace(/\n{3,}/g, "\n\n")
  );

  if (!withoutDisclaimer) return SUPPLEMENT_FDA_DISCLAIMER;
  return `${withoutDisclaimer}\n\n${SUPPLEMENT_FDA_DISCLAIMER}`;
}

function isSupplementLikeEntity(entitySet: WalmartVisibilityEntitySet): boolean {
  const haystack = [
    entitySet.category,
    entitySet.form,
    ...entitySet.keyIngredients,
  ]
    .join(" ")
    .toLowerCase();

  return /(supplement|capsule|softgel|gummy|tablet|vitamin|wellness|nutrition)/.test(haystack);
}

export function buildStructuredLongDescription(input: {
  entitySet: WalmartVisibilityEntitySet;
  suggestedUse?: string;
  ingredientsList?: string;
}): string {
  const benefits = safeSupportedBenefits(input.entitySet.supportedBenefits).slice(0, 3);
  const ingredients =
    input.entitySet.keyIngredients.slice(0, 4).join(", ") ||
    input.ingredientsList ||
    "the ingredients listed on the product label";
  const countForm = [input.entitySet.count, input.entitySet.form].filter(Boolean).join(" ");
  const audience = input.entitySet.audience || "Adults";

  const body = [
    `${input.entitySet.brand || "This brand"} ${input.entitySet.productName || "supplement"} is crafted for ${audience.toLowerCase()} seeking reliable ${
      input.entitySet.category?.toLowerCase() || "wellness support"
    } in an easy daily routine.`,
    `The formula features ${ingredients} and is positioned to ${
      benefits.length > 0 ? benefits.join(", ") : "support daily wellness"
    } with compliant, shopper-friendly language.`,
    `Format and count: ${countForm || "See product label for count and form"}. Suggested use: ${
      input.suggestedUse || DEFAULT_DIRECTIONS_NOTE
    }`,
    DEFAULT_SAFETY_NOTE,
  ].join(" ");

  const normalizedBody = trimToSentenceBoundary(sanitizeRepeatedPhrases(body), 1800);
  return isSupplementLikeEntity(input.entitySet)
    ? ensureSingleSupplementDisclaimer(normalizedBody)
    : normalizedBody;
}

export function detectRiskyClaims(text: string): string[] {
  const normalized = removeDisclaimerForRiskScan(asString(text));
  if (!normalized) return [];

  return RISKY_CLAIM_PATTERNS.filter((pattern) => pattern.test(normalized)).map(
    (pattern) => pattern.source
  );
}

export function sanitizeRiskyClaims(text: string): {
  sanitized: string;
  rejectedRiskyClaims: string[];
} {
  let working = asString(text);
  const rejected: string[] = [];

  working = working.replace(DISCLAIMER_REGEX, FDA_DISCLAIMER_SENTINEL);

  for (const entry of RISKY_REPLACEMENTS) {
    if (!entry.pattern.test(working)) continue;
    rejected.push(entry.pattern.source);
    working = working.replace(entry.pattern, entry.replacement);
  }

  working = sanitizeRepeatedPhrases(working);
  working = working.replace(new RegExp(FDA_DISCLAIMER_SENTINEL, "g"), SUPPLEMENT_FDA_DISCLAIMER);

  return {
    sanitized: working,
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
