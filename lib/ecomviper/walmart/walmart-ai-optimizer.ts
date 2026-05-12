import "server-only";

import { evaluateWalmartListingCompliance } from "@/lib/ecomviper/walmart/walmart-compliance";
import {
  assessWalmartListingQuality,
  mergeWalmartAiSuggestionIntoProduct,
} from "@/lib/ecomviper/walmart/walmart-listing-quality";
import {
  buildAiAnswerShortDescription,
  buildCompliantSearchKeywords,
  buildDefaultAltText,
  buildDefaultMediaRecommendations,
  buildEntityRichTitle,
  buildStructuredLongDescription,
  buildWalmartVisibilityEntitySet,
  detectRiskyClaims,
  ensureSingleSupplementDisclaimer,
  normalizeMediaRecommendations,
  normalizeSearchBrowseSuggestions,
  safeSupportedBenefits,
  sanitizeRiskyClaims,
  SUPPLEMENT_FDA_DISCLAIMER,
} from "@/lib/ecomviper/walmart/walmart-ai-visibility-content-policy";
import {
  pickMeaningfulAiText,
  sanitizeWalmartAiSearchBrowseAttributes,
} from "@/lib/ecomviper/walmart/walmart-ai-field-sanitization";
import {
  buildSearchBrowseAttributesFromSources,
  normalizeSearchBrowseAttributes,
} from "@/lib/ecomviper/walmart/walmart-search-browse-attributes";
import type { WalmartAiSuggestion, WalmartProductRecord } from "@/lib/ecomviper/walmart/walmart-types";

const OPENAI_MODEL = process.env.WALMART_OPENAI_MODEL?.trim() || "gpt-4o-mini";

interface GeneratedSuggestionPayload {
  suggestedTitle?: unknown;
  title?: unknown;
  suggestedShortDescription?: unknown;
  shortDescription?: unknown;
  suggestedShortDesc?: unknown;
  suggestedDescription?: unknown;
  suggestedLongDescription?: unknown;
  longDescription?: unknown;
  description?: unknown;
  suggestedBullets?: unknown;
  suggestedBulletPoints?: unknown;
  bulletPoints?: unknown;
  keyFeatures?: unknown;
  suggestedBrand?: unknown;
  brand?: unknown;
  suggestedAttributes?: unknown;
  attributes?: unknown;
  keyAttributes?: unknown;
  searchBrowseAttributes?: unknown;
  missingAttributes?: unknown;
  complianceWarnings?: unknown;
  complianceNotes?: unknown;
  rejectedRiskyClaims?: unknown;
  mediaRecommendations?: unknown;
  altText?: unknown;
  qualityScore?: unknown;
  entitySet?: unknown;
}

function unique(items: string[]): string[] {
  return Array.from(new Set(items.map((entry) => entry.trim()).filter(Boolean)));
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function toNonEmptyString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => toNonEmptyString(entry))
    .filter((entry) => entry.length > 0);
}

function clampScore(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(1, Math.min(100, Math.round(value)));
}

function firstNonEmptyString(values: unknown[]): string {
  for (const value of values) {
    const normalized = toNonEmptyString(value);
    if (normalized) return normalized;
  }
  return "";
}

function firstStringArray(values: unknown[]): string[] {
  for (const value of values) {
    const normalized = toStringArray(value);
    if (normalized.length > 0) return normalized;
  }
  return [];
}

function toAttributeRecord(value: unknown): Record<string, string> {
  const objectValue = asObject(value);
  if (!objectValue) return {};

  const mapped: Record<string, string> = {};
  for (const [key, raw] of Object.entries(objectValue)) {
    const normalizedKey = key.trim();
    const normalizedValue =
      typeof raw === "string"
        ? raw.trim()
        : Array.isArray(raw)
        ? raw
            .map((entry) => toNonEmptyString(entry))
            .filter(Boolean)
            .join(", ")
        : "";
    if (normalizedKey && normalizedValue) {
      mapped[normalizedKey] = normalizedValue;
    }
  }
  return mapped;
}

function inferMissingSearchBrowseAttributes(attributes: Record<string, string>): string[] {
  const required = [
    "age_group",
    "product_form",
    "count",
    "main_ingredients",
    "target_audience",
    "support_areas",
  ];

  return required.filter((key) => !attributes[key]?.trim());
}

const DEFAULT_SUPPLEMENT_DIRECTIONS = "Use as directed on product label.";
const DEFAULT_SUPPLEMENT_WARNINGS =
  "Consult your healthcare professional before use if you are pregnant, nursing, taking medication, or have a medical condition. Keep out of reach of children.";

