import fs from "node:fs/promises";
import path from "node:path";
import { FirecrawlClient } from "@/lib/ecomviper/suppliers/firecrawl/firecrawl-client";
import {
  calculateRecordSourceStatus,
  ensureUniqueMissingFields,
  normalizeSku,
  type NormalizedSupplierIntelligencePackage,
  type NormalizedSupplierIntelligenceRecord,
  type SupplierFactProvenance,
  type SupplierIntelligenceSourceType,
} from "@/lib/ecomviper/suppliers/rocktomic/supplier-intelligence-schema";

interface ManifestSource {
  id: string;
  name: string;
  url: string;
  type: string;
  notes?: string;
  extraction?: {
    method?: string;
    firecrawlMode?: "scrape" | "map";
    allowModes?: Array<"fixture" | "cache" | "live">;
  };
}

export interface RocktomicSupplierSourceManifest {
  supplier: string;
  supplierId?: string;
  supplierName?: string;
  version: number;
  sourceManifestVersion?: number;
  generatedBy?: string;
  sources: ManifestSource[];
  firecrawl?: {
    apiBaseUrl?: string;
    timeoutMsEnvVar?: string;
    maxPagesEnvVar?: string;
    cacheDirEnvVar?: string;
    enabledEnvVar?: string;
    allowedModes?: string[];
  };
}

export interface BuildSupplierIntelligenceOptions {
  manifest: RocktomicSupplierSourceManifest;
  skuFilter: string[] | null;
  useFixtures: boolean;
  useFirecrawl: boolean;
  useCache: boolean;
}

export interface BuildSupplierIntelligenceResult {
  package: NormalizedSupplierIntelligencePackage;
  assets: Array<{ sku: string; coaUrl: string | null; labelTemplateUrl: string | null; mockupUrl: string | null; sourceStatus: string; missingFields: string[] }>;
  pricing: Array<{ sku: string; wholesaleCost: number | null; msrp: number | null; currency: string | null; sourceStatus: string; missingFields: string[] }>;
  inventory: Array<{ sku: string; status: string | null; quantityText: string | null; sourceStatus: string; missingFields: string[] }>;
  sourceOrigin: "fixture" | "firecrawl";
  logs: string[];
}

interface FixtureRecord extends NormalizedSupplierIntelligenceRecord {}

function nowIso(): string {
  return new Date().toISOString();
}

function createProvenance(input: {
  sourceType: SupplierIntelligenceSourceType;
  sourceUrl: string;
  rawSnippet: string;
  confidence?: number;
  pageNumber?: number | null;
}): SupplierFactProvenance {
  return {
    sourceType: input.sourceType,
    sourceUrl: input.sourceUrl,
    pageNumber: input.pageNumber ?? null,
    extractedAt: nowIso(),
    extractor: "rocktomic_firecrawl_extractor_foundation_v1",
    rawSnippet: input.rawSnippet,
    confidence: input.confidence ?? 0.92,
  };
}

function parseAmount(raw: string): { amount: number | null; unit: string | null } {
  const match = raw.match(/(-?\d+(?:\.\d+)?)\s*(mg|mcg|g|iu|ml)?/i);
  if (!match) return { amount: null, unit: null };
  return { amount: Number.parseFloat(match[1]), unit: match[2]?.toLowerCase() || null };
}

function isRecord(value: unknown): value is FixtureRecord {
  return Boolean(value && typeof value === "object" && typeof (value as { sku?: unknown }).sku === "string");
}

async function loadFixtureRecords(): Promise<FixtureRecord[]> {
  const fixturePath = path.join(process.cwd(), "data/ecomviper/suppliers/rocktomic/fixtures/supplier-intelligence-fixtures.json");
  const body = await fs.readFile(fixturePath, "utf8");
  const parsed = JSON.parse(body) as unknown;
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((entry): entry is FixtureRecord => isRecord(entry));
}

function filterRecords(records: FixtureRecord[], skuFilter: string[] | null): FixtureRecord[] {
  const normalizedFilter = skuFilter?.map((entry) => normalizeSku(entry)) || null;
  const filtered = normalizedFilter
    ? records.filter((record) => normalizedFilter.includes(normalizeSku(record.sku)))
    : records;

  return filtered
    .map((record) => {
      const missingFields = ensureUniqueMissingFields(record.missingFields || []);
      const sourceStatus = calculateRecordSourceStatus({ ...record, missingFields });
      return { ...record, missingFields, sourceStatus };
    })
    .sort((a, b) => a.sku.localeCompare(b.sku));
}

