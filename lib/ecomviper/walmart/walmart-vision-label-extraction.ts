import type { WalmartProductRecord } from "@/lib/ecomviper/walmart/walmart-types";
import { normalizeWalmartImageUrlList } from "@/lib/ecomviper/walmart/walmart-image-fields";
import { sanitizeCustomerFacingText } from "@/lib/ecomviper/walmart/walmart-truth-guard";

export type VisionFieldConfidence = "high" | "medium" | "low" | "none";
export type VisionImageRole =
  | "front_label"
  | "supplement_facts"
  | "lifestyle_packaging"
  | "unknown";

export interface WalmartVisionFieldValue {
  value: string | string[];
  confidence: VisionFieldConfidence;
  sourceImageUrl: string;
  imageRole: VisionImageRole;
  extractedAt: string;
}

export interface WalmartVisionImageResult {
  imageUrl: string;
  imageRole: VisionImageRole;
  extracted: {
    brand: string;
    productName: string;
    form: string;
    flavor: string;
    servingSize: string;
    servingsPerContainer: string;
    count: string;
    dosageStrength: string;
    mainIngredients: string[];
    ingredientsList: string;
    suggestedUse: string;
    warnings: string;
    supportAreas: string[];
  };
  confidence: {
    brand: VisionFieldConfidence;
    productName: VisionFieldConfidence;
    form: VisionFieldConfidence;
    flavor: VisionFieldConfidence;
    servingSize: VisionFieldConfidence;
    servingsPerContainer: VisionFieldConfidence;
    count: VisionFieldConfidence;
    dosageStrength: VisionFieldConfidence;
    mainIngredients: VisionFieldConfidence;
    ingredientsList: VisionFieldConfidence;
    suggestedUse: VisionFieldConfidence;
    warnings: VisionFieldConfidence;
    supportAreas: VisionFieldConfidence;
  };
}

export interface WalmartVisionExtractionResult {
  status: "extracted" | "needs_vision_extraction" | "unavailable" | "low_confidence";
  message: string;
  extractedAt: string;
  imageCount: number;
  images: WalmartVisionImageResult[];
  fieldProvenance: Partial<
    Record<
      | "brand"
      | "productName"
      | "form"
      | "flavor"
      | "servingSize"
      | "servingsPerContainer"
      | "count"
      | "dosageStrength"
      | "mainIngredients"
      | "ingredientsList"
      | "suggestedUse"
      | "warnings"
      | "supportAreas",
      WalmartVisionFieldValue
    >
  >;
}

const VISION_MODEL = process.env.WALMART_OPENAI_VISION_MODEL?.trim() || "gpt-4.1-mini";

const CONFIDENCE_RANK: Record<VisionFieldConfidence, number> = {
  none: 0,
  low: 1,
  medium: 2,
  high: 3,
};

interface VisionResponseSchema {
  imageRole?: unknown;
  brand?: unknown;
  productName?: unknown;
  form?: unknown;
  flavor?: unknown;
  servingSize?: unknown;
  servingsPerContainer?: unknown;
  count?: unknown;
  dosageStrength?: unknown;
  mainIngredients?: unknown;
  ingredientsList?: unknown;
  suggestedUse?: unknown;
  warnings?: unknown;
  supportAreas?: unknown;
  confidence?: unknown;
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

function asStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return Array.from(
      new Set(
        value
          .map((entry) => sanitizeCustomerFacingText(asString(entry)))
          .filter(Boolean)
      )
    );
  }

  const normalized = sanitizeCustomerFacingText(asString(value));
  if (!normalized) return [];
  return Array.from(
    new Set(
      normalized
        .split(/[\n,;|]+/)
        .map((entry) => sanitizeCustomerFacingText(entry))
        .filter(Boolean)
    )
  );
}

function normalizeConfidence(value: unknown): VisionFieldConfidence {
  const normalized = asString(value).toLowerCase();
  if (normalized === "high") return "high";
  if (normalized === "medium") return "medium";
  if (normalized === "low") return "low";
  return "none";
}

