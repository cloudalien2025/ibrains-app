export const PRIMARY_POST_TYPES = [
  "Pillar",
  "Cluster",
  "Comparison",
  "Listing Support",
  "Mention",
  "Proof",
  "Needs Review",
] as const;

export const INTENT_LABELS = ["Discover", "Compare", "Choose", "Book", "Trust", "Plan", "Local"] as const;

export const FLYWHEEL_STATUSES = ["None", "Mention Only", "Connected", "Reciprocal", "Selection Asset"] as const;

export const CONFIDENCE_LEVELS = ["High", "Medium", "Low"] as const;

export const SELECTION_VALUES = ["Low", "Medium", "High", "Very High"] as const;

export type PrimaryPostType = (typeof PRIMARY_POST_TYPES)[number];
export type IntentLabel = (typeof INTENT_LABELS)[number];
export type FlywheelStatus = (typeof FLYWHEEL_STATUSES)[number];
export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];
export type SelectionValue = (typeof SELECTION_VALUES)[number];

export type ListingRelationshipSignal = {
  listingId: string;
  listingName: string;
  listingUrl?: string | null;
  appearsInTitle: boolean;
  appearsInH1OrIntro: boolean;
  meaningfulBodyMentions: number;
  hasDirectLink: boolean;
  recommendationOrCtaFavoring: boolean;
  conclusionReinforces: boolean;
  hasReciprocalLink: boolean;
  hasMention: boolean;
};

export type BlogPostClassificationInput = {
  postId: string;
  title: string;
  h1: string;
  intro: string;
  bodyText: string;
  listingRelationships: ListingRelationshipSignal[];
};

export type FlywheelStatusByTarget = {
  target_entity_id: string;
  status: FlywheelStatus;
};

export type BlogPostClassificationResult = {
  primary_type: PrimaryPostType;
  intent_labels: IntentLabel[];
  confidence: ConfidenceLevel;
  parent_pillar_id: string | null;
  dominant_listing_id: string | null;
  target_entity_ids: string[];
  flywheel_status_by_target: FlywheelStatusByTarget[];
  selection_value: SelectionValue;
  classification_reason: string;
};

export type ListingScoreBreakdown = {
  listingId: string;
  score: number;
};

export type BlogPostClassificationDebug = {
  comparisonSignal: boolean;
  listingScores: ListingScoreBreakdown[];
};

export type BlogPostClassificationOutput = {
  classification: BlogPostClassificationResult;
  debug: BlogPostClassificationDebug;
};

const TYPE_PRECEDENCE: PrimaryPostType[] = [
  "Comparison",
  "Listing Support",
  "Pillar",
  "Cluster",
  "Proof",
  "Mention",
  "Needs Review",
];

const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "at",
  "by",
  "for",
  "from",
  "how",
  "in",
  "of",
  "on",
  "or",
  "the",
  "to",
  "with",
]);

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function includesAny(text: string, phrases: string[]): boolean {
  return phrases.some((phrase) => text.includes(phrase));
}

function dedupe<T>(input: T[]): T[] {
  return Array.from(new Set(input));
}

function scoreListing(signal: ListingRelationshipSignal): number {
  return (
    (signal.appearsInTitle ? 5 : 0) +
    (signal.appearsInH1OrIntro ? 3 : 0) +
    signal.meaningfulBodyMentions * 2 +
    (signal.hasDirectLink ? 3 : 0) +
    (signal.recommendationOrCtaFavoring ? 4 : 0) +
    (signal.conclusionReinforces ? 2 : 0)
  );
}

function isClearComparisonIntent(text: string, listingCount: number): boolean {
  const explicitCompareKeyword = includesAny(text, [
    " vs ",
    " versus ",
    "compare",
    "comparison",
    "better than",
    "which is better",
    "alternatives",
  ]);
  const explicitVs = text.includes(" vs ") || text.includes(" versus ");

  return explicitCompareKeyword && (listingCount >= 2 || explicitVs);
}

function isBroadTopic(titleText: string, bodyText: string, listingCount: number): boolean {
  const narrowSubtopicSignals = includesAny(titleText, [
    "between ",
    "trail",
    "trails",
    "tour",
    "tours",
    "snowshoe",
    "hike",
    "hiking",
    "stops",
    "route",
    "itinerary",
    "weekend",
    "for families",
    "for couples",
    "on a budget",
  ]);

  const broadTitle = includesAny(titleText, [
    "guide",
    "best",
    "top",
    "what is",
    "how to",
    "things to do",
    "where to",
    "directory",
  ]);

  const categoryLanguage = includesAny(bodyText, [
    "category",
    "options",
    "overview",
    "types of",
    "in this guide",
  ]);

  return (broadTitle || categoryLanguage) && !narrowSubtopicSignals && listingCount !== 1;
}

function deriveParentPillarId(title: string): string | null {
  const tokens = normalize(title)
    .split(" ")
    .filter((token) => token.length >= 3 && !STOPWORDS.has(token));

  if (tokens.length < 2) return null;

  const parentTokens = tokens.slice(0, 3);
  if (!parentTokens.length) return null;
  return `pillar:${parentTokens.join("-")}`;
}