async function buildFromFixtures(options: BuildSupplierIntelligenceOptions): Promise<BuildSupplierIntelligenceResult> {
  const fixtureRecords = await loadFixtureRecords();
  const records = filterRecords(fixtureRecords, options.skuFilter);
  const logs = [`fixtures_loaded=${fixtureRecords.length}`, `records_selected=${records.length}`];

  const supplierId = options.manifest.supplierId || options.manifest.supplier || "rocktomic";
  const supplierName = options.manifest.supplierName || "Rocktomic";

  const supplierPackage: NormalizedSupplierIntelligencePackage = {
    supplierId,
    supplierName,
    generatedAt: nowIso(),
    extractor: "rocktomic_firecrawl_extractor_foundation_v1",
    sourceManifestVersion: options.manifest.sourceManifestVersion || options.manifest.version || 1,
    records,
  };

  return {
    package: supplierPackage,
    assets: records.map((record) => ({
      sku: record.sku,
      coaUrl: record.coaUrl,
      labelTemplateUrl: record.labelTemplateUrl,
      mockupUrl: record.mockupUrl,
      sourceStatus: record.sourceStatus,
      missingFields: ensureUniqueMissingFields([
        ...(!record.coaUrl ? ["coaUrl"] : []),
        ...(!record.labelTemplateUrl ? ["labelTemplateUrl"] : []),
        ...(!record.mockupUrl ? ["mockupUrl"] : []),
      ]),
    })),
    pricing: records.map((record) => ({
      sku: record.sku,
      wholesaleCost: record.pricing.wholesaleCost,
      msrp: record.pricing.msrp,
      currency: record.pricing.currency,
      sourceStatus: record.pricing.sourceStatus,
      missingFields: ensureUniqueMissingFields([
        ...(record.pricing.wholesaleCost == null ? ["pricing.wholesaleCost"] : []),
        ...(record.pricing.msrp == null ? ["pricing.msrp"] : []),
      ]),
    })),
    inventory: records.map((record) => ({
      sku: record.sku,
      status: record.inventory.status,
      quantityText: record.inventory.quantityText,
      sourceStatus: record.inventory.sourceStatus,
      missingFields: ensureUniqueMissingFields([
        ...(!record.inventory.status ? ["inventory.status"] : []),
      ]),
    })),
    sourceOrigin: "fixture",
    logs,
  };
}

function toJsonSchemaForSupplierRecord(): Record<string, unknown> {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      sku: { type: "string" },
      productName: { type: "string" },
      servingSize: { type: "string" },
      servingsPerContainer: { type: "number" },
      nutrientFacts: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            rawText: { type: "string" },
          },
          required: ["name"],
        },
      },
      activeIngredients: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            rawText: { type: "string" },
          },
          required: ["name"],
        },
      },
    },
    required: ["sku", "productName"],
  };
}

