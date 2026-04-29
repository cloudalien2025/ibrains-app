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
    summary: "CasaHUD identified the strongest relocation opportunity in Southern Italy.",
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
    detail: "Property discovery comes next.",
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
    rankingExplanation: "CasaHUD ranked the shortlist by truthfulness, price fit, and media coverage.",
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
    detail: "Location story comes next.",
    implemented: false,
  },
  updatedAt: "2026-04-28T00:25:00.000Z",
};

const importedCampaign: CasaHudCampaign = {
  ...savedCampaign,
  status: "listing_candidates_discovered",
  listingDiscoveryStatus: "listing_candidates_discovered",
  discoverySummary: {
    headline: 'Imported 1 property URL into the shortlist for "Could You Retire in Southern Italy for Under $300K?".',
    criteriaSummary: "User-provided listing URLs are ready for shortlist review and fact-checking.",
    providerSummary: "Imported URLs are clearly labeled as user-provided sources.",
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
      sourceUrl: "https://www.idealista.it/en/annuncio/123",
      sourceHost: "idealista.it",
      sourceLabel: "Idealista",
      importedAt: "2026-04-29T10:00:00.000Z",
      featuredImageUrl: "https://images.example.com/imported-og.jpg",
      metadataImageUrl: "https://images.example.com/imported-og.jpg",
      metadataTitle: "Apartment in Tropea",
      metadataDescription: "EUR 284000 apartment in Tropea with 2 bedrooms and 88 sqm.",
      canonicalUrl: "https://www.idealista.it/en/annuncio/123",
      extractionStatus: "partial",
      extractionWarnings: [],
      needsReviewFields: ["property_type"],
      title: "Apartment in Tropea",
      locationText: "Tropea",
      price: 284000,
      currency: "EUR",
      bedrooms: 2,
      bathrooms: 2,
      sizeSqm: 88,
      descriptionSnippet: "EUR 284000 apartment in Tropea with 2 bedrooms and 88 sqm.",
      features: [],
      imageUrls: ["https://images.example.com/imported-og.jpg"],
      imageCount: 1,
      photoAvailability: "limited",
      discoveredAt: "2026-04-29T10:00:00.000Z",
      preliminaryMatchNotes: "Imported from a live listing URL with enough public detail to review in the shortlist.",
    },
  ],
  updatedAt: "2026-04-29T10:00:00.000Z",
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
    summary: "CasaHUD frames the property through coastal day-to-day life instead of generic travel filler.",
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
    label: "CasaHUD script patterns",
    state: "fallback",
    configured: true,
    used: true,
    detail: "Using deterministic CasaHUD script composition.",
  },
  fullScriptText:
    "Opening Hook\nWhat does life in Southern Italy actually look like when the homes are real and the budget still matters?",
  nextPhase: {
    key: "media_planning_asset_assembly",
    label: "Media Planning and Asset Assembly",
    detail: "Build the media plan next.",
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

describe("CasaHUD command center UI", () => {
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
    vi.restoreAllMocks();
  });

  it("renders the sidebar and drawer shell with Opportunity Brief navigation and no old mock-first language", () => {
    const html = renderToStaticMarkup(<StudioDomaraClient />);

    expect(html).toContain("casahud-sidebar");
    expect(html).toContain("casahud-mobile-menu");
    expect(html).toContain(">Opportunity Brief<");
    expect(html).toContain(">Render &amp; Publish<");
    expect(html).toContain(">Connections<");
    expect(html).not.toContain(">Viral Titles<");
    expect(html).not.toContain("Generate Mock Viral Titles");
    expect(html).not.toContain("Mock-first MVP");
    expect(html).not.toContain("CasaHUD Campaign Workflow");
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

    expect(drawer?.textContent).toContain("Render & Publish");
    expect(drawer?.textContent).toContain("Connections");
    expect(scrollRegion?.className).toContain("overflow-y-auto");
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
      container.querySelector('[data-testid="casahud-nav-property_shortlist"]')?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    expect(container.querySelector('[data-testid="casahud-import-listing-urls"]')?.textContent).toContain("Import Properties From URLs");

    expect(container.querySelector('[data-testid="casahud-property-shortlist"]')?.textContent).toContain("Imported URL");
    expect(container.querySelector('[data-testid="casahud-property-shortlist"]')?.textContent).toContain("Idealista");
    expect(container.querySelector('[data-testid="casahud-property-shortlist"]')?.textContent).toContain("Imported URL image");
    expect(container.querySelector('[data-testid="casahud-property-shortlist"]')?.textContent).toContain("Property type needs review");
  });

  it("resumes a campaign, shows the active campaign in the selector, and keeps overview and location story accessible", async () => {
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
    expect(container.querySelector('[data-testid="casahud-current-campaign"]')?.textContent).toContain("Continue to Location Story");
    expect(container.querySelector('[data-testid="casahud-location-story"]')?.textContent).toContain("Location story not ready");

    await act(async () => {
      container.querySelector('[data-testid="casahud-nav-overview"]')?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    expect(container.querySelector('[data-testid="casahud-overview"]')?.textContent).toContain(validatedCampaign.name);
    expect(container.querySelector('[data-testid="casahud-overview"]')?.textContent).toContain("Workflow Progress");
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
      container.querySelector('[data-testid="casahud-nav-property_shortlist"]')?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    expect(container.querySelectorAll('[data-testid="casahud-approved-listing-card"]').length).toBe(1);
    expect(container.querySelectorAll('[data-testid="casahud-rejected-listing-card"]').length).toBe(1);
    expect(container.querySelectorAll('[data-testid="casahud-property-card-media"]').length).toBeGreaterThanOrEqual(2);
    expect(container.querySelector('[data-testid="casahud-property-shortlist"]')?.textContent).toContain("Source thumbnail");
    expect(container.querySelector('[data-testid="casahud-property-shortlist"]')?.textContent).toContain("Lecce villa with courtyard");
    expect(
      Array.from(container.querySelectorAll('[data-testid="casahud-property-card-media"]')).some(
        (node) => node.getAttribute("data-media-kind") === "thumbnail",
      ),
    ).toBe(true);
  });

  it("shows scene-based Video Builder cards, keeps package navigation accessible, and renders an honest preview-package state", async () => {
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
      container.querySelector('[data-testid="casahud-nav-video_builder"]')?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    expect(container.querySelectorAll('[data-testid="casahud-video-scene-card"]').length).toBeGreaterThan(1);
    expect(container.querySelector('[data-testid="casahud-video-builder"]')?.textContent).toContain("Narration");
    expect(container.querySelector('[data-testid="casahud-video-builder"]')?.textContent).toContain("On-screen Text");
    expect(container.querySelector('[data-testid="casahud-video-builder"]')?.textContent).toContain("Scene 1");
    expect(container.querySelector('[data-testid="casahud-video-builder"]')?.textContent).not.toContain("title promise");
    expect(container.querySelector('[data-testid="casahud-video-builder"]')?.textContent).not.toContain("validation phase");

    await act(async () => {
      container.querySelector('[data-testid="casahud-nav-youtube_package"]')?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    expect(container.querySelector('[data-testid="casahud-youtube-package"]')?.textContent).toContain("Final Title");
    expect(container.querySelector('[data-testid="casahud-thumbnail-concept"]')?.textContent).toContain("Thumbnail Concept");

    await act(async () => {
      container.querySelector('[data-testid="casahud-nav-render_publish"]')?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    expect(container.querySelector('[data-testid="casahud-render-publish"]')?.textContent).toContain("Publish Now");
    expect(container.querySelector('[data-testid="casahud-render-publish"]')?.textContent).toContain("Schedule to YouTube");
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
      container.querySelector('[data-testid="casahud-nav-render_publish"]')?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
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
      container.querySelector('[data-testid="casahud-nav-render_publish"]')?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    expect(container.querySelector('[data-testid="casahud-video-preview"]')?.textContent).toContain("Final MP4");
    expect(container.querySelector('[data-testid="casahud-video-preview-player"]')?.innerHTML).toContain("https://cdn.example.com/casahud/final.mp4");
  });
});
