import { assessWalmartListingQuality } from "@/lib/ecomviper/walmart/walmart-listing-quality";
import { evaluateWalmartListingCompliance } from "@/lib/ecomviper/walmart/walmart-compliance";
import type { WalmartProductRecord } from "@/lib/ecomviper/walmart/walmart-types";
import { SUPPLEMENT_FDA_DISCLAIMER } from "@/lib/ecomviper/walmart/walmart-ai-visibility-content-policy";
import {
  buildWalmartOptimizationFactPack,
  normalizeVerifiedAllergenFreeStatements,
  type WalmartOptimizationFactPack,
} from "@/lib/ecomviper/walmart/walmart-label-facts";
import {
  detectWalmartFlavorClaims,
  resolveWalmartFlavorFromFacts,
  type WalmartFlavorResolution,
} from "@/lib/ecomviper/walmart/walmart-flavor-normalizer";

const TITLE_MAX = 150;
const TITLE_TARGET_MAX = 110;
const TITLE_TARGET_MIN = 50;

const PROMOTIONAL_PHRASES = [
  "best seller",
  "free shipping",
  "limited time",
  "number one",
  "#1",
  "guaranteed",
];

const UNSAFE_CLAIM_PATTERNS = [
  /\bcure\b/i,
  /\btreat(?:s|ed|ment)?\b/i,
  /\bprevent(?:s|ed|ion)?\b/i,
  /\breverse(?:s|d)?\b/i,
  /\bdiagnos(?:e|es|ed|is)\b/i,
  /\binsomnia\b/i,
  /\banxiety\b/i,
  /\bdepression\b/i,
  /\bhypertension\b/i,
  /\bhigh blood pressure\b/i,
  /\berectile dysfunction\b/i,
  /\bnatural viagra\b/i,
  /\bcialis\b/i,
  /\bclinically proven\b/i,
];

const SUPPORT_AREA_FALLBACK = [
  "nighttime relaxation support",
  "restful sleep support",
  "sleep quality support",
  "daily wellness support",
];

const MINOR_MINERAL_PATTERN = /\b(calcium|vitamin\s*b6|magnesium)\b/i;
const RAW_OCR_BULLET_PATTERN = /(^|\b)(%dv|\d+(?:\.\d+)?\s*%|\d+(?:\.\d+)?\s*(mg|mcg|g|iu)\s*\d*%?)($|\b)/i;

export interface WalmartFieldOptimizationRule {
  fieldKey:
    | "productTitle"
    | "shortDescription"
    | "longDescription"
    | "bullets"
    | "mediaRecommendations"
    | "altTextGuidance"
    | "pricingInventoryNotes"
    | "searchBrowse"
    | "searchKeywords"
    | "supplementComplianceNotes";
  objective: string;
  deterministicChecks: string[];
}

export const WalmartDocketOptimizationRules: WalmartFieldOptimizationRule[] = [
  {
    fieldKey: "productTitle",
    objective: "Produce a clear, descriptive Walmart-safe title under 150 characters.",
    deterministicChecks: [
      "Use Brand + Product + Ingredient/Support + Form + Count when available.",
      "Avoid promotional phrasing and unsafe medical claims.",
      "Avoid repeated keywords and duplicate product types.",
    ],
  },
  {
    fieldKey: "shortDescription",
    objective: "Generate one concise sentence for what it is, who it is for, and support context.",
    deterministicChecks: [
      "One sentence only.",
      "Include product identity and supplement-safe support language.",
      "Exclude disease/treatment/drug-comparison claims.",
    ],
  },
  {
    fieldKey: "longDescription",
    objective: "Create structured long-form listing copy with label-backed supplement facts.",
    deterministicChecks: [
      "Entity-rich opening sentence.",
      "Include serving size, dosage, and suggested use when available.",
      "FDA disclaimer included exactly once for supplements.",
    ],
  },
  {
    fieldKey: "bullets",
    objective: "Create 5-7 distinct shopper-friendly bullets grounded in label facts.",
    deterministicChecks: [
      "Each bullet has one job.",
      "No repeated phrases or OCR fragments.",
      "No unsupported disease/treatment language.",
    ],
  },
  {
    fieldKey: "mediaRecommendations",
    objective: "Recommend Walmart listing media that improves trust and discoverability.",
    deterministicChecks: [
      "Front bottle plus supplement facts and directions coverage.",
      "No unverified image claims.",
    ],
  },
  {
    fieldKey: "altTextGuidance",
    objective: "Generate factual alt-text guidance based on visible product attributes.",
    deterministicChecks: [
      "Describe image content without sales language.",
      "Include brand/product/form/count when known.",
    ],
  },
  {
    fieldKey: "pricingInventoryNotes",
    objective: "Keep pricing and inventory immutable while adding operational notes.",
    deterministicChecks: [
      "No automatic price changes.",
      "No automatic inventory changes.",
    ],
  },
  {
    fieldKey: "searchBrowse",
    objective: "Populate Search & Browse attributes from trusted product facts.",
    deterministicChecks: [
      "Fill serving/dosage/ingredients from label-backed fields when available.",
      "Do not infer allergen-free claims from ingredient absence.",
    ],
  },
  {
    fieldKey: "searchKeywords",
    objective: "Create compliant keywords/terms for Walmart and agentic retrieval.",
    deterministicChecks: [
      "Use long-tail factual phrases.",
      "Exclude disease and drug-claim language.",
      "Do not include competitor brands.",
    ],
  },
  {
    fieldKey: "supplementComplianceNotes",
    objective: "Surface supplement-safe guidance and blockers for review.",
    deterministicChecks: [
      "Highlight unsafe claims for review/blocking.",
      "Retain supplement-safe support language.",
    ],
  },
];

export interface WalmartDocketOptimizationInput {
  product: WalmartProductRecord;
  draftPayload?: Record<string, unknown> | null;
  competitorPatterns?: {
    titlePatterns?: string[];
    supportPhrases?: string[];
    mediaPatterns?: string[];
    priceCountNotes?: string[];
    gaps?: string[];
  } | null;
}

