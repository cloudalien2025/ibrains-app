import { describe, expect, it } from "vitest";
import { validateDomaraImageUrls } from "@/lib/studio/domara/image-handling";
import { createDomaraRenderPlan } from "@/lib/studio/domara/render-plan";
import { PropertyVideoPlan } from "@/lib/studio/domara/types";

const planFixture: PropertyVideoPlan = {
  id: "plan-image-fixture",
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

describe("Domara image handling", () => {
  it("accepts valid HTTP(S) image URLs", () => {
    const result = validateDomaraImageUrls([
      "https://images.example.com/one.jpg",
      "http://images.example.com/two.png",
    ]);

    expect(result.acceptedUrls).toEqual(["https://images.example.com/one.jpg", "http://images.example.com/two.png"]);
    expect(result.skippedUrls).toEqual([]);
  });

  it("rejects invalid and unsafe URL forms", () => {
    const result = validateDomaraImageUrls([
      "javascript:alert(1)",
      "https://localhost/file.jpg",
      "https://127.0.0.1/file.jpg",
      "not-a-url",
    ]);

    expect(result.acceptedUrls).toEqual([]);
    expect(result.skippedUrls).toHaveLength(4);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("preserves order of valid images while skipping bad entries", () => {
    const renderPlan = createDomaraRenderPlan({
      plan: planFixture,
      listingInput: {
        country: "Italy",
        title: "Image Order Listing",
        imageUrls: [
          "https://images.example.com/01-wide.jpg?ar=16:9",
          "not-a-url",
          "https://images.example.com/02-vertical.jpg?ar=9:16",
          "javascript:alert(1)",
          "https://images.example.com/03-square.jpg?ar=1:1",
        ],
      },
    });

    expect(renderPlan.imageUrls).toEqual([
      "https://images.example.com/01-wide.jpg?ar=16:9",
      "https://images.example.com/02-vertical.jpg?ar=9:16",
      "https://images.example.com/03-square.jpg?ar=1:1",
    ]);
    expect(renderPlan.skippedImageCount).toBe(2);
    expect(renderPlan.timeline[0]?.imageUrl).toBe("https://images.example.com/01-wide.jpg?ar=16:9");
  });
});
