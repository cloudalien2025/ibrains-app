import { describe, expect, it } from "vitest";
import { composeFaqAnswers } from "@/lib/directoryiq/faq/faqAnswerComposer";
import type { ListingFaqContext } from "@/lib/directoryiq/faq/types";

function context(): ListingFaqContext {
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
    neighborhood: "",
    country: "US",
    canonical_url: "https://example.com/listings/alpine-cabin",
    title: "Alpine Cabin",
    description: "",
    amenities: ["wifi", "hot tub"],
    occupancy: "8",
    bedrooms: "3",
    bathrooms: "2",
    pet_policy: "",
    parking: "2 spaces",
    wifi: "Yes",
    kitchen: "Yes",
    pool: "",
    hot_tub: "Yes",
    fireplace: "",
    family_friendly: "",
    child_friendly_signals: [],
    checkin_info: "4pm",
    checkout_info: "10am",
    cancellation_policy: "Moderate",
    booking_rules: ["No parties"],
    location_signals: [],
    nearby_landmarks: [],
    nearby_activities: [],
    seasonal_relevance: [],
    differentiators: ["Mountain views"],
    known_facts: ["occupancy"],
    inferred_facts: [],
    unknown_facts: ["pet_policy"],
    fact_confidence_map: { family_friendly: "unknown" },
    support_links: ["https://example.com/listings/alpine-cabin"],
  };
}

describe("faq answer composer", () => {
  it("starts with direct answer and qualifies unknown facts", () => {
    const entries = composeFaqAnswers({
      context: context(),
      selectedQuestions: [
        {
          question_text: "Are pets allowed?",
          cluster: "pet suitability",
          listing_specificity_score: 0.7,
          fact_coverage_score: 0,
          selection_intent_score: 0.8,
          hallucination_risk_score: 0.8,
          drop_reason: null,
        },
      ],
    });

    expect(entries).toHaveLength(1);
    expect(entries[0]?.answer_plaintext.toLowerCase()).toContain("verify");
    expect(entries[0]?.fact_confidence).toBe("unknown");
  });
});
