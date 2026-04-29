import { nowIso, stableCasaHudId } from "@/lib/studio/domara/ai-channel-engine/ids";
import type { CasaHudProject } from "@/lib/studio/domara/ai-channel-engine/types";
import {
  buildCasaHudFutureLocationState,
  createEmptyCasaHudLocationData,
  parseCasaHudLocationData,
  type CasaHudCampaignFutureLocationState,
  type CasaHudListingLocationInsight,
  type CasaHudLocalHighlight,
  type CasaHudLocationData,
  type CasaHudLocationIntelligenceStatus,
  type CasaHudLocationIntelligenceSummary,
  type CasaHudLocationProviderStatus,
  type CasaHudLocationStory,
  type CasaHudMapSceneIdea,
  type CasaHudPoiBundle,
} from "@/lib/studio/domara/campaign-location-intelligence";
import {
  buildCasaHudFutureScriptState,
  createEmptyCasaHudScriptData,
  parseCasaHudScriptData,
  type CasaHudCampaignFutureScriptState,
  type CasaHudPropertySegment,
  type CasaHudScriptData,
  type CasaHudScriptGenerationStatus,
  type CasaHudScriptProviderStatus,
  type CasaHudScriptSegment,
} from "@/lib/studio/domara/campaign-script-narrative";
import type {
  CasaHudOpportunityCampaignType,
  CasaHudOpportunityProviderStatus,
  CasaHudOpportunityResearchBrief,
  CasaHudOpportunityResult,
  CasaHudOpportunitySelectedTitle,
  CasaHudOpportunityTitleCandidate,
} from "@/lib/studio/domara/opportunity-engine/types";

export const CASAHUD_CAMPAIGN_METADATA_PHASE = "phase_7_script_narrative" as const;
export const CASAHUD_CAMPAIGN_PHASE_6_METADATA_PHASE = "phase_6_location_intelligence" as const;
export const CASAHUD_CAMPAIGN_PHASE_5_METADATA_PHASE = "phase_5_listing_validation" as const;
export const CASAHUD_CAMPAIGN_PHASE_4_METADATA_PHASE = "phase_4_listing_discovery" as const;
export const CASAHUD_CAMPAIGN_LEGACY_METADATA_PHASE = "phase_3_campaign_persistence" as const;
const CASAHUD_CAMPAIGN_METADATA_VERSION = 5 as const;

export type CasaHudCampaignStatus =
  | "opportunity_generated"
  | "campaign_created"
  | "ready_for_property_discovery"
  | "listing_candidates_discovered"
  | "listing_candidates_validated"
  | "location_intelligence_completed"
  | "script_narrative_completed";

export type CasaHudListingDiscoveryStatus = "not_started" | "listing_candidates_discovered";
export type CasaHudListingValidationStatus = "not_started" | "listing_candidates_validated";
export type CasaHudCampaignLocationIntelligenceStatus = CasaHudLocationIntelligenceStatus;
export type CasaHudCampaignScriptGenerationStatus = CasaHudScriptGenerationStatus;

export type CasaHudListingProvider = "idealista" | "immobiliare" | "casahud_sample";

export type CasaHudListingSearchCriteria = {
  operation: "sale";
  campaignType: CasaHudOpportunityCampaignType;
  titlePromise: string;
  regionHint?: string;
  country?: string;
  cities: string[];
  propertyTypes: string[];
  featureTags: string[];
  lifestyleTags: string[];
  searchTerms: string[];
  pricePositioning: "affordable" | "mainstream" | "premium" | "luxury";
  targetListingCount: number;
  singlePropertyFocus: boolean;
  maxPrice?: number;
  currency?: string;
};

export type CasaHudListingCandidate = {
  id: string;
  provider: CasaHudListingProvider;
  providerListingId?: string;
  sourceUrl?: string;
  title: string;
  locationText: string;
  country?: string;
  region?: string;
  city?: string;
  price?: number;
  currency?: string;
  propertyType?: string;
  bedrooms?: number;
  bathrooms?: number;
  sizeSqm?: number;
  descriptionSnippet?: string;
  features: string[];
  imageUrls: string[];
  imageCount: number;
  photoAvailability: "available" | "limited" | "none";
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  rawProviderMetadata?: Record<string, string | number | boolean | null>;
  discoveredAt: string;
  preliminaryMatchNotes: string;
};

export type CasaHudListingProviderStatus = {
  provider: CasaHudListingProvider;
  label: string;
  state: "connected" | "missing_credentials" | "fallback" | "error";
  configured: boolean;
  used: boolean;
  candidateCount: number;
  detail: string;
  warning?: string;
};

export type CasaHudListingDiscoverySummary = {
  headline: string;
  criteriaSummary: string;
  providerSummary: string;
  candidateCount: number;
  liveCandidateCount: number;
  fallbackCandidateCount: number;
  fallbackUsed: boolean;
  warnings: string[];
  discoveredAt: string;
};

export type CasaHudCampaignPropertyDiscoveryNextPhase = {
  key: "property_discovery";
  label: "Find matching properties";
  detail: "Property Discovery comes next. CasaHUD will translate the saved title promise into real candidate listings without regenerating the title package.";
  implemented: false;
};

export type CasaHudCampaignListingValidationNextPhase = {
  key: "listing_validation";
  label: "Validate and rank listings";
  detail: "Validation and ranking arrive next. CasaHUD will confirm which discovered candidates truly support the title promise.";
  implemented: false;
};

export type CasaHudCampaignLocationIntelligenceNextPhase = {
  key: "location_intelligence";
  label: "Location Intelligence";
  detail: "Location Intelligence comes next. CasaHUD will explain why the strongest validated properties work through area and map context.";
  implemented: false;
};

