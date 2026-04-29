import { describe, expect, it } from "vitest";
import { createEmptyCasaHudExecutionData } from "@/lib/studio/domara/campaign-execution";
import {
  deriveCasaHudFeaturedPropertyMedia,
  type CasaHudFeaturedPropertyMedia,
} from "@/lib/studio/domara/campaign-featured-media";
import { createEmptyCasaHudLocationData } from "@/lib/studio/domara/campaign-location-intelligence";
import { createEmptyCasaHudMediaPlanData } from "@/lib/studio/domara/campaign-media-planning";
import { createEmptyCasaHudScriptData } from "@/lib/studio/domara/campaign-script-narrative";
import { createEmptyCasaHudYouTubePackageData } from "@/lib/studio/domara/campaign-youtube-package";
import type { CasaHudCampaign, CasaHudListingCandidate } from "@/lib/studio/domara/campaigns";

function createListing(overrides: Partial<CasaHudListingCandidate> = {}): CasaHudListingCandidate {
  return {
    id: "listing-1",
    provider: "idealista",
    providerListingId: "idealista-1",
    sourceUrl: "https://example.com/listing-1",
    title: "Tropea apartment with sea views",
    locationText: "Tropea, Calabria, Italy",
    country: "Italy",
    region: "Calabria",
    city: "Tropea",
    price: 284000,
    currency: "EUR",
    propertyType: "apartment",
    bedrooms: 2,
    bathrooms: 2,
    sizeSqm: 88,
    descriptionSnippet: "Move-in ready apartment with sea views.",
    features: ["move-in ready", "sea views"],
    imageUrls: [],
    imageCount: 0,
    photoAvailability: "none",
    discoveredAt: "2026-04-28T00:20:00.000Z",
    preliminaryMatchNotes: "Fits the title promise and budget.",
    ...overrides,
  };
}

function createCampaign(listing: CasaHudListingCandidate): CasaHudCampaign {
  return {
    id: "campaign-featured-media",
    name: "Could You Retire in Southern Italy for Under $300K?",
    selectedViralTitle: "Could You Retire in Southern Italy for Under $300K?",
    selectedTitle: {
      title: "Could You Retire in Southern Italy for Under $300K?",
      score: 92,
      campaignType: "lifestyle_relocation",
      confidence: 0.89,
      reasoning: "Strong relocation intent with believable support.",
      regionHint: "Southern Italy",
      listingSearchHints: ["Southern Italy homes under 300k"],
    },
    titleCandidates: [],
    researchBrief: {
      summary: "CasaHUD identified a supportable relocation angle.",
      opportunityCategories: ["relocation"],
      competitorPatterns: [],
      audienceIntent: [],
      suggestedTitleDirections: [],
      riskNotes: [],
    },
    campaignType: "lifestyle_relocation",
    marketRegionHint: "Southern Italy",
    preferredMarket: "Italian real-estate YouTube",
    generationSource: {
      mode: "casahud_patterns",
      label: "CasaHUD opportunity patterns",
      detail: "Using CasaHUD opportunity patterns.",
      canImproveWithYouTube: true,
    },
    confidenceReasoning: {
      summary: "CasaHUD picked the most supportable title direction.",
      titleOpportunitySummary: "The title stays specific enough to be validated against the shortlist.",
      selectedTitleReasoning: "It balances click appeal with believable support.",
      selectedTitleConfidence: 0.89,
    },
    status: "listing_candidates_discovered",
    listingCandidates: [listing],
    listingSearchCriteria: null,
    listingProviderStatuses: [],
    discoverySummary: null,
    listingDiscoveryStatus: "listing_candidates_discovered",
    approvedListings: [],
    rejectedListings: [],
    listingRankOrder: [],
    listingValidationStatus: "not_started",
    listingValidationSummary: null,
    titleSupportConfidence: null,
    validationWarnings: [],
    ...createEmptyCasaHudLocationData(),
    ...createEmptyCasaHudScriptData(),
    ...createEmptyCasaHudMediaPlanData(),
    ...createEmptyCasaHudYouTubePackageData(),
    ...createEmptyCasaHudExecutionData(),
    nextPhase: {
      key: "listing_validation",
      label: "Validate and rank listings",
      detail: "Validate and rank listings next.",
      implemented: false,
    },
    createdAt: "2026-04-28T00:00:00.000Z",
    updatedAt: "2026-04-28T00:00:00.000Z",
    generatedAt: "2026-04-28T00:00:00.000Z",
    futureState: {
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
    },
  };
}

