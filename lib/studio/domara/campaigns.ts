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
  buildCasaHudFutureMediaPlanState,
  buildCasaHudFutureStoryboardState,
  createEmptyCasaHudMediaPlanData,
  parseCasaHudMediaPlanData,
  type CasaHudCampaignFutureMediaPlanState,
  type CasaHudCampaignFutureStoryboardState,
  type CasaHudListingImageCoverage,
  type CasaHudMapLocationVisualPlanItem,
  type CasaHudMediaPlanData,
  type CasaHudMediaPlanningStatus,
  type CasaHudMediaProviderStatus,
  type CasaHudSceneAssetMapping,
  type CasaHudShotListItem,
  type CasaHudThumbnailCandidateInput,
  type CasaHudVisualAsset,
} from "@/lib/studio/domara/campaign-media-planning";
import {
  buildCasaHudFuturePackagingState,
  createEmptyCasaHudYouTubePackageData,
  parseCasaHudYouTubePackageData,
  type CasaHudCampaignFuturePackagingState,
  type CasaHudPackageProviderStatus,
  type CasaHudPreviewPackage,
  type CasaHudPublishMetadataDraft,
  type CasaHudRenderPlan,
  type CasaHudRenderPlanStatus,
  type CasaHudReviewFinding,
  type CasaHudReviewStatus,
  type CasaHudThumbnailConcept,
  type CasaHudYouTubeChapter,
  type CasaHudYouTubePackageData,
  type CasaHudYouTubePackageStatus,
} from "@/lib/studio/domara/campaign-youtube-package";
import type {
  CasaHudApprovalStatus,
  CasaHudExecutionData,
  CasaHudExecutionRun,
  CasaHudExecutionProviderStatus,
  CasaHudPublishStatus,
  CasaHudRenderOutput,
  CasaHudRenderStatus,
  CasaHudScheduleStatus,
} from "@/lib/studio/domara/campaign-execution";
import {
  createEmptyCasaHudExecutionData,
  parseCasaHudExecutionData,
} from "@/lib/studio/domara/campaign-execution";
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

export const CASAHUD_CAMPAIGN_METADATA_PHASE = "phase_9_youtube_package_review" as const;
export const CASAHUD_CAMPAIGN_PHASE_8_METADATA_PHASE = "phase_8_media_planning" as const;
export const CASAHUD_CAMPAIGN_PHASE_7_METADATA_PHASE = "phase_7_script_narrative" as const;
export const CASAHUD_CAMPAIGN_PHASE_6_METADATA_PHASE = "phase_6_location_intelligence" as const;
export const CASAHUD_CAMPAIGN_PHASE_5_METADATA_PHASE = "phase_5_listing_validation" as const;
export const CASAHUD_CAMPAIGN_PHASE_4_METADATA_PHASE = "phase_4_listing_discovery" as const;
export const CASAHUD_CAMPAIGN_LEGACY_METADATA_PHASE = "phase_3_campaign_persistence" as const;
const CASAHUD_CAMPAIGN_METADATA_VERSION = 8 as const;

export type CasaHudCampaignStatus =
  | "opportunity_generated"
  | "campaign_created"
  | "ready_for_property_discovery"
  | "listing_candidates_discovered"
  | "listing_candidates_validated"
  | "location_intelligence_completed"
  | "script_narrative_completed"
  | "media_planning_completed"
  | "youtube_package_review_completed"
  | "render_completed"
  | "youtube_scheduled"
  | "youtube_published";

export type CasaHudListingDiscoveryStatus = "not_started" | "listing_candidates_discovered";
export type CasaHudListingValidationStatus = "not_started" | "listing_candidates_validated";
export type CasaHudCampaignLocationIntelligenceStatus = CasaHudLocationIntelligenceStatus;
export type CasaHudCampaignScriptGenerationStatus = CasaHudScriptGenerationStatus;
export type CasaHudCampaignMediaPlanningStatus = CasaHudMediaPlanningStatus;
export type CasaHudCampaignYouTubePackageStatus = CasaHudYouTubePackageStatus;

export type CasaHudListingProvider = "idealista" | "immobiliare" | "casahud_sample" | "generic";
export type CasaHudListingSourceType = "official_api" | "imported_url" | "browser_assisted_import" | "sample_pattern";
export type CasaHudListingExtractionStatus = "extracted" | "partial" | "failed" | "blocked_or_unavailable";
export type CasaHudListingImageStatus = "available" | "missing" | "invalid";
export type CasaHudListingUrlClassification =
  | "listing"
  | "search_results"
  | "provider_page"
  | "unsupported_provider_path"
  | "blocked_or_unavailable"
  | "invalid_or_unsafe";
