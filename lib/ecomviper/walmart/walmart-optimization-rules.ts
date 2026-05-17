import { assessWalmartListingQuality } from "@/lib/ecomviper/walmart/walmart-listing-quality";
import { evaluateWalmartListingCompliance } from "@/lib/ecomviper/walmart/walmart-compliance";
import type { WalmartProductRecord } from "@/lib/ecomviper/walmart/walmart-types";
import { SUPPLEMENT_FDA_DISCLAIMER } from "@/lib/ecomviper/walmart/walmart-ai-visibility-content-policy";

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
  /\bed\b/i,
  /\bnatural viagra\b/i,
  /\bcialis\b/i,
  /\bclinically proven\b/i,
];

const SUPPLEMENT_SAFE_SUPPORT_PHRASES = [
  "supports daily wellness",
  "supports sleep quality",
  "supports relaxation",
  "supports digestive wellness",
  "supports immune wellness",
  "supports joint comfort",
  "supports metabolism",
  "supports focus",
  "supports hydration",
];

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
      "Use Brand + Product + Support/Ingredient + Form + Count when available.",
      "Avoid promotional phrasing and unsafe medical claims.",
      "Avoid repeated keywords.",
    ],
  },
  {
    fieldKey: "shortDescription",
    objective: "Generate one concise sentence for what it is, who it is for, and support context.",
    deterministicChecks: [
      "One sentence only.",
      "Include product identity and support language.",
      "Exclude disease/treatment claims.",
    ],
  },
  {
    fieldKey: "longDescription",
    objective: "Create structured long-form listing copy with supplement-safe language.",
    deterministicChecks: [
      "Entity-rich opening sentence.",
      "Label-backed facts only.",
      "FDA disclaimer included exactly once for supplements.",
    ],
  },
  {
    fieldKey: "bullets",
    objective: "Create 5-7 distinct shopper-friendly bullets.",
    deterministicChecks: [
      "Each bullet has one job.",
      "No repeated claims.",
      "No unsupported disease/treatment language.",
    ],
  },
  {
    fieldKey: "mediaRecommendations",
    objective: "Recommend Walmart listing media that improves trust and discoverability.",
    deterministicChecks: [
      "Front bottle plus label detail coverage.",
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
    objective: "Populate Search & Browse attributes from product facts and taxonomy context.",
    deterministicChecks: [
      "Use available product facts and existing structured attributes.",
      "Do not invent allergens/certifications.",
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
    count: string;
    servingSize: string;
    mainIngredients: string[];
    benefitsSupportAreas: string[];
    targetAudience: string;
    suggestedUse: string;
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
  return value.replace(/\s+/g, " ").trim();
}

function sentenceCase(value: string): string {
  const text = normalizeWhitespace(value);
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function removeUnsafeFragments(value: string): string {
  let next = value;
  for (const phrase of PROMOTIONAL_PHRASES) {
    next = next.replace(new RegExp(phrase, "ig"), "");
  }
  for (const pattern of UNSAFE_CLAIM_PATTERNS) {
    next = next.replace(pattern, "");
  }
  return normalizeWhitespace(next.replace(/\s+,/g, ",").replace(/,+/g, ","));
}

function firstNonEmpty(...values: string[]): string {
  for (const value of values) {
    const normalized = normalizeWhitespace(value);
    if (normalized) return normalized;
  }
  return "";
}

function inferFormFromText(value: string): string {
  const match = value.match(/\b(capsules?|softgels?|gummies?|tablets?|powder|liquid|drops?)\b/i);
  return match?.[1] ? sentenceCase(match[1].toLowerCase().replace(/s$/, "")) : "";
}

function inferCountFromText(value: string): string {
  const match = value.match(/\b(\d{1,4})\s*(capsules?|softgels?|gummies?|tablets?|ct|count|servings?)\b/i);
  if (!match) return "";
  const num = match[1];
  const unit = match[2].toLowerCase();
  if (unit === "ct" || unit === "count") return `${num} count`;
  return `${num} ${unit}`;
}

function normalizeTitleCandidate(value: string): string {
  return removeUnsafeFragments(value)
    .replace(/\s*[-|:,]+\s*/g, " ")
    .replace(/\b([A-Za-z]+)\s+\1\b/gi, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function enforceTitleLength(value: string): string {
  let title = value.trim();
  if (title.length <= TITLE_MAX) return title;

  const chunks = title
    .split(/,|\||-/)
    .map((entry) => entry.trim())
    .filter(Boolean);

  while (chunks.length > 1 && chunks.join(", ").length > TITLE_MAX) {
    chunks.pop();
  }

  title = chunks.join(", ").trim();
  if (title.length <= TITLE_MAX) return title;

  return `${title.slice(0, TITLE_MAX - 1).trimEnd()}`;
}

function ensureOneSentence(value: string): string {
  const compact = normalizeWhitespace(value.replace(/[!?]/g, "."));
  const first = compact.split(".").find((entry) => entry.trim().length > 0) ?? compact;
  return `${first.trim().replace(/[.,;:]+$/, "")}.`;
}

function normalizeAudience(value: string): string {
  const text = asText(value);
  if (!text) return "Adults";
  return sentenceCase(text);
}

function containsUnsafeClaim(value: string): boolean {
  return UNSAFE_CLAIM_PATTERNS.some((pattern) => pattern.test(value));
}

function containsPromotionalPhrase(value: string): boolean {
  const haystack = value.toLowerCase();
  return PROMOTIONAL_PHRASES.some((phrase) => haystack.includes(phrase));
}

function normalizeLongDescription(input: {
  title: string;
  productType: string;
  form: string;
  count: string;
  ingredients: string[];
  supportAreas: string[];
  audience: string;
  competitorPatterns?: WalmartDocketOptimizationInput["competitorPatterns"];
}): string {
  const identityLine = `${input.title} is a ${input.productType.toLowerCase()} in ${
    input.count || `a ${input.form.toLowerCase()} format`
  } designed for ${input.audience.toLowerCase()}.`;

  const ingredientLine = input.ingredients.length
    ? `The formula features ${input.ingredients.slice(0, 4).join(", ")} with label-backed positioning for ${
        input.supportAreas[0] ?? "daily wellness"
      }.`
    : `The formula is positioned to ${input.supportAreas[0] ?? SUPPLEMENT_SAFE_SUPPORT_PHRASES[0]}.`;

  const useCaseLine = `Use as directed on the product label and review the Supplement Facts panel before purchase.`;

  const competitorPatternLine =
    (input.competitorPatterns?.gaps ?? []).length > 0
      ? `Differentiation note: highlight label-backed facts shoppers may miss in similar listings.`
      : "";

  const parts = [identityLine, ingredientLine, useCaseLine, competitorPatternLine]
    .map((entry) => removeUnsafeFragments(entry))
    .filter(Boolean);

  const joined = `${parts.join("\n\n")}\n\n${SUPPLEMENT_FDA_DISCLAIMER}`;
  const disclaimerCount = joined.split(SUPPLEMENT_FDA_DISCLAIMER).length - 1;
  if (disclaimerCount === 1) return joined;
  const without = joined.replace(new RegExp(SUPPLEMENT_FDA_DISCLAIMER, "g"), "").trim();
  return `${without}\n\n${SUPPLEMENT_FDA_DISCLAIMER}`;
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
  const base = unique([
    `${input.ingredient} ${input.supportArea} supplement`.trim(),
    `${input.form} ${input.count}`.trim(),
    `${input.audience} ${input.supportArea}`.trim(),
    `${input.brand} ${input.productType}`.trim(),
    `${input.supportArea} daily wellness supplement`.trim(),
  ])
    .map((entry) => removeUnsafeFragments(entry))
    .filter((entry) => entry.length > 3 && !containsUnsafeClaim(entry));

  return base.slice(0, 8);
}

function buildSearchTerms(keywords: string[]): string[] {
  return unique(
    keywords.flatMap((entry) => {
      const normalized = entry.toLowerCase();
      return [normalized, normalized.replace(/supplement/gi, "dietary supplement")];
    })
  )
    .filter((entry) => entry.length > 3)
    .slice(0, 12);
}

function toDraftRecord(input: WalmartDocketOptimizationInput): Record<string, unknown> {
  return asObject(input.draftPayload) ?? {};
}

function mergeSearchBrowseFromProductAndDraft(input: WalmartDocketOptimizationInput): Record<string, string> {
  const fromProduct = {
    ...(input.product.searchBrowseAttributes ?? {}),
    ...(input.product.attributes ?? {}),
  };

  const draft = toDraftRecord(input);
  const fromDraft = {
    ...(asObject(draft.searchBrowseAttributes) ?? {}),
    ...(asObject(draft.attributes) ?? {}),
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

export function buildWalmartDocketOptimizationPromptContract(
  input: WalmartDocketOptimizationInput
): Record<string, unknown> {
  const searchBrowse = mergeSearchBrowseFromProductAndDraft(input);

  return {
    task: "Optimize the full Walmart listing docket in one pass.",
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
    },
    competitorPatterns: input.competitorPatterns ?? null,
    requiredOutputShape: {
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
        count: "string",
        servingSize: "string",
        mainIngredients: ["string"],
        benefitsSupportAreas: ["string"],
        targetAudience: "string",
        suggestedUse: "string",
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
      },
    },
  };
}

export function validateWalmartOptimizedDocket(
  output: WalmartDocketOptimizationOutput
): { warnings: string[]; blockers: string[] } {
  const warnings: string[] = [];
  const blockers: string[] = [];

  const title = output.content.productTitle.trim();
  const shortDescription = output.content.shortDescription.trim();
  const longDescription = output.content.longDescription.trim();

  if (!title) blockers.push("Product title is required.");
  if (title.length > TITLE_MAX) blockers.push("Product title exceeds Walmart 150 character limit.");
  if (containsPromotionalPhrase(title)) blockers.push("Product title contains promotional phrasing.");
  if (containsUnsafeClaim(title)) blockers.push("Product title contains unsafe supplement claim language.");

  const sentenceParts = shortDescription.split(/[.!?]/).filter((entry) => entry.trim().length > 0);
  if (sentenceParts.length !== 1) warnings.push("Short description should be exactly one sentence.");
  if (containsUnsafeClaim(shortDescription)) blockers.push("Short description contains unsafe supplement claim language.");

  const disclaimerCount = longDescription.split(SUPPLEMENT_FDA_DISCLAIMER).length - 1;
  if (disclaimerCount !== 1) blockers.push("Long description must include FDA disclaimer exactly once for supplements.");
  if (containsUnsafeClaim(longDescription)) blockers.push("Long description contains unsafe supplement claim language.");

  if (output.content.bullets.length < 5 || output.content.bullets.length > 7) {
    warnings.push("Bullets should contain 5-7 entries.");
  }

  if (!output.searchBrowse.productType && !output.searchBrowse.category) {
    blockers.push("Search & Browse requires product type or category.");
  }

  const keywordText = [...output.searchBrowse.searchKeywords, ...output.searchBrowse.searchTerms].join(" ");
  if (containsUnsafeClaim(keywordText)) {
    blockers.push("Search keywords/search terms include unsafe claims.");
  }

  if (!output.searchBrowse.searchKeywords.length) {
    warnings.push("Search keywords are missing.");
  }

  if (!output.searchBrowse.searchTerms.length) {
    warnings.push("Search terms are missing.");
  }

  return {
    warnings: unique(warnings),
    blockers: unique(blockers),
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
    count: output.searchBrowse.count,
    serving_size: output.searchBrowse.servingSize,
    main_ingredients: output.searchBrowse.mainIngredients.join(", "),
    support_areas: output.searchBrowse.benefitsSupportAreas.join(", "),
    target_audience: output.searchBrowse.targetAudience,
    suggested_use: output.searchBrowse.suggestedUse,
    directions_suggested_use: output.searchBrowse.suggestedUse,
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
  if (
    input.output.content.shortDescription &&
    input.output.content.shortDescription !== input.input.product.shortDescription
  ) {
    reasons.push("Short description converted to one-sentence support-focused summary.");
  }
  if (input.output.content.bullets.length >= 5) {
    reasons.push("Bullets expanded to distinct shopper-facing support points.");
  }
  if (input.output.searchBrowse.searchKeywords.length > 0) {
    reasons.push("Search keywords/terms improved for Walmart and agentic retrieval.");
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

  const mainIngredients = unique([
    ...asList(searchBrowse.main_ingredients),
    ...asList(searchBrowse.ingredients),
    ...asList(searchBrowse.primary_ingredient),
  ]).slice(0, 6);

  const supportAreas = unique([
    ...asList(searchBrowse.support_areas),
    ...asList(searchBrowse.benefits_support_areas),
    ...asList(searchBrowse.supported_benefits),
  ])
    .map((entry) => removeUnsafeFragments(entry))
    .filter(Boolean)
    .slice(0, 5);

  const form = firstNonEmpty(
    asText(searchBrowse.product_form),
    asText(searchBrowse.form),
    inferFormFromText(originalTitle),
    "Capsule"
  );

  const count = firstNonEmpty(
    asText(searchBrowse.count),
    asText(searchBrowse.servings_per_container),
    inferCountFromText(originalTitle)
  );

  const ingredientOrSupport = firstNonEmpty(mainIngredients[0] ?? "", supportAreas[0] ?? "");
  const productNameCandidate = firstNonEmpty(asText(searchBrowse.product_name), originalTitle)
    .replace(new RegExp(`^${brand}\\s+`, "i"), "")
    .trim();

  const titleSegments = [
    brand,
    productNameCandidate || productType,
    ingredientOrSupport,
    form,
    count,
  ]
    .map((entry) => normalizeTitleCandidate(entry))
    .filter(Boolean);

  const rawTitle = titleSegments.join(" ").replace(/\s{2,}/g, " ").trim();
  let productTitle = enforceTitleLength(rawTitle);
  if (productTitle.length < TITLE_TARGET_MIN) {
    productTitle = enforceTitleLength(`${productTitle} ${productType}`.trim());
  }

  const audience = normalizeAudience(
    firstNonEmpty(asText(searchBrowse.target_audience), asText(searchBrowse.audience), "Adults")
  );
  const supportPhrase = firstNonEmpty(
    supportAreas[0] ? `supports ${supportAreas[0].toLowerCase()}` : "",
    SUPPLEMENT_SAFE_SUPPORT_PHRASES[0]
  );

  const shortDescription = ensureOneSentence(
    removeUnsafeFragments(
      `${productTitle} is a ${count || `${form.toLowerCase()} format`} dietary supplement formulated to ${supportPhrase} for ${audience.toLowerCase()}.`
    )
  );

  const longDescription = normalizeLongDescription({
    title: productTitle,
    productType,
    form,
    count,
    ingredients: mainIngredients,
    supportAreas,
    audience,
    competitorPatterns: input.competitorPatterns ?? null,
  });

  const bullets = unique([
    `${productType} identity - ${brand} ${productNameCandidate || productType} in ${form.toLowerCase()} format.`,
    `Primary support area - designed to ${supportPhrase}.`,
    mainIngredients[0]
      ? `Ingredient context - includes ${mainIngredients[0]} as listed on the product label.`
      : "Ingredient context - label-backed ingredient details are provided in the Supplement Facts panel.",
    count
      ? `Form and count - ${count} in ${form.toLowerCase()} format for routine use.`
      : `Form and count - ${form} format with count verified from label details before publish.`,
    "Usage occasion - intended for consistent daily wellness routines as directed on label.",
    "Safety note - review label directions and consult a healthcare professional when appropriate.",
  ])
    .map((entry) => removeUnsafeFragments(entry))
    .filter(Boolean)
    .slice(0, 7);

  while (bullets.length < 5) {
    bullets.push("Listing quality note - include complete structured attributes for Walmart search and browse relevance.");
  }

  const mediaRecommendations = [
    "Front bottle hero image with full label visibility",
    "Supplement Facts panel image",
    "Suggested use and direction label close-up",
    "Ingredient/formula close-up image",
    "Lifestyle context image aligned to label-safe use case",
    "Multi-pack comparison image when applicable",
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
    ingredient: ingredientOrSupport || "daily wellness",
    supportArea: supportAreas[0] || "daily wellness",
    form,
    count: count || "count",
    audience,
  });

  const searchTerms = buildSearchTerms(searchKeywords).filter((entry) => !containsUnsafeClaim(entry));

  const suggestedUse = ensureOneSentence(
    removeUnsafeFragments(
      firstNonEmpty(
        asText(searchBrowse.suggested_use),
        asText(searchBrowse.directions_suggested_use),
        "Use as directed on the product label."
      )
    )
  );

  const category = firstNonEmpty(
    asText(searchBrowse.category),
    input.product.category,
    productType
  );

  const compliancePayload = {
    title: productTitle,
    shortDescription,
    longDescription,
    bulletPoints: bullets,
    searchBrowseAttributes: {
      product_type: productType,
      supplement_type: productType,
      product_form: form,
      count,
      main_ingredients: mainIngredients.join(", "),
      support_areas: supportAreas.join(", "),
      target_audience: audience,
      suggested_use: suggestedUse,
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
      form,
      count,
      servingSize: firstNonEmpty(asText(searchBrowse.serving_size), "Use label directions"),
      mainIngredients,
      benefitsSupportAreas: supportAreas.length > 0 ? supportAreas : ["daily wellness"],
      targetAudience: audience,
      suggestedUse,
      searchKeywords,
      searchTerms,
      category,
      warnings: unique([
        "Do not include disease/treatment claims in Search & Browse fields.",
        "GTIN/UPC remain lookup identifiers only.",
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
    },
  };

  const validation = validateWalmartOptimizedDocket(output);
  output.validation = validation;

  const score = scoreWalmartOptimizedDocket({
    input,
    output,
  });
  output.score = score;

  output.validation.warnings = unique([
    ...output.validation.warnings,
    ...complianceReview.warnings,
  ]);
  output.validation.blockers = unique([
    ...output.validation.blockers,
    ...complianceReview.violations,
  ]);

  return {
    output,
    appliedRules: WalmartDocketOptimizationRules,
  };
}
