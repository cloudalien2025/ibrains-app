import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

import { validateSourceIdentity } from "@/lib/ecomviper/suppliers/rocktomic/source-identity-validator";
import { parseRfc4180Csv } from "@/lib/ecomviper/suppliers/rocktomic/rocktomic-csv-parser";
import { parseMsrpReportCsv, parsePldsCatalogCsv, parseInventoryReportCsv, indexBySku } from "@/lib/ecomviper/suppliers/rocktomic/rocktomic-sheet-parsers";
import { parseTemplatesHtml } from "@/lib/ecomviper/suppliers/rocktomic/templates-html-parser";
import { parseDocxPolicy } from "@/lib/ecomviper/suppliers/rocktomic/docx-policy-parser";
import type {
  RocktomicMasterPackage,
  RocktomicProductRecord,
  SupplementFactsStatus,
  InventoryStatus,
  FieldProvenanceEntry,
  PricingBlock,
  InventoryBlock,
  SupplementFactsBlock,
  MissingDataFlags,
} from "@/lib/ecomviper/suppliers/rocktomic/master-package-schema";

export interface SourceBundle {
  sourceBundleId: string;
  sourceDir: string;
  manifest: BundleManifest;
  pldsCsv?: string | null;
  msrpCsv?: string | null;
  inventoryCsv?: string | null;
  templatesHtml?: string | null;
  policyDocxBuffer?: Buffer | null;
  catalogPdfPath?: string | null;
  existingSourceFacts?: ExistingSourceFact[] | null;
  existingPricing?: ExistingPricingRecord[] | null;
  existingInventory?: ExistingInventoryRecord[] | null;
  existingAssets?: ExistingAssetsRecord[] | null;
}

interface BundleManifest {
  bundleId: string;
  sources: Array<{ id: string; name: string; url: string; type: string; notes?: string }>;
  firecrawl?: unknown;
  version?: number;
  sourceManifestVersion?: number;
}

interface ExistingSourceFact {
  sku: string;
  productName?: string | null;
  category?: string | null;
  supplementFacts?: unknown;
  supplementFactsText?: string | null;
  sourceReferences?: string[];
  missingFields?: string[];
}

interface ExistingPricingRecord {
  sku: string;
  productName?: string | null;
  wholesaleCost?: number | null;
  msrp?: number | null;
  estimatedProfit?: number | null;
  membershipTierCosts?: Record<string, number | null>;
  sourceReferences?: string[];
  missingFields?: string[];
}

interface ExistingInventoryRecord {
  sku: string;
  rawInventoryValue?: string | null;
  inventoryStatus?: string | null;
  sourceReferences?: string[];
  missingFields?: string[];
}

interface ExistingAssetsRecord {
  sku: string;
  coaUrl?: string | null;
  labelTemplateAiUrl?: string | null;
  mockupTemplateTifUrl?: string | null;
  labelTemplateUrl?: string | null;
  mockupUrl?: string | null;
  catalogTemplateUrl?: string | null;
  assets?: Array<{ url: string; type?: string; sku?: string }>;
  sourceReferences?: string[];
  missingFields?: string[];
}

interface ExistingCatalogLinkRecord {
  sku?: string | null;
  page?: number | null;
  links?: Array<{ uri: string; context?: string }>;
}

export interface BuildMasterPackageOptions {
  sourceBundle: SourceBundle;
  dryRun?: boolean;
  allowLiveTemplates?: boolean;
}

function sha256Short(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex").slice(0, 16);
}

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeInventoryStatus(raw: string | null | undefined): InventoryStatus {
  if (!raw) return "unknown";
  const lower = raw.toLowerCase().trim();
  if (/in.?stock|available|yes|true/i.test(lower)) return "in_stock";
  if (/low.?stock|limited/i.test(lower)) return "low_stock";
  if (/out.?of.?stock|oos/i.test(lower)) return "out_of_stock";
  if (/backorder|back.?order|replenish/i.test(lower)) return "backordered";
  return "unknown";
}

