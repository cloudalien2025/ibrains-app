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
import {
  applyWalmartDocketOptimizationRules,
  buildWalmartDocketOptimizationPromptContract,
} from "@/lib/ecomviper/walmart/walmart-optimization-rules";
import {
  getWalmartSerpApiCompetitorIntelligence,
  type WalmartCompetitorIntelligence,
} from "@/lib/ecomviper/walmart/walmart-serpapi-competitor-research";
import { buildAgenticReferralCopy } from "@/lib/ecomviper/walmart/agentic-referral-copy-agent";
import {
  extractCanonicalProductFacts,
  type CanonicalProductFacts,
} from "@/lib/ecomviper/walmart/product-facts-agent";
import { mapCanonicalFactsToSearchBrowse } from "@/lib/ecomviper/walmart/walmart-search-browse-mapper";
import { reviewWalmartSupplementCopy } from "@/lib/ecomviper/walmart/walmart-compliance-agent";
import { evaluateWalmartListingCompliance } from "@/lib/ecomviper/walmart/walmart-compliance";
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
  competitorContext?: WalmartCompetitorIntelligence | null;
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
    ...(input.competitorContext?.warnings ?? []),
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
      competitorResearchStatus: input.competitorContext?.status,
      competitorResearchWarnings: input.competitorContext?.warnings ?? [],
      optimizationFlow: "full_docket_rules_engine",
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

function includesUnsafeOrPromotionalCopy(value: string): boolean {
  return /(cure|treat|prevent|reverse|diagnose|viagra|cialis|insomnia|depression|anxiety|hypertension|erectile dysfunction)/i.test(
    value
  );
}