export type CasaHudListingManualCompletionStatus = "incomplete" | "partially_completed" | "completed";
export type CasaHudListingNeedsReviewField =
  | "price"
  | "location"
  | "property_type"
  | "bedrooms_bathrooms"
  | "size"
  | "rooms"
  | "land_size"
  | "floor"
  | "parking"
  | "condition"
  | "energy"
  | "images"
  | "summary";

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
  sourceType?: CasaHudListingSourceType;
  providerListingId?: string;
  originalSourceUrl?: string;
  normalizedSourceUrl?: string;
  canonicalSourceUrl?: string;
  sourceUrl?: string;
  sourceHost?: string;
  sourceLabel?: string;
  urlClassification?: CasaHudListingUrlClassification;
  importedAt?: string;
  extractionConfidence?: number;
  featuredImageUrl?: string;
  manualFeaturedImageUrl?: string;
  thumbnailUrl?: string;
  sourceThumbnailUrl?: string;
  mediaUrl?: string;
  metadataTitle?: string;
  metadataDescription?: string;
  metadataImageUrl?: string;
  canonicalUrl?: string;
  extractionStatus?: CasaHudListingExtractionStatus;
  extractionProvider?: string;
  extractionFields?: string[];
  extractionWarnings?: string[];
  needsReviewFields?: CasaHudListingNeedsReviewField[];
  manualCompletionStatus?: CasaHudListingManualCompletionStatus;
  manuallyCompletedFields?: string[];
  manualUpdatedAt?: string;
  title: string;
  priceText?: string;
  addressText?: string;
  locationText: string;
  country?: string;
  region?: string;
  city?: string;
  province?: string;
  price?: number;
  currency?: string;
  propertyType?: string;
  contract?: string;
  ownership?: string;
  rooms?: number;
  bedrooms?: number;
  bathrooms?: number;
  kitchen?: string;
  sizeSqm?: number;
  commercialSurfaceSqm?: number;
  landSizeSqm?: number;
  floorCount?: number;
  floorText?: string;
  buildingFloors?: number;
  lift?: boolean;
  garageParking?: string;
  balcony?: boolean;
  terrace?: boolean;
  furnished?: string;
  condition?: string;
  heating?: string;
  airConditioning?: string;
  energyClass?: string;
  energyConsumption?: string;
  pricePerSquareMeter?: number;
  condoFees?: string;
  referenceCode?: string;
  updatedDate?: string;
  photoCount?: number;
  floorPlanCount?: number;
  virtualTour?: boolean;
  advertiser?: string;
  descriptionSnippet?: string;
  manualLifestyleAngle?: string;
  summary?: string;
  keyFeatures?: string[];
  lifestyleHighlights?: string[];
  imageStatus?: CasaHudListingImageStatus;
  casaHudDisplayTitle?: string;
  casaHudShortSummary?: string;
  casaHudNarrationSeed?: string;
  features: string[];
  imageUrls: string[];
  images?: unknown[];
  photos?: unknown[];
  gallery?: unknown[];
  photoUrls?: unknown[];
  photo_urls?: unknown[];
  imageCount: number;
  photoAvailability: "available" | "limited" | "none";
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  rawProviderMetadata?: Record<string, unknown>;
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

export type CasaHudCampaignPackageReviewRenderNextPhase = {
  key: "youtube_package_review_render_plan";
  label: "YouTube Package, Review, and Render Plan";
  detail: "YouTube Package, Review, and Render Plan comes next. CasaHUD will refine the package, check visual and claim coverage, and prepare render planning.";
  implemented: false;
};

export type CasaHudCampaignRenderPublishScheduleNextPhase = {
  key: "render_publish_schedule";
  label: "Render, Publish, and Schedule";
  detail: "Render, Publish, and Schedule comes next. CasaHUD will use the approved review package and render plan in the execution layer without regenerating the strategy package.";
  implemented: false;
};

