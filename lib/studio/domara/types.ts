export type DomaraContentAngle = "lifestyle" | "investment" | "second_home" | "hidden_gem" | "deal_spotlight";

export type PropertyListingInput = {
  listingUrl?: string;
  source?: string;
  provider?: "manual" | "import_url" | "idealista" | "immobiliare" | "mock";
  country: string;
  city?: string;
  region?: string;
  neighborhood?: string;
  title: string;
  description?: string;
  price?: string;
  propertyType?: string;
  bedrooms?: number | string;
  bathrooms?: number | string;
  squareMeters?: number | string;
  imageUrls: string[];
  latitude?: number | string;
  longitude?: number | string;
  agency?: string;
  fetchedAt?: string;
  providerMetadata?: Record<string, string | number | boolean | null | undefined>;
  sourceAttribution?: string;
  contentAngle?: DomaraContentAngle;
};

export type NormalizedPropertyListing = {
  id: string;
  title: string;
  market: string;
  locationLabel: string;
  location: {
    country: string;
    city?: string;
    region?: string;
    neighborhood?: string;
  };
  priceLabel: string;
  propertyFacts: string[];
  imageUrls: string[];
  sourceMetadata: {
    listingUrl?: string;
    source?: string;
    provider?: "manual" | "import_url" | "idealista" | "immobiliare" | "mock";
    agency?: string;
    fetchedAt?: string;
    providerMetadata?: Record<string, string | number | boolean | null | undefined>;
    sourceAttribution?: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
  };
};

export type DomaraListingUrlImportProviderHint = "auto" | "idealista" | "immobiliare" | "generic";

export type DomaraListingUrlImportRequest = {
  listingUrl: string;
  providerHint?: DomaraListingUrlImportProviderHint;
  countryHint?: string;
  sourceLabel?: string;
};

export type DomaraListingUrlImportResult = {
  status: "imported" | "partial" | "blocked" | "failed";
  normalizedListingInput: PropertyListingInput | null;
  extracted: {
    title?: string;
    description?: string;
    price?: string;
    location?: string;
    propertyType?: string;
    bedrooms?: number;
    bathrooms?: number;
    squareMeters?: number;
    imageUrls: string[];
    source?: string;
    canonicalUrl?: string;
    agency?: string;
  };
  warnings: string[];
  fallbackMessage?: string;
  extractionSources: Array<"jsonLd" | "openGraph" | "meta" | "visibleImages">;
  fetchedAt: string;
};

export type PropertyVideoScene = {
  order: number;
  title: string;
  visualDirection: string;
  narration: string;
  overlayText: string;
  suggestedMedia: string[];
  durationSeconds: number;
};

export type DomaraLocationEnrichment = {
  status: "placeholder" | "enriched";
  provider: "google_maps_places" | "mock";
  locationLabel: string;
  coordinates?: {
    latitude: number;
    longitude: number;
    confidence: "provided" | "estimated";
  };
  pointsOfInterest: Array<{
    name: string;
    category: string;
    distanceLabel?: string;
    travelTimeLabel?: string;
    source: string;
    confidence: "placeholder" | "high" | "medium";
    notes?: string;
  }>;
  placeholderMessage?: string;
  summary: string;
  poiNotes: string[];
};

export type PropertyVideoPlan = {
  id: string;
  channel: "Expat AI";
  status: "draft_plan_ready";
  listingSummary: string;
  hook: string;
  scenes: PropertyVideoScene[];
  narrationScript: string;
  youtubeTitle: string;
  youtubeDescription: string;
  enrichmentSummary: string;
  locationIntelligence?: Omit<DomaraLocationEnrichment, "summary" | "poiNotes">;
  renderPlaceholder: {
    status: "pending_provider_connection";
    nextStep: string;
    provider: string;
  };
};

export type CampaignSource =
  | "immobiliare"
  | "idealista"
  | "gate_away"
  | "kyero"
  | "agency_site"
  | "csv_manual"
  | "future_api";

export type CampaignStatus = "draft" | "title_selected" | "research_ready" | "discovery_ready" | "shortlisted" | "story_ready";

