import "server-only";

import {
  extractCanonicalProductFacts,
  type CanonicalProductFacts,
} from "@/lib/ecomviper/walmart/product-facts-agent";
import type {
  WalmartGeneratedImageType,
  WalmartProductRecord,
} from "@/lib/ecomviper/walmart/walmart-types";

const OPENAI_IMAGE_MODEL = process.env.WALMART_OPENAI_IMAGE_MODEL?.trim() || "gpt-image-1";

export class WalmartImageGenerationError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

function asText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  return "";
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((entry) => entry.trim()).filter(Boolean)));
}

function toFactsLines(facts: CanonicalProductFacts): string[] {
  const supplementFacts = Object.entries(facts.supplementFacts)
    .map(([key, value]) => `${key}: ${value}`)
    .slice(0, 20);

  return unique([
    facts.brand ? `Brand: ${facts.brand}` : "",
    facts.productName ? `Product Name: ${facts.productName}` : "",
    facts.series ? `Series: ${facts.series}` : "",
    facts.form ? `Form: ${facts.form}` : "",
    facts.count ? `Count: ${facts.count}` : "",
    facts.supply ? `Supply: ${facts.supply}` : "",
    facts.flavor ? `Flavor: ${facts.flavor}` : "",
    facts.servingSize ? `Serving Size: ${facts.servingSize}` : "",
    facts.servingsPerContainer
      ? `Servings Per Container: ${facts.servingsPerContainer}`
      : "",
    facts.targetAudience ? `Target Audience: ${facts.targetAudience}` : "",
    facts.suggestedUse ? `Suggested Use: ${facts.suggestedUse}` : "",
    facts.warnings ? `Warnings: ${facts.warnings}` : "",
    facts.storage ? `Storage: ${facts.storage}` : "",
    facts.activeIngredients.length > 0
      ? `Active Ingredients: ${facts.activeIngredients.slice(0, 8).join(", ")}`
      : "",
    facts.otherIngredients.length > 0
      ? `Other Ingredients: ${facts.otherIngredients.slice(0, 12).join(", ")}`
      : "",
    ...supplementFacts,
  ]);
}

function toProductContextLines(product: WalmartProductRecord): string[] {
  const bulletPoints = (product.bulletPoints ?? [])
    .map((entry) => entry.trim())
    .filter(Boolean)
    .slice(0, 8);
  const searchBrowse = Object.entries(product.searchBrowseAttributes ?? {})
    .map(([key, value]) => `${key}: ${value}`)
    .slice(0, 16);
  const attributes = Object.entries(product.attributes ?? {})
    .map(([key, value]) => `${key}: ${value}`)
    .slice(0, 16);
  const galleryUrls = unique([
    product.imageUrl,
    ...(product.galleryImageUrls ?? []),
    ...(product.variantImageUrls ?? []),
  ]).slice(0, 8);

  return unique([
    `SKU: ${product.sku}`,
    product.title ? `Title: ${product.title}` : "",
    product.brand ? `Brand: ${product.brand}` : "",
    product.category ? `Category: ${product.category}` : "",
    product.shortDescription ? `Short Description: ${product.shortDescription}` : "",
    product.longDescription ? `Long Description: ${product.longDescription}` : "",
    bulletPoints.length > 0 ? `Bullet Points: ${bulletPoints.join(" | ")}` : "",
    attributes.length > 0 ? `Attributes: ${attributes.join(" ; ")}` : "",
    searchBrowse.length > 0 ? `Search & Browse: ${searchBrowse.join(" ; ")}` : "",
    galleryUrls.length > 0 ? `Reference Image URLs: ${galleryUrls.join(" | ")}` : "",
  ]);
}

function imageTypeLabel(imageType: WalmartGeneratedImageType): string {
  if (imageType === "lifestyle") return "Lifestyle";
  if (imageType === "supplement_facts") return "Supplement Facts";
  if (imageType === "ingredient_spotlight") return "Ingredient Spotlight";
  return "Product Hero";
}

function ensureSupplementFactsInput(
  imageType: WalmartGeneratedImageType,
  facts: CanonicalProductFacts
): void {
  if (imageType !== "supplement_facts") return;
  const hasFacts =
    Object.keys(facts.supplementFacts).length > 0 ||
    facts.activeIngredients.length > 0 ||
    facts.servingSize.trim().length > 0;
  if (!hasFacts) {
    throw new WalmartImageGenerationError(
      "INSUFFICIENT_SUPPLEMENT_FACTS",
      "Supplement facts generation needs serving size and/or ingredient facts. Add product facts, then try again."
    );
  }
}

function imageTypeDirections(imageType: WalmartGeneratedImageType): string {
  if (imageType === "lifestyle") {
    return "Create a photorealistic lifestyle scene featuring the product package naturally placed in a believable environment that matches intended use. Avoid medical claims text overlays.";
  }
  if (imageType === "supplement_facts") {
    return "Create a clean, high-legibility supplement-facts-style informational graphic using only provided factual data. White or light neutral background, crisp typography, no invented nutrition values.";
  }
  if (imageType === "ingredient_spotlight") {
    return "Create a product ingredient spotlight graphic highlighting key ingredients and compliant structure/function support language only. Keep it premium, clean, and marketplace-safe.";
  }
  return "Create a clean studio hero image of the product package on a neutral background with high clarity and retail-ready composition.";
}