function buildInferredSearchBrowseAttributes(input: {
  product: WalmartProductRecord;
  baseSearchBrowse: Record<string, string>;
  entitySet: ReturnType<typeof buildWalmartVisibilityEntitySet>;
  supportedBenefits: string[];
}): Record<string, string> {
  const keywords = buildCompliantSearchKeywords(input.entitySet).join(", ");
  const inferredManufacturer =
    input.baseSearchBrowse.manufacturer ||
    input.entitySet.brand ||
    input.product.brand;

  return normalizeSearchBrowseAttributes({
    ...input.baseSearchBrowse,
    brand:
      input.baseSearchBrowse.brand ||
      input.entitySet.brand ||
      input.product.brand,
    manufacturer: inferredManufacturer,
    supplement_type:
      input.baseSearchBrowse.supplement_type ||
      input.entitySet.category ||
      input.product.category ||
      "Supplement",
    product_form: input.baseSearchBrowse.product_form || input.entitySet.form,
    count: input.baseSearchBrowse.count || input.entitySet.count,
    main_ingredients:
      input.baseSearchBrowse.main_ingredients ||
      input.entitySet.keyIngredients.join(", "),
    target_audience:
      input.baseSearchBrowse.target_audience || input.entitySet.audience,
    support_areas:
      input.baseSearchBrowse.support_areas || input.supportedBenefits.join(", "),
    directions_suggested_use:
      input.baseSearchBrowse.directions_suggested_use || DEFAULT_SUPPLEMENT_DIRECTIONS,
    safety_warnings:
      input.baseSearchBrowse.safety_warnings || DEFAULT_SUPPLEMENT_WARNINGS,
    search_keywords: input.baseSearchBrowse.search_keywords || keywords,
    search_terms: input.baseSearchBrowse.search_terms || keywords,
  });
}

export function buildDeterministicAiSuggestion(product: WalmartProductRecord): WalmartAiSuggestion {
  const baseSearchBrowse = buildSearchBrowseAttributesFromSources({ product });
  const entitySet = buildWalmartVisibilityEntitySet(product);
  const supportedBenefits = safeSupportedBenefits(entitySet.supportedBenefits);
  const enrichedEntitySet = {
    ...entitySet,
    supportedBenefits,
  };

  const suggestedTitle = buildEntityRichTitle(enrichedEntitySet) || product.title;
  const suggestedShortDescription = buildAiAnswerShortDescription(enrichedEntitySet);
  const suggestedDescription = buildStructuredLongDescription({
    entitySet: enrichedEntitySet,
    suggestedUse: baseSearchBrowse.directions_suggested_use,
    ingredientsList: baseSearchBrowse.ingredients_list,
  });

  const keywords = buildCompliantSearchKeywords(enrichedEntitySet);
  const suggestedBullets = unique([
    `${enrichedEntitySet.productName || "Daily wellness supplement"} from ${
      enrichedEntitySet.brand || product.brand || "the brand"
    }.`,
    `Key ingredients: ${
      enrichedEntitySet.keyIngredients.length
        ? enrichedEntitySet.keyIngredients.slice(0, 4).join(", ")
        : "See product label for complete ingredient list"
    }.`,
    `Benefit profile: ${
      supportedBenefits.length ? supportedBenefits.slice(0, 3).join(", ") : "daily wellness support"
    }.`,
    `Format and count: ${
      [enrichedEntitySet.count, enrichedEntitySet.form].filter(Boolean).join(" ") || "See product label"
    }.`,
    `Suggested use: ${baseSearchBrowse.directions_suggested_use || DEFAULT_SUPPLEMENT_DIRECTIONS}`,
    `Customer fit: ${(enrichedEntitySet.audience || "Adults").trim()}.`,
  ]).slice(0, 6);

  const searchBrowseAttributes = buildInferredSearchBrowseAttributes({
    product,
    baseSearchBrowse,
    entitySet: enrichedEntitySet,
    supportedBenefits,
  });

  const qualityScore = Math.max(55, 90 - product.issues.length * 6 - (product.imageUrl ? 0 : 4));

  return {
    sku: product.sku,
    qualityScore,
    suggestedTitle,
    suggestedShortDescription,
    suggestedDescription,
    suggestedBullets,
    suggestedBrand: enrichedEntitySet.brand || product.brand,
    suggestedAttributes: searchBrowseAttributes,
    searchBrowseAttributes,
    mediaRecommendations: buildDefaultMediaRecommendations(),
    altText: buildDefaultAltText(enrichedEntitySet),
    complianceNotes: [
      "Use factual product details that match product label and imported catalog data.",
      "Do not invent certifications, allergen claims, or ingredient facts.",
      "Use support language; avoid disease treatment/prevention framing.",
      "AI visibility notes: include ingredient + format + routine-support phrasing that answer engines can summarize.",
      `Compliant keywords: ${keywords.slice(0, 8).join(", ") || "daily wellness support"}`,
    ],
    rejectedRiskyClaims: [],
    entitySet: enrichedEntitySet,
    missingAttributes: inferMissingSearchBrowseAttributes(searchBrowseAttributes),
    complianceWarnings: unique([
      ...product.issues,
      "Avoid disease claims and medication comparisons.",
    ]),
    disclaimer: SUPPLEMENT_FDA_DISCLAIMER,
  };
}

