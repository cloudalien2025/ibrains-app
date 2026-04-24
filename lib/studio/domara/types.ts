export type DomaraContentAngle = "lifestyle" | "investment" | "second_home" | "hidden_gem" | "deal_spotlight";

export type PropertyListingInput = {
  listingUrl?: string;
  source?: string;
  provider?: "manual" | "idealista" | "immobiliare" | "mock";
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
    provider?: "manual" | "idealista" | "immobiliare" | "mock";
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
