import { describe, expect, it } from "vitest";
import {
  deriveStep2ResearchState,
  isStep2ResearchReady,
} from "@/lib/directoryiq/step2ResearchGateContract";

const thinArtifact = {
  focus_keyword: "cedar at streamside comparison",
  top_results: [{ title: "Listing", url: "https://example.com/listings/cedar-at-streamside", rank: 1 }],
};

const groundedArtifact = {
  ...thinArtifact,
  top_results: [
    { title: "Listing", url: "https://example.com/listings/cedar-at-streamside", rank: 1 },
    { title: "Guide", url: "https://example.com/guides/streamside", rank: 2 },
    { title: "Comparison", url: "https://example.com/comparisons/streamside", rank: 3 },
  ],
  faq_patterns: ["pricing", "amenities"],
  same_site_evidence: [{ title: "Support", url: "https://example.com/support/streamside" }],
  entities: {
    amenities: ["wifi"],
    location: ["Vail"],
    intent: ["comparison"],
  },
};

describe("DirectoryIQ Step 2 research gate contract", () => {
  it("normalizes legacy ready + thin artifacts into ready_thin", () => {
    expect(
      deriveStep2ResearchState({
        requestedState: "ready",
        hasUsableResearchArtifact: true,
        researchArtifact: thinArtifact,
      })
    ).toBe("ready_thin");
  });

  it("normalizes legacy ready + grounded artifacts into ready_grounded", () => {
    expect(
      deriveStep2ResearchState({
        requestedState: "ready",
        hasUsableResearchArtifact: true,
        researchArtifact: groundedArtifact,
      })
    ).toBe("ready_grounded");
  });

  it("keeps legacy ready without usable research artifacts as ready until input normalization reclassifies it", () => {
    expect(
      deriveStep2ResearchState({
        requestedState: "ready",
        hasUsableResearchArtifact: false,
        researchArtifact: { focus_keyword: "fixture keyword", top_results: [] },
      })
    ).toBe("ready");
  });

  it("treats only ready_grounded as grounded-ready downstream", () => {
    expect(isStep2ResearchReady("ready")).toBe(false);
    expect(isStep2ResearchReady("ready_thin")).toBe(false);
    expect(isStep2ResearchReady("ready_grounded")).toBe(true);
  });
});
