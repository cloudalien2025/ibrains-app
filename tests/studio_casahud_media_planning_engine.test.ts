import { describe, expect, it } from "vitest";
import { createEmptyCasaHudMediaPlanData } from "@/lib/studio/domara/campaign-media-planning";
import type { CasaHudCampaign } from "@/lib/studio/domara/campaigns";
import { createEmptyCasaHudYouTubePackageData } from "@/lib/studio/domara/campaign-youtube-package";
import { runCasaHudMediaPlanning } from "@/lib/studio/domara/media-planning-engine";

function buildScriptReadyCampaign(): CasaHudCampaign {
  return {
    id: "casahud-project-phase8",
    name: "Could You Retire in Southern Italy for Under $300K?",
    selectedViralTitle: "Could You Retire in Southern Italy for Under $300K?",
    selectedTitle: {
      title: "Could You Retire in Southern Italy for Under $300K?",
      score: 92,
      campaignType: "lifestyle_relocation",
      confidence: 0.88,
      reasoning: "Strong relocation intent with believable title support.",
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
        reasoning: "Strong relocation intent with believable title support.",
      },
    ],
    researchBrief: {
      summary: "CasaFlix identified the strongest relocation opportunity in Southern Italy.",
      opportunityCategories: ["relocation"],
      competitorPatterns: ["Budget-led relocation videos perform well."],
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
      summary: "Strong support.",
      titleOpportunitySummary: "The title stays supportable against the approved shortlist.",
      selectedTitleReasoning: "It balances click appeal with believable support.",
      selectedTitleConfidence: 0.88,
    },
    status: "script_narrative_completed",
    listingCandidates: [],
    listingSearchCriteria: null,
    listingProviderStatuses: [],
    discoverySummary: null,
    listingDiscoveryStatus: "listing_candidates_discovered",
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
        imageUrls: ["https://images.example.com/listing-1a.jpg", "https://images.example.com/listing-1b.jpg"],
        imageCount: 2,
        photoAvailability: "available",
        coordinates: { latitude: 38.675, longitude: 15.895 },
        discoveredAt: "2026-04-29T00:00:00.000Z",
        preliminaryMatchNotes: "Fits the title promise and budget.",
        validationStatus: "approved",
        overallScore: 88,
        scoreBreakdown: {
          titleMatchScore: 92,
          geographyScore: 100,
          priceFitScore: 100,
          propertyTypeScore: 100,
          featureClaimScore: 80,
          mediaAvailabilityScore: 84,
          listingCompletenessScore: 80,
          providerQualityScore: 76,
          uniquenessScore: 86,
          overallScore: 88,
        },
        validationReasons: ["Strong title support."],
        warnings: [],
        rank: 1,
        duplicateGroupKey: "listing-1",
      },
      {
        id: "listing-2",
        provider: "casahud_sample",
        providerListingId: "sample-2",
        sourceUrl: "https://example.com/listing-2",
        title: "Lecce townhouse near the historic center",
        locationText: "Lecce, Puglia, Italy",
        country: "Italy",
        region: "Puglia",
        city: "Lecce",
        price: 298000,
        currency: "USD",
        propertyType: "townhouse",
        bedrooms: 3,
        bathrooms: 2,
        sizeSqm: 104,
        descriptionSnippet: "Historic-center townhouse that broadens the shortlist.",
        features: ["historic center"],
        imageUrls: [],
        imageCount: 0,
        photoAvailability: "none",
        discoveredAt: "2026-04-29T00:01:00.000Z",
        preliminaryMatchNotes: "Broadens the shortlist while staying inside the price claim.",
        validationStatus: "approved",
        overallScore: 80,
        scoreBreakdown: {
          titleMatchScore: 84,
          geographyScore: 90,
          priceFitScore: 100,
          propertyTypeScore: 84,
          featureClaimScore: 68,
          mediaAvailabilityScore: 10,
          listingCompletenessScore: 70,
          providerQualityScore: 58,
          uniquenessScore: 86,
          overallScore: 80,
        },
        validationReasons: ["Adds variety without breaking the title promise."],
        warnings: ["No source images on this listing."],
        rank: 2,
        duplicateGroupKey: "listing-2",
      },
    ],
    rejectedListings: [],
    listingRankOrder: ["listing-1", "listing-2"],
    listingValidationStatus: "listing_candidates_validated",
    listingValidationSummary: {
      headline: "Approved 2 of 2 discovered listings.",
      rankingExplanation: "Ranked by title support, geography, price, and media quality.",
      discoveredCount: 2,
      approvedCount: 2,
      rejectedCount: 0,
      needsAttentionCount: 0,
      titleSupportConfidence: 78,
      warnings: [],
      completedAt: "2026-04-29T00:05:00.000Z",
    },
    titleSupportConfidence: 78,
    validationWarnings: [],
    locationIntelligenceStatus: "location_intelligence_completed",
    locationIntelligenceSummary: {
      headline: "Location story prepared across 2 shortlist anchors.",
      providerSummary: "Using saved map and POI seams.",
      coverageSummary: "CasaFlix connected the shortlist to regional and local proof points.",
      warningCount: 1,
      generatedAt: "2026-04-29T00:08:00.000Z",
      fallbackUsed: true,
    },
    locationStory: {
      headline: "Southern Italy becomes the lifestyle frame.",
      summary: "Lead with place, then let the properties prove the title promise.",
      narrativeAngles: ["Open with the place before the property details arrive."],
      lifestyleAnchors: ["Coastal day-to-day context", "Historic-center texture"],
      regionHighlights: ["Tropea", "Lecce"],
      fallbackNotice: "Using CasaFlix location patterns where live providers were limited.",
    },
    localHighlights: [
      {
        id: "highlight-1",
        title: "Regional anchor",
        description: "Tropea gives the campaign a specific place identity.",
        locationText: "Tropea, Calabria, Italy",
        associatedListingId: "listing-1",
        provider: "casahud_location_patterns",
        sourceConfidence: "fallback",
      },
    ],
    poiBundle: {
      summary: "Location proof points prepared for the approved shortlist.",
      cards: [
        {
          id: "poi-1",
          name: "Coastal access context",
          category: "Beach",
          locationText: "Tropea, Calabria, Italy",
          associatedListingId: "listing-1",
          relevanceReason: "Helps the property read as a lifestyle move, not just a budget win.",
          provider: "casahud_location_patterns",
          sourceConfidence: "fallback",
        },
      ],
      categories: ["Beach"],
      generatedAt: "2026-04-29T00:08:00.000Z",
    },
    mapSceneIdeas: [
      {
        id: "scene-1",
        title: "Open on Tropea",
        sceneType: "regional_anchor",
        description: "Start with Tropea before the property details arrive.",
        associatedListingId: "listing-1",
        locationText: "Tropea, Calabria, Italy",
        suggestedVisual: "Wide regional map pull-back with the strongest listing highlighted first.",
        provider: "casahud_location_patterns",
        confidence: "fallback",
      },
    ],
    listingLocationInsights: [
      {
        listingId: "listing-1",
        summary: "Tropea plays best as a waterside lifestyle story.",
        highlights: ["Coastal day-to-day context supports the move story."],
        nearbyPois: [],
        locationStrengths: ["Waterside lifestyle context"],
        warnings: ["Using fallback location patterns."],
      },
      {
        listingId: "listing-2",
        summary: "Lecce adds a compact historic-center counterpoint.",
        highlights: ["Historic-center texture broadens the shortlist."],
        nearbyPois: [],
        locationStrengths: ["Historic core context"],
        warnings: [],
      },
    ],
    locationProviderStatuses: [
      {
        provider: "google_places",
        label: "Google Places",
        state: "missing_credentials",
        configured: false,
        used: false,
        detail: "Fallback location patterns are in use.",
      },
      {
        provider: "casahud_location_patterns",
        label: "CasaFlix location patterns",
        state: "fallback",
        configured: true,
        used: true,
        detail: "Deterministic location intelligence is filling the current coverage gaps.",
      },
    ],
    locationWarnings: ["Fallback location coverage is in use."],
    scriptGenerationStatus: "script_generated",
    scriptSummary: "A relocation-oriented narrative that turns the shortlist into a believable daily-life video concept.",
    openingHook: "What does life in Southern Italy actually look like when the homes are real and the budget still matters?",
    estimatedDurationSeconds: 112,
    tone: "Premium, clear, and grounded in validated support.",
    scriptSegments: [
      {
        id: "segment-hook",
        title: "Opening Hook",
        segmentType: "hook",
        narration: "What does life in Southern Italy actually look like when the homes are real and the budget still matters?",
        durationSeconds: 14,
        visualNote: "Open on the strongest location anchor.",
      },
      {
        id: "segment-location",
        title: "Location Story",
        segmentType: "location_context",
        narration: "Lead the place story through Tropea and the stronger regional anchors before drilling into listing specifics.",
        durationSeconds: 18,
        associatedListingId: "listing-1",
        visualNote: "Use the regional map and local proof points.",
      },
      {
        id: "segment-property-1",
        title: "Property One",
        segmentType: "property_focus",
        narration: "Tropea apartment with sea views keeps the segment grounded in real budget and location support.",
        durationSeconds: 24,
        associatedListingId: "listing-1",
        visualNote: "Lead with the listing photos, then support with map context.",
      },
      {
        id: "segment-property-2",
        title: "Property Two",
        segmentType: "property_focus",
        narration: "Lecce adds a different daily-life angle even though the listing still needs stronger source imagery.",
        durationSeconds: 20,
        associatedListingId: "listing-2",
        visualNote: "Use a placeholder until listing media is connected.",
      },
      {
        id: "segment-closing",
        title: "Closing CTA",
        segmentType: "closing_cta",
        narration: "Close by recapping who this move feels best suited for and invite the viewer to follow for the next shortlist.",
        durationSeconds: 12,
        visualNote: "Return to the lead property and the region.",
      },
    ],
    propertySegments: [
      {
        listingId: "listing-1",
        title: "Tropea apartment with sea views",
        locationText: "Tropea, Calabria, Italy",
        narration: "Use the lead listing as the hero beat.",
        whyItMadeTheCut: "It grounds the title promise with strong budget and place support.",
        supportedFacts: ["USD 284,000", "2 bedrooms", "88 sqm"],
        locationLine: "Lead with Tropea as the coastal anchor.",
      },
      {
        listingId: "listing-2",
        title: "Lecce townhouse near the historic center",
        locationText: "Lecce, Puglia, Italy",
        narration: "Use the second listing as the historic-center counterpoint.",
        whyItMadeTheCut: "It broadens the shortlist while staying on-brief.",
        supportedFacts: ["USD 298,000", "3 bedrooms", "104 sqm"],
        caution: "Source imagery is missing.",
      },
    ],
    locationLifestyleLines: ["Lead the place story through Tropea and Lecce before drilling into property specifics."],
    transitions: ["Bridge the properties through day-to-day fit rather than restarting the title promise."],
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
    fullScriptText: "Opening Hook\nWhat does life in Southern Italy actually look like when the homes are real and the budget still matters?",
    ...createEmptyCasaHudMediaPlanData(),
    ...createEmptyCasaHudYouTubePackageData(),
    nextPhase: {
      key: "media_planning_asset_assembly",
      label: "Media Planning and Asset Assembly",
      detail: "Media Planning and Asset Assembly comes next. CasaFlix will organize visuals, map scenes, and asset needs around the approved narrative package.",
      implemented: false,
    },
    createdAt: "2026-04-29T00:00:00.000Z",
    updatedAt: "2026-04-29T00:10:00.000Z",
    generatedAt: "2026-04-29T00:00:00.000Z",
    futureState: {
      listingCandidates: [],
      approvedListings: [],
      rejectedListings: [],
      listingRankOrder: ["listing-1", "listing-2"],
      locationIntelligence: {
        status: "location_intelligence_completed",
        storyHeadline: "Southern Italy becomes the lifestyle frame.",
        generatedAt: "2026-04-29T00:08:00.000Z",
      },
      mapPoiBundle: null,
      script: {
        status: "script_generated",
        summary: "A relocation-oriented narrative that turns the shortlist into a believable daily-life video concept.",
      },
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

describe("CasaFlix media planning engine", () => {
  it("builds scene mappings, shot list, listing coverage, and thumbnail inputs from the saved script package", () => {
    const result = runCasaHudMediaPlanning(buildScriptReadyCampaign());

    expect(result.mediaPlanningStatus).toBe("media_plan_built");
    expect(result.mediaPlanSummary).toContain("production-ready media plan");
    expect(result.sceneAssetMapping.length).toBe(5);
    expect(result.shotList.length).toBe(result.sceneAssetMapping.length);
    expect(result.listingImageCoverage).toHaveLength(2);
    expect(result.mapLocationVisualPlan.length).toBeGreaterThan(0);
    expect(result.thumbnailCandidateInputs.length).toBeGreaterThan(1);
  });

  it("uses deterministic placeholders and warnings when listing media is weak", () => {
    const result = runCasaHudMediaPlanning(buildScriptReadyCampaign());
    const placeholderAsset = result.visualAssets.find((asset) => asset.type === "fallback_placeholder");
    const weakCoverage = result.listingImageCoverage.find((item) => item.listingId === "listing-2");

    expect(placeholderAsset?.listingId).toBe("listing-2");
    expect(weakCoverage?.coverageStatus).toBe("missing");
    expect(result.missingMediaWarnings.some((warning) => warning.includes("placeholders"))).toBe(true);
  });

  it("keeps scene mapping tied to script segments instead of inventing extra scenes", () => {
    const campaign = buildScriptReadyCampaign();
    const result = runCasaHudMediaPlanning(campaign);

    expect(result.sceneAssetMapping.map((scene) => scene.segmentId)).toEqual(campaign.scriptSegments.map((segment) => segment.id));
    expect(result.sceneAssetMapping[0]?.sceneTitle).toBe("Opening Hook");
    expect(result.sceneAssetMapping[0]?.assignedAssetIds.length).toBeGreaterThan(0);
  });
});
