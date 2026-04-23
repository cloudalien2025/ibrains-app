import type { ArchetypeClassification, ListingArchetype } from "@/lib/directoryiq/faq/types";

const ARCHETYPE_KEYWORDS: Array<{ archetype: ListingArchetype; keywords: string[] }> = [
  { archetype: "vacation_rental", keywords: ["vacation rental", "short-term rental", "airbnb", "condo", "cabin", "villa"] },
  { archetype: "hotel", keywords: ["hotel", "resort", "lodge", "inn", "suite"] },
  { archetype: "restaurant", keywords: ["restaurant", "dining", "bar", "cafe", "bistro", "eatery"] },
  { archetype: "local_service", keywords: ["plumber", "electrician", "cleaning", "repair", "contractor", "service"] },
  { archetype: "medical_provider", keywords: ["doctor", "clinic", "medical", "dental", "health", "urgent care"] },
  { archetype: "legal_provider", keywords: ["attorney", "law", "legal", "lawyer", "firm"] },
  { archetype: "real_estate_agent", keywords: ["real estate", "realtor", "broker", "property agent"] },
  { archetype: "retail_store", keywords: ["store", "shop", "boutique", "retail", "outlet"] },
  { archetype: "local_attraction", keywords: ["museum", "park", "attraction", "tour", "landmark", "experience"] },
];

function normalize(text: string): string {
  return text.trim().toLowerCase();
}

export function classifyListingArchetype(input: {
  listingType?: string;
  category?: string;
  subcategory?: string;
  title?: string;
  description?: string;
}): ArchetypeClassification {
  const haystack = normalize(
    [input.listingType, input.category, input.subcategory, input.title, input.description]
      .filter((value): value is string => typeof value === "string")
      .join(" ")
  );

  let best: { archetype: ListingArchetype; score: number } = { archetype: "other_business", score: 0 };
  for (const candidate of ARCHETYPE_KEYWORDS) {
    let score = 0;
    for (const keyword of candidate.keywords) {
      if (haystack.includes(keyword)) score += 1;
    }
    if (score > best.score) best = { archetype: candidate.archetype, score };
  }

  const confidence = Math.max(0.25, Math.min(0.98, best.score / 4));
  if (best.archetype === "other_business" || confidence < 0.55) {
    return {
      archetype: best.archetype,
      confidence,
      fallbackReason: "low keyword overlap for archetype-specific classification",
    };
  }

  return {
    archetype: best.archetype,
    confidence,
    fallbackReason: null,
  };
}
