import { describe, expect, it } from "vitest";
import { evaluateListingSelection, type ListingSelectionInput } from "@/lib/directoryiq/selectionEngine";

function baseInput(): ListingSelectionInput {
  return {
    listingId: "listing-1",
    title: "Sample Listing",
    description:
      "Service area includes Miami and Fort Lauderdale. We provide HVAC repair and installation with same-day booking and transparent pricing. Contact by phone or form.",
    category: "HVAC",
    location: "Miami, FL",
    contact: "(555) 222-1111",
    ctaText: "Book service now",
    schemaSignals: ["LocalBusiness", "Service"],
    taxonomySignals: ["HVAC", "Repair"],
    credentialsSignals: ["licensed"],
    reviewCount: 34,
    averageRating: 4.6,
    evidenceSignals: ["portfolio"],
    identitySignals: ["business_name", "nap_phone"],
    internalMentionsCount: 4,
    clusterDensity: 0.6,
    orphanRisk: 0.2,
    vertical: "home-services",
    authorityPosts: [
      {
        slot: 1,
        type: "contextual_guide",
        status: "published",
        focusTopic: "best HVAC maintenance plan",
        title: "HVAC Maintenance Guide",
        qualityScore: 80,
        blogToListingLinked: true,
        listingToBlogLinked: true,
      },
    ],
  };
}

describe("directoryiq selection engine", () => {
  it("applies structure hard-fail cap at 45", () => {
    const input = baseInput();
    input.description = "";
    const evaluation = evaluateListingSelection(input);
    expect(evaluation.totalScore).toBeLessThanOrEqual(45);
    expect(evaluation.flags.structuralHardFailActive).toBe(true);
  });

  it("applies clarity cap when clarity is low", () => {
    const input = baseInput();
    input.description = "Best best best very highly extremely great service.";
    const evaluation = evaluateListingSelection(input);
    expect(evaluation.flags.ambiguityPenaltyApplied).toBe(true);
    expect(evaluation.totalScore).toBeLessThanOrEqual(70);
  });

  it("enforces authority link cap when bidirectional links are missing", () => {
    const input = baseInput();
    input.authorityPosts[0].listingToBlogLinked = false;
    const evaluation = evaluateListingSelection(input);
    expect(evaluation.flags.authorityCeilingActive).toBe(true);
    expect(evaluation.totalScore).toBeLessThanOrEqual(50);
  });
});