function normalizeRole(value: unknown, imageUrl: string): VisionImageRole {
  const normalized = asString(value).toLowerCase();
  if (normalized === "front_label") return "front_label";
  if (normalized === "supplement_facts" || normalized === "back_label") {
    return "supplement_facts";
  }
  if (normalized === "lifestyle" || normalized === "lifestyle_packaging") {
    return "lifestyle_packaging";
  }

  const hint = imageUrl.toLowerCase();
  if (/supplement[-_ ]?facts|nutrition[-_ ]?facts|back[-_ ]?label/.test(hint)) {
    return "supplement_facts";
  }
  if (/front|hero|label/.test(hint)) {
    return "front_label";
  }
  if (/lifestyle|packaging|render/.test(hint)) {
    return "lifestyle_packaging";
  }
  return "unknown";
}

function parseJsonObject(raw: string): Record<string, unknown> {
  const trimmed = raw.trim();
  if (!trimmed) return {};

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    const objectParsed = asObject(parsed);
    if (objectParsed) return objectParsed;
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]) as unknown;
        const objectParsed = asObject(parsed);
        if (objectParsed) return objectParsed;
      } catch {
        return {};
      }
    }
  }

  return {};
}

function emptyImageResult(imageUrl: string): WalmartVisionImageResult {
  return {
    imageUrl,
    imageRole: normalizeRole("unknown", imageUrl),
    extracted: {
      brand: "",
      productName: "",
      form: "",
      flavor: "",
      servingSize: "",
      servingsPerContainer: "",
      count: "",
      dosageStrength: "",
      mainIngredients: [],
      ingredientsList: "",
      suggestedUse: "",
      warnings: "",
      supportAreas: [],
    },
    confidence: {
      brand: "none",
      productName: "none",
      form: "none",
      flavor: "none",
      servingSize: "none",
      servingsPerContainer: "none",
      count: "none",
      dosageStrength: "none",
      mainIngredients: "none",
      ingredientsList: "none",
      suggestedUse: "none",
      warnings: "none",
      supportAreas: "none",
    },
  };
}

async function extractFromSingleImage(input: {
  openAiApiKey: string;
  imageUrl: string;
  sku: string;
  title: string;
  brand: string;
  extractedAt: string;
}): Promise<WalmartVisionImageResult> {
  const fallback = emptyImageResult(input.imageUrl);

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.openAiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: VISION_MODEL,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are extracting supplement label facts from one product image. Return JSON only. Extract only visible text. Never infer missing ingredients, serving values, dosage, warnings, or supplement facts. If unreadable, return empty string/empty array and confidence none.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: JSON.stringify({
                task: "Classify image role and extract label facts.",
                sku: input.sku,
                title: input.title,
                brand: input.brand,
                schema: {
                  imageRole:
                    "front_label|supplement_facts|lifestyle_packaging|unknown",
                  brand: "",
                  productName: "",
                  form: "",
                  flavor: "",
                  servingSize: "",
                  servingsPerContainer: "",
                  count: "",
                  dosageStrength: "",
                  mainIngredients: [],
                  ingredientsList: "",
                  suggestedUse: "",
                  warnings: "",
                  supportAreas: [],
                  confidence: {
                    brand: "high|medium|low|none",
                    productName: "high|medium|low|none",
                    form: "high|medium|low|none",
                    flavor: "high|medium|low|none",
                    servingSize: "high|medium|low|none",
                    servingsPerContainer: "high|medium|low|none",
                    count: "high|medium|low|none",
                    dosageStrength: "high|medium|low|none",
                    mainIngredients: "high|medium|low|none",
                    ingredientsList: "high|medium|low|none",
                    suggestedUse: "high|medium|low|none",
                    warnings: "high|medium|low|none",
                    supportAreas: "high|medium|low|none",
                  },
                },
              }),
            },
            {
              type: "image_url",
              image_url: {
                url: input.imageUrl,
              },
            },
          ],
        },
      ],
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    return fallback;
  }

  const payload = (await response.json().catch(() => ({}))) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const raw = payload.choices?.[0]?.message?.content ?? "";
  const parsed = parseJsonObject(raw) as VisionResponseSchema;
  const confidence = asObject(parsed.confidence) ?? {};

  const result: WalmartVisionImageResult = {
    imageUrl: input.imageUrl,
    imageRole: normalizeRole(parsed.imageRole, input.imageUrl),
    extracted: {
      brand: sanitizeCustomerFacingText(parsed.brand),
      productName: sanitizeCustomerFacingText(parsed.productName),
      form: sanitizeCustomerFacingText(parsed.form),
      flavor: sanitizeCustomerFacingText(parsed.flavor),
      servingSize: sanitizeCustomerFacingText(parsed.servingSize),
      servingsPerContainer: sanitizeCustomerFacingText(parsed.servingsPerContainer),
      count: sanitizeCustomerFacingText(parsed.count),
      dosageStrength: sanitizeCustomerFacingText(parsed.dosageStrength),
      mainIngredients: asStringList(parsed.mainIngredients),
      ingredientsList: sanitizeCustomerFacingText(parsed.ingredientsList),
      suggestedUse: sanitizeCustomerFacingText(parsed.suggestedUse),
      warnings: sanitizeCustomerFacingText(parsed.warnings),
      supportAreas: asStringList(parsed.supportAreas),
    },
    confidence: {
      brand: normalizeConfidence(confidence.brand),
      productName: normalizeConfidence(confidence.productName),
      form: normalizeConfidence(confidence.form),
      flavor: normalizeConfidence(confidence.flavor),
      servingSize: normalizeConfidence(confidence.servingSize),
      servingsPerContainer: normalizeConfidence(confidence.servingsPerContainer),
      count: normalizeConfidence(confidence.count),
      dosageStrength: normalizeConfidence(confidence.dosageStrength),
      mainIngredients: normalizeConfidence(confidence.mainIngredients),
      ingredientsList: normalizeConfidence(confidence.ingredientsList),
      suggestedUse: normalizeConfidence(confidence.suggestedUse),
      warnings: normalizeConfidence(confidence.warnings),
      supportAreas: normalizeConfidence(confidence.supportAreas),
    },
  };

  return result;
}

