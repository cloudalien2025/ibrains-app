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
  ingredient_highlights: string[];
  trust_signals: string[];
  certifications: string[];
  compliance_safe_claims: string[];
  comparison_content: string;
  agentic_selection_notes: string;
  faqs: ShopifyPdpFaqEntry[];
  compliance_notes: string[];
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
    ingredient_highlights: [],
    trust_signals: [],
    certifications: [],
    compliance_safe_claims: [],
    comparison_content: "",
    agentic_selection_notes: "",
    faqs: [],
    compliance_notes: [],
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
    ingredient_highlights: asStringArray(row.ingredient_highlights),
    trust_signals: asStringArray(row.trust_signals),
    certifications: asStringArray(row.certifications),
    compliance_safe_claims: asStringArray(row.compliance_safe_claims),
    comparison_content: asString(row.comparison_content),
    agentic_selection_notes: asString(row.agentic_selection_notes),
    faqs: sanitizeFaqs(row.faqs),
    compliance_notes: asStringArray(row.compliance_notes),
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
