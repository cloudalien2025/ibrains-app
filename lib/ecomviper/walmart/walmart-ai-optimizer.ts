import "server-only";

import { evaluateWalmartListingCompliance } from "@/lib/ecomviper/walmart/walmart-compliance";
import {
  assessWalmartListingQuality,
  mergeWalmartAiSuggestionIntoProduct,
} from "@/lib/ecomviper/walmart/walmart-listing-quality";
import type { WalmartAiSuggestion, WalmartProductRecord } from "@/lib/ecomviper/walmart/walmart-types";

const forbiddenTerms = [
  "ed",
  "erectile dysfunction",
  "hypertension",
  "anxiety",
  "insomnia",
  "depression",
  "cure",
  "treat",
  "prevent",
  "reverse",
  "natural viagra",
  "works like cialis",
];

const OPENAI_MODEL = process.env.WALMART_OPENAI_MODEL?.trim() || "gpt-4o-mini";

interface GeneratedSuggestionPayload {
  suggestedTitle?: unknown;
  suggestedShortDescription?: unknown;
  suggestedShortDesc?: unknown;
  shortDescription?: unknown;
  suggestedDescription?: unknown;
  suggestedLongDescription?: unknown;
  longDescription?: unknown;
  description?: unknown;
  suggestedBullets?: unknown;
  suggestedBulletPoints?: unknown;
  bulletPoints?: unknown;
  keyFeatures?: unknown;
  suggestedBrand?: unknown;
  brand?: unknown;
  suggestedAttributes?: unknown;
  attributes?: unknown;
  keyAttributes?: unknown;
  missingAttributes?: unknown;
  complianceWarnings?: unknown;
  qualityScore?: unknown;
}

function unique(items: string[]): string[] {
  return Array.from(new Set(items));
}

function toNonEmptyString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry) => entry.length > 0);
}

function clampScore(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(1, Math.min(100, Math.round(value)));
}

function firstNonEmptyString(values: unknown[]): string {
  for (const value of values) {
    const normalized = toNonEmptyString(value);
    if (normalized) return normalized;
  }
  return "";
}

function firstStringArray(values: unknown[]): string[] {
  for (const value of values) {
    const normalized = toStringArray(value);
    if (normalized.length > 0) return normalized;
  }
  return [];
}

function mergeAttributeAliases(payload: GeneratedSuggestionPayload): Record<string, string> {
  return {
    ...toAttributeRecord(payload.suggestedAttributes),
    ...toAttributeRecord(payload.attributes),
    ...toAttributeRecord(payload.keyAttributes),
  };
}

function makeSafeTitle(product: WalmartProductRecord) {
  const titleBase = product.title.replace(/\s+/g, " ").trim();
  return `${titleBase} | Daily Wellness Support`;
}

function makeSafeDescription(product: WalmartProductRecord) {
  return [
    `${product.brand} ${product.sku} is crafted for premium daily wellness routines with a clean supplement positioning.`,
    "The formula is written for Google Shopping-safe language and emphasizes relaxation support, circulation support, endurance support, and overall performance support without disease claims.",
    "Supports consistent wellness habits with transparent serving guidance and quality-focused manufacturing standards.",
    "*These statements have not been evaluated by the Food and Drug Administration. This product is not intended to diagnose, treat, cure, or prevent any disease.",
  ].join(" ");
}

function safeBullets(product: WalmartProductRecord) {
  return [
    `${product.brand} premium supplement profile for daily wellness support`,
    "Supports relaxation support, circulation support, and endurance support routines",
    "Built for men's wellness and women's wellness lifestyle goals",
    "Focuses on heart wellness, joint comfort, and mobility support language",
    "Google Shopping-safe structure with compliant benefit framing",
  ];
}

function fallbackShortDescription(product: WalmartProductRecord, description: string): string {
  const existing = product.shortDescription.trim();
  if (existing) return existing;
  const firstSentence = description.split(/[.!?]/).find((entry) => entry.trim().length > 0);
  const candidate = (firstSentence ?? description).trim();
  return candidate.length > 180 ? `${candidate.slice(0, 177)}...` : candidate;
}

function toAttributeRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const mapped: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const normalized = toNonEmptyString(raw);
    if (normalized) mapped[key] = normalized;
  }
  return mapped;
}

export function buildDeterministicAiSuggestion(product: WalmartProductRecord): WalmartAiSuggestion {
  const qualityScore = Math.max(52, 88 - product.issues.length * 8 - (product.imageUrl ? 0 : 8));

  const warnings = [...product.issues, ...forbiddenTerms.map((term) => `Avoid term: ${term}`)].slice(0, 6);

  const missingAttributes = Object.keys(product.attributes).length
    ? []
    : ["serving_size", "form", "ingredients_highlights", "lifestyle_fit"];

  const deterministicDescription = makeSafeDescription(product);

  return {
    sku: product.sku,
    qualityScore,
    suggestedTitle: makeSafeTitle(product),
    suggestedShortDescription: fallbackShortDescription(product, deterministicDescription),
    suggestedDescription: deterministicDescription,
    suggestedBullets: safeBullets(product),
    suggestedBrand: product.brand.trim() || undefined,
    suggestedAttributes: Object.fromEntries(
      missingAttributes.map((attribute) => [attribute, ""])
    ),
    missingAttributes,
    complianceWarnings: warnings,
    disclaimer:
      "*These statements have not been evaluated by the Food and Drug Administration. This product is not intended to diagnose, treat, cure, or prevent any disease.",
  };
}

function parseJsonObject(raw: string): Record<string, unknown> {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("OpenAI generation returned empty content.");
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    }
  }

  throw new Error("OpenAI generation returned invalid JSON payload.");
}

async function requestOpenAiSuggestion(params: {
  apiKey: string;
  product: WalmartProductRecord;
}): Promise<Record<string, unknown>> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You generate Walmart listing optimization suggestions. Keep all output policy-safe: no medical condition, disease, drug, cure/treat/prevent/reverse claims, no prescription comparisons, no promotional urgency claims, no external URLs/phone/email, no HTML. Return JSON only.",
        },
        {
          role: "user",
          content: JSON.stringify({
            task: "Generate compliant Walmart listing improvements for AI visibility and referral quality.",
            requiredFields: [
              "suggestedTitle",
              "suggestedShortDescription",
              "suggestedDescription",
              "suggestedBullets",
              "suggestedBrand",
              "suggestedAttributes",
              "missingAttributes",
              "complianceWarnings",
              "qualityScore",
            ],
            constraints: {
              titleMaxChars: 200,
              bulletsMin: 3,
              bulletsMax: 6,
              bulletMaxChars: 180,
              language: "factual and compliant",
              disallow: [
                "medical claims",
                "disease/drug references",
                "cure/treat/prevent/reverse verbs",
                "prescription comparisons",
                "promotional urgency",
              ],
            },
            product: {
              sku: params.product.sku,
              title: params.product.title,
              brand: params.product.brand,
              category: params.product.category,
              issues: params.product.issues,
              shortDescription: params.product.shortDescription,
              longDescription: params.product.longDescription,
              bulletPoints: params.product.bulletPoints,
              attributes: params.product.attributes,
            },
          }),
        },
      ],
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("OpenAI generation failed: HTTP 401 unauthorized. Reconnect your OpenAI API key.");
    }
    if (response.status === 403) {
      throw new Error("OpenAI generation failed: HTTP 403 forbidden. Check your OpenAI project permissions.");
    }
    throw new Error(`OpenAI generation failed: HTTP ${response.status}.`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };

  const content = payload.choices?.[0]?.message?.content ?? "";
  return parseJsonObject(content);
}

