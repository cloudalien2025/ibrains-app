import type { FactConfidence, FaqEntry, FaqQuestionCandidate, ListingFaqContext } from "@/lib/directoryiq/faq/types";

function htmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function firstNonEmpty(values: string[]): string {
  return values.map((value) => value.trim()).find(Boolean) ?? "";
}

function clusterFacts(cluster: string, context: ListingFaqContext): { values: string[]; confidence: FactConfidence } {
  const map: Record<string, string[]> = {
    location: [context.neighborhood, context.city, context.region],
    "attraction proximity": context.nearby_landmarks,
    "seasonal access": context.seasonal_relevance,
    amenities: context.amenities,
    occupancy: [context.occupancy, context.bedrooms, context.bathrooms],
    "family suitability": [context.family_friendly, ...context.child_friendly_signals],
    "pet suitability": [context.pet_policy],
    "parking / transit": [context.parking],
    "check-in logistics": [context.checkin_info, context.checkout_info],
    "cancellation / booking rules": [context.cancellation_policy, ...context.booking_rules],
    "ideal traveler type": context.differentiators,
    differentiators: context.differentiators,
    "service area": [context.city, context.region],
    "response times": context.differentiators,
    "pricing model": context.booking_rules,
    scheduling: [context.checkin_info],
    qualifications: context.differentiators,
    fit: [context.category, context.subcategory],
    policies: [context.cancellation_policy, ...context.booking_rules],
    availability: [context.checkin_info, context.checkout_info],
    "reservation logistics": [context.checkin_info],
    "menu fit": context.amenities,
    "peak-time access": context.seasonal_relevance,
  };

  const values = (map[cluster] ?? []).map((value) => value.trim()).filter(Boolean);
  if (values.length === 0) return { values: [], confidence: "unknown" };

  if (["family suitability"].includes(cluster) && context.fact_confidence_map.family_friendly === "inferred") {
    return { values, confidence: "inferred" };
  }

  return { values, confidence: "confirmed" };
}

function buildAnswer(cluster: string, facts: string[], confidence: FactConfidence, context: ListingFaqContext): string {
  if (confidence === "unknown") {
    return "Some details are not confirmed yet, so guests should verify this directly before booking. " +
      "The listing page includes the latest owner-provided information for " + context.listing_name + ".";
  }

  const direct = firstNonEmpty(facts) || context.listing_name;
  const local = firstNonEmpty([context.neighborhood, context.city, context.region]);

  if (confidence === "inferred") {
    return "This appears likely based on available listing signals: " + direct + ". " +
      "Because this is inferred rather than confirmed, guests should verify details with the host before finalizing plans.";
  }

  const sentence1 = "Yes. " + direct + ".";
  const sentence2 = local
    ? "For local context, this is most relevant around " + local + "."
    : "This is based on details currently listed for this property.";
  const sentence3 = ["cancellation / booking rules", "check-in logistics", "parking / transit"].includes(cluster)
    ? "Guests should still reconfirm operational details close to arrival."
    : "This helps travelers compare fit before they book.";

  return sentence1 + " " + sentence2 + " " + sentence3;
}

export function composeFaqAnswers(input: {
  context: ListingFaqContext;
  selectedQuestions: FaqQuestionCandidate[];
}): FaqEntry[] {
  const entries: FaqEntry[] = [];
  const internalLinks = [input.context.canonical_url, ...input.context.support_links].filter(Boolean).slice(0, 3);

  for (const question of input.selectedQuestions) {
    const { values, confidence } = clusterFacts(question.cluster, input.context);
    const answerPlain = buildAnswer(question.cluster, values, confidence, input.context);
    const answerHtml = "<p>" + htmlEscape(answerPlain) + "</p>";

    entries.push({
      question: question.question_text,
      answer_html: answerHtml,
      answer_plaintext: answerPlain,
      source_facts: values,
      fact_confidence: confidence,
      intent_cluster: question.cluster,
      listing_anchor_terms: [input.context.listing_name, input.context.category].filter(Boolean),
      local_anchor_terms: [input.context.neighborhood, input.context.city, input.context.region].filter(Boolean),
      internal_links: internalLinks,
      quality_score: Math.round((question.listing_specificity_score + question.fact_coverage_score + question.selection_intent_score) * 33),
    });
  }

  return entries;
}
