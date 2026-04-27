import { describe, expect, it } from "vitest";
import {
  buildSuggestedDiscoverySources,
  generateMockCandidatesFromSavedSources,
  validateDiscoverySourceUrl,
} from "@/lib/studio/domara/discovery-source-provider";
import {
  buildShortlist,
  createDefaultCampaign,
  createSuggestedDiscoverySources,
  discoverCandidatesFromSavedSources,
  generateResearchBrief,
  generateTitleIdeas,
  rankListingCandidates,
} from "@/lib/studio/domara/campaign-workflow";
import type { DiscoverySource } from "@/lib/studio/domara/types";

describe("Domara discovery source provider seam", () => {
  it("creates suggested saved discovery sources from research brief markets", () => {
    const campaign = createDefaultCampaign();
    const brief = generateResearchBrief(campaign, generateTitleIdeas(campaign)[0]!);

    const sources = createSuggestedDiscoverySources(campaign, brief);

    expect(sources.length).toBeGreaterThan(0);
    expect(sources.every((source) => source.campaignId === campaign.id)).toBe(true);
    expect(sources.some((source) => source.marketTags.some((tag) => brief.markets.includes(tag)))).toBe(true);
    expect(sources.every((source) => source.sourceUrl.startsWith("https://"))).toBe(true);
  });

  it("generates deterministic mock candidates from saved sources", () => {
    const campaign = createDefaultCampaign();
    const brief = generateResearchBrief(campaign, generateTitleIdeas(campaign)[0]!);
    const sources = buildSuggestedDiscoverySources(campaign, brief).slice(0, 3);

    const first = generateMockCandidatesFromSavedSources(campaign, brief, sources);
    const second = generateMockCandidatesFromSavedSources(campaign, brief, sources);

    expect(first.generatedAt).toBe(second.generatedAt);
    expect(first.candidates.map((candidate) => candidate.id)).toEqual(second.candidates.map((candidate) => candidate.id));
    expect(first.batches).toEqual(second.batches);
  });

  it("preserves source attribution/compliance metadata on generated candidates", () => {
    const campaign = createDefaultCampaign();
    const brief = generateResearchBrief(campaign, generateTitleIdeas(campaign)[0]!);
    const sources = buildSuggestedDiscoverySources(campaign, brief).slice(0, 1);

    const result = discoverCandidatesFromSavedSources(campaign, brief, sources);
    const first = result.candidates[0]!;

    expect(first.providerMetadata?.sourceId).toBe(sources[0]!.id);
    expect(first.providerMetadata?.sourceType).toBe(sources[0]!.sourceType);
    expect(first.providerMetadata?.sourceName).toBe(sources[0]!.name);
    expect(first.providerMetadata?.discoveryMode).toBe("mock");
    expect(String(first.providerMetadata?.complianceNote)).toContain("No live crawling");
  });

  it("bridges generated candidates into ranking and shortlist flow", () => {
    const campaign = createDefaultCampaign();
    const brief = generateResearchBrief(campaign, generateTitleIdeas(campaign)[0]!);
    const sources = createSuggestedDiscoverySources(campaign, brief);
    const discovered = discoverCandidatesFromSavedSources(campaign, brief, sources);

    const ranked = rankListingCandidates(campaign, brief, discovered.candidates);
    const shortlist = buildShortlist(ranked, 3);

    expect(ranked.length).toBeGreaterThan(0);
    expect(shortlist.length).toBeGreaterThan(0);
    expect(shortlist.every((entry) => entry.candidate.status === "shortlist")).toBe(true);
  });

  it("ranks on-brief source candidates above mismatched source candidates", () => {
    const campaign = createDefaultCampaign();
    const brief = generateResearchBrief(campaign, generateTitleIdeas(campaign)[0]!);

    const strongSource: DiscoverySource = {
      id: "source-strong",
      campaignId: campaign.id,
      name: "Sicily coastal under budget",
      sourceType: "immobiliare",
      sourceUrl: "https://www.immobiliare.it/search/sicily/apartment?max=400000",
      marketTags: ["Sicily"],
      regionTags: ["Sicily"],
      cityTags: ["Palermo"],
      propertyTypeTags: ["apartment"],
      budgetMin: 120000,
      budgetMax: 400000,
      currency: "EUR",
      buyerPersonaTags: [campaign.buyerPersona],
      poiPriorityTags: brief.poiPriorities,
      status: "ready",
      candidateCount: 0,
      importedCandidateCount: 0,
      rejectedCandidateCount: 0,
      confidence: 0.92,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };

    const weakSource: DiscoverySource = {
      id: "source-weak",
      campaignId: campaign.id,
      name: "Mismatched mountain inventory",
      sourceType: "other",
      sourceUrl: "https://www.example.com/search/mountains/studio?max=900000",
      marketTags: ["Umbria"],
      regionTags: ["Umbria"],
      cityTags: ["Unknown"],
      propertyTypeTags: ["studio"],
      budgetMin: 500000,
      budgetMax: 900000,
      currency: "EUR",
      buyerPersonaTags: ["generic"],
      poiPriorityTags: ["airport"],
      status: "ready",
      candidateCount: 0,
      importedCandidateCount: 0,
      rejectedCandidateCount: 0,
      confidence: 0.51,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };

    const result = generateMockCandidatesFromSavedSources(campaign, brief, [strongSource, weakSource]);
    const ranked = rankListingCandidates(campaign, brief, result.candidates);

    const topSourceId = ranked[0]?.candidate.providerMetadata?.sourceId;
    expect(topSourceId).toBe("source-strong");
  });

  it("operates without live network or provider credentials", () => {
    const validation = validateDiscoverySourceUrl("https://www.idealista.it/search/puglia/villa?max=400000");

    expect(validation.valid).toBe(true);
    expect(validation.reason).toBeUndefined();
  });
});
