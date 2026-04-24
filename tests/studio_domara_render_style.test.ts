import { describe, expect, it } from "vitest";
import { createDomaraRenderPlan } from "@/lib/studio/domara/render-plan";
import { PropertyVideoPlan } from "@/lib/studio/domara/types";

const planFixture: PropertyVideoPlan = {
  id: "plan-style-fixture",
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
      durationSeconds: 10,
    },
    {
      order: 2,
      title: "Closing CTA",
      visualDirection: "Visual",
      narration: "Narration",
      overlayText: "Overlay",
      suggestedMedia: [],
      durationSeconds: 8,
    },
  ],
  narrationScript: "Narration",
  youtubeTitle: "YouTube",
  youtubeDescription: "Description",
  enrichmentSummary: "Location enrichment pending",
  renderPlaceholder: {
    status: "pending_provider_connection",
    nextStep: "Connect renderer",
    provider: "mock",
  },
};

describe("Domara render style and metadata", () => {
  it("applies premium style preset to render metadata", () => {
    const renderPlan = createDomaraRenderPlan({
      plan: planFixture,
      listingInput: {
        country: "Italy",
        title: "Premium Listing",
        source: "Immobiliare.it",
        listingUrl: "https://example.com/listing/abc",
        imageUrls: ["https://images.example.com/hero.jpg"],
      },
      stylePreset: "premium_listing",
    });

    expect(renderPlan.stylePreset).toBe("premium_listing");
    expect(renderPlan.sourceAttribution?.source).toBe("Immobiliare.it");
    expect(renderPlan.sourceAttribution?.listingUrl).toBe("https://example.com/listing/abc");
  });

  it("creates deterministic fallback timeline when scenes are unavailable", () => {
    const renderPlan = createDomaraRenderPlan({
      plan: {
        ...planFixture,
        scenes: [],
      },
      listingInput: {
        country: "Italy",
        title: "Fallback Listing",
        imageUrls: [],
      },
      stylePreset: "property_showcase",
    });

    expect(renderPlan.timeline.length).toBe(4);
    expect(renderPlan.timeline.map((scene) => scene.order)).toEqual([1, 2, 3, 4]);
    expect(renderPlan.stylePreset).toBe("property_showcase");
    expect(renderPlan.totalDurationSeconds).toBeGreaterThan(0);
  });
});
