import { describe, expect, it } from "vitest";
import { evaluateFaqQuality } from "@/lib/directoryiq/faq/faqQualityValidator";
import type { FaqEntry, ListingFaqContext } from "@/lib/directoryiq/faq/types";

const context: ListingFaqContext = {
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
  known_facts: [],
  inferred_facts: [],
  unknown_facts: [],
  fact_confidence_map: {},
  support_links: [],
};

describe("faq quality validator", () => {
  it("penalizes generic filler language", () => {
    const faqEntries: FaqEntry[] = [
      {
        question: "Q",
        answer_html: "<p>It is important to review details.</p>",
        answer_plaintext: "It is important to review details. This can help travelers decide.",
        source_facts: [],
        fact_confidence: "unknown",
        intent_cluster: "location",
        listing_anchor_terms: [],
        local_anchor_terms: [],
        internal_links: [],
        quality_score: 20,
      },
    ];

    const result = evaluateFaqQuality({ context, faqEntries, selectedClusters: ["location"] });
    expect(result.quality.generic_language_penalty).toBeGreaterThan(0);
    expect(result.blockedReasons).toContain("generic language penalty too high");
  });

  it("blocks repetitive fallback-heavy output and internal jargon titles", () => {
    const faqEntries: FaqEntry[] = [
      {
        question: "Q1",
        answer_html: "<p>Verified parking details are not currently listed.</p>",
        answer_plaintext: "Verified parking details are not currently listed. Check the listing page and confirm this with the host before booking.",
        source_facts: [],
        fact_confidence: "unknown",
        intent_cluster: "parking / transit",
        listing_anchor_terms: [],
        local_anchor_terms: [],
        internal_links: [],
        quality_score: 20,
      },
      {
        question: "Q2",
        answer_html: "<p>Verified parking details are not currently listed.</p>",
        answer_plaintext: "Verified parking details are not currently listed. Check the listing page and confirm this with the host before booking.",
        source_facts: [],
        fact_confidence: "unknown",
        intent_cluster: "availability",
        listing_anchor_terms: [],
        local_anchor_terms: [],
        internal_links: [],
        quality_score: 20,
      },
    ];

    const result = evaluateFaqQuality({
      context: {
        ...context,
        title: "pre selection friction FAQ",
      },
      faqEntries,
      selectedClusters: ["parking / transit", "availability"],
    });

    expect(result.blockedReasons).toContain("fallback answer ratio too high");
    expect(result.blockedReasons).toContain("grounded fact diversity too low");
    expect(result.blockedReasons).toContain("title contains internal jargon");
  });
});
