import fs from "node:fs/promises";
import path from "node:path";
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
  servingSize?: string;
  servingsPerContainer?: string;
  activeIngredients?: string[];
  amountPerServing?: string;
  otherIngredients?: string;
  suggestedUse?: string;
  warnings?: string;
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
  coa?: { status?: string; url?: string | null };
  labelTemplate?: { url?: string | null };
  mockup?: { url?: string | null };
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
}): ProductCopywritingInput {
  const sku = normalizeSku(input.sourceFacts.sku);
  const title = asString(input.sourceFacts.productName || input.pricing?.productName || sku);
  const servingSize = asString(input.sourceFacts.servingSize) || null;
  const servingsPerContainer = asString(input.sourceFacts.servingsPerContainer) || null;
  const activeIngredients = asStringArray(input.sourceFacts.activeIngredients);
  const ingredientAmounts = asString(input.sourceFacts.amountPerServing)
    ? [asString(input.sourceFacts.amountPerServing)]
    : [];
  const otherIngredients = asString(input.sourceFacts.otherIngredients)
    .split(/\n|,|;/g)
    .map((value) => value.trim())
    .filter(Boolean);

  const coaUrl = asString(input.assets?.coa?.url || "") || null;

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
        price: asNumber(input.pricing?.msrp),
        compareAtPrice: null,
        inventory: input.inventory?.inventoryStatus === "in_stock" ? 1 : null,
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
      labelEvidencePresent: Boolean(asString(input.assets?.labelTemplate?.url || "")),
      aiLabelTextEvidencePresent: false,
      sourceFactsUsed: [
        activeIngredients.length > 0 ? "supplement_facts:extracted" : "supplement_facts:missing",
        coaUrl ? "coa_status:available" : "coa_status:missing",
      ],
    },
  });
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

  const pricingBySku = new Map(pricing.map((row) => [normalizeSku(asString(row.sku)), row]));
  const inventoryBySku = new Map(inventory.map((row) => [normalizeSku(asString(row.sku)), row]));
  const assetsBySku = new Map(assets.map((row) => [normalizeSku(asString(row.sku)), row]));

  return sourceFacts.map((row) => {
    const sku = normalizeSku(asString(row.sku));
    return {
      id: `all-${sku}`,
      mode: "all-product-source",
      input: buildInputFromRocktomicRows({
        sourceFacts: row,
        pricing: pricingBySku.get(sku) || null,
        inventory: inventoryBySku.get(sku) || null,
        assets: assetsBySku.get(sku) || null,
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