function toSuggestionFromGenerated(
  product: WalmartProductRecord,
  generated: Record<string, unknown>
): WalmartAiSuggestion {
  const fallback = buildDeterministicAiSuggestion(product);
  const payload = generated as GeneratedSuggestionPayload;

  const suggestedTitle =
    firstNonEmptyString([payload.suggestedTitle]) || fallback.suggestedTitle;
  const suggestedShortDescription =
    firstNonEmptyString([
      payload.suggestedShortDescription,
      payload.suggestedShortDesc,
      payload.shortDescription,
    ]) ||
    fallback.suggestedShortDescription ||
    fallbackShortDescription(product, fallback.suggestedDescription);
  const suggestedDescription =
    firstNonEmptyString([
      payload.suggestedDescription,
      payload.suggestedLongDescription,
      payload.longDescription,
      payload.description,
    ]) || fallback.suggestedDescription;

  const suggestedBulletsRaw = firstStringArray([
    payload.suggestedBullets,
    payload.suggestedBulletPoints,
    payload.bulletPoints,
    payload.keyFeatures,
  ]);
  const suggestedBullets =
    suggestedBulletsRaw.length >= 3
      ? suggestedBulletsRaw.slice(0, 6)
      : fallback.suggestedBullets;

  const suggestedBrandRaw = firstNonEmptyString([
    payload.suggestedBrand,
    payload.brand,
  ]);
  const suggestedBrand =
    suggestedBrandRaw && suggestedBrandRaw.toLowerCase() !== "unknown"
      ? suggestedBrandRaw
      : fallback.suggestedBrand;
  const suggestedAttributes = {
    ...(fallback.suggestedAttributes ?? {}),
    ...mergeAttributeAliases(payload),
  };

  const missingAttributes = toStringArray(payload.missingAttributes);
  const complianceWarnings = unique([
    ...toStringArray(payload.complianceWarnings),
    ...product.issues,
  ]);

  return {
    sku: product.sku,
    qualityScore: clampScore(payload.qualityScore) ?? fallback.qualityScore,
    suggestedTitle,
    suggestedShortDescription,
    suggestedDescription,
    suggestedBullets,
    suggestedBrand,
    suggestedAttributes,
    missingAttributes,
    complianceWarnings,
    disclaimer: fallback.disclaimer,
  };
}

function applyComplianceGuardrails(product: WalmartProductRecord, suggestion: WalmartAiSuggestion): WalmartAiSuggestion {
  const compliance = evaluateWalmartListingCompliance({
    title: suggestion.suggestedTitle,
    longDescription: suggestion.suggestedDescription,
    bulletPoints: suggestion.suggestedBullets,
  });

  if (compliance.violations.length > 0) {
    const fallback = buildDeterministicAiSuggestion(product);
    return {
      ...fallback,
      complianceWarnings: unique([
        ...fallback.complianceWarnings,
        ...compliance.warnings,
        ...compliance.violations.map((entry) => `Policy blocker removed: ${entry}`),
      ]).slice(0, 8),
    };
  }

  return {
    ...suggestion,
    complianceWarnings: unique([...suggestion.complianceWarnings, ...compliance.warnings]).slice(0, 8),
  };
}

function alignSuggestionQualityScore(
  product: WalmartProductRecord,
  suggestion: WalmartAiSuggestion
): WalmartAiSuggestion {
  const projected = mergeWalmartAiSuggestionIntoProduct(product, suggestion);
  const projectedQuality = assessWalmartListingQuality(projected);
  return {
    ...suggestion,
    qualityScore: projectedQuality.score,
  };
}

export async function generateWalmartAiSuggestion(params: {
  product: WalmartProductRecord;
  openAiApiKey: string;
}): Promise<WalmartAiSuggestion> {
  const useDeterministicMock = process.env.WALMART_AI_DETERMINISTIC_MOCK === "1";
  if (useDeterministicMock) {
    return buildDeterministicAiSuggestion(params.product);
  }

  const generated = await requestOpenAiSuggestion({
    apiKey: params.openAiApiKey,
    product: params.product,
  });

  const suggestion = toSuggestionFromGenerated(params.product, generated);
  const guarded = applyComplianceGuardrails(params.product, suggestion);
  return alignSuggestionQualityScore(params.product, guarded);
}
