export type MissionStepId = "find-support" | "create-support" | "optimize-listing";

export type MissionStepTruthClassification =
  | "support_discovery_selection"
  | "support_creation_publish"
  | "listing_optimization_with_valid_support";

export type MissionStepContract = {
  id: MissionStepId;
  stepNumber: 1 | 2 | 3;
  label: string;
  purpose: string;
  description: string;
  truthClassification: MissionStepTruthClassification;
};

export const MISSION_CONTROL_STEPS: MissionStepContract[] = [
  {
    id: "find-support",
    stepNumber: 1,
    label: "Step 1: Find Support",
    purpose: "Discover and select support that reinforces this listing.",
    description: "Find current support signals, identify missing support types, and add the best opportunities to your Mission Plan.",
    truthClassification: "support_discovery_selection",
  },
  {
    id: "create-support",
    stepNumber: 2,
    label: "Step 2: Create Support",
    purpose: "Create and publish missing support assets.",
    description: "Create or upgrade support assets that are missing or weak, then publish what passes review.",
    truthClassification: "support_creation_publish",
  },
  {
    id: "optimize-listing",
    stepNumber: 3,
    label: "Step 3: Optimize Listing",
    purpose: "Optimize listing performance using valid support.",
    description: "Use valid support to strengthen and publish listing optimization updates.",
    truthClassification: "listing_optimization_with_valid_support",
  },
];

export type SupportSlotKey =
  | "best_of_recommendation"
  | "audience_fit_use_case"
  | "location_intent_proximity"
  | "comparison_alternatives"
  | "experience_itinerary_problem_solving"
  | "unclassified";

export type SupportSlotDefinition = {
  key: SupportSlotKey;
  label: string;
  shortDescription: string;
  helpText: string;
};

export const SUPPORT_SLOT_TAXONOMY: SupportSlotDefinition[] = [
  {
    key: "best_of_recommendation",
    label: "Best-of / Recommendation",
    shortDescription: "Why this listing is a top choice.",
    helpText: "Best options, top picks, editor's choice, recommended providers.",
  },
  {
    key: "audience_fit_use_case",
    label: "Audience-Fit / Use-Case",
    shortDescription: "Who this listing is best for.",
    helpText: "Use cases, needs-based fit, service scenarios, user segments.",
  },
  {
    key: "location_intent_proximity",
    label: "Location-Intent / Proximity",
    shortDescription: "Local and proximity relevance.",
    helpText: "Near me, city/region context, local area intent, neighborhood fit.",
  },
  {
    key: "comparison_alternatives",
    label: "Comparison / Alternatives",
    shortDescription: "How this listing compares to alternatives.",
    helpText: "Compare options, versus pages, alternative providers, decision aids.",
  },
  {
    key: "experience_itinerary_problem_solving",
    label: "Experience / Itinerary / Problem-Solving",
    shortDescription: "Hands-on guidance and practical support.",
    helpText: "Guides, checklists, itineraries, troubleshooting, common problems.",
  },
  {
    key: "unclassified",
    label: "Unclassified",
    shortDescription: "Needs slot review before it can be considered strong.",
    helpText: "Use when a support item does not map clearly to one of the five slot families.",
  },
];

export type SupportValidityState = "invalid" | "upgrade_candidate" | "valid";

export type SupportValidityDimensions = {
  published: boolean;
  relevant: boolean;
  linked: boolean;
  nonDuplicate: boolean;
  primarySlot: SupportSlotKey;
  slotStrong: boolean;
  qualityThresholdMet: boolean;
};

export type SupportCandidate = {
  id: string;
  title: string | null;
  url?: string | null;
  sourceType?: string | null;
  anchors?: string[];
  relationshipType: "links_to_listing" | "mentions_without_link";
};

export type NormalizedSupportCandidate = {
  candidate: SupportCandidate;
  dimensions: SupportValidityDimensions;
  validityState: SupportValidityState;
  countsTowardRequiredFive: boolean;
};

export const REQUIRED_VALID_SUPPORT_COUNT = 5;

export const STEP3_UNLOCK_CONTRACT = {
  requiredValidSupportCount: REQUIRED_VALID_SUPPORT_COUNT,
  lockHeading: "Step 3 is locked",
  lockBody: `Step 3 unlocks after ${REQUIRED_VALID_SUPPORT_COUNT} valid support posts are live and connected to this listing.`,
  lockHint:
    "Valid support means published, relevant, linked, non-duplicate, and strong in a support slot.",
  approximationNote:
    "Phase 1 uses a conservative validity approximation from available runtime signals. Full scoring enforcement is deferred to later phases.",
};

