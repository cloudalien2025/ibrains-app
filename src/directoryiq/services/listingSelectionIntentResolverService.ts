import type { ListingFlywheelLinksModel } from "@/src/directoryiq/services/listingFlywheelLinksService";
import type { ListingAuthorityGapsModel } from "@/src/directoryiq/services/listingGapsService";
import type { ListingRecommendedActionsModel } from "@/src/directoryiq/services/listingRecommendedActionsService";
import type { ListingSupportModel } from "@/src/directoryiq/services/listingSupportService";

export type SelectionIntentPriority = "high" | "medium" | "low";

export type ListingSelectionIntentContext = {
  title?: string | null;
  canonicalUrl?: string | null;
  category?: string | null;
  city?: string | null;
  state?: string | null;
  location?: string | null;
  siteLabel?: string | null;
};

export type SelectionIntentPriorityRank = {
  clusterId: "intent_match" | "proof_depth" | "local_relevance" | "comparison_clarity";
  title: string;
  priority: SelectionIntentPriority;
  score: number;
  rationale: string;
};

export type ListingSelectionIntentProfile = {
  primaryIntent: string;
  secondaryIntents: string[];
  targetEntities: string[];
  supportingEntities: string[];
  localModifiers: string[];
  comparisonFrames: string[];
  supportedEntities: string[];
  missingEntities: string[];
  clusterPriorityRanking: SelectionIntentPriorityRank[];
  confidence: "high" | "medium" | "low";
  dataStatus: "intent_resolved" | "low_context";
};

type IntentResolverInput = {
  listing: {
    id: string;
    title: string;
    canonicalUrl?: string | null;
    siteId?: string | null;
  };
  listingContext?: ListingSelectionIntentContext;
  support: ListingSupportModel;
  gaps: ListingAuthorityGapsModel;
  actions: ListingRecommendedActionsModel;
  flywheel: ListingFlywheelLinksModel;
};

const STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "in",
  "at",
  "near",
  "of",
  "a",
  "an",
  "to",
]);

function compact(values: Array<string | null | undefined>): string[] {
  return values.map((value) => (value ?? "").trim()).filter(Boolean);
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function titleKeywords(title: string): string[] {
  return normalize(title)
    .split(" ")
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));
}

function includesAny(text: string, terms: string[]): boolean {
  const cleaned = normalize(text);
  return terms.some((term) => cleaned.includes(term));
}

function detectPrimaryIntent(title: string, category: string): string {
  const text = `${title} ${category}`;
  if (includesAny(text, ["restaurant", "cuisine", "dining", "eat", "food", "bistro", "cafe", "grill", "nepali", "indian"])) {
    return "choose_best_dining_option";
  }
  if (includesAny(text, ["hotel", "lodge", "inn", "resort", "stay", "reservation", "vacation", "rental"])) {
    return "book_best_place_to_stay";
  }
  if (includesAny(text, ["playground", "park", "trail", "tour", "activity", "adventure", "attraction"])) {
    return "select_best_local_activity";
  }
  if (includesAny(text, ["plumbing", "repair", "service", "contractor", "clinic", "law", "agency"])) {
    return "hire_trusted_local_service";
  }
  return "select_best_local_option";
}