export type CasaHudCampaignScriptNarrativeGenerationNextPhase = {
  key: "script_narrative_generation";
  label: "Script and Narrative Generation";
  detail: "Script and Narrative Generation comes next. CasaHUD will turn the validated property story and location intelligence into the video narrative package.";
  implemented: false;
};

export type CasaHudCampaignMediaPlanningNextPhase = {
  key: "media_planning_asset_assembly";
  label: "Media Planning and Asset Assembly";
  detail: "Media Planning and Asset Assembly comes next. CasaHUD will organize visuals, map scenes, and asset needs around the approved narrative package.";
  implemented: false;
};

export type CasaHudCampaignNextPhase =
  | CasaHudCampaignPropertyDiscoveryNextPhase
  | CasaHudCampaignListingValidationNextPhase
  | CasaHudCampaignLocationIntelligenceNextPhase
  | CasaHudCampaignScriptNarrativeGenerationNextPhase
  | CasaHudCampaignMediaPlanningNextPhase;

export type CasaHudValidatedListingStatus = "approved" | "rejected" | "needs_attention";

export type CasaHudListingValidationScoreBreakdown = {
  titleMatchScore: number;
  geographyScore: number;
  priceFitScore: number;
  propertyTypeScore: number;
  featureClaimScore: number;
  mediaAvailabilityScore: number;
  listingCompletenessScore: number;
  providerQualityScore: number;
  uniquenessScore: number;
  overallScore: number;
};

export type CasaHudValidatedListing = CasaHudListingCandidate & {
  validationStatus: CasaHudValidatedListingStatus;
  overallScore: number;
  scoreBreakdown: CasaHudListingValidationScoreBreakdown;
  validationReasons: string[];
  warnings: string[];
  rank?: number;
  duplicateOfListingId?: string;
  duplicateGroupKey?: string;
  duplicateReferenceIds?: string[];
  rejectionCategory?: "duplicate" | "price_mismatch" | "geography_mismatch" | "property_type_mismatch" | "weak_support" | "incomplete";
};

export type CasaHudListingValidationSummary = {
  headline: string;
  rankingExplanation: string;
  discoveredCount: number;
  approvedCount: number;
  rejectedCount: number;
  needsAttentionCount: number;
  titleSupportConfidence: number;
  warnings: string[];
  completedAt: string;
};

export type CasaHudCampaignFutureState = {
  listingCandidates?: unknown[];
  approvedListings: unknown[];
  rejectedListings: unknown[];
  listingRankOrder: string[];
  locationIntelligence: CasaHudCampaignFutureLocationState | null;
  mapPoiBundle: CasaHudPoiBundle | null;
  script: CasaHudCampaignFutureScriptState | null;
  storyboard: null;
  mediaPlan: null;
  packaging: null;
  renderStatus: null;
  reviewStatus: null;
  publishStatus: null;
  scheduleStatus: null;
};

export type CasaHudCampaign = {
  id: string;
  name: string;
  selectedViralTitle: string;
  selectedTitle: CasaHudOpportunitySelectedTitle;
  titleCandidates: CasaHudOpportunityTitleCandidate[];
  researchBrief: CasaHudOpportunityResearchBrief;
  campaignType: CasaHudOpportunityCampaignType;
  marketRegionHint?: string;
  preferredMarket?: string;
  generationSource: CasaHudOpportunityProviderStatus;
  confidenceReasoning: {
    summary: string;
    titleOpportunitySummary: string;
    selectedTitleReasoning: string;
    selectedTitleConfidence: number;
  };
  status: CasaHudCampaignStatus;
  listingCandidates: CasaHudListingCandidate[];
  listingSearchCriteria: CasaHudListingSearchCriteria | null;
  listingProviderStatuses: CasaHudListingProviderStatus[];
  discoverySummary: CasaHudListingDiscoverySummary | null;
  listingDiscoveryStatus: CasaHudListingDiscoveryStatus;
  approvedListings: CasaHudValidatedListing[];
  rejectedListings: CasaHudValidatedListing[];
  listingRankOrder: string[];
  listingValidationStatus: CasaHudListingValidationStatus;
  listingValidationSummary: CasaHudListingValidationSummary | null;
  titleSupportConfidence: number | null;
  validationWarnings: string[];
  locationIntelligenceStatus: CasaHudCampaignLocationIntelligenceStatus;
  locationIntelligenceSummary: CasaHudLocationIntelligenceSummary | null;
  locationStory: CasaHudLocationStory | null;
  localHighlights: CasaHudLocalHighlight[];
  poiBundle: CasaHudPoiBundle | null;
  mapSceneIdeas: CasaHudMapSceneIdea[];
  listingLocationInsights: CasaHudListingLocationInsight[];
  locationProviderStatuses: CasaHudLocationProviderStatus[];
  locationWarnings: string[];
  scriptGenerationStatus: CasaHudCampaignScriptGenerationStatus;
  scriptSummary: string | null;
  openingHook: string | null;
  estimatedDurationSeconds: number | null;
  tone: string | null;
  scriptSegments: CasaHudScriptSegment[];
  propertySegments: CasaHudPropertySegment[];
  locationLifestyleLines: string[];
  transitions: string[];
  closingCta: string | null;
  toneAndPacingNotes: string[];
  scriptWarnings: string[];
  scriptProviderStatus: CasaHudScriptProviderStatus | null;
  fullScriptText: string | null;
  nextPhase: CasaHudCampaignNextPhase;
  createdAt: string;
  updatedAt: string;
  generatedAt: string;
  futureState: CasaHudCampaignFutureState;
};

