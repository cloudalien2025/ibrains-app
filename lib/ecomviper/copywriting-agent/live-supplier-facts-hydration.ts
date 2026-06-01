import fs from "node:fs/promises";
import path from "node:path";
import { queryEcommerce } from "@/lib/ecommerce/database";
import type { SupplierFactsPanelViewModel } from "@/lib/ecommerce/supplier-facts-types";
import type { ShopifyProductEditorInitialState } from "@/lib/ecomviper/shopify/shopify-product-editor-state";

type SupplierFactsReadSource = "db" | "artifact" | "none" | "failed";

interface HydratedFactsPayload {
  supplierSku: string;
  supplierProductName: string | null;
  activeIngredients: string[];
  ingredientAmounts: string[];
  otherIngredients: string[];
  servingSize: string | null;
  servingsPerContainer: string | null;
  directions: string | null;
  warnings: string | null;
  coaUrl: string | null;
  labelTemplateAiPresent: boolean;
  mockupTemplateTifPresent: boolean;
  aiLabelTextEvidenceStatus: string;
  sourceMethod: string | null;
  needsReview: boolean;
  source: "db" | "artifact";
}

interface SupplierFactsHydrationResult {
  state: ShopifyProductEditorInitialState;
  supplierFactsReadSource: SupplierFactsReadSource;
  supplierFactsReadFound: boolean;
  supplierFactsReadErrorCode: string | null;
}

interface DbFactsRow {
  sku: string;
  product_name: string | null;
  source_facts: unknown;
  supplement_facts: unknown;
  source_evidence: unknown;
  coa_url: string | null;
  label_template_ai_url: string | null;
  mockup_template_tif_url: string | null;
  ai_label_text_evidence: unknown;
}

interface ArtifactSourceFactRow {
  sku: string;
  productName?: string | null;
  supplementFacts?: unknown;
  sourceEvidence?: unknown;
}

interface ArtifactAssetsRow {
  sku: string;
  coaUrl?: string | null;
  labelTemplateAiUrl?: string | null;
  mockupTemplateTifUrl?: string | null;
  aiLabelTextEvidence?: unknown;
}

interface ArtifactAiLabelRow {
  sku: string;
  extractionStatus?: string | null;
  needsReview?: boolean | null;
  parsedFacts?: unknown;
}

interface ArtifactCache {
  sourceFactsBySku: Map<string, ArtifactSourceFactRow>;
  assetsBySku: Map<string, ArtifactAssetsRow>;
  aiLabelBySku: Map<string, ArtifactAiLabelRow>;
}

let artifactCachePromise: Promise<ArtifactCache> | null = null;

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asNullableString(value: unknown): string | null {
  const text = asString(value);
  return text || null;
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function toStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((entry) => asString(entry)).filter(Boolean);
  }
  const text = asString(value);
  if (!text) return [];
  return text
    .split(/\n|,|;/g)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizeSku(value: unknown): string {
  return asString(value).toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function dedupe(values: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(
      values
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean)
    )
  );
}

function panelHasStructuredFacts(panel: SupplierFactsPanelViewModel | null | undefined): boolean {
  if (!panel) return false;
  return Boolean(
    panel.servingSize
    || panel.servingsPerContainer
    || panel.activeIngredients.length > 0
    || panel.ingredientAmounts.length > 0
  );
}

function stateHasStructuredFacts(state: ShopifyProductEditorInitialState): boolean {
  const sourceFacts = state.sourceFacts;
  const supplier = state.supplierContext?.product;
  return Boolean(
    panelHasStructuredFacts(state.supplierFactsPanel)
    || sourceFacts?.servingSize?.value
    || sourceFacts?.servingsPerContainer?.value
    || (sourceFacts?.activeIngredients?.values?.length || 0) > 0
    || Boolean(sourceFacts?.amountPerServing?.value)
    || supplier?.servingSize
    || supplier?.servingsPerContainer
    || (supplier?.activeIngredients?.length || 0) > 0
    || supplier?.amountPerServing
  );
}

