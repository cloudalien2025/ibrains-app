import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { CasaHudCampaign, CasaHudListingCandidate } from "@/lib/studio/domara/campaigns";
import { createEmptyCasaHudExecutionData } from "@/lib/studio/domara/campaign-execution";
import { createEmptyCasaHudLocationData } from "@/lib/studio/domara/campaign-location-intelligence";
import { createEmptyCasaHudMediaPlanData } from "@/lib/studio/domara/campaign-media-planning";
import { createEmptyCasaHudScriptData } from "@/lib/studio/domara/campaign-script-narrative";
import { createEmptyCasaHudYouTubePackageData } from "@/lib/studio/domara/campaign-youtube-package";

const userId = "11111111-1111-4111-8111-111111111111";

function buildCampaign(): CasaHudCampaign {
  return {
    id: "casahud-project-import-route",
    name: "Could You Retire in Southern Italy for Under $300K?",
    selectedViralTitle: "Could You Retire in Southern Italy for Under $300K?",
    selectedTitle: {
      title: "Could You Retire in Southern Italy for Under $300K?",
      score: 92,
      campaignType: "lifestyle_relocation",
      confidence: 0.88,
      reasoning: "Believable hook.",
      regionHint: "Southern Italy",
      listingSearchHints: ["Southern Italy homes under 300k"],
    },
    titleCandidates: [],
    researchBrief: {
      summary: "Strong relocation opportunity.",
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
      titleOpportunitySummary: "The hook is supportable.",
      selectedTitleReasoning: "Budget plus geography.",
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
      detail: "Find matching properties next.",
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

const importedCandidate: CasaHudListingCandidate = {
  id: "imported-1",
  provider: "idealista",
  sourceType: "imported_url",
  sourceUrl: "https://www.idealista.it/en/annuncio/123",
  sourceHost: "idealista.it",
  sourceLabel: "Idealista",
  importedAt: "2026-04-29T10:00:00.000Z",
  featuredImageUrl: "https://images.example.com/imported-1.jpg",
  metadataImageUrl: "https://images.example.com/imported-1.jpg",
  metadataTitle: "Apartment in Tropea",
  metadataDescription: "EUR 284000 apartment in Tropea.",
  canonicalUrl: "https://www.idealista.it/en/annuncio/123",
  extractionStatus: "partial",
  extractionWarnings: [],
  needsReviewFields: ["property_type"],
  title: "Apartment in Tropea",
  locationText: "Tropea",
  price: 284000,
  currency: "EUR",
  descriptionSnippet: "EUR 284000 apartment in Tropea.",
  features: [],
  imageUrls: ["https://images.example.com/imported-1.jpg"],
  imageCount: 1,
  photoAvailability: "limited",
  discoveredAt: "2026-04-29T10:00:00.000Z",
  preliminaryMatchNotes: "Imported from a live listing URL with enough public detail to review in the shortlist.",
};

const mocks = vi.hoisted(() => ({
  ensureUser: vi.fn(),
  resolveUserId: vi.fn(),
  isCasaHudCampaignStoreAvailable: vi.fn(),
  isCasaHudCampaignStoreUnavailable: vi.fn(),
  getCasaHudCampaign: vi.fn(),
  saveCasaHudCampaign: vi.fn(),
  importCasaHudListingUrls: vi.fn(),
}));

vi.mock("@/app/api/ecomviper/_utils/user", () => ({
  ensureUser: mocks.ensureUser,
  resolveUserId: mocks.resolveUserId,
}));

vi.mock("@/lib/studio/domara/campaign-repository", () => ({
  isCasaHudCampaignStoreAvailable: mocks.isCasaHudCampaignStoreAvailable,
  isCasaHudCampaignStoreUnavailable: mocks.isCasaHudCampaignStoreUnavailable,
  getCasaHudCampaign: mocks.getCasaHudCampaign,
  saveCasaHudCampaign: mocks.saveCasaHudCampaign,
}));

vi.mock("@/lib/studio/domara/campaign-listing-url-importer", () => ({
  importCasaHudListingUrls: mocks.importCasaHudListingUrls,
}));

describe("CasaHUD import listing URLs route", () => {
  beforeEach(() => {
    mocks.ensureUser.mockReset();
    mocks.resolveUserId.mockReset();
    mocks.isCasaHudCampaignStoreAvailable.mockReset();
    mocks.isCasaHudCampaignStoreUnavailable.mockReset();
    mocks.getCasaHudCampaign.mockReset();
    mocks.saveCasaHudCampaign.mockReset();
    mocks.importCasaHudListingUrls.mockReset();

    mocks.ensureUser.mockResolvedValue(undefined);
    mocks.resolveUserId.mockReturnValue(userId);
    mocks.isCasaHudCampaignStoreAvailable.mockResolvedValue(true);
    mocks.isCasaHudCampaignStoreUnavailable.mockReturnValue(false);
    mocks.getCasaHudCampaign.mockResolvedValue(buildCampaign());
    mocks.saveCasaHudCampaign.mockImplementation(async (_userId: string, campaign: CasaHudCampaign) => campaign);
  });

  it("imports campaign listing URLs and persists imported_url candidates", async () => {
    mocks.importCasaHudListingUrls.mockResolvedValue({
      results: [
        {
          inputUrl: importedCandidate.sourceUrl,
          normalizedUrl: importedCandidate.sourceUrl,
          status: "imported",
          candidate: importedCandidate,
          warnings: [],
        },
      ],
      importedCandidates: [importedCandidate],
      importedCount: 1,
      duplicateCount: 0,
      invalidCount: 0,
      warnings: [],
      importedAt: "2026-04-29T10:00:00.000Z",
    });

    const route = await import("@/app/api/studio/domara/campaigns/[id]/import-listing-urls/route");
    const request = new NextRequest("http://localhost/api/studio/domara/campaigns/casahud-project-import-route/import-listing-urls", {
      method: "POST",
      body: JSON.stringify({ rawUrls: importedCandidate.sourceUrl }),
    });

    const response = await route.POST(request, { params: { id: "casahud-project-import-route" } });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.importedCount).toBe(1);
    expect(payload.campaign.listingCandidates[0].sourceType).toBe("imported_url");
    expect(payload.campaign.listingCandidates[0].featuredImageUrl).toBe(importedCandidate.featuredImageUrl);
    expect(mocks.saveCasaHudCampaign).toHaveBeenCalledOnce();
  });

  it("returns a conflict when every submitted URL is a duplicate", async () => {
    mocks.importCasaHudListingUrls.mockResolvedValue({
      results: [
        {
          inputUrl: importedCandidate.sourceUrl,
          normalizedUrl: importedCandidate.sourceUrl,
          status: "duplicate",
          warnings: [],
          reason: "Duplicate URL skipped.",
        },
      ],
      importedCandidates: [],
      importedCount: 0,
      duplicateCount: 1,
      invalidCount: 0,
      warnings: [],
      importedAt: "2026-04-29T10:00:00.000Z",
    });

    const route = await import("@/app/api/studio/domara/campaigns/[id]/import-listing-urls/route");
    const request = new NextRequest("http://localhost/api/studio/domara/campaigns/casahud-project-import-route/import-listing-urls", {
      method: "POST",
      body: JSON.stringify({ rawUrls: importedCandidate.sourceUrl }),
    });

    const response = await route.POST(request, { params: { id: "casahud-project-import-route" } });
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload.error.code).toBe("DUPLICATE_URLS");
  });
});
