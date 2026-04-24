import { describe, expect, it } from "vitest";
import { generatePropertyVideoPlan } from "@/lib/studio/domara/property-video-plan";

describe("Domara property video plan", () => {
  it("builds a structured mock-first Expat AI plan", async () => {
    const plan = await generatePropertyVideoPlan({
      country: "Italy",
      city: "Florence",
      region: "Tuscany",
      title: "Oltrarno Terrace Apartment",
      price: "€840,000",
      propertyType: "Apartment",
      bedrooms: 2,
      bathrooms: 2,
      squareMeters: 122,
      description: "Recently renovated apartment with terrace and Duomo skyline views.",
      imageUrls: ["https://example.com/1.jpg", "https://example.com/2.jpg"],
      contentAngle: "second_home",
    });

    expect(plan.channel).toBe("Expat AI");
    expect(plan.status).toBe("draft_plan_ready");
    expect(plan.hook.toLowerCase()).toContain("italian");
    expect(plan.scenes).toHaveLength(7);
    expect(plan.scenes[0]?.title).toBe("Opening Hook");
    expect(plan.scenes[6]?.title).toBe("Closing CTA");
    expect(plan.youtubeTitle).toContain("Italy Property Tour");
    expect(plan.youtubeDescription).toContain("informational storytelling");
    expect(plan.enrichmentSummary).toContain("Location enrichment pending");
    expect(plan.renderPlaceholder.status).toBe("pending_provider_connection");
  });
});

