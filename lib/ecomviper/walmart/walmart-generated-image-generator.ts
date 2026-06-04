import "server-only";

import {
  extractCanonicalProductFacts,
  type CanonicalProductFacts,
} from "@/lib/ecomviper/walmart/product-facts-agent";
import type {
  WalmartGeneratedImageType,
  WalmartGeneratedImageReferenceInput,
  WalmartProductRecord,
} from "@/lib/ecomviper/walmart/walmart-types";

const OPENAI_IMAGE_MODEL = process.env.WALMART_OPENAI_IMAGE_MODEL?.trim() || "gpt-image-1";
const OPENAI_IMAGE_SIZE = "1024x1024";
const OPENAI_IMAGE_SQUARE_EDGE = 1024;
const OPENAI_IMAGE_PROMPT_MAX_CHARS = 3500;
const MAX_REFERENCE_IMAGES = 4;
const MAX_REFERENCE_BYTES = 8 * 1024 * 1024;
const SUPPORTED_REFERENCE_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
]);

export type WalmartImageGenerationMode =
  | "text_to_image"
  | "reference_image_edit"
  | "reference_fallback_text_to_image";
export type WalmartSupplementFactsLayoutMode = "standard" | "reference_layout";
export type WalmartSupplementFactsProductFactsSource =
  | "product_data"
  | "reference"
  | "fallback";

interface WalmartImageGenerationErrorOptions {
  code: string;
  message: string;
  statusCode?: number;
  category?: string;
  recommendation?: string;
  providerErrorType?: string;
  providerErrorParam?: string;
  promptLength?: number;
  requestModel?: string;
  requestSize?: string;
  generationMode?: WalmartImageGenerationMode;
  routePhase?: string;
  referenceMimeTypes?: string[];
  referenceByteSizes?: number[];
  referenceCount?: number;
  layoutMode?: WalmartSupplementFactsLayoutMode;
  userGuidanceIncluded?: boolean;
  layoutPreservationInstruction?: boolean;
  productFactsSource?: WalmartSupplementFactsProductFactsSource;
}

export class WalmartImageGenerationError extends Error {
  readonly code: string;
  readonly statusCode?: number;
  readonly category?: string;
  readonly recommendation?: string;
  readonly providerErrorType?: string;
  readonly providerErrorParam?: string;
  readonly promptLength?: number;
  readonly requestModel?: string;
  readonly requestSize?: string;
  readonly generationMode?: WalmartImageGenerationMode;
  readonly routePhase?: string;
  readonly referenceMimeTypes?: string[];
  readonly referenceByteSizes?: number[];
  readonly referenceCount?: number;
  readonly layoutMode?: WalmartSupplementFactsLayoutMode;
  readonly userGuidanceIncluded?: boolean;
  readonly layoutPreservationInstruction?: boolean;
  readonly productFactsSource?: WalmartSupplementFactsProductFactsSource;

  constructor(options: WalmartImageGenerationErrorOptions) {
    super(options.message);
    this.code = options.code;
    this.statusCode = options.statusCode;
    this.category = options.category;
    this.recommendation = options.recommendation;
    this.providerErrorType = options.providerErrorType;
    this.providerErrorParam = options.providerErrorParam;
    this.promptLength = options.promptLength;
    this.requestModel = options.requestModel;
    this.requestSize = options.requestSize;
    this.generationMode = options.generationMode;
    this.routePhase = options.routePhase;
    this.referenceMimeTypes = options.referenceMimeTypes;
    this.referenceByteSizes = options.referenceByteSizes;
    this.referenceCount = options.referenceCount;
    this.layoutMode = options.layoutMode;
    this.userGuidanceIncluded = options.userGuidanceIncluded;
    this.layoutPreservationInstruction = options.layoutPreservationInstruction;
    this.productFactsSource = options.productFactsSource;
  }
}

interface PreparedReferenceImage {
  source: WalmartGeneratedImageReferenceInput["source"];
  url: string;
  label?: string;
  mimeType?: string;
  byteSize?: number;
}

interface LoadedReferenceImage {
  source: WalmartGeneratedImageReferenceInput["source"];
  url: string;
  label?: string;
  mimeType: string;
  imageBytes: Uint8Array;
  byteSize: number;
}