export type CasaHudCampaignSummary = {
  id: string;
  name: string;
  campaignType: CasaHudOpportunityCampaignType;
  marketRegionHint?: string;
  status: CasaHudCampaignStatus;
  createdAt: string;
  updatedAt: string;
  researchSummary: string;
  listingCandidateCount: number;
  listingDiscoveryStatus: CasaHudListingDiscoveryStatus;
  approvedListingCount: number;
  listingValidationStatus: CasaHudListingValidationStatus;
  titleSupportConfidence?: number;
  locationIntelligenceStatus: CasaHudCampaignLocationIntelligenceStatus;
  scriptGenerationStatus: CasaHudCampaignScriptGenerationStatus;
  discoverySummary?: string;
  validationSummary?: string;
  locationSummary?: string;
  scriptSummary?: string;
};

export type CasaHudCampaignMetadata = {
  schemaVersion: number;
  phase:
    | typeof CASAHUD_CAMPAIGN_METADATA_PHASE
    | typeof CASAHUD_CAMPAIGN_PHASE_6_METADATA_PHASE
    | typeof CASAHUD_CAMPAIGN_PHASE_5_METADATA_PHASE
    | typeof CASAHUD_CAMPAIGN_PHASE_4_METADATA_PHASE
    | typeof CASAHUD_CAMPAIGN_LEGACY_METADATA_PHASE;
  source: "opportunity_result";
  campaign: CasaHudCampaign;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isOpportunityCampaignType(value: unknown): value is CasaHudOpportunityCampaignType {
  return (
    value === "roundup" ||
    value === "single_property_showcase" ||
    value === "niche_category" ||
    value === "location_led" ||
    value === "lifestyle_relocation"
  );
}

function isSelectedTitle(value: unknown): value is CasaHudOpportunitySelectedTitle {
  return (
    isRecord(value) &&
    isNonEmptyString(value.title) &&
    typeof value.score === "number" &&
    typeof value.confidence === "number" &&
    isNonEmptyString(value.reasoning) &&
    isOpportunityCampaignType(value.campaignType)
  );
}

function isTitleCandidate(value: unknown): value is CasaHudOpportunityTitleCandidate {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.title) &&
    typeof value.score === "number" &&
    isNonEmptyString(value.reasoning) &&
    isOpportunityCampaignType(value.campaignType)
  );
}

function isResearchBrief(value: unknown): value is CasaHudOpportunityResearchBrief {
  return (
    isRecord(value) &&
    isNonEmptyString(value.summary) &&
    isStringArray(value.opportunityCategories) &&
    isStringArray(value.competitorPatterns) &&
    isStringArray(value.audienceIntent) &&
    isStringArray(value.suggestedTitleDirections) &&
    isStringArray(value.riskNotes)
  );
}

function isProviderStatus(value: unknown): value is CasaHudOpportunityProviderStatus {
  return (
    isRecord(value) &&
    (value.mode === "live_youtube" || value.mode === "casahud_patterns") &&
    isNonEmptyString(value.label) &&
    isNonEmptyString(value.detail) &&
    typeof value.canImproveWithYouTube === "boolean"
  );
}

function isCampaignStatus(value: unknown): value is CasaHudCampaignStatus {
  return (
    value === "opportunity_generated" ||
    value === "campaign_created" ||
    value === "ready_for_property_discovery" ||
    value === "listing_candidates_discovered" ||
    value === "listing_candidates_validated" ||
    value === "location_intelligence_completed" ||
    value === "script_narrative_completed"
  );
}

function isListingDiscoveryStatus(value: unknown): value is CasaHudListingDiscoveryStatus {
  return value === "not_started" || value === "listing_candidates_discovered";
}

function isListingValidationStatus(value: unknown): value is CasaHudListingValidationStatus {
  return value === "not_started" || value === "listing_candidates_validated";
}

function isListingProvider(value: unknown): value is CasaHudListingProvider {
  return value === "idealista" || value === "immobiliare" || value === "casahud_sample";
}

function isListingSearchCriteria(value: unknown): value is CasaHudListingSearchCriteria {
  return (
    isRecord(value) &&
    value.operation === "sale" &&
    isOpportunityCampaignType(value.campaignType) &&
    isNonEmptyString(value.titlePromise) &&
    isStringArray(value.cities) &&
    isStringArray(value.propertyTypes) &&
    isStringArray(value.featureTags) &&
    isStringArray(value.lifestyleTags) &&
    isStringArray(value.searchTerms) &&
    (value.pricePositioning === "affordable" ||
      value.pricePositioning === "mainstream" ||
      value.pricePositioning === "premium" ||
      value.pricePositioning === "luxury") &&
    typeof value.singlePropertyFocus === "boolean" &&
    isFiniteNumber(value.targetListingCount) &&
    (value.regionHint === undefined || isNonEmptyString(value.regionHint)) &&
    (value.country === undefined || isNonEmptyString(value.country)) &&
    (value.maxPrice === undefined || isFiniteNumber(value.maxPrice)) &&
    (value.currency === undefined || isNonEmptyString(value.currency))
  );
}

function isCoordinates(value: unknown): value is { latitude: number; longitude: number } {
  return isRecord(value) && isFiniteNumber(value.latitude) && isFiniteNumber(value.longitude);
}

