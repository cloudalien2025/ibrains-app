export type ShopifyPdpGenerationStatus =
  | "not_started"
  | "generated"
  | "saved"
  | "generation_unavailable"
  | "failed";

export type ShopifyPdpComplianceRiskLevel = "low" | "medium" | "high";

export type ShopifyPdpFaqComplianceStatus = "approved" | "review_required" | "blocked";

export interface ShopifyPdpFaqEntry {
  question: string;
  answer: string;
  category: string;
  schema_eligible: boolean;
  compliance_status: ShopifyPdpFaqComplianceStatus;
}

export interface ShopifyPdpComplianceReview {
  risk_level: ShopifyPdpComplianceRiskLevel;
  risky_phrases_found: string[];
  safer_rewrite_notes: string[];
  supplement_compliance_notes: string[];
}

export interface ShopifyPdpIntelligenceRecord {
  product_intelligence_id: string;
  shopify_product_id: string;
  product_handle: string | null;
  supplier: string | null;
  supplier_sku: string | null;
  ai_product_summary: string;
  best_for: string[];
  not_best_for: string[];
  use_cases: string[];
  key_features: string[];
  highlights: string[];
  quick_facts: string[];
  ingredient_highlights: string[];
  supplement_facts: string;
  ingredients: string[];
  serving_size: string;
  servings_per_container: string;
  other_ingredients: string;
  source_diagnostics: string[];
  trust_signals: string[];
  certifications: string[];
  dietary_attributes: string[];
  manufacturing_claims: string[];
  warnings_text: string[];
  compliance_notes: string[];
  coa_status: string;
  coa_link: string;
  coa_expiration_date: string;
  coa_testing_categories: string[];
  coa_verification_status: string;
  price: number | null;
  compare_at_price: number | null;
  wholesale_cost: number | null;
  msrp: number | null;
  margin_percent: number | null;
  estimated_profit: number | null;
  currency: string;
  inventory_status: string;
  availability_status: string;
  ships_from: string;
  processing_time: string;
  shipping_time: string;
  return_policy: string;
  fulfillment_status: string;
  compliance_safe_claims: string[];
  comparison_content: string;
  faq: string[];
  buyer_intent_mapping: string[];
  entity_mapping: string[];
  semantic_coverage: string[];
  agentic_selection_notes: string;
  referral_readiness: string[];
  faqs: ShopifyPdpFaqEntry[];
  product_images: string[];
  supplement_facts_assets: string[];
  coa_assets: string[];
  label_assets: string[];
  mockup_assets: string[];
  seo_title: string;
  meta_description: string;
  product_schema: string;
  offer_schema: string;
  faq_schema: string;
  review_schema: string;
  agentic_schema_readiness: string;
  generation_status: ShopifyPdpGenerationStatus;
  last_generated_at: string | null;
  last_edited_at: string | null;
  updated_at: string;
  compliance_review: ShopifyPdpComplianceReview;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => asString(entry))
    .filter((entry) => entry.length > 0);
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function asBoolean(value: unknown): boolean {
  return value === true;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized) return null;
  const parsed = Number.parseFloat(normalized.replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function asIso(value: unknown): string | null {
  const raw = asString(value);
  if (!raw) return null;
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString();
}

function normalizeFaqCompliance(value: unknown): ShopifyPdpFaqComplianceStatus {
  const normalized = asString(value).toLowerCase();
  if (normalized === "approved" || normalized === "review_required" || normalized === "blocked") {
    return normalized;
  }
  return "review_required";
}

function normalizeRiskLevel(value: unknown): ShopifyPdpComplianceRiskLevel {
  const normalized = asString(value).toLowerCase();
  if (normalized === "low" || normalized === "medium" || normalized === "high") return normalized;
  return "medium";
}

function normalizeGenerationStatus(value: unknown): ShopifyPdpGenerationStatus {
  const normalized = asString(value).toLowerCase();
  if (
    normalized === "not_started" ||
    normalized === "generated" ||
    normalized === "saved" ||
    normalized === "generation_unavailable" ||
    normalized === "failed"
  ) {
    return normalized;
  }
  return "not_started";
}

function sanitizeFaqs(value: unknown): ShopifyPdpFaqEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => asObject(entry))
    .filter((entry): entry is Record<string, unknown> => entry !== null)
    .map((entry) => ({
      question: asString(entry.question),
      answer: asString(entry.answer),
      category: asString(entry.category),
      schema_eligible: asBoolean(entry.schema_eligible),
      compliance_status: normalizeFaqCompliance(entry.compliance_status),
    }))
    .filter((entry) => entry.question.length > 0 || entry.answer.length > 0);
}

