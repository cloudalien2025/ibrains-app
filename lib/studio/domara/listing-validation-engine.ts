import {
  nowIso,
} from "@/lib/studio/domara/ai-channel-engine/ids";
import type {
  CasaHudCampaign,
  CasaHudListingCandidate,
  CasaHudListingSearchCriteria,
  CasaHudListingValidationScoreBreakdown,
  CasaHudListingValidationSummary,
  CasaHudValidatedListing,
  CasaHudValidatedListingStatus,
} from "@/lib/studio/domara/campaigns";
import { deriveCasaHudListingSearchCriteria } from "@/lib/studio/domara/listing-discovery-engine";

type ListingValidationEvaluation = {
  listing: CasaHudListingCandidate;
  scoreBreakdown: CasaHudListingValidationScoreBreakdown;
  validationReasons: string[];
  warnings: string[];
  rejectionCategory?: CasaHudValidatedListing["rejectionCategory"];
  duplicateGroupKey: string;
  preliminaryStrength: number;
};

export type CasaHudListingValidationResult = {
  approvedListings: CasaHudValidatedListing[];
  rejectedListings: CasaHudValidatedListing[];
  listingRankOrder: string[];
  listingValidationSummary: CasaHudListingValidationSummary;
  titleSupportConfidence: number;
  validationWarnings: string[];
};

const TITLE_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "best",
  "could",
  "for",
  "homes",
  "house",
  "houses",
  "in",
  "inside",
  "of",
  "or",
  "property",
  "properties",
  "the",
  "to",
  "under",
  "with",
  "you",
]);

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function uniqueStrings(values: Array<string | undefined>): string[] {
  return Array.from(
    new Set(
      values
        .flatMap((value) => (typeof value === "string" ? [value.trim()] : []))
        .filter((value) => value.length > 0),
    ),
  );
}