function normalizedSkuCandidates(state: ShopifyProductEditorInitialState): string[] {
  const variants = state.currentShopifyListing?.variants || [];
  const skus = [
    state.supplierFactsPanel?.supplierSku,
    state.supplierContext?.matchedSku,
    ...variants.map((variant) => variant.sku),
  ];
  return dedupe(skus.map((entry) => normalizeSku(entry)).filter(Boolean));
}

function readSupplementFactsShape(input: unknown): {
  servingSize: string | null;
  servingsPerContainer: string | null;
  activeIngredients: string[];
  amountPerServing: string[];
  otherIngredients: string[];
  directions: string | null;
  warnings: string | null;
} {
  const root = asObject(input);
  const nested = asObject(root.supplementFacts);
  return {
    servingSize: asNullableString(root.servingSize ?? root.serving_size ?? nested.servingSize ?? nested.serving_size),
    servingsPerContainer: asNullableString(
      root.servingsPerContainer ?? root.servings_per_container ?? nested.servingsPerContainer ?? nested.servings_per_container
    ),
    activeIngredients: dedupe([
      ...toStringList(root.activeIngredients),
      ...toStringList(root.active_ingredients),
      ...toStringList(nested.activeIngredients),
      ...toStringList(nested.active_ingredients),
    ]),
    amountPerServing: dedupe([
      ...toStringList(root.amountPerServing),
      ...toStringList(root.amount_per_serving),
      ...toStringList(nested.amountPerServing),
      ...toStringList(nested.amount_per_serving),
    ]),
    otherIngredients: dedupe([
      ...toStringList(root.otherIngredients),
      ...toStringList(root.other_ingredients),
      ...toStringList(nested.otherIngredients),
      ...toStringList(nested.other_ingredients),
    ]),
    directions: asNullableString(root.directions ?? nested.directions),
    warnings: asNullableString(root.warnings ?? nested.warnings),
  };
}

async function readDbHydratedFactsBySkus(skus: string[]): Promise<HydratedFactsPayload | null> {
  if (!process.env.ECOMMERCE_DATABASE_URL?.trim() || skus.length === 0) return null;

  const rows = await queryEcommerce<DbFactsRow>(
    `SELECT
       sp.sku,
       sp.product_name,
       sp.source_facts,
       pf.supplement_facts,
       pf.source_evidence,
       a.coa_url,
       a.label_template_ai_url,
       a.mockup_template_tif_url,
       a.ai_label_text_evidence
     FROM ecommerce_supplier_products sp
     LEFT JOIN ecommerce_supplier_product_facts pf ON pf.supplier_slug = sp.supplier_slug AND pf.sku = sp.sku
     LEFT JOIN ecommerce_supplier_assets a ON a.supplier_slug = sp.supplier_slug AND a.sku = sp.sku
     WHERE sp.supplier_slug = $1
       AND regexp_replace(upper(sp.sku), '[^A-Z0-9]', '', 'g') = ANY($2::text[])
     LIMIT 12`,
    ["rocktomic", skus]
  );
  if (!rows.length) return null;

  const ranked = rows
    .map((row) => ({ row, normalized: normalizeSku(row.sku) }))
    .sort((left, right) => skus.indexOf(left.normalized) - skus.indexOf(right.normalized));
  const selected = ranked[0]?.row;
  if (!selected) return null;

  const sourceFacts = readSupplementFactsShape(selected.source_facts);
  const supplementFacts = readSupplementFactsShape(selected.supplement_facts);
  const sourceEvidence = asObject(selected.source_evidence);
  const supplementEvidence = asObject(sourceEvidence.supplementFacts);
  const aiLabelTextEvidence = asObject(selected.ai_label_text_evidence);

  return {
    supplierSku: asString(selected.sku),
    supplierProductName: asNullableString(selected.product_name),
    activeIngredients: dedupe([...supplementFacts.activeIngredients, ...sourceFacts.activeIngredients]),
    ingredientAmounts: dedupe([...supplementFacts.amountPerServing, ...sourceFacts.amountPerServing]),
    otherIngredients: dedupe([...supplementFacts.otherIngredients, ...sourceFacts.otherIngredients]),
    servingSize: supplementFacts.servingSize || sourceFacts.servingSize,
    servingsPerContainer: supplementFacts.servingsPerContainer || sourceFacts.servingsPerContainer,
    directions: supplementFacts.directions || sourceFacts.directions,
    warnings: supplementFacts.warnings || sourceFacts.warnings,
    coaUrl: asNullableString(selected.coa_url),
    labelTemplateAiPresent: Boolean(asString(selected.label_template_ai_url)),
    mockupTemplateTifPresent: Boolean(asString(selected.mockup_template_tif_url)),
    aiLabelTextEvidenceStatus:
      asString(aiLabelTextEvidence.extractionStatus)
      || asString(aiLabelTextEvidence.status)
      || "unavailable",
    sourceMethod: asNullableString(supplementEvidence.sourceMethod),
    needsReview: Boolean(supplementEvidence.needsReview),
    source: "db",
  };
}

