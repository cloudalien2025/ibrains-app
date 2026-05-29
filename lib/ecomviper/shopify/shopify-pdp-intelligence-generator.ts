import {
  createEmptyShopifyPdpIntelligenceRecord,
  sanitizeShopifyPdpIntelligenceRecord,
  type ShopifyPdpIntelligenceRecord,
} from "@/lib/ecomviper/shopify/shopify-pdp-intelligence";
import {
  evaluateShopifyPdpCompliance,
  sanitizeShopifyPdpFaqs,
} from "@/lib/ecomviper/shopify/shopify-pdp-intelligence-compliance";
import type { ShopifyCurrentListingDocket } from "@/lib/ecomviper/shopify/shopify-product-docket";
import type { RocktomicSupplierProduct } from "@/lib/ecomviper/dropshipping/rocktomic-supplier-intelligence";

const OPENAI_MODEL = process.env.ECOMVIPER_PDP_OPENAI_MODEL?.trim() || "gpt-4.1-mini";

interface GenerateOptions {
  product: ShopifyCurrentListingDocket;
  supplierMatch: {
    supplier: string | null;
    supplierSku: string | null;
    product: RocktomicSupplierProduct | null;
  };
  existing: ShopifyPdpIntelligenceRecord | null;
  openAiApiKey: string | null;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function toArray(values: string[]): string[] {
  return Array.from(new Set(values.map((entry) => entry.trim()).filter(Boolean)));
}

function toSafeDescription(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  return normalized.slice(0, 360);
}

function toFactsSummary(
  product: ShopifyCurrentListingDocket,
  supplier: RocktomicSupplierProduct | null
): string[] {
  const facts: string[] = [];
  facts.push(`Shopify title: ${product.title}`);
  if (product.vendor && product.vendor !== "Not available") facts.push(`Vendor: ${product.vendor}`);
  if (product.productType && product.productType !== "Not available") {
    facts.push(`Product type: ${product.productType}`);
  }
  if (product.descriptionText) facts.push(`Description excerpt: ${toSafeDescription(product.descriptionText)}`);
  if (product.tags.length) facts.push(`Shopify tags: ${product.tags.join(", ")}`);
  if (supplier) {
    facts.push(`Supplier: ${supplier.supplier}`);
    facts.push(`Supplier SKU: ${supplier.sku}`);
    if (supplier.certifications.length) facts.push(`Supplier certifications: ${supplier.certifications.join(", ")}`);
    if (supplier.dietaryAttributes.length) {
      facts.push(`Supplier dietary attributes: ${supplier.dietaryAttributes.join(", ")}`);
    }
    if (supplier.manufacturingClaims.length) {
      facts.push(`Supplier manufacturing claims: ${supplier.manufacturingClaims.join(", ")}`);
    }
    facts.push(`Supplier policy status: ${supplier.policyStatus}`);
    facts.push(`Supplier COA status: ${supplier.coa.status}`);
  }
  return facts;
}

function buildDeterministicGeneration(
  options: GenerateOptions,
  status: ShopifyPdpIntelligenceRecord["generation_status"],
  note: string
): ShopifyPdpIntelligenceRecord {
  const now = new Date().toISOString();
  const existing =
    options.existing ??
    createEmptyShopifyPdpIntelligenceRecord({
      shopifyProductId: options.product.productId,
      productHandle: options.product.handle || null,
      supplier: options.supplierMatch.supplier,
      supplierSku: options.supplierMatch.supplierSku,
    });
  const supplier = options.supplierMatch.product;

  const aiProductSummary = [
    `${options.product.title} is managed from Shopify product data and reviewed in EcomViper PDP intelligence.`,
    options.product.vendor && options.product.vendor !== "Not available"
      ? `Brand context: ${options.product.vendor}.`
      : "",
    supplier ? `Supplier context is matched by SKU (${supplier.sku}) from ${supplier.supplier}.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const next: ShopifyPdpIntelligenceRecord = {
    ...existing,
    shopify_product_id: options.product.productId,
    product_handle: options.product.handle || null,
    supplier: options.supplierMatch.supplier,
    supplier_sku: options.supplierMatch.supplierSku,
    ai_product_summary: aiProductSummary,
    best_for: toArray([
      ...(supplier?.dietaryAttributes ?? []).map((entry) => `${entry} shoppers`),
      options.product.productType && options.product.productType !== "Not available"
        ? `${options.product.productType} category shoppers`
        : "",
    ]),
    not_best_for: toArray([
      "Shoppers expecting disease-treatment claims",
      "Customers requiring personalized medical guidance",
    ]),
    use_cases: toArray([
      "Daily product-detail-page education",
      "Operator-reviewed marketplace-ready product storytelling",
    ]),
    ingredient_highlights: toArray([
      ...(supplier?.supplementFacts.value ? [supplier.supplementFacts.value] : []),
      ...(supplier?.manufacturingClaims ?? []),
    ]),
    trust_signals: toArray([
      `Source of truth: Shopify ${options.product.sourceLabel}`,
      ...(supplier?.certifications ?? []),
      ...(supplier?.manufacturingClaims ?? []),
    ]),
    certifications: toArray([...(supplier?.certifications ?? [])]),
    compliance_safe_claims: toArray([
      "Supports daily wellness goals when used as directed.",
      "Use compliant structure/function framing and avoid medical claims.",
    ]),
    comparison_content:
      "Comparison content must stay factual and avoid drug or disease-treatment comparisons.",
    agentic_selection_notes:
      "Generated from Shopify + supplier facts only. Human review is required before publishing.",
    faqs: sanitizeShopifyPdpFaqs(
      [
        {
          question: `What is ${options.product.title}?`,
          answer:
            "This product record is sourced from Shopify and enriched with supplier intelligence when SKU matches are available.",
          category: "product-overview",
          schema_eligible: true,
          compliance_status: "approved",
        },
        {
          question: "How are supplier facts validated?",
          answer:
            "Supplier facts are read from matched Rocktomic SKU intelligence and should be reviewed before public publishing.",
          category: "supplier-intelligence",
          schema_eligible: true,
          compliance_status: "review_required",
        },
      ],
      []
    ),
    compliance_notes: toArray([note]),
    generation_status: status,
    last_generated_at:
      status === "generated" || status === "generation_unavailable" ? now : existing.last_generated_at,
    updated_at: now,
  };

  const review = evaluateShopifyPdpCompliance(next);
  return {
    ...next,
    compliance_review: review,
    faqs: sanitizeShopifyPdpFaqs(next.faqs, review.risky_phrases_found),
  };
}

function stripCodeFences(input: string): string {
  return input.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
}

function parseOpenAiPayload(content: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(stripCodeFences(content)) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return null;
  }
  return null;
}

async function requestOpenAiGeneration(options: GenerateOptions): Promise<Record<string, unknown> | null> {
  if (!options.openAiApiKey) return null;

  const facts = toFactsSummary(options.product, options.supplierMatch.product);
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${options.openAiApiKey}`,
    },
    cache: "no-store",
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You produce compliant ecommerce supplement PDP intelligence JSON only. Never invent certifications, ingredients, COA availability, testing claims, or supplier facts. Use structure/function language and avoid disease/treatment/cure/prevent/drug-comparison claims.",
        },
        {
          role: "user",
          content: `Generate JSON with keys: ai_product_summary, best_for, not_best_for, use_cases, ingredient_highlights, trust_signals, certifications, compliance_safe_claims, comparison_content, agentic_selection_notes, faqs, compliance_notes. FAQ entries require question, answer, category, schema_eligible, compliance_status.\n\nFacts:\n${facts.join("\n")}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI generation failed with HTTP ${response.status}.`);
  }

  const body = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = asString(body.choices?.[0]?.message?.content);
  if (!content) return null;
  return parseOpenAiPayload(content);
}

