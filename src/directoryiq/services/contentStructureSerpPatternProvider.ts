import type { SerpCacheEntry } from "@/lib/directoryiq/types";
import type { ListingSelectionIntentProfile } from "@/src/directoryiq/services/listingSelectionIntentResolverService";

export type SerpPatternSummary = {
  readySlotCount: number;
  totalSlotCount: number;
  commonHeadings: string[];
  commonQuestions: string[];
  targetLengthBand?: {
    min: number;
    median: number;
    max: number;
  };
};

export type SerpBlueprintPatternSet = {
  source: "serp_cache" | "intent_fixture" | "none";
  summary?: SerpPatternSummary;
  suggestedTitlePattern?: string;
  suggestedH2Sections: string[];
  comparisonCriteria: string[];
  faqThemes: string[];
};

type IntentFixture = Omit<SerpBlueprintPatternSet, "source" | "summary">;

const INTENT_FIXTURES: Record<string, IntentFixture> = {
  select_best_local_activity: {
    suggestedTitlePattern: "Best [Activity Type] in [Local Modifier]: Fit, Access, and Booking Tips",
    suggestedH2Sections: ["Who this activity is best for", "Access and timing", "What to bring and expect", "Alternatives nearby"],
    comparisonCriteria: ["accessibility", "age fit", "time required", "cost/value"],
    faqThemes: ["hours and seasonality", "parking and transit", "age suitability", "reservation requirements"],
  },
  book_best_place_to_stay: {
    suggestedTitlePattern: "[Listing] Stay Guide: Amenities, Policies, and Best-Fit Traveler Types",
    suggestedH2Sections: ["Room and amenity breakdown", "Location and transit fit", "Policy details", "When to choose alternatives"],
    comparisonCriteria: ["amenities", "location convenience", "policy flexibility", "price consistency"],
    faqThemes: ["check-in and checkout", "cancellation rules", "parking and fees", "family/pet policies"],
  },
  choose_best_dining_option: {
    suggestedTitlePattern: "[Listing] Dining Guide: Menu Fit, Price Range, and Nearby Alternatives",
    suggestedH2Sections: ["Menu and dietary fit", "Best times to visit", "Price and value expectations", "Alternative cuisine options"],
    comparisonCriteria: ["menu coverage", "dietary options", "wait-time patterns", "price-to-quality"],
    faqThemes: ["reservation policy", "dietary accommodations", "peak hours", "takeout/delivery options"],
  },
  hire_trusted_local_service: {
    suggestedTitlePattern: "[Listing] Service Guide: Scope, Pricing Signals, and Trust Credentials",
    suggestedH2Sections: ["Service scope and scenarios", "Credential and proof signals", "Response timelines", "When another provider fits better"],
    comparisonCriteria: ["scope match", "credential strength", "response speed", "pricing transparency"],
    faqThemes: ["service area", "response times", "pricing model", "guarantees and warranties"],
  },
  select_best_local_option: {
    suggestedTitlePattern: "[Listing] Selection Guide for [Local Modifier]: Fit, Proof, and Alternatives",
    suggestedH2Sections: ["Who this listing is best for", "Proof and trust signals", "Comparison criteria", "Local fit notes"],
    comparisonCriteria: ["fit", "proof depth", "local relevance", "value"],
    faqThemes: ["pricing", "availability", "policies", "location fit"],
  },
};

function average(values: number[]): number {
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
}

function sortCounts(map: Map<string, number>, limit: number): string[] {
  return Array.from(map.entries())
    .sort((left, right) => {
      if (right[1] !== left[1]) return right[1] - left[1];
      return left[0].localeCompare(right[0]);
    })
    .slice(0, limit)
    .map(([key]) => key);
}

function summarizeSerpCache(entries: SerpCacheEntry[]): SerpPatternSummary | undefined {
  const totalSlotCount = entries.length;
  const readyEntries = entries
    .filter((entry) => entry.status === "READY" && entry.consensus_outline)
    .sort((left, right) => left.slot_id.localeCompare(right.slot_id));

  if (!readyEntries.length) return undefined;

  const headingCounts = new Map<string, number>();
  const questionCounts = new Map<string, number>();
  const mins: number[] = [];
  const medians: number[] = [];
  const maxes: number[] = [];

  for (const entry of readyEntries) {
    const outline = entry.consensus_outline;
    if (!outline) continue;
    for (const section of outline.h2Sections) {
      headingCounts.set(section.heading, (headingCounts.get(section.heading) ?? 0) + section.score);
    }
    for (const question of outline.mustCoverQuestions) {
      questionCounts.set(question, (questionCounts.get(question) ?? 0) + 1);
    }
    mins.push(outline.targetLengthBand.min);
    medians.push(outline.targetLengthBand.median);
    maxes.push(outline.targetLengthBand.max);
  }

  return {
    readySlotCount: readyEntries.length,
    totalSlotCount,
    commonHeadings: sortCounts(headingCounts, 8),
    commonQuestions: sortCounts(questionCounts, 8),
    targetLengthBand:
      mins.length && medians.length && maxes.length
        ? {
            min: average(mins),
            median: average(medians),
            max: average(maxes),
          }
        : undefined,
  };
}

export function resolveSerpBlueprintPatternSet(input: {
  intentProfile?: ListingSelectionIntentProfile;
  serpCacheEntries: SerpCacheEntry[];
}): SerpBlueprintPatternSet {
  const summary = summarizeSerpCache(input.serpCacheEntries);
  if (summary) {
    return {
      source: "serp_cache",
      summary,
      suggestedTitlePattern:
        input.intentProfile?.comparisonFrames[0] ??
        "Best [Listing Category] in [Local Modifier]: Comparison, FAQs, and Fit",
      suggestedH2Sections: summary.commonHeadings.slice(0, 6),
      comparisonCriteria: summary.commonHeadings.slice(0, 4).map((heading) => heading.toLowerCase()),
      faqThemes: summary.commonQuestions.slice(0, 6),
    };
  }

  const primaryIntent = input.intentProfile?.primaryIntent ?? "select_best_local_option";
  const fixture = INTENT_FIXTURES[primaryIntent] ?? INTENT_FIXTURES.select_best_local_option;
  if (fixture) {
    return {
      source: "intent_fixture",
      summary: undefined,
      suggestedTitlePattern: fixture.suggestedTitlePattern,
      suggestedH2Sections: fixture.suggestedH2Sections,
      comparisonCriteria: fixture.comparisonCriteria,
      faqThemes: fixture.faqThemes,
    };
  }

  return {
    source: "none",
    summary: undefined,
    suggestedH2Sections: [],
    comparisonCriteria: [],
    faqThemes: [],
  };
}
