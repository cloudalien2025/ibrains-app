import { detectRiskyClaims } from "@/lib/ecomviper/walmart/walmart-ai-visibility-content-policy";
import {
  containsRepeatedSupportArtifact,
  countCanonicalSupplementDisclaimer,
  detectMalformedSupplementDisclaimerFragments,
  removeSupplementDisclaimerVariants,
  SUPPLEMENT_FDA_DISCLAIMER,
} from "@/lib/ecomviper/walmart/walmart-supplement-disclaimer";
import { normalizeSearchBrowseAttributes } from "@/lib/ecomviper/walmart/walmart-search-browse-attributes";

const PROMOTIONAL_PHRASES = [
  "best seller",
  "bestseller",
  "limited time",
  "free shipping",
  "money back guarantee",
  "100% guaranteed",
  "guaranteed results",
  "buy one get one",
];

const HARD_BLOCK_PHRASES = [
  "natural viagra",
  "works like cialis",
  "works like viagra",
  "prescription strength",
];

const MEDICAL_CONDITION_PATTERNS = [
  /\berectile dysfunction\b/i,
  /\bed\b/i,
  /\bhypertension\b/i,
  /\banxiety\b/i,
  /\binsomnia\b/i,
  /\bdepression\b/i,
  /\bdiabetes\b/i,
  /\barthritis\b/i,
];

const CLAIM_VERB_PATTERNS = [/\bcure(s|d)?\b/i, /\btreat(s|ed|ment)?\b/i, /\bprevent(s|ed|ion)?\b/i, /\breverse(s|d)?\b/i, /\bdiagnos(e|es|ed|is)\b/i];

const URL_PATTERN = /\bhttps?:\/\/|www\./i;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const PHONE_PATTERN = /\+?\d[\d\s().-]{7,}\d/;
const TREAT_CURE_PREVENT_PATTERN = /\b(diagnos(e|es|ed|is)|treat(s|ed|ment)?|cure(s|d)?|prevent(s|ed|ion)?)\b/i;
const TITLE_GENERIC_ONLY_PATTERN =
  /^(supplement|vitamin|wellness|health|formula|product|daily wellness supplement)\b[\s\W]*$/i;
const VAGUE_TITLE_TERM_PATTERN = /\b(supplement|vitamin|wellness|formula|product)\b/i;
const FORM_PATTERN = /\b(gummies?|capsules?|softgels?|tablets?|powder|liquid)\b/i;
const SERVING_SIZE_PATTERN = /serving\s*size\s*[:\-]?\s*([^\n.;|]+)/i;
const SERVINGS_PATTERN = /servings?\s*per\s*container\s*[:\-]?\s*([^\n.;|]+)/i;
const SUGGESTED_USE_PATTERN = /(?:suggested\s+use|directions?)\s*[:\-]?\s*([^\n]+(?:\n(?!warnings?|caution)[^\n]+){0,2})/i;
const WARNINGS_PATTERN = /(?:warnings?|caution)\s*[:\-]?\s*([^\n]+(?:\n(?!suggested\s+use|directions?)[^\n]+){0,2})/i;
const DOSAGE_STRENGTH_PATTERN = /\b([A-Za-z][A-Za-z\s()]+?)\s+(\d+(?:\.\d+)?\s?(?:mg|mcg|g|iu))\b/i;
const MAIN_INGREDIENT_PATTERN = /(?:active\s+ingredients?|main\s+ingredients?)\s*[:\-]?\s*([^\n|.]+)/i;

export interface WalmartComplianceResult {
  valid: boolean;
  violations: string[];
  warnings: string[];
  suggestions: string[];
}

function unique(list: string[]): string[] {
  return Array.from(new Set(list));
}

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asBulletPoints(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  }

  return [];
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function parseAttributeRecord(value: unknown): Record<string, unknown> {
  const direct = asObject(value);
  if (direct) return direct;
  if (typeof value !== "string") return {};

  const trimmed = value.trim();
  if (!trimmed) return {};
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    const parsedObject = asObject(parsed);
    return parsedObject ?? {};
  } catch {
    return {};
  }
}

function asSearchBrowseAttributes(payload: Record<string, unknown>): Record<string, string> {
  const fromSearchBrowse = normalizeSearchBrowseAttributes(
    parseAttributeRecord(payload.searchBrowseAttributes)
  );
  const fromAttributes = normalizeSearchBrowseAttributes(parseAttributeRecord(payload.attributes));
  return {
    ...fromAttributes,
    ...fromSearchBrowse,
  };
}

function hasAnyValue(record: Record<string, string>, keys: string[]): boolean {
  return keys.some((key) => Boolean(record[key]?.trim()));
}

function inferFromPattern(text: string, pattern: RegExp): string {
  const match = text.match(pattern);
  return match?.[1]?.trim() ?? "";
}