function isListingCandidate(value: unknown): value is CasaHudListingCandidate {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isListingProvider(value.provider) &&
    isNonEmptyString(value.title) &&
    isNonEmptyString(value.locationText) &&
    Array.isArray(value.features) &&
    value.features.every((feature) => typeof feature === "string") &&
    Array.isArray(value.imageUrls) &&
    value.imageUrls.every((url) => typeof url === "string") &&
    isFiniteNumber(value.imageCount) &&
    (value.photoAvailability === "available" || value.photoAvailability === "limited" || value.photoAvailability === "none") &&
    isNonEmptyString(value.discoveredAt) &&
    isNonEmptyString(value.preliminaryMatchNotes) &&
    (value.providerListingId === undefined || isNonEmptyString(value.providerListingId)) &&
    (value.sourceUrl === undefined || isNonEmptyString(value.sourceUrl)) &&
    (value.country === undefined || isNonEmptyString(value.country)) &&
    (value.region === undefined || isNonEmptyString(value.region)) &&
    (value.city === undefined || isNonEmptyString(value.city)) &&
    (value.price === undefined || isFiniteNumber(value.price)) &&
    (value.currency === undefined || isNonEmptyString(value.currency)) &&
    (value.propertyType === undefined || isNonEmptyString(value.propertyType)) &&
    (value.bedrooms === undefined || isFiniteNumber(value.bedrooms)) &&
    (value.bathrooms === undefined || isFiniteNumber(value.bathrooms)) &&
    (value.sizeSqm === undefined || isFiniteNumber(value.sizeSqm)) &&
    (value.descriptionSnippet === undefined || isNonEmptyString(value.descriptionSnippet)) &&
    (value.coordinates === undefined || isCoordinates(value.coordinates)) &&
    (value.rawProviderMetadata === undefined || isRecord(value.rawProviderMetadata))
  );
}

function isListingProviderStatus(value: unknown): value is CasaHudListingProviderStatus {
  return (
    isRecord(value) &&
    isListingProvider(value.provider) &&
    isNonEmptyString(value.label) &&
    (value.state === "connected" ||
      value.state === "missing_credentials" ||
      value.state === "fallback" ||
      value.state === "error") &&
    typeof value.configured === "boolean" &&
    typeof value.used === "boolean" &&
    isFiniteNumber(value.candidateCount) &&
    isNonEmptyString(value.detail) &&
    (value.warning === undefined || isNonEmptyString(value.warning))
  );
}

function isListingDiscoverySummary(value: unknown): value is CasaHudListingDiscoverySummary {
  return (
    isRecord(value) &&
    isNonEmptyString(value.headline) &&
    isNonEmptyString(value.criteriaSummary) &&
    isNonEmptyString(value.providerSummary) &&
    isFiniteNumber(value.candidateCount) &&
    isFiniteNumber(value.liveCandidateCount) &&
    isFiniteNumber(value.fallbackCandidateCount) &&
    typeof value.fallbackUsed === "boolean" &&
    isStringArray(value.warnings) &&
    isNonEmptyString(value.discoveredAt)
  );
}

function isListingValidationScoreBreakdown(value: unknown): value is CasaHudListingValidationScoreBreakdown {
  return (
    isRecord(value) &&
    isFiniteNumber(value.titleMatchScore) &&
    isFiniteNumber(value.geographyScore) &&
    isFiniteNumber(value.priceFitScore) &&
    isFiniteNumber(value.propertyTypeScore) &&
    isFiniteNumber(value.featureClaimScore) &&
    isFiniteNumber(value.mediaAvailabilityScore) &&
    isFiniteNumber(value.listingCompletenessScore) &&
    isFiniteNumber(value.providerQualityScore) &&
    isFiniteNumber(value.uniquenessScore) &&
    isFiniteNumber(value.overallScore)
  );
}

function isValidatedListingStatus(value: unknown): value is CasaHudValidatedListingStatus {
  return value === "approved" || value === "rejected" || value === "needs_attention";
}

function isValidatedListing(value: unknown): value is CasaHudValidatedListing {
  if (!isRecord(value) || !isListingCandidate(value)) return false;

  const candidate = value as Record<string, unknown>;
  return (
    isValidatedListingStatus(candidate.validationStatus) &&
    isFiniteNumber(candidate.overallScore) &&
    isListingValidationScoreBreakdown(candidate.scoreBreakdown) &&
    isStringArray(candidate.validationReasons) &&
    isStringArray(candidate.warnings) &&
    (candidate.rank === undefined || isFiniteNumber(candidate.rank)) &&
    (candidate.duplicateOfListingId === undefined || isNonEmptyString(candidate.duplicateOfListingId)) &&
    (candidate.duplicateGroupKey === undefined || isNonEmptyString(candidate.duplicateGroupKey)) &&
    (candidate.duplicateReferenceIds === undefined || isStringArray(candidate.duplicateReferenceIds)) &&
    (candidate.rejectionCategory === undefined ||
      candidate.rejectionCategory === "duplicate" ||
      candidate.rejectionCategory === "price_mismatch" ||
      candidate.rejectionCategory === "geography_mismatch" ||
      candidate.rejectionCategory === "property_type_mismatch" ||
      candidate.rejectionCategory === "weak_support" ||
      candidate.rejectionCategory === "incomplete")
  );
}

function isListingValidationSummary(value: unknown): value is CasaHudListingValidationSummary {
  return (
    isRecord(value) &&
    isNonEmptyString(value.headline) &&
    isNonEmptyString(value.rankingExplanation) &&
    isFiniteNumber(value.discoveredCount) &&
    isFiniteNumber(value.approvedCount) &&
    isFiniteNumber(value.rejectedCount) &&
    isFiniteNumber(value.needsAttentionCount) &&
    isFiniteNumber(value.titleSupportConfidence) &&
    isStringArray(value.warnings) &&
    isNonEmptyString(value.completedAt)
  );
}

