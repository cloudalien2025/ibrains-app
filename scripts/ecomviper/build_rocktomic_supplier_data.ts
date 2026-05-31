import fs from "node:fs/promises";
import path from "node:path";
import {
  buildAuditRows,
  buildValidationReport,
  extractCatalogPdfSignals,
  extractTemplateLinks,
  loadSourceRegistry,
  normalizeInventoryStatus,
  normalizeRocktomicSku,
  parseInventoryCsv,
  parsePricingCsv,
  toAuditCsv,
  toGoogleSheetCsvUrl,
  type AssetsRecord,
  type InventoryRecord,
  type PricingRecord,
  type SourceFactRecord,
} from "../../lib/ecomviper/suppliers/rocktomic-offline-audit";

const ROOT_DIR = process.cwd();
const PACKAGE_DIR = path.join(ROOT_DIR, "data/ecomviper/suppliers/rocktomic");
const LATEST_DIR = path.join(PACKAGE_DIR, "latest");
const SOURCES_PATH = path.join(PACKAGE_DIR, "sources.json");
const FETCH_TIMEOUT_MS = 30_000;

function log(line: string): void {
  process.stdout.write(`${line}\n`);
}

async function fetchWithTimeout(url: string, asBinary = false): Promise<string | ArrayBuffer> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    if (asBinary) return await response.arrayBuffer();
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function bySku<T extends { sku: string }>(records: T[]): Record<string, T> {
  return Object.fromEntries(records.map((record) => [record.sku, record]));
}