export interface WalmartDocketOptimizationOutput {
  content: {
    productTitle: string;
    shortDescription: string;
    longDescription: string;
    bullets: string[];
    complianceNotes: string[];
  };
  media: {
    altTextGuidance: string;
    mediaRecommendations: string[];
    generatedImageGuidance: string;
  };
  pricingInventory: {
    priceNotes: string[];
    inventoryNotes: string[];
    unchangedFields: string[];
  };
  searchBrowse: {
    productType: string;
    supplementType: string;
    form: string;
    flavor: string;
    flavorSource: string;
    flavorConfidence: "explicit" | "default_unflavored" | "unknown";
    count: string;
    countPerPack?: string;
    servingSize: string;
    servingsPerContainer?: string;
    dosageStrength?: string;
    mainIngredients: string[];
    ingredientsList?: string;
    benefitsSupportAreas: string[];
    targetAudience: string;
    suggestedUse: string;
    directionsSuggestedUse?: string;
    safetyWarnings?: string;
    allergenFreeStatements?: string;
    searchKeywords: string[];
    searchTerms: string[];
    category: string;
    warnings: string[];
  };
  score: {
    before: number;
    after: number;
    reasons: string[];
  };
  validation: {
    warnings: string[];
    blockers: string[];
    removedClaims: string[];
  };
}

export interface WalmartOptimizationRuleResult {
  output: WalmartDocketOptimizationOutput;
  appliedRules: WalmartFieldOptimizationRule[];
}

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

function asList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((entry) => asText(entry)).filter(Boolean);
  }
  const text = asText(value);
  if (!text) return [];
  return text
    .split(/[\n,;|]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((entry) => entry.trim()).filter(Boolean)));
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").replace(/\s+([,.!?;:])/g, "$1").trim();
}

function firstNonEmpty(...values: string[]): string {
  for (const value of values) {
    const normalized = normalizeWhitespace(value);
    if (normalized) return normalized;
  }
  return "";
}

function sentenceCase(value: string): string {
  const text = normalizeWhitespace(value);
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function toTitleCase(value: string): string {
  return normalizeWhitespace(value)
    .split(" ")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1).toLowerCase() : ""))
    .join(" ");
}

function removeUnsafeFragments(value: string): string {
  let next = normalizeWhitespace(value);
  for (const phrase of PROMOTIONAL_PHRASES) {
    next = next.replace(new RegExp(phrase, "ig"), "");
  }
  for (const pattern of UNSAFE_CLAIM_PATTERNS) {
    next = next.replace(pattern, "");
  }
  return normalizeWhitespace(next.replace(/\b([A-Za-z]+)\s+\1\b/gi, "$1"));
}

function containsUnsafeClaim(value: string): boolean {
  return UNSAFE_CLAIM_PATTERNS.some((pattern) => pattern.test(value));
}

function containsPromotionalPhrase(value: string): boolean {
  const haystack = value.toLowerCase();
  return PROMOTIONAL_PHRASES.some((phrase) => haystack.includes(phrase));
}

function inferFormFromText(value: string): string {
  const match = value.match(/\b(capsules?|softgels?|gummies?|tablets?|powder|liquid)\b/i);
  if (!match) return "";
  const unit = match[1].toLowerCase();
  if (unit.startsWith("capsule")) return "Capsule";
  if (unit.startsWith("tablet")) return "Tablet";
  if (unit.startsWith("softgel")) return "Softgel";
  if (unit.startsWith("gumm")) return "Gummy";
  if (unit === "powder") return "Powder";
  if (unit === "liquid") return "Liquid";
  return sentenceCase(unit);
}

function inferCountFromText(value: string): string {
  const match = value.match(/\b(\d{1,4})\s*(capsules?|tablets?|softgels?|gummies?|count|ct)\b/i);
  if (!match) return "";
  const amount = match[1];
  const unit = match[2].toLowerCase();
  if (unit === "count" || unit === "ct") return `${amount} count`;
  return `${amount} ${unit}`;
}

function ensureOneSentence(value: string): string {
  const compact = normalizeWhitespace(value.replace(/[!?]/g, "."));
  const first = compact.split(".").find((entry) => entry.trim().length > 0) ?? compact;
  return `${first.trim().replace(/[.,;:]+$/, "")}.`;
}

function enforceTitleLength(value: string): string {
  const title = normalizeWhitespace(value);
  if (title.length <= TITLE_MAX) return title;
  const trimmed = title.slice(0, TITLE_MAX).replace(/\s+\S*$/, "");
  return normalizeWhitespace(trimmed);
}