export type CasaHudCampaignNextPhase =
  | CasaHudCampaignPropertyDiscoveryNextPhase
  | CasaHudCampaignListingValidationNextPhase
  | CasaHudCampaignLocationIntelligenceNextPhase
  | CasaHudCampaignScriptNarrativeGenerationNextPhase
  | CasaHudCampaignMediaPlanningNextPhase
  | CasaHudCampaignPackageReviewRenderNextPhase
  | CasaHudCampaignRenderPublishScheduleNextPhase;

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
  storyboard: CasaHudCampaignFutureStoryboardState | null;
  mediaPlan: CasaHudCampaignFutureMediaPlanState | null;
  packaging: CasaHudCampaignFuturePackagingState | null;
  renderStatus: CasaHudRenderPlanStatus | CasaHudRenderStatus | null;
  reviewStatus: CasaHudReviewStatus | null;
  approvalStatus?: CasaHudApprovalStatus | null;
  publishStatus: CasaHudPublishStatus | null;
  scheduleStatus: CasaHudScheduleStatus | null;
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
  mediaPlanningStatus: CasaHudCampaignMediaPlanningStatus;
  mediaPlanSummary: string | null;
  visualAssets: CasaHudVisualAsset[];
  sceneAssetMapping: CasaHudSceneAssetMapping[];
  shotList: CasaHudShotListItem[];
  listingImageCoverage: CasaHudListingImageCoverage[];
  mapLocationVisualPlan: CasaHudMapLocationVisualPlanItem[];
  thumbnailCandidateInputs: CasaHudThumbnailCandidateInput[];
  missingMediaWarnings: string[];
  mediaProviderStatuses: CasaHudMediaProviderStatus[];
  youtubePackageStatus: CasaHudCampaignYouTubePackageStatus;
  finalTitle: string | null;
  titleRationale: string | null;
  youtubeDescription: string | null;
  youtubeTags: string[];
  youtubeHashtags: string[];
  youtubeChapters: CasaHudYouTubeChapter[];
  thumbnailConcept: CasaHudThumbnailConcept | null;
  publishMetadataDraft: CasaHudPublishMetadataDraft | null;
  packagingSummary: string | null;
  packageWarnings: string[];
  packageProviderStatus: CasaHudPackageProviderStatus | null;
  reviewStatus: CasaHudReviewStatus;
  reviewSummary: string | null;
  reviewFindings: CasaHudReviewFinding[];
  reviewBlockers: string[];
  reviewWarnings: string[];
  recommendedFixes: string[];
  readinessScore: number | null;
  readinessExplanation: string | null;
  renderPlanStatus: CasaHudRenderPlanStatus;
  renderPlan: CasaHudRenderPlan | null;
  previewPackage: CasaHudPreviewPackage | null;
  renderBlockers: string[];
  approvalStatus: CasaHudApprovalStatus;
  approvedAt: string | null;
  approvedBy: string | null;
  renderStatus: CasaHudRenderStatus;
  renderJobId: string | null;
  renderOutput: CasaHudRenderOutput | null;
  renderOutputUrl: string | null;
  renderOutputPath: string | null;
  renderProviderStatus: CasaHudExecutionProviderStatus | null;
  renderWarnings: string[];
  renderErrors: string[];
  renderRunHistory: CasaHudExecutionRun[];
  publishStatus: CasaHudPublishStatus;
  publishedVideoId: string | null;
  publishedVideoUrl: string | null;
  publishProviderStatus: CasaHudExecutionProviderStatus | null;
  publishWarnings: string[];
  publishErrors: string[];
  publishRunHistory: CasaHudExecutionRun[];
  scheduleStatus: CasaHudScheduleStatus;
  scheduledPublishAt: string | null;
  scheduleProviderStatus: CasaHudExecutionProviderStatus | null;
  scheduleWarnings: string[];
  scheduleErrors: string[];
  scheduleRunHistory: CasaHudExecutionRun[];
  executionRunHistory: CasaHudExecutionRun[];
  finalState: CasaHudExecutionData["finalState"];
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
  mediaPlanningStatus: CasaHudCampaignMediaPlanningStatus;
  youtubePackageStatus: CasaHudCampaignYouTubePackageStatus;
  reviewStatus: CasaHudReviewStatus;
  approvalStatus?: CasaHudApprovalStatus;
  renderStatus?: CasaHudRenderStatus;
  publishStatus?: CasaHudPublishStatus;
  scheduleStatus?: CasaHudScheduleStatus;
  discoverySummary?: string;
  validationSummary?: string;
  locationSummary?: string;
  scriptSummary?: string;
  mediaPlanSummary?: string;
  packagingSummary?: string;
};

export type CasaHudCampaignMetadata = {
  schemaVersion: number;
  phase:
    | typeof CASAHUD_CAMPAIGN_METADATA_PHASE
    | typeof CASAHUD_CAMPAIGN_PHASE_8_METADATA_PHASE
    | typeof CASAHUD_CAMPAIGN_PHASE_7_METADATA_PHASE
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
    value === "script_narrative_completed" ||
    value === "media_planning_completed" ||
    value === "youtube_package_review_completed" ||
    value === "render_completed" ||
    value === "youtube_scheduled" ||
    value === "youtube_published"
  );
}

function isListingDiscoveryStatus(value: unknown): value is CasaHudListingDiscoveryStatus {
  return value === "not_started" || value === "listing_candidates_discovered";
}

function isListingValidationStatus(value: unknown): value is CasaHudListingValidationStatus {
  return value === "not_started" || value === "listing_candidates_validated";
}