async function main(): Promise<void> {
  log("Rocktomic offline build phase2: starting");
  await fs.mkdir(LATEST_DIR, { recursive: true });

  const registry = await loadSourceRegistry(SOURCES_PATH);
  const sourceErrors: Array<{ sourceId: string; error: string }> = [];

  let pricingRows: PricingRecord[] = [];
  let inventoryRows: InventoryRecord[] = [];
  let catalogSkus: string[] = [];
  let coaBySku: Record<string, string> = {};
  let supplementFactsBySku: Record<string, string> = {};
  let labelTemplateBySku: Record<string, string> = {};
  let mockupBySku: Record<string, string> = {};

  for (const source of registry.sources) {
    log(`source: ${source.id} -> ${source.url}`);
    try {
      if (source.type === "google_sheet") {
        const csvUrl = toGoogleSheetCsvUrl(source.url);
        if (!csvUrl) throw new Error("Unable to build Google Sheets CSV URL");
        const csvBody = (await fetchWithTimeout(csvUrl, false)) as string;
        if (source.id === "inventory_report") {
          inventoryRows = parseInventoryCsv(csvBody);
        } else if (source.id === "msrp_profit_margins_report" || source.id === "plds_catalog") {
          pricingRows = parsePricingCsv(csvBody);
        }
        continue;
      }
      if (source.id === "catalog_pdf") {
        const pdfBytes = (await fetchWithTimeout(source.url, true)) as ArrayBuffer;
        const parsed = extractCatalogPdfSignals(pdfBytes);
        catalogSkus = parsed.skus;
        coaBySku = parsed.coaBySku;
        supplementFactsBySku = parsed.supplementFactsBySku;
        continue;
      }
      if (source.id === "label_mockup_templates") {
        const html = (await fetchWithTimeout(source.url, false)) as string;
        const parsed = extractTemplateLinks(html);
        labelTemplateBySku = parsed.labelTemplateBySku;
        mockupBySku = parsed.mockupBySku;
        continue;
      }
      await fetchWithTimeout(source.url, false);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      sourceErrors.push({ sourceId: source.id, error: message });
      log(`source_error: ${source.id} -> ${message}`);
    }
  }

  const pricingBySku = bySku(pricingRows);
  const inventoryBySku = bySku(inventoryRows);
  const allSkus = Array.from(
    new Set([
      ...catalogSkus,
      ...pricingRows.map((entry) => entry.sku),
      ...inventoryRows.map((entry) => entry.sku),
      ...Object.keys(coaBySku),
      ...Object.keys(labelTemplateBySku),
      ...Object.keys(mockupBySku),
    ])
  )
    .map((sku) => normalizeRocktomicSku(sku))
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right));

  const sourceFacts: SourceFactRecord[] = allSkus.map((sku) => {
    const pricing = pricingBySku[sku];
    const supplementFactsText = supplementFactsBySku[sku] || null;
    const record: SourceFactRecord = {
      sku,
      productName: pricing?.productName || null,
      category: null,
      supplementFactsText,
      sourceReferences: [
        supplementFactsText ? "catalog_pdf" : null,
        pricing ? "plds_catalog" : null,
      ].filter((value): value is string => Boolean(value)),
      missingFields: [],
    };
    record.missingFields = [
      record.productName ? null : "productName",
      record.category ? null : "category",
      record.supplementFactsText ? null : "supplementFactsText",
    ].filter((value): value is string => Boolean(value));
    return record;
  });

  const pricing: PricingRecord[] = allSkus.map((sku) => {
    const record = pricingBySku[sku];
    if (record) return record;
    return {
      sku,
      productName: null,
      wholesaleCost: null,
      msrp: null,
      estimatedProfit: null,
      membershipTierCosts: {},
      sourceReferences: [],
      missingFields: ["productName", "wholesaleCost", "msrp", "estimatedProfit", "membershipTierCosts"],
    } satisfies PricingRecord;
  });

  const inventory: InventoryRecord[] = allSkus.map((sku) => {
    const record = inventoryBySku[sku];
    if (record) return record;
    return {
      sku,
      rawInventoryValue: null,
      inventoryStatus: normalizeInventoryStatus(null),
      sourceReferences: [],
      missingFields: ["rawInventoryValue", "inventoryStatus"],
    } satisfies InventoryRecord;
  });

  const assets: AssetsRecord[] = allSkus.map((sku) => {
    const coaUrl = coaBySku[sku] || null;
    const labelTemplateUrl = labelTemplateBySku[sku] || null;
    const mockupUrl = mockupBySku[sku] || null;
    const record: AssetsRecord = {
      sku,
      coaUrl,
      labelTemplateUrl,
      mockupUrl,
      sourceReferences: [
        coaUrl ? "catalog_pdf" : null,
        labelTemplateUrl ? "label_mockup_templates" : null,
        mockupUrl ? "label_mockup_templates" : null,
      ].filter((value): value is string => Boolean(value)),
      missingFields: [],
    };
    record.missingFields = [
      coaUrl ? null : "coaUrl",
      labelTemplateUrl ? null : "labelTemplateUrl",
      mockupUrl ? null : "mockupUrl",
    ].filter((value): value is string => Boolean(value));
    return record;
  });

  const generatedAt = new Date().toISOString();
  const validationReport = buildValidationReport({
    generatedAt,
    packageVersion: registry.version ?? null,
    sourceFacts,
    pricing,
    inventory,
    assets,
    sourceErrors,
  });
  const auditRows = buildAuditRows({
    sourceFactsBySku: bySku(sourceFacts),
    pricingBySku: bySku(pricing),
    inventoryBySku: bySku(inventory),
    assetsBySku: bySku(assets),
    sourceErrors,
    skuValidationBySku: Object.fromEntries(validationReport.skuValidationResults.map((result) => [result.sku, result])),
  });
  const auditCsv = toAuditCsv(auditRows);

  await fs.writeFile(path.join(LATEST_DIR, "sourceFacts.json"), JSON.stringify(sourceFacts, null, 2));
  await fs.writeFile(path.join(LATEST_DIR, "pricing.json"), JSON.stringify(pricing, null, 2));
  await fs.writeFile(path.join(LATEST_DIR, "inventory.json"), JSON.stringify(inventory, null, 2));
  await fs.writeFile(path.join(LATEST_DIR, "assets.json"), JSON.stringify(assets, null, 2));
  await fs.writeFile(path.join(LATEST_DIR, "audit.csv"), `${auditCsv}\n`);
  await fs.writeFile(path.join(LATEST_DIR, "validation-report.json"), JSON.stringify(validationReport, null, 2));

  log(`completed: ${allSkus.length} SKUs, ${sourceErrors.length} source errors`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
