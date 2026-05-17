import type { WalmartProductRecord } from "@/lib/ecomviper/walmart/walmart-types";
import {
  extractImageDerivedFactsFromProduct,
  type ImageFactConfidence,
  type ImageDerivedFact,
} from "@/lib/ecomviper/walmart/walmart-image-intelligence";
import {
  detectKnownStaleDemoValue,
  sanitizeCustomerFacingText,
} from "@/lib/ecomviper/walmart/walmart-truth-guard";
import {
  extractExplicitWalmartFlavorFromText,
  normalizeWalmartFlavor,
} from "@/lib/ecomviper/walmart/walmart-flavor-normalizer";

export type ProductFactSource =
  | "label_image"
  | "image_text"
  | "vision_extraction"
  | "shopify"
  | "walmart_draft"
  | "manual"
  | "walmart_product";

export type ProductFactConfidence = "high" | "medium" | "low" | "unknown";
export type ImageFactsStatus =
  | "available"
  | "extracted"
  | "unavailable"
  | "needs_vision_extraction"
  | "low_confidence";

export interface CanonicalProductFacts {
  brand: string;
  manufacturer: string;
  productName: string;
  series: string;
  sku: string;
  form: string;
  count: string;
  supply: string;
  flavor: string;
  servingSize: string;
  servingsPerContainer: string;
  dosageStrength: string;
  activeIngredients: string[];
  supplementFacts: Record<string, string>;
  otherIngredients: string[];
  allergenOrDoesNotContainStatements: string[];
  suggestedUse: string;
  warnings: string;
  storage: string;
  claimsFromLabel: string[];
  madeInUsa: string;
  origin: string;
  category: string;
  productType: string;
  targetAudience: string;
  sourceConfidence: Record<string, ProductFactConfidence>;
  sourceEvidence: Record<string, ProductFactSource[]>;
}

export interface ProductFactReplacement {
  field: string;
  previousValue: string;
  nextValue: string;
  reason: string;
}

export interface ProductFactsAgentResult {
  facts: CanonicalProductFacts;
  usedSources: ProductFactSource[];
  staleFieldReplacements: ProductFactReplacement[];
  staleFieldsCleared: string[];
  imageDerivedFacts: ImageDerivedFact[];
  imageFactsStatus: ImageFactsStatus;
  imageFactsMessage: string;
  manufacturerSource: ProductFactSource | "unknown";
  manufacturerConfidence: ProductFactConfidence;
  manufacturerNeedsReview: boolean;
}

interface SourceRecord {
  source: ProductFactSource;
  confidence: ProductFactConfidence;
  payload: Record<string, unknown>;
}

interface FieldCandidate<T> {
  value: T;
  source: ProductFactSource;
  confidence: ProductFactConfidence;
}

const SOURCE_PRIORITY: Record<ProductFactSource, number> = {
  manual: 6,
  label_image: 5,
  vision_extraction: 5,
  image_text: 4,
  shopify: 3,
  walmart_draft: 2,
  walmart_product: 1,
};

const FORM_ALIASES: Record<string, string> = {
  gummy: "Gummies",
  gummies: "Gummies",
  capsule: "Capsules",
  capsules: "Capsules",
  softgel: "Softgels",
  softgels: "Softgels",
  tablet: "Tablets",
  tablets: "Tablets",
  powder: "Powder",
  liquid: "Liquid",
};

const WEAK_FACT_SOURCES = new Set<ProductFactSource>([
  "walmart_product",
  "walmart_draft",
  "shopify",
]);
const DEMO_FLAVOR_PATTERN = /^mixed\s+berry$/i;
const DEMO_DOSAGE_PATTERN = /\bmagnesium(?:\s*\(as\s+magnesium\s+glycinate\))?\s*30\s*mg\b/i;
const SERVING_SIZE_CAPSULE_PATTERN = /\b(capsules?|tablets?|softgels?|gummies?)\b/i;
const TITLE_SERVINGS_PATTERN = /\b(\d{1,4})\s*servings?\b/i;

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .map((part) =>
      part.length > 1
        ? `${part.slice(0, 1).toUpperCase()}${part.slice(1).toLowerCase()}`
        : part.toUpperCase()
    )
    .join(" ")
    .trim();
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((entry) => entry.trim()).filter(Boolean)));
}

function normalizeList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return unique(
      value
        .map((entry) => {
          if (typeof entry === "string") return sanitizeCustomerFacingText(entry);
          const node = asObject(entry);
          if (!node) return "";
          return (
            sanitizeCustomerFacingText(asString(node.value)) ||
            sanitizeCustomerFacingText(asString(node.name)) ||
            sanitizeCustomerFacingText(asString(node.label)) ||
            sanitizeCustomerFacingText(asString(node.text))
          );
        })
        .filter(Boolean)
    );
  }

  const text = sanitizeCustomerFacingText(asString(value));
  if (!text) return [];
  return unique(
    text
      .split(/\r?\n|[;,|]+/)
      .map((entry) => entry.trim())
      .filter(Boolean)
  );
}

function normalizeFactObject(value: unknown): Record<string, string> {
  const row = asObject(value);
  if (!row) return {};
  const mapped: Record<string, string> = {};

  for (const [key, raw] of Object.entries(row)) {
    const normalizedKey = key.trim();
    const normalizedValue = sanitizeCustomerFacingText(asString(raw));
    if (!normalizedKey || !normalizedValue) continue;
    mapped[normalizedKey] = normalizedValue;
  }

  return mapped;
}

function normalizeFlavor(value: string): string {
  return normalizeWalmartFlavor(value) ?? "";
}

function normalizeForm(value: string): string {
  const key = value.trim().toLowerCase();
  if (!key) return "";
  return FORM_ALIASES[key] ?? titleCase(value);
}

function normalizeCount(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";

  const fromToken = trimmed.match(/\b(\d{1,4})\s*(ct|count|capsules?|softgels?|gummies?|tablets?)\b/i);
  if (fromToken) {
    return `${fromToken[1]} ${fromToken[2]}`.replace(/\s+/g, " ").trim();
  }

  return trimmed;
}

function findFirstValue(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const direct = sanitizeCustomerFacingText(asString(record[key]));
    if (direct) return direct;

    const attributes = asObject(record.attributes);
    if (attributes) {
      const nested = sanitizeCustomerFacingText(asString(attributes[key]));
      if (nested) return nested;
    }

    const searchBrowse = asObject(record.searchBrowseAttributes);
    if (searchBrowse) {
      const nested = sanitizeCustomerFacingText(asString(searchBrowse[key]));
      if (nested) return nested;
    }
  }

  return "";
}