function parseJsonObject(raw: string): Record<string, unknown> {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("OpenAI generation returned empty content.");
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    }
  }

  throw new Error("OpenAI generation returned invalid JSON payload.");
}

async function requestOpenAiSuggestion(params: {
  apiKey: string;
  product: WalmartProductRecord;
}): Promise<Record<string, unknown>> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You optimize Walmart supplement listings for marketplace conversion and AI visibility. Return JSON only. Use truthful, product-specific language grounded in provided data. Never include disease/treatment/cure/prevention/drug-comparison claims, and never use terms like ED, erectile dysfunction, hypertension, anxiety, insomnia, depression, natural viagra, or works like cialis. Use compliant structure/function language (supports, helps maintain, daily wellness, performance support, circulation support, sleep quality support). Keep copy premium, specific, and non-repetitive. Include the supplement FDA disclaimer exactly once in longDescription when appropriate.",
        },
        {
          role: "user",
          content: JSON.stringify({
            task: "Generate compliant Walmart AI visibility content improvements.",
            requiredFields: [
              "suggestedTitle",
              "suggestedShortDescription",
              "suggestedDescription",
              "suggestedBullets",
              "suggestedBrand",
              "searchBrowseAttributes",
              "mediaRecommendations",
              "altText",
              "complianceNotes",
              "rejectedRiskyClaims",
              "entitySet",
              "qualityScore",
            ],
            titleEntityOrder:
              "Brand -> Product Name -> Key Ingredients -> Category -> Count/Form",
            constraints: {
              titleMaxChars: 200,
              bulletsMin: 3,
              bulletsMax: 6,
              bulletMaxChars: 180,
              noDiseaseClaims: true,
              noUnsupportedFacts: true,
              noPromotionalUrgency: true,
              avoidKeywordStuffing: true,
              includeAiVisibilityMetadataInNotes: true,
              protectedFieldsNeverOverwrite: [
                "sku",
                "gtin",
                "upc",
                "wpid",
                "itemId",
                "publicWalmartUrl",
                "publicWalmartProductId",
                "price",
                "inventoryQuantity",
                "imageUrl",
              ],
            },
            product: {
              sku: params.product.sku,
              title: params.product.title,
              brand: params.product.brand,
              category: params.product.category,
              issues: params.product.issues,
              shortDescription: params.product.shortDescription,
              longDescription: params.product.longDescription,
              bulletPoints: params.product.bulletPoints,
              attributes: params.product.attributes,
              searchBrowseAttributes: params.product.searchBrowseAttributes,
              rawPayload: params.product.rawPayload,
              normalizedPayload: params.product.normalizedPayload,
            },
          }),
        },
      ],
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("OpenAI generation failed: HTTP 401 unauthorized. Reconnect your OpenAI API key.");
    }
    if (response.status === 403) {
      throw new Error("OpenAI generation failed: HTTP 403 forbidden. Check your OpenAI project permissions.");
    }
    throw new Error(`OpenAI generation failed: HTTP ${response.status}.`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };

  const content = payload.choices?.[0]?.message?.content ?? "";
  return parseJsonObject(content);
}