export async function generateShopifyPdpIntelligence(
  options: GenerateOptions
): Promise<ShopifyPdpIntelligenceRecord> {
  if (!options.openAiApiKey) {
    return buildDeterministicGeneration(
      options,
      "generation_unavailable",
      "Generation unavailable: missing server configuration for Shopify OpenAI credentials."
    );
  }

  try {
    const payload = await requestOpenAiGeneration(options);
    if (!payload) {
      return buildDeterministicGeneration(
        options,
        "generated",
        "OpenAI returned no JSON content. Deterministic PDP intelligence template was applied."
      );
    }

    const existing =
      options.existing ??
      createEmptyShopifyPdpIntelligenceRecord({
        shopifyProductId: options.product.productId,
        productHandle: options.product.handle || null,
        supplier: options.supplierMatch.supplier,
        supplierSku: options.supplierMatch.supplierSku,
      });
    const now = new Date().toISOString();

    const merged = sanitizeShopifyPdpIntelligenceRecord(
      {
        ...existing,
        ...payload,
        shopify_product_id: options.product.productId,
        product_handle: options.product.handle || null,
        supplier: options.supplierMatch.supplier,
        supplier_sku: options.supplierMatch.supplierSku,
        generation_status: "generated",
        last_generated_at: now,
        updated_at: now,
      },
      existing
    );

    const review = evaluateShopifyPdpCompliance(merged);
    return {
      ...merged,
      compliance_review: review,
      faqs: sanitizeShopifyPdpFaqs(merged.faqs, review.risky_phrases_found),
      compliance_notes: toArray([
        ...merged.compliance_notes,
        "Generated with server-side OpenAI and compliance sanitization.",
      ]),
    };
  } catch (error) {
    return buildDeterministicGeneration(
      options,
      "failed",
      error instanceof Error
        ? `OpenAI generation failed: ${error.message}`
        : "OpenAI generation failed."
    );
  }
}
