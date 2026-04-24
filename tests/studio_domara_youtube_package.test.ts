import { describe, expect, it } from "vitest";
import { generateDomaraYouTubePackage } from "@/lib/studio/domara/youtube-package";
import { PropertyVideoPlan } from "@/lib/studio/domara/types";

const plan: PropertyVideoPlan = {
  id: "plan-yt-1",
  channel: "Expat AI",
  status: "draft_plan_ready",
  listingSummary: "Summary",
  hook: "Hook",
  scenes: [
    {
      order: 1,
      title: "Opening Hook",
      visualDirection: "Visual",
      narration: "Narration",
      overlayText: "Overlay",
      suggestedMedia: [],
      durationSeconds: 8,
    },
    {
      order: 2,
      title: "Location Context",
      visualDirection: "Visual",
      narration: "Narration",
      overlayText: "Overlay",
      suggestedMedia: [],
      durationSeconds: 12,
    },
    {
      order: 3,
      title: "Closing CTA",
      visualDirection: "Visual",
      narration: "Narration",
      overlayText: "Overlay",
      suggestedMedia: [],
      durationSeconds: 10,
    },
  ],
  narrationScript: "Script",
  youtubeTitle: "Base title",
  youtubeDescription: "Base description",
  enrichmentSummary: "Enrichment",
  renderPlaceholder: {
    status: "pending_provider_connection",
    nextStep: "next",
    provider: "mock",
  },
};

describe("Domara YouTube package", () => {
  it("generates package from plan with multiple title variants", () => {
    const pkg = generateDomaraYouTubePackage({
      plan,
      listingInput: {
        country: "Italy",
        city: "Florence",
        title: "Oltrarno Apartment",
        imageUrls: [],
      },
    });

    expect(pkg.finalRecommendedTitle.length).toBeGreaterThan(10);
    expect(pkg.titleVariants.length).toBeGreaterThanOrEqual(6);
  });

  it("includes source attribution in description", () => {
    const pkg = generateDomaraYouTubePackage({
      plan,
      listingInput: {
        country: "Italy",
        city: "Florence",
        title: "Oltrarno Apartment",
        listingUrl: "https://example.com/listing/1",
        source: "Immobiliare.it",
        imageUrls: [],
      },
    });

    expect(pkg.description).toContain("Source attribution:");
    expect(pkg.description).toContain("Immobiliare.it");
    expect(pkg.description).toContain("https://example.com/listing/1");
  });

  it("aligns chapters to scenes", () => {
    const pkg = generateDomaraYouTubePackage({
      plan,
      listingInput: {
        country: "Italy",
        title: "Oltrarno Apartment",
        imageUrls: [],
      },
    });

    expect(pkg.chapters).toHaveLength(plan.scenes.length);
    expect(pkg.chapters[0]?.timestamp).toBe("0:00");
    expect(pkg.chapters[1]?.title).toBe("Location Context");
  });

  it("uses non-promissory investment language", () => {
    const pkg = generateDomaraYouTubePackage({
      plan,
      listingInput: {
        country: "Italy",
        title: "Investment Listing",
        imageUrls: [],
        contentAngle: "investment",
      },
    });

    const allText = `${pkg.description} ${pkg.finalRecommendedTitle} ${pkg.metadata.complianceNote}`.toLowerCase();
    expect(allText).not.toContain("guaranteed returns");
    expect(allText).toContain("not financial or investment advice");
  });

  it("creates shorts ideas with hook, caption, and title drafts", () => {
    const pkg = generateDomaraYouTubePackage({
      plan,
      listingInput: {
        country: "Italy",
        title: "Shorts Listing",
        imageUrls: [],
      },
    });

    expect(pkg.shortsIdeas.length).toBeGreaterThanOrEqual(3);
    expect(pkg.shortsIdeas[0]?.hook).toBeTruthy();
    expect(pkg.shortsIdeas[0]?.captionDraft).toBeTruthy();
    expect(pkg.shortsIdeas[0]?.titleDraft).toBeTruthy();
  });
});