async function loadArtifactCache(): Promise<ArtifactCache> {
  if (artifactCachePromise) return artifactCachePromise;
  artifactCachePromise = (async () => {
    const latestDir = path.join(process.cwd(), "data/ecomviper/suppliers/rocktomic/latest");
    const [sourceFacts, assets, aiLabelWrapper] = await Promise.all([
      fs.readFile(path.join(latestDir, "sourceFacts.json"), "utf8").then((raw) => JSON.parse(raw) as ArtifactSourceFactRow[]),
      fs.readFile(path.join(latestDir, "assets.json"), "utf8").then((raw) => JSON.parse(raw) as ArtifactAssetsRow[]),
      fs.readFile(path.join(latestDir, "ai-label-text-evidence.json"), "utf8")
        .then((raw) => JSON.parse(raw) as { records?: ArtifactAiLabelRow[] })
        .catch(() => ({ records: [] })),
    ]);

    return {
      sourceFactsBySku: new Map(sourceFacts.map((row) => [normalizeSku(row.sku), row])),
      assetsBySku: new Map(assets.map((row) => [normalizeSku(row.sku), row])),
      aiLabelBySku: new Map((aiLabelWrapper.records || []).map((row) => [normalizeSku(row.sku), row])),
    };
  })();
  return artifactCachePromise;
}