export type Campaign = {
  id: string;
  name: string;
  markets: string[];
  budgetMin: number;
  budgetMax: number;
  currency: string;
  propertyTypes: string[];
  buyerPersona: string;
  videoAngle: string;
  sources: CampaignSource[];
  status: CampaignStatus;
  createdAt: string;
  updatedAt: string;
};

export type TitleIdea = {
  id: string;
  campaignId: string;
  title: string;
  thumbnailHook: string;
  angle: string;
  targetBuyer: string;
  researchBriefSummary?: string;
  score: number;
  selected: boolean;
};

export type PoiPriority = "beach" | "marina" | "airport" | "restaurants" | "historic_center";

export type ResearchBrief = {
  id: string;
  campaignId: string;
  titleIdeaId: string;
  markets: string[];
  cities: string[];
  priceMax: number;
  propertyTypes: string[];
  poiPriorities: PoiPriority[];
  mustHaveCriteria: string[];
  avoidCriteria: string[];
  buyerPersona: string;
  videoAngle: string;
};

export type ListingCandidateStatus = "new" | "shortlist" | "reject" | "saved" | "needs_review";

export type DiscoverySourceType =
  | "immobiliare"
  | "idealista"
  | "gateaway"
  | "kyero"
  | "agency_site"
  | "csv_manual"
  | "api_provider"
  | "other";

export type DiscoverySourceStatus = "draft" | "ready" | "checked" | "needs_review" | "paused" | "error";