function pickBestFieldValue<T extends string | string[]>(input: {
  entries: WalmartVisionImageResult[];
  field: keyof WalmartVisionImageResult["extracted"];
  extractValue: (entry: WalmartVisionImageResult) => T;
  extractConfidence: (entry: WalmartVisionImageResult) => VisionFieldConfidence;
  minConfidence: VisionFieldConfidence;
  extractedAt: string;
}): WalmartVisionFieldValue | null {
  const minRank = CONFIDENCE_RANK[input.minConfidence];
  const ranked = input.entries
    .map((entry) => ({
      entry,
      value: input.extractValue(entry),
      confidence: input.extractConfidence(entry),
    }))
    .filter(({ value, confidence }) => {
      if (CONFIDENCE_RANK[confidence] < minRank) return false;
      if (Array.isArray(value)) return value.length > 0;
      return Boolean(asString(value));
    })
    .sort((left, right) => CONFIDENCE_RANK[right.confidence] - CONFIDENCE_RANK[left.confidence]);

  const best = ranked[0];
  if (!best) return null;

  return {
    value: best.value,
    confidence: best.confidence,
    sourceImageUrl: best.entry.imageUrl,
    imageRole: best.entry.imageRole,
    extractedAt: input.extractedAt,
  };
}

function buildFieldProvenance(
  entries: WalmartVisionImageResult[],
  extractedAt: string
): WalmartVisionExtractionResult["fieldProvenance"] {
  const fieldProvenance: WalmartVisionExtractionResult["fieldProvenance"] = {};

  const set = (
    key: keyof WalmartVisionExtractionResult["fieldProvenance"],
    value: WalmartVisionFieldValue | null
  ) => {
    if (!value) return;
    fieldProvenance[key] = value;
  };

  set(
    "brand",
    pickBestFieldValue({
      entries,
      field: "brand",
      extractValue: (entry) => entry.extracted.brand,
      extractConfidence: (entry) => entry.confidence.brand,
      minConfidence: "medium",
      extractedAt,
    })
  );
  set(
    "productName",
    pickBestFieldValue({
      entries,
      field: "productName",
      extractValue: (entry) => entry.extracted.productName,
      extractConfidence: (entry) => entry.confidence.productName,
      minConfidence: "medium",
      extractedAt,
    })
  );
  set(
    "form",
    pickBestFieldValue({
      entries,
      field: "form",
      extractValue: (entry) => entry.extracted.form,
      extractConfidence: (entry) => entry.confidence.form,
      minConfidence: "medium",
      extractedAt,
    })
  );
  set(
    "flavor",
    pickBestFieldValue({
      entries,
      field: "flavor",
      extractValue: (entry) => entry.extracted.flavor,
      extractConfidence: (entry) => entry.confidence.flavor,
      minConfidence: "medium",
      extractedAt,
    })
  );
  set(
    "servingSize",
    pickBestFieldValue({
      entries,
      field: "servingSize",
      extractValue: (entry) => entry.extracted.servingSize,
      extractConfidence: (entry) => entry.confidence.servingSize,
      minConfidence: "medium",
      extractedAt,
    })
  );
  set(
    "servingsPerContainer",
    pickBestFieldValue({
      entries,
      field: "servingsPerContainer",
      extractValue: (entry) => entry.extracted.servingsPerContainer,
      extractConfidence: (entry) => entry.confidence.servingsPerContainer,
      minConfidence: "medium",
      extractedAt,
    })
  );
  set(
    "count",
    pickBestFieldValue({
      entries,
      field: "count",
      extractValue: (entry) => entry.extracted.count,
      extractConfidence: (entry) => entry.confidence.count,
      minConfidence: "medium",
      extractedAt,
    })
  );
  set(
    "dosageStrength",
    pickBestFieldValue({
      entries,
      field: "dosageStrength",
      extractValue: (entry) => entry.extracted.dosageStrength,
      extractConfidence: (entry) => entry.confidence.dosageStrength,
      minConfidence: "high",
      extractedAt,
    })
  );
  set(
    "mainIngredients",
    pickBestFieldValue({
      entries,
      field: "mainIngredients",
      extractValue: (entry) => entry.extracted.mainIngredients,
      extractConfidence: (entry) => entry.confidence.mainIngredients,
      minConfidence: "high",
      extractedAt,
    })
  );
  set(
    "ingredientsList",
    pickBestFieldValue({
      entries,
      field: "ingredientsList",
      extractValue: (entry) => entry.extracted.ingredientsList,
      extractConfidence: (entry) => entry.confidence.ingredientsList,
      minConfidence: "high",
      extractedAt,
    })
  );
  set(
    "suggestedUse",
    pickBestFieldValue({
      entries,
      field: "suggestedUse",
      extractValue: (entry) => entry.extracted.suggestedUse,
      extractConfidence: (entry) => entry.confidence.suggestedUse,
      minConfidence: "medium",
      extractedAt,
    })
  );
  set(
    "warnings",
    pickBestFieldValue({
      entries,
      field: "warnings",
      extractValue: (entry) => entry.extracted.warnings,
      extractConfidence: (entry) => entry.confidence.warnings,
      minConfidence: "medium",
      extractedAt,
    })
  );
  set(
    "supportAreas",
    pickBestFieldValue({
      entries,
      field: "supportAreas",
      extractValue: (entry) => entry.extracted.supportAreas,
      extractConfidence: (entry) => entry.confidence.supportAreas,
      minConfidence: "medium",
      extractedAt,
    })
  );

  return fieldProvenance;
}