export function createEmptyShopifyPdpIntelligenceRecord(input: {
  shopifyProductId: string;
  productHandle: string | null;
  supplier: string | null;
  supplierSku: string | null;
}): ShopifyPdpIntelligenceRecord {
  const now = new Date().toISOString();
  const uuid =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return {
    product_intelligence_id: uuid,
    shopify_product_id: asString(input.shopifyProductId),
    product_handle: asString(input.productHandle) || null,
    supplier: asString(input.supplier) || null,
    supplier_sku: asString(input.supplierSku) || null,
    ai_product_summary: "",
    best_for: [],
    not_best_for: [],
    use_cases: [],
    key_features: [],
    highlights: [],
    quick_facts: [],
    ingredient_highlights: [],
    supplement_facts: "",
    ingredients: [],
    serving_size: "",
    servings_per_container: "",
    other_ingredients: "",
    source_diagnostics: [],
    trust_signals: [],
    certifications: [],
    dietary_attributes: [],
    manufacturing_claims: [],
    warnings_text: [],
    compliance_notes: [],
    coa_status: "unknown",
    coa_link: "",
    coa_expiration_date: "",
    coa_testing_categories: [],
    coa_verification_status: "unknown",
    price: null,
    compare_at_price: null,
    wholesale_cost: null,
    msrp: null,
    margin_percent: null,
    estimated_profit: null,
    currency: "USD",
    inventory_status: "unknown",
    availability_status: "Availability Unknown",
    ships_from: "Unknown",
    processing_time: "Unknown",
    shipping_time: "Unknown",
    return_policy: "Unknown",
    fulfillment_status: "unknown",
    compliance_safe_claims: [],
    comparison_content: "",
    faq: [],
    buyer_intent_mapping: [],
    entity_mapping: [],
    semantic_coverage: [],
    agentic_selection_notes: "",
    referral_readiness: [],
    faqs: [],
    product_images: [],
    supplement_facts_assets: [],
    coa_assets: [],
    label_assets: [],
    mockup_assets: [],
    seo_title: "",
    meta_description: "",
    product_schema: "",
    offer_schema: "",
    faq_schema: "",
    review_schema: "",
    agentic_schema_readiness: "unknown",
    generation_status: "not_started",
    last_generated_at: null,
    last_edited_at: null,
    updated_at: now,
    compliance_review: {
      risk_level: "medium",
      risky_phrases_found: [],
      safer_rewrite_notes: [],
      supplement_compliance_notes: [],
    },
  };
}

