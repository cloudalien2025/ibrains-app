import { describe, expect, it } from "vitest";
import { resolveFaqIntentClusters } from "@/lib/directoryiq/faq/faqIntentClusters";
import type { ListingFaqContext } from "@/lib/directoryiq/faq/types";

function baseContext(): ListingFaqContext {
  return {
    listing_id: "1",
    site_id: "site",
    listing_name: "Alpine Cabin",
    listing_type: "vacation rental",
    listing_archetype: "vacation_rental",
    category: "Vacation Rentals",
    subcategory: "Cabin",
    city: "Vail",
    region: "Colorado",
    neighborhood: "Vail Village",
    country: "US",
    canonical_url: "https://example.com/listings/alpine-cabin",
    title: "Alpine Cabin",
    description: "",
    amenities: ["wifi", "hot tub"],
    occupancy: "8",
    bedrooms: "3",
    bathrooms: "2",
    pet_policy: "No pets",
    parking: "2 spaces",
    wifi: "Yes",
    kitchen: "Full kitchen",
    pool: "",
    hot_tub: "Yes",
    fireplace: "Yes",
    family_friendly: "",
    child_friendly_signals: [],
    checkin_info: "4pm",
    checkout_info: "10am",
    cancellation_policy: "Moderate",
    booking_rules: ["No parties"],
    location_signals: ["Walkable"],
    nearby_landmarks: ["Gondola"],
    nearby_activities: ["Skiing"],
    seasonal_relevance: ["Winter ski season"],
    differentiators: ["Mountain views"],
    known_facts: ["parking"],
    inferred_facts: [],
    unknown_facts: [],
    fact_confidence_map: {
      parking: "confirmed",
    },
    support_links: ["https://example.com/listings/alpine-cabin"],
  };
}

describe("faq intent clusters", () => {
  it("returns archetype-aware vacation rental clusters", () => {
    const clusters = resolveFaqIntentClusters(baseContext());
    expect(clusters[0]?.cluster_name).toBeDefined();
    expect(clusters.some((cluster) => cluster.cluster_name === "occupancy")).toBe(true);
    expect(clusters.some((cluster) => cluster.cluster_name === "check-in logistics")).toBe(true);
  });
});