function asText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  return "";
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((entry) => entry.trim()).filter(Boolean)));
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function redactPotentialSecrets(value: string): string {
  return value.replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, "[redacted]");
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 1))}…`;
}

function normalizeMimeType(value: string): string {
  const normalized = value.trim().toLowerCase().split(";")[0] || "";
  if (normalized === "image/jpg") return "image/jpeg";
  return normalized;
}

function toHttpsUrl(value: string): string {
  const raw = value.trim();
  if (!raw) return "";
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
    parsed.protocol = "https:";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return "";
  }
}

function isDataImageUrl(value: string): boolean {
  return /^data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=\s]+$/.test(value.trim());
}

function parseDataImageUrl(value: string): {
  ok: true;
  mimeType: string;
  imageBytes: Uint8Array;
} | {
  ok: false;
  reason: "invalid_format" | "unsupported_mime" | "empty" | "too_large";
  mimeType?: string;
  byteSize?: number;
} {
  const trimmed = value.trim();
  const match = trimmed.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/);
  if (!match) {
    return { ok: false, reason: "invalid_format" };
  }
  const mimeType = normalizeMimeType(match[1]);
  if (!SUPPORTED_REFERENCE_MIME_TYPES.has(mimeType)) {
    return { ok: false, reason: "unsupported_mime", mimeType };
  }
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length === 0) {
    return { ok: false, reason: "empty", mimeType, byteSize: bytes.length };
  }
  if (bytes.length > MAX_REFERENCE_BYTES) {
    return { ok: false, reason: "too_large", mimeType, byteSize: bytes.length };
  }
  return {
    ok: true,
    mimeType,
    imageBytes: new Uint8Array(bytes),
  };
}

function inferReferenceLabel(url: string): string {
  const lower = url.toLowerCase();
  if (
    lower.includes("supplement") ||
    lower.includes("facts") ||
    lower.includes("nutrition") ||
    lower.includes("label") ||
    lower.includes("back") ||
    lower.includes("panel")
  ) {
    return "supplement_facts_label";
  }
  return "product_media";
}

function normalizeReferenceImageCandidates(
  references: WalmartGeneratedImageReferenceInput[] | undefined
): PreparedReferenceImage[] {
  if (!Array.isArray(references) || references.length === 0) return [];

  const seen = new Set<string>();
  const normalized: PreparedReferenceImage[] = [];
  for (const row of references) {
    if (!row || typeof row !== "object") continue;
    const source = row.source === "uploaded" || row.source === "product_media" ? row.source : "uploaded";
    const rawUrl = asText(row.url);
    const normalizedUrl = rawUrl.trim().toLowerCase().startsWith("data:image/")
      ? rawUrl.trim()
      : toHttpsUrl(rawUrl);
    if (!normalizedUrl || seen.has(normalizedUrl)) continue;
    seen.add(normalizedUrl);
    normalized.push({
      source,
      url: normalizedUrl,
      label: asText(row.label) || undefined,
      mimeType: normalizeMimeType(asText(row.mimeType)),
      byteSize:
        typeof row.byteSize === "number" && Number.isFinite(row.byteSize) && row.byteSize > 0
          ? Math.floor(row.byteSize)
          : undefined,
    });
    if (normalized.length >= MAX_REFERENCE_IMAGES) break;
  }
  return normalized;
}

function collectProductMediaReferenceCandidates(
  product: WalmartProductRecord,
  options?: { supplementFactsOnly?: boolean }
): PreparedReferenceImage[] {
  const urls = unique([
    product.primaryImageUrl ?? "",
    product.imageUrl ?? "",
    ...(product.galleryImageUrls ?? []),
    ...(product.variantImageUrls ?? []),
  ])
    .map((entry) => toHttpsUrl(entry))
    .filter(Boolean);

  if (urls.length === 0) return [];

  const scored = urls
    .map((url, index) => {
      const lower = url.toLowerCase();
      const hasSupplementFactsHint = /(supplement|facts|nutrition|label|back|panel|ingredients|serving)/.test(
        lower
      );
      let score = 0;
      if (hasSupplementFactsHint) {
        score += 10;
      }
      if (index > 0) score += 1;
      return { url, score, hasSupplementFactsHint };
    })
    .filter((row) => (options?.supplementFactsOnly ? row.hasSupplementFactsHint : true))
    .sort((left, right) => right.score - left.score || left.url.localeCompare(right.url));

  return scored.slice(0, MAX_REFERENCE_IMAGES).map((row) => ({
    source: "product_media",
    url: row.url,
    label: inferReferenceLabel(row.url),
  }));
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
  referenceImages: PreparedReferenceImage[]
): void {
  if (imageType !== "supplement_facts") return;
  if (referenceImages.length === 0) {
    throw new WalmartImageGenerationError({
      code: "SUPPLEMENT_FACTS_REFERENCE_REQUIRED",
      message:
        "Upload a bottle supplement-facts image or back-label reference to generate this image type.",
      statusCode: 400,
      category: "input_incomplete",
      recommendation:
        "Add at least one supplement-facts reference image, then regenerate.",
    });
  }
}

function imageTypeDirections(imageType: WalmartGeneratedImageType): string {
  if (imageType === "lifestyle") {
    return "Create a photorealistic 1:1 square lifestyle scene featuring the full product package naturally placed in a believable environment that matches intended use. Keep the product centered, fully visible, and not cropped. Avoid medical claims text overlays.";
  }
  if (imageType === "supplement_facts") {
    return "Create a clean 1:1 square, high-legibility supplement-facts informational graphic using only provided factual data. Center the facts panel on a clean white canvas with crisp typography and no invented nutrition values.";
  }
  if (imageType === "ingredient_spotlight") {
    return "Create a square product ingredient spotlight graphic highlighting key ingredients and compliant structure/function support language only. Keep it premium, clean, centered, and marketplace-safe.";
  }
  return "Create a square clean studio hero image of the full product package on a neutral background with high clarity, centered framing, and retail-ready composition.";
}

function hasMeaningfulSupplementFacts(facts: CanonicalProductFacts): boolean {
  if (Object.keys(facts.supplementFacts).length > 0) return true;
  if (facts.activeIngredients.length > 0) return true;
  if (facts.otherIngredients.length > 0) return true;
  if (facts.servingSize) return true;
  if (facts.servingsPerContainer) return true;
  if (facts.suggestedUse) return true;
  if (facts.warnings) return true;
  return false;
}

function resolveSupplementFactsProductFactsSource(params: {
  facts: CanonicalProductFacts;
  hasUploadedReference: boolean;
}): WalmartSupplementFactsProductFactsSource {
  if (hasMeaningfulSupplementFacts(params.facts)) return "product_data";
  return params.hasUploadedReference ? "reference" : "fallback";
}

function buildSupplementFactsReferenceLayoutInstructions(params: {
  hasUploadedReference: boolean;
}): string[] {
  if (!params.hasUploadedReference) return [];
  return [
    "Supplement Facts reference-layout instructions (high priority):",
    "- Use the uploaded reference image as the primary visual layout reference.",
    "- Preserve the composition: central supplement facts panel with circular quality badges/patches on both left and right sides when present in the reference.",
    "- Use a clean square 1:1 white marketplace-ready canvas.",
    "- Keep the central Supplement Facts panel readable.",
    "- Use current product facts where available, but do not invent unsupported supplement facts.",
    "- If exact product facts are incomplete, keep the layout and include only known facts.",
    "- Do not remove the side badges/patches if the reference includes them.",
  ];
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
  referenceImages?: PreparedReferenceImage[];
}): { prompt: string; promptSummary: string } {
  const productLines = toProductContextLines(input.product);
  const factsLines = toFactsLines(input.facts);
  const normalizedGuidance = asText(input.styleGuidance);
  const referenceImages = input.referenceImages ?? [];
  const hasUploadedReference = referenceImages.some((entry) => entry.source === "uploaded");
  const supplementFactsReferenceLayoutInstructions =
    input.imageType === "supplement_facts"
      ? buildSupplementFactsReferenceLayoutInstructions({ hasUploadedReference })
      : [];
  const referenceSummary =
    referenceImages.length > 0
      ? `Reference images provided (${referenceImages.length}): ${referenceImages
          .map((entry, index) => `#${index + 1} ${entry.label || entry.source}`)
          .join(", ")}`
      : "";
  const summary = `${imageTypeLabel(input.imageType)} image for ${input.product.sku}`;

  const promptRaw = [
    `Task: Generate one ${imageTypeLabel(input.imageType)} image for a Walmart listing.`,
    ...supplementFactsReferenceLayoutInstructions,
    normalizedGuidance
      ? input.imageType === "supplement_facts" && hasUploadedReference
        ? `User style guidance (high priority): ${normalizedGuidance}`
        : `User style guidance: ${normalizedGuidance}`
      : "",
    imageTypeDirections(input.imageType),
    buildComplianceGuardrails(),
    "Keep brand/product identity consistent with provided context.",
    referenceSummary,
    input.imageType === "supplement_facts" && referenceImages.length > 0
      ? "For Supplement Facts: follow the uploaded/reference label panel truth. Preserve legibility and do not invent values."
      : "",
    "Product context:",
    ...productLines.map((line) => `- ${line}`),
    "Canonical product facts:",
    ...factsLines.map((line) => `- ${line}`),
    "Output requirements:",
    "- 1:1 square composition, exactly 1024x1024 output.",
    "- Marketplace-ready media quality suitable for Walmart listing image workflows.",
    input.imageType === "supplement_facts"
      ? "- Supplement Facts readability is critical: center the panel, high contrast text, white background, no cropped or tilted facts panel."
      : "",
    input.imageType === "lifestyle"
      ? "- Lifestyle composition must keep the full product package centered and fully visible with no cut-off product edges."
      : "",
    "- No logos or trademarks that are not part of the described product identity.",
    "- No misleading before/after medical implication imagery.",
    "- No watermark.",
  ]
    .filter(Boolean)
    .join("\n");
  const prompt =
    promptRaw.length > OPENAI_IMAGE_PROMPT_MAX_CHARS
      ? `${promptRaw.slice(0, OPENAI_IMAGE_PROMPT_MAX_CHARS)}\n- Additional product context truncated for prompt length limits.`
      : promptRaw;

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
    throw new WalmartImageGenerationError({
      code: "OPENAI_IMAGE_DOWNLOAD_FAILED",
      message: `Generated image download failed: HTTP ${response.status}.`,
      statusCode: 502,
      category: "provider_response_invalid",
      recommendation: "Regenerate the image. If this persists, retry later.",
    });
  }

  const contentType = asText(response.headers.get("content-type")) || "image/png";
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length === 0) {
    throw new WalmartImageGenerationError({
      code: "OPENAI_IMAGE_EMPTY",
      message: "Generated image is empty. Regenerate and try again.",
      statusCode: 502,
      category: "provider_response_invalid",
      recommendation: "Regenerate the image. If this persists, retry later.",
    });
  }

  return { imageBytes: bytes, mimeType: contentType };
}

async function loadReferenceImage(reference: PreparedReferenceImage): Promise<LoadedReferenceImage> {
  const dataUrlParsed = parseDataImageUrl(reference.url);
  if (dataUrlParsed.ok) {
    return {
      source: reference.source,
      url: reference.url,
      label: reference.label,
      mimeType: dataUrlParsed.mimeType,
      imageBytes: dataUrlParsed.imageBytes,
      byteSize: dataUrlParsed.imageBytes.length,
    };
  }
  if (isDataImageUrl(reference.url)) {
    if (dataUrlParsed.reason === "too_large") {
      throw new WalmartImageGenerationError({
        code: "REFERENCE_IMAGE_TOO_LARGE",
        message: "Reference image is too large for generation.",
        statusCode: 400,
        category: "invalid_request",
        recommendation:
          "Use a smaller PNG/JPEG reference image (under 8MB) and retry.",
      });
    }
    if (dataUrlParsed.reason === "unsupported_mime") {
      throw new WalmartImageGenerationError({
        code: "REFERENCE_IMAGE_UNSUPPORTED_TYPE",
        message: "Reference image type is not supported for image generation.",
        statusCode: 400,
        category: "invalid_request",
        recommendation: "Use PNG or JPEG reference images and retry.",
      });
    }
    throw new WalmartImageGenerationError({
      code: "INVALID_REFERENCE_IMAGE",
      message: "Reference image data is invalid. Re-upload and try again.",
      statusCode: 400,
      category: "invalid_request",
      recommendation: "Upload a valid PNG/JPEG image and retry.",
    });
  }

  const httpsUrl = toHttpsUrl(reference.url);
  if (!httpsUrl) {
    throw new WalmartImageGenerationError({
      code: "INVALID_REFERENCE_IMAGE",
      message: "Reference image URL is invalid. Use uploaded images or valid https image URLs.",
      statusCode: 400,
      category: "invalid_request",
      recommendation: "Upload a valid image file and retry.",
    });
  }

  const response = await fetch(httpsUrl, { method: "GET", cache: "no-store" });
  if (!response.ok) {
    throw new WalmartImageGenerationError({
      code: "REFERENCE_IMAGE_DOWNLOAD_FAILED",
      message: `Reference image download failed: HTTP ${response.status}.`,
      statusCode: 400,
      category: "input_incomplete",
      recommendation:
        "Upload the supplement-facts label image directly in Media tab and retry.",
    });
  }
  const downloaded = {
    imageBytes: new Uint8Array(await response.arrayBuffer()),
    mimeType: normalizeMimeType(asText(response.headers.get("content-type")) || "image/png"),
  };
  if (downloaded.imageBytes.length === 0) {
    throw new WalmartImageGenerationError({
      code: "REFERENCE_IMAGE_EMPTY",
      message: "Reference image is empty and cannot be used for generation.",
      statusCode: 400,
      category: "input_incomplete",
      recommendation: "Upload a non-empty supplement-facts reference image and retry.",
    });
  }
  if (downloaded.imageBytes.length > MAX_REFERENCE_BYTES) {
    throw new WalmartImageGenerationError({
      code: "REFERENCE_IMAGE_TOO_LARGE",
      message: "Reference image is too large for generation.",
      statusCode: 400,
      category: "invalid_request",
      recommendation: "Use a smaller reference image (under 8MB).",
    });
  }
  if (!SUPPORTED_REFERENCE_MIME_TYPES.has(downloaded.mimeType)) {
    throw new WalmartImageGenerationError({
      code: "REFERENCE_IMAGE_UNSUPPORTED_TYPE",
      message: "Reference image type is not supported for generation.",
      statusCode: 400,
      category: "invalid_request",
      recommendation: "Use PNG or JPEG reference images and retry.",
    });
  }

  return {
    source: reference.source,
    url: httpsUrl,
    label: reference.label,
    mimeType: downloaded.mimeType || "image/png",
    imageBytes: downloaded.imageBytes,
    byteSize: downloaded.imageBytes.length,
  };
}

async function requestOpenAiImageEdit(input: {
  openAiApiKey: string;
  prompt: string;
  referenceImage: LoadedReferenceImage;
}): Promise<Response> {
  const formData = new FormData();
  formData.append("model", OPENAI_IMAGE_MODEL);
  formData.append("prompt", input.prompt);
  formData.append("size", OPENAI_IMAGE_SIZE);
  formData.append("n", "1");
  const extension = input.referenceImage.mimeType.includes("jpeg")
    ? "jpg"
    : input.referenceImage.mimeType.includes("webp")
      ? "webp"
      : "png";
  const filename = `${input.referenceImage.label || "reference"}.${extension}`;
  formData.append(
    "image",
    new Blob([Buffer.from(input.referenceImage.imageBytes)], {
      type: input.referenceImage.mimeType || "image/png",
    }),
    filename
  );

  return fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.openAiApiKey}`,
    },
    body: formData,
    cache: "no-store",
  });
}