function normalizeTierCosts(raw: Record<string, number | null> | undefined): PricingBlock["tiers"] {
  if (!raw) return {};
  const tiers: PricingBlock["tiers"] = {};
  for (const [key, value] of Object.entries(raw)) {
    const lk = key.replace(/\n/g, " ");
    if (/T1|Non.?Member/i.test(lk)) tiers.t1 = value;
    else if (/T2\b/i.test(lk)) tiers.t2 = value;
    else if (/T3\b/i.test(lk)) tiers.t3 = value;
    else if (/T4|Standard.*VIP|VIP.*Standard/i.test(lk)) tiers.t4 = value;
    else if (/T5|VIP.*PLUS|PLUS.*VIP|Premium.*Pricing/i.test(lk)) tiers.t5 = value;
    else if (/T6\b/i.test(lk)) tiers.t6 = value;
    else if (/T7|Launch/i.test(lk)) tiers.t7 = value;
  }
  return tiers;
}

function classifySupplementFactsStatus(record: {
  supplementFacts: unknown;
  supplementFactsText: string | null | undefined;
  sourceStatus?: string | null;
  aiLabelEvidence?: unknown;
}): SupplementFactsStatus {
  const facts = record.supplementFacts as Record<string, unknown> | null | undefined;
  if (!facts) {
    const hasPdfText = Boolean(record.supplementFactsText && record.supplementFactsText.length > 100 && !record.supplementFactsText.startsWith("%PDF"));
    if (hasPdfText) return "partial";
    return "missing";
  }
  const hasServing = Boolean(facts.servingSize || facts.serving_size);
  const hasServingsPerContainer = Boolean(facts.servingsPerContainer || facts.servings_per_container);
  const nutrientFacts = (facts.nutrientFacts || facts.nutrient_facts) as unknown[] | null | undefined;
  const activeIngredients = (facts.activeIngredients || facts.active_ingredients) as unknown[] | null | undefined;
  const hasFacts = Boolean((Array.isArray(nutrientFacts) && nutrientFacts.length > 0) || (Array.isArray(activeIngredients) && activeIngredients.length > 0));

  if (hasServing && hasServingsPerContainer && hasFacts) return "structured";
  if (hasFacts || hasServing) return "partial";
  return "visual_only";
}

function buildMissingDataFlags(record: RocktomicProductRecord): MissingDataFlags {
  return {
    productName: !record.productName,
    category: !record.category,
    pricing: record.pricing.msrp === null && record.pricing.wholesaleCost === null && Object.values(record.pricing.tiers).every((v) => v == null),
    msrp: record.pricing.msrp === null,
    inventory: record.inventory.status === "unknown",
    coaUrl: !record.coaUrl,
    labelTemplateUrl: !record.labelTemplateUrl,
    mockupUrl: !record.mockupUrl,
    supplementFacts: record.supplementFacts.status === "missing",
    provenance: Object.keys(record.provenance).length === 0,
  };
}

function countsByKey<T extends string>(items: T[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    counts[item] = (counts[item] ?? 0) + 1;
  }
  return counts;
}

function normalizeSku(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "").trim();
}

