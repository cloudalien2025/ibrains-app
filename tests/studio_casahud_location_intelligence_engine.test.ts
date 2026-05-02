import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CasaHudCampaign } from "@/lib/studio/domara/campaigns";
import { createEmptyCasaHudMediaPlanData } from "@/lib/studio/domara/campaign-media-planning";
import { createEmptyCasaHudYouTubePackageData } from "@/lib/studio/domara/campaign-youtube-package";
import { runCasaHudLocationIntelligence } from "@/lib/studio/domara/location-intelligence-engine";

function baseValidatedCampaign(): CasaHudCampaign {
  return {
    id: "casahud-project-phase6",
    name: "Could You Retire in Southern Italy for Under $300K?",
    selectedViralTitle: "Could You Retire in Southern Italy for Under $300K?",
    selectedTitle: {
      title: "Could You Retire in Southern Italy for Under $300K?",
      score: 92,
      campaignType: "lifestyle_relocation",
      confidence: 0.89,
      reasoning: "Balanced click potential with a believable promise.",
      regionHint: "Southern Italy",
      listingSearchHints: ["Southern Italy homes under 300k", "relocation-friendly towns"],
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
    ],
    researchBrief: {
      summary: "CasaFlix identified the strongest opportunity in regional affordability plus relocation intent.",
      opportunityCategories: ["affordable coastal roundups", "retirement relocation"],
      competitorPatterns: ["Top videos frequently anchor the title with a price ceiling."],
      audienceIntent: ["buyable Italy homes", "retire in Italy"],
      suggestedTitleDirections: ["Southern Italy affordability roundups"],
      riskNotes: ["Very cheap Italy claims can become hard to prove with current listings."],
    },
    campaignType: "lifestyle_relocation",
    marketRegionHint: "Southern Italy",
    preferredMarket: "Italian real-estate YouTube",
    generationSource: {
      mode: "casahud_patterns",
      label: "CasaFlix opportunity patterns",
      detail: "Using CasaFlix opportunity patterns until YouTube connection is enabled for live competitive research.",
      canImproveWithYouTube: true,
    },
    confidenceReasoning: {
      summary: "89% confidence.",
      titleOpportunitySummary:
        "The title gives CasaFlix a clear, searchable concept that can still hold up when listing discovery begins.",
      selectedTitleReasoning: "The price ceiling and geography are strong but still believable.",
      selectedTitleConfidence: 0.89,
    },
    status: "listing_candidates_validated",
    listingCandidates: [],
    listingSearchCriteria: null,
    listingProviderStatuses: [],
    discoverySummary: null,
    listingDiscoveryStatus: "listing_candidates_discovered",
    approvedListings: [
      {
        id: "listing-1",
        provider: "casahud_sample",
        providerListingId: "sample-1",
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
        descriptionSnippet: "Move-in ready apartment with sea views and strong retirement appeal.",
        features: ["budget-conscious", "move-in ready", "coastal lifestyle"],
        imageUrls: ["https://images.example.com/1.jpg"],
        imageCount: 1,
        photoAvailability: "available",
        coordinates: {
          latitude: 38.6762,
          longitude: 15.8988,
        },
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
        duplicateGroupKey: "listing-1",
      },
    ],
    rejectedListings: [],
    listingRankOrder: ["listing-1"],
    listingValidationStatus: "listing_candidates_validated",
    listingValidationSummary: {
      headline: "Approved 1 of 1 discovered listings for the title promise.",
      rankingExplanation:
        "CasaFlix ranked the shortlist by title truthfulness, geography fit, price support, feature alignment, media coverage, and duplicate reduction.",
      discoveredCount: 1,
      approvedCount: 1,
      rejectedCount: 0,
      needsAttentionCount: 0,
      titleSupportConfidence: 88,
      warnings: [],
      completedAt: "2026-04-28T00:25:00.000Z",
    },
    titleSupportConfidence: 88,
    validationWarnings: [],
    locationIntelligenceStatus: "not_started",
    locationIntelligenceSummary: null,
    locationStory: null,
    localHighlights: [],
    poiBundle: null,
    mapSceneIdeas: [],
    listingLocationInsights: [],
    locationProviderStatuses: [],
    locationWarnings: [],
    scriptGenerationStatus: "not_started",
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
    ...createEmptyCasaHudMediaPlanData(),
    ...createEmptyCasaHudYouTubePackageData(),
    nextPhase: {
      key: "location_intelligence",
      label: "Location Intelligence",
      detail:
        "Location Intelligence comes next. CasaFlix will explain why the strongest validated properties work through area and map context.",
      implemented: false,
    },
    createdAt: "2026-04-28T00:10:00.000Z",
    updatedAt: "2026-04-28T00:25:00.000Z",
    generatedAt: "2026-04-28T00:00:00.000Z",
    futureState: {
      listingCandidates: [],
      approvedListings: [],
      rejectedListings: [],
      listingRankOrder: ["listing-1"],
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

describe("CasaFlix location intelligence engine", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-29T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns deterministic fallback location intelligence when provider credentials are absent", async () => {
    const campaign = baseValidatedCampaign();

    const first = await runCasaHudLocationIntelligence(campaign, {});
    const second = await runCasaHudLocationIntelligence(campaign, {});

    expect(first.locationIntelligenceStatus).toBe("location_intelligence_completed");
    expect(first.poiBundle?.cards.map((poi) => poi.name)).toEqual(second.poiBundle?.cards.map((poi) => poi.name));
    expect(first.poiBundle?.cards.every((poi) => poi.provider === "casahud_location_patterns")).toBe(true);
    expect(first.locationProviderStatuses.find((status) => status.provider === "google_places")?.state).toBe("missing_credentials");
    expect(first.locationProviderStatuses.find((status) => status.provider === "mapbox")?.state).toBe("missing_credentials");
    expect(first.locationStory?.fallbackNotice).toContain("CasaFlix location patterns");
  });

  it("times out slow live providers and falls back without hanging the run", async () => {
    const campaign = baseValidatedCampaign();
    const neverResolvingFetch = vi.fn(() => new Promise<Response>(() => undefined));

    const resultPromise = runCasaHudLocationIntelligence(campaign, {
      googlePlacesApiKey: "google-test-key",
      mapboxAccessToken: "mapbox-test-key",
      fetchImpl: neverResolvingFetch as typeof fetch,
      providerTimeoutMs: {
        googlePlaces: 5,
        mapbox: 5,
      },
    });

    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result.poiBundle?.cards.every((poi) => poi.provider === "casahud_location_patterns")).toBe(true);
    expect(result.locationProviderStatuses.find((status) => status.provider === "google_places")?.state).toBe("error");
    expect(result.locationProviderStatuses.find((status) => status.provider === "mapbox")?.state).toBe("connected");
    expect(result.locationWarnings.length).toBeGreaterThan(0);
  });

  it("uses current approved property locations as the location source of truth", async () => {
    const campaign = baseValidatedCampaign();
    campaign.approvedListings = [
      {
        ...campaign.approvedListings[0]!,
        id: "listing-messina",
        title: "Contrada Lacagnina Messina Single family villa with Terrace",
        locationText: "Acqualadrone - Sparta, Messina, Sicily, Italy",
        city: "Messina",
        region: "Sicily",
      },
    ];

    const result = await runCasaHudLocationIntelligence(campaign, {});
    const corpus = [
      result.locationStory?.headline,
      result.locationStory?.summary,
      result.locationIntelligenceSummary?.coverageSummary,
      ...(result.poiBundle?.cards || []).map((poi) => poi.locationText),
    ]
      .filter(Boolean)
      .join(" ");

    expect(corpus).toMatch(/Messina|Sicily/i);
    expect(corpus).not.toMatch(/Tropea|Calabria/i);
    expect(result.locationIntelligenceSummary?.listingFingerprint).toBeTruthy();
    expect(result.locationIntelligenceSummary?.sourceLocations?.join(" ")).toMatch(/Messina|Sicily/i);
  });

  it("uses complete browser imports as location source when approved listings are empty", async () => {
    const campaign = baseValidatedCampaign();
    campaign.approvedListings = [];
    campaign.listingCandidates = [
      {
        id: "listing-browser-ready",
        provider: "immobiliare",
        sourceType: "browser_assisted_import",
        sourceUrl: "https://www.immobiliare.it/en/annunci/127142643/",
        title: "Contrada Lacagnina Messina Single family villa with Terrace",
        locationText: "Acqualadrone - Sparta, Messina, Sicily, Italy",
        city: "Messina",
        region: "Sicily",
        country: "Italy",
        price: 300000,
        currency: "EUR",
        propertyType: "Single family villa",
        rooms: 5,
        bathrooms: 2,
        sizeSqm: 187,
        descriptionSnippet: "Seaside villa with complete browser-import details.",
        features: ["5+ rooms", "2 bathrooms", "187 sqm"],
        imageUrls: ["https://images.example.com/messina-villa.jpg"],
        featuredImageUrl: "https://images.example.com/messina-villa.jpg",
        imageCount: 1,
        photoAvailability: "limited",
        manualCompletionStatus: "completed",
        discoveredAt: "2026-05-02T00:00:00.000Z",
        preliminaryMatchNotes: "Complete browser import.",
      },
    ];

    const result = await runCasaHudLocationIntelligence(campaign, {});
    const corpus = [
      result.locationStory?.headline,
      result.locationStory?.summary,
      result.locationIntelligenceSummary?.coverageSummary,
      ...(result.poiBundle?.cards || []).map((poi) => poi.locationText),
    ]
      .filter(Boolean)
      .join(" ");

    expect(corpus).toMatch(/Messina|Sicily/i);
    expect(result.locationIntelligenceSummary?.listingFingerprint).toBeTruthy();
  });
});