async function requestOpenAiImageGeneration(input: {
  openAiApiKey: string;
  prompt: string;
}): Promise<Response> {
  return fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.openAiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_IMAGE_MODEL,
      prompt: input.prompt,
      size: OPENAI_IMAGE_SIZE,
      n: 1,
    }),
    cache: "no-store",
  });
}

function shouldFallbackToTextMode(
  imageType: WalmartGeneratedImageType,
  error: WalmartImageGenerationError
): boolean {
  if (imageType === "supplement_facts") return false;
  return (
    error.code === "OPENAI_UNSUPPORTED_PARAMETER" ||
    error.code === "OPENAI_UNSUPPORTED_SIZE" ||
    error.code === "OPENAI_MODEL_UNAVAILABLE" ||
    error.code === "OPENAI_REFERENCE_INVALID" ||
    error.code === "OPENAI_BAD_REQUEST" ||
    error.code === "REFERENCE_IMAGE_UNSUPPORTED_TYPE"
  );
}

function buildActionableOpenAiError(params: {
  statusCode: number;
  providerMessage: string;
  providerType: string;
  providerParam: string;
}): WalmartImageGenerationError {
  const providerMessageLower = params.providerMessage.toLowerCase();
  const providerParamLower = params.providerParam.toLowerCase();

  if (params.statusCode === 401) {
    return new WalmartImageGenerationError({
      code: "OPENAI_UNAUTHORIZED",
      message:
        "OpenAI image generation failed: unauthorized. Verify your OpenAI API key in Connect.",
      statusCode: 401,
      category: "auth",
      recommendation: "Reconnect your OpenAI API key, then test and retry.",
      providerErrorType: params.providerType || undefined,
      providerErrorParam: params.providerParam || undefined,
    });
  }
  if (params.statusCode === 403) {
    return new WalmartImageGenerationError({
      code: "OPENAI_FORBIDDEN",
      message:
        "OpenAI image generation failed: forbidden. Your OpenAI project may not have image model access.",
      statusCode: 403,
      category: "permission",
      recommendation: "Check project/model access in OpenAI, then retry.",
      providerErrorType: params.providerType || undefined,
      providerErrorParam: params.providerParam || undefined,
    });
  }
  if (params.statusCode === 429) {
    return new WalmartImageGenerationError({
      code: "OPENAI_RATE_LIMITED",
      message: "OpenAI image generation is rate-limited right now.",
      statusCode: 429,
      category: "rate_limit",
      recommendation: "Wait a moment and retry.",
      providerErrorType: params.providerType || undefined,
      providerErrorParam: params.providerParam || undefined,
    });
  }

  if (params.statusCode === 400) {
    if (
      providerParamLower.includes("response_format") ||
      providerMessageLower.includes("response_format")
    ) {
      return new WalmartImageGenerationError({
        code: "OPENAI_UNSUPPORTED_PARAMETER",
        message:
          "OpenAI rejected the image request: unsupported response format parameter for the selected model.",
        statusCode: 400,
        category: "invalid_request",
        recommendation:
          "Retry with default generation settings. If the issue persists, verify image model compatibility.",
        providerErrorType: params.providerType || undefined,
        providerErrorParam: params.providerParam || undefined,
      });
    }
    if (providerParamLower.includes("size") || providerMessageLower.includes("size")) {
      return new WalmartImageGenerationError({
        code: "OPENAI_UNSUPPORTED_SIZE",
        message:
          "OpenAI rejected the image request: unsupported size for the selected model.",
        statusCode: 400,
        category: "invalid_request",
        recommendation:
          "Retry generation. If it still fails, check model/size compatibility in OpenAI settings.",
        providerErrorType: params.providerType || undefined,
        providerErrorParam: params.providerParam || undefined,
      });
    }
    if (
      providerParamLower.includes("model") ||
      providerMessageLower.includes("model") ||
      providerMessageLower.includes("not found")
    ) {
      return new WalmartImageGenerationError({
        code: "OPENAI_MODEL_UNAVAILABLE",
        message:
          "OpenAI rejected the image request: model unavailable for this API key/project.",
        statusCode: 400,
        category: "model_access",
        recommendation: "Verify OpenAI image model access and configured model name, then retry.",
        providerErrorType: params.providerType || undefined,
        providerErrorParam: params.providerParam || undefined,
      });
    }
    if (
      providerParamLower.includes("image") ||
      providerMessageLower.includes("image") ||
      providerMessageLower.includes("invalid image")
    ) {
      return new WalmartImageGenerationError({
        code: "OPENAI_REFERENCE_INVALID",
        message:
          "OpenAI rejected the reference image input for this generation request.",
        statusCode: 400,
        category: "invalid_request",
        recommendation:
          "Use a clear PNG/JPG reference image and retry. If this persists, test OpenAI image model access.",
        providerErrorType: params.providerType || undefined,
        providerErrorParam: params.providerParam || undefined,
      });
    }

    return new WalmartImageGenerationError({
      code: "OPENAI_BAD_REQUEST",
      message: "OpenAI rejected the image request due to invalid generation parameters.",
      statusCode: 400,
      category: "invalid_request",
      recommendation: "Retry with simpler guidance. If this persists, test your OpenAI connection settings.",
      providerErrorType: params.providerType || undefined,
      providerErrorParam: params.providerParam || undefined,
    });
  }

  if (params.statusCode >= 500) {
    return new WalmartImageGenerationError({
      code: "OPENAI_PROVIDER_ERROR",
      message: "OpenAI image generation is temporarily unavailable.",
      statusCode: params.statusCode,
      category: "provider_error",
      recommendation: "Retry in a moment.",
      providerErrorType: params.providerType || undefined,
      providerErrorParam: params.providerParam || undefined,
    });
  }

  return new WalmartImageGenerationError({
    code: "OPENAI_IMAGE_FAILED",
    message: `OpenAI image generation failed: HTTP ${params.statusCode}.`,
    statusCode: params.statusCode,
    category: "unknown",
    recommendation: "Retry generation. If this persists, check OpenAI connection settings.",
    providerErrorType: params.providerType || undefined,
    providerErrorParam: params.providerParam || undefined,
  });
}

