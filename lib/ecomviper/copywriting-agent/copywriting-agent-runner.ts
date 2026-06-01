import "server-only";

import { buildCopywritingPromptPayload } from "@/lib/ecomviper/copywriting-agent/copywriting-agent-prompt";
import { evaluateProductCopywritingOutput } from "@/lib/ecomviper/copywriting-agent/copywriting-agent-evals";
import {
  parseProductCopywritingOutput,
  type ProductCopywritingInput,
  type ProductCopywritingOutput,
} from "@/lib/ecomviper/copywriting-agent/copywriting-agent-types";

const OPENAI_MODEL = process.env.ECOMVIPER_COPYWRITING_OPENAI_MODEL?.trim() || "gpt-4.1-mini";
const OPENAI_TIMEOUT_MS = (() => {
  const parsed = Number.parseInt(process.env.ECOMVIPER_COPYWRITING_OPENAI_TIMEOUT_MS || "12000", 10);
  return Number.isFinite(parsed) && parsed >= 1_000 ? parsed : 12_000;
})();

export type ProductCopywritingRunStatus = "success" | "validation_error" | "model_error" | "unavailable" | "blocked";

export interface ProductCopywritingRunResult {
  status: ProductCopywritingRunStatus;
  output: ProductCopywritingOutput | null;
  missingDataNotices: string[];
  complianceWarnings: string[];
  errorCode: string | null;
  safeMessage: string;
  generationMetadata: {
    model: string | null;
    generatedAt: string;
    sourceMode: ProductCopywritingOutput["generationMetadata"]["sourceMode"];
  };
}

