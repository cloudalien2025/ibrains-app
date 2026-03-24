import { describe, expect, it } from "vitest";
import { buildListingFaqSupportEngine } from "@/lib/directoryiq/faq/engine";

describe("faq engine integration", () => {
  it("generates vacation-rental FAQ output with publish pass", () => {
    const result = buildListingFaqSupportEngine({
      listingId: "site-1:651",
      siteId: "site-1",
      listingName: "Tivoli Lodge",
      listingType: "vacation rental",
      canonicalUrl: "https://example.com/listings/tivoli-lodge",
      title: "Tivoli Lodge",
      description: "Mountain stay near lifts",
      raw: {
        city: "Vail",
        region: "Colorado",
        amenities: ["wifi", "hot tub", "kitchen"],
        bedrooms: "3",
        bathrooms: "2",
        occupancy: "8",
        parking: "Onsite",
        checkin_info: "4pm",
        checkout_info: "10am",
        cancellation_policy: "Moderate",
        booking_rules: ["No parties"],
        nearby_landmarks: ["Vail Village"],
        nearby_activities: ["Skiing"],
      },
    });

    expect(result.selected_questions.length).toBeGreaterThanOrEqual(6);
    expect(result.publish_gate_result.allowPublish).toBe(true);
    expect(result.rendered_html).toContain("<h1>");
  });

  it("supports non-rental fallback archetype path", () => {
    const result = buildListingFaqSupportEngine({
      listingId: "site-1:987",
      siteId: "site-1",
      listingName: "Acme Tax Advisors",
      listingType: "professional services",
      canonicalUrl: "https://example.com/listings/acme-tax",
      title: "Acme Tax Advisors",
      description: "Local tax advisory firm",
      raw: {
        city: "Austin",
        region: "Texas",
        category: "Accounting",
        booking_rules: ["By appointment"],
      },
    });

    expect(result.context.listing_archetype === "local_service" || result.context.listing_archetype === "other_business").toBe(true);
    expect(result.selected_questions.length).toBeGreaterThanOrEqual(6);
  });
});