function localPhraseFromTitle(title: string): string | null {
  const match = title.match(/\b(?:in|near|at)\s+([A-Za-z0-9'"\- ]{3,})$/i);
  if (!match) return null;
  return match[1].trim();
}

function comparisonFrames(primaryIntent: string, listingTitle: string, localModifiers: string[]): string[] {
  const localHint = localModifiers[0] ?? "this area";
  if (primaryIntent === "choose_best_dining_option") {
    return [
      `${listingTitle} vs nearby restaurants in ${localHint}`,
      `Best cuisine match for ${localHint}`,
      `Price-to-quality comparison for ${listingTitle}`,
    ];
  }
  if (primaryIntent === "book_best_place_to_stay") {
    return [
      `${listingTitle} vs nearby lodging options in ${localHint}`,
      `Amenities and policy comparison for ${listingTitle}`,
      `Best stay fit for ${localHint}`,
    ];
  }
  if (primaryIntent === "select_best_local_activity") {
    return [
      `${listingTitle} vs nearby activities in ${localHint}`,
      `Family fit and accessibility comparison`,
      `Best experience match for ${localHint}`,
    ];
  }
  if (primaryIntent === "hire_trusted_local_service") {
    return [
      `${listingTitle} vs competing providers in ${localHint}`,
      `Credential and trust-signal comparison`,
      `Response speed and reliability comparison`,
    ];
  }
  return [
    `${listingTitle} vs nearby alternatives in ${localHint}`,
    `Trust and quality comparison`,
    `Best local fit comparison`,
  ];
}

function secondaryIntents(primaryIntent: string, hasComparisonGap: boolean): string[] {
  const intents = ["validate_trust_signals", "confirm_local_fit", "compare_alternatives"];
  if (primaryIntent === "book_best_place_to_stay") intents.unshift("check_availability_and_policies");
  if (primaryIntent === "choose_best_dining_option") intents.unshift("check_menu_and_reservation_fit");
  if (primaryIntent === "select_best_local_activity") intents.unshift("check_activity_fit_and_access");
  if (primaryIntent === "hire_trusted_local_service") intents.unshift("verify_service_scope_and_credentials");
  if (hasComparisonGap) intents.unshift("close_comparison_coverage_gap");
  return dedupe(intents);
}

function requiredEntities(primaryIntent: string): string[] {
  if (primaryIntent === "choose_best_dining_option") {
    return ["menu", "reviews", "hours", "location", "reservation"];
  }
  if (primaryIntent === "book_best_place_to_stay") {
    return ["availability", "amenities", "reviews", "location", "policies"];
  }
  if (primaryIntent === "select_best_local_activity") {
    return ["schedule", "pricing", "location", "accessibility", "reviews"];
  }
  if (primaryIntent === "hire_trusted_local_service") {
    return ["service scope", "pricing", "credentials", "reviews", "coverage area"];
  }
  return ["offer details", "pricing", "reviews", "location", "proof"];
}

function confidenceFromSignals(params: {
  hasCategory: boolean;
  localModifierCount: number;
  supportSignals: number;
}): "high" | "medium" | "low" {
  if (params.supportSignals >= 2 && params.hasCategory && params.localModifierCount > 0) return "high";
  if (params.supportSignals >= 1 || params.hasCategory || params.localModifierCount > 0) return "medium";
  return "low";
}

function priorityForScore(score: number): SelectionIntentPriority {
  if (score <= 45) return "high";
  if (score <= 70) return "medium";
  return "low";
}

function buildRanking(input: {
  support: ListingSupportModel;
  gaps: ListingAuthorityGapsModel;
  actions: ListingRecommendedActionsModel;
  localModifiers: string[];
  hasCategory: boolean;
}): SelectionIntentPriorityRank[] {
  const hasComparisonGap = input.gaps.items.some((item) => item.type === "missing_comparison_content");
  const supportSignals =
    input.support.summary.inboundLinkedSupportCount +
    input.support.summary.mentionWithoutLinkCount +
    input.support.summary.outboundSupportLinkCount +
    input.support.summary.connectedSupportPageCount;
  const actionPressure = input.actions.summary.highPriorityCount * 12 + input.actions.summary.mediumPriorityCount * 6;

  const intentMatchScore = clamp(55 + (input.hasCategory ? 15 : 0) + Math.min(20, supportSignals * 3), 0, 100);
  const proofDepthScore = clamp(35 + supportSignals * 8 - actionPressure, 0, 100);
  const localRelevanceScore = clamp(35 + input.localModifiers.length * 18 - (input.gaps.items.some((item) => item.type === "weak_local_context_support") ? 20 : 0), 0, 100);
  const comparisonClarityScore = clamp(
    40 -
      (hasComparisonGap ? 25 : 0) -
      (input.gaps.items.some((item) => item.type === "missing_faq_support_coverage") ? 10 : 0) +
      (input.actions.items.some((item) => item.key === "create_comparison_support_content") ? 20 : 0),
    0,
    100
  );

  const ranking: SelectionIntentPriorityRank[] = [
    {
      clusterId: "intent_match",
      title: "Intent Match Clarity",
      score: intentMatchScore,
      priority: priorityForScore(intentMatchScore),
      rationale: input.hasCategory
        ? "Category and listing descriptors provide a clear target intent frame."
        : "Intent framing relies primarily on listing-title signals.",
    },
    {
      clusterId: "proof_depth",
      title: "Proof Depth",
      score: proofDepthScore,
      priority: priorityForScore(proofDepthScore),
      rationale: `Support evidence signals observed: ${supportSignals}.`,
    },
    {
      clusterId: "local_relevance",
      title: "Local Relevance",
      score: localRelevanceScore,
      priority: priorityForScore(localRelevanceScore),
      rationale: input.localModifiers.length
        ? `Local modifiers detected: ${input.localModifiers.join(", ")}.`
        : "No strong local modifiers detected from current listing context.",
    },
    {
      clusterId: "comparison_clarity",
      title: "Comparison Clarity",
      score: comparisonClarityScore,
      priority: priorityForScore(comparisonClarityScore),
      rationale: hasComparisonGap
        ? "Comparison-intent coverage gaps are currently present."
        : "Comparison coverage signals are present or not flagged as missing.",
    },
  ];

  return ranking.sort((left, right) => left.score - right.score);
}

export function resolveListingSelectionIntent(input: IntentResolverInput): ListingSelectionIntentProfile {
  const context = input.listingContext ?? {};
  const listingTitle = (context.title ?? input.listing.title ?? input.listing.id).trim() || input.listing.id;
  const category = (context.category ?? "").trim();

  const localModifiers = dedupe(
    compact([
      context.city,
      context.state,
      context.location,
      context.siteLabel,
      localPhraseFromTitle(listingTitle),
    ])
  );

  const primaryIntent = detectPrimaryIntent(listingTitle, category);
  const hasComparisonGap = input.gaps.items.some((item) => item.type === "missing_comparison_content");
  const secondary = secondaryIntents(primaryIntent, hasComparisonGap);

  const extractedKeywords = titleKeywords(listingTitle).slice(0, 4);
  const targetEntities = dedupe(
    compact([
      listingTitle,
      category || null,
      extractedKeywords.length ? extractedKeywords.join(" ") : null,
      localModifiers[0] ?? null,
    ])
  );

  const evidenceEntities = dedupe(
    compact([
      ...input.support.inboundLinkedSupport.map((item) => item.title ?? item.sourceId),
      ...input.support.mentionsWithoutLinks.map((item) => item.title ?? item.sourceId),
      ...input.support.connectedSupportPages.map((item) => item.title ?? item.id ?? null),
    ])
  );

  const supportingEntities = dedupe([...evidenceEntities, ...requiredEntities(primaryIntent)]);
  const supportedEntities = dedupe(evidenceEntities);

  const supportedText = normalize(
    [
      ...supportedEntities,
      ...input.support.inboundLinkedSupport.flatMap((item) => item.anchors),
      ...input.support.mentionsWithoutLinks.map((item) => item.mentionSnippet ?? ""),
      ...input.support.outboundSupportLinks.map((item) => item.title ?? item.url ?? ""),
    ].join(" ")
  );

  const missingEntities = requiredEntities(primaryIntent).filter((entity) => !supportedText.includes(normalize(entity)));

  const ranking = buildRanking({
    support: input.support,
    gaps: input.gaps,
    actions: input.actions,
    localModifiers,
    hasCategory: Boolean(category),
  });

  const supportSignals =
    input.support.summary.inboundLinkedSupportCount +
    input.support.summary.mentionWithoutLinkCount +
    input.support.summary.outboundSupportLinkCount +
    input.support.summary.connectedSupportPageCount;

  const confidence = confidenceFromSignals({
    hasCategory: Boolean(category),
    localModifierCount: localModifiers.length,
    supportSignals,
  });

  return {
    primaryIntent,
    secondaryIntents: secondary,
    targetEntities,
    supportingEntities,
    localModifiers,
    comparisonFrames: comparisonFrames(primaryIntent, listingTitle, localModifiers),
    supportedEntities,
    missingEntities,
    clusterPriorityRanking: ranking,
    confidence,
    dataStatus: listingTitle ? "intent_resolved" : "low_context",
  };
}
