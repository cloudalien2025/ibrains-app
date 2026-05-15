import type { WalmartProductRecord } from "@/lib/ecomviper/walmart/walmart-types";

export type ImageFactConfidence = "high" | "medium" | "low";
export type ImageFactSource =
  | "front_label_text"
  | "supplement_facts_text"
  | "ocr_text"
  | "image_metadata";

export interface ImageDerivedFact {
  field: string;
  value: string;
  confidence: ImageFactConfidence;
  source: ImageFactSource;
}

export interface WalmartImageIntelligenceResult {
  facts: Record<string, string | string[] | Record<string, string>>;
  factsList: ImageDerivedFact[];
  usedSources: ImageFactSource[];
}

interface ImageTextInputBundle {
  frontLabelText: string;
  supplementFactsText: string;
  ocrText: string;
  metadataText: string;
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function asString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function toJoinedText(value: unknown): string {
  if (Array.isArray(value)) {
    return value
      .map((entry) => toJoinedText(entry))
      .filter(Boolean)
      .join("\n")
      .trim();
  }

  const row = asObject(value);
  if (row) {
    const pieces = Object.values(row)
      .map((entry) => toJoinedText(entry))
      .filter(Boolean);
    return pieces.join("\n").trim();
  }

  return asString(value);
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((entry) => entry.trim()).filter(Boolean)));
}

function normalizeText(value: string): string {
  return value.replace(/\r\n/g, "\n").replace(/[ \t]{2,}/g, " ").trim();
}

function readImageTextBundle(product: WalmartProductRecord): ImageTextInputBundle {
  const normalized = asObject(product.normalizedPayload) ?? {};
  const raw = asObject(product.rawPayload) ?? {};

  const lookup = (keys: string[]): string => {
    for (const key of keys) {
      const value = toJoinedText(normalized[key] ?? raw[key]);
      if (value) return normalizeText(value);
    }
    return "";
  };

  const frontLabelText = lookup([
    "frontLabelText",
    "front_label_text",
    "labelText",
    "label_text",
    "imageLabelText",
    "image_label_text",
    "imageTextFront",
  ]);

  const supplementFactsText = lookup([
    "supplementFactsText",
    "supplement_facts_text",
    "nutritionFactsText",
    "nutrition_facts_text",
    "factsPanelText",
    "facts_panel_text",
  ]);

  const ocrText = lookup([
    "ocrText",
    "ocr_text",
    "imageOcrText",
    "image_ocr_text",
    "imageText",
    "image_text",
    "imageTextBlocks",
    "image_text_blocks",
  ]);

  const metadataText = lookup([
    "imageMetadataText",
    "image_metadata_text",
    "imageCaptionText",
    "image_caption_text",
    "imageTags",
    "image_tags",
  ]);

  return {
    frontLabelText,
    supplementFactsText,
    ocrText,
    metadataText,
  };
}

function detectForm(text: string): string {
  if (!text) return "";
  if (/\bgummies?\b/i.test(text)) return "Gummies";
  if (/\bcapsules?\b/i.test(text)) return "Capsules";
  if (/\bsoftgels?\b/i.test(text)) return "Softgels";
  if (/\btablets?\b/i.test(text)) return "Tablets";
  if (/\bpowder\b/i.test(text)) return "Powder";
  if (/\bliquid\b/i.test(text)) return "Liquid";
  return "";
}

function detectCount(text: string): string {
  const match = text.match(/\b(\d{1,4})\s*(ct|count|capsules?|softgels?|gummies?|tablets?)\b/i);
  if (!match) return "";
  return `${match[1]} ${match[2]}`.replace(/\s+/g, " ").trim();
}

function detectServingSize(text: string): string {
  const match = text.match(/serving\s*size\s*[:\-]?\s*([^\n.;]+)/i);
  return match?.[1]?.trim() ?? "";
}

function detectServingsPerContainer(text: string): string {
  const match = text.match(/servings\s*per\s*container\s*[:\-]?\s*([^\n.;]+)/i);
  return match?.[1]?.trim() ?? "";
}

function detectSuggestedUse(text: string): string {
  const match = text.match(/(?:suggested\s+use|directions?)\s*[:\-]?\s*([^\n]+(?:\n(?!warnings?|caution|supplement\s+facts)[^\n]+){0,2})/i);
  return match?.[1]?.replace(/\s+/g, " ").trim() ?? "";
}