function isCampaignNextPhase(value: unknown): value is CasaHudCampaignNextPhase {
  return (
    isRecord(value) &&
    value.implemented === false &&
    ((value.key === "property_discovery" &&
      value.label === "Find matching properties" &&
      isNonEmptyString(value.detail)) ||
      (value.key === "listing_validation" &&
        value.label === "Validate and rank listings" &&
        isNonEmptyString(value.detail)) ||
      (value.key === "location_intelligence" &&
        value.label === "Location Intelligence" &&
        isNonEmptyString(value.detail)) ||
      (value.key === "script_narrative_generation" &&
        value.label === "Script and Narrative Generation" &&
        isNonEmptyString(value.detail)) ||
      (value.key === "media_planning_asset_assembly" &&
        value.label === "Media Planning and Asset Assembly" &&
        isNonEmptyString(value.detail)))
  );
}

export function parseCasaHudCampaignCreateBody(
  body: unknown,
): { ok: true; opportunity: CasaHudOpportunityResult } | { ok: false; message: string } {
  if (!isRecord(body) || !isRecord(body.opportunity)) {
    return {
      ok: false,
      message: "CasaHUD needs the Phase 2 opportunity result before it can create a campaign.",
    };
  }

  const opportunity = body.opportunity;
  if (!isSelectedTitle(opportunity.selectedTitle)) {
    return {
      ok: false,
      message: "CasaHUD could not save this campaign because the selected viral title is missing.",
    };
  }
  if (!Array.isArray(opportunity.titleCandidates) || opportunity.titleCandidates.length === 0) {
    return {
      ok: false,
      message: "CasaHUD could not save this campaign because title candidates are missing.",
    };
  }
  if (!opportunity.titleCandidates.every((candidate) => isTitleCandidate(candidate))) {
    return {
      ok: false,
      message: "CasaHUD could not save this campaign because one or more title candidates are invalid.",
    };
  }
  if (!isResearchBrief(opportunity.researchBrief)) {
    return {
      ok: false,
      message: "CasaHUD could not save this campaign because the research brief is incomplete.",
    };
  }
  if (!isOpportunityCampaignType(opportunity.campaignTypePrediction)) {
    return {
      ok: false,
      message: "CasaHUD could not save this campaign because the campaign type is invalid.",
    };
  }
  if (!isProviderStatus(opportunity.providerStatus)) {
    return {
      ok: false,
      message: "CasaHUD could not save this campaign because the generation source is invalid.",
    };
  }
  if (!isNonEmptyString(opportunity.confidenceSummary) || !isNonEmptyString(opportunity.titleOpportunitySummary)) {
    return {
      ok: false,
      message: "CasaHUD could not save this campaign because the confidence summary is missing.",
    };
  }

  return {
    ok: true,
    opportunity: opportunity as CasaHudOpportunityResult,
  };
}

export function toCasaHudProjectVideoType(type: CasaHudOpportunityCampaignType): CasaHudProject["videoType"] {
  switch (type) {
    case "roundup":
      return "roundup";
    case "single_property_showcase":
      return "single_property";
    case "niche_category":
      return "niche";
    case "location_led":
      return "location_category";
    case "lifestyle_relocation":
      return "lifestyle_relocation";
  }
}

function createFutureState(): CasaHudCampaignFutureState {
  return {
    listingCandidates: [],
    approvedListings: [],
    rejectedListings: [],
    listingRankOrder: [],
    locationIntelligence: null,
    mapPoiBundle: null,
    script: null,
    storyboard: null,
    mediaPlan: null,
    packaging: null,
    renderStatus: null,
    reviewStatus: null,
    publishStatus: null,
    scheduleStatus: null,
  };
}

export function createPropertyDiscoveryNextPhase(): CasaHudCampaignPropertyDiscoveryNextPhase {
  return {
    key: "property_discovery",
    label: "Find matching properties",
    detail:
      "Property Discovery comes next. CasaHUD will translate the saved title promise into real candidate listings without regenerating the title package.",
    implemented: false,
  };
}

export function createListingValidationNextPhase(): CasaHudCampaignListingValidationNextPhase {
  return {
    key: "listing_validation",
    label: "Validate and rank listings",
    detail:
      "Validation and ranking arrive next. CasaHUD will confirm which discovered candidates truly support the title promise.",
    implemented: false,
  };
}

export function createLocationIntelligenceNextPhase(): CasaHudCampaignLocationIntelligenceNextPhase {
  return {
    key: "location_intelligence",
    label: "Location Intelligence",
    detail:
      "Location Intelligence comes next. CasaHUD will explain why the strongest validated properties work through area and map context.",
    implemented: false,
  };
}

export function createScriptNarrativeGenerationNextPhase(): CasaHudCampaignScriptNarrativeGenerationNextPhase {
  return {
    key: "script_narrative_generation",
    label: "Script and Narrative Generation",
    detail:
      "Script and Narrative Generation comes next. CasaHUD will turn the validated property story and location intelligence into the video narrative package.",
    implemented: false,
  };
}

export function createMediaPlanningAssetAssemblyNextPhase(): CasaHudCampaignMediaPlanningNextPhase {
  return {
    key: "media_planning_asset_assembly",
    label: "Media Planning and Asset Assembly",
    detail:
      "Media Planning and Asset Assembly comes next. CasaHUD will organize visuals, map scenes, and asset needs around the approved narrative package.",
    implemented: false,
  };
}

