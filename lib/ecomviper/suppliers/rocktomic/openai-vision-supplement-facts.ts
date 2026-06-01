import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { SupplierFactProvenance } from "@/lib/ecomviper/suppliers/rocktomic/supplier-intelligence-schema";
import {
  isStructuredSupplementFactsValid,
  type SupplementFactsExtractionResult,
} from "@/lib/ecomviper/suppliers/rocktomic/supplement-facts-panel";

const SCHEMA_VERSION = "v1";
const DEFAULT_MODEL = "gpt-4.1-mini";
const DEFAULT_TIMEOUT_MS = 12_000;

interface OpenAiVisionPayload {
  servingSize: string | null;
  servingsPerContainer: number | null;
  nutrientFacts: Array<{ name: string; amount: number | null; unit: string | null; dailyValue: string | null; rawText: string }>;
  activeIngredients: Array<{ name: string; amount: number | null; unit: string | null; standardization: string | null; rawText: string }>;
  otherIngredients: string[];
  confidence: number;
  needsReview: boolean;
  missingFields: string[];
  warnings: string[];
}

export interface OpenAiVisionExtractionResult {
  status: "skipped" | "success" | "needs_review" | "failed";
  reason: string;
  extraction: SupplementFactsExtractionResult | null;
}

function visionEnabled(): boolean {
  return process.env.ECOMVIPER_SUPPLIER_OPENAI_VISION_ENABLED === "1";
}

function visionModel(): string {
  return process.env.ECOMVIPER_SUPPLIER_OPENAI_VISION_MODEL?.trim() || DEFAULT_MODEL;
}

function visionTimeoutMs(): number {
  const raw = Number.parseInt(process.env.ECOMVIPER_SUPPLIER_OPENAI_VISION_TIMEOUT_MS || `${DEFAULT_TIMEOUT_MS}`, 10);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_TIMEOUT_MS;
}

function visionCacheDir(): string {
  return process.env.ECOMVIPER_SUPPLIER_VISION_CACHE_DIR?.trim()
    || path.join(process.cwd(), ".cache/ecomviper/suppliers/rocktomic/vision");
}

async function fileHash(filePath: string): Promise<string> {
  const buffer = await fs.readFile(filePath);
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

export function createVisionCacheKey(input: {
  imageHash: string;
  model: string;
  schemaVersion: string;
}): string {
  return crypto
    .createHash("sha256")
    .update(`${input.imageHash}:${input.model}:${input.schemaVersion}`)
    .digest("hex");
}

function schema(): Record<string, unknown> {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      servingSize: { type: ["string", "null"] },
      servingsPerContainer: { type: ["number", "null"] },
      nutrientFacts: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            name: { type: "string" },
            amount: { type: ["number", "null"] },
            unit: { type: ["string", "null"] },
            dailyValue: { type: ["string", "null"] },
            rawText: { type: "string" },
          },
          required: ["name", "amount", "unit", "dailyValue", "rawText"],
        },
      },
      activeIngredients: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            name: { type: "string" },
            amount: { type: ["number", "null"] },
            unit: { type: ["string", "null"] },
            standardization: { type: ["string", "null"] },
            rawText: { type: "string" },
          },
          required: ["name", "amount", "unit", "standardization", "rawText"],
        },
      },
      otherIngredients: { type: "array", items: { type: "string" } },
      confidence: { type: "number" },
      needsReview: { type: "boolean" },
      missingFields: { type: "array", items: { type: "string" } },
      warnings: { type: "array", items: { type: "string" } },
    },
    required: [
      "servingSize",
      "servingsPerContainer",
      "nutrientFacts",
      "activeIngredients",
      "otherIngredients",
      "confidence",
      "needsReview",
      "missingFields",
      "warnings",
    ],
  };
}