function detectWarnings(text: string): string {
  const match = text.match(/(?:warnings?|caution)\s*[:\-]?\s*([^\n]+(?:\n(?!suggested\s+use|directions?|supplement\s+facts)[^\n]+){0,2})/i);
  return match?.[1]?.replace(/\s+/g, " ").trim() ?? "";
}

function detectDosageStrength(text: string): string {
  const match = text.match(/\b([A-Za-z][A-Za-z\s()]+?)\s+(\d+(?:\.\d+)?\s?(?:mg|mcg|g|iu))\b/i);
  if (!match) return "";
  return `${match[1].trim()} ${match[2].trim()}`;
}

function detectSupportAreas(text: string): string[] {
  const supports: Array<{ pattern: RegExp; label: string }> = [
    { pattern: /sleep|rest/i, label: "sleep quality support" },
    { pattern: /relax|calm/i, label: "relaxation support" },
    { pattern: /joint|mobility|comfort/i, label: "mobility support" },
    { pattern: /circulation|heart/i, label: "heart wellness" },
    { pattern: /digestive|gut/i, label: "digestive wellness" },
    { pattern: /immune/i, label: "immune support" },
    { pattern: /performance|endurance|energy/i, label: "performance support" },
  ];

  const found: string[] = [];
  for (const entry of supports) {
    if (entry.pattern.test(text)) found.push(entry.label);
  }
  return unique(found);
}

function detectIngredients(text: string): string[] {
  const lines = text.split(/\n+/).map((entry) => entry.trim());
  const ingredients: string[] = [];

  for (const line of lines) {
    const match = line.match(/^(?:\*\s*)?([A-Za-z][A-Za-z\s()]+?)\s+(\d+(?:\.\d+)?\s?(?:mg|mcg|g|iu))\b/i);
    if (!match) continue;
    const name = match[1].trim();
    if (/serving\s*size|servings\s*per\s*container|calories|sugars?|sodium/i.test(name)) {
      continue;
    }
    ingredients.push(`${name} ${match[2].trim()}`);
  }

  return unique(ingredients).slice(0, 12);
}

function pickBest(
  candidates: Array<{ value: string; source: ImageFactSource; confidence: ImageFactConfidence }>
): { value: string; source: ImageFactSource; confidence: ImageFactConfidence } | null {
  const ranked = candidates
    .filter((entry) => entry.value.trim())
    .sort((left, right) => {
      const sourceRank: Record<ImageFactSource, number> = {
        front_label_text: 4,
        supplement_facts_text: 4,
        ocr_text: 2,
        image_metadata: 1,
      };
      const confidenceRank: Record<ImageFactConfidence, number> = {
        high: 3,
        medium: 2,
        low: 1,
      };
      const sourceDiff = sourceRank[right.source] - sourceRank[left.source];
      if (sourceDiff !== 0) return sourceDiff;
      return confidenceRank[right.confidence] - confidenceRank[left.confidence];
    });

  return ranked[0] ?? null;
}

function addFact(
  list: ImageDerivedFact[],
  field: string,
  value: string,
  source: ImageFactSource,
  confidence: ImageFactConfidence
) {
  const normalized = value.trim();
  if (!normalized) return;
  list.push({
    field,
    value: normalized,
    source,
    confidence,
  });
}