export function buildCasaHudCampaignFromOpportunity(userId: string, opportunity: CasaHudOpportunityResult): CasaHudCampaign {
  const timestamp = nowIso();
  const nonce = Math.random().toString(36).slice(2, 10);
  const selectedViralTitle = opportunity.selectedTitle.title.trim();
  const marketRegionHint = opportunity.selectedTitle.regionHint?.trim() || opportunity.preferredMarket?.trim() || undefined;
  const emptyLocationData = createEmptyCasaHudLocationData();
  const emptyScriptData = createEmptyCasaHudScriptData();

  return {
    id: stableCasaHudId("casahud-project", `${userId}:${selectedViralTitle}:${timestamp}:${nonce}`),
    name: selectedViralTitle,
    selectedViralTitle,
    selectedTitle: opportunity.selectedTitle,
    titleCandidates: opportunity.titleCandidates,
    researchBrief: opportunity.researchBrief,
    campaignType: opportunity.campaignTypePrediction,
    marketRegionHint,
    preferredMarket: opportunity.preferredMarket?.trim() || undefined,
    generationSource: opportunity.providerStatus,
    confidenceReasoning: {
      summary: opportunity.confidenceSummary,
      titleOpportunitySummary: opportunity.titleOpportunitySummary,
      selectedTitleReasoning: opportunity.selectedTitle.reasoning,
      selectedTitleConfidence: opportunity.selectedTitle.confidence,
    },
    status: "campaign_created",
    listingCandidates: [],
    listingSearchCriteria: null,
    listingProviderStatuses: [],
    discoverySummary: null,
    listingDiscoveryStatus: "not_started",
    approvedListings: [],
    rejectedListings: [],
    listingRankOrder: [],
    listingValidationStatus: "not_started",
    listingValidationSummary: null,
    titleSupportConfidence: null,
    validationWarnings: [],
    ...emptyLocationData,
    ...emptyScriptData,
    nextPhase: createPropertyDiscoveryNextPhase(),
    createdAt: timestamp,
    updatedAt: timestamp,
    generatedAt: opportunity.generatedAt,
    futureState: createFutureState(),
  };
}

export function applyCasaHudListingDiscovery(
  campaign: CasaHudCampaign,
  discovery: {
    listingCandidates: CasaHudListingCandidate[];
    listingSearchCriteria: CasaHudListingSearchCriteria;
    listingProviderStatuses: CasaHudListingProviderStatus[];
    discoverySummary: CasaHudListingDiscoverySummary;
  },
): CasaHudCampaign {
  const updatedAt = discovery.discoverySummary.discoveredAt || nowIso();
  const emptyLocationData = createEmptyCasaHudLocationData();
  const emptyScriptData = createEmptyCasaHudScriptData();

  return {
    ...campaign,
    status: "listing_candidates_discovered",
    listingCandidates: discovery.listingCandidates,
    listingSearchCriteria: discovery.listingSearchCriteria,
    listingProviderStatuses: discovery.listingProviderStatuses,
    discoverySummary: discovery.discoverySummary,
    listingDiscoveryStatus: "listing_candidates_discovered",
    approvedListings: [],
    rejectedListings: [],
    listingRankOrder: [],
    listingValidationStatus: "not_started",
    listingValidationSummary: null,
    titleSupportConfidence: null,
    validationWarnings: [],
    ...emptyLocationData,
    ...emptyScriptData,
    nextPhase: createListingValidationNextPhase(),
    updatedAt,
    futureState: {
      ...campaign.futureState,
      listingCandidates: discovery.listingCandidates,
      approvedListings: [],
      rejectedListings: [],
      listingRankOrder: [],
      locationIntelligence: null,
      mapPoiBundle: null,
      script: null,
    },
  };
}

export function applyCasaHudListingValidation(
  campaign: CasaHudCampaign,
  validation: {
    approvedListings: CasaHudValidatedListing[];
    rejectedListings: CasaHudValidatedListing[];
    listingRankOrder: string[];
    listingValidationSummary: CasaHudListingValidationSummary;
    titleSupportConfidence: number;
    validationWarnings: string[];
  },
): CasaHudCampaign {
  const updatedAt = validation.listingValidationSummary.completedAt || nowIso();
  const emptyLocationData = createEmptyCasaHudLocationData();
  const emptyScriptData = createEmptyCasaHudScriptData();

  return {
    ...campaign,
    status: "listing_candidates_validated",
    approvedListings: validation.approvedListings,
    rejectedListings: validation.rejectedListings,
    listingRankOrder: validation.listingRankOrder,
    listingValidationStatus: "listing_candidates_validated",
    listingValidationSummary: validation.listingValidationSummary,
    titleSupportConfidence: validation.titleSupportConfidence,
    validationWarnings: validation.validationWarnings,
    ...emptyLocationData,
    ...emptyScriptData,
    nextPhase: createLocationIntelligenceNextPhase(),
    updatedAt,
    futureState: {
      ...campaign.futureState,
      approvedListings: validation.approvedListings,
      rejectedListings: validation.rejectedListings,
      listingRankOrder: validation.listingRankOrder,
      locationIntelligence: null,
      mapPoiBundle: null,
      script: null,
    },
  };
}

export function applyCasaHudLocationIntelligence(
  campaign: CasaHudCampaign,
  intelligence: CasaHudLocationData,
): CasaHudCampaign {
  const updatedAt = intelligence.locationIntelligenceSummary?.generatedAt || nowIso();
  const emptyScriptData = createEmptyCasaHudScriptData();

  return {
    ...campaign,
    status: "location_intelligence_completed",
    ...intelligence,
    ...emptyScriptData,
    nextPhase: createScriptNarrativeGenerationNextPhase(),
    updatedAt,
    futureState: {
      ...campaign.futureState,
      locationIntelligence: buildCasaHudFutureLocationState(intelligence),
      mapPoiBundle: intelligence.poiBundle,
      script: null,
    },
  };
}