async function toActionableOpenAiError(response: Response): Promise<WalmartImageGenerationError> {
  const statusCode = response.status;
  const fallbackDetail = `HTTP ${statusCode}`;

  let providerMessage = "";
  let providerType = "";
  let providerParam = "";

  const rawText = await response.text().catch(() => "");
  if (rawText.trim()) {
    try {
      const parsed = JSON.parse(rawText) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const root = parsed as Record<string, unknown>;
        const err = root.error;
        if (err && typeof err === "object" && !Array.isArray(err)) {
          const errorRow = err as Record<string, unknown>;
          providerMessage = truncate(
            redactPotentialSecrets(normalizeWhitespace(asText(errorRow.message))),
            240
          );
          providerType = truncate(asText(errorRow.type), 80);
          providerParam = truncate(asText(errorRow.param), 120);
        } else {
          providerMessage = truncate(
            redactPotentialSecrets(normalizeWhitespace(asText(root.message))),
            240
          );
        }
      }
    } catch {
      providerMessage = truncate(redactPotentialSecrets(normalizeWhitespace(rawText)), 240);
    }
  }

  const actionable = buildActionableOpenAiError({
    statusCode,
    providerMessage: providerMessage || fallbackDetail,
    providerType,
    providerParam,
  });

  if (!providerMessage) return actionable;

  const detailSuffix = `. Provider detail: ${providerMessage}`;
  return new WalmartImageGenerationError({
    code: actionable.code,
    message: `${actionable.message}${detailSuffix}`,
    statusCode: actionable.statusCode,
    category: actionable.category,
    recommendation: actionable.recommendation,
    providerErrorType: actionable.providerErrorType,
    providerErrorParam: actionable.providerErrorParam,
  });
}

