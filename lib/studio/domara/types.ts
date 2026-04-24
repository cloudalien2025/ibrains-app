export type DomaraContentAngle = "lifestyle" | "investment" | "second_home" | "hidden_gem" | "deal_spotlight";

export type PropertyListingInput = {
  listingUrl?: string;
  source?: string;
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
  contentAngle?: DomaraContentAngle;
};

export type NormalizedPropertyListing = {
  id: string;
  title: string;
  market: string;
  locationLabel: string;
  priceLabel: string;
  propertyFacts: string[];
  imageUrls: string[];
  sourceMetadata: {
    listingUrl?: string;
    source?: string;
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
  renderPlaceholder: {
    status: "pending_provider_connection";
    nextStep: string;
    provider: string;
  };
};

