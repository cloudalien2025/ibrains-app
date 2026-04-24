import { describe, expect, it } from "vitest";
import { createDomaraRenderPlan } from "@/lib/studio/domara/render-plan";
import { PropertyVideoPlan } from "@/lib/studio/domara/types";

const basePlan: PropertyVideoPlan = {
  id: "plan-test-001",
  channel: "Expat AI",
  status: "draft_plan_ready",
  listingSummary: "Summary",
  hook: "Hook line",
  scenes: [
    {
      order: 1,
      title: "Opening Hook",
      visualDirection: "Visual",
      narration: "Narration 1",
      overlayText: "Overlay 1",
      suggestedMedia: [],
      durationSeconds: 7,
    },
    {
      order: 2,
      title: "Property Overview",
      visualDirection: "Visual",
      narration: "Narration 2",
      overlayText: "Overlay 2",
      suggestedMedia: [],
      durationSeconds: 10,
    },
    {
      order: 3,
      title: "Closing CTA",
      visualDirection: "Visual",
      narration: "Narration 3",
      overlayText: "Overlay 3",
      suggestedMedia: [],
      durationSeconds: 8,
    },
  ],
  narrationScript: "Script",
  youtubeTitle: "Title",
  youtubeDescription: "Description",
  enrichmentSummary: "Enrichment",
  renderPlaceholder: {
    status: "pending_provider_connection",
    nextStep: "Next",
    provider: "Provider",
  },
};

describe("createDomaraRenderPlan", () => {
  it("maps PropertyVideoPlan into a non-empty render timeline preserving scene order", () => {
    const renderPlan = createDomaraRenderPlan({
      plan: basePlan,
      listingInput: {
        country: "Italy",
        title: "Florence Apartment",
        imageUrls: ["https://example.com/image-1.jpg", "https://example.com/image-2.jpg"],
      },
    });

    expect(renderPlan.timeline.length).toBe(3);
    expect(renderPlan.timeline.map((scene) => scene.order)).toEqual([1, 2, 3]);
    expect(renderPlan.timeline[0]?.imageUrl).toBe("https://example.com/image-1.jpg");
    expect(renderPlan.timeline[1]?.imageUrl).toBe("https://example.com/image-2.jpg");
    expect(renderPlan.timeline[2]?.imageUrl).toBe("https://example.com/image-1.jpg");
  });

  it("creates a valid fallback render plan when image array is empty", () => {
    const renderPlan = createDomaraRenderPlan({
      plan: basePlan,
      listingInput: {
        country: "Italy",
        title: "Fallback Listing",
        imageUrls: [],
      },
    });

    expect(renderPlan.timeline.length).toBeGreaterThan(0);
    expect(renderPlan.imageUrls).toEqual([]);
    expect(renderPlan.totalDurationSeconds).toBeGreaterThan(0);
  });

  it("includes Domara/Expat AI metadata without requiring credentials", () => {
    const renderPlan = createDomaraRenderPlan({
      plan: basePlan,
      listingInput: {
        country: "Italy",
        title: "Metadata Listing",
        imageUrls: [],
      },
    });

    expect(renderPlan.channel).toBe("Expat AI");
    expect(renderPlan.useCase).toBe("property_video_engine");
    expect(renderPlan.renderMode).toBe("mock-first local render");
  });
});