function isListingProvider(value: unknown): value is CasaHudListingProvider {
  return value === "idealista" || value === "immobiliare" || value === "casahud_sample" || value === "generic";
}

function isListingSourceType(value: unknown): value is CasaHudListingSourceType {
  return value === "official_api" || value === "imported_url" || value === "sample_pattern";
}

function isListingExtractionStatus(value: unknown): value is CasaHudListingExtractionStatus {
  return value === "extracted" || value === "partial" || value === "failed" || value === "blocked_or_unavailable";
}

function isListingImageStatus(value: unknown): value is CasaHudListingImageStatus {
  return value === "available" || value === "missing" || value === "invalid";
}

function isListingUrlClassification(value: unknown): value is CasaHudListingUrlClassification {
  return (
    value === "listing" ||
    value === "search_results" ||
    value === "provider_page" ||
    value === "unsupported_provider_path" ||
    value === "blocked_or_unavailable" ||
    value === "invalid_or_unsafe"
  );
}

function isListingManualCompletionStatus(value: unknown): value is CasaHudListingManualCompletionStatus {
  return value === "incomplete" || value === "partially_completed" || value === "completed";
}

function isListingNeedsReviewField(value: unknown): value is CasaHudListingNeedsReviewField {
  return (
    value === "price" ||
    value === "location" ||
    value === "property_type" ||
    value === "bedrooms_bathrooms" ||
    value === "size" ||
    value === "rooms" ||
    value === "land_size" ||
    value === "floor" ||
    value === "parking" ||
    value === "condition" ||
    value === "energy" ||
    value === "images" ||
    value === "summary"
  );
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
    (value.sourceType === undefined || isListingSourceType(value.sourceType)) &&
    (value.providerListingId === undefined || isNonEmptyString(value.providerListingId)) &&
    (value.originalSourceUrl === undefined || isNonEmptyString(value.originalSourceUrl)) &&
    (value.normalizedSourceUrl === undefined || isNonEmptyString(value.normalizedSourceUrl)) &&
    (value.canonicalSourceUrl === undefined || isNonEmptyString(value.canonicalSourceUrl)) &&
    (value.sourceUrl === undefined || isNonEmptyString(value.sourceUrl)) &&
    (value.sourceHost === undefined || isNonEmptyString(value.sourceHost)) &&
    (value.sourceLabel === undefined || isNonEmptyString(value.sourceLabel)) &&
    (value.urlClassification === undefined || isListingUrlClassification(value.urlClassification)) &&
    (value.importedAt === undefined || isNonEmptyString(value.importedAt)) &&
    (value.extractionConfidence === undefined || isFiniteNumber(value.extractionConfidence)) &&
    (value.featuredImageUrl === undefined || isNonEmptyString(value.featuredImageUrl)) &&
    (value.manualFeaturedImageUrl === undefined || isNonEmptyString(value.manualFeaturedImageUrl)) &&
    (value.thumbnailUrl === undefined || isNonEmptyString(value.thumbnailUrl)) &&
    (value.sourceThumbnailUrl === undefined || isNonEmptyString(value.sourceThumbnailUrl)) &&
    (value.mediaUrl === undefined || isNonEmptyString(value.mediaUrl)) &&
    (value.metadataTitle === undefined || isNonEmptyString(value.metadataTitle)) &&
    (value.metadataDescription === undefined || isNonEmptyString(value.metadataDescription)) &&
    (value.metadataImageUrl === undefined || isNonEmptyString(value.metadataImageUrl)) &&
    (value.canonicalUrl === undefined || isNonEmptyString(value.canonicalUrl)) &&
    (value.extractionStatus === undefined || isListingExtractionStatus(value.extractionStatus)) &&
    (value.extractionProvider === undefined || isNonEmptyString(value.extractionProvider)) &&
    (value.extractionFields === undefined || isStringArray(value.extractionFields)) &&
    (value.extractionWarnings === undefined || isStringArray(value.extractionWarnings)) &&
    (value.needsReviewFields === undefined ||
      (Array.isArray(value.needsReviewFields) && value.needsReviewFields.every((field) => isListingNeedsReviewField(field)))) &&
    (value.manualCompletionStatus === undefined || isListingManualCompletionStatus(value.manualCompletionStatus)) &&
    (value.manuallyCompletedFields === undefined || isStringArray(value.manuallyCompletedFields)) &&
    (value.manualUpdatedAt === undefined || isNonEmptyString(value.manualUpdatedAt)) &&
    (value.priceText === undefined || isNonEmptyString(value.priceText)) &&
    (value.addressText === undefined || isNonEmptyString(value.addressText)) &&
    (value.country === undefined || isNonEmptyString(value.country)) &&
    (value.region === undefined || isNonEmptyString(value.region)) &&
    (value.city === undefined || isNonEmptyString(value.city)) &&
    (value.province === undefined || isNonEmptyString(value.province)) &&
    (value.price === undefined || isFiniteNumber(value.price)) &&
    (value.currency === undefined || isNonEmptyString(value.currency)) &&
    (value.propertyType === undefined || isNonEmptyString(value.propertyType)) &&
    (value.contract === undefined || isNonEmptyString(value.contract)) &&
    (value.ownership === undefined || isNonEmptyString(value.ownership)) &&
    (value.rooms === undefined || isFiniteNumber(value.rooms)) &&
    (value.bedrooms === undefined || isFiniteNumber(value.bedrooms)) &&
    (value.bathrooms === undefined || isFiniteNumber(value.bathrooms)) &&
    (value.kitchen === undefined || isNonEmptyString(value.kitchen)) &&
    (value.sizeSqm === undefined || isFiniteNumber(value.sizeSqm)) &&
    (value.commercialSurfaceSqm === undefined || isFiniteNumber(value.commercialSurfaceSqm)) &&
    (value.landSizeSqm === undefined || isFiniteNumber(value.landSizeSqm)) &&
    (value.floorCount === undefined || isFiniteNumber(value.floorCount)) &&
    (value.floorText === undefined || isNonEmptyString(value.floorText)) &&
    (value.buildingFloors === undefined || isFiniteNumber(value.buildingFloors)) &&
    (value.lift === undefined || typeof value.lift === "boolean") &&
    (value.garageParking === undefined || isNonEmptyString(value.garageParking)) &&
    (value.balcony === undefined || typeof value.balcony === "boolean") &&
    (value.terrace === undefined || typeof value.terrace === "boolean") &&
    (value.furnished === undefined || isNonEmptyString(value.furnished)) &&
    (value.condition === undefined || isNonEmptyString(value.condition)) &&
    (value.heating === undefined || isNonEmptyString(value.heating)) &&
    (value.airConditioning === undefined || isNonEmptyString(value.airConditioning)) &&
    (value.energyClass === undefined || isNonEmptyString(value.energyClass)) &&
    (value.energyConsumption === undefined || isNonEmptyString(value.energyConsumption)) &&
    (value.pricePerSquareMeter === undefined || isFiniteNumber(value.pricePerSquareMeter)) &&
    (value.condoFees === undefined || isNonEmptyString(value.condoFees)) &&
    (value.referenceCode === undefined || isNonEmptyString(value.referenceCode)) &&
    (value.updatedDate === undefined || isNonEmptyString(value.updatedDate)) &&
    (value.photoCount === undefined || isFiniteNumber(value.photoCount)) &&
    (value.floorPlanCount === undefined || isFiniteNumber(value.floorPlanCount)) &&
    (value.virtualTour === undefined || typeof value.virtualTour === "boolean") &&
    (value.advertiser === undefined || isNonEmptyString(value.advertiser)) &&
    (value.descriptionSnippet === undefined || isNonEmptyString(value.descriptionSnippet)) &&
    (value.manualLifestyleAngle === undefined || isNonEmptyString(value.manualLifestyleAngle)) &&
    (value.summary === undefined || isNonEmptyString(value.summary)) &&
    (value.keyFeatures === undefined || isStringArray(value.keyFeatures)) &&
    (value.lifestyleHighlights === undefined || isStringArray(value.lifestyleHighlights)) &&
    (value.imageStatus === undefined || isListingImageStatus(value.imageStatus)) &&
    (value.casaHudDisplayTitle === undefined || isNonEmptyString(value.casaHudDisplayTitle)) &&
    (value.casaHudShortSummary === undefined || isNonEmptyString(value.casaHudShortSummary)) &&
    (value.casaHudNarrationSeed === undefined || isNonEmptyString(value.casaHudNarrationSeed)) &&
    (value.images === undefined || Array.isArray(value.images)) &&
    (value.photos === undefined || Array.isArray(value.photos)) &&
    (value.gallery === undefined || Array.isArray(value.gallery)) &&
    (value.photoUrls === undefined || Array.isArray(value.photoUrls)) &&
    (value.photo_urls === undefined || Array.isArray(value.photo_urls)) &&
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
        isNonEmptyString(value.detail)) ||
      (value.key === "youtube_package_review_render_plan" &&
        value.label === "YouTube Package, Review, and Render Plan" &&
        isNonEmptyString(value.detail)) ||
      (value.key === "render_publish_schedule" &&
        value.label === "Render, Publish, and Schedule" &&
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
    approvalStatus: null,
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

export function createPackageReviewRenderPlanNextPhase(): CasaHudCampaignPackageReviewRenderNextPhase {
  return {
    key: "youtube_package_review_render_plan",
    label: "YouTube Package, Review, and Render Plan",
    detail:
      "YouTube Package, Review, and Render Plan comes next. CasaHUD will refine the package, check visual and claim coverage, and prepare render planning.",
    implemented: false,
  };
}

export function createRenderPublishScheduleNextPhase(): CasaHudCampaignRenderPublishScheduleNextPhase {
  return {
    key: "render_publish_schedule",
    label: "Render, Publish, and Schedule",
    detail:
      "Render, Publish, and Schedule comes next. CasaHUD will use the approved review package and render plan in the execution layer without regenerating the strategy package.",
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
  const emptyMediaPlanData = createEmptyCasaHudMediaPlanData();
  const emptyYouTubePackageData = createEmptyCasaHudYouTubePackageData();
  const emptyExecutionData = createEmptyCasaHudExecutionData();

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
    ...emptyMediaPlanData,
    ...emptyYouTubePackageData,
    ...emptyExecutionData,
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
  const emptyMediaPlanData = createEmptyCasaHudMediaPlanData();
  const emptyYouTubePackageData = createEmptyCasaHudYouTubePackageData();
  const emptyExecutionData = createEmptyCasaHudExecutionData();

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
    ...emptyMediaPlanData,
    ...emptyYouTubePackageData,
    ...emptyExecutionData,
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
      mediaPlan: null,
      storyboard: null,
      packaging: null,
      renderStatus: null,
      reviewStatus: null,
      approvalStatus: null,
      publishStatus: null,
      scheduleStatus: null,
    },
  };
}

