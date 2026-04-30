// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import StudioDomaraClient from "@/app/apps/studio/studio-domara-client";
import {
  applyCasaHudMediaPlan,
  applyCasaHudYouTubePackage,
  type CasaHudCampaign,
  type CasaHudCampaignSummary,
} from "@/lib/studio/domara/campaigns";
import { createEmptyCasaHudExecutionData } from "@/lib/studio/domara/campaign-execution";
import { createEmptyCasaHudLocationData } from "@/lib/studio/domara/campaign-location-intelligence";
import { createEmptyCasaHudMediaPlanData } from "@/lib/studio/domara/campaign-media-planning";
import { createEmptyCasaHudScriptData } from "@/lib/studio/domara/campaign-script-narrative";
import { createEmptyCasaHudYouTubePackageData } from "@/lib/studio/domara/campaign-youtube-package";
import type { DomaraIntegrationProviderStatus } from "@/lib/studio/domara/integrations";
import { runCasaHudMediaPlanning } from "@/lib/studio/domara/media-planning-engine";
import { runCasaHudYouTubePackageReview } from "@/lib/studio/domara/youtube-package-engine";

vi.mock("next/link", async () => {
  const React = await import("react");

  return {
    default: ({
      href,
      children,
      ...props
    }: {
      href: string;
      children?: ReactNode;
    }) => React.createElement("a", { href, ...props }, children),
  };
});

const connectedProviders: DomaraIntegrationProviderStatus[] = [
  {
    providerId: "openai",
    displayName: "OpenAI",
    category: "ai_generation",
    requiredEnvVars: [],
    configured: true,
    validationStatus: "configured",
    safeSetupHelp: "Connect OpenAI.",
    capabilitiesEnabled: ["strategy"],
    configuredBy: "saved",
    maskedKey: "••••1234",
  },
  {
    providerId: "mapbox",
    displayName: "Mapbox",
    category: "maps",
    requiredEnvVars: [],
    configured: true,
    validationStatus: "configured",
    safeSetupHelp: "Connect Mapbox.",
    capabilitiesEnabled: ["maps"],
    configuredBy: "saved",
    maskedKey: "••••2345",
  },
  {
    providerId: "google_maps_places",
    displayName: "Google Places",
    category: "maps",
    requiredEnvVars: [],
    configured: true,
    validationStatus: "configured",
    safeSetupHelp: "Connect Google Places.",
    capabilitiesEnabled: ["pois"],
    configuredBy: "saved",
    maskedKey: "••••3456",
  },
  {
    providerId: "idealista",
    displayName: "Idealista",
    category: "listing_ingestion",
    requiredEnvVars: [],
    configured: true,
    validationStatus: "configured",
    safeSetupHelp: "Connect Idealista.",
    capabilitiesEnabled: ["listings"],
    configuredBy: "saved",
    maskedKey: "••••4567",
  },
  {
    providerId: "cloudinary",
    displayName: "Cloudinary",
    category: "media_storage",
    requiredEnvVars: [],
    configured: true,
    validationStatus: "configured",
    safeSetupHelp: "Connect Cloudinary.",
    capabilitiesEnabled: ["media"],
    configuredBy: "saved",
    maskedKey: "••••5678",
  },
  {
    providerId: "youtube",
    displayName: "YouTube Channel",
    category: "publishing",
    requiredEnvVars: [],
    configured: false,
    validationStatus: "missing",
    safeSetupHelp: "Connect YouTube.",
    capabilitiesEnabled: ["publishing"],
  },
];

const emptyLocationState = createEmptyCasaHudLocationData();
const emptyScriptState = createEmptyCasaHudScriptData();
const emptyMediaPlanState = createEmptyCasaHudMediaPlanData();
const emptyYouTubePackageState = createEmptyCasaHudYouTubePackageData();
const emptyExecutionState = createEmptyCasaHudExecutionData();

