import { describe, expect, it } from "vitest";
import {
  MISSION_CONTROL_STEPS,
  REQUIRED_VALID_SUPPORT_COUNT,
  STEP3_UNLOCK_CONTRACT,
  SUPPORT_SLOT_TAXONOMY,
  normalizeSupportCandidates,
  summarizeSupportValidity,
} from "@/lib/directoryiq/missionControlContract";

describe("mission control canonical contract", () => {
  it("defines the three-step mission contract in product order", () => {
    expect(MISSION_CONTROL_STEPS.map((step) => step.label)).toEqual([
      "Step 1: Find Support",
      "Step 2: Create Support",
      "Step 3: Optimize Listing",
    ]);
  });

  it("defines the five required support slot families", () => {
    const labels = SUPPORT_SLOT_TAXONOMY.map((slot) => slot.label);
    expect(labels).toContain("Best-of / Recommendation");
    expect(labels).toContain("Audience-Fit / Use-Case");
    expect(labels).toContain("Location-Intent / Proximity");
    expect(labels).toContain("Comparison / Alternatives");
    expect(labels).toContain("Experience / Itinerary / Problem-Solving");
  });

  it("uses conservative validity and unlock thresholds", () => {
    expect(REQUIRED_VALID_SUPPORT_COUNT).toBe(5);
    expect(STEP3_UNLOCK_CONTRACT.lockBody).toContain("5 valid support posts");

    const normalized = normalizeSupportCandidates({
      inboundLinkedSupport: [
        {
          id: "a1",
          title: "Best local plumber comparison guide",
          url: "https://example.com/compare",
          sourceType: "blog_post",
          anchors: ["compare local plumbers"],
          relationshipType: "links_to_listing",
        },
      ],
      mentionsWithoutLinks: [
        {
          id: "m1",
          title: "Plumber checklist mention",
          url: "https://example.com/checklist",
          sourceType: "blog_post",
          anchors: [],
          relationshipType: "mentions_without_link",
        },
      ],
    });

    const summary = summarizeSupportValidity(normalized);
    expect(summary.validCount).toBe(1);
    expect(summary.upgradeCandidateCount).toBe(0);
    expect(summary.invalidCount).toBe(1);
    expect(summary.requiredValidSupportCount).toBe(5);
    expect(summary.missingValidSupportCount).toBe(4);
  });
});

