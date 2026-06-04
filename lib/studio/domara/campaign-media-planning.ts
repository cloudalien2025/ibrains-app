export type CasaHudMediaPlanningStatus = "not_started" | "media_plan_built";

export type CasaHudVisualAssetType =
  | "listing_image"
  | "map_visual"
  | "poi_visual"
  | "location_context"
  | "fallback_placeholder";

export type CasaHudVisualAssetAvailabilityStatus = "available" | "planned" | "placeholder" | "missing";
export type CasaHudVisualAssetUsageRightsStatus = "unknown" | "listing_source" | "planning_only";
export type CasaHudSceneCoverageStatus = "strong" | "partial" | "missing";

export type CasaHudMediaProvider = "listing_source_media" | "location_visual_plan" | "casahud_visual_placeholders";
export type CasaHudMediaProviderState = "connected" | "fallback" | "error";

export type CasaHudVisualAsset = {
  id: string;
  type: CasaHudVisualAssetType;
  title: string;
  sourceProvider: string;
  sourceUrl?: string;
  listingId?: string;
  poiId?: string;
  mapSceneId?: string;
  description: string;
  usageRightsStatus: CasaHudVisualAssetUsageRightsStatus;
  confidence: number;
  availabilityStatus: CasaHudVisualAssetAvailabilityStatus;
  warning?: string;
};

export type CasaHudSceneAssetMapping = {
  sceneId: string;
  segmentId: string;
  sceneTitle: string;
  narrationExcerpt: string;
  assignedAssetIds: string[];
  recommendedAssetType: CasaHudVisualAssetType;
  visualPurpose: string;
  coverageStatus: CasaHudSceneCoverageStatus;
  warnings: string[];
};

export type CasaHudShotListItem = {
  id: string;
  order: number;
  title: string;
  description: string;
  associatedListingId?: string;
  associatedSceneId: string;
  recommendedVisualType: CasaHudVisualAssetType;
  assetIds: string[];
  notes: string[];
};

export type CasaHudListingImageCoverage = {
  listingId: string;
  listingTitle: string;
  availableImageCount: number;
  assetIds: string[];
  coverageStatus: CasaHudSceneCoverageStatus;
  coverageSummary: string;
  warning?: string;
};

export type CasaHudMapLocationVisualPlanItem = {
  id: string;
  title: string;
  visualType: "map_scene" | "poi_context" | "location_anchor";
  description: string;
  associatedListingId?: string;
  associatedPoiId?: string;
  associatedMapSceneId?: string;
  suggestedUse: string;
  provider: string;
  confidence: "high" | "medium" | "fallback";
  assetId?: string;
};

export type CasaHudThumbnailCandidateInput = {
  id: string;
  title: string;
  rationale: string;
  associatedAssetIds: string[];
  listingId?: string;
  textOverlayIdea: string;
  compositionNotes: string;
  warnings: string[];
};

export type CasaHudMediaProviderStatus = {
  provider: CasaHudMediaProvider;
  label: string;
  state: CasaHudMediaProviderState;
  configured: boolean;
  used: boolean;
  detail: string;
  warning?: string;
};

export type CasaHudMediaPlanData = {
  mediaPlanningStatus: CasaHudMediaPlanningStatus;
  mediaPlanSummary: string | null;
  visualAssets: CasaHudVisualAsset[];
  sceneAssetMapping: CasaHudSceneAssetMapping[];
  shotList: CasaHudShotListItem[];
  listingImageCoverage: CasaHudListingImageCoverage[];
  mapLocationVisualPlan: CasaHudMapLocationVisualPlanItem[];
  thumbnailCandidateInputs: CasaHudThumbnailCandidateInput[];
  missingMediaWarnings: string[];
  mediaProviderStatuses: CasaHudMediaProviderStatus[];
};

export type CasaHudCampaignFutureMediaPlanState = {
  status: CasaHudMediaPlanningStatus;
  summary?: string;
  generatedAt?: string;
  assetCount?: number;
};