const savedCampaign: CasaHudCampaign = {
  id: "campaign-phase-3",
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
  titleCandidates: [
    {
      id: "title-1",
      title: "Could You Retire in Southern Italy for Under $300K?",
      score: 92,
      ctrPotential: 93,
      searchAppeal: 90,
      novelty: 82,
      realism: 91,
      listingAvailability: 88,
      channelFit: 90,
      titleTruthfulness: 92,
      campaignType: "lifestyle_relocation",
      regionHint: "Southern Italy",
      listingSearchHints: ["Southern Italy homes under 300k"],
      reasoning: "Strong relocation intent with believable support.",
    },
  ],
  researchBrief: {
    summary: "CasaFlix identified the strongest relocation opportunity in Southern Italy.",
    opportunityCategories: ["relocation"],
    competitorPatterns: ["Budget-led relocation titles perform well."],
    audienceIntent: ["retire in Italy"],
    suggestedTitleDirections: ["price-led relocation"],
    riskNotes: ["Avoid unsupported lifestyle claims."],
  },
  campaignType: "lifestyle_relocation",
  marketRegionHint: "Southern Italy",
  preferredMarket: "Italian real-estate YouTube",
  generationSource: {
    mode: "casahud_patterns",
    label: "CasaFlix opportunity patterns",
    detail: "Using CasaFlix opportunity patterns.",
    canImproveWithYouTube: true,
  },
  confidenceReasoning: {
    summary: "CasaFlix picked the most supportable title direction.",
    titleOpportunitySummary: "The title stays specific enough to be validated against the shortlist.",
    selectedTitleReasoning: "It balances click appeal with believable support.",
    selectedTitleConfidence: 0.89,
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
  ...emptyLocationState,
  ...emptyScriptState,
  ...emptyMediaPlanState,
  ...emptyYouTubePackageState,
  ...emptyExecutionState,
  nextPhase: {
    key: "property_discovery",
    label: "Find matching properties",
    detail:
      "Property Discovery comes next. CasaFlix will translate the saved title promise into real candidate listings without regenerating the title package.",
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

const validatedCampaign: CasaHudCampaign = {
  ...savedCampaign,
  status: "listing_candidates_validated",
  listingCandidates: [
    {
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
      currency: "USD",
      propertyType: "apartment",
      bedrooms: 2,
      bathrooms: 2,
      sizeSqm: 88,
      descriptionSnippet: "Move-in ready apartment with sea views.",
      features: ["move-in ready", "sea views"],
      imageUrls: ["https://images.example.com/1.jpg"],
      imageCount: 1,
      photoAvailability: "limited",
      discoveredAt: "2026-04-28T00:20:00.000Z",
      preliminaryMatchNotes: "Fits the title promise and budget.",
    },
    {
      id: "listing-2",
      provider: "idealista",
      providerListingId: "idealista-2",
      sourceUrl: "https://example.com/listing-2",
      thumbnailUrl: "https://images.example.com/listing-2-thumb.jpg",
      title: "Lecce villa with courtyard",
      locationText: "Lecce, Puglia, Italy",
      country: "Italy",
      region: "Puglia",
      city: "Lecce",
      price: 296000,
      currency: "USD",
      propertyType: "villa",
      bedrooms: 3,
      bathrooms: 2,
      sizeSqm: 112,
      descriptionSnippet: "Large villa with light renovation needs.",
      features: ["courtyard"],
      imageUrls: [],
      imageCount: 0,
      photoAvailability: "none",
      discoveredAt: "2026-04-28T00:20:00.000Z",
      preliminaryMatchNotes: "Looks plausible but the evidence is weaker.",
    },
  ],
  approvedListings: [
    {
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
      currency: "USD",
      propertyType: "apartment",
      bedrooms: 2,
      bathrooms: 2,
      sizeSqm: 88,
      descriptionSnippet: "Move-in ready apartment with sea views.",
      features: ["move-in ready", "sea views"],
      imageUrls: ["https://images.example.com/1.jpg"],
      imageCount: 1,
      photoAvailability: "limited",
      discoveredAt: "2026-04-28T00:20:00.000Z",
      preliminaryMatchNotes: "Fits the title promise and budget.",
      validationStatus: "approved",
      overallScore: 88,
      scoreBreakdown: {
        titleMatchScore: 92,
        geographyScore: 100,
        priceFitScore: 100,
        propertyTypeScore: 100,
        featureClaimScore: 76,
        mediaAvailabilityScore: 52,
        listingCompletenessScore: 78,
        providerQualityScore: 64,
        uniquenessScore: 100,
        overallScore: 88,
      },
      validationReasons: ["Location aligns with the campaign region."],
      warnings: [],
      rank: 1,
    },
  ],
  rejectedListings: [
    {
      id: "listing-2",
      provider: "idealista",
      providerListingId: "idealista-2",
      sourceUrl: "https://example.com/listing-2",
      thumbnailUrl: "https://images.example.com/listing-2-thumb.jpg",
      title: "Lecce villa with courtyard",
      locationText: "Lecce, Puglia, Italy",
      country: "Italy",
      region: "Puglia",
      city: "Lecce",
      price: 296000,
      currency: "USD",
      propertyType: "villa",
      bedrooms: 3,
      bathrooms: 2,
      sizeSqm: 112,
      descriptionSnippet: "Large villa with light renovation needs.",
      features: ["courtyard"],
      imageUrls: [],
      imageCount: 0,
      photoAvailability: "none",
      discoveredAt: "2026-04-28T00:20:00.000Z",
      preliminaryMatchNotes: "Looks plausible but the evidence is weaker.",
      validationStatus: "needs_attention",
      overallScore: 63,
      scoreBreakdown: {
        titleMatchScore: 58,
        geographyScore: 86,
        priceFitScore: 100,
        propertyTypeScore: 100,
        featureClaimScore: 42,
        mediaAvailabilityScore: 0,
        listingCompletenessScore: 78,
        providerQualityScore: 64,
        uniquenessScore: 100,
        overallScore: 63,
      },
      validationReasons: ["Feature support is thin for this title."],
      warnings: ["Some listings still need stronger evidence and imagery."],
      rejectionCategory: "weak_support",
      duplicateGroupKey: "listing-2",
    },
  ],
  listingRankOrder: ["listing-1"],
  listingValidationStatus: "listing_candidates_validated",
  listingValidationSummary: {
    headline: "Approved 1 of 2 discovered listings for the title promise.",
    rankingExplanation: "CasaFlix ranked the shortlist by truthfulness, price fit, and media coverage.",
    discoveredCount: 2,
    approvedCount: 1,
    rejectedCount: 1,
    needsAttentionCount: 1,
    titleSupportConfidence: 74,
    warnings: ["Some listings still need stronger evidence and imagery."],
    completedAt: "2026-04-28T00:25:00.000Z",
  },
  titleSupportConfidence: 74,
  validationWarnings: ["Some listings still need stronger evidence and imagery."],
  nextPhase: {
    key: "location_intelligence",
    label: "Location Intelligence",
    detail:
      "Location Intelligence comes next. CasaFlix will explain why the strongest validated properties work through area and map context.",
    implemented: false,
  },
  updatedAt: "2026-04-28T00:25:00.000Z",
};

const importedCampaign: CasaHudCampaign = {
  ...savedCampaign,
  status: "listing_candidates_discovered",
  listingDiscoveryStatus: "listing_candidates_discovered",
  discoverySummary: {
    headline: 'Imported 1 user-provided property into the shortlist for "Could You Retire in Southern Italy for Under $300K?".',
    criteriaSummary: "User-provided listing URLs are ready for shortlist review and fact-checking.",
    providerSummary: "User-provided imports stay clearly labeled by source type.",
    candidateCount: 1,
    liveCandidateCount: 0,
    fallbackCandidateCount: 0,
    fallbackUsed: false,
    warnings: [],
    discoveredAt: "2026-04-29T10:00:00.000Z",
  },
  listingCandidates: [
    {
      id: "imported-listing-1",
      provider: "idealista",
      sourceType: "imported_url",
      originalSourceUrl: "https://www.idealista.it/en/annuncio/123?utm_source=test",
      normalizedSourceUrl: "https://www.idealista.it/en/annuncio/123",
      canonicalSourceUrl: "https://www.idealista.it/en/annuncio/123",
      sourceUrl: "https://www.idealista.it/en/annuncio/123",
      sourceHost: "idealista.it",
      sourceLabel: "Idealista",
      urlClassification: "listing",
      importedAt: "2026-04-29T10:00:00.000Z",
      featuredImageUrl: "https://images.example.com/imported-og.jpg",
      metadataImageUrl: "https://images.example.com/imported-og.jpg",
      metadataTitle: "Apartment in Tropea",
      metadataDescription: "EUR 284000 apartment in Tropea, Calabria, Italy with 2 bedrooms, 2 bathrooms, and 88 sqm.",
      canonicalUrl: "https://www.idealista.it/en/annuncio/123",
      extractionStatus: "partial",
      extractionProvider: "idealista_generic",
      extractionFields: ["title", "price", "locationText", "bedrooms", "bathrooms", "interiorSizeSqm", "featuredImageUrl"],
      extractionWarnings: [],
      needsReviewFields: ["rooms", "land_size", "floor", "parking", "condition", "energy"],
      manualCompletionStatus: "partially_completed",
      manuallyCompletedFields: ["title", "locationText"],
      manualUpdatedAt: "2026-04-29T10:05:00.000Z",
      title: "Apartment in Tropea",
      locationText: "Tropea, Calabria, Italy",
      price: 284000,
      currency: "EUR",
      propertyType: "Apartment",
      bedrooms: 2,
      bathrooms: 2,
      sizeSqm: 88,
      descriptionSnippet: "EUR 284000 apartment in Tropea, Calabria, Italy with 2 bedrooms, 2 bathrooms, and 88 sqm.",
      summary: "An apartment in Tropea, Calabria, Italy with 2 bedrooms, 2 bathrooms, 88 m² of interior space, priced at €284,000.",
      imageStatus: "available" as const,
      casaHudShortSummary: "An apartment in Tropea, Calabria, Italy with 2 bedrooms, 2 bathrooms, 88 m² of interior space, priced at €284,000.",
      casaHudNarrationSeed: "An apartment in Tropea, Calabria, Italy with 2 bedrooms, 2 bathrooms, 88 m² of interior space, priced at €284,000.",
      features: ["Apartment", "2 bedrooms", "2 bathrooms", "88 m² interior"],
      imageUrls: ["https://images.example.com/imported-og.jpg"],
      imageCount: 1,
      photoAvailability: "limited",
      discoveredAt: "2026-04-29T10:00:00.000Z",
      preliminaryMatchNotes: "An apartment in Tropea, Calabria, Italy with 2 bedrooms, 2 bathrooms, 88 m² of interior space, priced at €284,000.",
    },
  ],
  updatedAt: "2026-04-29T10:00:00.000Z",
};

const browserImportedCampaign: CasaHudCampaign = {
  ...importedCampaign,
  discoverySummary: {
    headline: 'Imported 1 user-provided property into the shortlist for "Could You Retire in Southern Italy for Under $300K?".',
    criteriaSummary: "Browser-assisted property imports are ready for shortlist review and fact-checking.",
    providerSummary: "User-provided imports stay clearly labeled by source type.",
    candidateCount: 1,
    liveCandidateCount: 0,
    fallbackCandidateCount: 0,
    fallbackUsed: false,
    warnings: [],
    discoveredAt: "2026-04-30T08:00:00.000Z",
  },
  listingCandidates: [
    {
      ...importedCampaign.listingCandidates[0]!,
      id: "browser-imported-listing-1",
      provider: "immobiliare",
      sourceType: "browser_assisted_import",
      sourceUrl: "https://www.immobiliare.it/en/annunci/121869400/",
      originalSourceUrl: "https://www.immobiliare.it/en/annunci/121869400/",
      normalizedSourceUrl: "https://www.immobiliare.it/en/annunci/121869400/",
      canonicalSourceUrl: "https://www.immobiliare.it/en/annunci/121869400/",
      sourceHost: "immobiliare.it",
      sourceLabel: "Immobiliare",
      featuredImageUrl: "https://images.example.com/browser-import-og.jpg",
      metadataImageUrl: "https://images.example.com/browser-import-og.jpg",
      title: "Albanella Single Family Villa with Private Garden",
      locationText: "Via San Berardino, Albanella, Salerno, Campania, Italy",
      propertyType: "Single family villa",
      bedrooms: 3,
      bathrooms: 2,
      rooms: 5,
      sizeSqm: 150,
      landSizeSqm: 1106,
      price: 299000,
      currency: "EUR",
      extractionStatus: "extracted",
      manualCompletionStatus: "completed",
      needsReviewFields: [],
      imageStatus: "available",
      imageUrls: ["https://images.example.com/browser-import-og.jpg"],
      imageCount: 1,
      photoAvailability: "limited",
      summary: "In Albanella, this independent villa is listed at €299,000 with three bedrooms, two bathrooms, and a private garden.",
      casaHudNarrationSeed:
        "In Albanella, this independent villa brings the Southern Italy lifestyle into a practical frame: €299,000 for a renovated home, private garden, garage space, and room to live both indoors and outside.",
    },
  ],
};

const legacyDemoOnlyCampaign: CasaHudCampaign = {
  ...savedCampaign,
  status: "listing_candidates_discovered",
  listingDiscoveryStatus: "listing_candidates_discovered",
  discoverySummary: {
    headline: 'Prepared 1 candidate property for "Could You Retire in Southern Italy for Under $300K?".',
    criteriaSummary: "Legacy demo shortlist data exists.",
    providerSummary: "Demo data is enabled for this workspace run.",
    candidateCount: 1,
    liveCandidateCount: 0,
    fallbackCandidateCount: 1,
    fallbackUsed: true,
    warnings: ["Using demo listings for non-production workflow testing."],
    discoveredAt: "2026-04-30T08:30:00.000Z",
  },
  listingCandidates: [
    {
      id: "legacy-demo-listing-1",
      provider: "casahud_sample",
      sourceType: "sample_pattern",
      sourceLabel: "Demo data",
      title: "Bari House for a Southern Italy Reset",
      locationText: "Bari, Puglia, Italy",
      country: "Italy",
      region: "Puglia",
      city: "Bari",
      price: 284000,
      currency: "EUR",
      propertyType: "House",
      bedrooms: 3,
      bathrooms: 2,
      sizeSqm: 118,
      descriptionSnippet: "Legacy demo listing.",
      features: ["Demo data"],
      imageUrls: [],
      imageCount: 0,
      photoAvailability: "none",
      discoveredAt: "2026-04-30T08:30:00.000Z",
      preliminaryMatchNotes: "Legacy demo candidate.",
    },
  ],
};

const mixedLegacyAndBrowserCampaign: CasaHudCampaign = {
  ...browserImportedCampaign,
  listingCandidates: [
    ...Array.from({ length: 6 }).map((_, index) => ({
      ...legacyDemoOnlyCampaign.listingCandidates[0]!,
      id: `legacy-demo-listing-${index + 1}`,
      title: index % 2 === 0 ? "Bari House for a Southern Italy Reset" : "Catania Villa for a Southern Italy Reset",
    })),
    browserImportedCampaign.listingCandidates[0]!,
  ],
  discoverySummary: {
    headline: 'Imported 1 user-provided property into the shortlist for "Could You Retire in Southern Italy for Under $300K?".',
    criteriaSummary: "Browser-assisted property imports are ready for shortlist review and fact-checking.",
    providerSummary: "User-provided imports stay clearly labeled by source type.",
    candidateCount: 7,
    liveCandidateCount: 0,
    fallbackCandidateCount: 6,
    fallbackUsed: true,
    warnings: [],
    discoveredAt: "2026-04-30T09:00:00.000Z",
  },
};

const scriptedCampaign: CasaHudCampaign = {
  ...validatedCampaign,
  status: "script_narrative_completed",
  locationIntelligenceStatus: "location_intelligence_completed",
  locationIntelligenceSummary: {
    headline: "Location story prepared across the shortlist.",
    providerSummary: "Maps and POIs are available.",
    coverageSummary: "Tropea anchors the relocation story with coastal lifestyle proof points.",
    warningCount: 0,
    generatedAt: "2026-04-28T00:30:00.000Z",
    fallbackUsed: false,
  },
  locationStory: {
    headline: "Tropea turns the shortlist into a place-led story.",
    summary: "CasaFlix frames the property through coastal day-to-day life instead of generic travel filler.",
    narrativeAngles: ["Lead with place before property."],
    lifestyleAnchors: ["Waterside lifestyle context", "Travel-friendly arrival story"],
    regionHighlights: ["Tropea", "Calabria"],
  },
  localHighlights: [
    {
      id: "highlight-1",
      title: "Regional anchor",
      description: "Tropea gives the campaign a specific place identity.",
      locationText: "Tropea, Calabria, Italy",
      associatedListingId: "listing-1",
      provider: "google_places",
      sourceConfidence: "high",
    },
  ],
  poiBundle: {
    summary: "3 location proof points prepared for the shortlist.",
    cards: [
      {
        id: "poi-1",
        name: "Coastal access context",
        category: "Beach",
        locationText: "Tropea, Calabria, Italy",
        associatedListingId: "listing-1",
        relevanceReason: "Supports the daily-life coastal promise in the title.",
        provider: "google_places",
        sourceConfidence: "high",
      },
    ],
    categories: ["Beach"],
    generatedAt: "2026-04-28T00:30:00.000Z",
  },
  mapSceneIdeas: [
    {
      id: "map-1",
      title: "Open on Tropea",
      sceneType: "regional_anchor",
      description: "Establish Tropea before the property details arrive.",
      associatedListingId: "listing-1",
      locationText: "Tropea, Calabria, Italy",
      suggestedVisual: "Wide regional map pull-back with the property highlighted.",
      provider: "mapbox",
      confidence: "high",
    },
  ],
  listingLocationInsights: [
    {
      listingId: "listing-1",
      summary: "Tropea apartment with sea views plays best as a waterside lifestyle story.",
      highlights: ["Coastal day-to-day context"],
      nearbyPois: [],
      locationStrengths: ["Waterside lifestyle context"],
      warnings: [],
    },
  ],
  scriptGenerationStatus: "script_generated",
  scriptSummary: "A relocation-oriented narrative that uses the validated shortlist and place story.",
  openingHook: "What does life in Southern Italy actually look like when the homes are real and the budget still matters?",
  estimatedDurationSeconds: 104,
  tone: "Premium, clear, cinematic where appropriate.",
  scriptSegments: [
    {
      id: "segment-hook",
      title: "Opening Hook",
      segmentType: "hook",
      narration: "What does life in Southern Italy actually look like when the homes are real and the budget still matters?",
      durationSeconds: 14,
      visualNote: "Open on the region before the listing.",
    },
    {
      id: "segment-location",
      title: "Location Story",
      segmentType: "location_context",
      narration: "Lead the place story through Tropea and Calabria before drilling into property specifics.",
      durationSeconds: 14,
      visualNote: "Use the map pull-back and local context.",
    },
    {
      id: "segment-property",
      title: "Property 1: Tropea apartment with sea views",
      segmentType: "property_focus",
      narration: "Ground the story with the validated property and its real price, layout, and coastal location.",
      durationSeconds: 24,
      associatedListingId: "listing-1",
      visualNote: "Keep the segment anchored to verified listing facts.",
    },
  ],
  propertySegments: [
    {
      listingId: "listing-1",
      title: "Tropea apartment with sea views",
      locationText: "Tropea, Calabria, Italy",
      narration: "Use the listing to ground the relocation story in real budget and location support.",
      whyItMadeTheCut: "It gives the story a believable mix of budget, livability, and place.",
      supportedFacts: ["USD 284,000", "2 bedrooms", "88 sqm"],
      locationLine: "Lead with Tropea as the lifestyle anchor.",
    },
  ],
  locationLifestyleLines: ["Lead the place story through Tropea before drilling into property specifics."],
  transitions: ["Bridge the property segment through daily-life fit."],
  closingCta: "Invite the viewer to follow for the next relocation-focused shortlist.",
  toneAndPacingNotes: ["Keep the delivery premium and clear."],
  scriptWarnings: ["Keep the hook specific to the approved listing support."],
  scriptProviderStatus: {
    provider: "casahud_script_patterns",
    label: "CasaFlix script patterns",
    state: "fallback",
    configured: true,
    used: true,
    detail: "Using deterministic CasaFlix script composition.",
  },
  fullScriptText:
    "Opening Hook\nWhat does life in Southern Italy actually look like when the homes are real and the budget still matters?",
  nextPhase: {
    key: "media_planning_asset_assembly",
    label: "Media Planning and Asset Assembly",
    detail:
      "Media Planning and Asset Assembly comes next. CasaFlix will organize visuals, map scenes, and asset needs around the approved narrative package.",
    implemented: false,
  },
};

const mediaPlannedCampaign = applyCasaHudMediaPlan(scriptedCampaign, runCasaHudMediaPlanning(scriptedCampaign));
const packagedCampaign = applyCasaHudYouTubePackage(mediaPlannedCampaign, runCasaHudYouTubePackageReview(mediaPlannedCampaign));
const renderPlanOnlyCampaign: CasaHudCampaign = {
  ...packagedCampaign,
  renderStatus: "not_started",
  renderOutput: null,
  renderOutputUrl: null,
  renderOutputPath: null,
  previewPackage: null,
  executionRunHistory: [],
};
const renderedCampaign: CasaHudCampaign = {
  ...packagedCampaign,
  renderStatus: "rendered",
  renderOutput: {
    id: "render-output-1",
    type: "mp4",
    status: "rendered",
    url: "https://cdn.example.com/casahud/final.mp4",
    path: "/generated/casahud/final.mp4",
    durationSeconds: 104,
    format: "video/mp4",
    createdAt: "2026-04-28T00:45:00.000Z",
    provider: "ffmpeg_local",
    metadata: { sceneCount: 3, format: "video/mp4" },
    warnings: [],
  },
  renderOutputUrl: "https://cdn.example.com/casahud/final.mp4",
  renderOutputPath: "/generated/casahud/final.mp4",
};

function toSummary(campaign: CasaHudCampaign): CasaHudCampaignSummary {
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

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("CasaFlix command center UI", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    delete (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("renders the compact sidebar shell with the reset workspace labels and no old mock-first language", () => {
    const html = renderToStaticMarkup(<StudioDomaraClient />);

    expect(html).toContain("casahud-sidebar");
    expect(html).toContain("casahud-mobile-menu");
    expect(html).toContain(">Campaigns<");
    expect(html).toContain(">Viral Titles<");
    expect(html).toContain(">Publish<");
    expect(html).toContain(">Connections<");
    expect(html).not.toContain(">Dashboard<");
    expect(html).not.toContain(">Opportunity Brief<");
    expect(html).not.toContain(">Render &amp; Publish<");
    expect(html).not.toContain("Generate Mock Viral Titles");
    expect(html).not.toContain("Mock-first MVP");
    expect(html).not.toContain("CasaFlix Campaign Workflow");
    expect(html).not.toContain("Generate your next viral property video");
    expect(html).not.toContain("React has blocked a javascript: URL as a security precaution.");
  });

  it("opens a mobile drawer with an independently scrollable navigation container that reaches lower items", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/api/studio/domara/integrations/status")) {
        return new Response(JSON.stringify({ ok: true, providers: connectedProviders, saveSupported: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.endsWith("/api/studio/domara/campaigns")) {
        return new Response(JSON.stringify({ ok: true, campaigns: [toSummary(packagedCampaign)] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      throw new Error(`Unhandled fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    await act(async () => {
      root.render(<StudioDomaraClient />);
    });
    await flush();

    await act(async () => {
      container.querySelector('[data-testid="casahud-mobile-menu"]')?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    const drawer = container.querySelector('[data-testid="casahud-mobile-drawer"]');
    const scrollRegion = container.querySelector('[data-testid="casahud-mobile-drawer-scroll"]');

    expect(drawer?.textContent).toContain("Publish");
    expect(drawer?.textContent).toContain("Connections");
    expect(scrollRegion?.className).toContain("overflow-y-auto");
  });

  it("renders the Connections workspace directly without duplicate top-level manage controls", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/api/studio/domara/integrations/status")) {
        return new Response(JSON.stringify({ ok: true, providers: connectedProviders, saveSupported: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.endsWith("/api/studio/domara/campaigns")) {
        return new Response(JSON.stringify({ ok: true, campaigns: [toSummary(packagedCampaign)] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      throw new Error(`Unhandled fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    await act(async () => {
      root.render(<StudioDomaraClient />);
    });
    await flush();

    await act(async () => {
      container.querySelector('[data-testid="casahud-nav-connections"]')?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    expect(container.querySelector('[data-testid="casahud-connections"]')?.textContent).toContain("Connections");
    expect(container.querySelector('[data-testid="casahud-connections"]')?.textContent).not.toContain("Manage Connections");
  });

  it("shows the shortlist URL import UI and renders imported URL cards with source preview imagery", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/api/studio/domara/integrations/status")) {
        return new Response(JSON.stringify({ ok: true, providers: connectedProviders, saveSupported: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.endsWith("/api/studio/domara/campaigns")) {
        return new Response(JSON.stringify({ ok: true, campaigns: [toSummary(importedCampaign)] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.endsWith(`/api/studio/domara/campaigns/${importedCampaign.id}`)) {
        return new Response(JSON.stringify({ ok: true, campaign: importedCampaign }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      throw new Error(`Unhandled fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    await act(async () => {
      root.render(<StudioDomaraClient />);
    });
    await flush();

    await act(async () => {
      container.querySelector('[data-testid="casahud-resume-campaign"]')?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    await act(async () => {
      container.querySelector('[data-testid="casahud-nav-properties"]')?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    expect(container.querySelector('[data-testid="casahud-import-listing-urls"]')?.textContent).toContain("Import Listing URLs");

    const propertyText = container.querySelector('[data-testid="casahud-properties"]')?.textContent || "";
    expect(propertyText).toContain("Imported URL");
    expect(propertyText).toContain("Idealista");
    expect(propertyText).toContain("Imported URL image");
    expect(propertyText).toContain("€284,000");
    expect(propertyText).toContain("Tropea, Calabria, Italy");
    expect(propertyText).toContain("Apartment");
    expect(propertyText).toContain("2 bd");
    expect(propertyText).toContain("2 ba");
    expect(propertyText).toContain("88 sqm");
    expect(propertyText).toContain("View Source");
    expect(propertyText).toContain("Floor details need review");
    expect(propertyText).not.toContain("Price on request");
    expect(propertyText).not.toContain("Facts pending");
    expect(propertyText).not.toContain("Image needed");
  });

  it("shows the browser-assisted import panel and renders browser-imported cards with source truth", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.ibrains.ai");

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/api/studio/domara/integrations/status")) {
        return new Response(JSON.stringify({ ok: true, providers: connectedProviders, saveSupported: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.endsWith("/api/studio/domara/campaigns")) {
        return new Response(JSON.stringify({ ok: true, campaigns: [toSummary(browserImportedCampaign)] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.endsWith(`/api/studio/domara/campaigns/${browserImportedCampaign.id}`)) {
        return new Response(JSON.stringify({ ok: true, campaign: browserImportedCampaign }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      throw new Error(`Unhandled fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    await act(async () => {
      root.render(<StudioDomaraClient />);
    });
    await flush();

    await act(async () => {
      container.querySelector('[data-testid="casahud-resume-campaign"]')?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    await act(async () => {
      container.querySelector('[data-testid="casahud-nav-properties"]')?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    const browserUiText = container.textContent || "";
    expect(browserUiText).toContain("Browser-Assisted Import");
    expect(browserUiText).toContain("CasaFlix Importer captures visible listing text, page metadata, and image candidates");
    expect(browserUiText).toContain("Drag CasaFlix Importer to your bookmarks bar, or copy the bookmarklet code and create it manually.");
    expect(browserUiText).toContain("Importer target: app.ibrains.ai");
    expect(browserUiText).toContain("Copy Bookmarklet Code");
    const bookmarkletLink = container.querySelector('[data-testid="casahud-browser-importer-bookmarklet"]') as HTMLAnchorElement | null;
    expect(bookmarkletLink?.getAttribute("href")).toContain("javascript:");
    expect(bookmarkletLink?.getAttribute("href")).toContain("https://app.ibrains.ai/api/studio/domara/browser-import/bookmarklet");
    expect(bookmarkletLink?.getAttribute("href")).toContain("campaignId=campaign-phase-3");
    expect(bookmarkletLink?.getAttribute("href")).not.toContain("localhost");
    expect(bookmarkletLink?.getAttribute("href")).not.toContain("React has blocked a javascript: URL as a security precaution.");
    expect(container.innerHTML).not.toContain("React has blocked a javascript: URL as a security precaution.");
    const bookmarkletCodeField = container.querySelector(
      '[data-testid="casahud-browser-importer-bookmarklet-code"]',
    ) as HTMLTextAreaElement | null;
    expect(bookmarkletCodeField?.value).toContain("javascript:");
    expect(bookmarkletCodeField?.value).toContain("https://app.ibrains.ai/api/studio/domara/browser-import/bookmarklet");
    expect(bookmarkletCodeField?.value).toContain("campaignId=campaign-phase-3");
    expect(bookmarkletCodeField?.value).not.toContain("localhost");
    const reviewLink = container.querySelector('[data-testid="casahud-browser-import-review-link"]') as HTMLAnchorElement | null;
    expect(reviewLink?.getAttribute("href")).toBe("https://app.ibrains.ai/apps/studio/casaflix/import?campaignId=campaign-phase-3");
    expect(reviewLink?.getAttribute("href")).not.toContain("localhost");

    const propertyText = container.querySelector('[data-testid="casahud-properties"]')?.textContent || "";
    expect(propertyText).toContain("Imported from Browser");
    expect(propertyText).toContain("Immobiliare");
    expect(propertyText).toContain("Browser import image");
    expect(propertyText).toContain("€299,000");
    expect(propertyText).toContain("Via San Berardino, Albanella, Salerno, Campania, Italy");
    expect(propertyText).toContain("Single family villa");
    expect(propertyText).toContain("View Source");
    expect(propertyText).toContain("Edit Details");
    expect(propertyText).not.toContain("demo workflow");
  });

  it("hides legacy demo listings from the production shortlist view and prompts real imports", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/api/studio/domara/integrations/status")) {
        return new Response(JSON.stringify({ ok: true, providers: connectedProviders, saveSupported: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.endsWith("/api/studio/domara/campaigns")) {
        return new Response(JSON.stringify({ ok: true, campaigns: [toSummary(legacyDemoOnlyCampaign)] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.endsWith(`/api/studio/domara/campaigns/${legacyDemoOnlyCampaign.id}`)) {
        return new Response(JSON.stringify({ ok: true, campaign: legacyDemoOnlyCampaign }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      throw new Error(`Unhandled fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    await act(async () => {
      root.render(<StudioDomaraClient />);
    });
    await flush();

    await act(async () => {
      container.querySelector('[data-testid="casahud-resume-campaign"]')?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    await act(async () => {
      container.querySelector('[data-testid="casahud-nav-properties"]')?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    const propertyText = container.querySelector('[data-testid="casahud-properties"]')?.textContent || "";
    expect(propertyText).toContain("No real property listings added yet");
    expect(propertyText).toMatch(/legacy demo listing/i);
    expect(propertyText).toContain("Import Listing URLs");
    expect(propertyText).toContain("Browser-assisted import");
    expect(propertyText).not.toContain("Bari House for a Southern Italy Reset");
    expect(propertyText).not.toContain("Sample Pattern");
  });

  it("shows browser-imported real listings even when legacy demo listings are present", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/api/studio/domara/integrations/status")) {
        return new Response(JSON.stringify({ ok: true, providers: connectedProviders, saveSupported: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.endsWith("/api/studio/domara/campaigns")) {
        return new Response(JSON.stringify({ ok: true, campaigns: [toSummary(mixedLegacyAndBrowserCampaign)] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.endsWith(`/api/studio/domara/campaigns/${mixedLegacyAndBrowserCampaign.id}`)) {
        return new Response(JSON.stringify({ ok: true, campaign: mixedLegacyAndBrowserCampaign }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      throw new Error(`Unhandled fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    await act(async () => {
      root.render(<StudioDomaraClient />);
    });
    await flush();

    await act(async () => {
      container.querySelector('[data-testid="casahud-resume-campaign"]')?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    await act(async () => {
      container.querySelector('[data-testid="casahud-nav-properties"]')?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    const propertyText = container.querySelector('[data-testid="casahud-properties"]')?.textContent || "";
    expect(propertyText).toContain("1 candidate");
    expect(propertyText).toContain("Albanella Single Family Villa with Private Garden");
    expect(propertyText).toContain("Imported from Browser");
    expect(propertyText).toContain("Browser import image");
    expect(propertyText).not.toContain("No real property listings added yet");
    expect(propertyText).not.toContain("Bari House for a Southern Italy Reset");
    expect(propertyText).not.toContain("Catania Villa for a Southern Italy Reset");
    expect(propertyText).not.toContain("Image needed");
  });

  it("copies bookmarklet code from the browser-assisted import panel", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.ibrains.ai");

    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/api/studio/domara/integrations/status")) {
        return new Response(JSON.stringify({ ok: true, providers: connectedProviders, saveSupported: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.endsWith("/api/studio/domara/campaigns")) {
        return new Response(JSON.stringify({ ok: true, campaigns: [toSummary(browserImportedCampaign)] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.endsWith(`/api/studio/domara/campaigns/${browserImportedCampaign.id}`)) {
        return new Response(JSON.stringify({ ok: true, campaign: browserImportedCampaign }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      throw new Error(`Unhandled fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    await act(async () => {
      root.render(<StudioDomaraClient />);
    });
    await flush();

    await act(async () => {
      container.querySelector('[data-testid="casahud-resume-campaign"]')?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    await act(async () => {
      container.querySelector('[data-testid="casahud-nav-properties"]')?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    await act(async () => {
      container.querySelector('[data-testid="casahud-browser-importer-copy"]')?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    expect(writeText).toHaveBeenCalledOnce();
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("javascript:"));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("https://app.ibrains.ai/api/studio/domara/browser-import/bookmarklet"));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("campaignId=campaign-phase-3"));
    expect(writeText).toHaveBeenCalledWith(expect.not.stringContaining("localhost"));
    expect(container.textContent || "").toContain("Bookmarklet code copied.");
  });

  it("opens the imported listing editor, saves manual details, and updates the card copy", async () => {
    const editedCampaign: CasaHudCampaign = {
      ...importedCampaign,
      listingCandidates: [
        {
          ...importedCampaign.listingCandidates[0]!,
          title: "Tropea Apartment with Manual Title",
          manualFeaturedImageUrl: "https://images.example.com/imported-manual.jpg",
          featuredImageUrl: "https://images.example.com/imported-manual.jpg",
          manualCompletionStatus: "completed",
          needsReviewFields: [],
          summary: "In Tropea, this apartment is listed at €284,000 with two bedrooms, two bathrooms, and a stronger imported image.",
          casaHudNarrationSeed: "In Tropea, this apartment is listed at €284,000 with two bedrooms, two bathrooms, and a stronger imported image.",
        },
      ],
    };

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.includes("/api/studio/domara/integrations/status")) {
        return new Response(JSON.stringify({ ok: true, providers: connectedProviders, saveSupported: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.endsWith("/api/studio/domara/campaigns")) {
        return new Response(JSON.stringify({ ok: true, campaigns: [toSummary(importedCampaign)] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.endsWith(`/api/studio/domara/campaigns/${importedCampaign.id}`)) {
        return new Response(JSON.stringify({ ok: true, campaign: importedCampaign }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (
        url.endsWith(`/api/studio/domara/campaigns/${importedCampaign.id}/listing-candidates/${importedCampaign.listingCandidates[0]!.id}`) &&
        init?.method === "PATCH"
      ) {
        return new Response(JSON.stringify({ ok: true, campaign: editedCampaign, summary: toSummary(editedCampaign), listing: editedCampaign.listingCandidates[0] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      throw new Error(`Unhandled fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    await act(async () => {
      root.render(<StudioDomaraClient />);
    });
    await flush();

    await act(async () => {
      container.querySelector('[data-testid="casahud-resume-campaign"]')?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    await act(async () => {
      container.querySelector('[data-testid="casahud-nav-properties"]')?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    await act(async () => {
      container.querySelector('[data-testid="casahud-edit-imported-listing"]')?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    const titleInput = container.querySelector('[data-testid="casahud-listing-editor-title"]') as HTMLInputElement | null;
    const imageInput = container.querySelector('[data-testid="casahud-listing-editor-image-url"]') as HTMLInputElement | null;
    expect(titleInput).not.toBeNull();
    expect(imageInput).not.toBeNull();

    await act(async () => {
      titleInput!.value = "Tropea Apartment with Manual Title";
      titleInput!.dispatchEvent(new Event("input", { bubbles: true }));
      imageInput!.value = "https://images.example.com/imported-manual.jpg";
      imageInput!.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await flush();

    await act(async () => {
      container.querySelector('[data-testid="casahud-listing-editor-save"]')?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    const propertyText = container.querySelector('[data-testid="casahud-properties"]')?.textContent || "";
    expect(propertyText).toContain("Tropea Apartment with Manual Title");
    expect(propertyText).toContain("Manual details complete");
    expect(propertyText).not.toContain("candidate listing pattern");
  });

  it("requires confirmation and deletes campaigns from the campaign list", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.includes("/api/studio/domara/integrations/status")) {
        return new Response(JSON.stringify({ ok: true, providers: connectedProviders, saveSupported: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.endsWith("/api/studio/domara/campaigns") && !init?.method) {
        return new Response(JSON.stringify({ ok: true, campaigns: [toSummary(savedCampaign)] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.endsWith(`/api/studio/domara/campaigns/${savedCampaign.id}`) && init?.method === "DELETE") {
        return new Response(JSON.stringify({ ok: true, deletedCampaignId: savedCampaign.id, message: "Campaign deleted permanently." }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      throw new Error(`Unhandled fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);
    const confirmSpy = vi.spyOn(window, "confirm");
    confirmSpy.mockReturnValueOnce(false);
    confirmSpy.mockReturnValueOnce(true);

    await act(async () => {
      root.render(<StudioDomaraClient />);
    });
    await flush();

    await act(async () => {
      container.querySelector('[data-testid="casahud-delete-campaign"]')?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    expect(
      fetchMock.mock.calls.some(
        (call) => String(call[0]).endsWith(`/api/studio/domara/campaigns/${savedCampaign.id}`) && (call[1] as RequestInit)?.method === "DELETE",
      ),
    ).toBe(false);

    await act(async () => {
      container.querySelector('[data-testid="casahud-delete-campaign"]')?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    expect(
      fetchMock.mock.calls.some(
        (call) => String(call[0]).endsWith(`/api/studio/domara/campaigns/${savedCampaign.id}`) && (call[1] as RequestInit)?.method === "DELETE",
      ),
    ).toBe(true);
    expect(container.querySelector('[data-testid="casahud-campaigns"]')?.textContent).toContain("No campaigns yet");
    expect(container.textContent || "").toContain("Campaign deleted permanently.");
  });

  it("removes imported listings from the shortlist and shows the no-real-listings state", async () => {
    const removedCampaign: CasaHudCampaign = {
      ...importedCampaign,
      status: "ready_for_property_discovery",
      listingCandidates: [],
      approvedListings: [],
      rejectedListings: [],
      listingDiscoveryStatus: "not_started",
      discoverySummary: {
        headline: "No real property listings added yet.",
        criteriaSummary: "Import listing URLs, use CasaFlix Importer, or connect a provider.",
        providerSummary: "No real property listings are currently attached to this campaign.",
        candidateCount: 0,
        liveCandidateCount: 0,
        fallbackCandidateCount: 0,
        fallbackUsed: false,
        warnings: [],
        discoveredAt: "2026-04-30T09:10:00.000Z",
      },
    };

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.includes("/api/studio/domara/integrations/status")) {
        return new Response(JSON.stringify({ ok: true, providers: connectedProviders, saveSupported: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.endsWith("/api/studio/domara/campaigns")) {
        return new Response(JSON.stringify({ ok: true, campaigns: [toSummary(importedCampaign)] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.endsWith(`/api/studio/domara/campaigns/${importedCampaign.id}`)) {
        return new Response(JSON.stringify({ ok: true, campaign: importedCampaign }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (
        url.endsWith(`/api/studio/domara/campaigns/${importedCampaign.id}/listing-candidates/${importedCampaign.listingCandidates[0]!.id}`) &&
        init?.method === "DELETE"
      ) {
        return new Response(
          JSON.stringify({
            ok: true,
            campaign: removedCampaign,
            summary: toSummary(removedCampaign),
            deletedListingId: importedCampaign.listingCandidates[0]!.id,
            message: "Removed listing from shortlist.",
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      throw new Error(`Unhandled fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(window, "confirm").mockReturnValue(true);

    await act(async () => {
      root.render(<StudioDomaraClient />);
    });
    await flush();

    await act(async () => {
      container.querySelector('[data-testid="casahud-resume-campaign"]')?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    await act(async () => {
      container.querySelector('[data-testid="casahud-nav-properties"]')?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    await act(async () => {
      container.querySelector('[data-testid="casahud-remove-listing"]')?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    const propertiesText = container.querySelector('[data-testid="casahud-properties"]')?.textContent || "";
    expect(propertiesText).toContain("No real property listings added yet");
    expect(propertiesText).not.toContain("Apartment in Tropea");
    expect(
      fetchMock.mock.calls.some(
        (call) =>
          String(call[0]).includes(`/listing-candidates/${importedCampaign.listingCandidates[0]!.id}`) &&
          (call[1] as RequestInit)?.method === "DELETE",
      ),
    ).toBe(true);
  });

  it("resumes a campaign, shows the active campaign in the sidebar, and opens the focused location workspace", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/api/studio/domara/integrations/status")) {
        return new Response(JSON.stringify({ ok: true, providers: connectedProviders, saveSupported: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.endsWith("/api/studio/domara/campaigns")) {
        return new Response(JSON.stringify({ ok: true, campaigns: [toSummary(validatedCampaign)] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.endsWith(`/api/studio/domara/campaigns/${validatedCampaign.id}`)) {
        return new Response(JSON.stringify({ ok: true, campaign: validatedCampaign }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      throw new Error(`Unhandled fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    await act(async () => {
      root.render(<StudioDomaraClient />);
    });
    await flush();

    await act(async () => {
      container.querySelector('[data-testid="casahud-resume-campaign"]')?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    expect(container.querySelector('[data-testid="casahud-current-campaign"]')?.textContent).toContain(validatedCampaign.name);
    expect(container.querySelector('[data-testid="casahud-current-campaign"]')?.textContent).toContain("Build Location");
    expect(container.querySelector('[data-testid="casahud-location"]')?.textContent).toContain("Location not ready");

    await act(async () => {
      container.querySelector('[data-testid="casahud-nav-campaigns"]')?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    expect(container.querySelector('[data-testid="casahud-campaigns"]')?.textContent).toContain(validatedCampaign.name);
    expect(container.querySelector('[data-testid="casahud-campaigns"]')?.textContent).toContain("Resume Campaign");
  });

  it("renders featured image areas for approved and rejected property cards and uses source thumbnails before fallback copy", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/api/studio/domara/integrations/status")) {
        return new Response(JSON.stringify({ ok: true, providers: connectedProviders, saveSupported: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.endsWith("/api/studio/domara/campaigns")) {
        return new Response(JSON.stringify({ ok: true, campaigns: [toSummary(validatedCampaign)] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.endsWith(`/api/studio/domara/campaigns/${validatedCampaign.id}`)) {
        return new Response(JSON.stringify({ ok: true, campaign: validatedCampaign }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      throw new Error(`Unhandled fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    await act(async () => {
      root.render(<StudioDomaraClient />);
    });
    await flush();

    await act(async () => {
      container.querySelector('[data-testid="casahud-resume-campaign"]')?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    await act(async () => {
      container.querySelector('[data-testid="casahud-nav-properties"]')?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    expect(container.querySelectorAll('[data-testid="casahud-approved-listing-card"]').length).toBe(1);
    expect(container.querySelectorAll('[data-testid="casahud-rejected-listing-card"]').length).toBe(1);
    expect(container.querySelectorAll('[data-testid="casahud-property-card-media"]').length).toBeGreaterThanOrEqual(2);
    expect(container.querySelector('[data-testid="casahud-properties"]')?.textContent).toContain("Source thumbnail");
    expect(container.querySelector('[data-testid="casahud-properties"]')?.textContent).toContain("Lecce villa with courtyard");
    expect(
      Array.from(container.querySelectorAll('[data-testid="casahud-property-card-media"]')).some(
        (node) => node.getAttribute("data-media-kind") === "thumbnail",
      ),
    ).toBe(true);
  });

  it("shows scene-based media cards, keeps review navigation accessible, and renders an honest preview-package state", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/api/studio/domara/integrations/status")) {
        return new Response(JSON.stringify({ ok: true, providers: connectedProviders, saveSupported: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.endsWith("/api/studio/domara/campaigns")) {
        return new Response(JSON.stringify({ ok: true, campaigns: [toSummary(packagedCampaign)] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.endsWith(`/api/studio/domara/campaigns/${packagedCampaign.id}`)) {
        return new Response(JSON.stringify({ ok: true, campaign: packagedCampaign }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      throw new Error(`Unhandled fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    await act(async () => {
      root.render(<StudioDomaraClient />);
    });
    await flush();

    await act(async () => {
      container.querySelector('[data-testid="casahud-resume-campaign"]')?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    await act(async () => {
      container.querySelector('[data-testid="casahud-nav-media"]')?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    expect(container.querySelectorAll('[data-testid="casahud-video-scene-card"]').length).toBeGreaterThan(1);
    expect(container.querySelector('[data-testid="casahud-media"]')?.textContent).toContain("Narration");
    expect(container.querySelector('[data-testid="casahud-media"]')?.textContent).toContain("On-screen Text");
    expect(container.querySelector('[data-testid="casahud-media"]')?.textContent).toContain("Scene 1");
    expect(container.querySelector('[data-testid="casahud-media"]')?.textContent).not.toContain("title promise");
    expect(container.querySelector('[data-testid="casahud-media"]')?.textContent).not.toContain("validation phase");

    await act(async () => {
      container.querySelector('[data-testid="casahud-nav-review"]')?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    expect(container.querySelector('[data-testid="casahud-review"]')?.textContent).toContain("Final Title");
    expect(container.querySelector('[data-testid="casahud-thumbnail-concept"]')?.textContent).toContain("Thumbnail Concept");

    await act(async () => {
      container.querySelector('[data-testid="casahud-nav-publish"]')?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    expect(container.querySelector('[data-testid="casahud-publish"]')?.textContent).toContain("Publish Now");
    expect(container.querySelector('[data-testid="casahud-publish"]')?.textContent).toContain("Schedule to YouTube");
    expect(container.querySelector('[data-testid="casahud-video-preview"]')?.textContent).toContain("Preview package");
    expect(container.querySelector('[data-testid="casahud-video-preview"]')?.textContent).toContain("not a final MP4");
    expect(container.querySelector('[data-testid="casahud-video-preview-storyboard"]')).not.toBeNull();
    expect((container.querySelector('[data-testid="casahud-publish-now-cta"]') as HTMLButtonElement | null)?.disabled).toBe(true);
  });

  it("shows storyboard preview details before render starts", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/api/studio/domara/integrations/status")) {
        return new Response(JSON.stringify({ ok: true, providers: connectedProviders, saveSupported: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.endsWith("/api/studio/domara/campaigns")) {
        return new Response(JSON.stringify({ ok: true, campaigns: [toSummary(renderPlanOnlyCampaign)] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.endsWith(`/api/studio/domara/campaigns/${renderPlanOnlyCampaign.id}`)) {
        return new Response(JSON.stringify({ ok: true, campaign: renderPlanOnlyCampaign }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      throw new Error(`Unhandled fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    await act(async () => {
      root.render(<StudioDomaraClient />);
    });
    await flush();

    await act(async () => {
      container.querySelector('[data-testid="casahud-resume-campaign"]')?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    await act(async () => {
      container.querySelector('[data-testid="casahud-nav-publish"]')?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    expect(container.querySelector('[data-testid="casahud-video-preview"]')?.textContent).toContain("Render has not started yet");
    expect(container.querySelector('[data-testid="casahud-video-preview-storyboard"]')).not.toBeNull();
  });

  it("embeds the final MP4 when it exists", async () => {
    const fetchRenderedMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/api/studio/domara/integrations/status")) {
        return new Response(JSON.stringify({ ok: true, providers: connectedProviders, saveSupported: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.endsWith("/api/studio/domara/campaigns")) {
        return new Response(JSON.stringify({ ok: true, campaigns: [toSummary(renderedCampaign)] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.endsWith(`/api/studio/domara/campaigns/${renderedCampaign.id}`)) {
        return new Response(JSON.stringify({ ok: true, campaign: renderedCampaign }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      throw new Error(`Unhandled fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchRenderedMock);

    await act(async () => {
      root.render(<StudioDomaraClient />);
    });
    await flush();

    await act(async () => {
      container.querySelector('[data-testid="casahud-resume-campaign"]')?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    await act(async () => {
      container.querySelector('[data-testid="casahud-nav-publish"]')?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    expect(container.querySelector('[data-testid="casahud-video-preview"]')?.textContent).toContain("Final MP4");
    expect(container.querySelector('[data-testid="casahud-video-preview-player"]')?.innerHTML).toContain("https://cdn.example.com/casahud/final.mp4");
  });
});