async function callVisionModel(input: {
  imagePath: string;
  model: string;
  timeoutMs: number;
}): Promise<OpenAiVisionPayload> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required when OpenAI vision fallback is enabled.");
  }

  const image = await fs.readFile(input.imagePath);
  const imageBase64 = image.toString("base64");
  const prompt = [
    "Extract only visible Supplement Facts from this product page/panel image.",
    "Do not infer from product name.",
    "Do not invent ingredients, amounts, serving size, or daily values.",
    "If unreadable, return missing/needsReview.",
    "Return strict JSON only.",
  ].join(" ");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs);
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: input.model,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "rocktomic_supplement_facts_panel",
            schema: schema(),
            strict: true,
          },
        },
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: `data:image/png;base64,${imageBase64}` } },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`openai_vision_http_${response.status}`);
    }

    const payload = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content || "{}";
    return JSON.parse(content) as OpenAiVisionPayload;
  } finally {
    clearTimeout(timeout);
  }
}

export async function extractSupplementFactsViaOpenAiVision(input: {
  enabledByCli: boolean;
  imagePath: string | null;
  sku: string;
  productName: string | null;
  provenance: SupplierFactProvenance[];
}): Promise<OpenAiVisionExtractionResult> {
  if (!input.enabledByCli) {
    return { status: "skipped", reason: "cli_flag_disabled", extraction: null };
  }
  if (!visionEnabled()) {
    return { status: "skipped", reason: "env_disabled", extraction: null };
  }
  if (!input.imagePath) {
    return { status: "failed", reason: "missing_image_path", extraction: null };
  }

  const model = visionModel();
  const timeoutMs = visionTimeoutMs();
  const cacheDir = visionCacheDir();
  const imageHash = await fileHash(input.imagePath);
  const cacheKey = createVisionCacheKey({
    imageHash,
    model,
    schemaVersion: SCHEMA_VERSION,
  });
  const cachePath = path.join(cacheDir, `${cacheKey}.json`);

  let parsed: OpenAiVisionPayload;
  try {
    await fs.mkdir(cacheDir, { recursive: true });
    try {
      const cached = await fs.readFile(cachePath, "utf8");
      parsed = JSON.parse(cached) as OpenAiVisionPayload;
    } catch {
      parsed = await callVisionModel({
        imagePath: input.imagePath,
        model,
        timeoutMs,
      });
      await fs.writeFile(cachePath, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
    }
  } catch (error) {
    return {
      status: "failed",
      reason: error instanceof Error ? error.message : "openai_vision_failed",
      extraction: null,
    };
  }

  const extraction: SupplementFactsExtractionResult = {
    servingSize: parsed.servingSize,
    servingsPerContainer: parsed.servingsPerContainer,
    nutrientFacts: parsed.nutrientFacts.map((entry) => ({
      ...entry,
      confidence: parsed.confidence,
      provenance: input.provenance,
    })),
    activeIngredients: parsed.activeIngredients.map((entry) => ({
      ...entry,
      confidence: parsed.confidence,
      provenance: input.provenance,
    })),
    otherIngredients: parsed.otherIngredients || [],
    warnings: parsed.warnings || [],
    rawEvidence: "openai_vision_structured",
    extractionMethod: "openai_vision",
    confidence: parsed.confidence,
    needsReview: Boolean(parsed.needsReview),
    missingFields: parsed.missingFields || [],
  };

  const validity = isStructuredSupplementFactsValid({
    sku: input.sku,
    productName: input.productName,
    servingSize: extraction.servingSize,
    servingsPerContainer: extraction.servingsPerContainer,
    nutrientFacts: extraction.nutrientFacts,
    activeIngredients: extraction.activeIngredients,
  });

  if (!validity.valid || extraction.needsReview || extraction.confidence < 0.8) {
    return {
      status: "needs_review",
      reason: validity.valid ? "low_confidence" : `schema_invalid:${validity.errors.join("|")}`,
      extraction,
    };
  }

  return {
    status: "success",
    reason: "ok",
    extraction,
  };
}