async function readArtifactHydratedFactsBySkus(skus: string[]): Promise<HydratedFactsPayload | null> {
  if (skus.length === 0) return null;
  const cache = await loadArtifactCache();
  const selectedSku = skus.find((sku) => cache.sourceFactsBySku.has(sku) || cache.assetsBySku.has(sku) || cache.aiLabelBySku.has(sku));
  if (!selectedSku) return null;

  const sourceFactRow = cache.sourceFactsBySku.get(selectedSku);
  const assetsRow = cache.assetsBySku.get(selectedSku);
  const aiLabelRow = cache.aiLabelBySku.get(selectedSku);
  const sourceFacts = readSupplementFactsShape(sourceFactRow?.supplementFacts);
  const aiParsedFacts = readSupplementFactsShape(aiLabelRow?.parsedFacts);
  const sourceEvidence = asObject(sourceFactRow?.sourceEvidence);
  const supplementEvidence = asObject(sourceEvidence.supplementFacts);
  const aiEvidence = asObject(assetsRow?.aiLabelTextEvidence);

  const mergedActiveIngredients = dedupe([...sourceFacts.activeIngredients, ...aiParsedFacts.activeIngredients]);
  const mergedIngredientAmounts = dedupe([...sourceFacts.amountPerServing, ...aiParsedFacts.amountPerServing]);
  const mergedOtherIngredients = dedupe([...sourceFacts.otherIngredients, ...aiParsedFacts.otherIngredients]);

  if (
    !sourceFacts.servingSize
    && !sourceFacts.servingsPerContainer
    && mergedActiveIngredients.length === 0
    && mergedIngredientAmounts.length === 0
    && !assetsRow?.labelTemplateAiUrl
    && !assetsRow?.mockupTemplateTifUrl
  ) {
    return null;
  }

  return {
    supplierSku: selectedSku,
    supplierProductName: asNullableString(sourceFactRow?.productName),
    activeIngredients: mergedActiveIngredients,
    ingredientAmounts: mergedIngredientAmounts,
    otherIngredients: mergedOtherIngredients,
    servingSize: sourceFacts.servingSize || aiParsedFacts.servingSize,
    servingsPerContainer: sourceFacts.servingsPerContainer || aiParsedFacts.servingsPerContainer,
    directions: sourceFacts.directions || aiParsedFacts.directions,
    warnings: sourceFacts.warnings || aiParsedFacts.warnings,
    coaUrl: asNullableString(assetsRow?.coaUrl),
    labelTemplateAiPresent: Boolean(asString(assetsRow?.labelTemplateAiUrl)),
    mockupTemplateTifPresent: Boolean(asString(assetsRow?.mockupTemplateTifUrl)),
    aiLabelTextEvidenceStatus:
      asString(aiLabelRow?.extractionStatus)
      || asString(aiEvidence.extractionStatus)
      || "unavailable",
    sourceMethod: asNullableString(supplementEvidence.sourceMethod) || "artifact",
    needsReview: Boolean(aiLabelRow?.needsReview ?? supplementEvidence.needsReview),
    source: "artifact",
  };
}