function titleNeedsRulesReplacement(value: string): boolean {
  const title = value.trim();
  if (!title) return true;
  if (title.length > 150) return true;
  if (/best seller|free shipping|limited time|guaranteed|#1/i.test(title)) return true;
  return includesUnsafeOrPromotionalCopy(title);
}

function shortDescriptionNeedsRulesReplacement(value: string): boolean {
  const text = value.trim();
  if (!text) return true;
  if (includesUnsafeOrPromotionalCopy(text)) return true;
  const sentenceCount = text.split(/[.!?]/).filter((entry) => entry.trim().length > 0).length;
  return sentenceCount !== 1;
}

function mapRulesOutputToSearchBrowseAttributes(
  output: ReturnType<typeof applyWalmartDocketOptimizationRules>["output"]
): Record<string, string> {
  const mapped: Record<string, string> = {
    product_type: output.searchBrowse.productType,
    supplement_type: output.searchBrowse.supplementType,
    product_form: output.searchBrowse.form,
    form: output.searchBrowse.form,
    flavor: output.searchBrowse.flavor,
    count: output.searchBrowse.count,
    serving_size: output.searchBrowse.servingSize,
    main_ingredients: output.searchBrowse.mainIngredients.join(", "),
    support_areas: output.searchBrowse.benefitsSupportAreas.join(", "),
    target_audience: output.searchBrowse.targetAudience,
    suggested_use: output.searchBrowse.suggestedUse,
    directions_suggested_use: output.searchBrowse.directionsSuggestedUse ?? output.searchBrowse.suggestedUse,
    search_keywords: output.searchBrowse.searchKeywords.join(", "),
    search_terms: output.searchBrowse.searchTerms.join(", "),
    category: output.searchBrowse.category,
  };

  if (output.searchBrowse.servingsPerContainer) {
    mapped.servings_per_container = output.searchBrowse.servingsPerContainer;
    mapped.servings = output.searchBrowse.servingsPerContainer;
  }
  if (output.searchBrowse.dosageStrength) {
    mapped.dosage_strength = output.searchBrowse.dosageStrength;
  }
  if (output.searchBrowse.ingredientsList) {
    mapped.ingredients_list = output.searchBrowse.ingredientsList;
  }
  if (output.searchBrowse.safetyWarnings) {
    mapped.safety_warnings = output.searchBrowse.safetyWarnings;
    mapped.warnings = output.searchBrowse.safetyWarnings;
  }
  if (output.searchBrowse.countPerPack) {
    mapped.count_per_pack = output.searchBrowse.countPerPack;
    mapped.count_per_package = output.searchBrowse.countPerPack;
  }
  if (output.searchBrowse.allergenFreeStatements) {
    mapped.allergen_free_statements = output.searchBrowse.allergenFreeStatements;
  }

  return mapped;
}

function applyRulesEngineToSuggestion(params: {
  product: WalmartProductRecord;
  draftPayload?: Record<string, unknown> | null;
  suggestion: WalmartAiSuggestion;
  competitorContext: WalmartCompetitorIntelligence;
}): WalmartAiSuggestion {
  const rulesResult = applyWalmartDocketOptimizationRules({
    product: params.product,
    draftPayload: params.draftPayload ?? null,
    competitorPatterns: params.competitorContext.patterns,
  });

  const rulesOutput = rulesResult.output;
  const rulesSearchBrowse = mapRulesOutputToSearchBrowseAttributes(rulesOutput);

  const nextTitle = titleNeedsRulesReplacement(params.suggestion.suggestedTitle)
    ? rulesOutput.content.productTitle
    : params.suggestion.suggestedTitle;
  const nextShortDescription = shortDescriptionNeedsRulesReplacement(
    params.suggestion.suggestedShortDescription ?? ""
  )
    ? rulesOutput.content.shortDescription
    : params.suggestion.suggestedShortDescription ?? "";
  const nextLongDescription = rulesOutput.content.longDescription;
  const nextBullets = rulesOutput.content.bullets;

  const suggestedAttributes = {
    ...(params.suggestion.suggestedAttributes ?? {}),
    ...rulesSearchBrowse,
  };
  const searchBrowseAttributes = {
    ...(params.suggestion.searchBrowseAttributes ?? {}),
    ...rulesSearchBrowse,
  };

  const missingAttributes = unique([
    ...(params.suggestion.missingAttributes ?? []),
    ...(rulesOutput.validation.blockers.some((entry) =>
      /product type|category/i.test(entry)
    )
      ? ["product_type_or_category"]
      : []),
  ]);

  const complianceWarnings = unique([
    ...(params.suggestion.complianceWarnings ?? []),
    ...rulesOutput.validation.warnings,
    ...rulesOutput.validation.blockers,
    ...(rulesOutput.validation.removedClaims.length > 0
      ? [`Removed unsupported claims: ${rulesOutput.validation.removedClaims.join(", ")}`]
      : []),
    ...params.competitorContext.warnings,
  ]);

  const complianceNotes = unique([
    ...(params.suggestion.complianceNotes ?? []),
    ...rulesOutput.content.complianceNotes,
    ...rulesOutput.pricingInventory.priceNotes,
    ...rulesOutput.pricingInventory.inventoryNotes,
    `Flavor provenance: ${rulesOutput.searchBrowse.flavor} (${rulesOutput.searchBrowse.flavorSource}, ${rulesOutput.searchBrowse.flavorConfidence}).`,
    `Competitor intelligence status: ${params.competitorContext.status}.`,
  ]);

  const applyDiagnostics = {
    ...(params.suggestion.applyDiagnostics ?? {
      factsUpdated: [],
      factsSources: [],
      staleFieldsReplaced: [],
      staleFieldsCleared: [],
      copyFieldsUpdated: [],
      searchBrowseFieldsUpdated: [],
      searchBrowseFieldsReplaced: [],
      complianceChanges: [],
      skippedProtectedFields: [],
      skippedLowConfidenceFields: [],
      rejectedClaims: [],
      disclaimerStatus: "preserved" as const,
      finalDecision: "accepted" as const,
    }),
    complianceChanges: unique([
      ...(params.suggestion.applyDiagnostics?.complianceChanges ?? []),
      "rules_engine_applied",
    ]),
    staleFieldsCleared: unique([
      ...(params.suggestion.applyDiagnostics?.staleFieldsCleared ?? []),
      ...(!rulesOutput.searchBrowse.allergenFreeStatements ? ["allergen_free_statements"] : []),
    ]),
    competitorResearchStatus: params.competitorContext.status,
    competitorResearchWarnings: params.competitorContext.warnings,
    optimizationFlow: "full_docket_rules_engine" as const,
  };

  const candidate: WalmartAiSuggestion = {
    ...params.suggestion,
    suggestedTitle: nextTitle,
    suggestedShortDescription: nextShortDescription,
    suggestedDescription: nextLongDescription,
    suggestedBullets: nextBullets,
    suggestedAttributes,
    searchBrowseAttributes,
    mediaRecommendations:
      normalizeMediaRecommendations(params.suggestion.mediaRecommendations).length > 0
        ? normalizeMediaRecommendations(params.suggestion.mediaRecommendations)
        : rulesOutput.media.mediaRecommendations,
    altText: pickMeaningfulAiText(params.suggestion.altText) ?? rulesOutput.media.altTextGuidance,
    qualityScore: Math.max(params.suggestion.qualityScore, rulesOutput.score.after),
    complianceWarnings,
    complianceNotes,
    missingAttributes,
    applyDiagnostics,
  };

  const candidateCompliance = evaluateWalmartListingCompliance({
    title: candidate.suggestedTitle,
    shortDescription: candidate.suggestedShortDescription ?? "",
    longDescription: candidate.suggestedDescription,
    bulletPoints: candidate.suggestedBullets,
  });
  if (candidateCompliance.valid) {
    return candidate;
  }

  const deterministicFallback = buildLayeredSuggestion(params.product, {
    draftPayload: params.draftPayload ?? null,
    competitorContext: params.competitorContext,
  });
  const candidateDiagnostics = candidate.applyDiagnostics ?? applyDiagnostics;
  return {
    ...candidate,
    suggestedTitle: deterministicFallback.suggestedTitle,
    suggestedShortDescription: deterministicFallback.suggestedShortDescription,
    suggestedDescription: deterministicFallback.suggestedDescription,
    suggestedBullets: deterministicFallback.suggestedBullets,
    complianceWarnings: unique([
      ...(candidate.complianceWarnings ?? []),
      "Rules-engine output failed compliance checks and deterministic compliant fallback was applied.",
      ...candidateCompliance.violations,
    ]),
    applyDiagnostics: {
      factsUpdated: candidateDiagnostics.factsUpdated ?? [],
      factsSources: candidateDiagnostics.factsSources ?? [],
      staleFieldsReplaced: candidateDiagnostics.staleFieldsReplaced ?? [],
      staleFieldsCleared: candidateDiagnostics.staleFieldsCleared ?? [],
      copyFieldsUpdated: candidateDiagnostics.copyFieldsUpdated ?? [],
      searchBrowseFieldsUpdated: candidateDiagnostics.searchBrowseFieldsUpdated ?? [],
      searchBrowseFieldsReplaced: candidateDiagnostics.searchBrowseFieldsReplaced ?? [],
      complianceChanges: unique([
        ...(candidateDiagnostics.complianceChanges ?? []),
        "rules_engine_compliance_fallback",
      ]),
      skippedProtectedFields: candidateDiagnostics.skippedProtectedFields ?? [],
      skippedLowConfidenceFields: candidateDiagnostics.skippedLowConfidenceFields ?? [],
      rejectedClaims: candidateDiagnostics.rejectedClaims ?? [],
      imageFactsStatus: candidateDiagnostics.imageFactsStatus,
      imageFactsMessage: candidateDiagnostics.imageFactsMessage,
      manufacturerSource: candidateDiagnostics.manufacturerSource,
      manufacturerConfidence: candidateDiagnostics.manufacturerConfidence,
      manufacturerNeedsReview: candidateDiagnostics.manufacturerNeedsReview,
      faqGenerationState: candidateDiagnostics.faqGenerationState,
      competitorResearchStatus: candidateDiagnostics.competitorResearchStatus,
      competitorResearchWarnings: candidateDiagnostics.competitorResearchWarnings ?? [],
      optimizationFlow: candidateDiagnostics.optimizationFlow ?? "full_docket_rules_engine",
      disclaimerStatus: candidateDiagnostics.disclaimerStatus ?? "preserved",
      finalDecision: "accepted_with_changes",
    },
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
  draftPayload?: Record<string, unknown> | null;
  competitorContext?: WalmartCompetitorIntelligence | null;
}): Promise<Record<string, unknown>> {
  const promptContract = buildWalmartDocketOptimizationPromptContract({
    product: params.product,
    draftPayload: params.draftPayload ?? null,
    competitorPatterns: params.competitorContext?.patterns ?? null,
  });
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
            "You optimize Walmart supplement listings for marketplace conversion and AI visibility. Return JSON only. Use product-specific facts grounded in provided product data. Do not hallucinate ingredients/flavor/form/count. If no trusted flavor evidence exists, set searchBrowse.flavor to Unflavored and do not mention flavor in title, shortDescription, longDescription, or bullets. Never infer flavor from color, ingredients, or competitor listings. Never include disease/treatment/cure/prevention/drug-comparison claims and never use terms like ED, erectile dysfunction, hypertension, anxiety, insomnia, depression, natural viagra, or works like cialis. Keep supplement FDA disclaimer exact and include it once in longDescription. Run grammar cleanup to remove duplicated support phrasing and awkward constructions. Optimize the full docket, never field-by-field, and do not copy competitor text.",
        },
        {
          role: "user",
          content: JSON.stringify({
            task: "Generate layered Walmart enrichment suggestions with searchable, answer-engine-friendly copy in one full-docket optimization pass.",
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
              competitorUsage: "patterns_only_do_not_copy_text",
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
            contract: promptContract,
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
  userId?: string;
}): Promise<WalmartAiSuggestion> {
  const competitorContext = params.userId
    ? await getWalmartSerpApiCompetitorIntelligence({
        userId: params.userId,
        product: params.product,
        draftPayload: params.draftPayload ?? null,
      })
    : ({
        status: "skipped_no_credentials",
        queries: [],
        competitors: [],
        patterns: {
          titlePatterns: [],
          commonAttributes: [],
          supportPhrases: [],
          mediaPatterns: [],
          priceCountNotes: [],
          gaps: [],
        },
        warnings: ["Competitor research skipped: user context unavailable."],
      } satisfies WalmartCompetitorIntelligence);

  const useDeterministicMock = process.env.WALMART_AI_DETERMINISTIC_MOCK === "1";
  if (useDeterministicMock) {
    const deterministicSuggestion = buildLayeredSuggestion(params.product, {
      draftPayload: params.draftPayload ?? null,
      competitorContext,
    });
    return alignSuggestionQualityScore(
      params.product,
      applyRulesEngineToSuggestion({
        product: params.product,
        draftPayload: params.draftPayload ?? null,
        suggestion: deterministicSuggestion,
        competitorContext,
      })
    );
  }

  const generated = await requestOpenAiSuggestion({
    apiKey: params.openAiApiKey,
    product: params.product,
    draftPayload: params.draftPayload ?? null,
    competitorContext,
  });

  const suggestion = applyRulesEngineToSuggestion({
    product: params.product,
    draftPayload: params.draftPayload ?? null,
    suggestion: toSuggestionFromGenerated(
      params.product,
      generated,
      params.draftPayload ?? null
    ),
    competitorContext,
  });
  return alignSuggestionQualityScore(params.product, suggestion);
}
