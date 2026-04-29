export type CasaHudLocationProvider = "google_places" | "mapbox" | "casahud_location_patterns";

export type CasaHudLocationProviderState = "connected" | "missing_credentials" | "fallback" | "error";

export type CasaHudLocationSourceConfidence = "high" | "medium" | "fallback";

export type CasaHudLocationIntelligenceStatus = "not_started" | "location_intelligence_completed";

export type CasaHudLocationStory = {
  headline: string;
  summary: string;
  narrativeAngles: string[];
  lifestyleAnchors: string[];
  regionHighlights: string[];
  fallbackNotice?: string;
};

export type CasaHudLocalHighlight = {
  id: string;
  title: string;
  description: string;
  locationText: string;
  associatedListingId?: string;
  provider: CasaHudLocationProvider;
  sourceConfidence: CasaHudLocationSourceConfidence;
};

export type CasaHudPoi = {
  id: string;
  name: string;
  category: string;
  locationText: string;
  associatedListingId?: string;
  distanceText?: string;
  relevanceReason: string;
  provider: CasaHudLocationProvider;
  sourceConfidence: CasaHudLocationSourceConfidence;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
};

export type CasaHudPoiBundle = {
  summary: string;
  cards: CasaHudPoi[];
  categories: string[];
  generatedAt: string;
};

export type CasaHudMapSceneIdea = {
  id: string;
  title: string;
  sceneType: "regional_anchor" | "listing_orbit" | "poi_highlight" | "travel_context" | "lifestyle_context";
  description: string;
  associatedListingId?: string;
  locationText: string;
  suggestedVisual: string;
  provider: CasaHudLocationProvider;
  confidence: CasaHudLocationSourceConfidence;
};

export type CasaHudListingLocationInsight = {
  listingId: string;
  summary: string;
  highlights: string[];
  nearbyPois: CasaHudPoi[];
  locationStrengths: string[];
  warnings: string[];
};

export type CasaHudLocationProviderStatus = {
  provider: CasaHudLocationProvider;
  label: string;
  state: CasaHudLocationProviderState;
  configured: boolean;
  used: boolean;
  detail: string;
  warning?: string;
  coverage?: string;
};

export type CasaHudLocationIntelligenceSummary = {
  headline: string;
  providerSummary: string;
  coverageSummary: string;
  warningCount: number;
  generatedAt: string;
  fallbackUsed: boolean;
};

export type CasaHudCampaignFutureLocationState = {
  status: CasaHudLocationIntelligenceStatus;
  storyHeadline?: string;
  generatedAt?: string;
};

export type CasaHudLocationData = {
  locationIntelligenceStatus: CasaHudLocationIntelligenceStatus;
  locationIntelligenceSummary: CasaHudLocationIntelligenceSummary | null;
  locationStory: CasaHudLocationStory | null;
  localHighlights: CasaHudLocalHighlight[];
  poiBundle: CasaHudPoiBundle | null;
  mapSceneIdeas: CasaHudMapSceneIdea[];
  listingLocationInsights: CasaHudListingLocationInsight[];
  locationProviderStatuses: CasaHudLocationProviderStatus[];
  locationWarnings: string[];
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

function isCoordinates(value: unknown): value is { latitude: number; longitude: number } {
  return isRecord(value) && isFiniteNumber(value.latitude) && isFiniteNumber(value.longitude);
}

function isLocationProvider(value: unknown): value is CasaHudLocationProvider {
  return value === "google_places" || value === "mapbox" || value === "casahud_location_patterns";
}

function isLocationProviderState(value: unknown): value is CasaHudLocationProviderState {
  return value === "connected" || value === "missing_credentials" || value === "fallback" || value === "error";
}

function isLocationSourceConfidence(value: unknown): value is CasaHudLocationSourceConfidence {
  return value === "high" || value === "medium" || value === "fallback";
}

function isLocationIntelligenceStatus(value: unknown): value is CasaHudLocationIntelligenceStatus {
  return value === "not_started" || value === "location_intelligence_completed";
}

function isLocationStory(value: unknown): value is CasaHudLocationStory {
  return (
    isRecord(value) &&
    isNonEmptyString(value.headline) &&
    isNonEmptyString(value.summary) &&
    isStringArray(value.narrativeAngles) &&
    isStringArray(value.lifestyleAnchors) &&
    isStringArray(value.regionHighlights) &&
    (value.fallbackNotice === undefined || isNonEmptyString(value.fallbackNotice))
  );
}

function isLocalHighlight(value: unknown): value is CasaHudLocalHighlight {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.title) &&
    isNonEmptyString(value.description) &&
    isNonEmptyString(value.locationText) &&
    isLocationProvider(value.provider) &&
    isLocationSourceConfidence(value.sourceConfidence) &&
    (value.associatedListingId === undefined || isNonEmptyString(value.associatedListingId))
  );
}

function isPoi(value: unknown): value is CasaHudPoi {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.name) &&
    isNonEmptyString(value.category) &&
    isNonEmptyString(value.locationText) &&
    isNonEmptyString(value.relevanceReason) &&
    isLocationProvider(value.provider) &&
    isLocationSourceConfidence(value.sourceConfidence) &&
    (value.associatedListingId === undefined || isNonEmptyString(value.associatedListingId)) &&
    (value.distanceText === undefined || isNonEmptyString(value.distanceText)) &&
    (value.coordinates === undefined || isCoordinates(value.coordinates))
  );
}