export async function buildRocktomicMasterPackage(options: BuildMasterPackageOptions): Promise<RocktomicMasterPackage> {
  const { sourceBundle } = options;
  const manifest = sourceBundle.manifest;
  const sourceHashes: Record<string, string> = {};

  const sourceIdentityReport = validateSourceIdentity({
    sources: manifest.sources,
    manifestVersion: manifest.sourceManifestVersion ?? manifest.version ?? 1,
  });

  const policySource = manifest.sources.find((s) => s.id === "order_refund_policy" || s.type === "docx");
  let policyDocxParsed = false;
  let policyDocxUrl = policySource?.url ?? null;
  let policyNormalizedSummary: string | null = null;

  if (sourceBundle.policyDocxBuffer) {
    const policyResult = await parseDocxPolicy({
      docxBuffer: sourceBundle.policyDocxBuffer,
      sourceUrl: policyDocxUrl,
    });
    policyDocxParsed = policyResult.parsed;
    policyNormalizedSummary = policyResult.normalizedSummary;
    if (policyResult.parsed) {
      sourceHashes["policy_docx"] = sha256Short(policyResult.fullText ?? "");
    }
  }

  const templatesSource = manifest.sources.find((s) => s.id === "label_mockup_templates" || s.type === "html");
  const templateSkuMap: Record<string, { labelUrl: string | null; mockupUrl: string | null }> = {};
  const templatesSourceUrl = templatesSource?.url ?? "";

  if (sourceBundle.templatesHtml) {
    sourceHashes["templates_html"] = sha256Short(sourceBundle.templatesHtml);
    const templatesResult = parseTemplatesHtml(sourceBundle.templatesHtml, templatesSourceUrl);
    for (const [sku, links] of Object.entries(templatesResult.skuLinkMap)) {
      templateSkuMap[normalizeSku(sku)] = links;
    }
  }

  let pldsBySkuMap = new Map<string, ReturnType<typeof parsePldsCatalogCsv>[0]>();
  const pldsSource = manifest.sources.find((s) => s.id === "plds_catalog");
  if (sourceBundle.pldsCsv) {
    sourceHashes["plds_catalog"] = sha256Short(sourceBundle.pldsCsv);
    const pldsRecords = parsePldsCatalogCsv(sourceBundle.pldsCsv, pldsSource?.url ?? "", "plds_catalog_csv");
    pldsBySkuMap = indexBySku(pldsRecords);
  }

  let msrpBySkuMap = new Map<string, ReturnType<typeof parseMsrpReportCsv>[0]>();
  const msrpSource = manifest.sources.find((s) => s.id === "msrp_profit_margins_report");
  if (sourceBundle.msrpCsv) {
    sourceHashes["msrp_report"] = sha256Short(sourceBundle.msrpCsv);
    const msrpRecords = parseMsrpReportCsv(sourceBundle.msrpCsv, msrpSource?.url ?? "", "msrp_report_csv");
    msrpBySkuMap = indexBySku(msrpRecords);
  }

  let inventoryBySkuMap = new Map<string, ReturnType<typeof parseInventoryReportCsv>[0]>();
  const inventorySource = manifest.sources.find((s) => s.id === "inventory_report");
  if (sourceBundle.inventoryCsv) {
    sourceHashes["inventory_report"] = sha256Short(sourceBundle.inventoryCsv);
    const inventoryRecords = parseInventoryReportCsv(sourceBundle.inventoryCsv, inventorySource?.url ?? "", "inventory_report_csv");
    inventoryBySkuMap = indexBySku(inventoryRecords);
  }

  const existingFactsBySku = new Map<string, ExistingSourceFact>();
  if (sourceBundle.existingSourceFacts) {
    for (const fact of sourceBundle.existingSourceFacts) {
      existingFactsBySku.set(normalizeSku(fact.sku), fact);
    }
  }

  const existingPricingBySku = new Map<string, ExistingPricingRecord>();
  if (sourceBundle.existingPricing) {
    for (const record of sourceBundle.existingPricing) {
      existingPricingBySku.set(normalizeSku(record.sku), record);
    }
  }

  const existingInventoryBySku = new Map<string, ExistingInventoryRecord>();
  if (sourceBundle.existingInventory) {
    for (const record of sourceBundle.existingInventory) {
      existingInventoryBySku.set(normalizeSku(record.sku), record);
    }
  }

  const existingAssetsBySku = new Map<string, ExistingAssetsRecord>();
  if (sourceBundle.existingAssets) {
    for (const record of sourceBundle.existingAssets) {
      existingAssetsBySku.set(normalizeSku(record.sku), record);
    }
  }

  const allSkus = new Set<string>();
  for (const sku of existingFactsBySku.keys()) allSkus.add(sku);
  for (const sku of existingPricingBySku.keys()) allSkus.add(sku);
  for (const sku of existingInventoryBySku.keys()) allSkus.add(sku);
  for (const sku of existingAssetsBySku.keys()) allSkus.add(sku);
  for (const sku of pldsBySkuMap.keys()) allSkus.add(sku);
  for (const sku of msrpBySkuMap.keys()) allSkus.add(sku);
  for (const sku of inventoryBySkuMap.keys()) allSkus.add(sku);

  const products: RocktomicProductRecord[] = [];

  for (const sku of Array.from(allSkus).sort()) {
    const provenance: Record<string, FieldProvenanceEntry> = {};
    const warnings: string[] = [];

    const existingFact = existingFactsBySku.get(sku);
    const existingPricing = existingPricingBySku.get(sku);
    const existingInventoryRecord = existingInventoryBySku.get(sku);
    const existingAsset = existingAssetsBySku.get(sku);
    const pldsRecord = pldsBySkuMap.get(sku);
    const msrpRecord = msrpBySkuMap.get(sku);
    const inventoryRecord = inventoryBySkuMap.get(sku);
    const templateLinks = templateSkuMap[sku] ?? null;

    let productName: string | null = null;
    let category: string | null = null;
    let membershipAccess = "unknown";
    let labelSize: string | null = null;
    let containerSize: string | null = null;
    let productWeight: string | null = null;

    if (pldsRecord) {
      productName = pldsRecord.productName;
      category = pldsRecord.category;
      membershipAccess = pldsRecord.membershipAccess;
      labelSize = pldsRecord.labelSize;
      containerSize = pldsRecord.containerSize;
      productWeight = pldsRecord.productWeight;
      for (const [field, prov] of Object.entries(pldsRecord.provenance)) {
        provenance[field] = { source: prov.source, row: prov.row, column: prov.column, url: prov.url };
      }
    }

    if (!productName && existingFact?.productName) {
      productName = existingFact.productName ?? null;
      if (productName) {
        provenance.productName = { source: "existing_source_facts", url: "data/ecomviper/suppliers/rocktomic/latest/sourceFacts.json" };
      }
    }
    if (!productName && existingPricing?.productName) {
      productName = existingPricing.productName ?? null;
      if (productName) {
        provenance.productName = { source: "existing_pricing", url: "data/ecomviper/suppliers/rocktomic/latest/pricing.json" };
      }
    }
    if (!productName && msrpRecord?.productName) {
      productName = msrpRecord.productName;
      if (productName && msrpRecord.provenance.productName) {
        provenance.productName = { source: msrpRecord.provenance.productName.source, row: msrpRecord.provenance.productName.row, column: msrpRecord.provenance.productName.column, url: msrpRecord.provenance.productName.url };
      }
    }
    if (!category && existingFact?.category) {
      category = existingFact.category ?? null;
      if (category) {
        provenance.category = { source: "existing_source_facts", url: "data/ecomviper/suppliers/rocktomic/latest/sourceFacts.json" };
      }
    }

    let msrp: number | null = null;
    let wholesaleCost: number | null = null;
    let estimatedProfit: number | null = null;
    let estimatedMarginPct: number | null = null;
    let tiers: PricingBlock["tiers"] = {};

    if (msrpRecord) {
      msrp = msrpRecord.msrp;
      wholesaleCost = msrpRecord.wholesaleCost;
      estimatedProfit = msrpRecord.estimatedProfit;
      estimatedMarginPct = msrpRecord.estimatedMarginPct;
      tiers = { ...msrpRecord.tiers };
      for (const [field, prov] of Object.entries(msrpRecord.provenance)) {
        provenance[field] = { source: prov.source, row: prov.row, column: prov.column, url: prov.url };
      }
    } else if (existingPricing) {
      msrp = existingPricing.msrp ?? null;
      wholesaleCost = existingPricing.wholesaleCost ?? null;
      estimatedProfit = existingPricing.estimatedProfit ?? null;
      tiers = normalizeTierCosts(existingPricing.membershipTierCosts);
      if (msrp !== null || wholesaleCost !== null || Object.keys(tiers).length > 0) {
        provenance["pricing.msrp"] = { source: "existing_pricing", url: "data/ecomviper/suppliers/rocktomic/latest/pricing.json" };
      }
    }

    const pricing: PricingBlock = { msrp, wholesaleCost, estimatedProfit, estimatedMarginPct, currency: "USD", tiers };

    let inventoryStatus: InventoryBlock["status"] = "unknown";
    let rawInventoryValue: string | null = null;
    let replenishmentEta: string | null = null;
    let replenishmentComments: string | null = null;

    if (inventoryRecord) {
      inventoryStatus = inventoryRecord.inventoryStatus;
      rawInventoryValue = inventoryRecord.rawInventoryValue;
      replenishmentEta = inventoryRecord.replenishmentEta;
      replenishmentComments = inventoryRecord.replenishmentComments;
      for (const [field, prov] of Object.entries(inventoryRecord.provenance)) {
        provenance[field] = { source: prov.source, row: prov.row, column: prov.column, url: prov.url };
      }
    } else if (existingInventoryRecord) {
      inventoryStatus = normalizeInventoryStatus(existingInventoryRecord.inventoryStatus);
      rawInventoryValue = existingInventoryRecord.rawInventoryValue ?? null;
      if (inventoryStatus !== "unknown") {
        provenance["inventory.status"] = { source: "existing_inventory", url: "data/ecomviper/suppliers/rocktomic/latest/inventory.json" };
      }
    }

    const inventory: InventoryBlock = { status: inventoryStatus, rawInventoryValue, replenishmentEta, replenishmentComments };

    let coaUrl: string | null = null;
    let labelTemplateUrl: string | null = null;
    let mockupUrl: string | null = null;
    let catalogPage: number | null = null;

    if (existingAsset) {
      coaUrl = existingAsset.coaUrl ?? null;
      labelTemplateUrl = existingAsset.labelTemplateUrl ?? existingAsset.labelTemplateAiUrl ?? existingAsset.catalogTemplateUrl ?? null;
      mockupUrl = existingAsset.mockupUrl ?? existingAsset.mockupTemplateTifUrl ?? null;
      if (coaUrl) provenance.coaUrl = { source: "existing_assets", url: "data/ecomviper/suppliers/rocktomic/latest/assets.json" };
      if (labelTemplateUrl) provenance.labelTemplateUrl = { source: "existing_assets", url: "data/ecomviper/suppliers/rocktomic/latest/assets.json" };
      if (mockupUrl) provenance.mockupUrl = { source: "existing_assets", url: "data/ecomviper/suppliers/rocktomic/latest/assets.json" };
    }

    if (!coaUrl && existingAsset?.assets) {
      const coaAsset = existingAsset.assets.find((a) => /coa|certificate|analysis/i.test(a.url) || /coa|certificate/i.test(a.type ?? ""));
      if (coaAsset) {
        coaUrl = coaAsset.url;
        provenance.coaUrl = { source: "existing_assets_array", url: "data/ecomviper/suppliers/rocktomic/latest/assets.json" };
      }
    }

    if (templateLinks) {
      if (!labelTemplateUrl && templateLinks.labelUrl) {
        labelTemplateUrl = templateLinks.labelUrl;
        provenance.labelTemplateUrl = { source: "templates_html", url: templatesSourceUrl };
      }
      if (!mockupUrl && templateLinks.mockupUrl) {
        mockupUrl = templateLinks.mockupUrl;
        provenance.mockupUrl = { source: "templates_html", url: templatesSourceUrl };
      }
    }

    const existingFactSupplement = existingFact?.supplementFacts;
    const supplementStatus = existingFact
      ? classifySupplementFactsStatus({
          supplementFacts: existingFactSupplement,
          supplementFactsText: existingFact.supplementFactsText ?? null,
        })
      : "missing";

    let supplementFacts: SupplementFactsBlock = {
      status: supplementStatus,
      servingSize: null,
      servingsPerContainer: null,
      nutrientFacts: [],
      activeIngredients: [],
      otherIngredients: [],
    };

    if (existingFactSupplement && typeof existingFactSupplement === "object") {
      const facts = existingFactSupplement as Record<string, unknown>;
      supplementFacts = {
        status: supplementStatus,
        servingSize: (facts.servingSize || facts.serving_size) as string | null ?? null,
        servingsPerContainer: (facts.servingsPerContainer || facts.servings_per_container) as number | null ?? null,
        nutrientFacts: Array.isArray(facts.nutrientFacts || facts.nutrient_facts)
          ? ((facts.nutrientFacts || facts.nutrient_facts) as Array<Record<string, unknown>>).map((f) => ({
              name: String(f.name || ""),
              amount: typeof f.amount === "number" ? f.amount : null,
              unit: typeof f.unit === "string" ? f.unit : null,
              dailyValue: typeof f.dailyValue === "string" ? f.dailyValue : null,
              rawText: String(f.rawText || f.name || ""),
            }))
          : [],
        activeIngredients: Array.isArray(facts.activeIngredients || facts.active_ingredients)
          ? ((facts.activeIngredients || facts.active_ingredients) as Array<Record<string, unknown>>).map((f) => ({
              name: String(f.name || ""),
              amount: typeof f.amount === "number" ? f.amount : null,
              unit: typeof f.unit === "string" ? f.unit : null,
              rawText: String(f.rawText || f.name || ""),
            }))
          : [],
        otherIngredients: Array.isArray(facts.otherIngredients || facts.other_ingredients)
          ? ((facts.otherIngredients || facts.other_ingredients) as unknown[]).map(String)
          : [],
      };
      if (supplementStatus !== "missing" && supplementStatus !== "visual_only") {
        provenance["supplementFacts"] = { source: "existing_source_facts", url: "data/ecomviper/suppliers/rocktomic/latest/sourceFacts.json" };
      }
    }

    if (category && /apparel|clothing|shirt|hoodie|hat|jacket/i.test(category)) {
      supplementFacts = { status: "not_applicable", servingSize: null, servingsPerContainer: null, nutrientFacts: [], activeIngredients: [], otherIngredients: [] };
    }

    const record: RocktomicProductRecord = {
      sku,
      productName,
      category,
      membershipAccess,
      labelSize,
      containerSize,
      productWeight,
      pricing,
      inventory,
      coaUrl,
      labelTemplateUrl,
      mockupUrl,
      catalogPage,
      policyDocxParsed,
      policyDocxUrl,
      policyNormalizedSummary,
      supplementFacts,
      productFeatures: [],
      certifications: [],
      missingData: {} as MissingDataFlags,
      warnings,
      provenance,
    };

    record.missingData = buildMissingDataFlags(record);
    products.push(record);
  }

  const countsByCategory = countsByKey(products.map((p) => p.category ?? "uncategorized"));
  const countsByInventoryStatus = countsByKey(products.map((p) => p.inventory.status));
  const countsBySupplementFactsStatus = countsByKey(products.map((p) => p.supplementFacts.status));
  const countsByMissingDataType: Record<string, number> = {};
  for (const product of products) {
    for (const [key, isMissing] of Object.entries(product.missingData)) {
      if (isMissing) {
        countsByMissingDataType[key] = (countsByMissingDataType[key] ?? 0) + 1;
      }
    }
  }

  return {
    packageVersion: "1.0.0",
    generatedAt: nowIso(),
    sourceBundleId: sourceBundle.sourceBundleId,
    sourceHashes,
    productCount: products.length,
    countsByCategory,
    countsByInventoryStatus,
    countsBySupplementFactsStatus,
    countsByMissingDataType,
    sourceIdentityReport: {
      overallValid: sourceIdentityReport.overallValid,
      duplicateUrlCount: sourceIdentityReport.duplicateUrlWarnings.length,
      duplicateSheetIdCount: sourceIdentityReport.duplicateSheetIdWarnings.length,
      mislabelCount: sourceIdentityReport.mislabelWarnings.length,
    },
    products,
  };
}