async function buildFromFirecrawl(options: BuildSupplierIntelligenceOptions): Promise<BuildSupplierIntelligenceResult> {
  const catalog = options.manifest.sources.find((source) => source.id === "catalog_pdf");
  if (!catalog?.url) {
    throw new Error("catalog_pdf source is required for Firecrawl extraction mode.");
  }

  const firecrawl = new FirecrawlClient({
    apiBaseUrl: options.manifest.firecrawl?.apiBaseUrl,
    allowLiveRequests: true,
    enabled: process.env.ECOMVIPER_SUPPLIER_FIRECRAWL_ENABLED !== "0",
  });

  const scrape = await firecrawl.scrape({
    url: catalog.url,
    useCache: options.useCache,
    formats: [
      "markdown",
      {
        type: "json",
        prompt: "Extract SKU-level supplier facts records from the catalog page. Keep only clear explicit facts.",
        schema: {
          type: "object",
          properties: {
            records: {
              type: "array",
              items: toJsonSchemaForSupplierRecord(),
            },
          },
        },
      },
    ],
    parsers: ["pdf"],
    onlyMainContent: true,
  });

  const json = scrape.json || {};
  const recordsArray = Array.isArray(json.records) ? json.records : [];
  const normalizedRecords: NormalizedSupplierIntelligenceRecord[] = recordsArray
    .filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === "object"))
    .map((entry) => {
      const sku = normalizeSku(String(entry.sku || ""));
      const productName = typeof entry.productName === "string" ? entry.productName.trim() : null;
      const sharedProvenance = createProvenance({
        sourceType: "catalog_pdf",
        sourceUrl: catalog.url,
        rawSnippet: `Firecrawl ${scrape.source} extraction for ${sku || "unknown_sku"}`,
        confidence: scrape.source === "live" ? 0.88 : 0.82,
      });
      const activeIngredients = Array.isArray(entry.activeIngredients)
        ? entry.activeIngredients
          .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
          .map((item) => {
            const rawText = String(item.rawText || item.name || "");
            const parsed = parseAmount(rawText);
            return {
              name: String(item.name || "").trim(),
              rawText,
              amount: parsed.amount,
              unit: parsed.unit,
              standardization: null,
              provenance: [sharedProvenance],
            };
          })
        : [];

      const nutrientFacts = Array.isArray(entry.nutrientFacts)
        ? entry.nutrientFacts
          .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
          .map((item) => {
            const rawText = String(item.rawText || item.name || "");
            const parsed = parseAmount(rawText);
            return {
              name: String(item.name || "").trim(),
              rawText,
              amount: parsed.amount,
              dailyValue: null,
              unit: parsed.unit,
              provenance: [sharedProvenance],
            };
          })
        : [];

      const missingFields = ensureUniqueMissingFields([
        ...(!sku ? ["sku"] : []),
        ...(!productName ? ["productName"] : []),
        ...(activeIngredients.length === 0 ? ["activeIngredients"] : []),
      ]);

      const record: NormalizedSupplierIntelligenceRecord = {
        supplierId: options.manifest.supplierId || "rocktomic",
        supplierName: options.manifest.supplierName || "Rocktomic",
        sku,
        productName,
        productType: "supplement",
        brand: "Rocktomic",
        labelSize: null,
        containerSize: null,
        productWeight: null,
        servingSize: typeof entry.servingSize === "string" ? entry.servingSize.trim() : null,
        servingsPerContainer:
          typeof entry.servingsPerContainer === "number"
            ? entry.servingsPerContainer
            : typeof entry.servingsPerContainer === "string"
              ? Number.parseInt(entry.servingsPerContainer, 10) || null
              : null,
        nutrientFacts,
        activeIngredients,
        otherIngredients: [],
        suggestedUse: null,
        warnings: null,
        dietaryAttributes: [],
        certifications: [],
        manufacturingClaims: [],
        coaUrl: null,
        labelTemplateUrl: null,
        mockupUrl: null,
        imageUrls: [],
        pricing: {
          wholesaleCost: null,
          msrp: null,
          currency: "USD",
          sourceStatus: "missing",
          provenance: [sharedProvenance],
        },
        inventory: {
          status: null,
          quantityText: null,
          sourceStatus: "missing",
          provenance: [sharedProvenance],
        },
        shippingPolicy: { sourceUrl: null, summary: null, provenance: [sharedProvenance] },
        returnPolicy: { sourceUrl: null, summary: null, provenance: [sharedProvenance] },
        sourceStatus: "partial",
        missingFields,
        confidence: 0.8,
        provenance: [sharedProvenance],
      };

      return { ...record, sourceStatus: calculateRecordSourceStatus(record) };
    })
    .filter((record) => !options.skuFilter || options.skuFilter.map((entry) => normalizeSku(entry)).includes(record.sku))
    .sort((a, b) => a.sku.localeCompare(b.sku));

  const supplierPackage: NormalizedSupplierIntelligencePackage = {
    supplierId: options.manifest.supplierId || "rocktomic",
    supplierName: options.manifest.supplierName || "Rocktomic",
    generatedAt: nowIso(),
    extractor: "rocktomic_firecrawl_extractor_foundation_v1",
    sourceManifestVersion: options.manifest.sourceManifestVersion || options.manifest.version || 1,
    records: normalizedRecords,
  };

  const assets = normalizedRecords.map((record) => ({
    sku: record.sku,
    coaUrl: record.coaUrl,
    labelTemplateUrl: record.labelTemplateUrl,
    mockupUrl: record.mockupUrl,
    sourceStatus: record.sourceStatus,
    missingFields: record.missingFields.filter((field) => field.startsWith("coa") || field.startsWith("label") || field.startsWith("mockup")),
  }));

  const pricing = normalizedRecords.map((record) => ({
    sku: record.sku,
    wholesaleCost: record.pricing.wholesaleCost,
    msrp: record.pricing.msrp,
    currency: record.pricing.currency,
    sourceStatus: record.pricing.sourceStatus,
    missingFields: record.missingFields.filter((field) => field.startsWith("pricing")),
  }));

  const inventory = normalizedRecords.map((record) => ({
    sku: record.sku,
    status: record.inventory.status,
    quantityText: record.inventory.quantityText,
    sourceStatus: record.inventory.sourceStatus,
    missingFields: record.missingFields.filter((field) => field.startsWith("inventory")),
  }));

  return {
    package: supplierPackage,
    assets,
    pricing,
    inventory,
    sourceOrigin: "firecrawl",
    logs: [`firecrawl_source=${scrape.source}`, `records_extracted=${normalizedRecords.length}`],
  };
}

export async function buildRocktomicSupplierIntelligence(
  options: BuildSupplierIntelligenceOptions
): Promise<BuildSupplierIntelligenceResult> {
  if (options.useFirecrawl && !options.useFixtures) {
    return await buildFromFirecrawl(options);
  }
  return await buildFromFixtures(options);
}

export async function loadRocktomicSourceManifest(manifestPath: string): Promise<RocktomicSupplierSourceManifest> {
  const body = await fs.readFile(manifestPath, "utf8");
  const parsed = JSON.parse(body) as RocktomicSupplierSourceManifest;
  if (!parsed || !Array.isArray(parsed.sources)) {
    throw new Error(`Invalid source manifest: ${manifestPath}`);
  }
  return parsed;
}