function mergeHydratedFactsIntoPanel(
  state: ShopifyProductEditorInitialState,
  payload: HydratedFactsPayload
): SupplierFactsPanelViewModel {
  const variants = state.currentShopifyListing?.variants || [];
  const firstSku = variants.find((variant) => asString(variant.sku))?.sku || null;
  const existing = state.supplierFactsPanel;

  const base: SupplierFactsPanelViewModel = existing || {
    status: "matched",
    supplierSlug: "rocktomic",
    message: payload.source === "db"
      ? "Validated supplier match found from shared ecommerce database."
      : "Supplier facts rehydrated from source artifacts.",
    checkedIdentifiers: {
      skus: variants.map((variant) => asString(variant.sku)).filter(Boolean),
      normalizedSkus: variants.map((variant) => normalizeSku(variant.sku)).filter(Boolean),
      barcodes: variants.map((variant) => asString(variant.barcode)).filter(Boolean),
      handle: state.currentShopifyListing?.handle || null,
      title: state.currentShopifyListing?.title || null,
    },
    matchStatus: "matched",
    matchConfidence: "exact_sku",
    matchReasons: ["exact SKU match"],
    supplierName: "Rocktomic",
    supplierSku: firstSku,
    supplierProductName: null,
    validationStatus: null,
    readiness: {
      ingredientMatching: "ready_with_warnings",
      productEditorFacts: "ready_with_warnings",
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
      currency: "USD",
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

  const activeIngredients = dedupe([...base.activeIngredients, ...payload.activeIngredients]);
  const ingredientAmounts = dedupe([...base.ingredientAmounts, ...payload.ingredientAmounts]);
  const otherIngredients = dedupe([...base.otherIngredients, ...payload.otherIngredients]);

  return {
    ...base,
    status: "matched",
    matchStatus: "matched",
    matchConfidence: base.matchConfidence === "no_match" ? "exact_sku" : base.matchConfidence,
    supplierSku: payload.supplierSku || base.supplierSku,
    supplierProductName: payload.supplierProductName || base.supplierProductName,
    activeIngredients,
    ingredientAmounts,
    otherIngredients,
    servingSize: payload.servingSize || base.servingSize,
    servingsPerContainer: payload.servingsPerContainer || base.servingsPerContainer,
    directions: payload.directions || base.directions,
    warnings: payload.warnings || base.warnings,
    assetSummary: {
      ...base.assetSummary,
      coaPresent: base.assetSummary.coaPresent || Boolean(payload.coaUrl),
      coaUrl: payload.coaUrl || base.assetSummary.coaUrl,
      labelTemplateAiPresent: base.assetSummary.labelTemplateAiPresent || payload.labelTemplateAiPresent,
      mockupTemplateTifPresent: base.assetSummary.mockupTemplateTifPresent || payload.mockupTemplateTifPresent,
      readyForOptiPixel:
        base.assetSummary.readyForOptiPixel
        || (base.assetSummary.labelTemplateAiPresent || payload.labelTemplateAiPresent)
        && (base.assetSummary.mockupTemplateTifPresent || payload.mockupTemplateTifPresent),
    },
    evidence: {
      ...base.evidence,
      sourceMethod: payload.sourceMethod || base.evidence.sourceMethod,
      aiLabelTextEvidenceStatus: payload.aiLabelTextEvidenceStatus || base.evidence.aiLabelTextEvidenceStatus,
      needsReview: base.evidence.needsReview || payload.needsReview,
    },
  };
}

export async function hydrateLiveSupplierFactsForCopywriting(
  state: ShopifyProductEditorInitialState
): Promise<SupplierFactsHydrationResult> {
  if (!state.currentShopifyListing) {
    return {
      state,
      supplierFactsReadSource: "none",
      supplierFactsReadFound: false,
      supplierFactsReadErrorCode: null,
    };
  }

  if (stateHasStructuredFacts(state)) {
    return {
      state,
      supplierFactsReadSource: panelHasStructuredFacts(state.supplierFactsPanel) ? "db" : "none",
      supplierFactsReadFound: panelHasStructuredFacts(state.supplierFactsPanel),
      supplierFactsReadErrorCode: null,
    };
  }

  const skuCandidates = normalizedSkuCandidates(state);
  if (skuCandidates.length === 0) {
    return {
      state,
      supplierFactsReadSource: "none",
      supplierFactsReadFound: false,
      supplierFactsReadErrorCode: null,
    };
  }

  try {
    const dbPayload = await readDbHydratedFactsBySkus(skuCandidates);
    if (dbPayload) {
      return {
        state: {
          ...state,
          supplierFactsPanel: mergeHydratedFactsIntoPanel(state, dbPayload),
        },
        supplierFactsReadSource: "db",
        supplierFactsReadFound: true,
        supplierFactsReadErrorCode: null,
      };
    }
  } catch {
    // Continue to artifact fallback and keep a safe read error code.
    const artifactPayload = await readArtifactHydratedFactsBySkus(skuCandidates).catch(() => null);
    if (artifactPayload) {
      return {
        state: {
          ...state,
          supplierFactsPanel: mergeHydratedFactsIntoPanel(state, artifactPayload),
        },
        supplierFactsReadSource: "artifact",
        supplierFactsReadFound: true,
        supplierFactsReadErrorCode: "DB_READ_FAILED",
      };
    }
    return {
      state,
      supplierFactsReadSource: "failed",
      supplierFactsReadFound: false,
      supplierFactsReadErrorCode: "DB_READ_FAILED",
    };
  }

  const artifactPayload = await readArtifactHydratedFactsBySkus(skuCandidates).catch(() => null);
  if (artifactPayload) {
    return {
      state: {
        ...state,
        supplierFactsPanel: mergeHydratedFactsIntoPanel(state, artifactPayload),
      },
      supplierFactsReadSource: "artifact",
      supplierFactsReadFound: true,
      supplierFactsReadErrorCode: null,
    };
  }

  return {
    state,
    supplierFactsReadSource: "none",
    supplierFactsReadFound: false,
    supplierFactsReadErrorCode: null,
  };
}

export type { SupplierFactsHydrationResult, SupplierFactsReadSource };
