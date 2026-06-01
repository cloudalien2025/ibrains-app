import fs from "node:fs/promises";
import path from "node:path";
import { queryEcommerce } from "@/lib/ecommerce/database";
import { buildProductCopywritingInput, type ProductCopywritingBuildContext } from "@/lib/ecomviper/copywriting-agent/copywriting-agent-input-builder";
import type { ProductCopywritingInput } from "@/lib/ecomviper/copywriting-agent/copywriting-agent-types";

export interface CopywritingGoldenFixture {
  id: string;
  mode: string;
  context: ProductCopywritingBuildContext;
  expectedOutput?: unknown;
}

export interface PreparedCopywritingInputRecord {
  id: string;
  mode: string;
  input: ProductCopywritingInput;
  expectedOutput?: unknown;
}

interface RocktomicSourceFactRow {
  sku: string;
  productName?: string;
  category?: string;
  supplementFacts?: {
    servingSize?: string | null;
    servingsPerContainer?: string | null;
    activeIngredients?: string[];
    amountPerServing?: string[] | string | null;
    otherIngredients?: string[] | string | null;
    suggestedUse?: string | null;
    warnings?: string | null;
  };
  servingSize?: string;
  servingsPerContainer?: string;
  activeIngredients?: string[];
  amountPerServing?: string | string[];
  otherIngredients?: string | string[];
  suggestedUse?: string;
  warnings?: string;
  sourceEvidence?: {
    supplementFacts?: {
      sourceMethod?: string | null;
      needsReview?: boolean | null;
    };
  };
}

interface RocktomicPricingRow {
  sku: string;
  productName?: string;
  wholesaleCost?: number | null;
  msrp?: number | null;
  currency?: string | null;
}

interface RocktomicInventoryRow {
  sku: string;
  inventoryStatus?: string;
}

interface RocktomicAssetsRow {
  sku: string;
  coaUrl?: string | null;
  labelTemplateAiUrl?: string | null;
  labelTemplateUrl?: string | null;
  mockupTemplateTifUrl?: string | null;
  mockupUrl?: string | null;
  aiLabelTextEvidence?: {
    extractionStatus?: string | null;
    needsReview?: boolean | null;
  };
}

interface RocktomicAiLabelTextRow {
  sku: string;
  extractionStatus?: string;
  needsReview?: boolean;
  parsedFacts?: {
    servingSize?: string | null;
    servingsPerContainer?: string | null;
    activeIngredients?: string[];
    amountPerServing?: string[];
    otherIngredients?: string[];
  };
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((entry) => asString(entry)).filter(Boolean) : [];
}

function toStringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((entry) => asString(entry)).filter(Boolean);
  if (typeof value === "string") {
    return value
      .split(/\n|,|;/g)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return [];
}

function firstNonNull<T>(...values: Array<T | null | undefined>): T | null {
  for (const value of values) {
    if (value != null) return value;
  }
  return null;
}