export type CasaHudCampaignFutureStoryboardState = {
  status: CasaHudMediaPlanningStatus;
  generatedAt?: string;
  sceneCount?: number;
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

function isMediaPlanningStatus(value: unknown): value is CasaHudMediaPlanningStatus {
  return value === "not_started" || value === "media_plan_built";
}

function isVisualAssetType(value: unknown): value is CasaHudVisualAssetType {
  return (
    value === "listing_image" ||
    value === "map_visual" ||
    value === "poi_visual" ||
    value === "location_context" ||
    value === "fallback_placeholder"
  );
}

function isAvailabilityStatus(value: unknown): value is CasaHudVisualAssetAvailabilityStatus {
  return value === "available" || value === "planned" || value === "placeholder" || value === "missing";
}

function isUsageRightsStatus(value: unknown): value is CasaHudVisualAssetUsageRightsStatus {
  return value === "unknown" || value === "listing_source" || value === "planning_only";
}

function isSceneCoverageStatus(value: unknown): value is CasaHudSceneCoverageStatus {
  return value === "strong" || value === "partial" || value === "missing";
}

function isMediaProvider(value: unknown): value is CasaHudMediaProvider {
  return value === "listing_source_media" || value === "location_visual_plan" || value === "casahud_visual_placeholders";
}

function isMediaProviderState(value: unknown): value is CasaHudMediaProviderState {
  return value === "connected" || value === "fallback" || value === "error";
}

function isVisualAsset(value: unknown): value is CasaHudVisualAsset {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isVisualAssetType(value.type) &&
    isNonEmptyString(value.title) &&
    isNonEmptyString(value.sourceProvider) &&
    isNonEmptyString(value.description) &&
    isUsageRightsStatus(value.usageRightsStatus) &&
    isFiniteNumber(value.confidence) &&
    isAvailabilityStatus(value.availabilityStatus) &&
    (value.sourceUrl === undefined || isNonEmptyString(value.sourceUrl)) &&
    (value.listingId === undefined || isNonEmptyString(value.listingId)) &&
    (value.poiId === undefined || isNonEmptyString(value.poiId)) &&
    (value.mapSceneId === undefined || isNonEmptyString(value.mapSceneId)) &&
    (value.warning === undefined || isNonEmptyString(value.warning))
  );
}

function isSceneAssetMapping(value: unknown): value is CasaHudSceneAssetMapping {
  return (
    isRecord(value) &&
    isNonEmptyString(value.sceneId) &&
    isNonEmptyString(value.segmentId) &&
    isNonEmptyString(value.sceneTitle) &&
    isNonEmptyString(value.narrationExcerpt) &&
    isStringArray(value.assignedAssetIds) &&
    isVisualAssetType(value.recommendedAssetType) &&
    isNonEmptyString(value.visualPurpose) &&
    isSceneCoverageStatus(value.coverageStatus) &&
    isStringArray(value.warnings)
  );
}

function isShotListItem(value: unknown): value is CasaHudShotListItem {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isFiniteNumber(value.order) &&
    isNonEmptyString(value.title) &&
    isNonEmptyString(value.description) &&
    isNonEmptyString(value.associatedSceneId) &&
    isVisualAssetType(value.recommendedVisualType) &&
    isStringArray(value.assetIds) &&
    isStringArray(value.notes) &&
    (value.associatedListingId === undefined || isNonEmptyString(value.associatedListingId))
  );
}

function isListingImageCoverage(value: unknown): value is CasaHudListingImageCoverage {
  return (
    isRecord(value) &&
    isNonEmptyString(value.listingId) &&
    isNonEmptyString(value.listingTitle) &&
    isFiniteNumber(value.availableImageCount) &&
    isStringArray(value.assetIds) &&
    isSceneCoverageStatus(value.coverageStatus) &&
    isNonEmptyString(value.coverageSummary) &&
    (value.warning === undefined || isNonEmptyString(value.warning))
  );
}

function isMapLocationVisualPlanItem(value: unknown): value is CasaHudMapLocationVisualPlanItem {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.title) &&
    (value.visualType === "map_scene" || value.visualType === "poi_context" || value.visualType === "location_anchor") &&
    isNonEmptyString(value.description) &&
    isNonEmptyString(value.suggestedUse) &&
    isNonEmptyString(value.provider) &&
    (value.confidence === "high" || value.confidence === "medium" || value.confidence === "fallback") &&
    (value.associatedListingId === undefined || isNonEmptyString(value.associatedListingId)) &&
    (value.associatedPoiId === undefined || isNonEmptyString(value.associatedPoiId)) &&
    (value.associatedMapSceneId === undefined || isNonEmptyString(value.associatedMapSceneId)) &&
    (value.assetId === undefined || isNonEmptyString(value.assetId))
  );
}

function isThumbnailCandidateInput(value: unknown): value is CasaHudThumbnailCandidateInput {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.title) &&
    isNonEmptyString(value.rationale) &&
    isStringArray(value.associatedAssetIds) &&
    isNonEmptyString(value.textOverlayIdea) &&
    isNonEmptyString(value.compositionNotes) &&
    isStringArray(value.warnings) &&
    (value.listingId === undefined || isNonEmptyString(value.listingId))
  );
}

