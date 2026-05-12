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
const OPENAI_IMAGE_PROMPT_MAX_CHARS = 3500;
const MAX_REFERENCE_IMAGES = 4;
const MAX_REFERENCE_BYTES = 8 * 1024 * 1024;

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
  }
}

interface PreparedReferenceImage {
  source: WalmartGeneratedImageReferenceInput["source"];
  url: string;
  label?: string;
  mimeType?: string;
}

interface LoadedReferenceImage {
  source: WalmartGeneratedImageReferenceInput["source"];
  url: string;
  label?: string;
  mimeType: string;
  imageBytes: Uint8Array;
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

function parseDataImageUrl(value: string): { mimeType: string; imageBytes: Uint8Array } | null {
  const trimmed = value.trim();
  const match = trimmed.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/);
  if (!match) return null;
  const mimeType = match[1].toLowerCase();
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length === 0 || bytes.length > MAX_REFERENCE_BYTES) return null;
  return {
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
    const normalizedUrl = isDataImageUrl(rawUrl) ? rawUrl.trim() : toHttpsUrl(rawUrl);
    if (!normalizedUrl || seen.has(normalizedUrl)) continue;
    seen.add(normalizedUrl);
    normalized.push({
      source,
      url: normalizedUrl,
      label: asText(row.label) || undefined,
      mimeType: asText(row.mimeType) || undefined,
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
  referenceImages?: PreparedReferenceImage[];
}): { prompt: string; promptSummary: string } {
  const productLines = toProductContextLines(input.product);
  const factsLines = toFactsLines(input.facts);
  const normalizedGuidance = asText(input.styleGuidance);
  const referenceImages = input.referenceImages ?? [];
  const referenceSummary =
    referenceImages.length > 0
      ? `Reference images provided (${referenceImages.length}): ${referenceImages
          .map((entry, index) => `#${index + 1} ${entry.label || entry.source}`)
          .join(", ")}`
      : "";
  const summary = `${imageTypeLabel(input.imageType)} image for ${input.product.sku}`;

  const promptRaw = [
    `Task: Generate one ${imageTypeLabel(input.imageType)} image for a Walmart listing.`,
    imageTypeDirections(input.imageType),
    buildComplianceGuardrails(),
    "Keep brand/product identity consistent with provided context.",
    referenceSummary,
    input.imageType === "supplement_facts" && referenceImages.length > 0
      ? "For Supplement Facts: follow the uploaded/reference label panel truth. Preserve legibility and do not invent values."
      : "",
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
  if (dataUrlParsed) {
    return {
      source: reference.source,
      url: reference.url,
      label: reference.label,
      mimeType: dataUrlParsed.mimeType,
      imageBytes: dataUrlParsed.imageBytes,
    };
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
    mimeType: asText(response.headers.get("content-type")) || "image/png",
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

  return {
    source: reference.source,
    url: httpsUrl,
    label: reference.label,
    mimeType: downloaded.mimeType || "image/png",
    imageBytes: downloaded.imageBytes,
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
  params: { promptLength: number; requestModel: string; requestSize: string }
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
  });
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
}> {
  const factsResult = extractCanonicalProductFacts({ product: input.product });
  const uploadedReferences = normalizeReferenceImageCandidates(input.referenceImages);
  const fallbackReferences =
    input.imageType === "supplement_facts" && uploadedReferences.length === 0
      ? collectProductMediaReferenceCandidates(input.product, { supplementFactsOnly: true })
      : [];
  const selectedReferences =
    uploadedReferences.length > 0 ? uploadedReferences : fallbackReferences;

  ensureSupplementFactsInput(input.imageType, selectedReferences);

  const promptPayload = buildWalmartGeneratedImagePrompt({
    product: input.product,
    facts: factsResult.facts,
    imageType: input.imageType,
    styleGuidance: input.styleGuidance,
    referenceImages: selectedReferences,
  });

  const primaryReference =
    selectedReferences.length > 0
      ? await loadReferenceImage(selectedReferences[0])
      : null;

  const response = primaryReference
    ? await requestOpenAiImageEdit({
        openAiApiKey: input.openAiApiKey,
        prompt: promptPayload.prompt,
        referenceImage: primaryReference,
      })
    : await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${input.openAiApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: OPENAI_IMAGE_MODEL,
          prompt: promptPayload.prompt,
          size: OPENAI_IMAGE_SIZE,
          n: 1,
        }),
        cache: "no-store",
      });

  if (!response.ok) {
    const actionable = await toActionableOpenAiError(response);
    throw withRequestDiagnostics(actionable, {
      promptLength: promptPayload.prompt.length,
      requestModel: OPENAI_IMAGE_MODEL,
      requestSize: OPENAI_IMAGE_SIZE,
    });
  }

  const payload = (await response.json().catch(() => ({}))) as unknown;
  const parsed = parseOpenAiImageData(payload);

  if (parsed.b64) {
    const bytes = Buffer.from(parsed.b64, "base64");
    if (bytes.length === 0) {
      throw new WalmartImageGenerationError({
        code: "OPENAI_IMAGE_EMPTY",
        message: "Generated image is empty. Regenerate and try again.",
        statusCode: 502,
        category: "provider_response_invalid",
        recommendation: "Regenerate the image. If this persists, retry later.",
      });
    }

    return {
      imageBytes: bytes,
      mimeType: "image/png",
      imageType: input.imageType,
      promptSummary: promptPayload.promptSummary,
      referenceCount: selectedReferences.length,
    };
  }

  if (parsed.url) {
    const downloaded = await downloadImage(parsed.url);
    return {
      ...downloaded,
      imageType: input.imageType,
      promptSummary: promptPayload.promptSummary,
      referenceCount: selectedReferences.length,
    };
  }

  throw new WalmartImageGenerationError({
    code: "OPENAI_IMAGE_INVALID_RESPONSE",
    message: "OpenAI image generation returned no image data.",
    statusCode: 502,
    category: "provider_response_invalid",
    recommendation: "Regenerate the image. If this persists, retry later.",
  });
}