export interface ProductCopywritingModelClient {
  generateStructuredOutput(input: {
    apiKey: string;
    model: string;
    system: string;
    user: string;
    outputSchema: unknown;
  }): Promise<{
    content: string;
    model: string | null;
  }>;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function canonicalMissingNotices(input: ProductCopywritingInput): string[] {
  const notices: string[] = [];
  if (input.missingData.coaMissing) notices.push("COA missing.");
  if (input.missingData.pricingMissing) notices.push("Pricing missing.");
  if (input.missingData.inventoryMissing) notices.push("Inventory missing.");
  if (input.missingData.supplementFactsMissing) notices.push("Supplement Facts missing.");
  if (input.missingData.supplementFactsImageOnly) {
    notices.push("Supplement Facts image available; ingredient details are not structured yet.");
  }
  if (input.missingData.supplementFactsTextNeedsReview) notices.push("Supplement Facts text needs review.");
  if (input.missingData.servingSizeMissing) notices.push("Serving size missing.");
  if (input.missingData.servingsPerContainerMissing) notices.push("Servings per container missing.");
  if (input.missingData.ingredientAmountsMissing && !input.missingData.ingredientFactsMissing) {
    notices.push("Ingredient amounts missing.");
  }
  if (input.missingData.supplierMatchMissing) notices.push("Supplier match not found.");
  return notices;
}

function normalizeMissingNotice(value: string): string {
  const normalized = value.trim().replace(/\.+$/, "").toLowerCase();
  if (normalized.includes("coa")) return "COA missing.";
  if (normalized.includes("pricing")) return "Pricing missing.";
  if (normalized.includes("inventory")) return "Inventory missing.";
  if (normalized.includes("serving size")) return "Serving size missing.";
  if (normalized.includes("servings per container")) return "Servings per container missing.";
  if (normalized.includes("ingredient amounts")) return "Ingredient amounts missing.";
  if (normalized.includes("image") && normalized.includes("structured")) {
    return "Supplement Facts image available; ingredient details are not structured yet.";
  }
  if (normalized.includes("text") && normalized.includes("review")) return "Supplement Facts text needs review.";
  if (normalized.includes("supplement")) return "Supplement Facts missing.";
  if (normalized.includes("supplier")) return "Supplier match not found.";
  return `${value.trim().replace(/\.+$/, "")}.`;
}

const MERCHANT_BLOCKED_PATTERNS = [
  /source fact references include non-listed facts/i,
  /require[s]?\s+ocr\s+extraction/i,
  /supplier intelligence update/i,
  /ingredientmatchingreadiness/i,
  /producteditorfactsreadiness/i,
  /complianceevidencereadiness/i,
  /raw schema/i,
  /raw debug/i,
  /fix lane/i,
];

function isMerchantBlockedLine(value: string): boolean {
  return MERCHANT_BLOCKED_PATTERNS.some((pattern) => pattern.test(value));
}

function sanitizeMerchantText(value: string): string {
  const text = value.trim();
  if (!text) return "";
  if (isMerchantBlockedLine(text)) return "";
  return text;
}

function sanitizeMerchantLines(values: string[]): string[] {
  return dedupe(values.map((value) => sanitizeMerchantText(value)).filter(Boolean));
}

function filterNoticesByInput(input: ProductCopywritingInput, notices: string[]): string[] {
  return notices.filter((notice) => {
    const normalized = normalizeMissingNotice(notice);
    if (normalized === "Supplement Facts missing.") return input.missingData.supplementFactsMissing;
    if (normalized === "Serving size missing.") return input.missingData.servingSizeMissing;
    if (normalized === "Servings per container missing.") return input.missingData.servingsPerContainerMissing;
    if (normalized === "Ingredient amounts missing.") {
      return input.missingData.ingredientAmountsMissing && !input.missingData.ingredientFactsMissing;
    }
    if (normalized === "Supplement Facts image available; ingredient details are not structured yet.") {
      return input.missingData.supplementFactsImageOnly;
    }
    if (normalized === "Supplement Facts text needs review.") return input.missingData.supplementFactsTextNeedsReview;
    if (normalized === "Supplier match not found.") return input.missingData.supplierMatchMissing;
    if (normalized === "COA missing.") return input.missingData.coaMissing;
    if (normalized === "Pricing missing.") return input.missingData.pricingMissing;
    if (normalized === "Inventory missing.") return input.missingData.inventoryMissing;
    return true;
  });
}

function sanitizeOutput(output: ProductCopywritingOutput): ProductCopywritingOutput {
  const benefitBullets = sanitizeMerchantLines(output.benefitBullets);
  const ingredientHighlights = sanitizeMerchantLines(output.ingredientHighlights);
  const complianceWarnings = sanitizeMerchantLines(output.complianceWarnings);
  const missingDataNotices = sanitizeMerchantLines(output.missingDataNotices);
  const faqSuggestions = output.faqSuggestions
    .map((faq) => ({
      question: sanitizeMerchantText(faq.question),
      answer: sanitizeMerchantText(faq.answer),
    }))
    .filter((faq) => faq.question && faq.answer);
  const imageAltTextSuggestions = output.imageAltTextSuggestions
    .map((entry) => ({
      imageId: entry.imageId,
      altText: sanitizeMerchantText(entry.altText),
    }))
    .filter((entry) => entry.altText);

  return {
    ...output,
    optimizedTitle: sanitizeMerchantText(output.optimizedTitle),
    listingSubtitle: sanitizeMerchantText(output.listingSubtitle),
    shortDescription: sanitizeMerchantText(output.shortDescription),
    fullDescription: sanitizeMerchantText(output.fullDescription),
    benefitBullets,
    ingredientHighlights,
    usageSummary: sanitizeMerchantText(output.usageSummary),
    faqSuggestions,
    imageAltTextSuggestions,
    metaTitle: sanitizeMerchantText(output.metaTitle),
    metaDescription: sanitizeMerchantText(output.metaDescription),
    complianceWarnings,
    missingDataNotices,
  };
}

function enforceInputGuards(input: ProductCopywritingInput, output: ProductCopywritingOutput): ProductCopywritingOutput {
  const sanitizedOutput = sanitizeOutput(output);
  const requiredNotices = canonicalMissingNotices(input);
  const normalizedOutputNotices = sanitizedOutput.missingDataNotices.map(normalizeMissingNotice);

  const complianceWarnings = [...sanitizedOutput.complianceWarnings];
  let ingredientHighlights = sanitizedOutput.ingredientHighlights;
  if (input.missingData.supplementFactsMissing || input.missingData.ingredientFactsMissing) {
    ingredientHighlights = [];
    if (input.missingData.supplementFactsMissing) {
      complianceWarnings.push("Supplement Facts missing. Ingredient-backed claims were limited.");
    } else {
      complianceWarnings.push("Ingredient-backed claims were limited to available source facts.");
    }
  }

  const mergedNotices = sanitizeMerchantLines(
    filterNoticesByInput(input, dedupe([...requiredNotices, ...normalizedOutputNotices]))
  );
  const mergedWarnings = sanitizeMerchantLines(
    complianceWarnings.filter((warning) => {
      if (/supplement facts missing/i.test(warning) && !input.missingData.supplementFactsMissing) return false;
      if (/ingredient amounts missing/i.test(warning) && !input.missingData.ingredientAmountsMissing) return false;
      return true;
    })
  );

  return {
    ...sanitizedOutput,
    ingredientHighlights,
    missingDataNotices: mergedNotices,
    complianceWarnings: mergedWarnings,
  };
}

export const defaultProductCopywritingModelClient: ProductCopywritingModelClient = {
  async generateStructuredOutput(input) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);
    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${input.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: input.model,
          temperature: 0.1,
          max_tokens: 1500,
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "product_copywriting_output",
              strict: true,
              schema: input.outputSchema,
            },
          },
          messages: [
            { role: "system", content: input.system },
            { role: "user", content: input.user },
          ],
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`openai_http_${response.status}`);
      }

      const payload = (await response.json()) as {
        model?: unknown;
        choices?: Array<{ message?: { content?: unknown } }>;
      };

      const content = asString(payload?.choices?.[0]?.message?.content);
      if (!content) {
        throw new Error("empty_model_output");
      }

      return {
        content,
        model: asString(payload.model) || input.model,
      };
    } finally {
      clearTimeout(timeout);
    }
  },
};