export function applyCasaHudImportedListingCandidates(
  campaign: CasaHudCampaign,
  input: {
    listingCandidates: CasaHudListingCandidate[];
    discoveredAt: string;
    warnings: string[];
  },
): CasaHudCampaign {
  const updatedAt = input.discoveredAt || nowIso();
  const emptyLocationData = createEmptyCasaHudLocationData();
  const emptyScriptData = createEmptyCasaHudScriptData();
  const emptyMediaPlanData = createEmptyCasaHudMediaPlanData();
  const emptyYouTubePackageData = createEmptyCasaHudYouTubePackageData();
  const emptyExecutionData = createEmptyCasaHudExecutionData();
  const importedCount = input.listingCandidates.filter(
    (listing) => listing.sourceType === "imported_url" || listing.sourceType === "browser_assisted_import",
  ).length;
  const browserImportedCount = input.listingCandidates.filter((listing) => listing.sourceType === "browser_assisted_import").length;
  const sampleCount = input.listingCandidates.filter((listing) => listing.sourceType === "sample_pattern").length;
  const officialCount = input.listingCandidates.filter((listing) => listing.sourceType === "official_api").length;
  const existingSummary = campaign.discoverySummary;

  return {
    ...campaign,
    status: "listing_candidates_discovered",
    listingCandidates: input.listingCandidates,
    discoverySummary: {
      headline:
        importedCount > 0
          ? `Imported ${importedCount} user-provided propert${importedCount === 1 ? "y" : "ies"} into the shortlist for "${campaign.selectedViralTitle}".`
          : existingSummary?.headline || `Prepared ${input.listingCandidates.length} properties for "${campaign.selectedViralTitle}".`,
      criteriaSummary:
        existingSummary?.criteriaSummary ||
        (browserImportedCount > 0
          ? "Browser-assisted property imports are ready for shortlist review and fact-checking."
          : "User-provided listing URLs are ready for shortlist review and fact-checking."),
      providerSummary:
        importedCount > 0
          ? `User-provided imports stay clearly labeled by source type. Review missing facts before moving them deeper into the story.`
          : existingSummary?.providerSummary || "Shortlist sources are ready for review.",
      candidateCount: input.listingCandidates.length,
      liveCandidateCount: officialCount,
      fallbackCandidateCount: sampleCount,
      fallbackUsed: sampleCount > 0,
      warnings: Array.from(new Set([...(existingSummary?.warnings || []), ...input.warnings])),
      discoveredAt: updatedAt,
    },
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
    ...emptyMediaPlanData,
    ...emptyYouTubePackageData,
    ...emptyExecutionData,
    nextPhase: createListingValidationNextPhase(),
    updatedAt,
    futureState: {
      ...campaign.futureState,
      listingCandidates: input.listingCandidates,
      approvedListings: [],
      rejectedListings: [],
      listingRankOrder: [],
      locationIntelligence: null,
      mapPoiBundle: null,
      script: null,
      mediaPlan: null,
      storyboard: null,
      packaging: null,
      renderStatus: null,
      reviewStatus: null,
      approvalStatus: null,
      publishStatus: null,
      scheduleStatus: null,
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
  const emptyMediaPlanData = createEmptyCasaHudMediaPlanData();
  const emptyYouTubePackageData = createEmptyCasaHudYouTubePackageData();
  const emptyExecutionData = createEmptyCasaHudExecutionData();

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
    ...emptyMediaPlanData,
    ...emptyYouTubePackageData,
    ...emptyExecutionData,
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
      mediaPlan: null,
      storyboard: null,
      packaging: null,
      renderStatus: null,
      reviewStatus: null,
      approvalStatus: null,
      publishStatus: null,
      scheduleStatus: null,
    },
  };
}