function normalizeText(value: string | undefined): string {
  return (value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function includesToken(corpus: string, token: string): boolean {
  return normalizeText(corpus).includes(normalizeText(token));
}

function normalizePropertyType(value: string | undefined): string {
  const normalized = normalizeText(value);
  if (normalized.includes("farmhouse") || normalized.includes("country house")) return "farmhouse";
  if (normalized.includes("villa")) return "villa";
  if (normalized.includes("apartment") || normalized.includes("flat")) return "apartment";
  if (normalized.includes("townhouse") || normalized.includes("town house")) return "townhouse";
  if (normalized.includes("house") || normalized.includes("home")) return "house";
  return normalized;
}

function extractClaimKeywords(title: string): string[] {
  return Array.from(
    new Set(
      normalizeText(title)
        .split(/\s+/)
        .filter((token) => token.length > 2 && !TITLE_STOP_WORDS.has(token)),
    ),
  );
}

function buildListingCorpus(listing: CasaHudListingCandidate): string {
  return [
    listing.title,
    listing.locationText,
    listing.region,
    listing.city,
    listing.country,
    listing.propertyType,
    listing.descriptionSnippet,
    listing.preliminaryMatchNotes,
    ...listing.features,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ");
}

function geographyScore(listing: CasaHudListingCandidate, criteria: CasaHudListingSearchCriteria): number {
  const corpus = buildListingCorpus(listing);
  const exactCityMatch = criteria.cities.some((city) => includesToken(corpus, city));
  if (exactCityMatch) return 100;

  const regionHint = criteria.regionHint?.trim();
  if (regionHint && includesToken(corpus, regionHint)) return 88;

  if (criteria.country && includesToken(corpus, criteria.country)) return 58;
  return 28;
}

function priceFitScore(listing: CasaHudListingCandidate, criteria: CasaHudListingSearchCriteria): number {
  if (typeof listing.price !== "number" || !Number.isFinite(listing.price)) return 36;

  if (typeof criteria.maxPrice === "number") {
    if (listing.price <= criteria.maxPrice) return 100;
    if (listing.price <= criteria.maxPrice * 1.1) return 70;
    if (listing.price <= criteria.maxPrice * 1.25) return 42;
    return 8;
  }

  if (criteria.pricePositioning === "affordable") {
    if (listing.price <= 350_000) return 96;
    if (listing.price <= 500_000) return 72;
    return 22;
  }
  if (criteria.pricePositioning === "luxury") {
    if (listing.price >= 900_000) return 95;
    if (listing.price >= 650_000) return 72;
    return 32;
  }
  if (criteria.pricePositioning === "premium") {
    if (listing.price >= 550_000 && listing.price <= 1_800_000) return 90;
    if (listing.price >= 400_000) return 70;
    return 48;
  }
  if (listing.price <= 1_000_000) return 82;
  if (listing.price <= 1_500_000) return 62;
  return 46;
}

function propertyTypeScore(listing: CasaHudListingCandidate, criteria: CasaHudListingSearchCriteria): number {
  if (criteria.propertyTypes.length === 0) return 70;
  const listingType = normalizePropertyType(listing.propertyType);
  if (!listingType) {
    if (listing.sourceType === "imported_url" || listing.sourceType === "browser_assisted_import") return 52;
    return 34;
  }

  const normalizedCriteria = criteria.propertyTypes.map((type) => normalizePropertyType(type));
  if (normalizedCriteria.includes(listingType)) return 100;
  if (
    (normalizedCriteria.includes("house") && listingType === "villa") ||
    (normalizedCriteria.includes("villa") && listingType === "house") ||
    (normalizedCriteria.includes("farmhouse") && listingType === "house")
  ) {
    return 70;
  }
  return 18;
}

function featureMatchTokens(criteria: CasaHudListingSearchCriteria): string[] {
  return uniqueStrings([
    ...criteria.featureTags,
    ...criteria.lifestyleTags,
    ...extractClaimKeywords(criteria.titlePromise),
  ]);
}

function featureClaimScore(listing: CasaHudListingCandidate, criteria: CasaHudListingSearchCriteria): number {
  const tokens = featureMatchTokens(criteria).filter((token) => token.length > 3);
  if (tokens.length === 0) return 68;

  const corpus = buildListingCorpus(listing);
  const matches = tokens.filter((token) => includesToken(corpus, token)).length;
  if (matches === 0) return 28;
  return clampScore(30 + (matches / tokens.length) * 70);
}

function mediaAvailabilityScore(listing: CasaHudListingCandidate): number {
  if (listing.photoAvailability === "none") return 8;
  if (listing.photoAvailability === "limited") return clampScore(40 + listing.imageCount * 4);
  return clampScore(62 + listing.imageCount * 3);
}

function listingCompletenessScore(listing: CasaHudListingCandidate): number {
  const checks = [
    typeof listing.price === "number",
    Boolean(listing.sourceUrl),
    Boolean(listing.propertyType),
    Boolean(listing.city || (listing.locationText && listing.locationText !== "Location needs review")),
    typeof listing.bedrooms === "number",
    typeof listing.bathrooms === "number",
    typeof listing.sizeSqm === "number",
    Boolean(listing.descriptionSnippet),
    listing.features.length > 0,
  ];
  const present = checks.filter(Boolean).length;
  return clampScore((present / checks.length) * 100);
}

function providerQualityScore(listing: CasaHudListingCandidate): number {
  if (listing.sourceType === "imported_url" || listing.sourceType === "browser_assisted_import") {
    return listing.provider === "generic" ? 74 : 80;
  }
  if (listing.provider === "idealista") return 92;
  if (listing.provider === "immobiliare") return 90;
  return 64;
}

function duplicateGroupKey(listing: CasaHudListingCandidate): string {
  if (listing.sourceUrl) return `url:${normalizeText(listing.sourceUrl)}`;
  if (listing.providerListingId) return `provider:${listing.provider}:${normalizeText(listing.providerListingId)}`;

  const title = normalizeText(listing.title);
  const location = normalizeText([listing.city, listing.region, listing.locationText].filter(Boolean).join(" "));
  const priceBucket =
    typeof listing.price === "number" && Number.isFinite(listing.price)
      ? String(Math.round(listing.price / 5_000))
      : "na";
  const sizeBucket =
    typeof listing.sizeSqm === "number" && Number.isFinite(listing.sizeSqm)
      ? String(Math.round(listing.sizeSqm / 10))
      : "na";

  return `fingerprint:${title}:${location}:${priceBucket}:${sizeBucket}`;
}

function scoreTruthfulness(
  listing: CasaHudListingCandidate,
  criteria: CasaHudListingSearchCriteria,
  metrics: {
    geography: number;
    price: number;
    propertyType: number;
    feature: number;
    media: number;
    completeness: number;
    providerQuality: number;
  },
): number {
  const title = criteria.titlePromise.toLowerCase();
  const activeClaims: number[] = [metrics.geography, metrics.propertyType, metrics.feature];

  if (title.includes("under ") || title.includes("affordable") || typeof criteria.maxPrice === "number") {
    activeClaims.push(metrics.price);
  }
  if (title.includes("inside ") || criteria.singlePropertyFocus) {
    activeClaims.push(metrics.media, metrics.completeness);
  }
  if (title.includes("luxury") || title.includes("stunning") || title.includes("best")) {
    activeClaims.push(metrics.media, metrics.providerQuality);
  }

  const corpus = buildListingCorpus(listing);
  const keywordHits = extractClaimKeywords(criteria.titlePromise).filter((token) => includesToken(corpus, token)).length;
  const keywordScore = extractClaimKeywords(criteria.titlePromise).length > 0
    ? clampScore((keywordHits / extractClaimKeywords(criteria.titlePromise).length) * 100)
    : 65;
  activeClaims.push(keywordScore);

  return clampScore(average(activeClaims));
}

function computeOverallScore(scoreBreakdown: Omit<CasaHudListingValidationScoreBreakdown, "overallScore">): number {
  return clampScore(
    scoreBreakdown.titleMatchScore * 0.2 +
      scoreBreakdown.geographyScore * 0.15 +
      scoreBreakdown.priceFitScore * 0.12 +
      scoreBreakdown.propertyTypeScore * 0.12 +
      scoreBreakdown.featureClaimScore * 0.12 +
      scoreBreakdown.mediaAvailabilityScore * 0.1 +
      scoreBreakdown.listingCompletenessScore * 0.09 +
      scoreBreakdown.providerQualityScore * 0.05 +
      scoreBreakdown.uniquenessScore * 0.05,
  );
}

function evaluateListing(listing: CasaHudListingCandidate, criteria: CasaHudListingSearchCriteria): ListingValidationEvaluation {
  const geography = geographyScore(listing, criteria);
  const price = priceFitScore(listing, criteria);
  const propertyType = propertyTypeScore(listing, criteria);
  const feature = featureClaimScore(listing, criteria);
  const media = mediaAvailabilityScore(listing);
  const completeness = listingCompletenessScore(listing);
  const providerQuality = providerQualityScore(listing);
  const titleMatch = scoreTruthfulness(listing, criteria, {
    geography,
    price,
    propertyType,
    feature,
    media,
    completeness,
    providerQuality,
  });
  const scoreBreakdownWithoutOverall = {
    titleMatchScore: titleMatch,
    geographyScore: geography,
    priceFitScore: price,
    propertyTypeScore: propertyType,
    featureClaimScore: feature,
    mediaAvailabilityScore: media,
    listingCompletenessScore: completeness,
    providerQualityScore: providerQuality,
    uniquenessScore: 100,
  };
  const overallScore = computeOverallScore(scoreBreakdownWithoutOverall);
  const validationReasons: string[] = [];
  const warnings: string[] = [];
  let rejectionCategory: CasaHudValidatedListing["rejectionCategory"] | undefined;
  const isImported = listing.sourceType === "imported_url" || listing.sourceType === "browser_assisted_import";

  if (geography >= 80) {
    validationReasons.push("Location aligns with the campaign region.");
  } else if (geography < 40) {
    validationReasons.push("Location is weak for the campaign geography.");
    rejectionCategory = "geography_mismatch";
  }

  if (typeof criteria.maxPrice === "number" && typeof listing.price === "number") {
    if (listing.price <= criteria.maxPrice) {
      validationReasons.push("Price stays inside the budget angle.");
    } else if (listing.price <= criteria.maxPrice * 1.1) {
      warnings.push("Price lands slightly above the budget angle.");
    } else {
      validationReasons.push("Price sits too far above the budget angle.");
      rejectionCategory = "price_mismatch";
    }
  } else if (typeof listing.price !== "number") {
    warnings.push("Price needs review before this property can carry the budget angle.");
  }

  if (propertyType >= 80) {
    validationReasons.push("Property type fits the selected title angle.");
  } else if (propertyType < 35) {
    validationReasons.push("Property type does not fit the story angle yet.");
    if (!isImported || Boolean(listing.propertyType)) {
      rejectionCategory = rejectionCategory || "property_type_mismatch";
    }
  }

  if (feature >= 70) {
    validationReasons.push("Key feature claims are supported by the listing details.");
  } else if (feature < 35) {
    warnings.push("Feature support is thin for this title.");
  }

  if (media < 40) {
    warnings.push("Photo coverage is weak for a strong video package.");
  } else {
    validationReasons.push("Media coverage is usable for the shortlist.");
  }

  if (completeness < 45) {
    warnings.push("Listing details are incomplete.");
    if (!isImported || listing.manualCompletionStatus === "incomplete") {
      rejectionCategory = rejectionCategory || "incomplete";
    }
  }

  if (titleMatch < 45) {
    validationReasons.push("Overall story support is too weak.");
    if (!isImported || titleMatch < 35) {
      rejectionCategory = rejectionCategory || "weak_support";
    }
  }

  if (
    (listing.sourceType === "imported_url" || listing.sourceType === "browser_assisted_import") &&
    listing.needsReviewFields?.length
  ) {
    warnings.push(
      `${listing.sourceType === "browser_assisted_import" ? "Browser import" : "Imported URL"} needs review for ${listing.needsReviewFields
        .map((field) => field.replace(/_/g, " "))
        .join(", ")}.`,
    );
    warnings.push("Manual edits can clear these review fields and improve this listing's validation status.");
  }

  return {
    listing,
    scoreBreakdown: {
      ...scoreBreakdownWithoutOverall,
      overallScore,
    },
    validationReasons,
    warnings,
    rejectionCategory,
    duplicateGroupKey: duplicateGroupKey(listing),
    preliminaryStrength: overallScore + providerQuality * 0.2 + media * 0.15 + completeness * 0.15,
  };
}

function toValidatedListing(
  evaluation: ListingValidationEvaluation,
  validationStatus: CasaHudValidatedListingStatus,
  overrides?: Partial<CasaHudValidatedListing>,
): CasaHudValidatedListing {
  return {
    ...evaluation.listing,
    validationStatus,
    overallScore: evaluation.scoreBreakdown.overallScore,
    scoreBreakdown: evaluation.scoreBreakdown,
    validationReasons: evaluation.validationReasons,
    warnings: evaluation.warnings,
    ...overrides,
  };
}

function validationDecision(evaluation: ListingValidationEvaluation): {
  status: CasaHudValidatedListingStatus;
  rejectionCategory?: CasaHudValidatedListing["rejectionCategory"];
} {
  const { scoreBreakdown, rejectionCategory, listing } = evaluation;
  const isImported = listing.sourceType === "imported_url" || listing.sourceType === "browser_assisted_import";
  const hardGeographyMiss = scoreBreakdown.geographyScore < 25;
  const hardPriceMiss = scoreBreakdown.priceFitScore < 10;
  const hardPropertyTypeMiss = scoreBreakdown.propertyTypeScore < 20 && Boolean(listing.propertyType);
  const hardSupportMiss = scoreBreakdown.titleMatchScore < 35 && scoreBreakdown.overallScore < 48;
  const hardDataGapMiss = scoreBreakdown.listingCompletenessScore < 22 && scoreBreakdown.mediaAvailabilityScore < 18;
  const hasHardMiss = hardGeographyMiss || hardPriceMiss || hardPropertyTypeMiss || hardSupportMiss || hardDataGapMiss;

  if (hasHardMiss) {
    if (isImported && !hardGeographyMiss && !hardPriceMiss && !hardPropertyTypeMiss) {
      return { status: "needs_attention", rejectionCategory: rejectionCategory || "weak_support" };
    }
    return {
      status: "rejected",
      rejectionCategory: rejectionCategory || "weak_support",
    };
  }

  const approvalThresholds = isImported
    ? {
        overallScore: 64,
        titleMatchScore: 54,
        geographyScore: 46,
        propertyTypeScore: 40,
      }
    : {
        overallScore: 72,
        titleMatchScore: 62,
        geographyScore: 58,
        propertyTypeScore: 48,
      };

  if (
    scoreBreakdown.overallScore >= approvalThresholds.overallScore &&
    scoreBreakdown.titleMatchScore >= approvalThresholds.titleMatchScore &&
    scoreBreakdown.geographyScore >= approvalThresholds.geographyScore &&
    scoreBreakdown.propertyTypeScore >= approvalThresholds.propertyTypeScore
  ) {
    return { status: "approved" };
  }

  if (scoreBreakdown.overallScore >= 56) {
    return { status: "needs_attention", rejectionCategory: rejectionCategory || "weak_support" };
  }

  return { status: "rejected", rejectionCategory: rejectionCategory || "weak_support" };
}

function summarizeConfidence(
  approvedListings: CasaHudValidatedListing[],
  rejectedListings: CasaHudValidatedListing[],
  criteria: CasaHudListingSearchCriteria,
): number {
  const approvedAverage = average(approvedListings.map((listing) => listing.overallScore));
  const needsAttention = rejectedListings.filter((listing) => listing.validationStatus === "needs_attention");
  const needsAttentionAverage = average(needsAttention.map((listing) => listing.overallScore));
  const expectedCount = criteria.singlePropertyFocus ? 1 : Math.min(Math.max(criteria.targetListingCount, 3), 6);
  const coverage = Math.min(1, approvedListings.length / expectedCount);

  return clampScore(approvedAverage * 0.6 + coverage * 25 + needsAttentionAverage * 0.15);
}

function buildValidationSummary(
  approvedListings: CasaHudValidatedListing[],
  rejectedListings: CasaHudValidatedListing[],
  criteria: CasaHudListingSearchCriteria,
  validationWarnings: string[],
): CasaHudListingValidationSummary {
  const discoveredCount = approvedListings.length + rejectedListings.length;
  const needsAttentionCount = rejectedListings.filter((listing) => listing.validationStatus === "needs_attention").length;
  const titleSupportConfidence = summarizeConfidence(approvedListings, rejectedListings, criteria);
  const headline =
    titleSupportConfidence >= 75
      ? `Approved ${approvedListings.length} of ${discoveredCount} discovered listings for the current story.`
      : "The discovered listings only partly support the current story.";

  return {
    headline,
    rankingExplanation:
      "CasaFlix ranked the shortlist by story fit, geography, pricing, feature support, media strength, and duplicate reduction.",
    discoveredCount,
    approvedCount: approvedListings.length,
    rejectedCount: rejectedListings.length,
    needsAttentionCount,
    titleSupportConfidence,
    warnings: validationWarnings,
    completedAt: nowIso(),
  };
}

export function runCasaHudListingValidation(campaign: CasaHudCampaign): CasaHudListingValidationResult {
  const criteria = campaign.listingSearchCriteria || deriveCasaHudListingSearchCriteria(campaign);
  const evaluated = campaign.listingCandidates.map((listing) => evaluateListing(listing, criteria));
  const groups = new Map<string, ListingValidationEvaluation[]>();

  for (const evaluation of evaluated) {
    const current = groups.get(evaluation.duplicateGroupKey) || [];
    current.push(evaluation);
    groups.set(evaluation.duplicateGroupKey, current);
  }

  const approvedListings: CasaHudValidatedListing[] = [];
  const rejectedListings: CasaHudValidatedListing[] = [];
  const validationWarnings = new Set<string>();

  for (const group of groups.values()) {
    const sorted = [...group].sort((left, right) => right.preliminaryStrength - left.preliminaryStrength);
    const primary = sorted[0];

    for (const [index, evaluation] of sorted.entries()) {
      if (index > 0) {
        rejectedListings.push(
          toValidatedListing(evaluation, "rejected", {
            duplicateOfListingId: primary.listing.id,
            duplicateGroupKey: evaluation.duplicateGroupKey,
            duplicateReferenceIds: sorted.map((entry) => entry.listing.id),
            rejectionCategory: "duplicate",
            warnings: uniqueStrings([
              ...evaluation.warnings,
              "Duplicate source overlap detected. CasaFlix kept the stronger candidate.",
            ]),
            validationReasons: uniqueStrings([
              ...evaluation.validationReasons,
              "Rejected as an obvious duplicate of a stronger listing candidate.",
            ]),
            scoreBreakdown: {
              ...evaluation.scoreBreakdown,
              uniquenessScore: 0,
              overallScore: computeOverallScore({
                ...evaluation.scoreBreakdown,
                uniquenessScore: 0,
              }),
            },
          }),
        );
        validationWarnings.add("Duplicate source overlap was detected and reduced before ranking.");
        continue;
      }

      const decision = validationDecision(evaluation);
      const listing = toValidatedListing(evaluation, decision.status, {
        duplicateGroupKey: evaluation.duplicateGroupKey,
        rejectionCategory: decision.rejectionCategory,
      });

      if (decision.status === "approved") {
        approvedListings.push(listing);
      } else {
        rejectedListings.push(listing);
      }
    }
  }

  approvedListings.sort((left, right) => right.overallScore - left.overallScore || right.scoreBreakdown.titleMatchScore - left.scoreBreakdown.titleMatchScore);
  approvedListings.forEach((listing, index) => {
    listing.rank = index + 1;
  });

  rejectedListings.sort((left, right) => right.overallScore - left.overallScore);

  const listingRankOrder = approvedListings.map((listing) => listing.id);
  const titleSupportConfidence = summarizeConfidence(approvedListings, rejectedListings, criteria);
  const minimumShortlist = criteria.singlePropertyFocus ? 1 : Math.min(Math.max(criteria.targetListingCount, 3), 5);
  if (approvedListings.length < minimumShortlist) {
    validationWarnings.add(
      "The discovered listings only partly support the current story. Review the rejected listings or refresh the shortlist before moving forward.",
    );
  }
  if (approvedListings.length === 0) {
    validationWarnings.add("No listing is strong enough to approve yet. Rerun property discovery before moving forward.");
  }
  if (rejectedListings.some((listing) => listing.validationStatus === "needs_attention")) {
    validationWarnings.add("Some listings are plausible but still need review before CasaFlix can rely on them.");
  }

  const summary = buildValidationSummary(
    approvedListings,
    rejectedListings,
    criteria,
    Array.from(validationWarnings),
  );

  return {
    approvedListings,
    rejectedListings,
    listingRankOrder,
    listingValidationSummary: {
      ...summary,
      titleSupportConfidence,
    },
    titleSupportConfidence,
    validationWarnings: Array.from(validationWarnings),
  };
}