function inferForm(title: string, text: string): string {
  const match = `${title}\n${text}`.match(FORM_PATTERN);
  return match?.[1]?.trim() ?? "";
}

function inferMainIngredient(text: string): string {
  const explicit = inferFromPattern(text, MAIN_INGREDIENT_PATTERN);
  if (explicit) return explicit;
  const dosage = text.match(DOSAGE_STRENGTH_PATTERN);
  if (dosage) return `${dosage[1].trim()} ${dosage[2].trim()}`;
  return "";
}

function inferSupportAreas(text: string): string {
  const supports: string[] = [];
  if (/sleep|rest/i.test(text)) supports.push("sleep quality support");
  if (/relax|calm/i.test(text)) supports.push("relaxation support");
  if (/joint|mobility|comfort/i.test(text)) supports.push("mobility support");
  if (/immune/i.test(text)) supports.push("immune support");
  if (/digestive|gut/i.test(text)) supports.push("digestive wellness");
  return unique(supports).join(", ");
}

function isSupplementLikePayload(payload: Record<string, unknown>, searchBrowse: Record<string, string>): boolean {
  const haystack = [
    asText(payload.category),
    asText(payload.title),
    asText(payload.shortDescription),
    asText(payload.longDescription),
    searchBrowse.supplement_type,
    searchBrowse.product_type,
    searchBrowse.product_form,
    searchBrowse.form,
  ]
    .join(" ")
    .toLowerCase();
  return /(supplement|vitamin|capsule|softgel|gummy|nutrition|wellness)/i.test(haystack);
}

function faqSnippetsFromPayload(payload: Record<string, unknown>): string[] {
  const fromFaqSnippets = asBulletPoints(payload.faqSnippets);
  const fromFaq = asBulletPoints(payload.faq);
  const fromFaqs = asBulletPoints(payload.faqs);
  return unique([...fromFaqSnippets, ...fromFaq, ...fromFaqs]);
}

function hasMedicalClaim(text: string): boolean {
  const normalized = text.toLowerCase();
  const hasCondition = MEDICAL_CONDITION_PATTERNS.some((pattern) => pattern.test(normalized));
  const hasClaimVerb = CLAIM_VERB_PATTERNS.some((pattern) => pattern.test(normalized));
  return hasCondition && hasClaimVerb;
}

function hasForbiddenContact(text: string): boolean {
  return URL_PATTERN.test(text) || EMAIL_PATTERN.test(text) || PHONE_PATTERN.test(text);
}

function hasPromoPhrase(text: string): boolean {
  const normalized = text.toLowerCase();
  return PROMOTIONAL_PHRASES.some((phrase) => normalized.includes(phrase));
}

function hasHardBlockPhrase(text: string): boolean {
  const normalized = text.toLowerCase();
  return HARD_BLOCK_PHRASES.some((phrase) => normalized.includes(phrase));
}

function hasLikelyTagMarkup(text: string): boolean {
  return /<[^>]+>/.test(text);
}