function expectMedia(media: CasaHudFeaturedPropertyMedia, expected: Partial<CasaHudFeaturedPropertyMedia>) {
  expect(media).toMatchObject(expected);
}

describe("deriveCasaHudFeaturedPropertyMedia", () => {
  it("uses imageUrls[0] before lower-priority media fields", () => {
    const listing = createListing({
      imageUrls: ["https://images.example.com/listing-1.jpg"],
      thumbnailUrl: "https://images.example.com/listing-1-thumb.jpg",
      imageCount: 1,
      photoAvailability: "limited",
    });

    const media = deriveCasaHudFeaturedPropertyMedia(listing, createCampaign(listing));

    expectMedia(media, {
      kind: "real_image",
      url: "https://images.example.com/listing-1.jpg",
      stateLabel: "Listing image",
      hasRealImage: true,
    });
  });

  it("uses the source thumbnail when no listing image exists", () => {
    const listing = createListing({
      thumbnailUrl: "https://images.example.com/listing-1-thumb.jpg",
    });

    const media = deriveCasaHudFeaturedPropertyMedia(listing, createCampaign(listing));

    expectMedia(media, {
      kind: "thumbnail",
      url: "https://images.example.com/listing-1-thumb.jpg",
      stateLabel: "Source thumbnail",
      hasRealImage: true,
    });
  });

  it("uses a media-plan listing image asset when the listing record has no direct media", () => {
    const listing = createListing();
    const campaign = createCampaign(listing);
    campaign.visualAssets = [
      {
        id: "asset-1",
        type: "listing_image",
        title: "Listing hero",
        sourceProvider: "listing_source_media",
        sourceUrl: "https://images.example.com/media-plan-hero.jpg",
        listingId: listing.id,
        description: "Imported from media planning.",
        usageRightsStatus: "listing_source",
        confidence: 0.92,
        availabilityStatus: "available",
      },
    ];

    const media = deriveCasaHudFeaturedPropertyMedia(listing, campaign);

    expectMedia(media, {
      kind: "real_image",
      url: "https://images.example.com/media-plan-hero.jpg",
      stateLabel: "Listing image",
      hasRealImage: true,
    });
  });

  it("shows a media placeholder when CasaHUD has a planned asset but no real source image", () => {
    const listing = createListing();
    const campaign = createCampaign(listing);
    campaign.visualAssets = [
      {
        id: "asset-placeholder",
        type: "fallback_placeholder",
        title: "Placeholder frame",
        sourceProvider: "casahud_visual_placeholders",
        listingId: listing.id,
        description: "Placeholder until listing media arrives.",
        usageRightsStatus: "planning_only",
        confidence: 0.31,
        availabilityStatus: "planned",
        warning: "Placeholder is standing in until source media arrives.",
      },
    ];

    const media = deriveCasaHudFeaturedPropertyMedia(listing, campaign);

    expectMedia(media, {
      kind: "fallback",
      url: null,
      stateLabel: "Media placeholder",
      fallbackLabel: "Media placeholder",
      hasRealImage: false,
    });
  });

  it("shows Image needed only when no listing field or campaign asset can supply media", () => {
    const listing = createListing();

    const media = deriveCasaHudFeaturedPropertyMedia(listing, createCampaign(listing));

    expectMedia(media, {
      kind: "fallback",
      url: null,
      stateLabel: "Image needed",
      fallbackLabel: "Image needed",
      hasRealImage: false,
    });
  });
});