export type DiscoverySource = {
  id: string;
  campaignId: string;
  name: string;
  sourceType: DiscoverySourceType;
  sourceUrl: string;
  marketTags: string[];
  regionTags: string[];
  cityTags: string[];
  propertyTypeTags: string[];
  budgetMin?: number;
  budgetMax?: number;
  currency: string;
  buyerPersonaTags: string[];
  poiPriorityTags: string[];
  status: DiscoverySourceStatus;
  lastCheckedAt?: string;
  candidateCount: number;
  importedCandidateCount: number;
  rejectedCandidateCount: number;
  confidence: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type DiscoverySourceValidation = {
  sourceId: string;
  sourceUrl: string;
  valid: boolean;
  reason?: string;
};

export type DiscoveryCandidateBatch = {
  sourceId: string;
  providerStatus: "mock" | "fallback" | "error";
  candidateCount: number;
  importedCandidateCount: number;
  confidence: number;
  notes: string[];
};

export type DiscoverySourceCandidateResult = {
  provider: "mock_discovery_source_provider";
  sources: DiscoverySource[];
  candidates: ListingCandidate[];
  validations: DiscoverySourceValidation[];
  batches: DiscoveryCandidateBatch[];
  generatedAt: string;
};

export type ListingCandidate = {
  id: string;
  campaignId: string;
  source: CampaignSource;
  sourceUrl: string;
  listingUrl: string;
  title: string;
  price: number;
  currency: string;
  locationText: string;
  city: string;
  region: string;
  country: string;
  propertyType: string;
  bedrooms: number;
  bathrooms: number;
  sqm: number;
  description: string;
  imageUrls: string[];
  thumbnailUrl?: string;
  agencyName?: string;
  status: ListingCandidateStatus;
  extractionConfidence: number;
  discoveredAt: string;
  providerMetadata?: Record<string, string | number | boolean | null | undefined>;
};

export type EnrichedPoi = {
  id: string;
  name: string;
  category: PoiPriority;
  distanceKm: number;
  travelMinutes: number;
  confidence: "high" | "medium" | "low";
  source: string;
  providerMetadata?: Record<string, string | number | boolean | null | undefined>;
};

export type MapSceneKind = "property_pin" | "regional_orientation" | "local_poi" | "route_context" | "distance_context";

export type LocationMediaProviderStatus = "live" | "mock" | "fallback" | "missing_credentials" | "error";

export type LocationMediaAttribution = {
  provider: string;
  sourceLabel: string;
  sourceUrl?: string;
  required: boolean;
  note?: string;
};

export type LocationMediaAsset = {
  id: string;
  kind: MapSceneKind | "poi_photo";
  label: string;
  sourceProvider: string;
  url?: string;
  placeholderUrl?: string;
  width: number;
  height: number;
  attribution: LocationMediaAttribution[];
  usageNote?: string;
  confidence: "high" | "medium" | "low" | "placeholder";
  status: "ready" | "placeholder" | "fallback" | "error";
  metadata?: Record<string, string | number | boolean | null | undefined>;
};

export type PoiMediaCandidate = {
  id: string;
  poiId: string;
  placeId?: string;
  placeName: string;
  displayName: string;
  category: string;
  photoName?: string;
  photoUrl?: string;
  placeholderUrl: string;
  attribution: LocationMediaAttribution[];
  confidence: "high" | "medium" | "low" | "placeholder";
  status: "ready" | "placeholder" | "fallback" | "error";
  metadata?: Record<string, string | number | boolean | null | undefined>;
};

export type LocationMediaRequest = {
  candidateId: string;
  title: string;
  resolvedAddress: string;
  latitude: number;
  longitude: number;
  locationConfidence: "high" | "medium" | "low";
  pois: EnrichedPoi[];
};

export type LocationMediaResult = {
  provider: string;
  providerStatus: LocationMediaProviderStatus;
  mapSceneKinds: MapSceneKind[];
  assets: LocationMediaAsset[];
  poiMediaCandidates: PoiMediaCandidate[];
  attribution: LocationMediaAttribution[];
  sourceNotes: string[];
};

export interface LocationMediaProvider {
  providerName: string;
  generateAssets(request: LocationMediaRequest): LocationMediaResult;
}

export type EnrichedListing = {
  id: string;
  candidateId: string;
  latitude: number;
  longitude: number;
  resolvedAddress: string;
  locationConfidence: "high" | "medium" | "low";
  pois: EnrichedPoi[];
  mapAssets: {
    staticMapUrl: string;
    poiOverlayUrl: string;
    provider: string;
  };
  locationMedia: LocationMediaResult;
  distanceHighlights: string[];
  lifestyleSummary: string;
  investmentSummary: string;
};

export type ListingScoreBand = "excellent" | "strong" | "possible" | "skip";

export type ListingScore = {
  id: string;
  candidateId: string;
  totalScore: number;
  campaignFitScore: number;
  priceFitScore: number;
  locationScore: number;
  propertyTypeFitScore: number;
  poiScore: number;
  imageScore: number;
  investmentScore: number;
  lifestyleScore: number;
  buyerPersonaFitScore: number;
  confidenceScore: number;
  reasons: string[];
  riskFlags: string[];
  scoreBand: ListingScoreBand;
};

export type StoryboardScene = {
  id: string;
  order: number;
  title: string;
  visualType: "listing_hero" | "map" | "listing_gallery" | "cta";
  visualSource: string;
  narration: string;
  overlayText: string;
  durationSeconds: number;
};

export type Storyboard = {
  id: string;
  campaignId: string;
  candidateIds: string[];
  title: string;
  scenes: StoryboardScene[];
  locationMediaAssetIds: string[];
  narrationScript: string;
  estimatedDuration: number;
  status: "draft" | "ready";
};

export type NarrationAsset = {
  id: string;
  storyboardId: string;
  provider: string;
  voiceId: string;
  audioUrl: string;
  duration: number;
  status: "ready" | "pending";
  fallbackUsed: boolean;
};

export type VideoProject = {
  id: string;
  campaignId: string;
  storyboardId: string;
  assets: {
    listingImages: string[];
    mapAssets: string[];
    locationMediaAssetIds: string[];
    poiMediaCandidateIds: string[];
    narrationAudioUrl: string;
  };
  timeline: Array<{
    sceneId: string;
    startSeconds: number;
    durationSeconds: number;
    layer: string;
  }>;
  renderStatus: "provider_seam_ready" | "rendered";
  mp4Url: string;
  metadata: Record<string, string | number | boolean | null | undefined>;
};

export type PublishingPackage = {
  id: string;
  videoProjectId: string;
  youtubeTitle: string;
  description: string;
  tags: string[];
  chapters: Array<{ timestamp: string; title: string }>;
  thumbnailHooks: string[];
  pinnedComment: string;
  status: "draft_ready" | "published";
};