export async function runProductCopywritingAgent(input: {
  copywritingInput: ProductCopywritingInput;
  openAiApiKey: string | null;
  model?: string | null;
  modelClient?: ProductCopywritingModelClient;
}): Promise<ProductCopywritingRunResult> {
  const now = new Date().toISOString();
  const model = asString(input.model) || OPENAI_MODEL;
  const requiredNotices = canonicalMissingNotices(input.copywritingInput);

  if (!asString(input.openAiApiKey)) {
    return {
      status: "unavailable",
      output: null,
      missingDataNotices: requiredNotices,
      complianceWarnings: [],
      errorCode: "OPENAI_UNAVAILABLE",
      safeMessage: "AI generation is unavailable right now.",
      generationMetadata: {
        model,
        generatedAt: now,
        sourceMode: "unknown",
      },
    };
  }

  const payload = buildCopywritingPromptPayload(input.copywritingInput);
  const modelClient = input.modelClient || defaultProductCopywritingModelClient;

  try {
    const generated = await modelClient.generateStructuredOutput({
      apiKey: asString(input.openAiApiKey),
      model,
      system: payload.system,
      user: payload.user,
      outputSchema: payload.outputJsonSchema,
    });

    let parsed: ProductCopywritingOutput;
    try {
      const rawObject = JSON.parse(generated.content);
      parsed = parseProductCopywritingOutput(rawObject);
    } catch {
      return {
        status: "validation_error",
        output: null,
        missingDataNotices: requiredNotices,
        complianceWarnings: [],
        errorCode: "OUTPUT_SCHEMA_MISMATCH",
        safeMessage: "Generated response could not be validated.",
        generationMetadata: {
          model: generated.model || model,
          generatedAt: now,
          sourceMode: "unknown",
        },
      };
    }

    const guardedOutput = enforceInputGuards(input.copywritingInput, parsed);
    const evalResult = evaluateProductCopywritingOutput(input.copywritingInput, guardedOutput);
    if (!evalResult.passed) {
      return {
        status: "blocked",
        output: null,
        missingDataNotices: guardedOutput.missingDataNotices,
        complianceWarnings: sanitizeMerchantLines([
          ...guardedOutput.complianceWarnings,
          ...evalResult.hardFailures,
          ...evalResult.warnings,
        ]),
        errorCode: "COMPLIANCE_BLOCKED",
        safeMessage: "Generated copy was blocked by compliance safeguards.",
        generationMetadata: {
          model: generated.model || model,
          generatedAt: now,
          sourceMode: guardedOutput.generationMetadata.sourceMode,
        },
      };
    }

    return {
      status: "success",
      output: guardedOutput,
      missingDataNotices: guardedOutput.missingDataNotices,
      complianceWarnings: sanitizeMerchantLines([...guardedOutput.complianceWarnings, ...evalResult.warnings]),
      errorCode: null,
      safeMessage: "Generated proposal is ready for review.",
      generationMetadata: {
        model: generated.model || model,
        generatedAt: now,
        sourceMode: guardedOutput.generationMetadata.sourceMode,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const timeout =
      (error instanceof DOMException && error.name === "AbortError")
      || /timeout|timed out/i.test(message);
    return {
      status: "model_error",
      output: null,
      missingDataNotices: requiredNotices,
      complianceWarnings: [],
      errorCode: timeout ? "MODEL_TIMEOUT" : "MODEL_ERROR",
      safeMessage: timeout ? "AI generation timed out. Try again." : "AI generation is unavailable right now.",
      generationMetadata: {
        model,
        generatedAt: now,
        sourceMode: "unknown",
      },
    };
  }
}