function isPoiBundle(value: unknown): value is CasaHudPoiBundle {
  return (
    isRecord(value) &&
    isNonEmptyString(value.summary) &&
    Array.isArray(value.cards) &&
    value.cards.every((item) => isPoi(item)) &&
    isStringArray(value.categories) &&
    isNonEmptyString(value.generatedAt)
  );
}

function isMapSceneIdea(value: unknown): value is CasaHudMapSceneIdea {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.title) &&
    (value.sceneType === "regional_anchor" ||
      value.sceneType === "listing_orbit" ||
      value.sceneType === "poi_highlight" ||
      value.sceneType === "travel_context" ||
      value.sceneType === "lifestyle_context") &&
    isNonEmptyString(value.description) &&
    isNonEmptyString(value.locationText) &&
    isNonEmptyString(value.suggestedVisual) &&
    isLocationProvider(value.provider) &&
    isLocationSourceConfidence(value.confidence) &&
    (value.associatedListingId === undefined || isNonEmptyString(value.associatedListingId))
  );
}

function isListingLocationInsight(value: unknown): value is CasaHudListingLocationInsight {
  return (
    isRecord(value) &&
    isNonEmptyString(value.listingId) &&
    isNonEmptyString(value.summary) &&
    isStringArray(value.highlights) &&
    Array.isArray(value.nearbyPois) &&
    value.nearbyPois.every((item) => isPoi(item)) &&
    isStringArray(value.locationStrengths) &&
    isStringArray(value.warnings)
  );
}

function isLocationProviderStatus(value: unknown): value is CasaHudLocationProviderStatus {
  return (
    isRecord(value) &&
    isLocationProvider(value.provider) &&
    isNonEmptyString(value.label) &&
    isLocationProviderState(value.state) &&
    typeof value.configured === "boolean" &&
    typeof value.used === "boolean" &&
    isNonEmptyString(value.detail) &&
    (value.warning === undefined || isNonEmptyString(value.warning)) &&
    (value.coverage === undefined || isNonEmptyString(value.coverage))
  );
}

function isLocationIntelligenceSummary(value: unknown): value is CasaHudLocationIntelligenceSummary {
  return (
    isRecord(value) &&
    isNonEmptyString(value.headline) &&
    isNonEmptyString(value.providerSummary) &&
    isNonEmptyString(value.coverageSummary) &&
    isFiniteNumber(value.warningCount) &&
    isNonEmptyString(value.generatedAt) &&
    typeof value.fallbackUsed === "boolean"
  );
}

export function createEmptyCasaHudLocationData(): CasaHudLocationData {
  return {
    locationIntelligenceStatus: "not_started",
    locationIntelligenceSummary: null,
    locationStory: null,
    localHighlights: [],
    poiBundle: null,
    mapSceneIdeas: [],
    listingLocationInsights: [],
    locationProviderStatuses: [],
    locationWarnings: [],
  };
}

export function buildCasaHudFutureLocationState(
  data: Pick<CasaHudLocationData, "locationIntelligenceStatus" | "locationIntelligenceSummary" | "locationStory">,
): CasaHudCampaignFutureLocationState | null {
  if (data.locationIntelligenceStatus !== "location_intelligence_completed") return null;
  return {
    status: data.locationIntelligenceStatus,
    storyHeadline: data.locationStory?.headline,
    generatedAt: data.locationIntelligenceSummary?.generatedAt,
  };
}

export function parseCasaHudLocationData(campaign: Record<string, unknown>): CasaHudLocationData {
  const locationIntelligenceSummary = isLocationIntelligenceSummary(campaign.locationIntelligenceSummary)
    ? campaign.locationIntelligenceSummary
    : null;
  const locationStory = isLocationStory(campaign.locationStory) ? campaign.locationStory : null;
  const localHighlights = Array.isArray(campaign.localHighlights)
    ? campaign.localHighlights.filter((item): item is CasaHudLocalHighlight => isLocalHighlight(item))
    : [];
  const poiBundle = isPoiBundle(campaign.poiBundle) ? campaign.poiBundle : null;
  const mapSceneIdeas = Array.isArray(campaign.mapSceneIdeas)
    ? campaign.mapSceneIdeas.filter((item): item is CasaHudMapSceneIdea => isMapSceneIdea(item))
    : [];
  const listingLocationInsights = Array.isArray(campaign.listingLocationInsights)
    ? campaign.listingLocationInsights.filter((item): item is CasaHudListingLocationInsight => isListingLocationInsight(item))
    : [];
  const locationProviderStatuses = Array.isArray(campaign.locationProviderStatuses)
    ? campaign.locationProviderStatuses.filter((item): item is CasaHudLocationProviderStatus => isLocationProviderStatus(item))
    : [];
  const locationWarnings = isStringArray(campaign.locationWarnings) ? campaign.locationWarnings : [];

  const locationIntelligenceStatus = isLocationIntelligenceStatus(campaign.locationIntelligenceStatus)
    ? campaign.locationIntelligenceStatus
    : locationIntelligenceSummary ||
        locationStory ||
        localHighlights.length > 0 ||
        poiBundle !== null ||
        mapSceneIdeas.length > 0 ||
        listingLocationInsights.length > 0
      ? "location_intelligence_completed"
      : "not_started";

  return {
    locationIntelligenceStatus,
    locationIntelligenceSummary,
    locationStory,
    localHighlights,
    poiBundle,
    mapSceneIdeas,
    listingLocationInsights,
    locationProviderStatuses,
    locationWarnings,
  };
}