export function applyCasaHudLocationIntelligence(
  campaign: CasaHudCampaign,
  intelligence: CasaHudLocationData,
): CasaHudCampaign {
  const updatedAt = intelligence.locationIntelligenceSummary?.generatedAt || nowIso();
  const emptyScriptData = createEmptyCasaHudScriptData();
  const emptyMediaPlanData = createEmptyCasaHudMediaPlanData();
  const emptyYouTubePackageData = createEmptyCasaHudYouTubePackageData();
  const emptyExecutionData = createEmptyCasaHudExecutionData();

  return {
    ...campaign,
    status: "location_intelligence_completed",
    ...intelligence,
    ...emptyScriptData,
    ...emptyMediaPlanData,
    ...emptyYouTubePackageData,
    ...emptyExecutionData,
    nextPhase: createScriptNarrativeGenerationNextPhase(),
    updatedAt,
    futureState: {
      ...campaign.futureState,
      locationIntelligence: buildCasaHudFutureLocationState(intelligence),
      mapPoiBundle: intelligence.poiBundle,
      script: null,
      mediaPlan: null,
      storyboard: null,
      packaging: null,
      renderStatus: null,
      reviewStatus: null,
      approvalStatus: null,
      publishStatus: null,
      scheduleStatus: null,
    },
  };
}