export function applyCasaHudScriptNarrative(
  campaign: CasaHudCampaign,
  script: CasaHudScriptData,
): CasaHudCampaign {
  const updatedAt = nowIso();

  return {
    ...campaign,
    status: "script_narrative_completed",
    ...script,
    nextPhase: createMediaPlanningAssetAssemblyNextPhase(),
    updatedAt,
    futureState: {
      ...campaign.futureState,
      script: buildCasaHudFutureScriptState(script),
    },
  };
}

export function toCasaHudCampaignSummary(campaign: CasaHudCampaign): CasaHudCampaignSummary {
  return {
    id: campaign.id,
    name: campaign.name,
    campaignType: campaign.campaignType,
    marketRegionHint: campaign.marketRegionHint,
    status: campaign.status,
    createdAt: campaign.createdAt,
    updatedAt: campaign.updatedAt,
    researchSummary: campaign.researchBrief.summary,
    listingCandidateCount: campaign.listingCandidates.length,
    listingDiscoveryStatus: campaign.listingDiscoveryStatus,
    approvedListingCount: campaign.approvedListings.length,
    listingValidationStatus: campaign.listingValidationStatus,
    titleSupportConfidence: campaign.titleSupportConfidence ?? undefined,
    locationIntelligenceStatus: campaign.locationIntelligenceStatus,
    scriptGenerationStatus: campaign.scriptGenerationStatus,
    discoverySummary: campaign.discoverySummary?.headline,
    validationSummary: campaign.listingValidationSummary?.headline,
    locationSummary: campaign.locationIntelligenceSummary?.headline,
    scriptSummary: campaign.scriptSummary ?? undefined,
  };
}

export function toCasaHudCampaignMetadata(campaign: CasaHudCampaign): CasaHudCampaignMetadata {
  return {
    schemaVersion: CASAHUD_CAMPAIGN_METADATA_VERSION,
    phase: CASAHUD_CAMPAIGN_METADATA_PHASE,
    source: "opportunity_result",
    campaign,
  };
}