// Phase 1 boundary: this module establishes shared product truth and a conservative
// validity approximation only. Deep scoring/enforcement/generation belongs to later phases.

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9\s]+/g, " ").replace(/\s+/g, " ").trim();
}

function inferPrimarySlot(input: { title?: string | null; anchors?: string[]; url?: string | null }): SupportSlotKey {
  const text = normalizeText([input.title ?? "", input.url ?? "", ...(input.anchors ?? [])].join(" "));
  if (!text) return "unclassified";
  if (/(compare|versus|vs|alternative|best|top)/.test(text)) return "comparison_alternatives";
  if (/(near me|city|local|area|neighborhood|region|proximity)/.test(text)) return "location_intent_proximity";
  if (/(guide|checklist|itinerary|how to|problem|troubleshoot|faq)/.test(text)) {
    return "experience_itinerary_problem_solving";
  }
  if (/(for families|for beginners|for teams|use case|scenario|ideal for|best for)/.test(text)) {
    return "audience_fit_use_case";
  }
  if (/(recommended|top rated|best of|editor)/.test(text)) return "best_of_recommendation";
  return "unclassified";
}

function toCandidateKey(candidate: SupportCandidate): string {
  const normalizedUrl = normalizeText(candidate.url ?? "");
  if (normalizedUrl) return normalizedUrl;
  return normalizeText(candidate.title ?? candidate.id);
}

function evaluateValidity(dimensions: SupportValidityDimensions): SupportValidityState {
  if (!dimensions.published || !dimensions.relevant || !dimensions.linked || !dimensions.nonDuplicate) {
    return "invalid";
  }
  if (dimensions.slotStrong && dimensions.qualityThresholdMet) return "valid";
  return "upgrade_candidate";
}

export function normalizeSupportCandidates(input: {
  inboundLinkedSupport: SupportCandidate[];
  mentionsWithoutLinks: SupportCandidate[];
}): NormalizedSupportCandidate[] {
  const seen = new Set<string>();
  const allCandidates = [...input.inboundLinkedSupport, ...input.mentionsWithoutLinks];

  return allCandidates.map((candidate) => {
    const key = toCandidateKey(candidate);
    const nonDuplicate = key ? !seen.has(key) : true;
    if (key) seen.add(key);

    const primarySlot = inferPrimarySlot(candidate);
    const linked = candidate.relationshipType === "links_to_listing";
    const published = true;
    const relevant = Boolean((candidate.title ?? "").trim() || (candidate.url ?? "").trim());
    const slotStrong = primarySlot !== "unclassified";
    const qualityThresholdMet = linked && (candidate.anchors?.some((anchor) => anchor.trim().length >= 4) ?? false);

    const dimensions: SupportValidityDimensions = {
      published,
      relevant,
      linked,
      nonDuplicate,
      primarySlot,
      slotStrong,
      qualityThresholdMet,
    };
    const validityState = evaluateValidity(dimensions);

    return {
      candidate,
      dimensions,
      validityState,
      countsTowardRequiredFive: validityState === "valid",
    };
  });
}

export function summarizeSupportValidity(candidates: NormalizedSupportCandidate[]): {
  validCount: number;
  upgradeCandidateCount: number;
  invalidCount: number;
  requiredValidSupportCount: number;
  missingValidSupportCount: number;
  missingSlotTypes: SupportSlotDefinition[];
} {
  const validCount = candidates.filter((item) => item.validityState === "valid").length;
  const upgradeCandidateCount = candidates.filter((item) => item.validityState === "upgrade_candidate").length;
  const invalidCount = candidates.filter((item) => item.validityState === "invalid").length;
  const missingValidSupportCount = Math.max(0, REQUIRED_VALID_SUPPORT_COUNT - validCount);

  const validSlots = new Set(
    candidates
      .filter((item) => item.validityState === "valid")
      .map((item) => item.dimensions.primarySlot)
      .filter((slot): slot is Exclude<SupportSlotKey, "unclassified"> => slot !== "unclassified")
  );
  const missingSlotTypes = SUPPORT_SLOT_TAXONOMY.filter(
    (slot) => slot.key !== "unclassified" && !validSlots.has(slot.key as Exclude<SupportSlotKey, "unclassified">)
  );

  return {
    validCount,
    upgradeCandidateCount,
    invalidCount,
    requiredValidSupportCount: REQUIRED_VALID_SUPPORT_COUNT,
    missingValidSupportCount,
    missingSlotTypes,
  };
}