export function collectProductImageUrls(product: WalmartProductRecord): string[] {
  return normalizeWalmartImageUrlList([
    product.imageUrl,
    product.primaryImageUrl,
    product.galleryImageUrls ?? [],
    product.variantImageUrls ?? [],
  ]).slice(0, 6);
}

export async function extractWalmartVisionFactsFromProduct(input: {
  product: WalmartProductRecord;
  openAiApiKey?: string | null;
}): Promise<WalmartVisionExtractionResult> {
  const extractedAt = new Date().toISOString();
  const imageUrls = collectProductImageUrls(input.product);

  if (imageUrls.length === 0) {
    return {
      status: "unavailable",
      message: "No product images are available for label extraction.",
      extractedAt,
      imageCount: 0,
      images: [],
      fieldProvenance: {},
    };
  }

  if (!input.openAiApiKey?.trim()) {
    return {
      status: "unavailable",
      message: "OpenAI vision extraction is unavailable until a BYO OpenAI API key is connected.",
      extractedAt,
      imageCount: imageUrls.length,
      images: imageUrls.map((url) => emptyImageResult(url)),
      fieldProvenance: {},
    };
  }

  const imageResults: WalmartVisionImageResult[] = [];
  for (const imageUrl of imageUrls.slice(0, 4)) {
    try {
      const extracted = await extractFromSingleImage({
        openAiApiKey: input.openAiApiKey,
        imageUrl,
        sku: input.product.sku,
        title: input.product.title,
        brand: input.product.brand,
        extractedAt,
      });
      imageResults.push(extracted);
    } catch {
      imageResults.push(emptyImageResult(imageUrl));
    }
  }

  const fieldProvenance = buildFieldProvenance(imageResults, extractedAt);
  const groundedFields = Object.values(fieldProvenance).filter(
    (entry) => CONFIDENCE_RANK[entry.confidence] >= CONFIDENCE_RANK.medium
  );

  if (groundedFields.length === 0) {
    return {
      status: "low_confidence",
      message:
        "Vision extraction ran, but no medium/high-confidence label facts were readable.",
      extractedAt,
      imageCount: imageResults.length,
      images: imageResults,
      fieldProvenance,
    };
  }

  return {
    status: "extracted",
    message: "Label facts were extracted from product images.",
    extractedAt,
    imageCount: imageResults.length,
    images: imageResults,
    fieldProvenance,
  };
}

