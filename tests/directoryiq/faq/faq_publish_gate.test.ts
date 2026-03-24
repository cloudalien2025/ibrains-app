import { describe, expect, it } from "vitest";
import { applyFaqPublishGate } from "@/lib/directoryiq/faq/faqPublishGate";
import type { FaqValidationResult, ListingFaqContext } from "@/lib/directoryiq/faq/types";

const baseContext: ListingFaqContext = {
  listing_id: "1",
  site_id: "site",
  listing_name: "Alpine Cabin",
  listing_type: "vacation rental",
  listing_archetype: "vacation_rental",
  category: "Vacation Rentals",
  subcategory: "Cabin",
  city: "Vail",
  region: "Colorado",
  neighborhood: "",
  country: "US",
  canonical_url: "https://example.com/listings/alpine-cabin",
  title: "Alpine Cabin",
  description: "",
  amenities: [],
  occupancy: "",
  bedrooms: "",
  bathrooms: "",
  pet_policy: "",
  parking: "",
  wifi: "",
  kitchen: "",
  pool: "",
  hot_tub: "",
  fireplace: "",
  family_friendly: "",
  child_friendly_signals: [],
  checkin_info: "",
  checkout_info: "",
  cancellation_policy: "",
  booking_rules: [],
  location_signals: [],
  nearby_landmarks: [],
  nearby_activities: [],
  seasonal_relevance: [],
  differentiators: [],
  known_facts: ["parking", "wifi", "checkin_info"],
  inferred_facts: [],
  unknown_facts: ["pet_policy"],
  fact_confidence_map: {},
  support_links: [],
};

const qualityPass: FaqValidationResult = {
  quality: {
    listing_specificity: 80,
    local_relevance: 75,
    directness: 82,
    factual_grounding: 78,
    selection_intent_coverage: 80,
    generic_language_penalty: 10,
    hallucination_risk: 20,
    answer_completeness: 82,
    internal_link_quality: 90,
  },
  blockedReasons: [],
};

describe("faq publish gate", () => {
  it("allows publish for grounded output", () => {
    const result = applyFaqPublishGate({
      context: baseContext,
      validation: qualityPass,
      finalFaqEntryCount: 7,
    });

    expect(result.allowPublish).toBe(true);
  });

  it("blocks publish for weak outputs", () => {
    const result = applyFaqPublishGate({
      context: {
        ...baseContext,
        known_facts: ["parking"],
        unknown_facts: ["a", "b", "c", "d"],
      },
      validation: {
        ...qualityPass,
        quality: {
          ...qualityPass.quality,
          generic_language_penalty: 50,
        },
      },
      finalFaqEntryCount: 3,
    });

    expect(result.allowPublish).toBe(false);
    expect(result.reasons.length).toBeGreaterThan(0);
  });
});
