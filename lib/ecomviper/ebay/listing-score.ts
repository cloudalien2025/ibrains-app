import type {
  EbayCategoryAspectMetadata,
  EbayListingIdentifiers,
  EbayListingOptimizationScore,
  EbayListingRecord,
} from "@/lib/ecomviper/ebay/types";

function normalizeText(value: string): string {
  return value.trim();
}

function tokenizeWords(value: string): string[] {
  const normalized = normalizeText(value).toLowerCase();
  if (!normalized) return [];
  return normalized.split(/\s+/).filter((entry) => entry.length > 0);
}

function hasSignalKeywords(value: string): boolean {
  return /(with|for|and|wireless|usb|compatible|turbo|kit|pack|set)/i.test(value);
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function scoreTitle(title: string): number {
  const normalized = normalizeText(title);
  const length = normalized.length;
  const words = tokenizeWords(normalized);
  const uniqueWords = new Set(words);

  let score = 0;
  if (length >= 70 && length <= 140) score += 40;
  else if (length >= 50 && length <= 160) score += 30;
  else if (length >= 35) score += 20;
  else score += 8;

  if (words.length >= 12) score += 30;
  else if (words.length >= 9) score += 22;
  else if (words.length >= 6) score += 14;
  else score += 6;

  score += hasSignalKeywords(normalized) ? 15 : 5;
  score += uniqueWords.size >= Math.min(words.length, 8) ? 15 : 8;

  return clampScore(score);
}

function scoreDescription(descriptionSummary: string, bulletHighlights: string[]): number {
  const descriptionLength = normalizeText(descriptionSummary).length;
  const bulletCount = bulletHighlights.filter((entry) => normalizeText(entry).length > 0).length;
  const sentenceCount = normalizeText(descriptionSummary)
    .split(/[.!?]/)
    .map((entry) => entry.trim())
    .filter(Boolean).length;

  let score = 0;
  if (descriptionLength >= 280) score += 50;
  else if (descriptionLength >= 180) score += 40;
  else if (descriptionLength >= 110) score += 30;
  else if (descriptionLength >= 60) score += 15;
  else score += 5;

  if (bulletCount >= 5) score += 30;
  else if (bulletCount >= 3) score += 22;
  else if (bulletCount >= 1) score += 12;

  if (sentenceCount >= 3) score += 20;
  else if (sentenceCount >= 2) score += 12;
  else score += 4;

  return clampScore(score);
}

function countPresentAspectValues(aspects: Record<string, string>, keys: string[]): number {
  return keys.filter((key) => normalizeText(aspects[key] ?? "").length > 0).length;
}

function missingAspectValues(aspects: Record<string, string>, keys: string[]): string[] {
  return keys.filter((key) => normalizeText(aspects[key] ?? "").length === 0);
}

function scoreAspects(listing: EbayListingRecord, taxonomy: EbayCategoryAspectMetadata): {
  score: number;
  missingRequired: string[];
  missingRecommended: string[];
} {
  const required = taxonomy.requiredAspects;
  const recommended = taxonomy.recommendedAspects;

  const requiredPresent = countPresentAspectValues(listing.aspects, required);
  const recommendedPresent = countPresentAspectValues(listing.aspects, recommended);

  const requiredCoverage = required.length === 0 ? 1 : requiredPresent / required.length;
  const recommendedCoverage = recommended.length === 0 ? 1 : recommendedPresent / recommended.length;

  const score = clampScore(requiredCoverage * 70 + recommendedCoverage * 30);

  return {
    score,
    missingRequired: missingAspectValues(listing.aspects, required),
    missingRecommended: missingAspectValues(listing.aspects, recommended),
  };
}

function scoreImages(imageUrls: string[]): number {
  const count = imageUrls.filter((url) => normalizeText(url).length > 0).length;
  if (count >= 7) return 100;
  if (count >= 5) return 85;
  if (count >= 3) return 65;
  if (count >= 2) return 45;
  if (count >= 1) return 25;
  return 0;
}

function missingIdentifierFields(identifiers: EbayListingIdentifiers): Array<keyof EbayListingIdentifiers> {
  const keys: Array<keyof EbayListingIdentifiers> = ["brand", "model", "upc", "ean", "mpn"];
  return keys.filter((key) => normalizeText(identifiers[key] ?? "").length === 0);
}

function scoreIdentifiers(identifiers: EbayListingIdentifiers): {
  score: number;
  missing: Array<keyof EbayListingIdentifiers>;
} {
  const missing = missingIdentifierFields(identifiers);
  const presentCount = 5 - missing.length;
  return {
    score: clampScore(presentCount * 20),
    missing,
  };
}

function scoreInventory(condition: string, quantity: number): number {
  let score = 0;
  if (quantity > 0) {
    score += 70;
    score += quantity >= 5 ? 10 : 5;
  } else {
    score += 10;
  }

  if (normalizeText(condition).length > 0) {
    score += 20;
  }

  return clampScore(score);
}

function resolveStatus(overall: number): EbayListingOptimizationScore["status"] {
  if (overall >= 85) return "Healthy";
  if (overall >= 65) return "Improve";
  return "Needs Attention";
}

function resolvePriority(overall: number): EbayListingOptimizationScore["priority"] {
  if (overall >= 85) return "low";
  if (overall >= 65) return "medium";
  return "high";
}

export function scoreEbayListing(
  listing: EbayListingRecord,
  taxonomy: EbayCategoryAspectMetadata
): EbayListingOptimizationScore {
  const titleScore = scoreTitle(listing.title);
  const descriptionScore = scoreDescription(listing.descriptionSummary, listing.bulletHighlights);
  const aspectResult = scoreAspects(listing, taxonomy);
  const imageScore = scoreImages(listing.imageUrls);
  const identifierResult = scoreIdentifiers(listing.identifiers);
  const inventoryScore = scoreInventory(listing.condition, listing.quantity);

  const overallScore = clampScore(
    titleScore * 0.2 +
      descriptionScore * 0.2 +
      aspectResult.score * 0.2 +
      imageScore * 0.15 +
      identifierResult.score * 0.15 +
      inventoryScore * 0.1
  );

  return {
    titleScore,
    descriptionScore,
    aspectScore: aspectResult.score,
    imageScore,
    identifierScore: identifierResult.score,
    inventoryScore,
    overallScore,
    missingRequiredAspects: aspectResult.missingRequired,
    missingRecommendedAspects: aspectResult.missingRecommended,
    missingIdentifiers: identifierResult.missing,
    priority: resolvePriority(overallScore),
    status: resolveStatus(overallScore),
  };
}