export function parseCasaHudCampaignMetadata(value: unknown): CasaHudCampaignMetadata | null {
  if (!isRecord(value)) return null;
  if (
    value.phase !== CASAHUD_CAMPAIGN_METADATA_PHASE &&
    value.phase !== CASAHUD_CAMPAIGN_PHASE_6_METADATA_PHASE &&
    value.phase !== CASAHUD_CAMPAIGN_PHASE_5_METADATA_PHASE &&
    value.phase !== CASAHUD_CAMPAIGN_PHASE_4_METADATA_PHASE &&
    value.phase !== CASAHUD_CAMPAIGN_LEGACY_METADATA_PHASE
  ) {
    return null;
  }
  if (!isFiniteNumber(value.schemaVersion) || value.schemaVersion < 1) return null;
  if (value.source !== "opportunity_result") return null;

  const campaign = value.campaign;
  if (
    !isRecord(campaign) ||
    !isNonEmptyString(campaign.id) ||
    !isNonEmptyString(campaign.name) ||
    !isNonEmptyString(campaign.selectedViralTitle) ||
    !isSelectedTitle(campaign.selectedTitle) ||
    !Array.isArray(campaign.titleCandidates) ||
    !campaign.titleCandidates.every((candidate) => isTitleCandidate(candidate)) ||
    !isResearchBrief(campaign.researchBrief) ||
    !isOpportunityCampaignType(campaign.campaignType) ||
    !isProviderStatus(campaign.generationSource) ||
    !isRecord(campaign.confidenceReasoning) ||
    !isNonEmptyString(campaign.confidenceReasoning.summary) ||
    !isNonEmptyString(campaign.confidenceReasoning.titleOpportunitySummary) ||
    !isNonEmptyString(campaign.confidenceReasoning.selectedTitleReasoning) ||
    !isFiniteNumber(campaign.confidenceReasoning.selectedTitleConfidence) ||
    !isCampaignStatus(campaign.status) ||
    !isNonEmptyString(campaign.createdAt) ||
    !isNonEmptyString(campaign.updatedAt) ||
    !isNonEmptyString(campaign.generatedAt)
  ) {
    return null;
  }

  const futureState = isRecord(campaign.futureState) ? campaign.futureState : {};
  const legacyListingCandidates = Array.isArray(futureState.listingCandidates)
    ? futureState.listingCandidates.filter((item): item is CasaHudListingCandidate => isListingCandidate(item))
    : [];
  const listingCandidates = Array.isArray(campaign.listingCandidates)
    ? campaign.listingCandidates.filter((item): item is CasaHudListingCandidate => isListingCandidate(item))
    : legacyListingCandidates;
  const listingSearchCriteria = isListingSearchCriteria(campaign.listingSearchCriteria)
    ? campaign.listingSearchCriteria
    : null;
  const listingProviderStatuses = Array.isArray(campaign.listingProviderStatuses)
    ? campaign.listingProviderStatuses.filter((item): item is CasaHudListingProviderStatus => isListingProviderStatus(item))
    : [];
  const discoverySummary = isListingDiscoverySummary(campaign.discoverySummary) ? campaign.discoverySummary : null;
  const listingDiscoveryStatus = isListingDiscoveryStatus(campaign.listingDiscoveryStatus)
    ? campaign.listingDiscoveryStatus
    : listingCandidates.length > 0
      ? "listing_candidates_discovered"
      : "not_started";
  const approvedListings = Array.isArray(campaign.approvedListings)
    ? campaign.approvedListings.filter((item): item is CasaHudValidatedListing => isValidatedListing(item))
    : Array.isArray(futureState.approvedListings)
      ? futureState.approvedListings.filter((item): item is CasaHudValidatedListing => isValidatedListing(item))
      : [];
  const rejectedListings = Array.isArray(campaign.rejectedListings)
    ? campaign.rejectedListings.filter((item): item is CasaHudValidatedListing => isValidatedListing(item))
    : Array.isArray(futureState.rejectedListings)
      ? futureState.rejectedListings.filter((item): item is CasaHudValidatedListing => isValidatedListing(item))
      : [];
  const listingRankOrder = isStringArray(campaign.listingRankOrder)
    ? campaign.listingRankOrder
    : isStringArray(futureState.listingRankOrder)
      ? futureState.listingRankOrder
      : [];
  const listingValidationSummary = isListingValidationSummary(campaign.listingValidationSummary)
    ? campaign.listingValidationSummary
    : null;
  const listingValidationStatus = isListingValidationStatus(campaign.listingValidationStatus)
    ? campaign.listingValidationStatus
    : approvedListings.length > 0 || rejectedListings.length > 0 || listingValidationSummary !== null
      ? "listing_candidates_validated"
      : "not_started";
  const titleSupportConfidence = isFiniteNumber(campaign.titleSupportConfidence)
    ? campaign.titleSupportConfidence
    : isFiniteNumber(listingValidationSummary?.titleSupportConfidence)
      ? listingValidationSummary.titleSupportConfidence
      : null;
  const validationWarnings = isStringArray(campaign.validationWarnings)
    ? campaign.validationWarnings
    : listingValidationSummary?.warnings ?? [];
  const locationData = parseCasaHudLocationData(campaign);
  const scriptData = parseCasaHudScriptData(campaign);

  const normalizedCampaign: CasaHudCampaign = {
    id: campaign.id,
    name: campaign.name,
    selectedViralTitle: campaign.selectedViralTitle,
    selectedTitle: campaign.selectedTitle,
    titleCandidates: campaign.titleCandidates,
    researchBrief: campaign.researchBrief,
    campaignType: campaign.campaignType,
    marketRegionHint: isNonEmptyString(campaign.marketRegionHint) ? campaign.marketRegionHint : undefined,
    preferredMarket: isNonEmptyString(campaign.preferredMarket) ? campaign.preferredMarket : undefined,
    generationSource: campaign.generationSource,
    confidenceReasoning: {
      summary: campaign.confidenceReasoning.summary,
      titleOpportunitySummary: campaign.confidenceReasoning.titleOpportunitySummary,
      selectedTitleReasoning: campaign.confidenceReasoning.selectedTitleReasoning,
      selectedTitleConfidence: campaign.confidenceReasoning.selectedTitleConfidence,
    },
    status:
      listingDiscoveryStatus === "listing_candidates_discovered"
        ? "listing_candidates_discovered"
        : campaign.status,
    listingCandidates,
    listingSearchCriteria,
    listingProviderStatuses,
    discoverySummary,
    listingDiscoveryStatus,
    approvedListings,
    rejectedListings,
    listingRankOrder,
    listingValidationStatus,
    listingValidationSummary,
    titleSupportConfidence,
    validationWarnings,
    ...locationData,
    ...scriptData,
    nextPhase:
      scriptData.scriptGenerationStatus === "script_generated"
        ? createMediaPlanningAssetAssemblyNextPhase()
        : locationData.locationIntelligenceStatus === "location_intelligence_completed"
        ? createScriptNarrativeGenerationNextPhase()
        : listingValidationStatus === "listing_candidates_validated"
        ? createLocationIntelligenceNextPhase()
        : listingDiscoveryStatus === "listing_candidates_discovered"
          ? createListingValidationNextPhase()
          : isCampaignNextPhase(campaign.nextPhase)
            ? campaign.nextPhase
            : createPropertyDiscoveryNextPhase(),
    createdAt: campaign.createdAt,
    updatedAt: campaign.updatedAt,
    generatedAt: campaign.generatedAt,
    futureState: {
      listingCandidates,
      approvedListings,
      rejectedListings,
      listingRankOrder,
      locationIntelligence: buildCasaHudFutureLocationState(locationData),
      mapPoiBundle: locationData.poiBundle,
      script: buildCasaHudFutureScriptState(scriptData),
      storyboard: null,
      mediaPlan: null,
      packaging: null,
      renderStatus: null,
      reviewStatus: null,
      publishStatus: null,
      scheduleStatus: null,
    },
  };

  if (listingValidationStatus === "listing_candidates_validated") {
    normalizedCampaign.status = "listing_candidates_validated";
  } else if (listingDiscoveryStatus === "listing_candidates_discovered") {
    normalizedCampaign.status = "listing_candidates_discovered";
  }
  if (locationData.locationIntelligenceStatus === "location_intelligence_completed") {
    normalizedCampaign.status = "location_intelligence_completed";
  }
  if (scriptData.scriptGenerationStatus === "script_generated") {
    normalizedCampaign.status = "script_narrative_completed";
  }

  return {
    schemaVersion: value.schemaVersion,
    phase: value.phase,
    source: "opportunity_result",
    campaign: normalizedCampaign,
  };
}

export function isCasaHudCampaignMetadata(value: unknown): value is CasaHudCampaignMetadata {
  return parseCasaHudCampaignMetadata(value) !== null;
}