function withRequestDiagnostics(
  error: WalmartImageGenerationError,
  params: {
    promptLength: number;
    requestModel: string;
    requestSize: string;
    generationMode: WalmartImageGenerationMode;
    routePhase: string;
    referenceMimeTypes: string[];
    referenceByteSizes: number[];
    referenceCount: number;
    layoutMode?: WalmartSupplementFactsLayoutMode;
    userGuidanceIncluded?: boolean;
    layoutPreservationInstruction?: boolean;
    productFactsSource?: WalmartSupplementFactsProductFactsSource;
  }
): WalmartImageGenerationError {
  return new WalmartImageGenerationError({
    code: error.code,
    message: error.message,
    statusCode: error.statusCode,
    category: error.category,
    recommendation: error.recommendation,
    providerErrorType: error.providerErrorType,
    providerErrorParam: error.providerErrorParam,
    promptLength: params.promptLength,
    requestModel: params.requestModel,
    requestSize: params.requestSize,
    generationMode: params.generationMode,
    routePhase: params.routePhase,
    referenceMimeTypes: params.referenceMimeTypes,
    referenceByteSizes: params.referenceByteSizes,
    referenceCount: params.referenceCount,
    layoutMode: params.layoutMode,
    userGuidanceIncluded: params.userGuidanceIncluded,
    layoutPreservationInstruction: params.layoutPreservationInstruction,
    productFactsSource: params.productFactsSource,
  });
}