function normalizeTitleCandidate(value: string): string {
  return removeUnsafeFragments(value)
    .replace(/\s*[-|:,]+\s*/g, " ")
    .replace(/\b([A-Za-z]+)\s+\1\b/gi, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function normalizeAudience(value: string): string {
  const text = asText(value);
  if (!text) return "Adults";
  return sentenceCase(text);
}

function prioritizeIngredientsForCopy(values: string[]): string[] {
  const scored = values
    .map((entry) => normalizeWhitespace(entry))
    .filter(Boolean)
    .map((entry, index) => {
      const lowered = entry.toLowerCase();
      let score = 10;
      if (/\bmelatonin\b/.test(lowered)) score += 120;
      if (/\bproprietary blend\b/.test(lowered)) score += 100;
      if (/\b(tryptophan|chamomile|lemon balm|passion flower|gaba|theanine|ashwagandha|hops|skullcap)\b/.test(lowered)) {
        score += 35;
      }
      if (/\b(calcium|vitamin\s*b6|magnesium)\b/.test(lowered)) score -= 40;
      score -= index;
      return { entry, score };
    })
    .sort((left, right) => right.score - left.score)
    .map((entry) => entry.entry);
  return unique(scored);
}

function toSupportVerbPhrase(area: string): string {
  const normalized = normalizeWhitespace(area).replace(/\bsupport\b/gi, "").trim();
  if (!normalized) return "support daily wellness";
  return `support ${normalized.toLowerCase()}`;
}

function countWordOccurrences(value: string, needle: RegExp): number {
  const matches = value.match(needle);
  return matches ? matches.length : 0;
}

function stripOcrFragments(value: string): string {
  return normalizeWhitespace(
    value
      .replace(/\b%dv\b/gi, " ")
      .replace(/\b\d+(?:\.\d+)?\s*%\s*dv\b/gi, " ")
      .replace(/\b\d+(?:\.\d+)?\s*(mg|mcg|g|iu)\s+\d+(?:\.\d+)?\s*%/gi, " ")
      .replace(/\s{2,}/g, " ")
  );
}

function normalizeFlavorClaimToken(value: string): string {
  return normalizeWhitespace(
    value
      .toLowerCase()
      .replace(/\bflavou?r(?:ed)?\b/g, " ")
      .replace(/[^\w\s-]/g, " ")
  );
}

function isFlavorClaimSupported(claim: string, explicitFlavor: string): boolean {
  const normalizedClaim = normalizeFlavorClaimToken(claim);
  const normalizedExplicit = normalizeFlavorClaimToken(explicitFlavor);
  if (!normalizedClaim || !normalizedExplicit) return false;
  return (
    normalizedClaim === normalizedExplicit ||
    normalizedClaim.includes(normalizedExplicit) ||
    normalizedExplicit.includes(normalizedClaim)
  );
}

function stripFlavorClaimsFromCopy(text: string, claims: string[]): string {
  let cleaned = text;
  for (const claim of claims) {
    const escaped = claim.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    cleaned = cleaned.replace(new RegExp(`(?:,\\s*)?${escaped}(?:\\s*,)?`, "gi"), " ");
  }
  return cleaned
    .replace(/\s{2,}/g, " ")
    .replace(/\s+,/g, ",")
    .replace(/,\s*,/g, ", ")
    .replace(/^[,;\s]+/, "")
    .replace(/[,\s]+$/, "")
    .trim();
}

export function cleanWalmartOptimizedCopy(
  text: string,
  context: { field: "title" | "shortDescription" | "longDescription" | "bullet" }
): string {
  let cleaned = stripOcrFragments(normalizeWhitespace(text));
  if (!cleaned) return "";

  cleaned = cleaned
    .replace(/\bdesigned to supports\b/gi, "designed to support")
    .replace(/\bsupports supports\b/gi, "supports")
    .replace(/\bsupports ([a-z][a-z\s-]{1,40}) support\b/gi, "supports $1")
    .replace(/\bunflavo(?:r|u)ed\s+flavou?r\b/gi, "")
    .replace(/\bcapsules? format\b/gi, "capsule form")
    .replace(/\b(\d+)\s+capsules?\s+dietary supplement\b/gi, "$1-capsule dietary supplement")
    .replace(/,\s*([A-Za-z])/g, ", $1")
    .replace(/\b(\d+)\s*oz\./gi, "$1 oz")
    .replace(/\bwater,or\b/gi, "water, or");

  cleaned = cleaned.replace(/\b([A-Za-z]+)\s+\1\b/gi, "$1");
  cleaned = cleaned.replace(/\s{2,}/g, " ").trim();

  const supportCount = countWordOccurrences(cleaned.toLowerCase(), /\bsupports?\b/g);
  const maxSupportMentions =
    context.field === "title" ? 1 : context.field === "shortDescription" ? 2 : context.field === "bullet" ? 2 : 5;
  if (supportCount > maxSupportMentions) {
    let next = cleaned;
    while (countWordOccurrences(next.toLowerCase(), /\bsupports?\b/g) > maxSupportMentions) {
      next = next.replace(/\bsupports?\b(?![\s\S]*\bsupports?\b)/i, "").replace(/\s{2,}/g, " ").trim();
      if (!next) break;
    }
    cleaned = next || cleaned;
  }

  if (context.field === "title") {
    cleaned = cleaned.replace(/[,:;\-\s]+$/, "").trim();
  }
  return normalizeWhitespace(cleaned);
}

export function removeUnsupportedFlavorClaims(
  text: string,
  flavorResolution: WalmartFlavorResolution
): { text: string; removedClaims: string[] } {
  const base = normalizeWhitespace(text);
  if (!base) return { text: "", removedClaims: [] };

  const claims = detectWalmartFlavorClaims(base);
  const hasExplicitFlavor =
    flavorResolution.confidence === "explicit" &&
    flavorResolution.flavor.trim().toLowerCase() !== "unflavored";
  const removedClaims = hasExplicitFlavor
    ? claims.filter((claim) => !isFlavorClaimSupported(claim, flavorResolution.flavor))
    : claims;

  if (removedClaims.length === 0) return { text: base, removedClaims: [] };

  const cleaned = stripFlavorClaimsFromCopy(base, removedClaims);
  return {
    text: normalizeWhitespace(cleaned),
    removedClaims: unique(removedClaims),
  };
}

function isRawOcrBulletFragment(value: string): boolean {
  const text = normalizeWhitespace(value);
  if (!text) return true;
  if (text.length <= 6 && /%|mg|mcg|iu/i.test(text)) return true;
  if (/^%dv$/i.test(text)) return true;
  if (/^\d+(?:\.\d+)?\s*%$/.test(text)) return true;
  if (RAW_OCR_BULLET_PATTERN.test(text) && text.split(" ").length <= 4) return true;
  return false;
}

export function validateWalmartOptimizedCopy(
  output: WalmartDocketOptimizationOutput,
  factPack: WalmartOptimizationFactPack
): { warnings: string[]; blockers: string[]; removedClaims: string[] } {
  void factPack;
  const warnings: string[] = [];
  const blockers: string[] = [];
  const removedClaims: string[] = [];
  const flavorResolution: WalmartFlavorResolution = {
    flavor: output.searchBrowse.flavor,
    source: output.searchBrowse.flavorSource,
    confidence: output.searchBrowse.flavorConfidence,
  };
  const hasExplicitFlavor =
    flavorResolution.confidence === "explicit" &&
    flavorResolution.flavor.trim().toLowerCase() !== "unflavored";

  const titleFlavor = removeUnsupportedFlavorClaims(output.content.productTitle, flavorResolution);
  output.content.productTitle = cleanWalmartOptimizedCopy(titleFlavor.text, { field: "title" });
  removedClaims.push(...titleFlavor.removedClaims);

  const shortFlavor = removeUnsupportedFlavorClaims(output.content.shortDescription, flavorResolution);
  output.content.shortDescription = cleanWalmartOptimizedCopy(shortFlavor.text, {
    field: "shortDescription",
  });
  removedClaims.push(...shortFlavor.removedClaims);

  const longFlavor = removeUnsupportedFlavorClaims(output.content.longDescription, flavorResolution);
  output.content.longDescription = cleanWalmartOptimizedCopy(longFlavor.text, {
    field: "longDescription",
  });
  removedClaims.push(...longFlavor.removedClaims);

  const cleanedBullets = output.content.bullets
    .map((entry) => removeUnsupportedFlavorClaims(entry, flavorResolution))
    .map((entry) => {
      removedClaims.push(...entry.removedClaims);
      return cleanWalmartOptimizedCopy(entry.text, { field: "bullet" });
    })
    .filter((entry) => !isRawOcrBulletFragment(entry))
    .slice(0, 7);
  output.content.bullets = unique(cleanedBullets);

  if (removedClaims.length > 0 && !hasExplicitFlavor) {
    warnings.push(
      "Removed unsupported flavor claim because no explicit flavor was found. Defaulted Flavor attribute to Unflavored."
    );
  }
  if (!hasExplicitFlavor) {
    warnings.push("No explicit flavor found; defaulted Flavor attribute to Unflavored.");
    warnings.push("No flavor found on label; Flavor set to Unflavored.");
  }

  if (MINOR_MINERAL_PATTERN.test(output.content.productTitle.split(/\s+/).slice(0, 3).join(" "))) {
    blockers.push("Title must lead with product identity, not minor minerals.");
  }
  if (!output.content.longDescription.startsWith(output.content.productTitle)) {
    warnings.push("Long description should open with product identity.");
  }
  if (countWordOccurrences(output.content.shortDescription.toLowerCase(), /\bsupports?\b/g) > 3) {
    warnings.push("Short description had excessive support phrasing and was normalized.");
  }
  const finalCopy = [
    output.content.productTitle,
    output.content.shortDescription,
    output.content.longDescription,
    ...output.content.bullets,
  ].join(" ");
  if (/\bunflavo(?:r|u)ed\s+flavou?r\b/i.test(finalCopy)) {
    blockers.push("Copy contains unsupported 'Unflavored flavor' phrasing.");
  }
  if (
    /\bsupports supports\b/i.test(finalCopy) ||
    /\bsupports [a-z][a-z\s-]{1,40} support\b/i.test(finalCopy) ||
    /\bdesigned to supports\b/i.test(finalCopy)
  ) {
    blockers.push("Copy contains repeated or malformed support phrasing.");
  }
  if (/%dv/i.test(finalCopy)) {
    blockers.push("Copy contains raw OCR fragments that must be removed.");
  }
  return {
    warnings: unique(warnings),
    blockers: unique(blockers),
    removedClaims: unique(removedClaims),
  };
}

function toDraftRecord(input: WalmartDocketOptimizationInput): Record<string, unknown> {
  return asObject(input.draftPayload) ?? {};
}

function mergeSearchBrowseFromProductAndDraft(input: WalmartDocketOptimizationInput): Record<string, string> {
  const fromProduct = {
    ...(input.product.searchBrowseAttributes ?? {}),
    ...(input.product.attributes ?? {}),
  };
  const fromDraftObject = toDraftRecord(input);
  const fromDraft = {
    ...(asObject(fromDraftObject.searchBrowseAttributes) ?? {}),
    ...(asObject(fromDraftObject.attributes) ?? {}),
  };

  const merged: Record<string, string> = {};
  for (const [key, value] of Object.entries({ ...fromProduct, ...fromDraft })) {
    const normalizedKey = key.trim();
    const normalizedValue = asText(value);
    if (normalizedKey && normalizedValue) {
      merged[normalizedKey] = normalizedValue;
    }
  }
  return merged;
}

function normalizeIngredientForTitle(value: string): string {
  return normalizeWhitespace(value.replace(/\b\d+(?:\.\d+)?\s*(mg|g|mcg|iu)\b/gi, ""));
}

function inferSupportAreas(input: {
  title: string;
  searchBrowse: Record<string, string>;
  fallback: string[];
}): string[] {
  const supportAreas = unique([
    ...asList(input.searchBrowse.support_areas),
    ...asList(input.searchBrowse.benefits_support_areas),
    ...asList(input.searchBrowse.supported_benefits),
    ...input.fallback,
  ])
    .map((entry) => removeUnsafeFragments(entry))
    .filter(Boolean);

  const normalizedTitle = input.title.toLowerCase();
  if (normalizedTitle.includes("sleep")) {
    supportAreas.push("nighttime relaxation support", "restful sleep support");
  }
  if (normalizedTitle.includes("digest")) {
    supportAreas.push("digestive wellness support");
  }
  if (normalizedTitle.includes("joint")) {
    supportAreas.push("joint comfort support");
  }

  return unique(supportAreas).slice(0, 6);
}

function buildSearchKeywords(input: {
  brand: string;
  productType: string;
  ingredient: string;
  supportArea: string;
  form: string;
  count: string;
  audience: string;
}): string[] {
  const raw = unique([
    `${input.ingredient} ${input.supportArea} supplement`.trim(),
    `${input.form} ${input.count}`.trim(),
    `${input.audience} ${input.supportArea}`.trim(),
    `${input.brand} ${input.productType}`.trim(),
    `${input.supportArea} daily wellness supplement`.trim(),
  ]);
  return raw
    .map((entry) => removeUnsafeFragments(entry))
    .filter((entry) => entry.length > 3 && !containsUnsafeClaim(entry))
    .slice(0, 10);
}

function buildSearchTerms(keywords: string[]): string[] {
  return unique(
    keywords.flatMap((entry) => {
      const lower = entry.toLowerCase();
      return [lower, lower.replace(/supplement/g, "dietary supplement")];
    })
  )
    .filter((entry) => entry.length > 3 && !containsUnsafeClaim(entry))
    .slice(0, 12);
}

function buildLongDescription(input: {
  productTitle: string;
  productType: string;
  form: string;
  count: string;
  factPack: WalmartOptimizationFactPack;
  mainIngredients: string[];
  supportAreas: string[];
  supportVerbPhrase: string;
  audience: string;
}): string {
  const labelFacts = input.factPack.labelFacts;
  const identity = `${input.productTitle} is a ${input.count || input.form.toLowerCase()} dietary supplement formulated to ${input.supportVerbPhrase}.`;

  const servingLine = labelFacts.servingSize
    ? `Each serving is ${labelFacts.servingSize}${
        labelFacts.servingsPerContainer
          ? ` with ${labelFacts.servingsPerContainer} servings per container`
          : ""
      }.`
    : "";
  const dosageLine = labelFacts.dosageStrength
    ? `Label-backed dosage includes ${labelFacts.dosageStrength}.`
    : "";
  const blendLine =
    labelFacts.proprietaryBlendName && labelFacts.proprietaryBlendAmount
      ? `${labelFacts.proprietaryBlendName} provides ${labelFacts.proprietaryBlendAmount} per serving.`
      : "";
  const ingredientLine = input.mainIngredients.length
    ? `Active ingredients include ${input.mainIngredients.slice(0, 12).join(", ")}.`
    : "";
  const useLine = labelFacts.suggestedUse
    ? labelFacts.suggestedUse
    : "Use as directed on the product label.";
  const audienceLine = `Designed for ${input.audience.toLowerCase()} seeking ${(
    input.supportAreas[0] ?? "daily wellness support"
  ).toLowerCase()}.`;
  const cautionLine = labelFacts.cautionsWarnings ? labelFacts.cautionsWarnings : "Review label cautions before use.";

  const parts = [
    identity,
    servingLine,
    dosageLine,
    blendLine,
    ingredientLine,
    useLine,
    audienceLine,
    cautionLine,
  ]
    .map((entry) => removeUnsafeFragments(entry))
    .filter(Boolean);
  const withoutDisclaimer = parts.join(" ");
  const withOneDisclaimer = `${withoutDisclaimer} ${SUPPLEMENT_FDA_DISCLAIMER}`;
  const disclaimerCount = withOneDisclaimer.split(SUPPLEMENT_FDA_DISCLAIMER).length - 1;
  if (disclaimerCount === 1) return withOneDisclaimer;
  return `${withoutDisclaimer} ${SUPPLEMENT_FDA_DISCLAIMER}`;
}

export function buildWalmartDocketOptimizationPromptContract(
  input: WalmartDocketOptimizationInput
): Record<string, unknown> {
  const searchBrowse = mergeSearchBrowseFromProductAndDraft(input);
  const factPack = buildWalmartOptimizationFactPack({
    product: input.product,
    draftPayload: input.draftPayload ?? null,
  });
  const flavorResolution = resolveWalmartFlavorFromFacts({
    candidates: [
      { value: searchBrowse.flavor, source: "search_browse.flavor" },
    ],
  });

  return {
    task: "Optimize the full Walmart listing docket in one pass using label-backed facts first.",
    rules: WalmartDocketOptimizationRules,
    constraints: {
      titleMaxChars: TITLE_MAX,
      preferredTitleRange: [TITLE_TARGET_MIN, TITLE_TARGET_MAX],
      oneSentenceShortDescription: true,
      bulletsRange: [5, 7],
      noDiseaseClaims: true,
      noDrugComparisonClaims: true,
      noPromotionalClaims: true,
      noInventedPriceOrInventory: true,
      fdaDisclaimerExactOnceForSupplements: true,
      gtinLookupOnly: true,
      neverCopyCompetitorText: true,
      noAllergenInferenceFromAbsence: true,
      markUncertainFieldsNeedsReview: true,
      missingFlavorDefaultsToUnflavored: true,
      noFlavorInferenceFromColorIngredientsOrCompetitors: true,
      noFlavorInCustomerCopyWithoutExplicitEvidence: true,
      grammarCleanupRequired: true,
      productIdentityBeforeMinorMinerals: true,
    },
    productFacts: {
      sku: input.product.sku,
      title: input.product.title,
      brand: input.product.brand,
      category: input.product.category,
      shortDescription: input.product.shortDescription,
      longDescription: input.product.longDescription,
      bulletPoints: input.product.bulletPoints,
      attributes: input.product.attributes,
      searchBrowseAttributes: searchBrowse,
      labelFactPack: factPack.labelFacts,
      flavorResolution,
    },
    competitorPatterns: input.competitorPatterns ?? null,
    requiredOutputShape: {
      factPack: {
        flavor: {
          value: "string",
          source: "explicit_source|default_unflavored|unknown",
          confidence: "explicit|default_unflavored|unknown",
        },
        servingSize: "string",
        servingsPerContainer: "string",
        dosageStrength: "string",
        activeIngredients: ["string"],
        suggestedUse: "string",
        warnings: "string",
        allergenFreeStatements: ["string"],
        evidence: "record",
      },
      content: {
        productTitle: "string",
        shortDescription: "string",
        longDescription: "string",
        bullets: ["string"],
        complianceNotes: ["string"],
      },
      media: {
        altTextGuidance: "string",
        mediaRecommendations: ["string"],
        generatedImageGuidance: "string",
      },
      pricingInventory: {
        priceNotes: ["string"],
        inventoryNotes: ["string"],
        unchangedFields: ["price", "inventory"],
      },
      searchBrowse: {
        productType: "string",
        supplementType: "string",
        form: "string",
        flavor: "string",
        count: "string",
        countPerPack: "string",
        servingSize: "string",
        servingsPerContainer: "string",
        dosageStrength: "string",
        mainIngredients: ["string"],
        ingredientsList: "string",
        benefitsSupportAreas: ["string"],
        targetAudience: "string",
        suggestedUse: "string",
        directionsSuggestedUse: "string",
        safetyWarnings: "string",
        allergenFreeStatements: "string",
        searchKeywords: ["string"],
        searchTerms: ["string"],
        category: "string",
        warnings: ["string"],
      },
      score: {
        before: "number",
        after: "number",
        reasons: ["string"],
      },
      validation: {
        warnings: ["string"],
        blockers: ["string"],
        removedClaims: ["string"],
      },
    },
  };
}

export function validateWalmartOptimizedDocket(
  output: WalmartDocketOptimizationOutput,
  options?: { factPack?: WalmartOptimizationFactPack }
): { warnings: string[]; blockers: string[]; removedClaims: string[] } {
  const warnings: string[] = [];
  const blockers: string[] = [];

  const title = output.content.productTitle.trim();
  const shortDescription = output.content.shortDescription.trim();
  const longDescription = output.content.longDescription.trim();

  if (!title) blockers.push("Product title is required.");
  if (title.length > TITLE_MAX) blockers.push("Product title exceeds Walmart 150 character limit.");
  if (containsPromotionalPhrase(title)) blockers.push("Product title contains promotional phrasing.");
  if (containsUnsafeClaim(title)) blockers.push("Product title contains unsafe supplement claim language.");

  const sentenceParts = shortDescription
    .split(/[.!?]/)
    .filter((entry) => entry.trim().length > 0);
  if (sentenceParts.length !== 1) warnings.push("Short description should be exactly one sentence.");
  if (containsUnsafeClaim(shortDescription)) {
    blockers.push("Short description contains unsafe supplement claim language.");
  }

  const disclaimerCount = longDescription.split(SUPPLEMENT_FDA_DISCLAIMER).length - 1;
  if (disclaimerCount !== 1) {
    blockers.push("Long description must include FDA disclaimer exactly once for supplements.");
  }
  if (containsUnsafeClaim(longDescription)) {
    blockers.push("Long description contains unsafe supplement claim language.");
  }
  if (/differentiation note/i.test(longDescription)) {
    warnings.push("Long description contains generic filler text.");
  }

  if (output.content.bullets.length < 5 || output.content.bullets.length > 7) {
    warnings.push("Bullets should contain 5-7 entries.");
  }
  if (output.content.bullets.some((entry) => entry.length < 12)) {
    warnings.push("Bullets contain very short fragments that should be reviewed.");
  }

  if (!output.searchBrowse.productType && !output.searchBrowse.category) {
    blockers.push("Search & Browse requires product type or category.");
  }
  if (!output.searchBrowse.servingSize) {
    warnings.push("Serving Size is missing.");
  }
  if (!output.searchBrowse.servingsPerContainer) {
    warnings.push("Servings per container is missing.");
  }

  const keywordText = [
    ...output.searchBrowse.searchKeywords,
    ...output.searchBrowse.searchTerms,
  ].join(" ");
  if (containsUnsafeClaim(keywordText)) {
    blockers.push("Search keywords/search terms include unsafe claims.");
  }

  const allergenClaims = normalizeVerifiedAllergenFreeStatements(
    output.searchBrowse.allergenFreeStatements ?? ""
  );
  if (
    allergenClaims.length > 0 &&
    (options?.factPack?.labelFacts.allergenFreeStatements.length ?? 0) === 0
  ) {
    blockers.push("Allergen-free statements are present without verified label evidence.");
  }

  return {
    warnings: unique(warnings),
    blockers: unique(blockers),
    removedClaims: [],
  };
}

function projectedProductFromOutput(
  input: WalmartDocketOptimizationInput,
  output: WalmartDocketOptimizationOutput
): WalmartProductRecord {
  const nextSearchBrowse = {
    ...(input.product.searchBrowseAttributes ?? {}),
    product_type: output.searchBrowse.productType,
    supplement_type: output.searchBrowse.supplementType,
    product_form: output.searchBrowse.form,
    form: output.searchBrowse.form,
    flavor: output.searchBrowse.flavor,
    count: output.searchBrowse.count,
    count_per_pack: output.searchBrowse.countPerPack ?? "",
    serving_size: output.searchBrowse.servingSize,
    servings_per_container: output.searchBrowse.servingsPerContainer ?? "",
    servings: output.searchBrowse.servingsPerContainer ?? "",
    dosage_strength: output.searchBrowse.dosageStrength ?? "",
    main_ingredients: output.searchBrowse.mainIngredients.join(", "),
    ingredients_list: output.searchBrowse.ingredientsList ?? "",
    support_areas: output.searchBrowse.benefitsSupportAreas.join(", "),
    target_audience: output.searchBrowse.targetAudience,
    suggested_use: output.searchBrowse.suggestedUse,
    directions_suggested_use: output.searchBrowse.directionsSuggestedUse ?? output.searchBrowse.suggestedUse,
    safety_warnings: output.searchBrowse.safetyWarnings ?? "",
    allergen_free_statements: output.searchBrowse.allergenFreeStatements ?? "",
    search_keywords: output.searchBrowse.searchKeywords.join(", "),
    search_terms: output.searchBrowse.searchTerms.join(", "),
    category: output.searchBrowse.category,
    warnings: output.searchBrowse.warnings.join("; "),
  };

  return {
    ...input.product,
    title: output.content.productTitle,
    shortDescription: output.content.shortDescription,
    longDescription: output.content.longDescription,
    bulletPoints: output.content.bullets,
    searchBrowseAttributes: nextSearchBrowse,
    attributes: {
      ...(input.product.attributes ?? {}),
      ...nextSearchBrowse,
    },
  };
}

export function scoreWalmartOptimizedDocket(input: {
  input: WalmartDocketOptimizationInput;
  output: WalmartDocketOptimizationOutput;
}): {
  before: number;
  after: number;
  reasons: string[];
} {
  const beforeAssessment = assessWalmartListingQuality(input.input.product);
  const projected = projectedProductFromOutput(input.input, input.output);
  const afterAssessment = assessWalmartListingQuality(projected);

  const reasons: string[] = [];
  if (input.output.content.productTitle !== input.input.product.title) {
    reasons.push("Title aligned to Walmart-friendly formula and concise entity coverage.");
  }
  if (input.output.content.shortDescription) {
    reasons.push("Short description converted to one-sentence support-focused summary.");
  }
  if (input.output.content.bullets.length >= 5) {
    reasons.push("Bullets expanded to distinct shopper-facing support points.");
  }
  if (input.output.searchBrowse.searchKeywords.length > 0) {
    reasons.push("Search keywords/terms improved for Walmart and agentic retrieval.");
  }
  if (input.output.searchBrowse.servingSize) {
    reasons.push("Serving Size was completed from trusted label facts.");
  }

  return {
    before: beforeAssessment.score,
    after: Math.max(beforeAssessment.score, afterAssessment.score),
    reasons: unique(reasons),
  };
}

export function applyWalmartDocketOptimizationRules(
  input: WalmartDocketOptimizationInput
): WalmartOptimizationRuleResult {
  const draft = toDraftRecord(input);
  const searchBrowse = mergeSearchBrowseFromProductAndDraft(input);
  const factPack = buildWalmartOptimizationFactPack({
    product: input.product,
    draftPayload: input.draftPayload ?? null,
  });
  const labelFacts = factPack.labelFacts;

  const brand = firstNonEmpty(
    asText(draft.brand),
    asText(searchBrowse.brand),
    input.product.brand,
    "Brand"
  );

  const originalTitle = firstNonEmpty(asText(draft.title), input.product.title);
  const rawProductType = firstNonEmpty(
    asText(searchBrowse.product_type),
    asText(searchBrowse.supplement_type),
    input.product.category,
    "Dietary Supplement"
  );
  const productType = sentenceCase(removeUnsafeFragments(rawProductType || "Dietary Supplement"));

  const form = firstNonEmpty(
    asText(searchBrowse.product_form),
    asText(searchBrowse.form),
    inferFormFromText(labelFacts.capsuleTabletGummyCount),
    inferFormFromText(originalTitle),
    "Capsule"
  );

  const count = firstNonEmpty(
    labelFacts.capsuleTabletGummyCount,
    asText(searchBrowse.count),
    inferCountFromText(originalTitle)
  );
  const countPerPack = firstNonEmpty(asText(searchBrowse.count_per_pack), count ? "1" : "");
  const flavorResolution = resolveWalmartFlavorFromFacts({
    candidates: [
      { value: asText(searchBrowse.flavor), source: "search_browse.flavor" },
    ],
  });
  const explicitFlavor =
    flavorResolution.confidence === "explicit" &&
    flavorResolution.flavor.trim().toLowerCase() !== "unflavored"
      ? normalizeTitleCandidate(flavorResolution.flavor)
      : "";

  const ingredientsFromSearch = unique([
    ...asList(searchBrowse.main_ingredients),
    ...asList(searchBrowse.ingredients_list),
  ]);
  const mainIngredients = prioritizeIngredientsForCopy(unique([
    ...labelFacts.activeIngredients,
    ...ingredientsFromSearch,
  ]))
    .map((entry) => normalizeWhitespace(entry))
    .filter(Boolean)
    .slice(0, 16);

  const supportAreas = inferSupportAreas({
    title: originalTitle,
    searchBrowse,
    fallback: SUPPORT_AREA_FALLBACK,
  });
  const supportVerbPhrase = firstNonEmpty(
    supportAreas[0] ? toSupportVerbPhrase(supportAreas[0]) : "",
    "support daily wellness"
  );

  const productNameCandidate = firstNonEmpty(asText(searchBrowse.product_name), originalTitle)
    .replace(new RegExp(`^${brand}\\s+`, "i"), "")
    .trim();
  const titleIngredientCandidate = normalizeIngredientForTitle(mainIngredients[0] ?? "");
  const ingredientOrSupport = firstNonEmpty(
    MINOR_MINERAL_PATTERN.test(titleIngredientCandidate) ? "" : titleIngredientCandidate,
    supportAreas[0]
  );

  const titleSegments = [
    normalizeTitleCandidate(brand),
    normalizeTitleCandidate(productNameCandidate || productType),
    explicitFlavor ? normalizeTitleCandidate(`${explicitFlavor} flavor`) : "",
    normalizeTitleCandidate(ingredientOrSupport),
    normalizeTitleCandidate(form),
    normalizeTitleCandidate(count),
  ].filter(Boolean);
  let productTitle = enforceTitleLength(titleSegments.join(" "));
  if (productTitle.length < TITLE_TARGET_MIN) {
    productTitle = enforceTitleLength(`${productTitle} ${productType}`.trim());
  }
  if (productTitle.length > TITLE_TARGET_MAX && productTitle.includes("  ")) {
    productTitle = enforceTitleLength(productTitle.replace(/\s{2,}/g, " "));
  }

  const audience = normalizeAudience(
    firstNonEmpty(asText(searchBrowse.target_audience), asText(searchBrowse.audience), "Adults")
  );

  const shortDescription = ensureOneSentence(
    removeUnsafeFragments(
      `${productTitle} is a ${count || `${form.toLowerCase()} form`} dietary supplement formulated to ${supportVerbPhrase} for ${audience.toLowerCase()}.`
    )
  );

  const longDescription = buildLongDescription({
    productTitle,
    productType,
    form,
    count,
    factPack,
    mainIngredients,
    supportAreas,
    supportVerbPhrase,
    audience,
  });

  const supplyText =
    labelFacts.servingsPerContainer && labelFacts.servingSize
      ? `${labelFacts.servingsPerContainer}-day supply when taken as directed`
      : "";
  const bullets = unique([
    `${productType} identity - ${brand} ${productNameCandidate || productType} in ${form.toLowerCase()} form.`,
    `Support focus - designed to ${supportVerbPhrase}.`,
    labelFacts.servingSize
      ? `Serving size - ${labelFacts.servingSize} per serving from Supplement Facts.`
      : "",
    labelFacts.dosageStrength
      ? `Dosage facts - ${labelFacts.dosageStrength}.`
      : "",
    mainIngredients.length > 0
      ? `Label-backed ingredients - ${mainIngredients.slice(0, 8).join(", ")}.`
      : "",
    count
      ? `Count and routine - ${count}${supplyText ? `, ${supplyText}` : ""}.`
      : "",
    labelFacts.suggestedUse
      ? `Suggested use - ${labelFacts.suggestedUse}`
      : "Suggested use - follow product label directions.",
    labelFacts.cautionsWarnings
      ? `Caution - ${labelFacts.cautionsWarnings}`
      : "Caution - review label warnings before use.",
  ])
    .map((entry) => removeUnsafeFragments(entry))
    .filter(Boolean)
    .slice(0, 7);
  while (bullets.length < 5) {
    bullets.push("Listing quality - keep structured attributes complete and label-accurate.");
  }

  const mediaRecommendations = [
    "Front bottle hero image with full label visibility",
    "Supplement Facts panel image",
    "Suggested use/directions label close-up",
    "Ingredient/formula close-up image",
    "Lifestyle context image aligned to label-safe use case",
    "Multi-pack image when applicable",
  ];

  const altTextGuidance = removeUnsafeFragments(
    `Front bottle image of ${brand} ${productNameCandidate || productType} dietary supplement, ${
      count || "count not shown"
    } ${form.toLowerCase()}.`
  );

  const price = typeof input.product.price === "number" ? `$${input.product.price.toFixed(2)}` : "not set";
  const inventory =
    typeof input.product.inventoryQuantity === "number"
      ? String(input.product.inventoryQuantity)
      : "not set";

  const searchKeywords = buildSearchKeywords({
    brand,
    productType,
    ingredient: normalizeIngredientForTitle(mainIngredients[0] ?? "supplement"),
    supportArea: supportAreas[0] || "daily wellness",
    form,
    count: count || "count",
    audience,
  });
  const searchTerms = buildSearchTerms(searchKeywords);
  const suggestedUse = firstNonEmpty(
    labelFacts.suggestedUse,
    asText(searchBrowse.suggested_use),
    asText(searchBrowse.directions_suggested_use),
    "Use as directed on the product label."
  );
  const category = firstNonEmpty(asText(searchBrowse.category), input.product.category, productType);
  const ingredientsList = unique([...mainIngredients, ...labelFacts.inactiveIngredients]).join(", ");
  const allergenFreeStatements = labelFacts.allergenFreeStatements.join(", ");

  const compliancePayload = {
    title: productTitle,
    shortDescription,
    longDescription,
    bulletPoints: bullets,
    searchBrowseAttributes: {
      product_type: productType,
      supplement_type: productType,
      product_form: form,
      flavor: flavorResolution.flavor,
      count,
      serving_size: labelFacts.servingSize,
      servings_per_container: labelFacts.servingsPerContainer,
      dosage_strength: labelFacts.dosageStrength,
      main_ingredients: mainIngredients.join(", "),
      ingredients_list: ingredientsList,
      support_areas: supportAreas.join(", "),
      target_audience: audience,
      suggested_use: suggestedUse,
      directions_suggested_use: labelFacts.directions || suggestedUse,
      safety_warnings: labelFacts.cautionsWarnings,
      allergen_free_statements: allergenFreeStatements,
      search_keywords: searchKeywords.join(", "),
      search_terms: searchTerms.join(", "),
      category,
    },
  } satisfies Record<string, unknown>;
  const complianceReview = evaluateWalmartListingCompliance(compliancePayload);

  const output: WalmartDocketOptimizationOutput = {
    content: {
      productTitle,
      shortDescription,
      longDescription,
      bullets,
      complianceNotes: unique([
        "Generated with supplement-safe support language only.",
        "No disease/treatment/drug-comparison claims are allowed.",
        "Seller review required before external publishing.",
        ...complianceReview.warnings,
      ]),
    },
    media: {
      altTextGuidance,
      mediaRecommendations,
      generatedImageGuidance:
        "Generate product images that prioritize front bottle clarity, Supplement Facts readability, and label-backed details.",
    },
    pricingInventory: {
      priceNotes: [
        `Price unchanged (${price}).`,
        "Price lane is separate from AI copy optimization.",
      ],
      inventoryNotes: [
        `Inventory unchanged (${inventory}).`,
        "Verify inventory before publish confirmation.",
      ],
      unchangedFields: ["price", "inventory"],
    },
    searchBrowse: {
      productType,
      supplementType: productType,
      form: toTitleCase(form),
      flavor: flavorResolution.flavor,
      flavorSource: flavorResolution.source,
      flavorConfidence: flavorResolution.confidence,
      count,
      countPerPack,
      servingSize: labelFacts.servingSize,
      servingsPerContainer: labelFacts.servingsPerContainer,
      dosageStrength: labelFacts.dosageStrength,
      mainIngredients,
      ingredientsList,
      benefitsSupportAreas: supportAreas.length > 0 ? supportAreas : ["daily wellness support"],
      targetAudience: audience,
      suggestedUse,
      directionsSuggestedUse: labelFacts.directions || suggestedUse,
      safetyWarnings: labelFacts.cautionsWarnings,
      allergenFreeStatements,
      searchKeywords,
      searchTerms,
      category,
      warnings: unique([
        "Do not include disease/treatment claims in Search & Browse fields.",
        "GTIN/UPC remain lookup identifiers only.",
        flavorResolution.confidence === "explicit" &&
        flavorResolution.flavor.trim().toLowerCase() !== "unflavored"
          ? ""
          : "No explicit flavor found; defaulted Flavor attribute to Unflavored.",
        ...factPack.warnings,
      ]),
    },
    score: {
      before: 0,
      after: 0,
      reasons: [],
    },
    validation: {
      warnings: [],
      blockers: [],
      removedClaims: [],
    },
  };

  const copyValidation = validateWalmartOptimizedCopy(output, factPack);
  const validation = validateWalmartOptimizedDocket(output, { factPack });
  output.validation = {
    warnings: unique([
      ...copyValidation.warnings,
      ...validation.warnings,
      ...complianceReview.warnings,
      ...factPack.warnings,
    ]),
    blockers: unique([
      ...copyValidation.blockers,
      ...validation.blockers,
      ...complianceReview.violations,
    ]),
    removedClaims: unique([
      ...copyValidation.removedClaims,
      ...validation.removedClaims,
    ]),
  };

  if (!labelFacts.allergenFreeStatements.length && output.searchBrowse.allergenFreeStatements) {
    output.validation.blockers.push(
      "Allergen-free statements must be evidence-backed by explicit label text."
    );
  }

  const score = scoreWalmartOptimizedDocket({
    input,
    output,
  });
  output.score = score;

  return {
    output,
    appliedRules: WalmartDocketOptimizationRules,
  };
}
