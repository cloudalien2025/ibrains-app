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
};

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