export function sanitizeShopifyPdpIntelligenceRecord(
  payload: unknown,
  fallback: ShopifyPdpIntelligenceRecord
): ShopifyPdpIntelligenceRecord {
  const row = asObject(payload);
  if (!row) return fallback;

  const now = new Date().toISOString();
  const review = asObject(row.compliance_review);

  return {
    product_intelligence_id: asString(row.product_intelligence_id) || fallback.product_intelligence_id,
    shopify_product_id: asString(row.shopify_product_id) || fallback.shopify_product_id,
    product_handle: asString(row.product_handle) || fallback.product_handle,
    supplier: asString(row.supplier) || fallback.supplier,
    supplier_sku: asString(row.supplier_sku) || fallback.supplier_sku,
    ai_product_summary: asString(row.ai_product_summary),
    best_for: asStringArray(row.best_for),
    not_best_for: asStringArray(row.not_best_for),
    use_cases: asStringArray(row.use_cases),
    key_features: asStringArray(row.key_features),
    highlights: asStringArray(row.highlights),
    quick_facts: asStringArray(row.quick_facts),
    ingredient_highlights: asStringArray(row.ingredient_highlights),
    supplement_facts: asString(row.supplement_facts),
    ingredients: asStringArray(row.ingredients),
    serving_size: asString(row.serving_size),
    servings_per_container: asString(row.servings_per_container),
    other_ingredients: asString(row.other_ingredients),
    source_diagnostics: asStringArray(row.source_diagnostics),
    trust_signals: asStringArray(row.trust_signals),
    certifications: asStringArray(row.certifications),
    dietary_attributes: asStringArray(row.dietary_attributes),
    manufacturing_claims: asStringArray(row.manufacturing_claims),
    warnings_text: asStringArray(row.warnings_text),
    compliance_notes: asStringArray(row.compliance_notes),
    coa_status: asString(row.coa_status),
    coa_link: asString(row.coa_link),
    coa_expiration_date: asString(row.coa_expiration_date),
    coa_testing_categories: asStringArray(row.coa_testing_categories),
    coa_verification_status: asString(row.coa_verification_status),
    price: asNumber(row.price),
    compare_at_price: asNumber(row.compare_at_price),
    wholesale_cost: asNumber(row.wholesale_cost),
    msrp: asNumber(row.msrp),
    margin_percent: asNumber(row.margin_percent),
    estimated_profit: asNumber(row.estimated_profit),
    currency: asString(row.currency) || "USD",
    inventory_status: asString(row.inventory_status) || fallback.inventory_status,
    availability_status: asString(row.availability_status) || fallback.availability_status,
    ships_from: asString(row.ships_from) || fallback.ships_from,
    processing_time: asString(row.processing_time) || fallback.processing_time,
    shipping_time: asString(row.shipping_time) || fallback.shipping_time,
    return_policy: asString(row.return_policy) || fallback.return_policy,
    fulfillment_status: asString(row.fulfillment_status) || fallback.fulfillment_status,
    compliance_safe_claims: asStringArray(row.compliance_safe_claims),
    comparison_content: asString(row.comparison_content),
    faq: asStringArray(row.faq),
    buyer_intent_mapping: asStringArray(row.buyer_intent_mapping),
    entity_mapping: asStringArray(row.entity_mapping),
    semantic_coverage: asStringArray(row.semantic_coverage),
    agentic_selection_notes: asString(row.agentic_selection_notes),
    referral_readiness: asStringArray(row.referral_readiness),
    faqs: sanitizeFaqs(row.faqs),
    product_images: asStringArray(row.product_images),
    supplement_facts_assets: asStringArray(row.supplement_facts_assets),
    coa_assets: asStringArray(row.coa_assets),
    label_assets: asStringArray(row.label_assets),
    mockup_assets: asStringArray(row.mockup_assets),
    seo_title: asString(row.seo_title),
    meta_description: asString(row.meta_description),
    product_schema: asString(row.product_schema),
    offer_schema: asString(row.offer_schema),
    faq_schema: asString(row.faq_schema),
    review_schema: asString(row.review_schema),
    agentic_schema_readiness: asString(row.agentic_schema_readiness),
    generation_status: normalizeGenerationStatus(row.generation_status),
    last_generated_at: asIso(row.last_generated_at),
    last_edited_at: asIso(row.last_edited_at),
    updated_at: asIso(row.updated_at) || now,
    compliance_review: {
      risk_level: normalizeRiskLevel(review?.risk_level),
      risky_phrases_found: asStringArray(review?.risky_phrases_found),
      safer_rewrite_notes: asStringArray(review?.safer_rewrite_notes),
      supplement_compliance_notes: asStringArray(review?.supplement_compliance_notes),
    },
  };
}