async function normalizeGeneratedImageToSquare(input: {
  imageBytes: Uint8Array;
  mimeType: string;
  imageType: WalmartGeneratedImageType;
}): Promise<{
  imageBytes: Uint8Array;
  mimeType: string;
  width?: number;
  height?: number;
  isSquare?: boolean;
  squareNormalized: boolean;
}> {
  type SquareCanvasColor = { r: number; g: number; b: number; alpha: number };
  type SquareResizeResult = { png: () => { toBuffer: () => Promise<Buffer> } };
  type SquareSharpInstance = {
    metadata: () => Promise<{ width?: number; height?: number }>;
    resize: (
      width: number,
      height: number,
      options: {
        fit: "contain";
        position: "center";
        background: SquareCanvasColor;
        withoutEnlargement: boolean;
      }
    ) => SquareResizeResult;
  };
  type SquareSharpFactory = (input?: Buffer | Uint8Array) => SquareSharpInstance;

  let sharpFactory: SquareSharpFactory | null = null;

  try {
    const sharpModule = await import("sharp");
    const resolved = (sharpModule.default ?? sharpModule) as unknown;
    if (typeof resolved !== "function") {
      return {
        imageBytes: input.imageBytes,
        mimeType: input.mimeType,
        squareNormalized: false,
      };
    }
    sharpFactory = resolved as unknown as SquareSharpFactory;
  } catch {
    return {
      imageBytes: input.imageBytes,
      mimeType: input.mimeType,
      squareNormalized: false,
    };
  }
  if (!sharpFactory) {
    return {
      imageBytes: input.imageBytes,
      mimeType: input.mimeType,
      squareNormalized: false,
    };
  }

  try {
    const metadata = await sharpFactory(Buffer.from(input.imageBytes)).metadata();
    const width =
      typeof metadata.width === "number" && Number.isFinite(metadata.width)
        ? Math.floor(metadata.width)
        : undefined;
    const height =
      typeof metadata.height === "number" && Number.isFinite(metadata.height)
        ? Math.floor(metadata.height)
        : undefined;
    if (!width || !height) {
      return {
        imageBytes: input.imageBytes,
        mimeType: input.mimeType,
        squareNormalized: false,
      };
    }
    if (width === height) {
      return {
        imageBytes: input.imageBytes,
        mimeType: input.mimeType,
        width,
        height,
        isSquare: true,
        squareNormalized: false,
      };
    }

    const squareEdge = OPENAI_IMAGE_SQUARE_EDGE;
    const background =
      input.imageType === "supplement_facts"
        ? { r: 255, g: 255, b: 255, alpha: 1 }
        : { r: 250, g: 250, b: 250, alpha: 1 };
    const normalizedBuffer = await sharpFactory(Buffer.from(input.imageBytes))
      .resize(squareEdge, squareEdge, {
        fit: "contain",
        position: "center",
        background,
        withoutEnlargement: false,
      })
      .png()
      .toBuffer();

    return {
      imageBytes: new Uint8Array(normalizedBuffer),
      mimeType: "image/png",
      width: squareEdge,
      height: squareEdge,
      isSquare: true,
      squareNormalized: true,
    };
  } catch {
    return {
      imageBytes: input.imageBytes,
      mimeType: input.mimeType,
      squareNormalized: false,
    };
  }
}

