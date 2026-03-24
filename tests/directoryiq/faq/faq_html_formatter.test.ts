import { describe, expect, it } from "vitest";
import { formatFaqHtml } from "@/lib/directoryiq/faq/faqHtmlFormatter";
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
  support_links: ["https://example.com/listings/alpine-cabin"],
};

describe("faq html formatter", () => {
  it("renders required FAQ page structure", () => {
    const entries: FaqEntry[] = [
      {
        question: "Where is this property located?",
        answer_html: "<p>Yes. Vail, Colorado.</p>",
        answer_plaintext: "Yes. Vail, Colorado.",
        source_facts: ["city"],
        fact_confidence: "confirmed",
        intent_cluster: "location",
        listing_anchor_terms: ["Alpine Cabin"],
        local_anchor_terms: ["Vail"],
        internal_links: ["https://example.com/listings/alpine-cabin"],
        quality_score: 90,
      },
    ];

    const html = formatFaqHtml({ context, faqEntries: entries });
    expect(html).toContain("<h1>");
    expect(html).toContain("faq-item");
    expect(html).toContain("Related links");
  });

  it("replaces internal-jargon titles with listing-grounded traveler title", () => {
    const entries: FaqEntry[] = [
      {
        question: "Is parking available?",
        answer_html: "<p>Parking details are listed on the property page.</p>",
        answer_plaintext: "Parking details are listed on the property page.",
        source_facts: ["parking"],
        fact_confidence: "confirmed",
        intent_cluster: "parking / transit",
        listing_anchor_terms: ["Alpine Cabin"],
        local_anchor_terms: ["Vail"],
        internal_links: ["https://example.com/listings/alpine-cabin"],
        quality_score: 90,
      },
    ];

    const html = formatFaqHtml({
      context: {
        ...context,
        title: "pre selection friction FAQ",
      },
      faqEntries: entries,
    });

    expect(html).toContain("<h1>Alpine Cabin in Vail Traveler FAQ</h1>");
    expect(html).not.toContain("pre selection friction");
  });
});