function isMediaProviderStatus(value: unknown): value is CasaHudMediaProviderStatus {
  return (
    isRecord(value) &&
    isMediaProvider(value.provider) &&
    isNonEmptyString(value.label) &&
    isMediaProviderState(value.state) &&
    typeof value.configured === "boolean" &&
    typeof value.used === "boolean" &&
    isNonEmptyString(value.detail) &&
    (value.warning === undefined || isNonEmptyString(value.warning))
  );
}

export function createEmptyCasaHudMediaPlanData(): CasaHudMediaPlanData {
  return {
    mediaPlanningStatus: "not_started",
    mediaPlanSummary: null,
    visualAssets: [],
    sceneAssetMapping: [],
    shotList: [],
    listingImageCoverage: [],
    mapLocationVisualPlan: [],
    thumbnailCandidateInputs: [],
    missingMediaWarnings: [],
    mediaProviderStatuses: [],
  };
}

export function buildCasaHudFutureMediaPlanState(
  data: Pick<CasaHudMediaPlanData, "mediaPlanningStatus" | "mediaPlanSummary" | "visualAssets">,
): CasaHudCampaignFutureMediaPlanState | null {
  if (data.mediaPlanningStatus !== "media_plan_built") return null;
  return {
    status: data.mediaPlanningStatus,
    summary: data.mediaPlanSummary || undefined,
    assetCount: data.visualAssets.length,
  };
}

export function buildCasaHudFutureStoryboardState(
  data: Pick<CasaHudMediaPlanData, "mediaPlanningStatus" | "sceneAssetMapping">,
): CasaHudCampaignFutureStoryboardState | null {
  if (data.mediaPlanningStatus !== "media_plan_built") return null;
  return {
    status: data.mediaPlanningStatus,
    sceneCount: data.sceneAssetMapping.length,
  };
}

export function parseCasaHudMediaPlanData(campaign: Record<string, unknown>): CasaHudMediaPlanData {
  const mediaPlanSummary = isNonEmptyString(campaign.mediaPlanSummary) ? campaign.mediaPlanSummary : null;
  const visualAssets = Array.isArray(campaign.visualAssets)
    ? campaign.visualAssets.filter((item): item is CasaHudVisualAsset => isVisualAsset(item))
    : [];
  const sceneAssetMapping = Array.isArray(campaign.sceneAssetMapping)
    ? campaign.sceneAssetMapping.filter((item): item is CasaHudSceneAssetMapping => isSceneAssetMapping(item))
    : [];
  const shotList = Array.isArray(campaign.shotList)
    ? campaign.shotList.filter((item): item is CasaHudShotListItem => isShotListItem(item))
    : [];
  const listingImageCoverage = Array.isArray(campaign.listingImageCoverage)
    ? campaign.listingImageCoverage.filter((item): item is CasaHudListingImageCoverage => isListingImageCoverage(item))
    : [];
  const mapLocationVisualPlan = Array.isArray(campaign.mapLocationVisualPlan)
    ? campaign.mapLocationVisualPlan.filter((item): item is CasaHudMapLocationVisualPlanItem => isMapLocationVisualPlanItem(item))
    : [];
  const thumbnailCandidateInputs = Array.isArray(campaign.thumbnailCandidateInputs)
    ? campaign.thumbnailCandidateInputs.filter((item): item is CasaHudThumbnailCandidateInput => isThumbnailCandidateInput(item))
    : [];
  const missingMediaWarnings = isStringArray(campaign.missingMediaWarnings) ? campaign.missingMediaWarnings : [];
  const mediaProviderStatuses = Array.isArray(campaign.mediaProviderStatuses)
    ? campaign.mediaProviderStatuses.filter((item): item is CasaHudMediaProviderStatus => isMediaProviderStatus(item))
    : [];

  const mediaPlanningStatus = isMediaPlanningStatus(campaign.mediaPlanningStatus)
    ? campaign.mediaPlanningStatus
    : mediaPlanSummary ||
        visualAssets.length > 0 ||
        sceneAssetMapping.length > 0 ||
        shotList.length > 0 ||
        listingImageCoverage.length > 0 ||
        mapLocationVisualPlan.length > 0 ||
        thumbnailCandidateInputs.length > 0
      ? "media_plan_built"
      : "not_started";

  return {
    mediaPlanningStatus,
    mediaPlanSummary,
    visualAssets,
    sceneAssetMapping,
    shotList,
    listingImageCoverage,
    mapLocationVisualPlan,
    thumbnailCandidateInputs,
    missingMediaWarnings,
    mediaProviderStatuses,
  };
}
