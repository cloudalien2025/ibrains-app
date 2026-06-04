import type { ShopifyProductRecord } from "@/lib/ecomviper/shopify/shopify-types";

export type SupplierMatchConfidence =
  | "exact_sku"
  | "normalized_sku"
  | "strong_title"
  | "ingredient_signature"
  | "weak_candidate"
  | "no_match";

export interface SupplierMatchCandidate {
  supplierSlug: string;
  supplierName: string | null;
  sku: string;
  productName: string | null;
  activeIngredients: string[];
  supplementFactsText: string | null;
}

export interface SupplierMatchResult {
  confidence: SupplierMatchConfidence;
  matched: boolean;
  score: number;
  reasons: string[];
  candidate: SupplierMatchCandidate | null;
}

interface RankedCandidate {
  candidate: SupplierMatchCandidate;
  confidence: SupplierMatchConfidence;
  score: number;
  reasons: string[];
}

interface ShopifyMatchSignals {
  skusRaw: string[];
  skusNormalized: string[];
  titleNormalized: string;
  titleTokens: string[];
  ingredientTokens: string[];
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeSupplierSku(value: unknown): string {
  return asString(value).toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function normalizeText(value: unknown): string {
  return asString(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeText(value: unknown): string[] {
  return normalizeText(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function jaccardSimilarity(left: string[], right: string[]): number {
  if (!left.length || !right.length) return 0;
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  let overlap = 0;
  for (const token of leftSet) {
    if (rightSet.has(token)) overlap += 1;
  }
  if (!overlap) return 0;
  const union = new Set([...leftSet, ...rightSet]).size;
  return union > 0 ? overlap / union : 0;
}

function deriveIngredientTokens(product: ShopifyProductRecord): string[] {
  const ingredientMetafieldValues = product.metafields
    .filter((metafield) => {
      const key = `${metafield.namespace}.${metafield.key}`.toLowerCase();
      return /ingredient|supplement|nutrition|facts/.test(key);
    })
    .map((metafield) => metafield.value);

  const descriptionTokens = tokenizeText(product.description || "").slice(0, 40);
  const metafieldTokens = ingredientMetafieldValues.flatMap((value) => tokenizeText(value));

  return unique([...metafieldTokens, ...descriptionTokens]);
}

function collectShopifySignals(product: ShopifyProductRecord): ShopifyMatchSignals {
  const skusRaw = unique(product.variants.map((variant) => asString(variant.sku)).filter(Boolean));
  const skusNormalized = unique(skusRaw.map((sku) => normalizeSupplierSku(sku)).filter(Boolean));
  const titleNormalized = normalizeText(product.title || product.handle || "");
  const titleTokens = unique(tokenizeText(product.title || product.handle || ""));
  const ingredientTokens = deriveIngredientTokens(product);

  return {
    skusRaw,
    skusNormalized,
    titleNormalized,
    titleTokens,
    ingredientTokens,
  };
}

function confidenceRank(confidence: SupplierMatchConfidence): number {
  switch (confidence) {
    case "exact_sku":
      return 6;
    case "normalized_sku":
      return 5;
    case "ingredient_signature":
      return 4;
    case "strong_title":
      return 3;
    case "weak_candidate":
      return 2;
    default:
      return 1;
  }
}

function rankCandidate(candidate: SupplierMatchCandidate, signals: ShopifyMatchSignals): RankedCandidate {
  const candidateSkuRaw = asString(candidate.sku);
  const candidateSkuNormalized = normalizeSupplierSku(candidate.sku);

  if (signals.skusRaw.includes(candidateSkuRaw)) {
    return {
      candidate,
      confidence: "exact_sku",
      score: 1,
      reasons: [`exact SKU match (${candidateSkuRaw})`],
    };
  }

  if (candidateSkuNormalized && signals.skusNormalized.includes(candidateSkuNormalized)) {
    return {
      candidate,
      confidence: "normalized_sku",
      score: 0.95,
      reasons: [`normalized SKU match (${candidateSkuNormalized})`],
    };
  }

  const supplierTitle = normalizeText(candidate.productName || "");
  const supplierTitleTokens = tokenizeText(candidate.productName || "");
  const titleSimilarity = jaccardSimilarity(signals.titleTokens, supplierTitleTokens);

  const supplierIngredientTokens = unique(
    [
      ...candidate.activeIngredients.flatMap((ingredient) => tokenizeText(ingredient)),
      ...tokenizeText(candidate.supplementFactsText || ""),
    ].filter(Boolean)
  );
  const ingredientSimilarity = jaccardSimilarity(signals.ingredientTokens, supplierIngredientTokens);

  if (ingredientSimilarity >= 0.5 && signals.ingredientTokens.length > 0 && supplierIngredientTokens.length > 0) {
    return {
      candidate,
      confidence: "ingredient_signature",
      score: Number((0.7 + Math.min(ingredientSimilarity, 0.25)).toFixed(2)),
      reasons: [`ingredient signature overlap (${Math.round(ingredientSimilarity * 100)}%)`],
    };
  }

  if (titleSimilarity >= 0.65 || (signals.titleNormalized && supplierTitle && signals.titleNormalized === supplierTitle)) {
    return {
      candidate,
      confidence: "strong_title",
      score: Number((0.62 + Math.min(titleSimilarity, 0.2)).toFixed(2)),
      reasons: [`title similarity (${Math.round(titleSimilarity * 100)}%)`],
    };
  }

  if (titleSimilarity >= 0.4 || ingredientSimilarity >= 0.35) {
    const strongest = Math.max(titleSimilarity, ingredientSimilarity);
    return {
      candidate,
      confidence: "weak_candidate",
      score: Number((0.4 + Math.min(strongest, 0.2)).toFixed(2)),
      reasons: [
        titleSimilarity > ingredientSimilarity
          ? `weak title similarity (${Math.round(titleSimilarity * 100)}%)`
          : `weak ingredient overlap (${Math.round(ingredientSimilarity * 100)}%)`,
      ],
    };
  }

  return {
    candidate,
    confidence: "no_match",
    score: 0,
    reasons: ["no reliable identity or content overlap"],
  };
}

export function findSupplierProductMatch(input: {
  product: ShopifyProductRecord;
  candidates: SupplierMatchCandidate[];
}): SupplierMatchResult {
  const signals = collectShopifySignals(input.product);

  const ranked = input.candidates
    .map((candidate) => rankCandidate(candidate, signals))
    .sort((left, right) => {
      const rankDelta = confidenceRank(right.confidence) - confidenceRank(left.confidence);
      if (rankDelta !== 0) return rankDelta;
      const scoreDelta = right.score - left.score;
      if (scoreDelta !== 0) return scoreDelta;
      return normalizeSupplierSku(left.candidate.sku).localeCompare(normalizeSupplierSku(right.candidate.sku));
    });

  const top = ranked[0];
  if (!top || top.confidence === "no_match") {
    return {
      confidence: "no_match",
      matched: false,
      score: 0,
      reasons: ["no supplier candidate met confidence threshold"],
      candidate: null,
    };
  }

  const matched = top.confidence === "exact_sku" || top.confidence === "normalized_sku";

  return {
    confidence: top.confidence,
    matched,
    score: top.score,
    reasons: top.reasons,
    candidate: top.candidate,
  };
}