function isClusterCandidate(titleText: string, bodyText: string, listingCount: number): boolean {
  if (listingCount === 1) return false;

  const narrowIntent = includesAny(titleText, [
    "for families",
    "for couples",
    "on a budget",
    "near",
    "in winter",
    "in summer",
    "itinerary",
    "weekend",
    "checklist",
    "between ",
    "trail",
    "trails",
    "tour",
    "tours",
    "snowshoe",
    "hike",
    "hiking",
    "stops",
    "route",
  ]);

  const supportingLanguage = includesAny(bodyText, [
    "within this category",
    "subtopic",
    "focused on",
    "specific to",
    "day trip",
    "stop by",
    "stops along",
    "local route",
  ]);

  return narrowIntent || supportingLanguage;
}

function isTrustProofDominant(text: string): boolean {
  const trustHits = [
    "review",
    "award",
    "trusted",
    "testimonials",
    "locals",
    "verified",
    "credibility",
    "stats",
    "stat",
    "data",
    "history",
    "historical",
    "facts",
    "fact",
    "details",
    "detail",
    "how many",
    "how did",
    "acquire",
    "acquired",
  ].filter((keyword) =>
    text.includes(keyword)
  ).length;
  return trustHits >= 2;
}

function classifyPrimaryType(input: BlogPostClassificationInput): {
  primaryType: PrimaryPostType;
  dominantListingId: string | null;
  parentPillarId: string | null;
  listingScores: ListingScoreBreakdown[];
  reason: string;
} {
  const titleText = normalize(input.title);
  const h1Text = normalize(input.h1);
  const introText = normalize(input.intro);
  const bodyText = normalize(input.bodyText);
  const mergedText = ` ${titleText} ${h1Text} ${introText} ${bodyText} `;
  const listingSignals = input.listingRelationships;

  const comparisonIntent = isClearComparisonIntent(mergedText, listingSignals.length);
  if (comparisonIntent) {
    return {
      primaryType: "Comparison",
      dominantListingId: null,
      parentPillarId: null,
      listingScores: listingSignals.map((signal) => ({ listingId: signal.listingId, score: scoreListing(signal) })),
      reason: "Assigned Comparison because the title/body explicitly compare multiple alternatives.",
    };
  }

  const listingScores = listingSignals
    .map((signal) => ({ listingId: signal.listingId, score: scoreListing(signal) }))
    .sort((a, b) => b.score - a.score || a.listingId.localeCompare(b.listingId));

  const top = listingScores[0];
  const second = listingScores[1];

  if (top && top.score >= 8 && (!second || top.score - second.score >= 3)) {
    const dominant = listingSignals.find((signal) => signal.listingId === top.listingId);
    return {
      primaryType: "Listing Support",
      dominantListingId: top.listingId,
      parentPillarId: null,
      listingScores,
      reason: `Assigned Listing Support because ${dominant?.listingName ?? top.listingId} has the highest dominant listing score (${top.score}).`,
    };
  }

  if (isBroadTopic(titleText, mergedText, listingSignals.length)) {
    return {
      primaryType: "Pillar",
      dominantListingId: null,
      parentPillarId: null,
      listingScores,
      reason: "Assigned Pillar because the post targets a broad category topic without a single dominant listing.",
    };
  }

  if (isClusterCandidate(titleText, mergedText, listingSignals.length)) {
    const parentPillarId = deriveParentPillarId(input.title);
    return {
      primaryType: "Cluster",
      dominantListingId: null,
      parentPillarId,
      listingScores,
      reason: "Assigned Cluster because the post is a narrower subtopic that supports a broader category pillar.",
    };
  }

  if (isTrustProofDominant(mergedText)) {
    return {
      primaryType: "Proof",
      dominantListingId: null,
      parentPillarId: null,
      listingScores,
      reason: "Assigned Proof because evidence-oriented trust, stats, or factual authority signals dominate the post.",
    };
  }

  if (listingSignals.some((signal) => signal.hasMention || signal.hasDirectLink)) {
    return {
      primaryType: "Mention",
      dominantListingId: null,
      parentPillarId: null,
      listingScores,
      reason: "Assigned Mention because listings are referenced incidentally and no stronger type won by precedence.",
    };
  }

  return {
    primaryType: "Needs Review",
    dominantListingId: null,
    parentPillarId: null,
    listingScores,
    reason: "Assigned Needs Review because deterministic signals were insufficient for a stronger class.",
  };
}

function assignIntentLabels(input: BlogPostClassificationInput, primaryType: PrimaryPostType): IntentLabel[] {
  const text = normalize(`${input.title} ${input.h1} ${input.intro} ${input.bodyText}`);
  const labels: IntentLabel[] = [];

  if (includesAny(text, ["guide", "overview", "ideas", "discover", "things to do", "where to"])) labels.push("Discover");
  if (primaryType === "Comparison" || includesAny(text, ["compare", "versus", "vs", "alternatives"])) labels.push("Compare");
  if (includesAny(text, ["choose", "best", "top", "which", "pick", "recommended"])) labels.push("Choose");
  if (includesAny(text, ["book", "reserve", "availability", "call now", "schedule", "quote"])) labels.push("Book");
  if (primaryType === "Proof" || includesAny(text, ["review", "award", "trusted", "verified", "testimonial", "credibility"])) {
    labels.push("Trust");
  }
  if (includesAny(text, ["plan", "itinerary", "checklist", "timeline", "step by step"])) labels.push("Plan");
  if (includesAny(text, ["local", "near me", "near", "downtown", "neighborhood", "locals"])) labels.push("Local");

  return dedupe(labels);
}

