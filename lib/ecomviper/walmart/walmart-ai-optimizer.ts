import "server-only";

import {
  assessWalmartListingQuality,
  mergeWalmartAiSuggestionIntoProduct,
} from "@/lib/ecomviper/walmart/walmart-listing-quality";
import {
  buildDefaultAltText,
  buildDefaultMediaRecommendations,
  normalizeMediaRecommendations,
  normalizeSearchBrowseSuggestions,
  SUPPLEMENT_FDA_DISCLAIMER,
} from "@/lib/ecomviper/walmart/walmart-ai-visibility-content-policy";
import { pickMeaningfulAiText } from "@/lib/ecomviper/walmart/walmart-ai-field-sanitization";
import { buildSearchBrowseAttributesFromSources } from "@/lib/ecomviper/walmart/walmart-search-browse-attributes";
import type { WalmartAiSuggestion, WalmartProductRecord } from "@/lib/ecomviper/walmart/walmart-types";
import { buildAgenticReferralCopy } from "@/lib/ecomviper/walmart/agentic-referral-copy-agent";
import {
  extractCanonicalProductFacts,
  type CanonicalProductFacts,
} from "@/lib/ecomviper/walmart/product-facts-agent";
import { mapCanonicalFactsToSearchBrowse } from "@/lib/ecomviper/walmart/walmart-search-browse-mapper";
import { reviewWalmartSupplementCopy } from "@/lib/ecomviper/walmart/walmart-compliance-agent";
import {
  faqThresholdMet,
  sanitizeCustomerFacingList,
  sanitizeCustomerFacingText,
  shouldBlockGenericFaqAnswer,
} from "@/lib/ecomviper/walmart/walmart-truth-guard";

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
  aiVisibilitySummary?: unknown;
  structuredProductFactsSummary?: unknown;
  customerFitDescriptors?: unknown;
  compliantBenefitClusters?: unknown;
  faqSnippets?: unknown;
}

