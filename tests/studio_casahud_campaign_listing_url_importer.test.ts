import { describe, expect, it, vi } from "vitest";
import type { CasaHudCampaign } from "@/lib/studio/domara/campaigns";
import { createEmptyCasaHudExecutionData } from "@/lib/studio/domara/campaign-execution";
import { createEmptyCasaHudLocationData } from "@/lib/studio/domara/campaign-location-intelligence";
import { createEmptyCasaHudMediaPlanData } from "@/lib/studio/domara/campaign-media-planning";
import { createEmptyCasaHudScriptData } from "@/lib/studio/domara/campaign-script-narrative";
import { createEmptyCasaHudYouTubePackageData } from "@/lib/studio/domara/campaign-youtube-package";
import { importCasaHudListingUrls } from "@/lib/studio/domara/campaign-listing-url-importer";

function buildCampaign(): CasaHudCampaign {
  return {
    id: "campaign-import-test",
    name: "Could You Retire in Southern Italy for Under $300K?",
    selectedViralTitle: "Could You Retire in Southern Italy for Under $300K?",
    selectedTitle: {
      title: "Could You Retire in Southern Italy for Under $300K?",
      score: 92,
      campaignType: "lifestyle_relocation",
      confidence: 0.88,
      reasoning: "Believable hook with clear relocation intent.",
      regionHint: "Southern Italy",
      listingSearchHints: ["Southern Italy homes under 300k"],
    },
    titleCandidates: [],
    researchBrief: {
      summary: "CasaHUD identified a strong relocation angle for Southern Italy.",
      opportunityCategories: ["relocation"],
      competitorPatterns: [],
      audienceIntent: ["retire in Italy"],
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
      summary: "Strong support.",
      titleOpportunitySummary: "The hook is specific and supportable.",
      selectedTitleReasoning: "Budget plus geography keeps the story grounded.",
      selectedTitleConfidence: 0.88,
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
    ...createEmptyCasaHudLocationData(),
    ...createEmptyCasaHudScriptData(),
    ...createEmptyCasaHudMediaPlanData(),
    ...createEmptyCasaHudYouTubePackageData(),
    ...createEmptyCasaHudExecutionData(),
    nextPhase: {
      key: "property_discovery",
      label: "Find matching properties",
      detail:
        "Property Discovery comes next. CasaHUD will translate the saved title promise into real candidate listings without regenerating the title package.",
      implemented: false,
    },
    createdAt: "2026-04-29T00:00:00.000Z",
    updatedAt: "2026-04-29T00:00:00.000Z",
    generatedAt: "2026-04-29T00:00:00.000Z",
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
      approvalStatus: null,
      publishStatus: null,
      scheduleStatus: null,
    },
  };
}

function mockHtmlResponse(url: string, html: string, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ "content-type": "text/html; charset=utf-8" }),
    url,
    text: async () => html,
  };
}