function toSuggestionFromGenerated(
  product: WalmartProductRecord,
  generated: Record<string, unknown>
): WalmartAiSuggestion {
  const fallback = buildDeterministicAiSuggestion(product);
  const payload = generated as GeneratedSuggestionPayload;

  const suggestedTitle =
    firstNonEmptyString([payload.suggestedTitle, payload.title]) || fallback.suggestedTitle;
  const suggestedShortDescription =
    firstNonEmptyString([
      payload.suggestedShortDescription,
      payload.suggestedShortDesc,
      payload.shortDescription,
    ]) || fallback.suggestedShortDescription || "";
  const suggestedDescription =
    firstNonEmptyString([
      payload.suggestedDescription,
      payload.suggestedLongDescription,
      payload.longDescription,
      payload.description,
    ]) || fallback.suggestedDescription;

  const suggestedBulletsRaw = firstStringArray([
    payload.suggestedBullets,
    payload.suggestedBulletPoints,
    payload.bulletPoints,
    payload.keyFeatures,
  ]);

  const suggestedBullets =
    suggestedBulletsRaw.length >= 3
      ? suggestedBulletsRaw.slice(0, 6)
      : fallback.suggestedBullets;

  const suggestedBrandRaw = firstNonEmptyString([payload.suggestedBrand, payload.brand]);
  const suggestedBrand =
    suggestedBrandRaw && suggestedBrandRaw.toLowerCase() !== "unknown"
      ? suggestedBrandRaw
      : fallback.suggestedBrand;

  const generatedAttributesRaw = {
    ...toAttributeRecord(payload.suggestedAttributes),
    ...toAttributeRecord(payload.attributes),
    ...toAttributeRecord(payload.keyAttributes),
    ...normalizeSearchBrowseSuggestions(payload.searchBrowseAttributes),
  };

  const normalizedGeneratedAttributes =
    normalizeSearchBrowseSuggestions(generatedAttributesRaw);
  const fallbackSearchBrowseAttributes = normalizeSearchBrowseSuggestions({
    ...(fallback.suggestedAttributes ?? {}),
    ...(fallback.searchBrowseAttributes ?? {}),
  });

  const searchBrowseAttributes = sanitizeWalmartAiSearchBrowseAttributes({
    candidates: {
      ...fallbackSearchBrowseAttributes,
      ...normalizedGeneratedAttributes,
    },
    existingKeys: [
      ...Object.keys(product.attributes ?? {}),
      ...Object.keys(product.searchBrowseAttributes ?? {}),
    ],
  }).accepted;
  const missingAttributes =
    toStringArray(payload.missingAttributes).length > 0
      ? toStringArray(payload.missingAttributes)
      : inferMissingSearchBrowseAttributes(searchBrowseAttributes);

  const complianceWarnings = unique([
    ...toStringArray(payload.complianceWarnings),
    ...product.issues,
  ]);

  const entitySetNode = asObject(payload.entitySet);
  const fallbackEntitySet = fallback.entitySet ?? buildWalmartVisibilityEntitySet(product);

  return {
    sku: product.sku,
    qualityScore: clampScore(payload.qualityScore) ?? fallback.qualityScore,
    suggestedTitle: pickMeaningfulAiText(suggestedTitle) ?? fallback.suggestedTitle,
    suggestedShortDescription:
      pickMeaningfulAiText(suggestedShortDescription) ??
      fallback.suggestedShortDescription ??
      "",
    suggestedDescription:
      pickMeaningfulAiText(suggestedDescription) ?? fallback.suggestedDescription,
    suggestedBullets,
    suggestedBrand,
    suggestedAttributes: searchBrowseAttributes,
    searchBrowseAttributes,
    mediaRecommendations:
      normalizeMediaRecommendations(payload.mediaRecommendations).length > 0
        ? normalizeMediaRecommendations(payload.mediaRecommendations)
        : fallback.mediaRecommendations,
    altText: firstNonEmptyString([payload.altText]) || fallback.altText,
    complianceNotes:
      toStringArray(payload.complianceNotes).length > 0
        ? toStringArray(payload.complianceNotes)
        : fallback.complianceNotes,
    rejectedRiskyClaims: toStringArray(payload.rejectedRiskyClaims),
    entitySet: {
      brand: firstNonEmptyString([entitySetNode?.brand, fallbackEntitySet.brand]),
      productName: firstNonEmptyString([entitySetNode?.productName, fallbackEntitySet.productName]),
      category: firstNonEmptyString([entitySetNode?.category, fallbackEntitySet.category]),
      keyIngredients:
        toStringArray(entitySetNode?.keyIngredients).length > 0
          ? toStringArray(entitySetNode?.keyIngredients)
          : fallbackEntitySet.keyIngredients,
      form: firstNonEmptyString([entitySetNode?.form, fallbackEntitySet.form]),
      count: firstNonEmptyString([entitySetNode?.count, fallbackEntitySet.count]),
      audience: firstNonEmptyString([entitySetNode?.audience, fallbackEntitySet.audience]),
      supportedBenefits:
        toStringArray(entitySetNode?.supportedBenefits).length > 0
          ? toStringArray(entitySetNode?.supportedBenefits)
          : fallbackEntitySet.supportedBenefits,
    },
    missingAttributes,
    complianceWarnings,
    disclaimer: SUPPLEMENT_FDA_DISCLAIMER,
  };
}