interface LayeredSuggestionInput {
  preferredTitle?: string;
  preferredShortDescription?: string;
  preferredLongDescription?: string;
  preferredBullets?: string[];
  preferredBrand?: string;
  aiCandidateAttributes?: Record<string, unknown>;
  missingAttributes?: string[];
  complianceWarnings?: string[];
  rejectedRiskyClaims?: string[];
  qualityScoreHint?: number | null;
  mediaRecommendations?: string[];
  altText?: string;
  aiVisibilitySummary?: string;
  structuredProductFactsSummary?: string;
  customerFitDescriptors?: string[];
  compliantBenefitClusters?: string[];
  faqSnippets?: string[];
  draftPayload?: Record<string, unknown> | null;
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

function buildEntitySetFromFacts(facts: CanonicalProductFacts, fallback: WalmartProductRecord) {
  return {
    brand: facts.brand || fallback.brand,
    productName: facts.productName || fallback.title,
    category: facts.productType || facts.category || fallback.category || "Supplement",
    keyIngredients: unique(facts.activeIngredients).slice(0, 8),
    form: facts.form || "",
    count: facts.count || "",
    audience: facts.targetAudience || "Adults",
    supportedBenefits: unique(facts.claimsFromLabel).slice(0, 8),
  };
}

function buildLayeredSuggestion(
  product: WalmartProductRecord,
  input: LayeredSuggestionInput
): WalmartAiSuggestion {
  const sourceSearchBrowse = buildSearchBrowseAttributesFromSources({ product });
  const factsResult = extractCanonicalProductFacts({
    product,
    draftPayload: input.draftPayload ?? null,
  });
  const facts = factsResult.facts;
  const baseCopy = buildAgenticReferralCopy({ facts, product });

  const faqThresholdSatisfied = faqThresholdMet({
    productName: sanitizeCustomerFacingText(facts.productName),
    productType: sanitizeCustomerFacingText(facts.productType || facts.category),
    brand: sanitizeCustomerFacingText(facts.brand),
    form: sanitizeCustomerFacingText(facts.form),
    mainIngredients: sanitizeCustomerFacingList(facts.activeIngredients),
    servingSize: sanitizeCustomerFacingText(facts.servingSize),
    servingsPerContainer: sanitizeCustomerFacingText(facts.servingsPerContainer),
    suggestedUse: sanitizeCustomerFacingText(facts.suggestedUse),
    supportAreas: sanitizeCustomerFacingList(baseCopy.compliantBenefitClusters),
  });
  const hasGroundedFaqEvidence =
    ((facts.activeIngredients.length > 0 || Object.keys(facts.supplementFacts).length > 0) &&
      (facts.sourceConfidence.activeIngredients === "high" ||
        facts.sourceConfidence.activeIngredients === "medium")) ||
    (Boolean(facts.servingSize) &&
      (facts.sourceConfidence.servingSize === "high" ||
        facts.sourceConfidence.servingSize === "medium")) ||
    (Boolean(facts.servingsPerContainer) &&
      (facts.sourceConfidence.servingsPerContainer === "high" ||
        facts.sourceConfidence.servingsPerContainer === "medium")) ||
    (Boolean(facts.suggestedUse) &&
      (facts.sourceConfidence.suggestedUse === "high" ||
        facts.sourceConfidence.suggestedUse === "medium")) ||
    (facts.claimsFromLabel.length > 0 &&
      (facts.sourceConfidence.claimsFromLabel === "high" ||
        facts.sourceConfidence.claimsFromLabel === "medium"));
  const faqShouldBePending =
    factsResult.imageFactsStatus === "needs_vision_extraction" &&
    (!faqThresholdSatisfied || !hasGroundedFaqEvidence);

  const candidateCopy = {
    ...baseCopy,
    title: pickMeaningfulAiText(input.preferredTitle) ?? baseCopy.title,
    shortDescription:
      pickMeaningfulAiText(input.preferredShortDescription) ?? baseCopy.shortDescription,
    longDescription: pickMeaningfulAiText(input.preferredLongDescription) ?? baseCopy.longDescription,
    bullets:
      (input.preferredBullets ?? [])
        .map((entry) => pickMeaningfulAiText(entry) ?? "")
        .filter(Boolean)
        .slice(0, 8).length >= 3
        ? unique(
            (input.preferredBullets ?? [])
              .map((entry) => pickMeaningfulAiText(entry) ?? "")
              .filter(Boolean)
          ).slice(0, 8)
        : baseCopy.bullets,
    aiVisibilitySummary:
      pickMeaningfulAiText(input.aiVisibilitySummary) ?? baseCopy.aiVisibilitySummary,
    structuredProductFactsSummary:
      pickMeaningfulAiText(input.structuredProductFactsSummary) ??
      baseCopy.structuredProductFactsSummary,
    customerFitDescriptors:
      (input.customerFitDescriptors ?? [])
        .map((entry) => pickMeaningfulAiText(entry) ?? "")
        .filter(Boolean).length > 0
        ? unique(
            (input.customerFitDescriptors ?? [])
              .map((entry) => pickMeaningfulAiText(entry) ?? "")
              .filter(Boolean)
          ).slice(0, 8)
        : baseCopy.customerFitDescriptors,
    compliantBenefitClusters:
      (input.compliantBenefitClusters ?? [])
        .map((entry) => pickMeaningfulAiText(entry) ?? "")
        .filter(Boolean).length > 0
        ? unique(
            (input.compliantBenefitClusters ?? [])
              .map((entry) => pickMeaningfulAiText(entry) ?? "")
              .filter(Boolean)
          ).slice(0, 8)
        : baseCopy.compliantBenefitClusters,
    faqSnippets:
      (input.faqSnippets ?? [])
        .map((entry) => pickMeaningfulAiText(entry) ?? "")
        .filter(Boolean).length > 0
        ? unique(
            (input.faqSnippets ?? [])
              .map((entry) => pickMeaningfulAiText(entry) ?? "")
              .filter((entry) => Boolean(entry) && !shouldBlockGenericFaqAnswer(entry))
          ).slice(0, 8)
        : baseCopy.faqSnippets,
  };

  if (faqShouldBePending) {
    candidateCopy.faqSnippets = [];
  }

  const compliance = reviewWalmartSupplementCopy(candidateCopy);
  const fallbackCompliance =
    compliance.finalDecision === "rejected"
      ? reviewWalmartSupplementCopy(baseCopy)
      : compliance;

  const compliantCopy = fallbackCompliance.compliantContent;

  const searchBrowseMap = mapCanonicalFactsToSearchBrowse({
    facts,
    copy: {
      ...baseCopy,
      ...compliantCopy,
      disclaimer: SUPPLEMENT_FDA_DISCLAIMER,
    },
    existingSearchBrowse: sourceSearchBrowse,
    aiCandidates: input.aiCandidateAttributes,
    staleFieldReplacements: factsResult.staleFieldReplacements,
    usedSources: factsResult.usedSources,
  });

  const entitySet = buildEntitySetFromFacts(facts, product);
  const suggestedBrand =
    pickMeaningfulAiText(input.preferredBrand) ?? facts.brand ?? product.brand;

  const rejectedRiskyClaims = unique([
    ...(input.rejectedRiskyClaims ?? []),
    ...fallbackCompliance.rejectedClaims,
  ]);

  const complianceWarnings = unique([
    ...(input.complianceWarnings ?? []),
    ...(compliance.finalDecision === "rejected"
      ? [
          "Generated copy failed compliance review and was replaced with deterministic compliant copy.",
        ]
      : []),
    ...(fallbackCompliance.repetitionWarnings.length > 0
      ? [
          "Repetitive filler was removed to improve readability and answer-engine quality.",
        ]
      : []),
    ...(rejectedRiskyClaims.length > 0
      ? [
          "Policy blocker removed: unsafe medical/drug claims were replaced with compliant support language.",
        ]
      : []),
    ...(compliance.finalDecision === "rejected"
      ? [
          "Policy blocker removed: unsafe medical/drug claims were replaced with compliant support language.",
        ]
      : []),
    ...(faqShouldBePending
      ? ["FAQ generation pending label extraction or product facts review."]
      : []),
    ...(factsResult.manufacturerNeedsReview
      ? ["Manufacturer appears copied from brand without source evidence."]
      : []),
  ]);

  const complianceChanges = unique([
    ...fallbackCompliance.changedFields,
    ...(compliance.finalDecision === "rejected" ? ["copy_rejected_fallback_applied"] : []),
    ...(fallbackCompliance.repetitionWarnings.length > 0 ? ["repetition_cleanup"] : []),
    fallbackCompliance.disclaimerStatus === "preserved"
      ? ""
      : `disclaimer_${fallbackCompliance.disclaimerStatus}`,
  ]).filter(Boolean);
  const complianceDecision =
    compliance.finalDecision === "rejected"
      ? "rejected"
      : fallbackCompliance.finalDecision;

  const factsUpdated = Object.entries(facts.sourceEvidence)
    .filter(([, evidence]) => Array.isArray(evidence) && evidence.length > 0)
    .map(([key]) => key)
    .slice(0, 32);

  const factReplacementEntries = factsResult.staleFieldReplacements.filter((entry) =>
    Boolean(entry.nextValue.trim())
  );
  const factClearedEntries = factsResult.staleFieldReplacements.filter(
    (entry) => !entry.nextValue.trim()
  );
  const staleFieldsReplaced = unique([
    ...factReplacementEntries.map((entry) => entry.field),
    ...searchBrowseMap.replacedFields,
  ]);
  const staleFactFieldsCleared = unique([
    ...factsResult.staleFieldsCleared,
    ...factClearedEntries.map((entry) => entry.field),
  ]);
  const staleFieldsCleared = unique([...searchBrowseMap.clearedFields]);

  const missingAttributes =
    (input.missingAttributes ?? []).length > 0
      ? unique(input.missingAttributes ?? [])
      : inferMissingSearchBrowseAttributes(searchBrowseMap.mappedAttributes);

  const qualityScore =
    input.qualityScoreHint ?? Math.max(55, 90 - product.issues.length * 6 - (product.imageUrl ? 0 : 4));

  return {
    sku: product.sku,
    qualityScore,
    suggestedTitle: compliantCopy.title,
    suggestedShortDescription: compliantCopy.shortDescription,
    suggestedDescription: compliantCopy.longDescription,
    suggestedBullets: compliantCopy.bullets,
    suggestedBrand,
    suggestedAttributes: searchBrowseMap.mappedAttributes,
    searchBrowseAttributes: searchBrowseMap.mappedAttributes,
    mediaRecommendations:
      normalizeMediaRecommendations(input.mediaRecommendations).length > 0
        ? normalizeMediaRecommendations(input.mediaRecommendations)
        : buildDefaultMediaRecommendations(),
    altText: pickMeaningfulAiText(input.altText) ?? buildDefaultAltText(entitySet),
    aiVisibilitySummary: compliantCopy.aiVisibilitySummary,
    structuredProductFactsSummary: compliantCopy.structuredProductFactsSummary,
    customerFitDescriptors: compliantCopy.customerFitDescriptors,
    compliantBenefitClusters: compliantCopy.compliantBenefitClusters,
    faqSnippets: faqShouldBePending ? [] : compliantCopy.faqSnippets,
    complianceNotes: unique([
      `Facts sources used: ${factsResult.usedSources.join(", ") || "none"}`,
      staleFieldsReplaced.length > 0
        ? `Stale fields replaced: ${staleFieldsReplaced.join(", ")}`
        : "No stale field replacements were required.",
      staleFactFieldsCleared.length > 0
        ? `Cleared canonical fact fields: ${staleFactFieldsCleared.join(", ")}`
        : "No canonical fact fields required clearing.",
      staleFieldsCleared.length > 0
        ? `Cleared Search & Browse fields: ${staleFieldsCleared.join(", ")}`
        : "No fields required clearing.",
      `Image-derived facts status: ${factsResult.imageFactsStatus}. ${factsResult.imageFactsMessage}`,
      `Manufacturer source: ${factsResult.manufacturerSource}. confidence=${factsResult.manufacturerConfidence}. needs_review=${factsResult.manufacturerNeedsReview}`,
      faqShouldBePending
        ? "FAQ generation pending label extraction or product facts review."
        : "FAQ generation passed fact-threshold checks.",
      complianceChanges.length > 0
        ? `Compliance changes: ${complianceChanges.join(", ")}`
        : "Compliance review accepted generated copy with no changes.",
    ]),
    rejectedRiskyClaims,
    applyDiagnostics: {
      factsUpdated,
      factsSources: factsResult.usedSources,
      staleFieldsReplaced,
      staleFieldsCleared,
      copyFieldsUpdated: fallbackCompliance.changedFields,
      searchBrowseFieldsUpdated: searchBrowseMap.updatedFields,
      searchBrowseFieldsReplaced: searchBrowseMap.replacedFields,
      complianceChanges,
      skippedProtectedFields: searchBrowseMap.skippedProtectedFields,
      skippedLowConfidenceFields: searchBrowseMap.skippedLowConfidenceFields,
      rejectedClaims: rejectedRiskyClaims,
      imageFactsStatus: factsResult.imageFactsStatus,
      imageFactsMessage: factsResult.imageFactsMessage,
      manufacturerSource: factsResult.manufacturerSource,
      manufacturerConfidence: factsResult.manufacturerConfidence,
      manufacturerNeedsReview: factsResult.manufacturerNeedsReview,
      faqGenerationState: faqShouldBePending ? "pending" : "final",
      disclaimerStatus: fallbackCompliance.disclaimerStatus,
      finalDecision: complianceDecision,
    },
    entitySet,
    missingAttributes,
    complianceWarnings,
    disclaimer: SUPPLEMENT_FDA_DISCLAIMER,
  };
}

export function buildDeterministicAiSuggestion(product: WalmartProductRecord): WalmartAiSuggestion {
  return buildLayeredSuggestion(product, {});
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
            "You optimize Walmart supplement listings for marketplace conversion and AI visibility. Return JSON only. Use product-specific facts grounded in provided product data. Do not hallucinate ingredients/flavor/form/count. Never include disease/treatment/cure/prevention/drug-comparison claims and never use terms like ED, erectile dysfunction, hypertension, anxiety, insomnia, depression, natural viagra, or works like cialis. Keep supplement FDA disclaimer exact and include it once in longDescription.",
        },
        {
          role: "user",
          content: JSON.stringify({
            task: "Generate layered Walmart enrichment suggestions with searchable, answer-engine-friendly copy.",
            requiredFields: [
              "suggestedTitle",
              "suggestedShortDescription",
              "suggestedDescription",
              "suggestedBullets",
              "suggestedBrand",
              "searchBrowseAttributes",
              "mediaRecommendations",
              "altText",
              "aiVisibilitySummary",
              "structuredProductFactsSummary",
              "customerFitDescriptors",
              "compliantBenefitClusters",
              "faqSnippets",
              "complianceWarnings",
              "rejectedRiskyClaims",
              "qualityScore",
            ],
            constraints: {
              titleMaxChars: 200,
              bulletsMin: 4,
              bulletsMax: 6,
              noDiseaseClaims: true,
              noUnsupportedFacts: true,
              noKeywordStuffing: true,
              disclaimerExactOnce: true,
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
  generated: Record<string, unknown>,
  draftPayload?: Record<string, unknown> | null
): WalmartAiSuggestion {
  const payload = generated as GeneratedSuggestionPayload;

  const title = firstNonEmptyString([payload.suggestedTitle, payload.title]);
  const shortDescription = firstNonEmptyString([
    payload.suggestedShortDescription,
    payload.suggestedShortDesc,
    payload.shortDescription,
  ]);
  const longDescription = firstNonEmptyString([
    payload.suggestedDescription,
    payload.suggestedLongDescription,
    payload.longDescription,
    payload.description,
  ]);

  const bullets = firstStringArray([
    payload.suggestedBullets,
    payload.suggestedBulletPoints,
    payload.bulletPoints,
    payload.keyFeatures,
  ]).slice(0, 8);

  const aiAttributes = {
    ...toAttributeRecord(payload.suggestedAttributes),
    ...toAttributeRecord(payload.attributes),
    ...toAttributeRecord(payload.keyAttributes),
    ...normalizeSearchBrowseSuggestions(payload.searchBrowseAttributes),
  };

  return buildLayeredSuggestion(product, {
    preferredTitle: title,
    preferredShortDescription: shortDescription,
    preferredLongDescription: longDescription,
    preferredBullets: bullets,
    preferredBrand: firstNonEmptyString([payload.suggestedBrand, payload.brand]),
    aiCandidateAttributes: aiAttributes,
    missingAttributes: toStringArray(payload.missingAttributes),
    complianceWarnings: unique([
      ...toStringArray(payload.complianceWarnings),
      ...toStringArray(payload.complianceNotes),
      ...product.issues,
    ]),
    rejectedRiskyClaims: toStringArray(payload.rejectedRiskyClaims),
    qualityScoreHint: clampScore(payload.qualityScore),
    mediaRecommendations: normalizeMediaRecommendations(payload.mediaRecommendations),
    altText: firstNonEmptyString([payload.altText]),
    aiVisibilitySummary: firstNonEmptyString([payload.aiVisibilitySummary]),
    structuredProductFactsSummary: firstNonEmptyString([payload.structuredProductFactsSummary]),
    customerFitDescriptors: toStringArray(payload.customerFitDescriptors),
    compliantBenefitClusters: toStringArray(payload.compliantBenefitClusters),
    faqSnippets: toStringArray(payload.faqSnippets),
    draftPayload: draftPayload ?? null,
  });
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
  draftPayload?: Record<string, unknown> | null;
}): Promise<WalmartAiSuggestion> {
  const useDeterministicMock = process.env.WALMART_AI_DETERMINISTIC_MOCK === "1";
  if (useDeterministicMock) {
    return alignSuggestionQualityScore(
      params.product,
      buildLayeredSuggestion(params.product, {
        draftPayload: params.draftPayload ?? null,
      })
    );
  }

  const generated = await requestOpenAiSuggestion({
    apiKey: params.openAiApiKey,
    product: params.product,
  });

  const suggestion = toSuggestionFromGenerated(
    params.product,
    generated,
    params.draftPayload ?? null
  );
  return alignSuggestionQualityScore(params.product, suggestion);
}