describe("CasaHUD campaign listing URL importer", () => {
  it("imports metadata-backed URLs as imported_url candidates with featured image support", async () => {
    const fetchFn = vi.fn(async (input: string) =>
      mockHtmlResponse(
        input,
        `
          <html>
            <head>
              <title>Apartment in Tropea - idealista.it</title>
              <meta property="og:title" content="Apartment in Tropea" />
              <meta property="og:description" content="EUR 284000 apartment in Tropea, Calabria, Italy with 2 bedrooms, 2 bathrooms, and 88 sqm." />
              <meta property="og:image" content="https://images.example.com/tropea-og.jpg" />
              <link rel="canonical" href="https://www.idealista.it/en/annuncio/123" />
            </head>
          </html>
        `,
      ),
    );

    const result = await importCasaHudListingUrls({
      campaign: buildCampaign(),
      rawUrls: "https://www.idealista.it/en/annuncio/123",
      fetchFn,
      importedAt: "2026-04-29T10:00:00.000Z",
    });

    expect(result.importedCount).toBe(1);
    expect(result.importedCandidates[0]?.sourceType).toBe("imported_url");
    expect(result.importedCandidates[0]?.provider).toBe("idealista");
    expect(result.importedCandidates[0]?.sourceLabel).toBe("Idealista");
    expect(result.importedCandidates[0]?.title).toBe("Apartment in Tropea");
    expect(result.importedCandidates[0]?.locationText).toBe("Tropea, Calabria, Italy");
    expect(result.importedCandidates[0]?.price).toBe(284000);
    expect(result.importedCandidates[0]?.bedrooms).toBe(2);
    expect(result.importedCandidates[0]?.bathrooms).toBe(2);
    expect(result.importedCandidates[0]?.sizeSqm).toBe(88);
    expect(result.importedCandidates[0]?.featuredImageUrl).toBe("https://images.example.com/tropea-og.jpg");
    expect(result.importedCandidates[0]?.canonicalUrl).toBe("https://www.idealista.it/en/annuncio/123");
    expect(result.importedCandidates[0]?.imageUrls).toEqual(["https://images.example.com/tropea-og.jpg"]);
    expect(result.importedCandidates[0]?.preliminaryMatchNotes).not.toContain("live listing URL");
    expect(result.importedCandidates[0]?.needsReviewFields).toEqual([
      "rooms",
      "land_size",
      "floor",
      "parking",
      "condition",
      "energy",
    ]);
  });

  it("marks unsafe protocols as invalid", async () => {
    const result = await importCasaHudListingUrls({
      campaign: buildCampaign(),
      rawUrls: "javascript:alert(1)",
      fetchFn: vi.fn(),
      importedAt: "2026-04-29T10:00:00.000Z",
    });

    expect(result.importedCount).toBe(0);
    expect(result.invalidCount).toBe(1);
    expect(result.results[0]?.status).toBe("invalid");
    expect(result.results[0]?.reason).toContain("Only http/https");
  });

  it("skips duplicate URLs already present on the campaign", async () => {
    const campaign = buildCampaign();
    campaign.listingCandidates = [
      {
        id: "existing-import",
        provider: "idealista",
        sourceType: "imported_url",
        sourceUrl: "https://www.idealista.it/en/annuncio/123",
        title: "Existing import",
        locationText: "Tropea",
        features: [],
        imageUrls: [],
        imageCount: 0,
        photoAvailability: "none",
        discoveredAt: "2026-04-29T09:00:00.000Z",
        preliminaryMatchNotes: "Existing imported listing.",
      },
    ];

    const result = await importCasaHudListingUrls({
      campaign,
      rawUrls: "https://www.idealista.it/en/annuncio/123",
      fetchFn: vi.fn(),
      importedAt: "2026-04-29T10:00:00.000Z",
    });

    expect(result.importedCount).toBe(0);
    expect(result.duplicateCount).toBe(1);
    expect(result.results[0]?.status).toBe("duplicate");
  });

  it("creates a manual draft when a valid provider listing is blocked for safe extraction", async () => {
    const fetchFn = vi.fn(async (input: string) => mockHtmlResponse(input, "<html><head></head><body></body></html>", 403));

    const result = await importCasaHudListingUrls({
      campaign: buildCampaign(),
      rawUrls: "https://www.immobiliare.it/annunci/456",
      fetchFn,
      importedAt: "2026-04-29T10:00:00.000Z",
    });

    expect(result.importedCount).toBe(0);
    expect(result.manualDraftCount).toBe(1);
    expect(result.failedCount).toBe(0);
    expect(result.results[0]?.status).toBe("manual_draft");
    expect(result.results[0]?.reason).toContain("manual draft");
    expect(result.results[0]?.warnings.join(" ")).toContain("HTTP 403");
    expect(result.importedCandidates[0]?.sourceType).toBe("imported_url");
    expect(result.importedCandidates[0]?.manualCompletionStatus).toBe("incomplete");
    expect(result.importedCandidates[0]?.needsReviewFields).toContain("location");
  });

  it("classifies search pages and safely imports discovered listing URLs from public links", async () => {
    const fetchFn = vi.fn(async (input: string) => {
      if (input.includes("/vendita-case/")) {
        return mockHtmlResponse(
          input,
          `
            <html>
              <body>
                <a href="/en/annunci/121869400/">Listing A</a>
                <a href="/annunci/122960988/">Listing B</a>
              </body>
            </html>
          `,
        );
      }

      return mockHtmlResponse(
        input,
        `
          <html>
            <head>
              <meta property="og:title" content="Apartment in Tropea" />
              <meta property="og:description" content="EUR 284000 apartment in Tropea, Calabria, Italy with 2 bedrooms, 2 bathrooms, and 88 sqm." />
            </head>
          </html>
        `,
      );
    });

    const result = await importCasaHudListingUrls({
      campaign: buildCampaign(),
      rawUrls: "https://www.immobiliare.it/vendita-case/campania/",
      fetchFn,
      importedAt: "2026-04-29T10:00:00.000Z",
    });

    expect(result.searchPageCount).toBe(1);
    expect(result.results[0]?.status).toBe("search_results");
    expect(result.importedCandidates.length).toBe(2);
    expect(result.results.some((entry) => entry.status === "partial" || entry.status === "imported")).toBe(true);
  });

  it("skips a second URL when the extractor resolves to an existing canonical URL", async () => {
    const fetchFn = vi.fn(async () =>
      mockHtmlResponse(
        "https://www.idealista.it/en/annuncio/123",
        `
          <html>
            <head>
              <meta property="og:title" content="Apartment in Tropea" />
              <meta property="og:description" content="EUR 284000 apartment in Tropea, Calabria, Italy with 2 bedrooms, 2 bathrooms, and 88 sqm." />
              <link rel="canonical" href="https://www.idealista.it/en/annuncio/123" />
            </head>
          </html>
        `,
      ),
    );

    const result = await importCasaHudListingUrls({
      campaign: buildCampaign(),
      rawUrls: "https://example.com/redirected\nhttps://www.idealista.it/en/annuncio/123",
      fetchFn,
      importedAt: "2026-04-29T10:00:00.000Z",
    });

    expect(result.importedCount).toBe(1);
    expect(result.duplicateCount).toBe(1);
    expect(result.results[1]?.status).toBe("duplicate");
  });
});
