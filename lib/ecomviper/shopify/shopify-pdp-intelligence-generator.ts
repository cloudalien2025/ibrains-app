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
    inventoryAvailable?: boolean;
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

function sanitizePublicText(value: string): string {
  return value
    .replace(/\brocktomic\b/gi, "source")
    .replace(/\bsupplier matching\b/gi, "source mapping")
    .replace(/\bsupplier\b/gi, "source")
    .replace(/\bdropshipping\b/gi, "fulfillment")
    .replace(/\binternal\s+source\s+url(s)?\b/gi, "source")
    .trim();
}

function sanitizePublicList(values: string[]): string[] {
  return toArray(values.map((entry) => sanitizePublicText(entry)));
}

function toSafeDescription(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  return normalized.slice(0, 360);
}

function computeShopifyInventoryStatus(product: ShopifyCurrentListingDocket): "in_stock" | "low_stock" | "out_of_stock" | "unknown" {
  const quantities = product.variants
    .map((variant) => variant.inventoryQuantity)
    .filter((quantity): quantity is number => typeof quantity === "number" && Number.isFinite(quantity));

  if (!quantities.length) return "unknown";
  const inStockCount = quantities.filter((quantity) => quantity > 0).length;
  if (inStockCount === 0) return "out_of_stock";
  if (inStockCount === quantities.length) return "in_stock";
  return "low_stock";
}

function toAvailabilityStatus(status: string): string {
  if (status === "in_stock") return "Available";
  if (status === "low_stock") return "Limited Availability";
  if (status === "out_of_stock") return "Currently Unavailable";
  if (status === "source_unavailable") return "Inventory Status Unavailable";
  return "Availability Unknown";
}

function toGroundedIngredients(supplier: RocktomicSupplierProduct | null): string[] {
  if (!supplier?.supplementFacts.value) return ["Unknown"];
  const lines = supplier.supplementFacts.value
    .split(/\n|;|,/g)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 2);
  if (!lines.length) return [supplier.supplementFacts.value];
  return lines.slice(0, 12);
}

function formatMoney(value: number | null, currency = "USD"): string {
  if (value == null || !Number.isFinite(value)) return "Unknown";
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
}