function hasStructuredSupplementFacts(input: {
  servingSize: string | null;
  servingsPerContainer: string | null;
  activeIngredients: string[];
  ingredientAmounts: string[];
}): boolean {
  return Boolean(
    input.servingSize
    || input.servingsPerContainer
    || input.activeIngredients.length > 0
    || input.ingredientAmounts.length > 0
  );
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

async function readJson<T>(absolutePath: string): Promise<T> {
  const raw = await fs.readFile(absolutePath, "utf8");
  return JSON.parse(raw) as T;
}

function normalizeSku(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function buildInputFromRocktomicRows(input: {
  sourceFacts: RocktomicSourceFactRow;
  pricing: RocktomicPricingRow | null;
  inventory: RocktomicInventoryRow | null;
  assets: RocktomicAssetsRow | null;
  aiLabelText: RocktomicAiLabelTextRow | null;
  dbFallback: {
    supplementFacts: Record<string, unknown>;
    sourceFacts: Record<string, unknown>;
    coaUrl: string | null;
    labelTemplateAiUrl: string | null;
    mockupTemplateTifUrl: string | null;
    aiLabelTextEvidence: Record<string, unknown>;
    pricing: Record<string, unknown>;
    inventoryStatus: string | null;
  } | null;
}): ProductCopywritingInput {
  const sku = normalizeSku(input.sourceFacts.sku);
  const title = asString(input.sourceFacts.productName || input.pricing?.productName || sku);
  const sourceSupplementFacts = input.sourceFacts.supplementFacts || {};
  const dbSupplementFacts = input.dbFallback?.supplementFacts || {};
  const dbSourceSupplementFacts = asRecord(input.dbFallback?.sourceFacts?.supplementFacts);
  const aiParsedFacts = input.aiLabelText?.parsedFacts || {};

  const servingSize = firstNonNull(
    asString(input.sourceFacts.servingSize) || null,
    asString(sourceSupplementFacts.servingSize) || null,
    asString(dbSupplementFacts.servingSize) || null,
    asString(dbSourceSupplementFacts.servingSize) || null,
    asString(aiParsedFacts.servingSize) || null
  );
  const servingsPerContainer = firstNonNull(
    asString(input.sourceFacts.servingsPerContainer) || null,
    asString(sourceSupplementFacts.servingsPerContainer) || null,
    asString(dbSupplementFacts.servingsPerContainer) || null,
    asString(dbSourceSupplementFacts.servingsPerContainer) || null,
    asString(aiParsedFacts.servingsPerContainer) || null
  );
  const activeIngredients = Array.from(
    new Set([
      ...asStringArray(input.sourceFacts.activeIngredients),
      ...asStringArray(sourceSupplementFacts.activeIngredients),
      ...asStringArray(dbSupplementFacts.activeIngredients),
      ...asStringArray(dbSourceSupplementFacts.activeIngredients),
      ...asStringArray(aiParsedFacts.activeIngredients),
    ])
  );
  const ingredientAmounts = Array.from(
    new Set([
      ...toStringList(input.sourceFacts.amountPerServing),
      ...toStringList(sourceSupplementFacts.amountPerServing),
      ...toStringList(dbSupplementFacts.amountPerServing),
      ...toStringList(dbSourceSupplementFacts.amountPerServing),
      ...toStringList(aiParsedFacts.amountPerServing),
    ])
  );
  const otherIngredients = Array.from(
    new Set([
      ...toStringList(input.sourceFacts.otherIngredients),
      ...toStringList(sourceSupplementFacts.otherIngredients),
      ...toStringList(dbSupplementFacts.otherIngredients),
      ...toStringList(dbSourceSupplementFacts.otherIngredients),
      ...toStringList(aiParsedFacts.otherIngredients),
    ])
  );

  const coaUrl = firstNonNull(
    asString(input.assets?.coaUrl) || null,
    asString(input.dbFallback?.coaUrl) || null
  );
  const labelTemplateUrl = firstNonNull(
    asString(input.assets?.labelTemplateUrl || input.assets?.labelTemplateAiUrl) || null,
    asString(input.dbFallback?.labelTemplateAiUrl) || null
  );
  const mockupUrl = firstNonNull(
    asString(input.assets?.mockupUrl || input.assets?.mockupTemplateTifUrl) || null,
    asString(input.dbFallback?.mockupTemplateTifUrl) || null
  );
  const aiEvidenceStatus = asString(
    input.aiLabelText?.extractionStatus
    || input.assets?.aiLabelTextEvidence?.extractionStatus
    || input.dbFallback?.aiLabelTextEvidence?.extractionStatus
  );
  const aiEvidenceNeedsReview = Boolean(
    input.aiLabelText?.needsReview
    || input.assets?.aiLabelTextEvidence?.needsReview
    || input.dbFallback?.aiLabelTextEvidence?.needsReview
    || input.sourceFacts.sourceEvidence?.supplementFacts?.needsReview
  );
  const structuredFactsPresent = hasStructuredSupplementFacts({
    servingSize,
    servingsPerContainer,
    activeIngredients,
    ingredientAmounts,
  });
  const hasImageEvidence = Boolean(labelTemplateUrl || mockupUrl);
  const aiEvidencePresent = Boolean(aiEvidenceStatus) && aiEvidenceStatus !== "unavailable";
  const sourceMethod = asString(input.sourceFacts.sourceEvidence?.supplementFacts?.sourceMethod);
  const supplementFactsSource = structuredFactsPresent
    ? input.dbFallback?.supplementFacts && Object.keys(input.dbFallback.supplementFacts).length > 0
      ? "db"
      : sourceMethod === "ai_pdf_text"
        ? "ai_label_text"
        : "artifact"
    : aiEvidencePresent
      ? "ai_label_text"
      : hasImageEvidence
        ? "image_only"
        : "none";
  const priceCandidate = firstNonNull(
    asNumber(input.pricing?.msrp),
    asNumber(input.pricing?.wholesaleCost),
    asNumber(asRecord(input.dbFallback?.pricing).msrp),
    asNumber(asRecord(input.dbFallback?.pricing).wholesaleCost)
  );
  const inventoryStatus = asString(input.inventory?.inventoryStatus || input.dbFallback?.inventoryStatus);

  return buildProductCopywritingInput({
    channel: "shopify",
    productIdentity: {
      productId: sku,
      handle: title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
      title,
      brand: "OPA Nutrition",
      productType: "Supplements",
      category: asString(input.sourceFacts.category) || "Supplements",
      tags: ["supplement"],
      vendor: "OPA Nutrition",
      channel: "shopify",
    },
    currentListing: {
      title,
      descriptionText: "",
      descriptionHtml: "",
      bullets: [],
      metaTitle: title,
      metaDescription: "",
      existingFaqs: [],
    },
    variants: [
      {
        sku,
        barcode: null,
        upc: null,
        gtin: null,
        price: priceCandidate,
        compareAtPrice: null,
        inventory: inventoryStatus === "in_stock" ? 1 : null,
      },
    ],
    supplierContext: {
      supplierSlug: "rocktomic",
      supplierName: "Rocktomic",
      supplierSku: sku,
      supplierProductName: title,
      matchStatus: "matched",
      matchConfidence: "exact_sku",
      matchReasons: ["exact SKU match"],
      ingredientMatchingReadiness: "ready",
      productEditorFactsReadiness: activeIngredients.length > 0 ? "ready" : "ready_with_warnings",
      complianceEvidenceReadiness: coaUrl ? "ready" : "ready_with_warnings",
      pricingReadiness: input.pricing?.msrp != null ? "ready" : "blocked",
      inventoryReadiness: input.inventory?.inventoryStatus ? "ready_with_warnings" : "unknown",
      optiPixelAssetReadiness: "unknown",
    },
    supplementFacts: {
      servingSize,
      servingsPerContainer,
      activeIngredients,
      ingredientAmounts,
      otherIngredients,
      suggestedUse: asString(input.sourceFacts.suggestedUse) || null,
      warnings: asString(input.sourceFacts.warnings) || null,
    },
    sourceEvidence: {
      coaPresent: Boolean(coaUrl),
      coaUrl,
      labelEvidencePresent: Boolean(labelTemplateUrl || mockupUrl),
      supplementFactsImagePresent: hasImageEvidence,
      aiLabelTextEvidencePresent: aiEvidencePresent,
      aiLabelTextEvidenceStatus: aiEvidenceStatus || null,
      aiLabelTextNeedsReview: aiEvidenceNeedsReview,
      structuredSupplementFactsPresent: structuredFactsPresent,
      supplementFactsSource,
      sourceFactsUsed: [
        structuredFactsPresent ? "supplement_facts:extracted" : "supplement_facts:missing",
        servingSize ? "serving_size:present" : "serving_size:missing",
        servingsPerContainer ? "servings_per_container:present" : "servings_per_container:missing",
        ingredientAmounts.length > 0 ? "ingredient_amounts:present" : "ingredient_amounts:missing",
        coaUrl ? "coa_status:available" : "coa_status:missing",
      ],
    },
  });
}

interface EcommerceDbFallbackRow {
  sku: string;
  source_facts: Record<string, unknown> | null;
  supplement_facts: Record<string, unknown> | null;
  coa_url: string | null;
  label_template_ai_url: string | null;
  mockup_template_tif_url: string | null;
  ai_label_text_evidence: Record<string, unknown> | null;
  pricing: Record<string, unknown> | null;
  inventory_status: string | null;
}

async function loadEcommerceDbFallbackRows(): Promise<Map<string, EcommerceDbFallbackRow>> {
  if (!process.env.ECOMMERCE_DATABASE_URL?.trim()) {
    return new Map();
  }
  const rows = await queryEcommerce<EcommerceDbFallbackRow>(
    `SELECT
       p.sku,
       p.source_facts,
       pf.supplement_facts,
       a.coa_url,
       a.label_template_ai_url,
       a.mockup_template_tif_url,
       a.ai_label_text_evidence,
       pr.pricing,
       inv.inventory_status
     FROM ecommerce_supplier_products p
     LEFT JOIN ecommerce_supplier_product_facts pf ON pf.supplier_slug = p.supplier_slug AND pf.sku = p.sku
     LEFT JOIN ecommerce_supplier_assets a ON a.supplier_slug = p.supplier_slug AND a.sku = p.sku
     LEFT JOIN ecommerce_supplier_pricing pr ON pr.supplier_slug = p.supplier_slug AND pr.sku = p.sku
     LEFT JOIN ecommerce_supplier_inventory inv ON inv.supplier_slug = p.supplier_slug AND inv.sku = p.sku
     WHERE p.supplier_slug = $1`,
    ["rocktomic"]
  ).catch(() => []);

  return new Map(rows.map((row) => [normalizeSku(asString(row.sku)), row]));
}

export async function loadGoldenFixtures(repoRoot = process.cwd()): Promise<CopywritingGoldenFixture[]> {
  const filePath = path.join(repoRoot, "data/ecomviper/copywriting-agent/fixtures/golden-products.json");
  const parsed = await readJson<{ fixtures?: unknown[] }>(filePath);
  const rows = Array.isArray(parsed.fixtures) ? parsed.fixtures : [];
  const fixtures: CopywritingGoldenFixture[] = [];
  for (const row of rows) {
    const item = asRecord(row);
    const id = asString(item.id);
    if (!id) continue;

    fixtures.push({
      id,
      mode: asString(item.mode) || "fixture",
      context: asRecord(item.context) as ProductCopywritingBuildContext,
      expectedOutput: item.expectedOutput,
    });
  }

  return fixtures;
}

export async function loadAllRocktomicProductInputs(repoRoot = process.cwd()): Promise<PreparedCopywritingInputRecord[]> {
  const latestDir = path.join(repoRoot, "data/ecomviper/suppliers/rocktomic/latest");

  const sourceFacts = await readJson<RocktomicSourceFactRow[]>(path.join(latestDir, "sourceFacts.json"));
  const pricing = await readJson<RocktomicPricingRow[]>(path.join(latestDir, "pricing.json"));
  const inventory = await readJson<RocktomicInventoryRow[]>(path.join(latestDir, "inventory.json"));
  const assets = await readJson<RocktomicAssetsRow[]>(path.join(latestDir, "assets.json"));
  const aiLabelText = await readJson<{ records?: RocktomicAiLabelTextRow[] }>(path.join(latestDir, "ai-label-text-evidence.json"))
    .then((entry) => Array.isArray(entry.records) ? entry.records : [])
    .catch(() => []);
  const dbFallbackBySku = await loadEcommerceDbFallbackRows();

  const pricingBySku = new Map(pricing.map((row) => [normalizeSku(asString(row.sku)), row]));
  const inventoryBySku = new Map(inventory.map((row) => [normalizeSku(asString(row.sku)), row]));
  const assetsBySku = new Map(assets.map((row) => [normalizeSku(asString(row.sku)), row]));
  const aiLabelBySku = new Map(aiLabelText.map((row) => [normalizeSku(asString(row.sku)), row]));

  return sourceFacts.map((row) => {
    const sku = normalizeSku(asString(row.sku));
    const dbFallback = dbFallbackBySku.get(sku) || null;
    return {
      id: `all-${sku}`,
      mode: "all-product-source",
      input: buildInputFromRocktomicRows({
        sourceFacts: row,
        pricing: pricingBySku.get(sku) || null,
        inventory: inventoryBySku.get(sku) || null,
        assets: assetsBySku.get(sku) || null,
        aiLabelText: aiLabelBySku.get(sku) || null,
        dbFallback: dbFallback
          ? {
              supplementFacts: asRecord(dbFallback.supplement_facts),
              sourceFacts: asRecord(dbFallback.source_facts),
              coaUrl: asString(dbFallback.coa_url) || null,
              labelTemplateAiUrl: asString(dbFallback.label_template_ai_url) || null,
              mockupTemplateTifUrl: asString(dbFallback.mockup_template_tif_url) || null,
              aiLabelTextEvidence: asRecord(dbFallback.ai_label_text_evidence),
              pricing: asRecord(dbFallback.pricing),
              inventoryStatus: asString(dbFallback.inventory_status) || null,
            }
          : null,
      }),
    } satisfies PreparedCopywritingInputRecord;
  });
}

export function applySelectionFilters<T extends { id: string; input?: ProductCopywritingInput; context?: ProductCopywritingBuildContext }>(
  records: T[],
  options: { sku?: string | null; handle?: string | null; limit?: number | null }
): T[] {
  const sku = options.sku ? normalizeSku(options.sku) : null;
  const handle = options.handle ? options.handle.toLowerCase() : null;
  const limit = typeof options.limit === "number" && options.limit > 0 ? Math.floor(options.limit) : null;

  let filtered = records;

  if (sku) {
    filtered = filtered.filter((record) => {
      const sourceSku = normalizeSku(asString(record.input?.variants?.[0]?.sku || record.context?.supplierContext?.supplierSku));
      return sourceSku === sku;
    });
  }

  if (handle) {
    filtered = filtered.filter((record) => {
      const sourceHandle = asString(record.input?.productIdentity?.handle || record.context?.productIdentity?.handle).toLowerCase();
      return sourceHandle === handle;
    });
  }

  if (limit) {
    filtered = filtered.slice(0, limit);
  }

  return filtered;
}

export function buildInputsFromFixtures(fixtures: CopywritingGoldenFixture[]): PreparedCopywritingInputRecord[] {
  return fixtures.map((fixture) => ({
    id: fixture.id,
    mode: fixture.mode,
    input: buildProductCopywritingInput(fixture.context),
    expectedOutput: fixture.expectedOutput,
  }));
}