function buildComplianceGuardrails(): string {
  return [
    "Compliance guardrails:",
    "- Do not include disease/treatment/cure/prevention claims.",
    "- Do not include drug comparison language.",
    "- Avoid risky terms: ED, erectile dysfunction, hypertension, anxiety, insomnia, depression, cure, treat, prevent, reverse, natural viagra, works like cialis.",
    "- Use structure/function framing only if text is included, such as supports relaxation, sleep quality support, daily wellness support.",
    "- Do not invent unsupported ingredient or supplement fact values.",
  ].join("\n");
}

export function buildWalmartGeneratedImagePrompt(input: {
  product: WalmartProductRecord;
  facts: CanonicalProductFacts;
  imageType: WalmartGeneratedImageType;
  styleGuidance?: string;
}): { prompt: string; promptSummary: string } {
  const productLines = toProductContextLines(input.product);
  const factsLines = toFactsLines(input.facts);
  const normalizedGuidance = asText(input.styleGuidance);
  const summary = `${imageTypeLabel(input.imageType)} image for ${input.product.sku}`;

  const prompt = [
    `Task: Generate one ${imageTypeLabel(input.imageType)} image for a Walmart listing.`,
    imageTypeDirections(input.imageType),
    buildComplianceGuardrails(),
    "Keep brand/product identity consistent with provided context.",
    normalizedGuidance ? `User style guidance: ${normalizedGuidance}` : "",
    "Product context:",
    ...productLines.map((line) => `- ${line}`),
    "Canonical product facts:",
    ...factsLines.map((line) => `- ${line}`),
    "Output requirements:",
    "- 1:1 square composition, 1024x1024 target.",
    "- No logos or trademarks that are not part of the described product identity.",
    "- No misleading before/after medical implication imagery.",
    "- No watermark.",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    prompt,
    promptSummary: summary,
  };
}

function parseOpenAiImageData(payload: unknown): { b64?: string; url?: string } {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {};
  }
  const root = payload as Record<string, unknown>;
  const data = Array.isArray(root.data) ? root.data : [];
  const first = data[0];
  if (!first || typeof first !== "object" || Array.isArray(first)) {
    return {};
  }
  const node = first as Record<string, unknown>;
  const b64 = asText(node.b64_json);
  const url = asText(node.url);
  return {
    b64: b64 || undefined,
    url: url || undefined,
  };
}

async function downloadImage(url: string): Promise<{ imageBytes: Uint8Array; mimeType: string }> {
  const response = await fetch(url, { method: "GET", cache: "no-store" });
  if (!response.ok) {
    throw new WalmartImageGenerationError(
      "OPENAI_IMAGE_DOWNLOAD_FAILED",
      `Generated image download failed: HTTP ${response.status}.`
    );
  }

  const contentType = asText(response.headers.get("content-type")) || "image/png";
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length === 0) {
    throw new WalmartImageGenerationError(
      "OPENAI_IMAGE_EMPTY",
      "Generated image is empty. Regenerate and try again."
    );
  }

  return { imageBytes: bytes, mimeType: contentType };
}

export async function generateWalmartProductImage(input: {
  openAiApiKey: string;
  product: WalmartProductRecord;
  imageType: WalmartGeneratedImageType;
  styleGuidance?: string;
}): Promise<{
  imageBytes: Uint8Array;
  mimeType: string;
  imageType: WalmartGeneratedImageType;
  promptSummary: string;
}> {
  const factsResult = extractCanonicalProductFacts({ product: input.product });
  ensureSupplementFactsInput(input.imageType, factsResult.facts);

  const promptPayload = buildWalmartGeneratedImagePrompt({
    product: input.product,
    facts: factsResult.facts,
    imageType: input.imageType,
    styleGuidance: input.styleGuidance,
  });

  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.openAiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_IMAGE_MODEL,
      prompt: promptPayload.prompt,
      size: "1024x1024",
      n: 1,
      response_format: "b64_json",
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new WalmartImageGenerationError(
        "OPENAI_UNAUTHORIZED",
        "OpenAI image generation failed: HTTP 401 unauthorized. Verify your OpenAI API key."
      );
    }
    if (response.status === 403) {
      throw new WalmartImageGenerationError(
        "OPENAI_FORBIDDEN",
        "OpenAI image generation failed: HTTP 403 forbidden. Check OpenAI project permissions."
      );
    }
    throw new WalmartImageGenerationError(
      "OPENAI_IMAGE_FAILED",
      `OpenAI image generation failed: HTTP ${response.status}.`
    );
  }

  const payload = (await response.json().catch(() => ({}))) as unknown;
  const parsed = parseOpenAiImageData(payload);

  if (parsed.b64) {
    const bytes = Buffer.from(parsed.b64, "base64");
    if (bytes.length === 0) {
      throw new WalmartImageGenerationError(
        "OPENAI_IMAGE_EMPTY",
        "Generated image is empty. Regenerate and try again."
      );
    }

    return {
      imageBytes: bytes,
      mimeType: "image/png",
      imageType: input.imageType,
      promptSummary: promptPayload.promptSummary,
    };
  }

  if (parsed.url) {
    const downloaded = await downloadImage(parsed.url);
    return {
      ...downloaded,
      imageType: input.imageType,
      promptSummary: promptPayload.promptSummary,
    };
  }

  throw new WalmartImageGenerationError(
    "OPENAI_IMAGE_INVALID_RESPONSE",
    "OpenAI image generation returned no image data."
  );
}
