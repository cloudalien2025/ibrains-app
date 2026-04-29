// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import StudioDomaraClient from "@/app/apps/studio/studio-domara-client";
import type { CasaHudCampaign } from "@/lib/studio/domara/campaigns";
import type { CasaHudOpportunityResult } from "@/lib/studio/domara/opportunity-engine/types";

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

const successOutput: CasaHudOpportunityResult = {
  generatedAt: "2026-04-28T00:00:00.000Z",
  preferredMarket: "Italian real-estate YouTube",
  researchBrief: {
    summary: "CasaHUD identified the strongest opportunity in regional affordability plus relocation intent.",
    opportunityCategories: ["affordable coastal roundups", "retirement relocation", "regional niche inventory"],
    competitorPatterns: ["Top videos frequently anchor the title with a price ceiling."],
    audienceIntent: ["buyable Italy homes", "retire in Italy"],
    suggestedTitleDirections: ["Southern Italy affordability roundups", "Question-led relocation titles"],
    riskNotes: ["Very cheap Italy claims can become hard to prove with current listings."],
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
      listingSearchHints: ["Southern Italy homes under 300k", "relocation-friendly towns"],
      reasoning: "Strong relocation intent plus a concrete budget makes this highly clickable and supportable.",
    },
    {
      id: "title-2",
      title: "7 Affordable Beachfront Homes in Southern Italy",
      score: 90,
      ctrPotential: 91,
      searchAppeal: 88,
      novelty: 79,
      realism: 89,
      listingAvailability: 90,
      channelFit: 89,
      titleTruthfulness: 91,
      campaignType: "roundup",
      regionHint: "Southern Italy",
      listingSearchHints: ["Southern Italy beachfront homes"],
      reasoning: "This roundup stays highly repeatable and keeps the geography clear.",
    },
    {
      id: "title-3",
      title: "Best Tuscany Farmhouses Under €1M",
      score: 86,
      ctrPotential: 84,
      searchAppeal: 87,
      novelty: 77,
      realism: 88,
      listingAvailability: 84,
      channelFit: 86,
      titleTruthfulness: 89,
      campaignType: "niche_category",
      regionHint: "Tuscany",
      listingSearchHints: ["Tuscany farmhouses under 1M"],
      reasoning: "The niche is strong, but the relocation hook above is broader and more viral.",
    },
  ],
  selectedTitle: {
    title: "Could You Retire in Southern Italy for Under $300K?",
    score: 92,
    campaignType: "lifestyle_relocation",
    confidence: 0.89,
    reasoning: "CasaHUD chose this title because it balances click potential with a believable promise.",
    regionHint: "Southern Italy",
    listingSearchHints: ["Southern Italy homes under 300k", "relocation-friendly towns"],
  },
  campaignTypePrediction: "lifestyle_relocation",
  titleOpportunitySummary:
    "Could You Retire in Southern Italy for Under $300K? rose to the top because it gives CasaHUD a clear, searchable concept that can still hold up when listing discovery begins.",
  confidenceSummary:
    "89% confidence. CasaHUD prefers titles that can earn clicks without forcing unsupported claims.",
  providerStatus: {
    mode: "casahud_patterns",
    label: "CasaHUD opportunity patterns",
    detail: "Using CasaHUD opportunity patterns until YouTube connection is enabled for live competitive research.",
    canImproveWithYouTube: true,
  },
  nextStep: {
    action: "create_campaign",
    label: "Create campaign",
    detail: "Phase 3 will turn this winning concept into a saved CasaHUD campaign with durable workflow state.",
  },
};

const emptyLocationState = {
  locationIntelligenceStatus: "not_started" as const,
  locationIntelligenceSummary: null,
  locationStory: null,
  localHighlights: [],
  poiBundle: null,
  mapSceneIdeas: [],
  listingLocationInsights: [],
  locationProviderStatuses: [],
  locationWarnings: [],
};

const emptyScriptState = {
  scriptGenerationStatus: "not_started" as const,
  scriptSummary: null,
  openingHook: null,
  estimatedDurationSeconds: null,
  tone: null,
  scriptSegments: [],
  propertySegments: [],
  locationLifestyleLines: [],
  transitions: [],
  closingCta: null,
  toneAndPacingNotes: [],
  scriptWarnings: [],
  scriptProviderStatus: null,
  fullScriptText: null,
};