function readProvenanceString(
  provenance: WalmartVisionExtractionResult["fieldProvenance"],
  key: keyof WalmartVisionExtractionResult["fieldProvenance"]
): string {
  const row = provenance[key];
  if (!row || Array.isArray(row.value)) return "";
  return asString(row.value);
}

function readProvenanceList(
  provenance: WalmartVisionExtractionResult["fieldProvenance"],
  key: keyof WalmartVisionExtractionResult["fieldProvenance"]
): string[] {
  const row = provenance[key];
  if (!row) return [];
  if (Array.isArray(row.value)) return asStringList(row.value);
  return asStringList(row.value);
}

export function buildVisionExtractionFactPayload(
  result: WalmartVisionExtractionResult
): Record<string, unknown> {
  const provenance = result.fieldProvenance;
  const payload: Record<string, unknown> = {
    status: result.status,
    message: result.message,
    extractedAt: result.extractedAt,
    images: result.images,
    fieldProvenance: result.fieldProvenance,
    brand: readProvenanceString(provenance, "brand"),
    productName: readProvenanceString(provenance, "productName"),
    form: readProvenanceString(provenance, "form"),
    flavor: readProvenanceString(provenance, "flavor"),
    servingSize: readProvenanceString(provenance, "servingSize"),
    servingsPerContainer: readProvenanceString(provenance, "servingsPerContainer"),
    count: readProvenanceString(provenance, "count"),
    dosageStrength: readProvenanceString(provenance, "dosageStrength"),
    mainIngredients: readProvenanceList(provenance, "mainIngredients"),
    ingredientsList: readProvenanceString(provenance, "ingredientsList"),
    suggestedUse: readProvenanceString(provenance, "suggestedUse"),
    warnings: readProvenanceString(provenance, "warnings"),
    supportAreas: readProvenanceList(provenance, "supportAreas"),
  };

  const brandSource = provenance.brand;
  payload.manufacturer_source = "vision_extraction";
  payload.manufacturer_confidence = brandSource?.confidence ?? "none";
  payload.manufacturer_needs_review = true;

  return payload;
}

export function deriveSearchBrowseFromVisionExtraction(
  result: WalmartVisionExtractionResult
): Record<string, string> {
  const provenance = result.fieldProvenance;
  const mapped: Record<string, string> = {};

  const set = (key: string, value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    mapped[key] = trimmed;
  };

  set("brand", readProvenanceString(provenance, "brand"));
  set("product_name", readProvenanceString(provenance, "productName"));
  set("product_form", readProvenanceString(provenance, "form"));
  set("form", readProvenanceString(provenance, "form"));
  set("flavor", readProvenanceString(provenance, "flavor"));
  set("serving_size", readProvenanceString(provenance, "servingSize"));
  set(
    "servings_per_container",
    readProvenanceString(provenance, "servingsPerContainer")
  );
  set("servings", readProvenanceString(provenance, "servingsPerContainer"));
  set("count", readProvenanceString(provenance, "count"));
  set("dosage_strength", readProvenanceString(provenance, "dosageStrength"));

  const mainIngredients = readProvenanceList(provenance, "mainIngredients");
  if (mainIngredients.length > 0) {
    set("main_ingredients", mainIngredients.join(", "));
  }

  const ingredientsList = readProvenanceString(provenance, "ingredientsList");
  if (ingredientsList) {
    set("ingredients_list", ingredientsList);
  } else if (mainIngredients.length > 0) {
    set("ingredients_list", mainIngredients.join(", "));
  }

  set("suggested_use", readProvenanceString(provenance, "suggestedUse"));
  set("directions_suggested_use", readProvenanceString(provenance, "suggestedUse"));
  set("safety_warnings", readProvenanceString(provenance, "warnings"));

  const supportAreas = readProvenanceList(provenance, "supportAreas");
  if (supportAreas.length > 0) {
    set("support_areas", supportAreas.join(", "));
  }

  return mapped;
}