function buildGroundedRecord(
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
  const shopifyPrice = options.product.variants.find((variant) => variant.price != null)?.price ?? null;
  const compareAtPrice = options.product.variants.find((variant) => variant.compareAtPrice != null)?.compareAtPrice ?? null;

  const inventoryStatus = supplier?.inventoryStatus && supplier.inventoryStatus !== "unknown"
    ? supplier.inventoryStatus
    : options.supplierMatch.inventoryAvailable
      ? computeShopifyInventoryStatus(options.product)
      : "source_unavailable";

  const wholesaleCost = supplier?.pricing?.wholesaleCost ?? null;
  const msrp = supplier?.pricing?.msrp ?? null;
  const estimatedProfit = supplier?.pricing?.estimatedProfit ?? (shopifyPrice != null && wholesaleCost != null ? shopifyPrice - wholesaleCost : null);
  const marginPercent = supplier?.pricing?.marginPercent ?? (shopifyPrice != null && wholesaleCost != null && shopifyPrice > 0
    ? Number((((shopifyPrice - wholesaleCost) / shopifyPrice) * 100).toFixed(2))
    : null);

  const groundedIngredients = toGroundedIngredients(supplier);
  const certifications = supplier?.certifications?.length ? supplier.certifications : ["Unknown"];
  const dietaryAttributes = supplier?.dietaryAttributes?.length ? supplier.dietaryAttributes : ["Unknown"];
  const manufacturingClaims = supplier?.manufacturingClaims?.length ? supplier.manufacturingClaims : ["Unknown"];
  const warningsText = supplier?.warnings?.value ? [supplier.warnings.value] : ["Unknown"];
  const coaStatus = supplier?.coa?.status || "unknown";
  const coaLink = supplier?.coa?.url || "";

  const next: ShopifyPdpIntelligenceRecord = {
    ...existing,
    shopify_product_id: options.product.productId,
    product_handle: options.product.handle || null,
    supplier: options.supplierMatch.supplier,
    supplier_sku: options.supplierMatch.supplierSku,
    ai_product_summary: sanitizePublicText(
      `${options.product.title} is managed from verified listing facts and source-backed product intelligence. ${options.product.vendor && options.product.vendor !== "Not available" ? `Brand: ${options.product.vendor}.` : ""}`
    ),
    best_for: sanitizePublicList([
      ...(dietaryAttributes[0] !== "Unknown" ? dietaryAttributes.map((entry) => `${entry} shoppers`) : []),
      options.product.productType && options.product.productType !== "Not available"
        ? `${options.product.productType} category shoppers`
        : "",
    ]),
    not_best_for: sanitizePublicList([
      "Customers expecting disease-treatment claims",
      "Customers requiring personalized medical advice",
    ]),
    use_cases: sanitizePublicList([
      "Daily product-detail-page education",
      "Operator-reviewed marketplace publishing",
    ]),
    key_features: sanitizePublicList(supplier?.productFeatures?.length ? supplier.productFeatures : ["Unknown"]),
    highlights: sanitizePublicList([
      ...(supplier?.ingredientHighlights?.length ? supplier.ingredientHighlights : []),
      ...(manufacturingClaims[0] !== "Unknown" ? manufacturingClaims : []),
    ]),
    quick_facts: sanitizePublicList([
      `Container Size: ${supplier?.containerSize || "Unknown"}`,
      `Serving Size: ${supplier?.servingSize || "Unknown"}`,
      `Servings Per Container: ${supplier?.servingsPerContainer || "Unknown"}`,
      `Product Weight: ${supplier?.productWeight || "Unknown"}`,
    ]),
    ingredient_highlights: sanitizePublicList(groundedIngredients),
    supplement_facts: sanitizePublicText(supplier?.supplementFacts?.value || "Unknown"),
    ingredients: sanitizePublicList(groundedIngredients),
    serving_size: sanitizePublicText(supplier?.servingSize || "Unknown"),
    servings_per_container: sanitizePublicText(supplier?.servingsPerContainer || "Unknown"),
    other_ingredients: sanitizePublicText(supplier?.otherIngredients || "Unknown"),
    source_diagnostics: [
      options.supplierMatch.supplierSku ? `Matched SKU: ${options.supplierMatch.supplierSku}` : "Matched SKU: Unknown",
      `Inventory source: ${options.supplierMatch.inventoryAvailable ? "Available" : "Unavailable"}`,
      `Catalog mapping: ${supplier ? "Mapped" : "Not mapped"}`,
    ],
    trust_signals: sanitizePublicList([
      ...certifications,
      ...(coaStatus && coaStatus !== "unknown" ? [`COA status: ${coaStatus}`] : []),
      ...(manufacturingClaims[0] !== "Unknown" ? manufacturingClaims : []),
    ]),
    certifications: sanitizePublicList(certifications),
    dietary_attributes: sanitizePublicList(dietaryAttributes),
    manufacturing_claims: sanitizePublicList(manufacturingClaims),
    warnings_text: sanitizePublicList(warningsText),
    compliance_notes: [note],
    coa_status: sanitizePublicText(coaStatus || "unknown"),
    coa_link: coaLink,
    coa_expiration_date: supplier?.coa?.expiresAt || "",
    coa_testing_categories: sanitizePublicList(supplier?.coa?.testingCategories || []),
    coa_verification_status: sanitizePublicText(supplier?.coa?.verificationStatus || "unknown"),
    price: shopifyPrice,
    compare_at_price: compareAtPrice,
    wholesale_cost: wholesaleCost,
    msrp,
    margin_percent: marginPercent,
    estimated_profit: estimatedProfit,
    currency: supplier?.pricing?.currency || "USD",
    inventory_status: inventoryStatus,
    availability_status: toAvailabilityStatus(inventoryStatus),
    ships_from: sanitizePublicText(supplier?.shipping?.shipsFrom || "Unknown"),
    processing_time: sanitizePublicText(supplier?.shipping?.processingTime || "Unknown"),
    shipping_time: sanitizePublicText(supplier?.shipping?.shippingTime || "Unknown"),
    return_policy: sanitizePublicText(supplier?.shipping?.returnPolicy || "Unknown"),
    fulfillment_status: sanitizePublicText(supplier?.shipping?.fulfillmentStatus || "unknown"),
    compliance_safe_claims: sanitizePublicList([
      "Supports daily wellness goals when used as directed.",
      "Use structure/function language and avoid disease claims.",
    ]),
    comparison_content: sanitizePublicText(
      "Comparison content must remain factual and avoid disease-treatment or drug-comparison language."
    ),
    faq: sanitizePublicList([
      "What does this product include?",
      "How should shoppers verify ingredient fit?",
      "What is the current availability status?",
    ]),
    buyer_intent_mapping: sanitizePublicList([
      "Wellness maintenance intent",
      "Ingredient transparency intent",
      "Availability certainty intent",
    ]),
    entity_mapping: sanitizePublicList([
      options.product.title,
      ...(certifications[0] !== "Unknown" ? certifications : []),
      ...(dietaryAttributes[0] !== "Unknown" ? dietaryAttributes : []),
    ]),
    semantic_coverage: sanitizePublicList([
      "Ingredients",
      "Supplement facts",
      "Certifications",
      "Pricing",
      "Availability",
      "Shipping",
      "Returns",
      "COA",
    ]),
    agentic_selection_notes: sanitizePublicText(
      "Generated from verified listing facts and source-backed mappings. Human review is required before publishing."
    ),
    referral_readiness: sanitizePublicList([
      "Schema requires review",
      "Claims require compliance check",
      "COA link should be validated before publish",
    ]),
    faqs: sanitizeShopifyPdpFaqs(
      [
        {
          question: "What is this product designed for?",
          answer: "It is positioned for daily wellness support based on verified listing facts.",
          category: "product-overview",
          schema_eligible: true,
          compliance_status: "approved",
        },
        {
          question: "Is ingredient information available?",
          answer: supplier?.supplementFacts?.value
            ? "Yes. Ingredient and supplement facts are mapped from source-backed data and should be reviewed before publishing."
            : "Ingredient details are currently unavailable from configured source data.",
          category: "ingredients",
          schema_eligible: true,
          compliance_status: "review_required",
        },
      ],
      []
    ),
    product_images: options.product.images.map((image) => image.url),
    supplement_facts_assets: supplier?.supplementFacts?.value ? ["Supplement Facts available in mapped source data"] : [],
    coa_assets: coaLink ? [coaLink] : [],
    label_assets: supplier?.labelTemplate?.url ? [supplier.labelTemplate.url] : [],
    mockup_assets: supplier?.mockup?.url ? [supplier.mockup.url] : [],
    seo_title: sanitizePublicText(options.product.seoTitle || options.product.title),
    meta_description: sanitizePublicText(options.product.seoDescription || toSafeDescription(options.product.descriptionText)),
    product_schema: "pending_review",
    offer_schema: "pending_review",
    faq_schema: "pending_review",
    review_schema: "pending_review",
    agentic_schema_readiness: "review_required",
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

  const supplier = options.supplierMatch.product;
  const facts = [
    `Shopify title: ${options.product.title}`,
    options.product.vendor && options.product.vendor !== "Not available" ? `Vendor: ${options.product.vendor}` : "",
    options.product.productType && options.product.productType !== "Not available" ? `Product type: ${options.product.productType}` : "",
    options.product.descriptionText ? `Description excerpt: ${toSafeDescription(options.product.descriptionText)}` : "",
    options.supplierMatch.supplierSku ? `Matched SKU: ${options.supplierMatch.supplierSku}` : "",
    supplier?.containerSize ? `Container size: ${supplier.containerSize}` : "",
    supplier?.servingSize ? `Serving size: ${supplier.servingSize}` : "",
    supplier?.supplementFacts?.value ? `Supplement facts: ${supplier.supplementFacts.value}` : "",
    supplier?.certifications?.length ? `Certifications: ${supplier.certifications.join(", ")}` : "",
    supplier?.dietaryAttributes?.length ? `Dietary attributes: ${supplier.dietaryAttributes.join(", ")}` : "",
    supplier?.manufacturingClaims?.length ? `Manufacturing claims: ${supplier.manufacturingClaims.join(", ")}` : "",
  ].filter(Boolean);

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
            "You generate shopper-facing ecommerce JSON copy only. Never mention internal suppliers, supplier matching, platform source names, or source URLs. Never invent ingredients, certifications, testing claims, inventory claims, pricing claims, or compliance claims.",
        },
        {
          role: "user",
          content:
            "Return JSON keys only: ai_product_summary, best_for, not_best_for, use_cases, key_features, highlights, faq, buyer_intent_mapping, entity_mapping, semantic_coverage, agentic_selection_notes, referral_readiness, faqs, compliance_notes. Keep all claims grounded to provided facts.\n\nFacts:\n" +
            facts.join("\n"),
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
    return buildGroundedRecord(
      options,
      "generation_unavailable",
      "Generation unavailable: missing server configuration for Shopify OpenAI credentials."
    );
  }

  try {
    const payload = await requestOpenAiGeneration(options);
    if (!payload) {
      return buildGroundedRecord(
        options,
        "generated",
        "OpenAI returned no JSON content. Source-grounded fallback template was applied."
      );
    }

    const grounded = buildGroundedRecord(
      options,
      "generated",
      "Generated with server-side OpenAI and source-grounded sanitization."
    );

    const merged = sanitizeShopifyPdpIntelligenceRecord(
      {
        ...grounded,
        ...payload,
        ai_product_summary: sanitizePublicText(asString(payload.ai_product_summary) || grounded.ai_product_summary),
        best_for: sanitizePublicList(Array.isArray(payload.best_for) ? (payload.best_for as string[]) : grounded.best_for),
        not_best_for: sanitizePublicList(Array.isArray(payload.not_best_for) ? (payload.not_best_for as string[]) : grounded.not_best_for),
        use_cases: sanitizePublicList(Array.isArray(payload.use_cases) ? (payload.use_cases as string[]) : grounded.use_cases),
        key_features: sanitizePublicList(Array.isArray(payload.key_features) ? (payload.key_features as string[]) : grounded.key_features),
        highlights: sanitizePublicList(Array.isArray(payload.highlights) ? (payload.highlights as string[]) : grounded.highlights),
        faq: sanitizePublicList(Array.isArray(payload.faq) ? (payload.faq as string[]) : grounded.faq),
        buyer_intent_mapping: sanitizePublicList(
          Array.isArray(payload.buyer_intent_mapping) ? (payload.buyer_intent_mapping as string[]) : grounded.buyer_intent_mapping
        ),
        entity_mapping: sanitizePublicList(
          Array.isArray(payload.entity_mapping) ? (payload.entity_mapping as string[]) : grounded.entity_mapping
        ),
        semantic_coverage: sanitizePublicList(
          Array.isArray(payload.semantic_coverage) ? (payload.semantic_coverage as string[]) : grounded.semantic_coverage
        ),
        agentic_selection_notes: sanitizePublicText(
          asString(payload.agentic_selection_notes) || grounded.agentic_selection_notes
        ),
        referral_readiness: sanitizePublicList(
          Array.isArray(payload.referral_readiness) ? (payload.referral_readiness as string[]) : grounded.referral_readiness
        ),
        // Force source-grounded fields so they cannot be invented by model output.
        ingredients: grounded.ingredients,
        ingredient_highlights: grounded.ingredient_highlights,
        certifications: grounded.certifications,
        dietary_attributes: grounded.dietary_attributes,
        manufacturing_claims: grounded.manufacturing_claims,
        trust_signals: grounded.trust_signals,
        inventory_status: grounded.inventory_status,
        availability_status: grounded.availability_status,
        price: grounded.price,
        compare_at_price: grounded.compare_at_price,
        wholesale_cost: grounded.wholesale_cost,
        msrp: grounded.msrp,
        margin_percent: grounded.margin_percent,
        estimated_profit: grounded.estimated_profit,
        coa_status: grounded.coa_status,
        coa_link: grounded.coa_link,
        coa_expiration_date: grounded.coa_expiration_date,
        coa_testing_categories: grounded.coa_testing_categories,
        coa_verification_status: grounded.coa_verification_status,
      },
      grounded
    );

    const review = evaluateShopifyPdpCompliance(merged);
    return {
      ...merged,
      compliance_review: review,
      faqs: sanitizeShopifyPdpFaqs(merged.faqs, review.risky_phrases_found),
      compliance_notes: toArray([
        ...merged.compliance_notes,
        "Generated with server-side OpenAI and source-grounded sanitization.",
      ]),
    };
  } catch (error) {
    return buildGroundedRecord(
      options,
      "failed",
      error instanceof Error
        ? `OpenAI generation failed: ${error.message}`
        : "OpenAI generation failed."
    );
  }
}