export async function generateWalmartProductImage(input: {
  openAiApiKey: string;
  product: WalmartProductRecord;
  imageType: WalmartGeneratedImageType;
  styleGuidance?: string;
  referenceImages?: WalmartGeneratedImageReferenceInput[];
}): Promise<{
  imageBytes: Uint8Array;
  mimeType: string;
  imageType: WalmartGeneratedImageType;
  promptSummary: string;
  referenceCount: number;
  generationMode: WalmartImageGenerationMode;
  requestModel: string;
  requestSize: string;
  promptLength: number;
  referenceMimeTypes: string[];
  referenceByteSizes: number[];
  layoutMode?: WalmartSupplementFactsLayoutMode;
  userGuidanceIncluded?: boolean;
  layoutPreservationInstruction?: boolean;
  productFactsSource?: WalmartSupplementFactsProductFactsSource;
  width?: number;
  height?: number;
  isSquare?: boolean;
  squareNormalized?: boolean;
}> {
  const factsResult = extractCanonicalProductFacts({ product: input.product });
  const uploadedReferences = normalizeReferenceImageCandidates(input.referenceImages);
  const fallbackReferences =
    input.imageType === "supplement_facts" && uploadedReferences.length === 0
      ? collectProductMediaReferenceCandidates(input.product, { supplementFactsOnly: true })
      : [];
  const selectedReferences =
    uploadedReferences.length > 0 ? uploadedReferences : fallbackReferences;
  const normalizedGuidance = asText(input.styleGuidance);
  const hasUploadedReference = uploadedReferences.length > 0;
  const supplementFactsDiagnostics =
    input.imageType === "supplement_facts"
      ? {
          layoutMode: (hasUploadedReference
            ? "reference_layout"
            : "standard") as WalmartSupplementFactsLayoutMode,
          userGuidanceIncluded: Boolean(normalizedGuidance),
          layoutPreservationInstruction: hasUploadedReference,
          productFactsSource: resolveSupplementFactsProductFactsSource({
            facts: factsResult.facts,
            hasUploadedReference,
          }),
        }
      : null;

  ensureSupplementFactsInput(input.imageType, selectedReferences);

  const promptPayload = buildWalmartGeneratedImagePrompt({
    product: input.product,
    facts: factsResult.facts,
    imageType: input.imageType,
    styleGuidance: input.styleGuidance,
    referenceImages: selectedReferences,
  });

  const fallbackMimeTypes = selectedReferences
    .map((entry) => normalizeMimeType(entry.mimeType || ""))
    .filter(Boolean);
  const fallbackByteSizes = selectedReferences
    .map((entry) => entry.byteSize ?? 0)
    .filter((size) => Number.isFinite(size) && size > 0)
    .map((size) => Math.floor(size));
  const loadedReferences: LoadedReferenceImage[] = [];
  const currentReferenceMimeTypes = (): string[] => {
    const loaded = loadedReferences.map((entry) => normalizeMimeType(entry.mimeType)).filter(Boolean);
    return loaded.length > 0 ? loaded : fallbackMimeTypes;
  };
  const currentReferenceByteSizes = (): number[] => {
    const loaded = loadedReferences.map((entry) => entry.byteSize).filter((size) => size > 0);
    return loaded.length > 0 ? loaded : fallbackByteSizes;
  };

  const withCurrentDiagnostics = (
    error: WalmartImageGenerationError,
    generationMode: WalmartImageGenerationMode,
    routePhase: string
  ): WalmartImageGenerationError =>
    withRequestDiagnostics(error, {
      promptLength: promptPayload.prompt.length,
      requestModel: OPENAI_IMAGE_MODEL,
      requestSize: OPENAI_IMAGE_SIZE,
      generationMode,
      routePhase,
      referenceMimeTypes: currentReferenceMimeTypes(),
      referenceByteSizes: currentReferenceByteSizes(),
      referenceCount: selectedReferences.length,
      layoutMode: supplementFactsDiagnostics?.layoutMode,
      userGuidanceIncluded: supplementFactsDiagnostics?.userGuidanceIncluded,
      layoutPreservationInstruction:
        supplementFactsDiagnostics?.layoutPreservationInstruction,
      productFactsSource: supplementFactsDiagnostics?.productFactsSource,
    });

  let generationMode: WalmartImageGenerationMode =
    selectedReferences.length > 0 ? "reference_image_edit" : "text_to_image";
  let response: Response;
  if (selectedReferences.length > 0) {
    try {
      loadedReferences.push(await loadReferenceImage(selectedReferences[0]));
    } catch (error) {
      if (error instanceof WalmartImageGenerationError) {
        throw withCurrentDiagnostics(error, generationMode, "reference_validation");
      }
      throw withCurrentDiagnostics(
        new WalmartImageGenerationError({
          code: "REFERENCE_IMAGE_LOAD_FAILED",
          message: "Reference image could not be prepared for generation.",
          statusCode: 400,
          category: "invalid_request",
          recommendation: "Upload a valid PNG/JPEG image and retry.",
        }),
        generationMode,
        "reference_validation"
      );
    }
    try {
      response = await requestOpenAiImageEdit({
        openAiApiKey: input.openAiApiKey,
        prompt: promptPayload.prompt,
        referenceImage: loadedReferences[0],
      });
    } catch {
      throw withCurrentDiagnostics(
        new WalmartImageGenerationError({
          code: "OPENAI_IMAGE_PROVIDER_UNREACHABLE",
          message: "OpenAI image generation request failed before provider response.",
          statusCode: 502,
          category: "provider_error",
          recommendation: "Retry generation. If this persists, verify network/provider status.",
        }),
        generationMode,
        "provider_request"
      );
    }
    if (!response.ok) {
      const actionable = await toActionableOpenAiError(response);
      if (shouldFallbackToTextMode(input.imageType, actionable)) {
        generationMode = "reference_fallback_text_to_image";
        try {
          response = await requestOpenAiImageGeneration({
            openAiApiKey: input.openAiApiKey,
            prompt: promptPayload.prompt,
          });
        } catch {
          throw withCurrentDiagnostics(
            new WalmartImageGenerationError({
              code: "OPENAI_IMAGE_PROVIDER_UNREACHABLE",
              message: "OpenAI image generation request failed before provider response.",
              statusCode: 502,
              category: "provider_error",
              recommendation: "Retry generation. If this persists, verify network/provider status.",
            }),
            generationMode,
            "provider_request"
          );
        }
        if (!response.ok) {
          const fallbackActionable = await toActionableOpenAiError(response);
          throw withCurrentDiagnostics(fallbackActionable, generationMode, "provider_response");
        }
      } else {
        throw withCurrentDiagnostics(actionable, generationMode, "provider_response");
      }
    }
  } else {
    generationMode = "text_to_image";
    try {
      response = await requestOpenAiImageGeneration({
        openAiApiKey: input.openAiApiKey,
        prompt: promptPayload.prompt,
      });
    } catch {
      throw withCurrentDiagnostics(
        new WalmartImageGenerationError({
          code: "OPENAI_IMAGE_PROVIDER_UNREACHABLE",
          message: "OpenAI image generation request failed before provider response.",
          statusCode: 502,
          category: "provider_error",
          recommendation: "Retry generation. If this persists, verify network/provider status.",
        }),
        generationMode,
        "provider_request"
      );
    }
    if (!response.ok) {
      const actionable = await toActionableOpenAiError(response);
      throw withCurrentDiagnostics(actionable, generationMode, "provider_response");
    }
  }

  const payload = (await response.json().catch(() => ({}))) as unknown;
  const parsed = parseOpenAiImageData(payload);

  if (parsed.b64) {
    const bytes = Buffer.from(parsed.b64, "base64");
    if (bytes.length === 0) {
      throw withCurrentDiagnostics(
        new WalmartImageGenerationError({
          code: "OPENAI_IMAGE_EMPTY",
          message: "Generated image is empty. Regenerate and try again.",
          statusCode: 502,
          category: "provider_response_invalid",
          recommendation: "Regenerate the image. If this persists, retry later.",
        }),
        generationMode,
        "provider_response"
      );
    }

    const normalized = await normalizeGeneratedImageToSquare({
      imageBytes: new Uint8Array(bytes),
      mimeType: "image/png",
      imageType: input.imageType,
    });

    return {
      imageBytes: normalized.imageBytes,
      mimeType: normalized.mimeType,
      imageType: input.imageType,
      promptSummary: promptPayload.promptSummary,
      referenceCount: selectedReferences.length,
      generationMode,
      requestModel: OPENAI_IMAGE_MODEL,
      requestSize: OPENAI_IMAGE_SIZE,
      promptLength: promptPayload.prompt.length,
      referenceMimeTypes: currentReferenceMimeTypes(),
      referenceByteSizes: currentReferenceByteSizes(),
      layoutMode: supplementFactsDiagnostics?.layoutMode,
      userGuidanceIncluded: supplementFactsDiagnostics?.userGuidanceIncluded,
      layoutPreservationInstruction:
        supplementFactsDiagnostics?.layoutPreservationInstruction,
      productFactsSource: supplementFactsDiagnostics?.productFactsSource,
      width: normalized.width,
      height: normalized.height,
      isSquare: normalized.isSquare,
      squareNormalized: normalized.squareNormalized,
    };
  }

  if (parsed.url) {
    let downloaded: { imageBytes: Uint8Array; mimeType: string };
    try {
      downloaded = await downloadImage(parsed.url);
    } catch (error) {
      if (error instanceof WalmartImageGenerationError) {
        throw withCurrentDiagnostics(error, generationMode, "provider_download");
      }
      throw withCurrentDiagnostics(
        new WalmartImageGenerationError({
          code: "OPENAI_IMAGE_DOWNLOAD_FAILED",
          message: "Generated image download failed.",
          statusCode: 502,
          category: "provider_response_invalid",
          recommendation: "Regenerate the image. If this persists, retry later.",
        }),
        generationMode,
        "provider_download"
      );
    }
    const normalized = await normalizeGeneratedImageToSquare({
      imageBytes: downloaded.imageBytes,
      mimeType: downloaded.mimeType,
      imageType: input.imageType,
    });
    return {
      imageBytes: normalized.imageBytes,
      mimeType: normalized.mimeType,
      imageType: input.imageType,
      promptSummary: promptPayload.promptSummary,
      referenceCount: selectedReferences.length,
      generationMode,
      requestModel: OPENAI_IMAGE_MODEL,
      requestSize: OPENAI_IMAGE_SIZE,
      promptLength: promptPayload.prompt.length,
      referenceMimeTypes: currentReferenceMimeTypes(),
      referenceByteSizes: currentReferenceByteSizes(),
      layoutMode: supplementFactsDiagnostics?.layoutMode,
      userGuidanceIncluded: supplementFactsDiagnostics?.userGuidanceIncluded,
      layoutPreservationInstruction:
        supplementFactsDiagnostics?.layoutPreservationInstruction,
      productFactsSource: supplementFactsDiagnostics?.productFactsSource,
      width: normalized.width,
      height: normalized.height,
      isSquare: normalized.isSquare,
      squareNormalized: normalized.squareNormalized,
    };
  }

  throw withCurrentDiagnostics(
    new WalmartImageGenerationError({
      code: "OPENAI_IMAGE_INVALID_RESPONSE",
      message: "OpenAI image generation returned no image data.",
      statusCode: 502,
      category: "provider_response_invalid",
      recommendation: "Regenerate the image. If this persists, retry later.",
    }),
    generationMode,
    "provider_response"
  );
}