function classifyFlywheelStatuses(input: {
  listingRelationships: ListingRelationshipSignal[];
  primaryType: PrimaryPostType;
  dominantListingId: string | null;
  selectionValue: SelectionValue;
  confidence: ConfidenceLevel;
}): FlywheelStatusByTarget[] {
  return input.listingRelationships.map((relationship) => {
    let status: FlywheelStatus = "None";

    if (relationship.hasMention && !relationship.hasDirectLink) {
      status = "Mention Only";
    }

    if (relationship.hasDirectLink) {
      status = "Connected";
      if (relationship.hasReciprocalLink) {
        status = "Reciprocal";
      }
      const isSelectionAssetCandidate =
        input.primaryType === "Listing Support" &&
        input.dominantListingId === relationship.listingId &&
        relationship.hasDirectLink;

      if (isSelectionAssetCandidate) {
        status = "Selection Asset";
      }
    }

    return {
      target_entity_id: relationship.listingId,
      status,
    };
  });
}

function assignConfidence(input: {
  primaryType: PrimaryPostType;
  listingScores: ListingScoreBreakdown[];
  intentLabels: IntentLabel[];
}): ConfidenceLevel {
  if (input.primaryType === "Needs Review") return "Low";

  const top = input.listingScores[0]?.score ?? 0;
  const second = input.listingScores[1]?.score ?? 0;
  const gap = top - second;

  if (input.primaryType === "Comparison") {
    return input.intentLabels.includes("Compare") ? "High" : "Medium";
  }

  if (input.primaryType === "Listing Support") {
    if (top >= 10 && gap >= 3) return "High";
    if (top >= 7) return "Medium";
    return "Low";
  }

  if (input.primaryType === "Proof" && input.intentLabels.includes("Trust")) {
    return "High";
  }

  if (input.primaryType === "Mention") return "Low";

  return input.intentLabels.length >= 2 ? "Medium" : "Low";
}

function assignSelectionValue(input: {
  primaryType: PrimaryPostType;
  confidence: ConfidenceLevel;
  intentLabels: IntentLabel[];
  listingScores: ListingScoreBreakdown[];
}): SelectionValue {
  const topScore = input.listingScores[0]?.score ?? 0;

  if (input.primaryType === "Comparison" && input.confidence !== "Low") return "Very High";
  if (input.primaryType === "Listing Support" && topScore >= 10 && input.confidence === "High") return "Very High";

  if (
    input.primaryType === "Listing Support" ||
    (input.primaryType === "Pillar" && input.intentLabels.includes("Trust")) ||
    (input.primaryType === "Cluster" && (input.intentLabels.includes("Choose") || input.intentLabels.includes("Book")))
  ) {
    return "High";
  }

  if (input.primaryType === "Mention" || input.primaryType === "Needs Review") return "Low";
  return "Medium";
}

export function classifyBlogPost(input: BlogPostClassificationInput): BlogPostClassificationOutput {
  const primary = classifyPrimaryType(input);
  const intentLabels = assignIntentLabels(input, primary.primaryType);
  const confidence = assignConfidence({
    primaryType: primary.primaryType,
    listingScores: primary.listingScores,
    intentLabels,
  });
  const selectionValue = assignSelectionValue({
    primaryType: primary.primaryType,
    confidence,
    intentLabels,
    listingScores: primary.listingScores,
  });

  const flywheelStatusByTarget = classifyFlywheelStatuses({
    listingRelationships: input.listingRelationships,
    primaryType: primary.primaryType,
    dominantListingId: primary.dominantListingId,
    selectionValue,
    confidence,
  });

  const targetEntityIds = dedupe(
    input.listingRelationships
      .filter((relationship) => relationship.hasDirectLink || relationship.hasMention)
      .map((relationship) => relationship.listingId)
  );

  return {
    classification: {
      primary_type: primary.primaryType,
      intent_labels: intentLabels,
      confidence,
      parent_pillar_id: primary.parentPillarId,
      dominant_listing_id: primary.dominantListingId,
      target_entity_ids: targetEntityIds,
      flywheel_status_by_target: flywheelStatusByTarget,
      selection_value: selectionValue,
      classification_reason: primary.reason,
    },
    debug: {
      comparisonSignal: primary.primaryType === "Comparison",
      listingScores: primary.listingScores,
    },
  };
}

export function primaryTypeRank(type: PrimaryPostType): number {
  const index = TYPE_PRECEDENCE.indexOf(type);
  return index < 0 ? TYPE_PRECEDENCE.length : index;
}