function applyComplianceGuardrails(
  product: WalmartProductRecord,
  suggestion: WalmartAiSuggestion
): WalmartAiSuggestion {
  const titleSanitized = sanitizeRiskyClaims(suggestion.suggestedTitle);
  const shortDescriptionSanitized = sanitizeRiskyClaims(
    suggestion.suggestedShortDescription ?? ""
  );
  const descriptionSanitized = sanitizeRiskyClaims(suggestion.suggestedDescription);

  const bulletSanitized = suggestion.suggestedBullets.map((entry) => sanitizeRiskyClaims(entry));
  const sanitizedBullets = bulletSanitized.map((entry) => entry.sanitized).filter(Boolean);

  const rejectedRiskyClaims = unique([
    ...(suggestion.rejectedRiskyClaims ?? []),
    ...titleSanitized.rejectedRiskyClaims,
    ...shortDescriptionSanitized.rejectedRiskyClaims,
    ...descriptionSanitized.rejectedRiskyClaims,
    ...bulletSanitized.flatMap((entry) => entry.rejectedRiskyClaims),
  ]);

  const compliance = evaluateWalmartListingCompliance({
    title: titleSanitized.sanitized,
    shortDescription: shortDescriptionSanitized.sanitized,
    longDescription: descriptionSanitized.sanitized,
    bulletPoints: sanitizedBullets,
  });

  const hasRiskyClaims =
    detectRiskyClaims(titleSanitized.sanitized).length > 0 ||
    detectRiskyClaims(shortDescriptionSanitized.sanitized).length > 0 ||
    detectRiskyClaims(descriptionSanitized.sanitized).length > 0 ||
    sanitizedBullets.some((bullet) => detectRiskyClaims(bullet).length > 0);

  if (compliance.violations.length > 0 || hasRiskyClaims) {
    const fallback = buildDeterministicAiSuggestion(product);
    return {
      ...fallback,
      complianceWarnings: unique([
        ...fallback.complianceWarnings,
        ...compliance.warnings,
        ...compliance.violations.map((entry) => `Policy blocker removed: ${entry}`),
      ]).slice(0, 10),
      rejectedRiskyClaims: unique([...(fallback.rejectedRiskyClaims ?? []), ...rejectedRiskyClaims]),
    };
  }

  return {
    ...suggestion,
    suggestedTitle: titleSanitized.sanitized,
    suggestedShortDescription: shortDescriptionSanitized.sanitized,
    suggestedDescription: ensureSingleSupplementDisclaimer(descriptionSanitized.sanitized),
    suggestedBullets: sanitizedBullets,
    searchBrowseAttributes: normalizeSearchBrowseAttributes(suggestion.searchBrowseAttributes),
    suggestedAttributes: normalizeSearchBrowseAttributes(suggestion.suggestedAttributes),
    entitySet: suggestion.entitySet
      ? {
          ...suggestion.entitySet,
          supportedBenefits: safeSupportedBenefits(suggestion.entitySet.supportedBenefits),
        }
      : suggestion.entitySet,
    rejectedRiskyClaims: unique(rejectedRiskyClaims),
    complianceWarnings: unique([
      ...suggestion.complianceWarnings,
      ...compliance.warnings,
      ...(rejectedRiskyClaims.length > 0
        ? [
            "Policy blocker removed: unsafe medical/drug claims were replaced with compliant support language.",
          ]
        : []),
    ]).slice(0, 10),
    disclaimer: SUPPLEMENT_FDA_DISCLAIMER,
  };
}

function alignSuggestionQualityScore(
  product: WalmartProductRecord,
  suggestion: WalmartAiSuggestion
): WalmartAiSuggestion {
  const projected = mergeWalmartAiSuggestionIntoProduct(product, suggestion);
  const projectedQuality = assessWalmartListingQuality(projected);
  return {
    ...suggestion,
    qualityScore: projectedQuality.score,
  };
}

export async function generateWalmartAiSuggestion(params: {
  product: WalmartProductRecord;
  openAiApiKey: string;
}): Promise<WalmartAiSuggestion> {
  const useDeterministicMock = process.env.WALMART_AI_DETERMINISTIC_MOCK === "1";
  if (useDeterministicMock) {
    return buildDeterministicAiSuggestion(params.product);
  }

  const generated = await requestOpenAiSuggestion({
    apiKey: params.openAiApiKey,
    product: params.product,
  });

  const suggestion = toSuggestionFromGenerated(params.product, generated);
  const guarded = applyComplianceGuardrails(params.product, suggestion);
  return alignSuggestionQualityScore(params.product, guarded);
}
