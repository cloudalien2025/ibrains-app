export type WalmartCatalogMatchConfidence = "exact" | "strong" | "moderate" | "weak" | "none";

export interface WalmartCatalogCandidateForScoring {
  source: string;
  itemId: string;
  sku: string;
  upc: string;
  gtin: string;
  title: string;
  brand: string;
  manufacturer: string;
  category: string;
  shortDescription: string;
  longDescription: string;
  keyFeatures: string[];
  price: number | null;
  primaryImageUrl: string;
  galleryImageUrls: string[];
  raw: Record<string, unknown> | null;
}

export interface WalmartCatalogExpectedMatch {
  itemId: string;
  sku: string;
  upc: string;
  gtin: string;
  title: string;
  brand: string;
  manufacturer: string;
  category: string;
  packCount: string;
  sizeHint: string;
}

export interface WalmartCatalogCandidateScore {
  score: number;
  confidence: WalmartCatalogMatchConfidence;
  reasons: string[];
  blockers: string[];
  matchedFields: string[];
  exactIdentifierMatch: boolean;
}

function asText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function normalizeIdentifier(value: string): string {
  return value.replace(/[^a-z0-9]/gi, "").toUpperCase();
}

function normalizeBarcodeDigits(value: string): string {
  return value.replace(/\D/g, "");
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function jaccard(left: string[], right: string[]): number {
  if (left.length === 0 || right.length === 0) return 0;
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  let overlap = 0;
  for (const token of leftSet) {
    if (rightSet.has(token)) overlap += 1;
  }
  const union = new Set([...leftSet, ...rightSet]).size;
  if (union === 0) return 0;
  return overlap / union;
}

function coverage(required: string[], candidate: string[]): number {
  if (required.length === 0) return 0;
  const candidateSet = new Set(candidate);
  let matched = 0;
  for (const token of required) {
    if (candidateSet.has(token)) matched += 1;
  }
  return matched / required.length;
}

function normalizeBrand(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isPlaceholderOnly(candidate: WalmartCatalogCandidateForScoring): boolean {
  const hasTitle = asText(candidate.title).length > 0;
  const hasBrand = asText(candidate.brand).length > 0;
  const hasDescription =
    asText(candidate.shortDescription).length > 0 ||
    asText(candidate.longDescription).length > 0 ||
    (candidate.keyFeatures ?? []).some((entry) => asText(entry).length > 0);
  const hasImage =
    asText(candidate.primaryImageUrl).length > 0 ||
    (candidate.galleryImageUrls ?? []).some((entry) => asText(entry).length > 0);

  return !(hasTitle || hasBrand || hasDescription || hasImage);
}

function extractCountTokens(value: string): string[] {
  const normalized = value.toLowerCase();
  const matches = normalized.match(/\b\d+\s*(ct|count|capsules?|tablets?|softgels?|gummies?)\b/g);
  if (!matches) return [];
  return matches.map((entry) => entry.replace(/\s+/g, " ").trim());
}

function hasCountSizeConflict(input: {
  expectedPackCount: string;
  expectedSizeHint: string;
  expectedTitle: string;
  candidateTitle: string;
}): boolean {
  const expectedCounts = new Set<string>([
    ...extractCountTokens(input.expectedPackCount),
    ...extractCountTokens(input.expectedSizeHint),
    ...extractCountTokens(input.expectedTitle),
  ]);
  if (expectedCounts.size === 0) return false;

  const candidateCounts = new Set(extractCountTokens(input.candidateTitle));
  if (candidateCounts.size === 0) return false;

  for (const entry of expectedCounts) {
    if (candidateCounts.has(entry)) return false;
  }
  return true;
}

function hasCategorySafetyConflict(input: { expectedCategory: string; candidateCategory: string }): boolean {
  const expected = input.expectedCategory.toLowerCase();
  const candidate = input.candidateCategory.toLowerCase();
  if (!expected || !candidate) return false;

  const expectedAdult = expected.includes("adult");
  const candidateAdult = candidate.includes("adult");
  if (expectedAdult !== candidateAdult) return true;
  return false;
}

function confidenceFromScore(score: number): WalmartCatalogMatchConfidence {
  if (score >= 90) return "exact";
  if (score >= 75) return "strong";
  if (score >= 55) return "moderate";
  if (score >= 35) return "weak";
  return "none";
}

export function scoreWalmartCatalogCandidate(input: {
  candidate: WalmartCatalogCandidateForScoring;
  expected: WalmartCatalogExpectedMatch;
  requiresDirectItemId: boolean;
}): WalmartCatalogCandidateScore {
  const reasons: string[] = [];
  const blockers: string[] = [];
  const matchedFields: string[] = [];
  let score = 0;

  const expectedItemId = normalizeIdentifier(input.expected.itemId);
  const expectedSku = normalizeIdentifier(input.expected.sku);
  const expectedUpc = normalizeBarcodeDigits(input.expected.upc);
  const expectedGtin = normalizeBarcodeDigits(input.expected.gtin);
  const expectedBrand = normalizeBrand(input.expected.brand);
  const expectedManufacturer = normalizeBrand(input.expected.manufacturer);
  const expectedTitleTokens = tokenize(input.expected.title);

  const candidateItemId = normalizeIdentifier(input.candidate.itemId);
  const candidateSku = normalizeIdentifier(input.candidate.sku);
  const candidateUpc = normalizeBarcodeDigits(input.candidate.upc);
  const candidateGtin = normalizeBarcodeDigits(input.candidate.gtin);
  const candidateBrand = normalizeBrand(input.candidate.brand);
  const candidateManufacturer = normalizeBrand(input.candidate.manufacturer);
  const candidateTitleTokens = tokenize(input.candidate.title);

  if (input.requiresDirectItemId && !candidateItemId) {
    blockers.push("invalid/missing Walmart item ID for direct item lookup");
  }

  if (isPlaceholderOnly(input.candidate)) {
    blockers.push("placeholder-only payload");
  }

  if (expectedBrand && candidateBrand && expectedBrand !== candidateBrand) {
    blockers.push("clearly different brand");
  }

  if (
    hasCountSizeConflict({
      expectedPackCount: input.expected.packCount,
      expectedSizeHint: input.expected.sizeHint,
      expectedTitle: input.expected.title,
      candidateTitle: input.candidate.title,
    })
  ) {
    blockers.push("different count/size vs known product");
  }

  if (
    hasCategorySafetyConflict({
      expectedCategory: input.expected.category,
      candidateCategory: input.candidate.category,
    })
  ) {
    blockers.push("adult/unsafe category mismatch");
  }

  if (blockers.length > 0) {
    return {
      score: 0,
      confidence: "none",
      reasons,
      blockers,
      matchedFields,
      exactIdentifierMatch: false,
    };
  }

  let exactIdentifierMatch = false;
  if (expectedItemId && candidateItemId && expectedItemId === candidateItemId) {
    score += 80;
    exactIdentifierMatch = true;
    matchedFields.push("itemId");
    reasons.push("Exact ITEM_ID match.");
  }
  if (expectedGtin && candidateGtin && expectedGtin === candidateGtin) {
    score += 70;
    exactIdentifierMatch = true;
    matchedFields.push("gtin");
    reasons.push("Exact GTIN match.");
  }
  if (expectedUpc && candidateUpc && expectedUpc === candidateUpc) {
    score += 65;
    exactIdentifierMatch = true;
    matchedFields.push("upc");
    reasons.push("Exact UPC match.");
  }
  if (expectedSku && candidateSku && expectedSku === candidateSku) {
    score += 55;
    matchedFields.push("sku");
    reasons.push("Exact SKU match.");
  }

  const titleJaccard = jaccard(expectedTitleTokens, candidateTitleTokens);
  const titleCoverage = coverage(expectedTitleTokens, candidateTitleTokens);
  const titleScore = Math.round(Math.max(titleJaccard, titleCoverage) * 40);
  if (titleScore > 0) {
    score += titleScore;
    matchedFields.push("title");
    reasons.push(`Title similarity contributed ${titleScore} points.`);
  }

  if (expectedBrand && candidateBrand && expectedBrand === candidateBrand) {
    score += 10;
    matchedFields.push("brand");
    reasons.push("Brand matched.");
    if (Math.max(titleJaccard, titleCoverage) >= 0.7) {
      score += 15;
      reasons.push("Strong title and brand alignment boost applied.");
    }
  }

  if (expectedManufacturer && candidateManufacturer && expectedManufacturer === candidateManufacturer) {
    score += 4;
    matchedFields.push("manufacturer");
    reasons.push("Manufacturer matched.");
  }

  if (!input.candidate.primaryImageUrl && input.candidate.galleryImageUrls.length === 0) {
    score -= 8;
    reasons.push("No usable product images in candidate.");
  }
  if (!input.candidate.shortDescription && !input.candidate.longDescription && input.candidate.keyFeatures.length === 0) {
    score -= 6;
    reasons.push("Candidate lacks usable catalog content fields.");
  }

  const bounded = Math.max(0, Math.min(100, score));
  return {
    score: bounded,
    confidence: confidenceFromScore(bounded),
    reasons,
    blockers,
    matchedFields,
    exactIdentifierMatch,
  };
}
