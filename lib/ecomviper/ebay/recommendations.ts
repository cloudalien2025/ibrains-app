import type { EbayListingOptimizationScore, EbayListingRecommendation, EbayListingRecord } from "@/lib/ecomviper/ebay/types";

function normalize(value: string): string {
  return value.trim();
}

function titleKeywordParts(listing: EbayListingRecord): string[] {
  const parts = [
    listing.identifiers.brand,
    listing.aspects.Type,
    listing.aspects.Platform,
    listing.identifiers.model,
    listing.aspects.Connectivity,
  ]
    .map((entry) => normalize(entry ?? ""))
    .filter((entry) => entry.length > 0);

  return Array.from(new Set(parts));
}

function buildSuggestedTitle(listing: EbayListingRecord, score: EbayListingOptimizationScore): string {
  if (score.titleScore >= 90) {
    return listing.title;
  }

  const keywordParts = titleKeywordParts(listing);
  const fallbackParts = [listing.categoryName, listing.condition].map((entry) => normalize(entry)).filter(Boolean);
  const merged = [...keywordParts, ...fallbackParts].slice(0, 6);
  const baseTitle = merged.join(" ").replace(/\s+/g, " ").trim();

  if (!baseTitle) {
    return listing.title;
  }

  const suffix = "Read-Only Audit Ready Listing";
  const suggested = `${baseTitle} ${suffix}`.trim();
  return suggested.length > 120 ? suggested.slice(0, 117).trimEnd() + "..." : suggested;
}

function buildDescriptionDirection(score: EbayListingOptimizationScore): string {
  if (score.descriptionScore >= 85) {
    return "Keep the current structure and tighten buyer intent phrases around compatibility, included components, and condition details.";
  }

  if (score.descriptionScore >= 65) {
    return "Expand the description with use-case clarity, compatibility specifics, and concise bullet highlights for faster scan conversion.";
  }

  return "Rewrite with a clear product overview, compatibility caveats, included-in-box details, and at least five concrete feature bullets.";
}

function buildIdentifierIssues(score: EbayListingOptimizationScore): string[] {
  if (score.missingIdentifiers.length === 0) {
    return ["Identifiers are complete for Brand, Model, UPC, EAN, and MPN."];
  }

  return score.missingIdentifiers.map((field) => `Missing ${field.toUpperCase()} identifier value.`);
}

function buildImageNotes(score: EbayListingOptimizationScore, imageCount: number): string[] {
  if (score.imageScore >= 85) {
    return ["Image set is strong. Keep white-background hero image and maintain consistent framing across gallery."];
  }

  const notes = [`Current image count is ${imageCount}. Add at least 5-7 compliant gallery images.`];
  notes.push("Include one packaging image, one scale/context image, and one close-up image for key controls.");
  return notes;
}

function buildSearchVisibilityNotes(listing: EbayListingRecord, score: EbayListingOptimizationScore): string[] {
  if (score.titleScore >= 85 && score.aspectScore >= 80) {
    return ["Search visibility baseline is healthy. Keep high-intent keywords and complete item specifics."];
  }

  return [
    "Increase keyword coverage in title using buyer intent phrases and compatibility terms.",
    `Fill missing required aspects: ${score.missingRequiredAspects.join(", ") || "none"}.`,
    `Fill missing recommended aspects: ${score.missingRecommendedAspects.join(", ") || "none"}.`,
    `Align category keywords with ${listing.categoryName} shopper queries.`,
  ];
}

function buildConversionNotes(score: EbayListingOptimizationScore): string[] {
  if (score.overallScore >= 85) {
    return ["Conversion readiness is strong. Preserve trust signals and keep titles/specs synchronized."];
  }

  return [
    "Add clearer condition details and included-item confirmation.",
    "Use scannable bullets that map to top buyer objections.",
    "Lead with strongest value proposition in the first sentence.",
  ];
}

function buildPriorityExplanation(score: EbayListingOptimizationScore): string {
  if (score.priority === "low") {
    return "Low priority: listing is near optimization-ready and requires only incremental polish.";
  }

  if (score.priority === "medium") {
    return "Medium priority: listing can gain ranking and conversion improvements from missing specifics and richer content.";
  }

  return "High priority: listing has critical metadata/content gaps that suppress search visibility and conversion confidence.";
}

export function buildEbayRecommendation(
  listing: EbayListingRecord,
  score: EbayListingOptimizationScore
): EbayListingRecommendation {
  return {
    suggestedTitle: buildSuggestedTitle(listing, score),
    suggestedDescriptionDirection: buildDescriptionDirection(score),
    missingRequiredAspects: score.missingRequiredAspects,
    missingRecommendedAspects: score.missingRecommendedAspects,
    identifierIssues: buildIdentifierIssues(score),
    imageImprovementNotes: buildImageNotes(score, listing.imageUrls.length),
    searchVisibilityNotes: buildSearchVisibilityNotes(listing, score),
    conversionImprovementNotes: buildConversionNotes(score),
    complianceSafeRewriteNotes: [
      "Do not add unverifiable claims, competitor references, or restricted health/performance promises.",
      "Keep condition and compatibility statements factual and consistent with item specifics.",
      "Phase 1 recommendations are advisory only and never publish changes automatically.",
    ],
    priorityExplanation: buildPriorityExplanation(score),
  };
}
