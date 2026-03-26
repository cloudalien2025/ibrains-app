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
  describe("deriveStep2ResearchState — thin artifacts", () => {
    it("classifies thin artifact as ready_thin when requested state is not_started", () => {
      expect(
        deriveStep2ResearchState({
          requestedState: "not_started",
          hasUsableResearchArtifact: true,
          researchArtifact: thinArtifact,
        })
      ).toBe("ready_thin");
    });

    it("classifies thin artifact as ready_thin when requested state is queued", () => {
      expect(
        deriveStep2ResearchState({
          requestedState: "queued",
          hasUsableResearchArtifact: true,
          researchArtifact: thinArtifact,
        })
      ).toBe("ready_thin");
    });
  });

  describe("deriveStep2ResearchState — grounded artifacts", () => {
    it("classifies grounded artifact as ready_grounded when requested state is not_started", () => {
      expect(
        deriveStep2ResearchState({
          requestedState: "not_started",
          hasUsableResearchArtifact: true,
          researchArtifact: groundedArtifact,
        })
      ).toBe("ready_grounded");
    });

    it("classifies grounded artifact as ready_grounded when requested state is queued", () => {
      expect(
        deriveStep2ResearchState({
          requestedState: "queued",
          hasUsableResearchArtifact: true,
          researchArtifact: groundedArtifact,
        })
      ).toBe("ready_grounded");
    });
  });

  describe("deriveStep2ResearchState — missing/unusable artifacts", () => {
    it("preserves in-flight state (researching) when artifact is absent", () => {
      expect(
        deriveStep2ResearchState({
          requestedState: "researching",
          hasUsableResearchArtifact: false,
          researchArtifact: undefined,
        })
      ).toBe("researching");
    });

    it("preserves in-flight state (queued) when artifact is empty", () => {
      expect(
        deriveStep2ResearchState({
          requestedState: "queued",
          hasUsableResearchArtifact: false,
          researchArtifact: { focus_keyword: "keyword", top_results: [] },
        })
      ).toBe("queued");
    });

    it("resets ready_thin to not_started when artifact is missing", () => {
      expect(
        deriveStep2ResearchState({
          requestedState: "ready_thin",
          hasUsableResearchArtifact: false,
          researchArtifact: { focus_keyword: "", top_results: [] },
        })
      ).toBe("not_started");
    });

    it("resets ready_grounded to not_started when artifact is missing", () => {
      expect(
        deriveStep2ResearchState({
          requestedState: "ready_grounded",
          hasUsableResearchArtifact: false,
          researchArtifact: { focus_keyword: "", top_results: [] },
        })
      ).toBe("not_started");
    });
  });

  describe("isStep2ResearchReady", () => {
    it("treats only ready_grounded as grounded-ready", () => {
      expect(isStep2ResearchReady("ready_thin")).toBe(false);
      expect(isStep2ResearchReady("ready_grounded")).toBe(true);
      expect(isStep2ResearchReady("not_started")).toBe(false);
      expect(isStep2ResearchReady("queued")).toBe(false);
      expect(isStep2ResearchReady("researching")).toBe(false);
      expect(isStep2ResearchReady("failed")).toBe(false);
    });
  });
});
