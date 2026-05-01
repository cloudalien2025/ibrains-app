import { describe, expect, it } from "vitest";
import type { CasaHudCampaign, CasaHudValidatedListing } from "@/lib/studio/domara/campaigns";
import {
  computeApprovedListingsLocationFingerprint,
  deriveApprovedListingLocationLabels,
  isCasaHudLocationIntelligenceStale,
  resolveLocationSourceLabels,
} from "@/lib/studio/domara/location-intelligence-fingerprint";

function approvedListing(overrides: Partial<CasaHudValidatedListing>): CasaHudValidatedListing {
  return {
    id: "listing-1",
    provider: "immobiliare",
    title: "Single family villa Contrada Lacagnina",
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
    descriptionSnippet: "Seaside villa with terrace.",
    features: ["Car parking"],
    imageUrls: ["https://images.example.com/messina.jpg"],
    imageCount: 1,
    photoAvailability: "limited",
    discoveredAt: "2026-05-01T00:00:00.000Z",
    preliminaryMatchNotes: "Imported from Immobiliare.",
    validationStatus: "approved",
    overallScore: 69,
    scoreBreakdown: {
      titleMatchScore: 70,
      geographyScore: 80,
      priceFitScore: 80,
      propertyTypeScore: 75,
      featureClaimScore: 62,
      mediaAvailabilityScore: 44,
      listingCompletenessScore: 72,
      providerQualityScore: 80,
      uniquenessScore: 100,
      overallScore: 69,
    },
    validationReasons: ["Location aligns with the campaign region."],
    warnings: [],
    ...overrides,
  };
}

function campaignWithLocation(overrides: Partial<CasaHudCampaign>): CasaHudCampaign {
  const approved = [approvedListing({})];
  return {
    approvedListings: approved,
    locationIntelligenceStatus: "location_intelligence_completed",
    locationIntelligenceSummary: {
      headline: "Location story prepared across 1 shortlist anchor.",
      providerSummary: "Fallback provider.",
      coverageSummary: "CasaFlix connected Tropea to local proof points.",
      warningCount: 0,
      generatedAt: "2026-05-01T00:00:00.000Z",
      fallbackUsed: true,
    },
    locationStory: {
      headline: "Tropea turns the shortlist into a place-led story.",
      summary: "CasaFlix positioned the approved properties around Tropea and Calabria.",
      narrativeAngles: ["Open with the region."],
      lifestyleAnchors: ["Waterside lifestyle context"],
      regionHighlights: ["Tropea", "Calabria"],
    },
    localHighlights: [],
    poiBundle: {
      summary: "1 location proof point prepared.",
      cards: [
        {
          id: "poi-1",
          name: "Belvedere Piazza del Cannone",
          category: "Landmark",
          locationText: "Tropea, Calabria, Italy",
          relevanceReason: "Legacy location context.",
          provider: "casahud_location_patterns",
          sourceConfidence: "fallback",
        },
      ],
      categories: ["Landmark"],
      generatedAt: "2026-05-01T00:00:00.000Z",
    },
    mapSceneIdeas: [],
    listingLocationInsights: [],
    locationProviderStatuses: [],
    locationWarnings: [],
    ...overrides,
  } as unknown as CasaHudCampaign;
}

describe("CasaFlix location intelligence fingerprint", () => {
  it("changes when approved property locations change", () => {
    const messina = computeApprovedListingsLocationFingerprint([
      approvedListing({
        id: "listing-messina",
        city: "Messina",
        region: "Sicily",
        locationText: "Acqualadrone - Sparta, Messina, Sicily, Italy",
      }),
    ]);
    const tropea = computeApprovedListingsLocationFingerprint([
      approvedListing({
        id: "listing-tropea",
        city: "Tropea",
        region: "Calabria",
        locationText: "Tropea, Calabria, Italy",
      }),
    ]);

    expect(messina).not.toBe(tropea);
  });

  it("flags stale location intelligence when stored fingerprint mismatches approved listings", () => {
    const approved = [approvedListing({ id: "listing-messina" })];
    const staleFingerprint = computeApprovedListingsLocationFingerprint([
      approvedListing({
        id: "listing-tropea",
        city: "Tropea",
        region: "Calabria",
        locationText: "Tropea, Calabria, Italy",
      }),
    ]);
    const campaign = campaignWithLocation({
      approvedListings: approved,
      locationIntelligenceSummary: {
        headline: "Location story prepared across 1 shortlist anchor.",
        providerSummary: "Fallback provider.",
        coverageSummary: "CasaFlix connected Tropea to local proof points.",
        warningCount: 0,
        generatedAt: "2026-05-01T00:00:00.000Z",
        fallbackUsed: true,
        listingFingerprint: staleFingerprint,
      },
    });

    expect(isCasaHudLocationIntelligenceStale(campaign)).toBe(true);
  });

  it("flags stale legacy records when location story does not match current approved locations", () => {
    const campaign = campaignWithLocation({
      approvedListings: [
        approvedListing({
          id: "listing-messina",
          city: "Messina",
          region: "Sicily",
          locationText: "Acqualadrone - Sparta, Messina, Sicily, Italy",
        }),
      ],
    });

    expect(isCasaHudLocationIntelligenceStale(campaign)).toBe(true);
  });

  it("resolves source labels from summary first, then approved listings", () => {
    const campaign = campaignWithLocation({
      locationIntelligenceSummary: {
        headline: "Location story prepared across 1 shortlist anchor.",
        providerSummary: "Fallback provider.",
        coverageSummary: "Coverage summary.",
        warningCount: 0,
        generatedAt: "2026-05-01T00:00:00.000Z",
        fallbackUsed: true,
        sourceLocations: ["Messina", "Sicily"],
      },
    });

    expect(resolveLocationSourceLabels(campaign)).toEqual(["Messina", "Sicily"]);

    const noSummaryLocations = campaignWithLocation({
      locationIntelligenceSummary: {
        headline: "Location story prepared across 1 shortlist anchor.",
        providerSummary: "Fallback provider.",
        coverageSummary: "Coverage summary.",
        warningCount: 0,
        generatedAt: "2026-05-01T00:00:00.000Z",
        fallbackUsed: true,
      },
      approvedListings: [
        approvedListing({
          locationText: "Acqualadrone - Sparta, Messina, Sicily, Italy",
          city: "Messina",
          region: "Sicily",
        }),
      ],
    });
    expect(deriveApprovedListingLocationLabels(noSummaryLocations.approvedListings)).toContain("Messina");
  });
});
