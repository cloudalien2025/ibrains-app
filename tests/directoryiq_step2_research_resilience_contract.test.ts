import { describe, expect, it } from "vitest";
import {
  classifyStep2ResearchOutcome,
  deriveStep2ResearchFailureMessage,
  deriveStep2ThinResearchMessage,
} from "@/lib/directoryiq/step2ResearchResilience";
import { canCreateStep2FromResearch, classifyStep2ResearchReadiness } from "@/lib/directoryiq/step2ResearchGateContract";

function makeUsableContract(url = "https://example.com/support"): { step2_contract: Record<string, unknown> } {
  return {
    step2_contract: {
      research_artifact: {
        focus_keyword: "best local option",
        top_results: [{ title: "Result", url, rank: 1, content_type: "informational_guide" }],
      },
    },
  };
}

function baseDossier(): Record<string, unknown> {
  return {
    listing_identity: {
      listing_source_id: "src_1",
      listing_id: "listing_1",
      listing_url: "https://example.com/listing",
    },
    step2_slot_research: [{ slot: 1, slot_id: "slot_1", focus_keyword: "best local option" }],
    same_site_support: {
      summary: {
        inbound_count: 1,
        mention_count: 0,
        connected_count: 0,
      },
    },
    first_party_facts: {
      category: "hotel",
      location_city: "Austin",
      location_region: "TX",
      listing_description: "Great location",
    },
    normalized_facts: {
      topic_tokens: ["hotel"],
      intent_tokens: ["booking"],
      location_tokens: ["austin"],
    },
    serp_results: [],
    research_metadata: {
      enrichment_provider: "disabled_phase1",
      enrichment_status: "not_attempted",
      serp_error: "SERP API key not configured.",
    },
  };
}

describe("directoryiq step2 research resilience", () => {
  it("returns ready_thin when SerpAPI is missing but fallback evidence is usable", () => {
    const outcome = classifyStep2ResearchOutcome({
      listingUrl: "https://example.com/listing",
      slotsRequested: 1,
      usableContractsCount: 1,
      dossier: baseDossier(),
      contracts: [makeUsableContract()],
    });

    expect(outcome.state).toBe("ready_thin");
    expect(outcome.qualityReason).toBe("serp_api_missing");
    expect(deriveStep2ThinResearchMessage(outcome.qualityReason)).toContain("SerpAPI is not configured");
  });

  it("returns ready_thin when SERP enrichment is weak/failed but fallback evidence is usable", () => {
    const dossier = baseDossier();
    (dossier.research_metadata as Record<string, unknown>).enrichment_provider = "serpapi";
    (dossier.research_metadata as Record<string, unknown>).enrichment_status = "failed";

    const outcome = classifyStep2ResearchOutcome({
      listingUrl: "https://example.com/listing",
      slotsRequested: 1,
      usableContractsCount: 1,
      dossier,
      contracts: [makeUsableContract()],
    });

    expect(outcome.state).toBe("ready_thin");
    expect(outcome.qualityReason).toBe("serp_enrichment_failed");
  });

  it("returns ready_grounded when SERP grounding is strong", () => {
    const dossier = baseDossier();
    dossier.serp_results = Array.from({ length: 10 }, (_, index) => ({
      title: `Result ${index + 1}`,
      link: `https://example.com/r/${index + 1}`,
      snippet: "snippet",
      position: index + 1,
    }));
    (dossier.research_metadata as Record<string, unknown>).enrichment_provider = "serpapi";
    (dossier.research_metadata as Record<string, unknown>).enrichment_status = "ready";

    const outcome = classifyStep2ResearchOutcome({
      listingUrl: "https://example.com/listing",
      slotsRequested: 1,
      usableContractsCount: 1,
      dossier,
      contracts: [makeUsableContract()],
    });

    expect(outcome.state).toBe("ready_grounded");
    expect(outcome.errorCode).toBeNull();
  });

  it("returns failed when no usable artifact exists", () => {
    const outcome = classifyStep2ResearchOutcome({
      listingUrl: "https://example.com/listing",
      slotsRequested: 1,
      usableContractsCount: 0,
      dossier: baseDossier(),
      contracts: [],
    });

    expect(outcome.state).toBe("failed");
    expect(outcome.errorCode).toBe("DOSSIER_EMPTY");
    expect(deriveStep2ResearchFailureMessage({ code: outcome.errorCode })).toBe("Research failed. Retry after fixing inputs.");
  });

  it("returns failed when fallback artifact misses required listing evidence", () => {
    const dossier = {
      ...baseDossier(),
      listing_identity: {},
      same_site_support: { summary: { inbound_count: 0, mention_count: 0, connected_count: 0 } },
      first_party_facts: {},
      normalized_facts: { topic_tokens: [], intent_tokens: [], location_tokens: [] },
    };
    const outcome = classifyStep2ResearchOutcome({
      listingUrl: null,
      slotsRequested: 1,
      usableContractsCount: 1,
      dossier,
      contracts: [makeUsableContract()],
    });

    expect(outcome.state).toBe("failed");
    expect(outcome.errorCode).toBe("FALLBACK_RESEARCH_UNUSABLE");
    expect(deriveStep2ResearchFailureMessage({ code: outcome.errorCode })).toBe(
      "Research artifact is missing required listing evidence."
    );
  });
});

describe("directoryiq step2 gate contract", () => {
  it("keeps grounded as highest quality and thin as safe-create fallback", () => {
    expect(canCreateStep2FromResearch("ready_grounded")).toBe(true);
    expect(canCreateStep2FromResearch("ready_thin")).toBe(true);
    expect(canCreateStep2FromResearch("failed")).toBe(false);

    const groundedReadiness = classifyStep2ResearchReadiness({
      focus_keyword: "best local option",
      top_results: [
        { title: "1", url: "https://example.com/1" },
        { title: "2", url: "https://example.com/2" },
        { title: "3", url: "https://example.com/3" },
      ],
      faq_patterns: ["q1", "q2"],
      entities: { amenities: ["wifi"], location: ["austin"], intent: ["booking"] },
      same_site_evidence: [{ title: "support" }],
    });
    const thinReadiness = classifyStep2ResearchReadiness({
      focus_keyword: "best local option",
      top_results: [{ title: "1", url: "https://example.com/1" }],
      faq_patterns: [],
      entities: { amenities: [], location: [], intent: [] },
      same_site_evidence: [],
    });

    expect(groundedReadiness).toBe("grounded");
    expect(thinReadiness).toBe("thin");
  });
});