export function evaluateWalmartListingCompliance(payload: Record<string, unknown>): WalmartComplianceResult {
  const violations: string[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];

  const title = asText(payload.title);
  const shortDescription = asText(payload.shortDescription);
  const longDescription = asText(payload.longDescription);
  const bullets = asBulletPoints(payload.bulletPoints);
  const searchBrowse = asSearchBrowseAttributes(payload);
  const faqSnippets = faqSnippetsFromPayload(payload);
  const structuredFactsSummary = asText(payload.structuredProductFactsSummary);
  const aiVisibilitySummary = asText(payload.aiVisibilitySummary);
  const compliantBenefitClusters = asBulletPoints(payload.compliantBenefitClusters);
  const extractionText = [
    structuredFactsSummary,
    longDescription,
    shortDescription,
    bullets.join("\n"),
    compliantBenefitClusters.join("\n"),
  ]
    .filter(Boolean)
    .join("\n");
  const supplementLike = isSupplementLikePayload(payload, searchBrowse);
  const extractionSucceeded =
    Boolean(structuredFactsSummary) ||
    Boolean(aiVisibilitySummary) ||
    compliantBenefitClusters.length > 0 ||
    hasAnyValue(searchBrowse, [
      "main_ingredients",
      "serving_size",
      "servings_per_container",
      "suggested_use",
      "safety_warnings",
      "support_areas",
    ]);

  if (title) {
    if (title.length > 200) {
      violations.push("Title exceeds 200 characters.");
      suggestions.push("Keep titles concise and under 200 characters.");
    } else if (title.length < 20) {
      warnings.push("Title may be too short for Walmart search relevance.");
    }

    if (hasPromoPhrase(title)) {
      violations.push("Remove promotional wording from title (for example, free shipping or limited time claims).");
      suggestions.push("Use factual product attributes instead of promotional messaging in title.");
    }

    if (hasForbiddenContact(title)) {
      violations.push("Title cannot include URLs, phone numbers, or email addresses.");
      suggestions.push("Remove external links and contact details from title.");
    }

    if (hasLikelyTagMarkup(title)) {
      violations.push("Title cannot include HTML or tag markup.");
    }

    const alphaChars = title.replace(/[^a-z]/gi, "");
    if (alphaChars.length >= 12 && alphaChars === alphaChars.toUpperCase()) {
      warnings.push("Avoid all-caps title formatting.");
    }
    const vagueTitle =
      TITLE_GENERIC_ONLY_PATTERN.test(title) ||
      (title.length < 36 &&
        VAGUE_TITLE_TERM_PATTERN.test(title) &&
        !FORM_PATTERN.test(title) &&
        !/\d{1,4}|mg|mcg|iu/i.test(title));
    if (vagueTitle) {
      warnings.push("Title is too vague. Include product-specific identity (form, ingredient, or count).");
      suggestions.push("Info: Add form, key ingredient, and count to title for stronger Walmart relevance.");
    }
  }

  if ("bulletPoints" in payload) {
    if (bullets.length === 0) {
      violations.push("Bullet points cannot be empty when bulletPoints is provided.");
    }

    if (bullets.length > 10) {
      violations.push("Provide no more than 10 bullet points.");
      suggestions.push("Keep bullet points to 3-10 concise key features.");
    } else if (bullets.length > 0 && bullets.length < 3) {
      warnings.push("Consider at least 3 bullet points for stronger listing quality.");
    }
  }

  if (longDescription.length > 4000) {
    warnings.push("Long description exceeds 4000 characters and may be truncated.");
  }

  if (containsRepeatedSupportArtifact(`${longDescription}\n${bullets.join("\n")}`)) {
    warnings.push("Repeated generated-copy artifacts detected (for example, support, support).");
  }

  if (supplementLike && longDescription.trim()) {
    const disclaimerCount = countCanonicalSupplementDisclaimer(longDescription);
    const malformedDisclaimer = detectMalformedSupplementDisclaimerFragments(longDescription);
    if (disclaimerCount > 1) {
      violations.push("Long description contains duplicate FDA supplement disclaimer text.");
    }
    if (malformedDisclaimer.length > 0) {
      violations.push("Malformed FDA disclaimer detected. Use the canonical FDA disclaimer wording.");
    }
    if (disclaimerCount === 0) {
      violations.push("Long description is missing the canonical FDA supplement disclaimer.");
    }
    if (disclaimerCount === 1 && !longDescription.trim().endsWith(SUPPLEMENT_FDA_DISCLAIMER)) {
      warnings.push("FDA disclaimer should appear once at the end of long description.");
    }

    const outsideDisclaimer = removeSupplementDisclaimerVariants(longDescription);
    const riskyOutsideDisclaimer = unique([
      ...detectRiskyClaims(outsideDisclaimer),
      ...(TREAT_CURE_PREVENT_PATTERN.test(outsideDisclaimer) ? ["treat_cure_prevent_outside_disclaimer"] : []),
    ]);
    if (riskyOutsideDisclaimer.length > 0) {
      violations.push("Disease/treat/cure/prevent language detected outside canonical FDA disclaimer.");
    }
  }

  const inferableForm = inferForm(title, extractionText);
  const inferableMainIngredient = inferMainIngredient(extractionText);
  const inferableServingSize = inferFromPattern(extractionText, SERVING_SIZE_PATTERN);
  const inferableServings = inferFromPattern(extractionText, SERVINGS_PATTERN);
  const inferableSuggestedUse = inferFromPattern(extractionText, SUGGESTED_USE_PATTERN);
  const inferableWarnings = inferFromPattern(extractionText, WARNINGS_PATTERN);
  const inferableDosageStrength = inferFromPattern(extractionText, DOSAGE_STRENGTH_PATTERN);
  const inferableSupportAreas = inferSupportAreas(extractionText);
  const inferableSupplementType = asText(payload.category) || inferForm(title, extractionText);
  const inferableTargetAudience = /adults?/i.test(extractionText)
    ? "Adults"
    : /children|kids|teens?/i.test(extractionText)
    ? "Children/Teens"
    : "";

  const inferableSearchKeywords = unique(
    [title, inferableMainIngredient, inferableSupportAreas, inferableForm]
      .flatMap((entry) => entry.split(/[|,]/g))
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 2)
  );

  const addInferableGap = (config: {
    inferable: string;
    keys: string[];
    label: string;
  }) => {
    if (!config.inferable.trim()) return;
    if (hasAnyValue(searchBrowse, config.keys)) return;
    const message = `${config.label} is inferable from extracted facts but missing in Search & Browse attributes.`;
    if (extractionSucceeded) {
      violations.push(message);
    } else {
      warnings.push(message);
    }
  };

  addInferableGap({
    inferable: inferableMainIngredient,
    keys: ["main_ingredients", "ingredients_list"],
    label: "Main ingredient",
  });
  addInferableGap({
    inferable: inferableForm,
    keys: ["product_form", "form"],
    label: "Product form",
  });
  addInferableGap({
    inferable: inferableServingSize,
    keys: ["serving_size"],
    label: "Serving size",
  });
  addInferableGap({
    inferable: inferableServings,
    keys: ["servings_per_container", "servings"],
    label: "Servings per container",
  });
  addInferableGap({
    inferable: inferableSuggestedUse,
    keys: ["suggested_use", "directions_suggested_use"],
    label: "Suggested use",
  });
  addInferableGap({
    inferable: inferableWarnings,
    keys: ["safety_warnings"],
    label: "Safety warnings",
  });
  addInferableGap({
    inferable: inferableDosageStrength,
    keys: ["dosage_strength"],
    label: "Dosage strength",
  });
  addInferableGap({
    inferable: inferableSupportAreas,
    keys: ["support_areas"],
    label: "Support areas",
  });
  addInferableGap({
    inferable: inferableSupplementType,
    keys: ["supplement_type", "product_type", "category"],
    label: "Product type/category",
  });
  addInferableGap({
    inferable: inferableTargetAudience,
    keys: ["target_audience", "age_group"],
    label: "Target audience",
  });
  addInferableGap({
    inferable: inferableSearchKeywords.join(", "),
    keys: ["search_keywords", "search_terms"],
    label: "Search keywords",
  });

  if (extractionSucceeded && !hasAnyValue(searchBrowse, ["brand"])) {
    warnings.push("Brand should be present in Search & Browse attributes after extraction.");
  }
  if (extractionSucceeded && !hasAnyValue(searchBrowse, ["manufacturer"])) {
    warnings.push("Manufacturer should be present in Search & Browse attributes after extraction.");
  }
  if (extractionSucceeded && !hasAnyValue(searchBrowse, ["product_name"])) {
    warnings.push("Product name should be present in Search & Browse attributes after extraction.");
  }

  if (faqSnippets.length === 0 && extractionSucceeded) {
    violations.push("FAQ snippets are missing after AI/facts extraction improvements.");
  } else if (faqSnippets.length > 0 && faqSnippets.length < 5) {
    warnings.push("FAQ coverage is light. Target 5 to 8 product-specific FAQ snippets.");
  } else if (faqSnippets.length > 8) {
    warnings.push("FAQ snippet count exceeds 8. Keep FAQ output concise (5 to 8 entries).");
  }

  if (faqSnippets.length > 0) {
    suggestions.push(
      "Info: FAQ snippets are recommendation-only enrichment and are not a direct Walmart API push field."
    );
  }

  for (const [field, value] of [
    ["title", title],
    ["shortDescription", shortDescription],
    ["longDescription", longDescription],
    ...bullets.map((bullet, index) => [`bulletPoints[${index}]`, bullet] as const),
  ] as const) {
    if (!value) continue;

    if (hasMedicalClaim(value) || hasHardBlockPhrase(value)) {
      violations.push(`Potential medical/drug claim detected in ${field}.`);
      suggestions.push("Use supportive wellness wording and avoid disease treatment, cure, or drug comparisons.");
    }

    if (hasForbiddenContact(value)) {
      violations.push(`Remove URL/contact details from ${field}.`);
      suggestions.push("Keep listing copy self-contained without external contact details.");
    }

    if (hasLikelyTagMarkup(value)) {
      violations.push(`Remove HTML/tag markup from ${field}.`);
    }

    if (field.startsWith("bulletPoints[") && value.length > 200) {
      warnings.push(`${field} is long; consider keeping bullets under 200 characters.`);
    }

    if (hasPromoPhrase(value) && field !== "title") {
      warnings.push(`Promotional language detected in ${field}.`);
      suggestions.push("Prefer objective product details over urgency or promotional claims.");
    }
  }

  const additionalImageUrls = payload.additionalImageUrls;
  if (Array.isArray(additionalImageUrls)) {
    for (const [index, entry] of additionalImageUrls.entries()) {
      if (typeof entry !== "string") continue;
      const trimmed = entry.trim();
      if (!trimmed) continue;
      if (!/^https?:\/\//i.test(trimmed)) {
        warnings.push(`additionalImageUrls[${index}] should use an http/https URL.`);
      }
    }
  }

  return {
    valid: violations.length === 0,
    violations: unique(violations),
    warnings: unique(warnings),
    suggestions: unique(suggestions),
  };
}