export function applyCasaHudScriptNarrative(
  campaign: CasaHudCampaign,
  script: CasaHudScriptData,
): CasaHudCampaign {
  const updatedAt = nowIso();
  const emptyMediaPlanData = createEmptyCasaHudMediaPlanData();
  const emptyYouTubePackageData = createEmptyCasaHudYouTubePackageData();
  const emptyExecutionData = createEmptyCasaHudExecutionData();

  return {
    ...campaign,
    status: "script_narrative_completed",
    ...script,
    ...emptyMediaPlanData,
    ...emptyYouTubePackageData,
    ...emptyExecutionData,
    nextPhase: createMediaPlanningAssetAssemblyNextPhase(),
    updatedAt,
    futureState: {
      ...campaign.futureState,
      script: buildCasaHudFutureScriptState(script),
      mediaPlan: null,
      storyboard: null,
      packaging: null,
      renderStatus: null,
      reviewStatus: null,
      approvalStatus: null,
      publishStatus: null,
      scheduleStatus: null,
    },
  };
}

export function applyCasaHudMediaPlan(
  campaign: CasaHudCampaign,
  mediaPlan: CasaHudMediaPlanData,
): CasaHudCampaign {
  const updatedAt = nowIso();
  const emptyYouTubePackageData = createEmptyCasaHudYouTubePackageData();
  const emptyExecutionData = createEmptyCasaHudExecutionData();

  return {
    ...campaign,
    status: "media_planning_completed",
    ...mediaPlan,
    ...emptyYouTubePackageData,
    ...emptyExecutionData,
    nextPhase: createPackageReviewRenderPlanNextPhase(),
    updatedAt,
    futureState: {
      ...campaign.futureState,
      mediaPlan: buildCasaHudFutureMediaPlanState(mediaPlan),
      storyboard: buildCasaHudFutureStoryboardState(mediaPlan),
      packaging: null,
      renderStatus: null,
      reviewStatus: null,
      approvalStatus: null,
      publishStatus: null,
      scheduleStatus: null,
    },
  };
}

export function applyCasaHudYouTubePackage(
  campaign: CasaHudCampaign,
  packageData: CasaHudYouTubePackageData,
): CasaHudCampaign {
  const updatedAt = nowIso();
  const emptyExecutionData = createEmptyCasaHudExecutionData();

  return {
    ...campaign,
    status: "youtube_package_review_completed",
    ...packageData,
    ...emptyExecutionData,
    nextPhase: createRenderPublishScheduleNextPhase(),
    updatedAt,
    futureState: {
      ...campaign.futureState,
      packaging: buildCasaHudFuturePackagingState(packageData),
      renderStatus: packageData.renderPlanStatus === "not_started" ? null : packageData.renderPlanStatus,
      reviewStatus: packageData.reviewStatus === "not_started" ? null : packageData.reviewStatus,
      approvalStatus: null,
      publishStatus: null,
      scheduleStatus: null,
    },
  };
}

