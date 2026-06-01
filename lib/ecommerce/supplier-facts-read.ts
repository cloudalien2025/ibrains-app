import "server-only";

import { queryEcommerce } from "@/lib/ecommerce/database";
import type {
  SupplierFactsPanelStatus,
  SupplierFactsPanelViewModel,
  SupplierFactsReadinessStatus,
} from "@/lib/ecommerce/supplier-facts-types";
import {
  findSupplierProductMatch,
  normalizeSupplierSku,
  type SupplierMatchCandidate,
  type SupplierMatchConfidence,
} from "@/lib/ecommerce/supplier-product-match";
import type { ShopifyProductRecord } from "@/lib/ecomviper/shopify/shopify-types";

interface SupplierCandidateRow {
  supplier_slug: string;
  supplier_name: string | null;
  sku: string;
  product_name: string | null;
  validation_status: string;
  product_readiness: unknown;
  source_facts: unknown;
  facts_supplement_facts: unknown;
  facts_directions: string | null;
  facts_warnings: string | null;
  facts_source_evidence: unknown;
  facts_needs_review: boolean | null;
  pricing_payload: unknown;
  pricing_tiers: unknown;
  pricing_currency: string | null;
  inventory_status: string | null;
  inventory_raw: string | null;
  inventory_comments: string | null;
  assets_coa_url: string | null;
  assets_label_template_ai_url: string | null;
  assets_mockup_template_tif_url: string | null;
  assets_readiness: unknown;
  assets_ai_label_text_evidence: unknown;
  validation_readiness: unknown;
  validation_blocking_defects: unknown;
  validation_warning_defects: unknown;
  validation_result: unknown;
  validation_needs_review: boolean | null;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asNullableString(value: unknown): string | null {
  const text = asString(value);
  return text || null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asStringArray(value: unknown): string[] {
  return asArray(value)
    .map((entry) => asString(entry))
    .filter(Boolean);
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeTitlePattern(value: string): string | null {
  const cleaned = value.replace(/[^a-zA-Z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
  if (cleaned.length < 5) return null;
  return `%${cleaned.replace(/\s+/g, "%")}%`;
}

function flattenDefectMessages(value: unknown): string[] {
  return asArray(value)
    .map((entry) => {
      if (typeof entry === "string") return entry.trim();
      if (entry && typeof entry === "object") {
        const object = entry as Record<string, unknown>;
        return asString(object.code || object.field || object.message) || JSON.stringify(object);
      }
      return "";
    })
    .filter(Boolean);
}

function isReadinessStatus(value: string | null): value is SupplierFactsReadinessStatus {
  return Boolean(
    value
      && ["ready", "ready_with_warnings", "blocked", "not_applicable", "needs_review", "unknown"].includes(value)
  );
}

function pickReadiness(
  readiness: Record<string, unknown>,
  keys: string[],
  fallback: SupplierFactsReadinessStatus = "unknown"
): SupplierFactsReadinessStatus {
  for (const key of keys) {
    const value = asString(readiness[key]);
    if (isReadinessStatus(value)) return value;
  }
  return fallback;
}

function buildCheckedIdentifiers(product: ShopifyProductRecord): SupplierFactsPanelViewModel["checkedIdentifiers"] {
  const skus = product.variants.map((variant) => asString(variant.sku)).filter(Boolean);
  const normalizedSkus = Array.from(new Set(skus.map((sku) => normalizeSupplierSku(sku)).filter(Boolean)));
  const barcodes = product.variants.map((variant) => asString(variant.barcode)).filter(Boolean);

  return {
    skus,
    normalizedSkus,
    barcodes,
    handle: asNullableString(product.handle),
    title: asNullableString(product.title),
  };
}

function defaultUnavailableState(product: ShopifyProductRecord, message: string): SupplierFactsPanelViewModel {
  const checkedIdentifiers = buildCheckedIdentifiers(product);
  return {
    status: "unavailable",
    supplierSlug: "rocktomic",
    message,
    checkedIdentifiers,
    matchStatus: "unavailable",
    matchConfidence: "no_match",
    matchReasons: [],
    supplierName: null,
    supplierSku: null,
    supplierProductName: null,
    validationStatus: null,
    readiness: {
      ingredientMatching: "unknown",
      productEditorFacts: "unknown",
      pricing: "unknown",
      inventory: "unknown",
      complianceEvidence: "unknown",
      optiPixelAssets: "unknown",
      channelImageGeneration: "unknown",
    },
    sourceFactsSummary: [],
    supplementFactsSummary: [],
    activeIngredients: [],
    ingredientAmounts: [],
    otherIngredients: [],
    servingSize: null,
    servingsPerContainer: null,
    directions: null,
    warnings: null,
    pricingSummary: {
      available: false,
      wholesaleCost: null,
      msrp: null,
      currency: null,
      statusLabel: "Supplier pricing unavailable",
    },
    inventorySummary: {
      available: false,
      status: null,
      raw: null,
      comments: null,
    },
    assetSummary: {
      coaPresent: false,
      coaUrl: null,
      labelTemplateAiPresent: false,
      mockupTemplateTifPresent: false,
      readyForOptiPixel: false,
    },
    evidence: {
      sourceMethod: null,
      aiLabelTextEvidenceStatus: "unavailable",
      needsReview: false,
      missingCoaWarning: false,
      topDefects: [],
    },
  };
}

const BASE_CANDIDATE_SQL = `
  SELECT
    sp.supplier_slug,
    s.supplier_name,
    sp.sku,
    sp.product_name,
    sp.validation_status,
    sp.readiness AS product_readiness,
    sp.source_facts,
    pf.supplement_facts AS facts_supplement_facts,
    pf.directions AS facts_directions,
    pf.warnings AS facts_warnings,
    pf.source_evidence AS facts_source_evidence,
    pf.needs_review AS facts_needs_review,
    pr.pricing AS pricing_payload,
    pr.tiers AS pricing_tiers,
    pr.currency AS pricing_currency,
    inv.inventory_status,
    inv.inventory_raw,
    inv.comments AS inventory_comments,
    a.coa_url AS assets_coa_url,
    a.label_template_ai_url AS assets_label_template_ai_url,
    a.mockup_template_tif_url AS assets_mockup_template_tif_url,
    a.asset_readiness AS assets_readiness,
    a.ai_label_text_evidence AS assets_ai_label_text_evidence,
    vr.readiness AS validation_readiness,
    vr.blocking_defects AS validation_blocking_defects,
    vr.warning_defects AS validation_warning_defects,
    vr.validation_result,
    vr.needs_review AS validation_needs_review
  FROM ecommerce_supplier_products sp
  INNER JOIN ecommerce_suppliers s ON s.id = sp.supplier_id
  LEFT JOIN ecommerce_supplier_product_facts pf ON pf.supplier_slug = sp.supplier_slug AND pf.sku = sp.sku
  LEFT JOIN ecommerce_supplier_pricing pr ON pr.supplier_slug = sp.supplier_slug AND pr.sku = sp.sku
  LEFT JOIN ecommerce_supplier_inventory inv ON inv.supplier_slug = sp.supplier_slug AND inv.sku = sp.sku
  LEFT JOIN ecommerce_supplier_assets a ON a.supplier_slug = sp.supplier_slug AND a.sku = sp.sku
  LEFT JOIN ecommerce_supplier_validation_results vr ON vr.supplier_slug = sp.supplier_slug AND vr.sku = sp.sku
`;

async function loadCandidates(product: ShopifyProductRecord, supplierSlug: string): Promise<SupplierCandidateRow[]> {
  const identifiers = buildCheckedIdentifiers(product);
  const normalizedSkus = identifiers.normalizedSkus;
  const bySku = normalizedSkus.length
    ? await queryEcommerce<SupplierCandidateRow>(
        `${BASE_CANDIDATE_SQL}
         WHERE sp.supplier_slug = $1
           AND regexp_replace(upper(sp.sku), '[^A-Z0-9]', '', 'g') = ANY($2::text[])
         ORDER BY sp.sku
         LIMIT 12`,
        [supplierSlug, normalizedSkus]
      )
    : [];

  const titlePatterns = [normalizeTitlePattern(asString(product.title)), normalizeTitlePattern(asString(product.handle))]
    .filter((pattern): pattern is string => Boolean(pattern));

  const byTitle = titlePatterns.length
    ? await queryEcommerce<SupplierCandidateRow>(
        `${BASE_CANDIDATE_SQL}
         WHERE sp.supplier_slug = $1
           AND sp.product_name ILIKE ANY($2::text[])
         ORDER BY sp.updated_at DESC
         LIMIT 24`,
        [supplierSlug, titlePatterns]
      )
    : [];

  const merged = new Map<string, SupplierCandidateRow>();
  for (const row of [...bySku, ...byTitle]) {
    const sku = normalizeSupplierSku(row.sku);
    if (!sku || merged.has(sku)) continue;
    merged.set(sku, row);
  }
  return Array.from(merged.values());
}

function toMatchCandidate(row: SupplierCandidateRow): SupplierMatchCandidate {
  const supplementFacts = asObject(row.facts_supplement_facts);
  return {
    supplierSlug: row.supplier_slug,
    supplierName: asNullableString(row.supplier_name),
    sku: asString(row.sku),
    productName: asNullableString(row.product_name),
    activeIngredients: asStringArray(supplementFacts.activeIngredients),
    supplementFactsText: asNullableString(supplementFacts.rawLabelText || supplementFacts.summary || supplementFacts.servingSize),
  };
}

function sourceFactsSummary(sourceFacts: Record<string, unknown>): string[] {
  const summary: string[] = [];
  const fields = ["productType", "category", "containerSize", "productWeight"];
  for (const field of fields) {
    const value = asString(sourceFacts[field]);
    if (value) {
      summary.push(`${field}: ${value}`);
    }
  }
  return summary;
}

function toAmountPerServingList(value: unknown): string[] {
  const direct = asStringArray(value);
  if (direct.length > 0) return direct;
  const text = asString(value);
  if (!text) return [];
  return text
    .split(/\n|,|;/g)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function supplementFactsSummary(supplementFacts: Record<string, unknown>): string[] {
  const summary: string[] = [];
  const servingSize = asString(supplementFacts.servingSize);
  const servingsPerContainer = asString(supplementFacts.servingsPerContainer);
  if (servingSize) summary.push(`Serving Size: ${servingSize}`);
  if (servingsPerContainer) summary.push(`Servings Per Container: ${servingsPerContainer}`);
  return summary;
}

function statusFromAvailability(available: boolean): SupplierFactsReadinessStatus {
  return available ? "ready" : "ready_with_warnings";
}

function buildMatchedState(product: ShopifyProductRecord, row: SupplierCandidateRow, match: ReturnType<typeof findSupplierProductMatch>): SupplierFactsPanelViewModel {
  const sourceFacts = asObject(row.source_facts);
  const supplementFacts = asObject(row.facts_supplement_facts);
  const pricing = asObject(row.pricing_payload);
  const assetReadiness = asObject(row.assets_readiness);
  const aiEvidence = asObject(row.assets_ai_label_text_evidence);
  const validationReadiness = asObject(row.validation_readiness);
  const productReadiness = asObject(row.product_readiness);
  const sourceEvidence = asObject(row.facts_source_evidence);
  const supplementEvidence = asObject(sourceEvidence.supplementFacts);
  const blockingDefects = flattenDefectMessages(row.validation_blocking_defects);
  const warningDefects = flattenDefectMessages(row.validation_warning_defects);

  const mergedReadiness = {
    ...productReadiness,
    ...validationReadiness,
  };

  const ingredientMatching = pickReadiness(mergedReadiness, ["ingredientMatchingReadiness", "ingredientMatching"]);
  const productEditorFacts = pickReadiness(mergedReadiness, ["productEditorFactsReadiness", "productEditorFacts"]);
  const complianceEvidence = pickReadiness(mergedReadiness, ["complianceEvidenceReadiness", "complianceEvidence"]);
  const optiPixelAssets = pickReadiness(mergedReadiness, ["optiPixelAssetReadiness", "optiPixelAssets"]);
  const channelImageGeneration = pickReadiness(mergedReadiness, ["channelImageGenerationReadiness", "channelImageGeneration"]);

  const activeIngredients = asStringArray(
    supplementFacts.activeIngredients || sourceFacts.activeIngredients || asObject(sourceFacts.supplementFacts).activeIngredients
  );
  const ingredientAmounts = toAmountPerServingList(
    supplementFacts.amountPerServing
    || sourceFacts.amountPerServing
    || asObject(sourceFacts.supplementFacts).amountPerServing
  );
  const otherIngredientsRaw =
    asStringArray(supplementFacts.otherIngredients).length > 0
      ? asStringArray(supplementFacts.otherIngredients)
      : asString(sourceFacts.otherIngredients)
          .split(",")
          .map((entry) => entry.trim())
          .filter(Boolean);

  const servingSize = asNullableString(supplementFacts.servingSize || sourceFacts.servingSize);
  const servingsPerContainer = asNullableString(supplementFacts.servingsPerContainer || sourceFacts.servingsPerContainer);

  const pricingAvailable = Object.keys(pricing).length > 0;
  const wholesaleCost = asNumber(pricing.wholesaleCost || pricing.cost || pricing.membershipCost);
  const msrp = asNumber(pricing.msrp);
  const pricingStatusLabel =
    asString(pricing.pricingStatusLabel)
    || (pricingAvailable ? "Pricing available" : "Pricing unavailable");

  const inventoryAvailable = Boolean(asString(row.inventory_status));
  const coaUrl = asNullableString(row.assets_coa_url);
  const labelTemplateAiUrl = asNullableString(row.assets_label_template_ai_url);
  const mockupTemplateTifUrl = asNullableString(row.assets_mockup_template_tif_url);
  const missingCoaWarning = warningDefects.some((defect) => /coa|missing_coa|assets\.coaurl/i.test(defect));
  const topDefects = [...blockingDefects, ...warningDefects].slice(0, 6);

  const message =
    match.matched
      ? "Validated supplier match found from shared ecommerce database."
      : "Possible supplier candidate found; review before treating as source truth.";

  return {
    status: match.matched ? "matched" : "candidate",
    supplierSlug: asString(row.supplier_slug) || "rocktomic",
    message,
    checkedIdentifiers: buildCheckedIdentifiers(product),
    matchStatus: match.matched ? "matched" : "candidate",
    matchConfidence: match.confidence,
    matchReasons: match.reasons,
    supplierName: asNullableString(row.supplier_name),
    supplierSku: asNullableString(row.sku),
    supplierProductName: asNullableString(row.product_name),
    validationStatus: asNullableString(row.validation_status),
    readiness: {
      ingredientMatching,
      productEditorFacts,
      pricing: statusFromAvailability(pricingAvailable),
      inventory: statusFromAvailability(inventoryAvailable),
      complianceEvidence,
      optiPixelAssets,
      channelImageGeneration,
    },
    sourceFactsSummary: sourceFactsSummary(sourceFacts),
    supplementFactsSummary: supplementFactsSummary(supplementFacts),
    activeIngredients,
    ingredientAmounts,
    otherIngredients: otherIngredientsRaw,
    servingSize,
    servingsPerContainer,
    directions: asNullableString(row.facts_directions || sourceFacts.directions),
    warnings: asNullableString(row.facts_warnings || sourceFacts.warnings),
    pricingSummary: {
      available: pricingAvailable,
      wholesaleCost,
      msrp,
      currency: asNullableString(row.pricing_currency || pricing.currency),
      statusLabel: pricingStatusLabel,
    },
    inventorySummary: {
      available: inventoryAvailable,
      status: asNullableString(row.inventory_status),
      raw: asNullableString(row.inventory_raw),
      comments: asNullableString(row.inventory_comments),
    },
    assetSummary: {
      coaPresent: Boolean(coaUrl),
      coaUrl,
      labelTemplateAiPresent: Boolean(labelTemplateAiUrl),
      mockupTemplateTifPresent: Boolean(mockupTemplateTifUrl),
      readyForOptiPixel:
        Boolean(assetReadiness.readyForOptiPixelAssets)
        || asString(assetReadiness.optiPixelAssetReadiness) === "ready"
        || (Boolean(labelTemplateAiUrl) && Boolean(mockupTemplateTifUrl)),
    },
    evidence: {
      sourceMethod: asNullableString(supplementEvidence.sourceMethod),
      aiLabelTextEvidenceStatus:
        asString(aiEvidence.extractionStatus)
        || (Object.keys(aiEvidence).length > 0 ? "available" : "unavailable"),
      needsReview:
        Boolean(row.facts_needs_review)
        || Boolean(row.validation_needs_review)
        || supplementEvidence.needsReview === true,
      missingCoaWarning,
      topDefects,
    },
  };
}

export async function readSupplierFactsForShopifyProduct(input: {
  product: ShopifyProductRecord;
  supplierSlug?: string;
}): Promise<SupplierFactsPanelViewModel> {
  const supplierSlug = asString(input.supplierSlug) || "rocktomic";

  if (!process.env.ECOMMERCE_DATABASE_URL?.trim()) {
    return defaultUnavailableState(input.product, "Supplier facts unavailable: ECOMMERCE_DATABASE_URL is not configured.");
  }

  try {
    const candidateRows = await loadCandidates(input.product, supplierSlug);
    if (!candidateRows.length) {
      const state = defaultUnavailableState(input.product, "No validated supplier match found.");
      return {
        ...state,
        status: "no_match",
        matchStatus: "no_match",
        message: "No validated supplier match found.",
      };
    }

    const match = findSupplierProductMatch({
      product: input.product,
      candidates: candidateRows.map((row) => toMatchCandidate(row)),
    });

    if (!match.candidate) {
      const state = defaultUnavailableState(input.product, "No validated supplier match found.");
      return {
        ...state,
        status: "no_match",
        matchStatus: "no_match",
        message: "No validated supplier match found.",
      };
    }

    const matchedRow = candidateRows.find(
      (row) => normalizeSupplierSku(row.sku) === normalizeSupplierSku(match.candidate?.sku)
    );

    if (!matchedRow) {
      const state = defaultUnavailableState(input.product, "No validated supplier match found.");
      return {
        ...state,
        status: "no_match",
        matchStatus: "no_match",
        message: "No validated supplier match found.",
      };
    }

    return buildMatchedState(input.product, matchedRow, match);
  } catch {
    return defaultUnavailableState(
      input.product,
      "Supplier facts unavailable right now. Product Editor remains usable without supplier facts."
    );
  }
}