export function extractImageDerivedFactsFromProduct(
  product: WalmartProductRecord
): WalmartImageIntelligenceResult {
  const text = readImageTextBundle(product);
  const usedSources: ImageFactSource[] = [];
  if (text.frontLabelText) usedSources.push("front_label_text");
  if (text.supplementFactsText) usedSources.push("supplement_facts_text");
  if (text.ocrText) usedSources.push("ocr_text");
  if (text.metadataText) usedSources.push("image_metadata");

  const factsList: ImageDerivedFact[] = [];

  const form = pickBest([
    {
      value: detectForm(text.frontLabelText),
      source: "front_label_text",
      confidence: "high",
    },
    {
      value: detectForm(text.supplementFactsText),
      source: "supplement_facts_text",
      confidence: "high",
    },
    {
      value: detectForm(text.ocrText),
      source: "ocr_text",
      confidence: "medium",
    },
    {
      value: detectForm(text.metadataText),
      source: "image_metadata",
      confidence: "low",
    },
  ]);

  const count = pickBest([
    {
      value: detectCount(text.frontLabelText),
      source: "front_label_text",
      confidence: "high",
    },
    {
      value: detectCount(text.ocrText),
      source: "ocr_text",
      confidence: "medium",
    },
    {
      value: detectCount(text.metadataText),
      source: "image_metadata",
      confidence: "low",
    },
  ]);

  const servingSize = pickBest([
    {
      value: detectServingSize(text.supplementFactsText),
      source: "supplement_facts_text",
      confidence: "high",
    },
    {
      value: detectServingSize(text.ocrText),
      source: "ocr_text",
      confidence: "medium",
    },
  ]);

  const servingsPerContainer = pickBest([
    {
      value: detectServingsPerContainer(text.supplementFactsText),
      source: "supplement_facts_text",
      confidence: "high",
    },
    {
      value: detectServingsPerContainer(text.ocrText),
      source: "ocr_text",
      confidence: "medium",
    },
  ]);

  const suggestedUse = pickBest([
    {
      value: detectSuggestedUse(text.frontLabelText),
      source: "front_label_text",
      confidence: "high",
    },
    {
      value: detectSuggestedUse(text.ocrText),
      source: "ocr_text",
      confidence: "medium",
    },
  ]);

  const warnings = pickBest([
    {
      value: detectWarnings(text.frontLabelText),
      source: "front_label_text",
      confidence: "high",
    },
    {
      value: detectWarnings(text.ocrText),
      source: "ocr_text",
      confidence: "medium",
    },
  ]);

  const dosageStrength = pickBest([
    {
      value: detectDosageStrength(text.supplementFactsText),
      source: "supplement_facts_text",
      confidence: "high",
    },
    {
      value: detectDosageStrength(text.ocrText),
      source: "ocr_text",
      confidence: "medium",
    },
  ]);

  const activeIngredients = unique([
    ...detectIngredients(text.supplementFactsText),
    ...detectIngredients(text.ocrText),
  ]).slice(0, 12);

  const supportAreas = unique([
    ...detectSupportAreas(text.frontLabelText),
    ...detectSupportAreas(text.ocrText),
    ...detectSupportAreas(text.metadataText),
  ]);

  if (form) addFact(factsList, "form", form.value, form.source, form.confidence);
  if (count) addFact(factsList, "count", count.value, count.source, count.confidence);
  if (servingSize) {
    addFact(
      factsList,
      "servingSize",
      servingSize.value,
      servingSize.source,
      servingSize.confidence
    );
  }
  if (servingsPerContainer) {
    addFact(
      factsList,
      "servingsPerContainer",
      servingsPerContainer.value,
      servingsPerContainer.source,
      servingsPerContainer.confidence
    );
  }
  if (suggestedUse) {
    addFact(
      factsList,
      "suggestedUse",
      suggestedUse.value,
      suggestedUse.source,
      suggestedUse.confidence
    );
  }
  if (warnings) {
    addFact(factsList, "warnings", warnings.value, warnings.source, warnings.confidence);
    addFact(
      factsList,
      "safety_warnings",
      warnings.value,
      warnings.source,
      warnings.confidence
    );
  }
  if (dosageStrength) {
    addFact(
      factsList,
      "dosageStrength",
      dosageStrength.value,
      dosageStrength.source,
      dosageStrength.confidence
    );
  }
  if (activeIngredients.length > 0) {
    for (const ingredient of activeIngredients.slice(0, 8)) {
      addFact(factsList, "activeIngredient", ingredient, "supplement_facts_text", "high");
      addFact(factsList, "main_ingredients", ingredient, "supplement_facts_text", "high");
    }
  }
  if (supportAreas.length > 0) {
    for (const area of supportAreas.slice(0, 8)) {
      addFact(factsList, "supportArea", area, "ocr_text", "medium");
    }
  }

  const facts: Record<string, string | string[] | Record<string, string>> = {};
  if (form) facts.form = form.value;
  if (count) facts.count = count.value;
  if (servingSize) facts.servingSize = servingSize.value;
  if (servingsPerContainer) facts.servingsPerContainer = servingsPerContainer.value;
  if (suggestedUse) facts.suggestedUse = suggestedUse.value;
  if (suggestedUse) facts.suggested_use = suggestedUse.value;
  if (warnings) facts.warnings = warnings.value;
  if (warnings) facts.safety_warnings = warnings.value;
  if (dosageStrength) facts.dosageStrength = dosageStrength.value;
  if (activeIngredients.length > 0) facts.activeIngredients = activeIngredients;
  if (activeIngredients.length > 0) facts.main_ingredients = activeIngredients;
  if (supportAreas.length > 0) facts.supportAreas = supportAreas;
  if (supportAreas.length > 0) facts.support_areas = supportAreas;

  return {
    facts,
    factsList,
    usedSources,
  };
}