export function applyCasaHudExecutionUpdate(
  campaign: CasaHudCampaign,
  execution: CasaHudExecutionData,
): CasaHudCampaign {
  const updatedAt = nowIso();
  const nextStatus: CasaHudCampaignStatus =
    execution.publishStatus === "published"
      ? "youtube_published"
      : execution.scheduleStatus === "scheduled"
        ? "youtube_scheduled"
        : execution.renderStatus === "rendered"
          ? "render_completed"
          : execution.finalState === "blocked"
            ? campaign.status
            : "youtube_package_review_completed";

  return {
    ...campaign,
    ...execution,
    status: nextStatus,
    nextPhase: createRenderPublishScheduleNextPhase(),
    updatedAt,
    futureState: {
      ...campaign.futureState,
      renderStatus:
        execution.renderStatus !== "not_started"
          ? execution.renderStatus
          : campaign.renderPlanStatus === "not_started"
            ? null
            : campaign.renderPlanStatus,
      reviewStatus: campaign.reviewStatus === "not_started" ? null : campaign.reviewStatus,
      approvalStatus: execution.approvalStatus === "pending" ? null : execution.approvalStatus,
      publishStatus: execution.publishStatus === "not_ready" ? null : execution.publishStatus,
      scheduleStatus: execution.scheduleStatus === "not_scheduled" ? null : execution.scheduleStatus,
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
    mediaPlanningStatus: campaign.mediaPlanningStatus,
    youtubePackageStatus: campaign.youtubePackageStatus,
    reviewStatus: campaign.reviewStatus,
    approvalStatus: campaign.approvalStatus,
    renderStatus: campaign.renderStatus,
    publishStatus: campaign.publishStatus,
    scheduleStatus: campaign.scheduleStatus,
    discoverySummary: campaign.discoverySummary?.headline,
    validationSummary: campaign.listingValidationSummary?.headline,
    locationSummary: campaign.locationIntelligenceSummary?.headline,
    scriptSummary: campaign.scriptSummary ?? undefined,
    mediaPlanSummary: campaign.mediaPlanSummary ?? undefined,
    packagingSummary: campaign.packagingSummary ?? undefined,
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
    value.phase !== CASAHUD_CAMPAIGN_PHASE_8_METADATA_PHASE &&
    value.phase !== CASAHUD_CAMPAIGN_PHASE_7_METADATA_PHASE &&
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
  const mediaData = parseCasaHudMediaPlanData(campaign);
  const packageData = parseCasaHudYouTubePackageData(campaign);
  const executionData = parseCasaHudExecutionData(campaign);

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
    ...mediaData,
    ...packageData,
    ...executionData,
    nextPhase:
      packageData.youtubePackageStatus === "package_prepared"
        ? createRenderPublishScheduleNextPhase()
        : mediaData.mediaPlanningStatus === "media_plan_built"
        ? createPackageReviewRenderPlanNextPhase()
        : scriptData.scriptGenerationStatus === "script_generated"
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
      storyboard: buildCasaHudFutureStoryboardState(mediaData),
      mediaPlan: buildCasaHudFutureMediaPlanState(mediaData),
      packaging: buildCasaHudFuturePackagingState(packageData),
      renderStatus:
        executionData.renderStatus !== "not_started"
          ? executionData.renderStatus
          : packageData.renderPlanStatus === "not_started"
            ? null
            : packageData.renderPlanStatus,
      reviewStatus: packageData.reviewStatus === "not_started" ? null : packageData.reviewStatus,
      approvalStatus: executionData.approvalStatus === "pending" ? null : executionData.approvalStatus,
      publishStatus: executionData.publishStatus === "not_ready" ? null : executionData.publishStatus,
      scheduleStatus: executionData.scheduleStatus === "not_scheduled" ? null : executionData.scheduleStatus,
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
  if (mediaData.mediaPlanningStatus === "media_plan_built") {
    normalizedCampaign.status = "media_planning_completed";
  }
  if (packageData.youtubePackageStatus === "package_prepared") {
    normalizedCampaign.status = "youtube_package_review_completed";
  }
  if (executionData.renderStatus === "rendered") {
    normalizedCampaign.status = "render_completed";
  }
  if (executionData.scheduleStatus === "scheduled") {
    normalizedCampaign.status = "youtube_scheduled";
  }
  if (executionData.publishStatus === "published") {
    normalizedCampaign.status = "youtube_published";
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