const savedCampaign: CasaHudCampaign = {
  id: "casahud-project-phase3",
  name: "Could You Retire in Southern Italy for Under $300K?",
  selectedViralTitle: "Could You Retire in Southern Italy for Under $300K?",
  selectedTitle: successOutput.selectedTitle,
  titleCandidates: successOutput.titleCandidates,
  researchBrief: successOutput.researchBrief,
  campaignType: successOutput.campaignTypePrediction,
  marketRegionHint: "Southern Italy",
  preferredMarket: successOutput.preferredMarket,
  generationSource: successOutput.providerStatus,
  confidenceReasoning: {
    summary: successOutput.confidenceSummary,
    titleOpportunitySummary: successOutput.titleOpportunitySummary,
    selectedTitleReasoning: successOutput.selectedTitle.reasoning,
    selectedTitleConfidence: successOutput.selectedTitle.confidence,
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
  nextPhase: {
    key: "property_discovery",
    label: "Find matching properties",
    detail:
      "Property Discovery comes next. CasaHUD will translate the saved title promise into real candidate listings without regenerating the title package.",
    implemented: false,
  },
  createdAt: "2026-04-28T00:10:00.000Z",
  updatedAt: "2026-04-28T00:10:00.000Z",
  generatedAt: successOutput.generatedAt,
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

const discoveredCampaign: CasaHudCampaign = {
  ...savedCampaign,
  status: "listing_candidates_discovered",
  listingCandidates: [
    {
      id: "listing-1",
      provider: "casahud_sample",
      title: "Tropea apartment candidate",
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
      descriptionSnippet: "Candidate listing pattern with strong relocation fit.",
      features: ["budget-conscious", "move-in ready", "coastal lifestyle"],
      imageUrls: ["https://images.example.com/1.jpg"],
      imageCount: 1,
      photoAvailability: "limited",
      discoveredAt: "2026-04-28T00:20:00.000Z",
      preliminaryMatchNotes: "Fits the title promise and budget.",
    },
    {
      id: "listing-2",
      provider: "casahud_sample",
      title: "Lecce villa candidate",
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
      descriptionSnippet: "Candidate listing pattern with strong relocation fit.",
      features: ["budget-conscious", "move-in ready", "coastal lifestyle"],
      imageUrls: ["https://images.example.com/2.jpg"],
      imageCount: 1,
      photoAvailability: "limited",
      discoveredAt: "2026-04-28T00:20:00.000Z",
      preliminaryMatchNotes: "Matches the retirement angle with visual support.",
    },
  ],
  listingSearchCriteria: {
    operation: "sale",
    campaignType: "lifestyle_relocation",
    titlePromise: savedCampaign.selectedViralTitle,
    regionHint: "Southern Italy",
    country: "Italy",
    cities: ["Tropea", "Lecce", "Palermo"],
    propertyTypes: ["apartment", "villa"],
    featureTags: ["budget-conscious", "move-in ready"],
    lifestyleTags: ["retirement", "relocation"],
    searchTerms: ["Southern Italy homes under 300k"],
    pricePositioning: "affordable",
    targetListingCount: 6,
    singlePropertyFocus: false,
    maxPrice: 300000,
    currency: "USD",
  },
  listingProviderStatuses: [
    {
      provider: "idealista",
      label: "Idealista",
      state: "missing_credentials",
      configured: false,
      used: false,
      candidateCount: 0,
      detail: "Idealista is not connected yet. CasaHUD can still prepare candidate properties with sample listing patterns.",
      warning: "Connect Idealista to search live listings.",
    },
    {
      provider: "casahud_sample",
      label: "CasaHUD sample listing patterns",
      state: "fallback",
      configured: true,
      used: true,
      candidateCount: 2,
      detail: "Using CasaHUD sample listing patterns until listing sources are connected.",
      warning: "Connect Idealista or Immobiliare to search live listings.",
    },
  ],
  discoverySummary: {
    headline: `Prepared 2 candidate properties for "${savedCampaign.selectedViralTitle}".`,
    criteriaSummary: "Searching sale listings around Southern Italy up to USD 300,000, focused on budget-conscious and move-in ready properties.",
    providerSummary: "Using CasaHUD sample listing patterns until listing sources are connected.",
    candidateCount: 2,
    liveCandidateCount: 0,
    fallbackCandidateCount: 2,
    fallbackUsed: true,
    warnings: ["Using CasaHUD sample listing patterns until listing sources are connected."],
    discoveredAt: "2026-04-28T00:20:00.000Z",
  },
  listingDiscoveryStatus: "listing_candidates_discovered",
  approvedListings: [],
  rejectedListings: [],
  listingRankOrder: [],
  listingValidationStatus: "not_started",
  listingValidationSummary: null,
  titleSupportConfidence: null,
  validationWarnings: [],
  ...emptyLocationState,
  nextPhase: {
    key: "listing_validation",
    label: "Validate and rank listings",
    detail:
      "Validation and ranking arrive next. CasaHUD will confirm which discovered candidates truly support the title promise.",
    implemented: false,
  },
  updatedAt: "2026-04-28T00:20:00.000Z",
};

const validatedCampaign: CasaHudCampaign = {
  ...discoveredCampaign,
  status: "listing_candidates_validated",
  approvedListings: [
    {
      ...discoveredCampaign.listingCandidates[0]!,
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
      validationReasons: [
        "Location aligns with the campaign region.",
        "Price supports the title budget claim.",
        "Property type fits the selected title angle.",
      ],
      warnings: [],
      rank: 1,
      duplicateGroupKey: "listing-1",
    },
  ],
  rejectedListings: [
    {
      ...discoveredCampaign.listingCandidates[1]!,
      validationStatus: "needs_attention",
      overallScore: 63,
      scoreBreakdown: {
        titleMatchScore: 58,
        geographyScore: 86,
        priceFitScore: 100,
        propertyTypeScore: 100,
        featureClaimScore: 42,
        mediaAvailabilityScore: 52,
        listingCompletenessScore: 78,
        providerQualityScore: 64,
        uniquenessScore: 100,
        overallScore: 63,
      },
      validationReasons: [
        "Location aligns with the campaign region.",
        "Price supports the title budget claim.",
        "Feature support is thin for this title.",
      ],
      warnings: ["Some listings are plausible but still need review before CasaHUD can rely on them."],
      rejectionCategory: "weak_support",
      duplicateGroupKey: "listing-2",
    },
  ],
  listingRankOrder: ["listing-1"],
  listingValidationStatus: "listing_candidates_validated",
  listingValidationSummary: {
    headline: "Approved 1 of 2 discovered listings for the title promise.",
    rankingExplanation:
      "CasaHUD ranked the shortlist by title truthfulness, geography fit, price support, feature alignment, media coverage, and duplicate reduction.",
    discoveredCount: 2,
    approvedCount: 1,
    rejectedCount: 1,
    needsAttentionCount: 1,
    titleSupportConfidence: 74,
    warnings: [
      "The discovered listings only partially support the title promise. Review the rejected listings or rerun property discovery before moving forward.",
    ],
    completedAt: "2026-04-28T00:25:00.000Z",
  },
  titleSupportConfidence: 74,
  validationWarnings: [
    "The discovered listings only partially support the title promise. Review the rejected listings or rerun property discovery before moving forward.",
    "Some listings are plausible but still need review before CasaHUD can rely on them.",
  ],
  ...emptyLocationState,
  nextPhase: {
    key: "location_intelligence",
    label: "Location Intelligence",
    detail:
      "Location Intelligence comes next. CasaHUD will explain why the strongest validated properties work through area and map context.",
    implemented: false,
  },
  updatedAt: "2026-04-28T00:25:00.000Z",
  futureState: {
    ...discoveredCampaign.futureState,
    approvedListings: [],
    rejectedListings: [],
    listingRankOrder: ["listing-1"],
  },
};

const locationRichCampaign: CasaHudCampaign = {
  ...validatedCampaign,
  status: "location_intelligence_completed",
  locationIntelligenceStatus: "location_intelligence_completed",
  locationIntelligenceSummary: {
    headline: "Location story prepared across 1 shortlist anchor.",
    providerSummary: "Using CasaHUD location patterns until Google Places or Mapbox has full live coverage.",
    coverageSummary: "CasaHUD connected Tropea to local proof points, regional lifestyle context, and map scene ideas.",
    warningCount: 1,
    generatedAt: "2026-04-29T00:00:00.000Z",
    fallbackUsed: true,
  },
  locationStory: {
    headline: "Tropea turns the shortlist into a place-led story.",
    summary: "CasaHUD positioned the approved property around coastal context and everyday convenience so the campaign reads as property plus place.",
    narrativeAngles: [
      "Open with the region before dropping into the strongest listing.",
      "Use local proof points as support for the property promise instead of generic travel filler.",
    ],
    lifestyleAnchors: ["Waterside lifestyle context", "Travel-friendly arrival story"],
    regionHighlights: ["Tropea", "Calabria"],
    fallbackNotice: "Using CasaHUD location patterns where live provider coverage was limited.",
  },
  localHighlights: [
    {
      id: "highlight-1",
      title: "Regional anchor",
      description: "Tropea gives the campaign a specific place identity instead of a generic property roundup.",
      locationText: "Tropea, Calabria, Italy",
      associatedListingId: "listing-1",
      provider: "casahud_location_patterns",
      sourceConfidence: "fallback",
    },
  ],
  poiBundle: {
    summary: "3 location proof points prepared for the approved shortlist.",
    cards: [
      {
        id: "poi-1",
        name: "Coastal access context",
        category: "Beach",
        locationText: "Tropea, Calabria, Italy",
        associatedListingId: "listing-1",
        relevanceReason: "Helps the shortlist read as a day-to-day coastal lifestyle story instead of a price-only claim.",
        provider: "casahud_location_patterns",
        sourceConfidence: "fallback",
      },
    ],
    categories: ["Beach"],
    generatedAt: "2026-04-29T00:00:00.000Z",
  },
  mapSceneIdeas: [
    {
      id: "scene-1",
      title: "Open on Tropea",
      sceneType: "regional_anchor",
      description: "Start with the region around Tropea to establish the place before the property details arrive.",
      locationText: "Tropea, Calabria, Italy",
      suggestedVisual: "Wide regional map pull-back with the strongest listing location highlighted first.",
      provider: "casahud_location_patterns",
      confidence: "fallback",
    },
  ],
  listingLocationInsights: [
    {
      listingId: "listing-1",
      summary: "Tropea apartment with sea views plays best as a waterside lifestyle story around Tropea, Calabria, Italy.",
      highlights: ["Coastal day-to-day context helps the property feel like a lifestyle move, not just a budget win."],
      nearbyPois: [],
      locationStrengths: ["Waterside lifestyle context"],
      warnings: ["Using CasaHUD location patterns until Google Places is connected."],
    },
  ],
  locationProviderStatuses: [
    {
      provider: "google_places",
      label: "Google Places",
      state: "missing_credentials",
      configured: false,
      used: false,
      detail: "Using CasaHUD location patterns until Google Places is connected for live POIs.",
      warning: "Connect Google Places for live points of interest and local highlights.",
      coverage: "No live POIs",
    },
    {
      provider: "mapbox",
      label: "Mapbox",
      state: "missing_credentials",
      configured: false,
      used: false,
      detail: "Using listing coordinates and CasaHUD location patterns until Mapbox is connected for live map anchoring.",
      warning: "Connect Mapbox for live geocoding and richer map scene anchoring.",
      coverage: "No live map anchoring",
    },
    {
      provider: "casahud_location_patterns",
      label: "CasaHUD location patterns",
      state: "fallback",
      configured: true,
      used: true,
      detail: "Using CasaHUD location patterns until Google Places or Mapbox has full live coverage.",
      warning: "Connect location providers for live POIs and richer map context.",
      coverage: "1 fallback context set",
    },
  ],
  locationWarnings: ["Using CasaHUD location patterns until Google Places is connected."],
  nextPhase: {
    key: "script_narrative_generation",
    label: "Script and Narrative Generation",
    detail:
      "Script and Narrative Generation comes next. CasaHUD will turn the validated property story and location intelligence into the video narrative package.",
    implemented: false,
  },
  updatedAt: "2026-04-29T00:00:00.000Z",
  futureState: {
    ...validatedCampaign.futureState,
    locationIntelligence: {
      status: "location_intelligence_completed",
      storyHeadline: "Tropea turns the shortlist into a place-led story.",
      generatedAt: "2026-04-29T00:00:00.000Z",
    },
    mapPoiBundle: {
      summary: "3 location proof points prepared for the approved shortlist.",
      cards: [],
      categories: ["Beach"],
      generatedAt: "2026-04-29T00:00:00.000Z",
    },
  },
};

const scriptedCampaign: CasaHudCampaign = {
  ...locationRichCampaign,
  status: "script_narrative_completed",
  scriptGenerationStatus: "script_generated",
  scriptSummary:
    "A relocation-oriented narrative that uses the validated shortlist and place story to turn the title into a believable daily-life video concept.",
  openingHook:
    "If this title is going to resonate, the opening has to answer one question fast: what does life in Southern Italy actually look like when the homes are real and the budget still matters?",
  estimatedDurationSeconds: 104,
  tone: "Premium, clear, cinematic where appropriate, and tightly grounded in validated property and location support.",
  scriptSegments: [
    {
      id: "segment-hook",
      title: "Opening Hook",
      segmentType: "hook",
      narration:
        "If this title is going to resonate, the opening has to answer one question fast: what does life in Southern Italy actually look like when the homes are real and the budget still matters?",
      durationSeconds: 14,
      visualNote: "Open on the strongest place anchor before dropping into the listing.",
    },
    {
      id: "segment-location",
      title: "Location Story",
      segmentType: "location_context",
      narration: "Lead the place story through Tropea and Calabria before drilling into property specifics.",
      durationSeconds: 14,
      visualNote: "Reuse the Phase 6 map scene idea at a high level only.",
    },
    {
      id: "segment-property",
      title: "Property 1: Tropea apartment with sea views",
      segmentType: "property_focus",
      narration:
        "Tropea apartment with sea views in Tropea, Calabria, Italy keeps the segment grounded with USD 284,000, apartment, 2 bedrooms, 2 bathrooms, 88 sqm, Tropea. Move-in ready apartment with sea views and retirement appeal.",
      durationSeconds: 24,
      associatedListingId: "listing-1",
      visualNote: "Keep the segment anchored to verified listing facts and location support.",
    },
    {
      id: "segment-closing",
      title: "Closing CTA",
      segmentType: "closing_cta",
      narration:
        "Close by summarizing who this move feels best suited for, then invite the viewer to follow for the next relocation-focused shortlist.",
      durationSeconds: 12,
      visualNote: "End on a clean editorial CTA and hand forward to media planning.",
    },
  ],
  propertySegments: [
    {
      listingId: "listing-1",
      title: "Tropea apartment with sea views",
      locationText: "Tropea, Calabria, Italy",
      narration:
        "Tropea apartment with sea views in Tropea, Calabria, Italy keeps the segment grounded with USD 284,000, apartment, 2 bedrooms, 2 bathrooms, 88 sqm, Tropea. Move-in ready apartment with sea views and retirement appeal. On the location side, Tropea apartment with sea views plays best as a waterside lifestyle story around Tropea, Calabria, Italy.",
      whyItMadeTheCut: "It gives the relocation story a believable mix of budget, livability, and location context.",
      supportedFacts: ["USD 284,000", "apartment", "2 bedrooms", "2 bathrooms", "88 sqm", "Tropea"],
      locationLine: "Tropea apartment with sea views plays best as a waterside lifestyle story around Tropea, Calabria, Italy.",
      caution: "Using CasaHUD location patterns until Google Places is connected.",
    },
  ],
  locationLifestyleLines: [
    "Lead the place story through Tropea and Calabria before drilling into property specifics.",
    "Keep the lifestyle framing tied to Waterside lifestyle context and Travel-friendly arrival story rather than generic travel copy.",
  ],
  transitions: [
    "Bridge the property segment through daily-life fit so the relocation story keeps moving without restarting the thesis.",
  ],
  closingCta:
    "Close by summarizing who this move feels best suited for, then invite the viewer to follow for the next relocation-focused shortlist.",
  toneAndPacingNotes: [
    "Keep the delivery premium and clear; cinematic phrasing is fine, but every claim still needs to trace back to validated listing or location support.",
    "Move quickly through verified facts first, then let the lifestyle and location framing add texture instead of replacing substance.",
  ],
  scriptWarnings: [
    "Title support is moderate at 74%, so avoid overcommitting the hook beyond what the validated listings prove.",
    "Location storytelling uses fallback or incomplete provider coverage, so the narration should avoid live-distance, venue-recency, or inventory-freshness claims.",
  ],
  scriptProviderStatus: {
    provider: "casahud_script_patterns",
    label: "CasaHUD script patterns",
    state: "fallback",
    configured: true,
    used: true,
    detail:
      "Using deterministic CasaHUD script composition generated from validated listings and saved location intelligence at 2026-04-29T00:10:00.000Z.",
    warning:
      "Title support is moderate at 74%, so avoid overcommitting the hook beyond what the validated listings prove.",
  },
  fullScriptText:
    "Opening Hook\nIf this title is going to resonate, the opening has to answer one question fast: what does life in Southern Italy actually look like when the homes are real and the budget still matters?\n\nLocation Story\nLead the place story through Tropea and Calabria before drilling into property specifics.",
  nextPhase: {
    key: "media_planning_asset_assembly",
    label: "Media Planning and Asset Assembly",
    detail:
      "Media Planning and Asset Assembly comes next. CasaHUD will organize visuals, map scenes, and asset needs around the approved narrative package.",
    implemented: false,
  },
  updatedAt: "2026-04-29T00:10:00.000Z",
  futureState: {
    ...locationRichCampaign.futureState,
    script: {
      status: "script_generated",
      summary:
        "A relocation-oriented narrative that uses the validated shortlist and place story to turn the title into a believable daily-life video concept.",
    },
  },
};

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("CasaHUD opportunity UI flow", () => {
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

  it("clicking Generate Viral Video Title shows the Phase 2 result state with a winning title and ranked candidates", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/api/studio/domara/integrations/status")) {
        return new Response(JSON.stringify({ ok: true, providers: [], saveSupported: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.includes("/api/studio/domara/campaigns")) {
        return new Response(JSON.stringify({ ok: true, campaigns: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.includes("/api/studio/domara/opportunity")) {
        return new Response(JSON.stringify({ ok: true, output: successOutput }), {
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

    const button = container.querySelector('[data-testid="casahud-generate-cta"]');
    expect(button).not.toBeNull();

    await act(async () => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    expect(container.querySelector('[data-testid="casahud-opportunity-results"]')?.textContent).toContain(
      successOutput.selectedTitle.title,
    );
    expect(container.querySelectorAll('[data-testid="casahud-candidate-card"]').length).toBe(3);
    expect(container.textContent).toContain("Researching YouTube opportunities");
    expect(container.textContent).toContain("Why this title was chosen");
    expect(container.textContent).toContain("Create Campaign");
    expect(container.querySelector('[data-testid="casahud-create-campaign-cta"]')?.textContent).toContain("Create Campaign");
    expect(container.textContent).toContain(`Campaign name: ${successOutput.selectedTitle.title}`);
  });

  it("creates a saved campaign, shows it in Recent Campaigns, and reopens it without regenerating titles", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method || "GET";

      if (url.includes("/api/studio/domara/integrations/status")) {
        return new Response(JSON.stringify({ ok: true, providers: [], saveSupported: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.endsWith("/api/studio/domara/campaigns") && method === "GET") {
        return new Response(JSON.stringify({ ok: true, campaigns: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.endsWith("/api/studio/domara/opportunity")) {
        return new Response(JSON.stringify({ ok: true, output: successOutput }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.endsWith("/api/studio/domara/campaigns") && method === "POST") {
        return new Response(
          JSON.stringify({
            ok: true,
            campaign: savedCampaign,
            summary: {
              id: savedCampaign.id,
              name: savedCampaign.name,
              campaignType: savedCampaign.campaignType,
              marketRegionHint: savedCampaign.marketRegionHint,
              status: savedCampaign.status,
              createdAt: savedCampaign.createdAt,
              updatedAt: savedCampaign.updatedAt,
              researchSummary: savedCampaign.researchBrief.summary,
              listingCandidateCount: 0,
              listingDiscoveryStatus: "not_started",
              approvedListingCount: 0,
              listingValidationStatus: "not_started",
              locationIntelligenceStatus: "not_started",
              scriptGenerationStatus: "not_started",
            },
            message: `Campaign saved. "${savedCampaign.name}" is ready for Property Discovery.`,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      if (url.endsWith(`/api/studio/domara/campaigns/${savedCampaign.id}`)) {
        return new Response(JSON.stringify({ ok: true, campaign: savedCampaign }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      throw new Error(`Unhandled fetch: ${method} ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    await act(async () => {
      root.render(<StudioDomaraClient />);
    });
    await flush();

    const generateButton = container.querySelector('[data-testid="casahud-generate-cta"]');
    await act(async () => {
      generateButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    const createButton = container.querySelector('[data-testid="casahud-create-campaign-cta"]');
    expect(createButton).not.toBeNull();

    await act(async () => {
      createButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    expect(container.querySelector('[data-testid="casahud-campaign-detail"]')?.textContent).toContain(savedCampaign.name);
    expect(container.querySelector('[data-testid="casahud-campaign-create-success"]')?.textContent).toContain(
      "ready for Property Discovery",
    );
    expect(container.querySelector('[data-testid="casahud-recent-campaigns"]')?.textContent).toContain(savedCampaign.name);
    expect(container.querySelector('[data-testid="casahud-recent-campaigns"]')?.textContent).toContain("Resume");
    expect(container.textContent).toContain("Next: Find matching properties");

    const resumeButton = container.querySelector('[data-testid="casahud-resume-campaign"]');
    expect(resumeButton).not.toBeNull();
    await act(async () => {
      resumeButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    expect(container.querySelector('[data-testid="casahud-campaign-detail"]')?.textContent).toContain(
      savedCampaign.selectedViralTitle,
    );
    expect(container.querySelector('[data-testid="casahud-opportunity-results"]')).toBeNull();
  });

  it("shows property discovery progress and persists candidate listing cards on the reopened campaign", async () => {
    let resolveDiscovery: ((response: Response) => void) | null = null;

    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method || "GET";

      if (url.includes("/api/studio/domara/integrations/status")) {
        return Promise.resolve(
          new Response(JSON.stringify({ ok: true, providers: [], saveSupported: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }

      if (url.endsWith("/api/studio/domara/campaigns") && method === "GET") {
        return Promise.resolve(new Response(JSON.stringify({ ok: true, campaigns: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }));
      }

      if (url.endsWith("/api/studio/domara/opportunity")) {
        return Promise.resolve(
          new Response(JSON.stringify({ ok: true, output: successOutput }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }

      if (url.endsWith("/api/studio/domara/campaigns") && method === "POST") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              ok: true,
              campaign: savedCampaign,
              summary: {
                id: savedCampaign.id,
                name: savedCampaign.name,
                campaignType: savedCampaign.campaignType,
                marketRegionHint: savedCampaign.marketRegionHint,
                status: savedCampaign.status,
                createdAt: savedCampaign.createdAt,
                updatedAt: savedCampaign.updatedAt,
              researchSummary: savedCampaign.researchBrief.summary,
              listingCandidateCount: 0,
              listingDiscoveryStatus: "not_started",
              approvedListingCount: 0,
              listingValidationStatus: "not_started",
              locationIntelligenceStatus: "not_started",
              scriptGenerationStatus: "not_started",
            },
              message: `Campaign saved. "${savedCampaign.name}" is ready for Property Discovery.`,
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          ),
        );
      }

      if (url.endsWith(`/api/studio/domara/campaigns/${savedCampaign.id}/discover-listings`) && method === "POST") {
        return new Promise<Response>((resolve) => {
          resolveDiscovery = resolve;
        });
      }

      if (url.endsWith(`/api/studio/domara/campaigns/${savedCampaign.id}`)) {
        return Promise.resolve(
          new Response(JSON.stringify({ ok: true, campaign: discoveredCampaign }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }

      throw new Error(`Unhandled fetch: ${method} ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    await act(async () => {
      root.render(<StudioDomaraClient />);
    });
    await flush();

    const generateButton = container.querySelector('[data-testid="casahud-generate-cta"]');
    await act(async () => {
      generateButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    const createButton = container.querySelector('[data-testid="casahud-create-campaign-cta"]');
    await act(async () => {
      createButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    const discoverButton = container.querySelector('[data-testid="casahud-discover-listings-cta"]');
    expect(discoverButton?.textContent).toContain("Find Matching Properties");

    await act(async () => {
      discoverButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    expect(container.querySelector('[data-testid="casahud-discovery-progress"]')?.textContent).toContain(
      "Reading campaign title promise",
    );
    expect(container.textContent).toContain("Building listing search criteria");

    await act(async () => {
      resolveDiscovery?.(
        new Response(
          JSON.stringify({
            ok: true,
            campaign: discoveredCampaign,
            summary: {
              id: discoveredCampaign.id,
              name: discoveredCampaign.name,
              campaignType: discoveredCampaign.campaignType,
              marketRegionHint: discoveredCampaign.marketRegionHint,
              status: discoveredCampaign.status,
              createdAt: discoveredCampaign.createdAt,
              updatedAt: discoveredCampaign.updatedAt,
              researchSummary: discoveredCampaign.researchBrief.summary,
              listingCandidateCount: discoveredCampaign.listingCandidates.length,
              listingDiscoveryStatus: discoveredCampaign.listingDiscoveryStatus,
              approvedListingCount: 0,
              listingValidationStatus: "not_started",
              locationIntelligenceStatus: "not_started",
              scriptGenerationStatus: "not_started",
              discoverySummary: discoveredCampaign.discoverySummary?.headline,
            },
            message: `Property discovery complete. "${discoveredCampaign.name}" is ready for listing validation.`,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );
    });
    await flush();

    expect(container.querySelectorAll('[data-testid="casahud-listing-candidate-card"]').length).toBe(2);
    expect(container.querySelector('[data-testid="casahud-listing-candidates"]')?.textContent).toContain(
      "Using CasaHUD sample listing patterns until listing sources are connected.",
    );
    expect(container.textContent).toContain("Next: Validate and rank listings");
    expect(container.textContent).toContain("Tropea apartment candidate");
    expect(container.textContent).toContain("Connect Idealista or Immobiliare to search live listings.");
  });

  it("shows listing validation progress and persists approved and rejected results on the campaign", async () => {
    let resolveValidation: ((response: Response) => void) | null = null;

    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method || "GET";

      if (url.includes("/api/studio/domara/integrations/status")) {
        return Promise.resolve(
          new Response(JSON.stringify({ ok: true, providers: [], saveSupported: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }

      if (url.endsWith("/api/studio/domara/campaigns") && method === "GET") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              ok: true,
              campaigns: [
                {
                  id: discoveredCampaign.id,
                  name: discoveredCampaign.name,
                  campaignType: discoveredCampaign.campaignType,
                  marketRegionHint: discoveredCampaign.marketRegionHint,
                  status: discoveredCampaign.status,
                  createdAt: discoveredCampaign.createdAt,
                  updatedAt: discoveredCampaign.updatedAt,
                  researchSummary: discoveredCampaign.researchBrief.summary,
                  listingCandidateCount: discoveredCampaign.listingCandidates.length,
                  listingDiscoveryStatus: discoveredCampaign.listingDiscoveryStatus,
                  approvedListingCount: 0,
                  listingValidationStatus: "not_started",
                  locationIntelligenceStatus: "not_started",
                  scriptGenerationStatus: "not_started",
                  discoverySummary: discoveredCampaign.discoverySummary?.headline,
                },
              ],
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          ),
        );
      }

      if (url.endsWith(`/api/studio/domara/campaigns/${discoveredCampaign.id}`)) {
        return Promise.resolve(
          new Response(JSON.stringify({ ok: true, campaign: discoveredCampaign }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }

      if (url.endsWith(`/api/studio/domara/campaigns/${discoveredCampaign.id}/validate-listings`) && method === "POST") {
        return new Promise<Response>((resolve) => {
          resolveValidation = resolve;
        });
      }

      throw new Error(`Unhandled fetch: ${method} ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    await act(async () => {
      root.render(<StudioDomaraClient />);
    });
    await flush();

    const resumeButton = container.querySelector('[data-testid="casahud-resume-campaign"]');
    await act(async () => {
      resumeButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    const validateButton = container.querySelector('[data-testid="casahud-validate-listings-cta"]');
    expect(validateButton?.textContent).toContain("Validate and Rank Listings");

    await act(async () => {
      validateButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    expect(container.querySelector('[data-testid="casahud-validation-progress"]')?.textContent).toContain(
      "Checking title truthfulness",
    );
    expect(container.textContent).toContain("Removing duplicate listings");

    await act(async () => {
      resolveValidation?.(
        new Response(
          JSON.stringify({
            ok: true,
            campaign: validatedCampaign,
            summary: {
              id: validatedCampaign.id,
              name: validatedCampaign.name,
              campaignType: validatedCampaign.campaignType,
              marketRegionHint: validatedCampaign.marketRegionHint,
              status: validatedCampaign.status,
              createdAt: validatedCampaign.createdAt,
              updatedAt: validatedCampaign.updatedAt,
              researchSummary: validatedCampaign.researchBrief.summary,
              listingCandidateCount: validatedCampaign.listingCandidates.length,
              listingDiscoveryStatus: validatedCampaign.listingDiscoveryStatus,
              approvedListingCount: validatedCampaign.approvedListings.length,
              listingValidationStatus: validatedCampaign.listingValidationStatus,
              locationIntelligenceStatus: "not_started",
              scriptGenerationStatus: "not_started",
              titleSupportConfidence: validatedCampaign.titleSupportConfidence ?? undefined,
              discoverySummary: validatedCampaign.discoverySummary?.headline,
              validationSummary: validatedCampaign.listingValidationSummary?.headline,
            },
            message: `Listing validation complete. "${validatedCampaign.name}" is ready for Location Intelligence.`,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );
    });
    await flush();

    expect(container.querySelector('[data-testid="casahud-validation-summary"]')?.textContent).toContain(
      "Approved 1 of 2 discovered listings for the title promise.",
    );
    expect(container.querySelectorAll('[data-testid="casahud-approved-listing-card"]').length).toBe(1);
    expect(container.querySelectorAll('[data-testid="casahud-rejected-listing-card"]').length).toBe(1);
    expect(container.textContent).toContain("Next: Location Intelligence");
    expect(container.textContent).toContain("Title support confidence: 74%");
    expect(container.querySelector('[data-testid="casahud-recent-campaigns"]')?.textContent).toContain("1 approved");
    expect(container.querySelector('[data-testid="casahud-location-intelligence-cta"]')?.textContent).toContain(
      "Add Location Intelligence",
    );
  });

  it("shows location intelligence progress and renders the saved place story after enrichment", async () => {
    let resolveLocationIntelligence: ((response: Response) => void) | null = null;

    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method || "GET";

      if (url.includes("/api/studio/domara/integrations/status")) {
        return Promise.resolve(
          new Response(JSON.stringify({ ok: true, providers: [], saveSupported: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }

      if (url.endsWith("/api/studio/domara/campaigns") && method === "GET") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              ok: true,
              campaigns: [
                {
                  id: validatedCampaign.id,
                  name: validatedCampaign.name,
                  campaignType: validatedCampaign.campaignType,
                  marketRegionHint: validatedCampaign.marketRegionHint,
                  status: validatedCampaign.status,
                  createdAt: validatedCampaign.createdAt,
                  updatedAt: validatedCampaign.updatedAt,
                  researchSummary: validatedCampaign.researchBrief.summary,
                  listingCandidateCount: validatedCampaign.listingCandidates.length,
                  listingDiscoveryStatus: validatedCampaign.listingDiscoveryStatus,
                  approvedListingCount: validatedCampaign.approvedListings.length,
                  listingValidationStatus: validatedCampaign.listingValidationStatus,
                  locationIntelligenceStatus: "not_started",
                  scriptGenerationStatus: "not_started",
                  titleSupportConfidence: validatedCampaign.titleSupportConfidence ?? undefined,
                  validationSummary: validatedCampaign.listingValidationSummary?.headline,
                },
              ],
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          ),
        );
      }

      if (url.endsWith(`/api/studio/domara/campaigns/${validatedCampaign.id}`)) {
        return Promise.resolve(
          new Response(JSON.stringify({ ok: true, campaign: validatedCampaign }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }

      if (url.endsWith(`/api/studio/domara/campaigns/${validatedCampaign.id}/location-intelligence`) && method === "POST") {
        return new Promise<Response>((resolve) => {
          resolveLocationIntelligence = resolve;
        });
      }

      throw new Error(`Unhandled fetch: ${method} ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    await act(async () => {
      root.render(<StudioDomaraClient />);
    });
    await flush();

    const resumeButton = container.querySelector('[data-testid="casahud-resume-campaign"]');
    await act(async () => {
      resumeButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    const locationButton = container.querySelector('[data-testid="casahud-location-intelligence-cta"]');
    expect(locationButton?.textContent).toContain("Add Location Intelligence");

    await act(async () => {
      locationButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    expect(container.querySelector('[data-testid="casahud-location-progress"]')?.textContent).toContain(
      "Reading approved property locations",
    );
    expect(container.textContent).toContain("Preparing map scene ideas");

    await act(async () => {
      resolveLocationIntelligence?.(
        new Response(
          JSON.stringify({
            ok: true,
            campaign: locationRichCampaign,
            summary: {
              id: locationRichCampaign.id,
              name: locationRichCampaign.name,
              campaignType: locationRichCampaign.campaignType,
              marketRegionHint: locationRichCampaign.marketRegionHint,
              status: locationRichCampaign.status,
              createdAt: locationRichCampaign.createdAt,
              updatedAt: locationRichCampaign.updatedAt,
              researchSummary: locationRichCampaign.researchBrief.summary,
              listingCandidateCount: locationRichCampaign.listingCandidates.length,
              listingDiscoveryStatus: locationRichCampaign.listingDiscoveryStatus,
              approvedListingCount: locationRichCampaign.approvedListings.length,
              listingValidationStatus: locationRichCampaign.listingValidationStatus,
              locationIntelligenceStatus: "location_intelligence_completed",
              scriptGenerationStatus: "not_started",
              titleSupportConfidence: locationRichCampaign.titleSupportConfidence ?? undefined,
              validationSummary: locationRichCampaign.listingValidationSummary?.headline,
              locationSummary: locationRichCampaign.locationIntelligenceSummary?.headline,
            },
            message: `Location intelligence complete. "${locationRichCampaign.name}" now includes place story, POIs, and map scene ideas.`,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );
    });
    await flush();

    expect(container.querySelector('[data-testid="casahud-location-intelligence-summary"]')?.textContent).toContain(
      "Location story prepared across 1 shortlist anchor.",
    );
    expect(container.querySelector('[data-testid="casahud-location-story"]')?.textContent).toContain(
      "Tropea turns the shortlist into a place-led story.",
    );
    expect(container.querySelector('[data-testid="casahud-local-highlights"]')?.textContent).toContain("Regional anchor");
    expect(container.querySelector('[data-testid="casahud-poi-bundle"]')?.textContent).toContain("Coastal access context");
    expect(container.querySelector('[data-testid="casahud-map-scene-ideas"]')?.textContent).toContain("Open on Tropea");
    expect(container.querySelector('[data-testid="casahud-listing-location-insights"]')?.textContent).toContain(
      "Tropea apartment with sea views plays best",
    );
    expect(container.querySelector('[data-testid="casahud-location-provider-statuses"]')?.textContent).toContain(
      "CasaHUD location patterns",
    );
    expect(container.querySelector('[data-testid="casahud-generate-script-cta"]')?.textContent).toContain(
      "Generate Script",
    );
    expect(container.querySelector('[data-testid="casahud-recent-campaigns"]')?.textContent).toContain("Location story ready");
  });

  it("shows script generation progress and renders the saved narrative package after generation", async () => {
    let resolveScript: ((response: Response) => void) | null = null;

    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method || "GET";

      if (url.includes("/api/studio/domara/integrations/status")) {
        return Promise.resolve(
          new Response(JSON.stringify({ ok: true, providers: [], saveSupported: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }

      if (url.endsWith("/api/studio/domara/campaigns") && method === "GET") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              ok: true,
              campaigns: [
                {
                  id: locationRichCampaign.id,
                  name: locationRichCampaign.name,
                  campaignType: locationRichCampaign.campaignType,
                  marketRegionHint: locationRichCampaign.marketRegionHint,
                  status: locationRichCampaign.status,
                  createdAt: locationRichCampaign.createdAt,
                  updatedAt: locationRichCampaign.updatedAt,
                  researchSummary: locationRichCampaign.researchBrief.summary,
                  listingCandidateCount: locationRichCampaign.listingCandidates.length,
                  listingDiscoveryStatus: locationRichCampaign.listingDiscoveryStatus,
                  approvedListingCount: locationRichCampaign.approvedListings.length,
                  listingValidationStatus: locationRichCampaign.listingValidationStatus,
                  locationIntelligenceStatus: "location_intelligence_completed",
                  scriptGenerationStatus: "not_started",
                  titleSupportConfidence: locationRichCampaign.titleSupportConfidence ?? undefined,
                  validationSummary: locationRichCampaign.listingValidationSummary?.headline,
                  locationSummary: locationRichCampaign.locationIntelligenceSummary?.headline,
                },
              ],
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          ),
        );
      }

      if (url.endsWith(`/api/studio/domara/campaigns/${locationRichCampaign.id}`)) {
        return Promise.resolve(
          new Response(JSON.stringify({ ok: true, campaign: locationRichCampaign }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }

      if (url.endsWith(`/api/studio/domara/campaigns/${locationRichCampaign.id}/script`) && method === "POST") {
        return new Promise<Response>((resolve) => {
          resolveScript = resolve;
        });
      }

      throw new Error(`Unhandled fetch: ${method} ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    await act(async () => {
      root.render(<StudioDomaraClient />);
    });
    await flush();

    const resumeButton = container.querySelector('[data-testid="casahud-resume-campaign"]');
    await act(async () => {
      resumeButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    const scriptButton = container.querySelector('[data-testid="casahud-generate-script-cta"]');
    expect(scriptButton?.textContent).toContain("Generate Script");

    await act(async () => {
      scriptButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    expect(container.querySelector('[data-testid="casahud-script-progress"]')?.textContent).toContain(
      "Building the opening hook",
    );
    expect(container.textContent).toContain("Preparing review-ready script");

    await act(async () => {
      resolveScript?.(
        new Response(
          JSON.stringify({
            ok: true,
            campaign: scriptedCampaign,
            summary: {
              id: scriptedCampaign.id,
              name: scriptedCampaign.name,
              campaignType: scriptedCampaign.campaignType,
              marketRegionHint: scriptedCampaign.marketRegionHint,
              status: scriptedCampaign.status,
              createdAt: scriptedCampaign.createdAt,
              updatedAt: scriptedCampaign.updatedAt,
              researchSummary: scriptedCampaign.researchBrief.summary,
              listingCandidateCount: scriptedCampaign.listingCandidates.length,
              listingDiscoveryStatus: scriptedCampaign.listingDiscoveryStatus,
              approvedListingCount: scriptedCampaign.approvedListings.length,
              listingValidationStatus: scriptedCampaign.listingValidationStatus,
              locationIntelligenceStatus: scriptedCampaign.locationIntelligenceStatus,
              scriptGenerationStatus: scriptedCampaign.scriptGenerationStatus,
              titleSupportConfidence: scriptedCampaign.titleSupportConfidence ?? undefined,
              validationSummary: scriptedCampaign.listingValidationSummary?.headline,
              locationSummary: scriptedCampaign.locationIntelligenceSummary?.headline,
              scriptSummary: scriptedCampaign.scriptSummary ?? undefined,
            },
            message: `Script ready. "${scriptedCampaign.name}" now includes the review-ready narrative package.`,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );
    });
    await flush();

    expect(container.querySelector('[data-testid="casahud-script-summary"]')?.textContent).toContain(
      "A relocation-oriented narrative",
    );
    expect(container.querySelector('[data-testid="casahud-script-preview"]')?.textContent).toContain(
      "what does life in Southern Italy actually look like",
    );
    expect(container.querySelector('[data-testid="casahud-script-segments"]')?.textContent).toContain("Opening Hook");
    expect(container.querySelector('[data-testid="casahud-property-segments"]')?.textContent).toContain(
      "Tropea apartment with sea views",
    );
    expect(container.querySelector('[data-testid="casahud-script-transitions"]')?.textContent).toContain(
      "Bridge the property segment through daily-life fit",
    );
    expect(container.querySelector('[data-testid="casahud-script-warnings"]')?.textContent).toContain(
      "Title support is moderate at 74%",
    );
    expect(container.textContent).toContain("Media Planning and Asset Assembly");
    expect(container.querySelector('[data-testid="casahud-recent-campaigns"]')?.textContent).toContain("Script ready");
  });

  it("shows a safe recoverable error if campaign creation fails", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method || "GET";

      if (url.includes("/api/studio/domara/integrations/status")) {
        return new Response(JSON.stringify({ ok: true, providers: [], saveSupported: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.endsWith("/api/studio/domara/campaigns") && method === "GET") {
        return new Response(JSON.stringify({ ok: true, campaigns: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.endsWith("/api/studio/domara/opportunity")) {
        return new Response(JSON.stringify({ ok: true, output: successOutput }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.endsWith("/api/studio/domara/campaigns") && method === "POST") {
        return new Response(
          JSON.stringify({
            ok: false,
            error: { message: "CasaHUD could not save this campaign right now. Try again in a moment." },
          }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      throw new Error(`Unhandled fetch: ${method} ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    await act(async () => {
      root.render(<StudioDomaraClient />);
    });
    await flush();

    const generateButton = container.querySelector('[data-testid="casahud-generate-cta"]');
    await act(async () => {
      generateButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    const createButton = container.querySelector('[data-testid="casahud-create-campaign-cta"]');
    await act(async () => {
      createButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    expect(container.querySelector('[data-testid="casahud-campaign-create-error"]')?.textContent).toContain(
      "CasaHUD could not save this campaign right now. Try again in a moment.",
    );
  });

  it("shows a safe recoverable error if the opportunity route fails", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/api/studio/domara/integrations/status")) {
        return new Response(JSON.stringify({ ok: true, providers: [], saveSupported: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.includes("/api/studio/domara/campaigns")) {
        return new Response(JSON.stringify({ ok: true, campaigns: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.includes("/api/studio/domara/opportunity")) {
        return new Response(
          JSON.stringify({
            ok: false,
            error: { message: "CasaHUD could not generate title opportunities right now. Try again in a moment." },
          }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      throw new Error(`Unhandled fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    await act(async () => {
      root.render(<StudioDomaraClient />);
    });
    await flush();

    const button = container.querySelector('[data-testid="casahud-generate-cta"]');
    await act(async () => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    expect(container.querySelector('[data-testid="casahud-generation-error"]')?.textContent).toContain(
      "CasaHUD could not generate title opportunities right now. Try again in a moment.",
    );
    expect(container.querySelector('[data-testid="casahud-opportunity-results"]')).toBeNull();
  });
});