function findFirstList(record: Record<string, unknown>, keys: string[]): string[] {
  for (const key of keys) {
    const direct = normalizeList(record[key]);
    if (direct.length > 0) return direct;

    const attributes = asObject(record.attributes);
    if (attributes) {
      const nested = normalizeList(attributes[key]);
      if (nested.length > 0) return nested;
    }

    const searchBrowse = asObject(record.searchBrowseAttributes);
    if (searchBrowse) {
      const nested = normalizeList(searchBrowse[key]);
      if (nested.length > 0) return nested;
    }
  }

  return [];
}

function findFirstObject(record: Record<string, unknown>, keys: string[]): Record<string, string> {
  for (const key of keys) {
    const direct = normalizeFactObject(record[key]);
    if (Object.keys(direct).length > 0) return direct;

    const attributes = asObject(record.attributes);
    if (attributes) {
      const nested = normalizeFactObject(attributes[key]);
      if (Object.keys(nested).length > 0) return nested;
    }
  }

  return {};
}

function inferFlavorFromText(text: string): string {
  return extractExplicitWalmartFlavorFromText(text) ?? "";
}

function inferFormFromText(text: string): string {
  const normalized = text.toLowerCase();
  if (/\b(greens?\s*&?\s*reds?|superfood|drink\s*mix)\b/.test(normalized)) {
    return "Powder";
  }
  if (/\bblend\b/.test(normalized) && /\b(servings?|scoop|mix)\b/.test(normalized)) {
    return "Powder";
  }
  for (const [alias, canonical] of Object.entries(FORM_ALIASES)) {
    if (new RegExp(`\\b${alias}\\b`, "i").test(normalized)) {
      return canonical;
    }
  }
  return "";
}

function inferCountFromText(text: string): string {
  const match = text.match(/\b(\d{1,4})\s*(ct|count|capsules?|softgels?|gummies?|tablets?)\b/i);
  if (!match) return "";
  return normalizeCount(`${match[1]} ${match[2]}`);
}

function inferServingSizeFromText(text: string): string {
  const match = text.match(/serving\s*size\s*[:\-]?\s*([^\n.;]+)/i);
  return match?.[1]?.trim() ?? "";
}

function inferServingsPerContainerFromText(text: string): string {
  const match = text.match(/servings\s*per\s*container\s*[:\-]?\s*([^\n.;]+)/i);
  if (match?.[1]) return match[1].trim();
  const titleMatch = text.match(TITLE_SERVINGS_PATTERN);
  return titleMatch?.[1]?.trim() ?? "";
}

function inferSupplyFromText(text: string): string {
  const match = text.match(/\b(\d{1,4})\s*day\s*supply\b/i);
  return match ? `${match[1]} day supply` : "";
}

function inferMadeInUsa(text: string): string {
  if (/made\s+in\s+usa/i.test(text)) return "Made in USA";
  if (/made\s+in\s+u\.s\.a\./i.test(text)) return "Made in USA";
  return "";
}

function normalizeCategory(value: string): string {
  const normalized = value.trim();
  if (!normalized) return "";
  return titleCase(normalized);
}

function normalizeAudience(value: string): string {
  const normalized = value.trim();
  if (!normalized) return "";
  if (/adults?/i.test(normalized)) return "Adults";
  return titleCase(normalized);
}

function isWeakFactCandidate<T>(candidate: FieldCandidate<T> | null): boolean {
  if (!candidate) return false;
  if (candidate.confidence === "unknown" || candidate.confidence === "low") return true;
  return WEAK_FACT_SOURCES.has(candidate.source);
}

function normalizeAlphaWords(value: string): string {
  return value.toLowerCase().replace(/[^a-z]+/g, " ").replace(/\s{2,}/g, " ").trim();
}

function titleMentionsAny(titleText: string, tokens: string[]): boolean {
  const normalizedTitle = normalizeAlphaWords(titleText);
  return tokens.some((token) => normalizedTitle.includes(normalizeAlphaWords(token)));
}

function ingredientAppearsInList(values: string[], token: string): boolean {
  return values.some((entry) =>
    normalizeAlphaWords(entry).includes(normalizeAlphaWords(token))
  );
}

function looksLikeDemoJointIngredientList(values: string[]): boolean {
  if (values.length === 0) return false;
  return (
    ingredientAppearsInList(values, "turmeric") &&
    ingredientAppearsInList(values, "glucosamine") &&
    ingredientAppearsInList(values, "chondroitin")
  );
}

function normalizeServingsNumber(value: string): string {
  const match = value.match(/\b(\d{1,4})\b/);
  return match?.[1] ?? "";
}

function hasImageUrls(product: WalmartProductRecord): boolean {
  const urls = unique([
    asString(product.imageUrl),
    ...(product.galleryImageUrls ?? []).map((entry) => asString(entry)),
    ...(product.variantImageUrls ?? []).map((entry) => asString(entry)),
  ]).filter(Boolean);
  return urls.length > 0;
}

function parseVisionExtractionStatus(
  payload: Record<string, unknown> | null
): { status: ImageFactsStatus; message: string } | null {
  if (!payload) return null;
  const status = asString(payload.status).toLowerCase();
  const message = asString(payload.message);
  if (
    status === "extracted" ||
    status === "available" ||
    status === "unavailable" ||
    status === "needs_vision_extraction" ||
    status === "low_confidence"
  ) {
    return {
      status,
      message:
        message ||
        (status === "extracted"
          ? "Image-derived label facts were extracted."
          : status === "low_confidence"
          ? "Image-derived facts were low confidence and skipped."
          : status === "needs_vision_extraction"
          ? "Images are available, but label text extraction has not run yet."
          : status === "available"
          ? "Image text is available, but no reliable label facts were extracted."
          : "Image extraction is unavailable."),
    };
  }
  return null;
}