export async function loadSourceBundleFromDir(bundleDir: string, overrideManifestPath?: string): Promise<SourceBundle> {
  // sources.json may be at bundleDir/sources.json or in the parent directory (root rocktomic dir)
  const candidateManifestPaths = [
    overrideManifestPath,
    path.join(bundleDir, "sources.json"),
    path.join(path.dirname(bundleDir), "sources.json"),
  ].filter(Boolean) as string[];

  let manifestText: string | null = null;
  let usedManifestPath = "";
  for (const candidatePath of candidateManifestPaths) {
    try {
      manifestText = await fs.readFile(candidatePath, "utf8");
      usedManifestPath = candidatePath;
      break;
    } catch {
      // try next candidate
    }
  }
  if (!manifestText) {
    throw new Error(`sources.json not found in bundle dir or parent: tried ${candidateManifestPaths.join(", ")}`);
  }
  const _ = usedManifestPath; // retained for potential debug use
  const manifest = JSON.parse(manifestText) as BundleManifest;

  async function readFileIfExists(filePath: string): Promise<string | null> {
    try {
      return await fs.readFile(filePath, "utf8");
    } catch {
      return null;
    }
  }

  async function readBinaryIfExists(filePath: string): Promise<Buffer | null> {
    try {
      return Buffer.from(await fs.readFile(filePath));
    } catch {
      return null;
    }
  }

  async function readJsonArrayIfExists<T>(filePath: string): Promise<T[] | null> {
    const text = await readFileIfExists(filePath);
    if (!text) return null;
    try {
      const parsed = JSON.parse(text) as unknown;
      return Array.isArray(parsed) ? (parsed as T[]) : null;
    } catch {
      return null;
    }
  }

  const pldsCsv = await readFileIfExists(path.join(bundleDir, "sheets", "plds_catalog.csv"));
  const msrpCsv = await readFileIfExists(path.join(bundleDir, "sheets", "msrp_profit_margins_report.csv"));
  const inventoryCsv = await readFileIfExists(path.join(bundleDir, "sheets", "inventory_report.csv"));
  const templatesHtml = await readFileIfExists(path.join(bundleDir, "templates", "templates.html"));
  const policyDocxBuffer = await readBinaryIfExists(path.join(bundleDir, "policies", "Order-Refund-Policy-Template.docx"));

  const existingSourceFacts = await readJsonArrayIfExists<ExistingSourceFact>(path.join(bundleDir, "sourceFacts.json"));
  const existingPricing = await readJsonArrayIfExists<ExistingPricingRecord>(path.join(bundleDir, "pricing.json"));
  const existingInventory = await readJsonArrayIfExists<ExistingInventoryRecord>(path.join(bundleDir, "inventory.json"));
  const existingAssets = await readJsonArrayIfExists<ExistingAssetsRecord>(path.join(bundleDir, "assets.json"));

  return {
    sourceBundleId: `bundle:${path.basename(bundleDir)}`,
    sourceDir: bundleDir,
    manifest,
    pldsCsv,
    msrpCsv,
    inventoryCsv,
    templatesHtml,
    policyDocxBuffer,
    catalogPdfPath: path.join(bundleDir, "catalog", "Supplement-Apparel-Catalog.pdf"),
    existingSourceFacts,
    existingPricing,
    existingInventory,
    existingAssets,
  };
}