function deriveImageFactsStatus(input: {
  product: WalmartProductRecord;
  factsList: ImageDerivedFact[];
  usedSources: string[];
  visionExtractionStatus?: { status: ImageFactsStatus; message: string } | null;
}): { status: ImageFactsStatus; message: string } {
  if (input.visionExtractionStatus) {
    return input.visionExtractionStatus;
  }

  if (input.factsList.length > 0) {
    const hasMediumOrHigh = input.factsList.some(
      (entry) => entry.confidence === "high" || entry.confidence === "medium"
    );
    if (hasMediumOrHigh) {
      return {
        status: "extracted",
        message: "Image-derived label facts were extracted.",
      };
    }
    return {
      status: "low_confidence",
      message: "Image-derived facts were low confidence and skipped.",
    };
  }

  const imageAvailable = hasImageUrls(input.product);
  if (!imageAvailable) {
    return {
      status: "unavailable",
      message: "No product images are available for label fact extraction.",
    };
  }

  if (input.usedSources.length === 0) {
    return {
      status: "needs_vision_extraction",
      message: "Images are available, but label text extraction has not run yet.",
    };
  }

  if (input.usedSources.length > 0) {
    return {
      status: "available",
      message: "Image text is available, but no reliable label facts were extracted.",
    };
  }

  return {
    status: "unavailable",
    message: "No product images are available for label fact extraction.",
  };
}

function hasMeaningfulPayloadValue(value: unknown): boolean {
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.some((entry) => hasMeaningfulPayloadValue(entry));
  const row = asObject(value);
  if (row) return Object.values(row).some((entry) => hasMeaningfulPayloadValue(entry));
  return false;
}

function createSourceRecord(input: {
  source: ProductFactSource;
  confidence: ProductFactConfidence;
  payload: unknown;
}): SourceRecord | null {
  const row = asObject(input.payload);
  if (!row) return null;
  if (!Object.values(row).some((entry) => hasMeaningfulPayloadValue(entry))) return null;
  return {
    source: input.source,
    confidence: input.confidence,
    payload: row,
  };
}

function extractLabelPayload(product: WalmartProductRecord): Record<string, unknown> | null {
  const normalized = asObject(product.normalizedPayload);
  const raw = asObject(product.rawPayload);

  const candidates: Array<Record<string, unknown> | null> = [
    asObject(normalized?.labelFacts),
    asObject(raw?.labelFacts),
    asObject(raw?.productLabelFacts),
    asObject(normalized?.productLabelFacts),
    asObject(normalized?.label),
    asObject(raw?.label),
  ];

  return candidates.find((entry) => entry !== null) ?? null;
}

function extractShopifyPayload(product: WalmartProductRecord): Record<string, unknown> | null {
  const normalized = asObject(product.normalizedPayload);
  const raw = asObject(product.rawPayload);

  const candidates: Array<Record<string, unknown> | null> = [
    asObject(normalized?.shopify),
    asObject(raw?.shopify),
    asObject(normalized?.shopifyProduct),
    asObject(raw?.shopifyProduct),
  ];

  return candidates.find((entry) => entry !== null) ?? null;
}

function readVisionExtractionEnvelopeFromRecord(
  record: Record<string, unknown> | null
): Record<string, unknown> | null {
  if (!record) return null;
  const candidates: Array<Record<string, unknown> | null> = [
    asObject(record.visionFactPayload),
    asObject(record.imageVisionExtraction),
    asObject(record.image_vision_extraction),
    asObject(asObject(record.normalizedPayload)?.visionFactPayload),
    asObject(asObject(record.normalizedPayload)?.imageVisionExtraction),
    asObject(asObject(record.rawPayload)?.visionFactPayload),
    asObject(asObject(record.rawPayload)?.imageVisionExtraction),
  ];

  return candidates.find((entry) => entry !== null) ?? null;
}

function extractVisionPayloadFromRecord(record: Record<string, unknown> | null): Record<string, unknown> | null {
  const payload = readVisionExtractionEnvelopeFromRecord(record);
  if (!payload) return null;
  const status = asString(payload.status).toLowerCase();
  if (status && status !== "extracted") {
    return null;
  }

  return payload;
}

function buildSourceRecords(input: {
  product: WalmartProductRecord;
  draftPayload?: Record<string, unknown> | null;
  manualOverrides?: Record<string, unknown> | null;
  imageDerivedPayload?: Record<string, unknown> | null;
}): SourceRecord[] {
  const records: SourceRecord[] = [];

  const manual = createSourceRecord({
    source: "manual",
    confidence: "high",
    payload: input.manualOverrides,
  });
  if (manual) records.push(manual);

  const label = createSourceRecord({
    source: "label_image",
    confidence: "high",
    payload: extractLabelPayload(input.product),
  });
  if (label) records.push(label);

  const imageText = createSourceRecord({
    source: "image_text",
    confidence: "high",
    payload: input.imageDerivedPayload,
  });
  if (imageText) records.push(imageText);

  const visionExtraction = createSourceRecord({
    source: "vision_extraction",
    confidence: "high",
    payload:
      extractVisionPayloadFromRecord(input.draftPayload ?? null) ??
      extractVisionPayloadFromRecord({
        normalizedPayload: input.product.normalizedPayload,
        rawPayload: input.product.rawPayload,
      }),
  });
  if (visionExtraction) records.push(visionExtraction);

  const shopify = createSourceRecord({
    source: "shopify",
    confidence: "medium",
    payload: extractShopifyPayload(input.product),
  });
  if (shopify) records.push(shopify);

  const walmartDraft = createSourceRecord({
    source: "walmart_draft",
    confidence: "medium",
    payload: input.draftPayload,
  });
  if (walmartDraft) records.push(walmartDraft);

  records.push({
    source: "walmart_product",
    confidence: "low",
    payload: input.product as unknown as Record<string, unknown>,
  });

  return records;
}

function compareCandidatePriority<T>(left: FieldCandidate<T>, right: FieldCandidate<T>): number {
  const leftRank = SOURCE_PRIORITY[left.source];
  const rightRank = SOURCE_PRIORITY[right.source];
  if (leftRank !== rightRank) return rightRank - leftRank;
  return left.source.localeCompare(right.source);
}

function pickStringCandidate(input: {
  records: SourceRecord[];
  keys: string[];
  normalize?: (value: string) => string;
  fallbackTextForInference?: string;
  infer?: (text: string) => string;
}): FieldCandidate<string> | null {
  const candidates: FieldCandidate<string>[] = [];

  for (const record of input.records) {
    const value = findFirstValue(record.payload, input.keys);
    const normalized = input.normalize ? input.normalize(value) : value;
    if (normalized) {
      candidates.push({
        value: normalized,
        source: record.source,
        confidence: record.confidence,
      });
      continue;
    }

    if (input.infer) {
      let inferred = input.infer(JSON.stringify(record.payload));
      if (!inferred && input.fallbackTextForInference && record.source === "walmart_product") {
        inferred = input.infer(input.fallbackTextForInference);
      }
      if (inferred) {
        candidates.push({
          value: inferred,
          source: record.source,
          confidence: record.source === "label_image" ? "high" : record.confidence,
        });
      }
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort(compareCandidatePriority);
  return candidates[0];
}

function pickListCandidate(input: {
  records: SourceRecord[];
  keys: string[];
}): FieldCandidate<string[]> | null {
  const candidates: FieldCandidate<string[]>[] = [];
  for (const record of input.records) {
    const value = findFirstList(record.payload, input.keys);
    if (value.length === 0) continue;
    candidates.push({
      value: unique(value),
      source: record.source,
      confidence: record.confidence,
    });
  }

  if (candidates.length === 0) return null;
  candidates.sort(compareCandidatePriority);
  return candidates[0];
}

function pickObjectCandidate(input: {
  records: SourceRecord[];
  keys: string[];
}): FieldCandidate<Record<string, string>> | null {
  const candidates: FieldCandidate<Record<string, string>>[] = [];
  for (const record of input.records) {
    const value = findFirstObject(record.payload, input.keys);
    if (Object.keys(value).length === 0) continue;
    candidates.push({
      value,
      source: record.source,
      confidence: record.confidence,
    });
  }

  if (candidates.length === 0) return null;
  candidates.sort(compareCandidatePriority);
  return candidates[0];
}

function normalizeFieldKey(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
}

function rankImageFactConfidence(confidence: ImageFactConfidence): number {
  if (confidence === "high") return 3;
  if (confidence === "medium") return 2;
  return 1;
}

function pickImageFactValue(
  facts: ImageDerivedFact[],
  fields: string[],
  minConfidence: ImageFactConfidence = "medium"
): string {
  const minRank = rankImageFactConfidence(minConfidence);
  const best = facts
    .filter(
      (entry) =>
        fields.includes(entry.field) &&
        rankImageFactConfidence(entry.confidence) >= minRank &&
        entry.value.trim().length > 0
    )
    .sort(
      (left, right) =>
        rankImageFactConfidence(right.confidence) - rankImageFactConfidence(left.confidence)
    )[0];
  return best?.value.trim() ?? "";
}

function collectImageFactValues(
  facts: ImageDerivedFact[],
  fields: string[],
  minConfidence: ImageFactConfidence = "medium"
): string[] {
  const minRank = rankImageFactConfidence(minConfidence);
  return unique(
    facts
      .filter(
        (entry) =>
          fields.includes(entry.field) &&
          rankImageFactConfidence(entry.confidence) >= minRank &&
          entry.value.trim().length > 0
      )
      .map((entry) => entry.value)
  );
}

function buildFieldMetadata<T>(input: {
  key: string;
  selected: FieldCandidate<T> | null;
  fallbackValue: T;
}): {
  value: T;
  confidence: ProductFactConfidence;
  evidence: ProductFactSource[];
} {
  if (!input.selected) {
    return {
      value: input.fallbackValue,
      confidence: "unknown",
      evidence: [],
    };
  }

  return {
    value: input.selected.value,
    confidence: input.selected.confidence,
    evidence: [input.selected.source],
  };
}

function collectContradictions<T>(input: {
  field: string;
  selected: FieldCandidate<T> | null;
  all: FieldCandidate<T>[];
  normalizeComparison: (value: T) => string;
}): ProductFactReplacement[] {
  const selected = input.selected;
  if (!selected) return [];
  if (selected.confidence !== "high") return [];

  const selectedValue = input.normalizeComparison(selected.value);
  if (!selectedValue) return [];

  return input.all
    .filter((candidate) => candidate.source !== selected.source)
    .filter((candidate) => SOURCE_PRIORITY[candidate.source] < SOURCE_PRIORITY[selected.source])
    .map((candidate) => {
      const candidateValue = input.normalizeComparison(candidate.value);
      if (!candidateValue || candidateValue === selectedValue) return null;
      return {
        field: input.field,
        previousValue: candidateValue,
        nextValue: selectedValue,
        reason: `${selected.source} outranks ${candidate.source} for ${input.field}`,
      } as ProductFactReplacement;
    })
    .filter((entry): entry is ProductFactReplacement => entry !== null);
}

export function extractCanonicalProductFacts(input: {
  product: WalmartProductRecord;
  draftPayload?: Record<string, unknown> | null;
  manualOverrides?: Record<string, unknown> | null;
}): ProductFactsAgentResult {
  const imageIntelligence = extractImageDerivedFactsFromProduct(input.product);
  const imageForm = pickImageFactValue(imageIntelligence.factsList, ["form"]);
  const imageCount = pickImageFactValue(imageIntelligence.factsList, ["count"]);
  const imageServingSize = pickImageFactValue(imageIntelligence.factsList, ["servingSize"]);
  const imageServings = pickImageFactValue(imageIntelligence.factsList, ["servingsPerContainer"]);
  const imageDosageStrength = pickImageFactValue(imageIntelligence.factsList, ["dosageStrength"]);
  const imageSuggestedUse = pickImageFactValue(imageIntelligence.factsList, ["suggestedUse"]);
  const imageWarnings = pickImageFactValue(
    imageIntelligence.factsList,
    ["warnings", "safety_warnings"]
  );
  const imageSupportAreas = collectImageFactValues(imageIntelligence.factsList, [
    "supportArea",
    "supportAreas",
  ]);
  const imageIngredients = collectImageFactValues(imageIntelligence.factsList, [
    "activeIngredient",
    "activeIngredients",
    "main_ingredients",
  ]);

  const imageDerivedPayload: Record<string, unknown> = {
    form: imageForm,
    product_form: imageForm,
    count: imageCount,
    servingSize: imageServingSize,
    serving_size: imageServingSize,
    servingsPerContainer: imageServings,
    servings_per_container: imageServings,
    dosageStrength: imageDosageStrength,
    dosage_strength: imageDosageStrength,
    suggestedUse: imageSuggestedUse,
    suggested_use: imageSuggestedUse,
    warnings: imageWarnings,
    safety_warnings: imageWarnings,
    support_areas: imageSupportAreas.join(", "),
    activeIngredients: imageIngredients,
    main_ingredients: imageIngredients.join(", "),
  };

  const records = buildSourceRecords({
    ...input,
    imageDerivedPayload,
  });
  const sourceSet = new Set<ProductFactSource>(records.map((entry) => entry.source));
  const visionExtractionEnvelope =
    readVisionExtractionEnvelopeFromRecord(input.draftPayload ?? null) ??
    readVisionExtractionEnvelopeFromRecord({
      normalizedPayload: input.product.normalizedPayload,
      rawPayload: input.product.rawPayload,
    });
  const explicitVisionStatus = parseVisionExtractionStatus(visionExtractionEnvelope);
  const labelPayload = extractLabelPayload(input.product);

  const titleFallback = [
    asString(input.product.title),
    asString(asObject(input.product.normalizedPayload)?.title),
    asString(asObject(input.product.rawPayload)?.title),
    asString(asObject(extractLabelPayload(input.product))?.labelText),
  ]
    .filter(Boolean)
    .join("\n");
  const titleInferenceText = [asString(input.product.title), titleFallback]
    .filter(Boolean)
    .join("\n");
  const heuristicStaleAdjustments: ProductFactReplacement[] = [];

  const brandCandidates = records
    .map((record) => {
      const value = findFirstValue(record.payload, ["brand", "brandName"]);
      if (!value) return null;
      return {
        value,
        source: record.source,
        confidence: record.confidence,
      } as FieldCandidate<string>;
    })
    .filter((entry): entry is FieldCandidate<string> => entry !== null)
    .sort(compareCandidatePriority);
  const selectedBrand = brandCandidates[0] ?? null;

  const manufacturerCandidates = records
    .map((record) => {
      const value = findFirstValue(record.payload, [
        "manufacturer",
        "manufacturerName",
        "distributedBy",
        "distributor",
      ]);
      if (!value) return null;
      return {
        value,
        source: record.source,
        confidence: record.confidence,
      } as FieldCandidate<string>;
    })
    .filter((entry): entry is FieldCandidate<string> => entry !== null)
    .sort(compareCandidatePriority);
  const selectedManufacturer = manufacturerCandidates[0] ?? null;

  const productName = pickStringCandidate({
    records,
    keys: ["productName", "name", "title"],
    fallbackTextForInference: titleFallback,
    infer: (text) => asString(text),
  });

  const series = pickStringCandidate({
    records,
    keys: ["series", "productSeries", "line"],
  });

  const sku = pickStringCandidate({
    records,
    keys: ["sku"],
    fallbackTextForInference: input.product.sku,
    infer: (text) => asString(text),
  });

  let form = pickStringCandidate({
    records,
    keys: ["form", "product_form", "productForm"],
    normalize: normalizeForm,
    fallbackTextForInference: titleFallback,
    infer: inferFormFromText,
  });

  const count = pickStringCandidate({
    records,
    keys: ["count", "quantity", "countPerContainer", "count_per_pack"],
    normalize: normalizeCount,
    fallbackTextForInference: titleFallback,
    infer: inferCountFromText,
  });

  const supply = pickStringCandidate({
    records,
    keys: ["supply", "daySupply", "daysSupply", "supplyDays"],
    fallbackTextForInference: titleFallback,
    infer: inferSupplyFromText,
  });

  const flavorFromLabelEvidence = labelPayload
    ? normalizeFlavor(
        findFirstValue(labelPayload, ["flavor", "flavour", "naturalFlavor", "natural_flavor"])
      ) || inferFlavorFromText(JSON.stringify(labelPayload))
    : "";

  let flavor = pickStringCandidate({
    records,
    keys: ["flavor", "flavour", "naturalFlavor", "natural_flavor"],
    normalize: normalizeFlavor,
    fallbackTextForInference: titleFallback,
    infer: inferFlavorFromText,
  });

  if (labelPayload && !flavorFromLabelEvidence) {
    const selectedFlavorSource = flavor?.source;
    const shouldClearBecauseUnknownLabelFlavor =
      !selectedFlavorSource || selectedFlavorSource === "walmart_draft" || selectedFlavorSource === "shopify";
    if (shouldClearBecauseUnknownLabelFlavor) {
      flavor = null;
    }
  }

  let servingSize = pickStringCandidate({
    records,
    keys: ["servingSize", "serving_size"],
    fallbackTextForInference: titleFallback,
    infer: inferServingSizeFromText,
  });

  let servingsPerContainer = pickStringCandidate({
    records,
    keys: ["servingsPerContainer", "servings_per_container", "servings"],
    fallbackTextForInference: titleFallback,
    infer: inferServingsPerContainerFromText,
  });

  let dosageStrength = pickStringCandidate({
    records,
    keys: ["dosageStrength", "dosage_strength", "strength"],
  });

  let activeIngredients = pickListCandidate({
    records,
    keys: [
      "activeIngredients",
      "active_ingredients",
      "mainIngredients",
      "main_ingredients",
      "ingredientsHighlights",
      "ingredients_highlights",
    ],
  });

  const inferredFormFromTitle = inferFormFromText(titleInferenceText);
  if (
    inferredFormFromTitle &&
    (!form || isWeakFactCandidate(form)) &&
    normalizeFieldKey(form?.value ?? "") !== normalizeFieldKey(inferredFormFromTitle)
  ) {
    if (form?.value) {
      heuristicStaleAdjustments.push({
        field: "form",
        previousValue: form.value,
        nextValue: inferredFormFromTitle,
        reason: "title inference overrode weak-source form value",
      });
    }
    form = {
      value: inferredFormFromTitle,
      source: "walmart_product",
      confidence: "low",
    };
  }

  const resolvedForm = form?.value ?? inferredFormFromTitle ?? "";

  const inferredServingsFromTitle = inferServingsPerContainerFromText(titleInferenceText);
  if (inferredServingsFromTitle) {
    const inferredServingsNumber = normalizeServingsNumber(inferredServingsFromTitle);
    const selectedServingsNumber = normalizeServingsNumber(servingsPerContainer?.value ?? "");
    const shouldPreferTitleServings =
      (!servingsPerContainer || isWeakFactCandidate(servingsPerContainer)) &&
      inferredServingsNumber.length > 0 &&
      inferredServingsNumber !== selectedServingsNumber;
    if (shouldPreferTitleServings) {
      if (servingsPerContainer?.value) {
        heuristicStaleAdjustments.push({
          field: "servingsPerContainer",
          previousValue: servingsPerContainer.value,
          nextValue: inferredServingsNumber,
          reason: "title-derived servings replaced stale weak-source value",
        });
      }
      servingsPerContainer = {
        value: inferredServingsNumber,
        source: "walmart_product",
        confidence: "low",
      };
    }
  }

  if (
    servingSize &&
    isWeakFactCandidate(servingSize) &&
    /powder|liquid/i.test(resolvedForm) &&
    SERVING_SIZE_CAPSULE_PATTERN.test(servingSize.value)
  ) {
    heuristicStaleAdjustments.push({
      field: "servingSize",
      previousValue: servingSize.value,
      nextValue: "",
      reason: "cleared weak-source serving size inconsistent with inferred form",
    });
    servingSize = null;
  }
  if (
    servingSize &&
    detectKnownStaleDemoValue({
      key: "serving_size",
      value: servingSize.value,
      titleHint: titleInferenceText,
      formHint: resolvedForm,
      servingsHint: servingsPerContainer?.value ?? "",
    })
  ) {
    heuristicStaleAdjustments.push({
      field: "servingSize",
      previousValue: servingSize.value,
      nextValue: "",
      reason: "stale serving size quarantined",
    });
    servingSize = null;
  }

  if (
    servingsPerContainer &&
    isWeakFactCandidate(servingsPerContainer) &&
    detectKnownStaleDemoValue({
      key: "servings_per_container",
      value: servingsPerContainer.value,
      titleHint: titleInferenceText,
      formHint: resolvedForm,
      servingsHint: servingsPerContainer.value,
    })
  ) {
    heuristicStaleAdjustments.push({
      field: "servingsPerContainer",
      previousValue: servingsPerContainer.value,
      nextValue: inferredServingsFromTitle || "",
      reason: "stale servings value quarantined",
    });
    if (inferredServingsFromTitle) {
      servingsPerContainer = {
        value: normalizeServingsNumber(inferredServingsFromTitle) || inferredServingsFromTitle,
        source: "walmart_product",
        confidence: "low",
      };
    } else {
      servingsPerContainer = null;
    }
  }

  if (
    dosageStrength &&
    isWeakFactCandidate(dosageStrength) &&
    DEMO_DOSAGE_PATTERN.test(dosageStrength.value) &&
    !titleMentionsAny(titleInferenceText, ["magnesium", "glycinate"])
  ) {
    heuristicStaleAdjustments.push({
      field: "dosageStrength",
      previousValue: dosageStrength.value,
      nextValue: "",
      reason: "cleared known demo dosage strength without title support",
    });
    dosageStrength = null;
  }
  if (
    dosageStrength &&
    detectKnownStaleDemoValue({
      key: "dosage_strength",
      value: dosageStrength.value,
      titleHint: titleInferenceText,
      formHint: resolvedForm,
    })
  ) {
    heuristicStaleAdjustments.push({
      field: "dosageStrength",
      previousValue: dosageStrength.value,
      nextValue: "",
      reason: "stale dosage strength quarantined",
    });
    dosageStrength = null;
  }

  if (
    activeIngredients &&
    isWeakFactCandidate(activeIngredients) &&
    looksLikeDemoJointIngredientList(activeIngredients.value) &&
    !titleMentionsAny(titleInferenceText, ["turmeric", "glucosamine", "chondroitin"])
  ) {
    heuristicStaleAdjustments.push({
      field: "activeIngredients",
      previousValue: activeIngredients.value.join(", "),
      nextValue: "",
      reason: "cleared known demo ingredient trio without title support",
    });
    activeIngredients = null;
  }

  if (
    flavor &&
    isWeakFactCandidate(flavor) &&
    DEMO_FLAVOR_PATTERN.test(flavor.value) &&
    !titleMentionsAny(titleInferenceText, ["mixed berry", "berry"])
  ) {
    heuristicStaleAdjustments.push({
      field: "flavor",
      previousValue: flavor.value,
      nextValue: "",
      reason: "cleared weak-source demo flavor",
    });
    flavor = null;
  }
  if (
    flavor &&
    detectKnownStaleDemoValue({
      key: "flavor",
      value: flavor.value,
      titleHint: titleInferenceText,
      formHint: resolvedForm,
    })
  ) {
    heuristicStaleAdjustments.push({
      field: "flavor",
      previousValue: flavor.value,
      nextValue: "",
      reason: "stale flavor quarantined",
    });
    flavor = null;
  }

  const supplementFacts = pickObjectCandidate({
    records,
    keys: ["supplementFacts", "supplement_facts", "nutritionFacts", "nutrition_facts"],
  });

  const otherIngredients = pickListCandidate({
    records,
    keys: ["otherIngredients", "other_ingredients", "ingredientsList", "ingredients_list"],
  });

  const doesNotContain = pickListCandidate({
    records,
    keys: [
      "doesNotContain",
      "does_not_contain",
      "allergenFreeStatements",
      "allergen_free_statements",
    ],
  });

  const suggestedUse = pickStringCandidate({
    records,
    keys: ["suggestedUse", "suggested_use", "directions", "directions_suggested_use"],
  });

  const warnings = pickStringCandidate({
    records,
    keys: ["warnings", "safetyWarnings", "safety_warnings"],
  });

  const storage = pickStringCandidate({
    records,
    keys: ["storage", "storageInstructions", "storage_instructions"],
  });

  const claims = pickListCandidate({
    records,
    keys: ["claims", "claimsFromLabel", "claims_from_label", "supportAreas", "support_areas"],
  });

  const madeInUsa = pickStringCandidate({
    records,
    keys: ["madeInUsa", "made_in_usa"],
    fallbackTextForInference: titleFallback,
    infer: inferMadeInUsa,
  });

  const origin = pickStringCandidate({
    records,
    keys: ["origin", "countryOfOrigin", "country_of_origin"],
  });

  const category = pickStringCandidate({
    records,
    keys: ["category", "supplement_type", "productType", "product_type"],
    normalize: normalizeCategory,
  });

  const targetAudience = pickStringCandidate({
    records,
    keys: ["targetAudience", "target_audience", "ageGroup", "age_group"],
    normalize: normalizeAudience,
  });

  const activeIngredientFallback = Object.entries(supplementFacts?.value ?? {})
    .filter(([key]) => /magnesium|ashwagandha|turmeric|glucosamine|chondroitin|msm|vitamin|zinc|calcium|melatonin/i.test(key))
    .map(([key, value]) => `${key}: ${value}`);

  const fields = {
    brand: buildFieldMetadata({
      key: "brand",
      selected: selectedBrand,
      fallbackValue: sanitizeCustomerFacingText(asString(input.product.brand)),
    }),
    manufacturer: buildFieldMetadata({
      key: "manufacturer",
      selected: selectedManufacturer,
      fallbackValue: "",
    }),
    productName: buildFieldMetadata({
      key: "productName",
      selected: productName,
      fallbackValue: sanitizeCustomerFacingText(asString(input.product.title)),
    }),
    series: buildFieldMetadata({ key: "series", selected: series, fallbackValue: "" }),
    sku: buildFieldMetadata({ key: "sku", selected: sku, fallbackValue: asString(input.product.sku) }),
    form: buildFieldMetadata({ key: "form", selected: form, fallbackValue: inferFormFromText(asString(input.product.title)) }),
    count: buildFieldMetadata({ key: "count", selected: count, fallbackValue: inferCountFromText(asString(input.product.title)) }),
    supply: buildFieldMetadata({ key: "supply", selected: supply, fallbackValue: "" }),
    flavor: buildFieldMetadata({ key: "flavor", selected: flavor, fallbackValue: "" }),
    servingSize: buildFieldMetadata({ key: "servingSize", selected: servingSize, fallbackValue: "" }),
    servingsPerContainer: buildFieldMetadata({ key: "servingsPerContainer", selected: servingsPerContainer, fallbackValue: "" }),
    dosageStrength: buildFieldMetadata({ key: "dosageStrength", selected: dosageStrength, fallbackValue: "" }),
    activeIngredients: buildFieldMetadata({
      key: "activeIngredients",
      selected: activeIngredients,
      fallbackValue: activeIngredientFallback,
    }),
    supplementFacts: buildFieldMetadata({
      key: "supplementFacts",
      selected: supplementFacts,
      fallbackValue: {},
    }),
    otherIngredients: buildFieldMetadata({ key: "otherIngredients", selected: otherIngredients, fallbackValue: [] }),
    allergenOrDoesNotContainStatements: buildFieldMetadata({
      key: "allergenOrDoesNotContainStatements",
      selected: doesNotContain,
      fallbackValue: [],
    }),
    suggestedUse: buildFieldMetadata({ key: "suggestedUse", selected: suggestedUse, fallbackValue: "" }),
    warnings: buildFieldMetadata({ key: "warnings", selected: warnings, fallbackValue: "" }),
    storage: buildFieldMetadata({ key: "storage", selected: storage, fallbackValue: "" }),
    claimsFromLabel: buildFieldMetadata({ key: "claimsFromLabel", selected: claims, fallbackValue: [] }),
    madeInUsa: buildFieldMetadata({ key: "madeInUsa", selected: madeInUsa, fallbackValue: "" }),
    origin: buildFieldMetadata({ key: "origin", selected: origin, fallbackValue: "" }),
    category: buildFieldMetadata({ key: "category", selected: category, fallbackValue: asString(input.product.category) }),
    productType: buildFieldMetadata({ key: "productType", selected: category, fallbackValue: asString(input.product.category) }),
    targetAudience: buildFieldMetadata({ key: "targetAudience", selected: targetAudience, fallbackValue: "Adults" }),
  };

  const allStringCandidateMap: Record<string, FieldCandidate<string>[]> = {
    brand: brandCandidates,
    manufacturer: manufacturerCandidates,
    productName: productName ? [productName] : [],
    form: form ? [form] : [],
    flavor: flavor ? [flavor] : [],
    count: count ? [count] : [],
  };

  const staleReplacements = Object.entries(allStringCandidateMap).flatMap(([field, selectedList]) => {
    const selected = selectedList[0] ?? null;
    if (!selected) return [];
    const sourceValues = records
      .map((record) => {
        if (field === "brand") {
          const value = findFirstValue(record.payload, ["brand", "brandName"]);
          if (!value) return null;
          return { value, source: record.source, confidence: record.confidence } as FieldCandidate<string>;
        }
        if (field === "manufacturer") {
          const value = findFirstValue(record.payload, ["manufacturer", "manufacturerName", "distributor"]);
          if (!value) return null;
          return { value, source: record.source, confidence: record.confidence } as FieldCandidate<string>;
        }
        if (field === "productName") {
          const value = findFirstValue(record.payload, ["productName", "name", "title"]);
          if (!value) return null;
          return { value, source: record.source, confidence: record.confidence } as FieldCandidate<string>;
        }
        if (field === "form") {
          const value = normalizeForm(findFirstValue(record.payload, ["form", "product_form", "productForm"])) || inferFormFromText(JSON.stringify(record.payload));
          if (!value) return null;
          return { value, source: record.source, confidence: record.confidence } as FieldCandidate<string>;
        }
        if (field === "flavor") {
          const value = normalizeFlavor(findFirstValue(record.payload, ["flavor", "flavour", "naturalFlavor"])) || inferFlavorFromText(JSON.stringify(record.payload));
          if (!value) return null;
          return { value, source: record.source, confidence: record.confidence } as FieldCandidate<string>;
        }
        if (field === "count") {
          const value = normalizeCount(findFirstValue(record.payload, ["count", "quantity", "countPerContainer"])) || inferCountFromText(JSON.stringify(record.payload));
          if (!value) return null;
          return { value, source: record.source, confidence: record.confidence } as FieldCandidate<string>;
        }
        return null;
      })
      .filter((entry): entry is FieldCandidate<string> => entry !== null);

    return collectContradictions({
      field,
      selected,
      all: sourceValues,
      normalizeComparison: (value) => normalizeFieldKey(value),
    });
  });

  const baseStaleAdjustments = unique([
    ...staleReplacements.map((entry) => JSON.stringify(entry)),
    ...heuristicStaleAdjustments.map((entry) => JSON.stringify(entry)),
  ]).map((entry) => JSON.parse(entry) as ProductFactReplacement);

  const imageFactsStatus = deriveImageFactsStatus({
    product: input.product,
    factsList: imageIntelligence.factsList,
    usedSources: imageIntelligence.usedSources,
    visionExtractionStatus: explicitVisionStatus,
  });

  const hasGroundedSupplementFact = (
    field: keyof typeof fields,
    requireStrongEvidence = false
  ): boolean => {
    const confidence = fields[field].confidence;
    const evidence = fields[field].evidence ?? [];
    const confidenceOkay = confidence === "high" || confidence === "medium";
    if (!confidenceOkay) return false;
    if (!requireStrongEvidence) return true;
    return evidence.some((source) => source === "label_image" || source === "vision_extraction");
  };

  const hasGroundedSupplementEvidence =
    hasGroundedSupplementFact("activeIngredients", true) ||
    hasGroundedSupplementFact("supplementFacts", true) ||
    hasGroundedSupplementFact("servingSize") ||
    hasGroundedSupplementFact("servingsPerContainer") ||
    hasGroundedSupplementFact("suggestedUse");

  if (imageFactsStatus.status === "needs_vision_extraction" && !hasGroundedSupplementEvidence) {
    if (fields.activeIngredients.value.length > 0) {
      heuristicStaleAdjustments.push({
        field: "activeIngredients",
        previousValue: fields.activeIngredients.value.join(", "),
        nextValue: "",
        reason: "ingredient claims blocked until label extraction runs",
      });
    }
    if (fields.dosageStrength.value) {
      heuristicStaleAdjustments.push({
        field: "dosageStrength",
        previousValue: fields.dosageStrength.value,
        nextValue: "",
        reason: "dosage claims blocked until label extraction runs",
      });
    }
    if (Object.keys(fields.supplementFacts.value).length > 0) {
      heuristicStaleAdjustments.push({
        field: "supplementFacts",
        previousValue: Object.entries(fields.supplementFacts.value)
          .map(([key, value]) => `${key}:${value}`)
          .join(", "),
        nextValue: "",
        reason: "supplement facts blocked until label extraction runs",
      });
    }
    fields.activeIngredients.value = [];
    fields.activeIngredients.confidence = "unknown";
    fields.activeIngredients.evidence = [];
    fields.dosageStrength.value = "";
    fields.dosageStrength.confidence = "unknown";
    fields.dosageStrength.evidence = [];
    fields.supplementFacts.value = {};
    fields.supplementFacts.confidence = "unknown";
    fields.supplementFacts.evidence = [];
    fields.otherIngredients.value = [];
    fields.otherIngredients.confidence = "unknown";
    fields.otherIngredients.evidence = [];
  }

  const manufacturerSource = fields.manufacturer.evidence[0] ?? "unknown";
  const manufacturerConfidence = fields.manufacturer.confidence;
  const manufacturerNeedsReview = Boolean(
    !fields.manufacturer.value ||
      (!fields.manufacturer.evidence.length &&
        fields.brand.value &&
        fields.manufacturer.value.toLowerCase() === fields.brand.value.toLowerCase())
  );

  const allStaleAdjustments = unique([
    ...baseStaleAdjustments.map((entry) => JSON.stringify(entry)),
    ...heuristicStaleAdjustments.map((entry) => JSON.stringify(entry)),
  ]).map((entry) => JSON.parse(entry) as ProductFactReplacement);

  const staleFieldsCleared = unique(
    allStaleAdjustments
      .filter((entry) => !entry.nextValue.trim())
      .map((entry) => entry.field)
  );

  const facts: CanonicalProductFacts = {
    brand: fields.brand.value,
    manufacturer: fields.manufacturer.value,
    productName: fields.productName.value,
    series: fields.series.value,
    sku: fields.sku.value,
    form: fields.form.value,
    count: fields.count.value,
    supply: fields.supply.value,
    flavor: fields.flavor.value,
    servingSize: fields.servingSize.value,
    servingsPerContainer: fields.servingsPerContainer.value,
    dosageStrength: fields.dosageStrength.value,
    activeIngredients: fields.activeIngredients.value,
    supplementFacts: fields.supplementFacts.value,
    otherIngredients: fields.otherIngredients.value,
    allergenOrDoesNotContainStatements: fields.allergenOrDoesNotContainStatements.value,
    suggestedUse: fields.suggestedUse.value,
    warnings: fields.warnings.value,
    storage: fields.storage.value,
    claimsFromLabel: fields.claimsFromLabel.value,
    madeInUsa: fields.madeInUsa.value,
    origin: fields.origin.value,
    category: fields.category.value,
    productType: fields.productType.value,
    targetAudience: fields.targetAudience.value,
    sourceConfidence: Object.fromEntries(
      Object.entries(fields).map(([key, value]) => [key, value.confidence])
    ),
    sourceEvidence: Object.fromEntries(
      Object.entries(fields).map(([key, value]) => [key, value.evidence])
    ),
  };

  return {
    facts,
    usedSources: Array.from(sourceSet),
    staleFieldReplacements: allStaleAdjustments,
    staleFieldsCleared,
    imageDerivedFacts: imageIntelligence.factsList,
    imageFactsStatus: imageFactsStatus.status,
    imageFactsMessage: imageFactsStatus.message,
    manufacturerSource,
    manufacturerConfidence,
    manufacturerNeedsReview,
  };
}

export function buildLabelFactsFixtureForRoc949(): Record<string, unknown> {
  return {
    brand: "OPA Nutrition",
    manufacturer: "OPA Nutrition",
    productName: "Magnesium Glycinate Gummies",
    series: "OPA Sleep Series",
    category: "Magnesium Supplement",
    productType: "Sleep Support Supplement",
    form: "Gummies",
    flavor: "Grape",
    count: "60 gummies",
    supply: "60 day supply",
    servingSize: "1 gummy",
    servingsPerContainer: "60",
    dosageStrength: "Magnesium (as Magnesium Glycinate) 30mg",
    activeIngredients: ["Magnesium (as Magnesium Glycinate) 30mg"],
    supplementFacts: {
      Calories: "10",
      "Total Carbohydrates": "2g",
      "Total Sugars": "2g",
      "Added Sugars": "2g",
      "Magnesium (as Magnesium Glycinate)": "30mg",
      Sodium: "5mg",
    },
    otherIngredients: [
      "Glucose syrup",
      "Sugar",
      "Phosphoric acid",
      "Pectin",
      "Sodium citrate",
      "Natural Flavor (Grape)",
      "Colors added",
      "Purple carrot juice concentrate",
      "Sucralose",
    ],
    doesNotContain: [
      "Yeast",
      "Wheat",
      "Milk",
      "Eggs",
      "Gluten",
      "Soy",
      "Gelatin",
      "Peanuts",
      "Shellfish",
      "Dairy",
      "Artificial sweeteners",
      "Artificial colors",
      "Artificial flavors",
      "Artificial preservatives",
      "Salicylates",
    ],
    suggestedUse:
      "Adults take one gummy daily, or as directed by your healthcare professional.",
    warnings:
      "Consult your healthcare professional before use if under physician care, taking medication, pregnant, nursing, or have a known medical condition. Keep out of reach of children. Do not use if safety seal is damaged or missing.",
    storage: "Store in a cool, dry place.",
    claimsFromLabel: ["Calming Mineral Complex", "Extra Strength"],
    targetAudience: "Adults seeking relaxation and sleep quality support",
  };
}
