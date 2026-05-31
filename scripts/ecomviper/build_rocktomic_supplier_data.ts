import fs from "node:fs/promises";
import path from "node:path";
import {
  buildAuditRows,
  buildValidationReport,
  extractCatalogPdfSignals,
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
import { extractRocktomicCatalogLinkEvidence } from "../../lib/ecomviper/suppliers/rocktomic-pdf-assets";
import { extractRocktomicTemplateAssets } from "../../lib/ecomviper/suppliers/rocktomic-template-assets";
import { buildRocktomicSupplementFactsOcrEvidence } from "../../lib/ecomviper/suppliers/rocktomic-supplement-facts-ocr";

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

async function loadOcrFixtureFromEnv(): Promise<Array<{ sku: string; rawText: string; sourcePage?: number | null; sourceAsset?: string | null }>> {
  const fixturePath = process.env.ROCKTOMIC_OCR_FIXTURE_PATH?.trim();
  if (!fixturePath) return [];

  const absolutePath = path.isAbsolute(fixturePath) ? fixturePath : path.join(ROOT_DIR, fixturePath);
  const text = await fs.readFile(absolutePath, "utf8");
  const parsed = JSON.parse(text) as unknown;

  if (Array.isArray(parsed)) {
    const rows: Array<{ sku: string; rawText: string; sourcePage?: number | null; sourceAsset?: string | null }> = [];
    for (const entry of parsed) {
      if (!entry || typeof entry !== "object") continue;
      const row = entry as Record<string, unknown>;
      if (typeof row.sku !== "string" || typeof row.rawText !== "string") continue;
      rows.push({
        sku: row.sku,
        rawText: row.rawText,
        sourcePage: typeof row.sourcePage === "number" ? row.sourcePage : null,
        sourceAsset: typeof row.sourceAsset === "string" ? row.sourceAsset : null,
      });
    }
    return rows;
  }

  if (parsed && typeof parsed === "object") {
    const rows: Array<{ sku: string; rawText: string; sourcePage?: number | null; sourceAsset?: string | null }> = [];
    for (const [sku, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === "string") {
        rows.push({ sku, rawText: value, sourcePage: null, sourceAsset: "ocr_fixture" });
        continue;
      }
      if (value && typeof value === "object") {
        const record = value as Record<string, unknown>;
        if (typeof record.rawText !== "string") continue;
        rows.push({
          sku,
          rawText: record.rawText,
          sourcePage: typeof record.sourcePage === "number" ? record.sourcePage : null,
          sourceAsset: typeof record.sourceAsset === "string" ? record.sourceAsset : "ocr_fixture",
        });
      }
    }
    return rows;
  }

  return [];
}

async function main(): Promise<void> {
  log("Rocktomic offline build phase3.5: starting");
  await fs.mkdir(LATEST_DIR, { recursive: true });

  const registry = await loadSourceRegistry(SOURCES_PATH);
  const sourceErrors: Array<{ sourceId: string; error: string }> = [];

  let pricingRows: PricingRecord[] = [];
  let inventoryRows: InventoryRecord[] = [];
  let catalogSkus: string[] = [];
  let supplementFactsBySku: Record<string, string> = {};
  let catalogLinkExtraction: ReturnType<typeof extractRocktomicCatalogLinkEvidence> = {
    skusDiscovered: [],
    evidence: [],
    skuMappings: [],
    unmappedEvidence: [],
    counts: {
      linksDetected: 0,
      coaLinksMapped: 0,
      templateLinksMapped: 0,
      pricingLinksMapped: 0,
      unknownLinks: 0,
      unmappedLinks: 0,
    },
  };
  let templateExtraction: ReturnType<typeof extractRocktomicTemplateAssets> = {
    assetsBySku: [],
    evidence: [],
    counts: {
      skusDetected: 0,
      labelTemplatesFound: 0,
      mockupTemplatesFound: 0,
      readyForOptiPixelAssets: 0,
    },
  };
  let templatesSourceUrl = "";

  for (const source of registry.sources) {
    log(`source: ${source.id}`);
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
        const parsedSignals = extractCatalogPdfSignals(pdfBytes);
        catalogSkus = parsedSignals.skus;
        supplementFactsBySku = parsedSignals.supplementFactsBySku;
        catalogLinkExtraction = extractRocktomicCatalogLinkEvidence({
          pdfBytes,
          productNameBySku: Object.fromEntries(pricingRows.map((entry) => [entry.sku, entry.productName || null])),
        });
        continue;
      }
      if (source.id === "label_mockup_templates") {
        const html = (await fetchWithTimeout(source.url, false)) as string;
        templatesSourceUrl = source.url;
        templateExtraction = extractRocktomicTemplateAssets({ html, sourcePageUrl: source.url });
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
  const catalogLinksBySku = Object.fromEntries(catalogLinkExtraction.skuMappings.map((entry) => [entry.sku, entry]));
  const templateBySku = Object.fromEntries(templateExtraction.assetsBySku.map((entry) => [entry.sku, entry]));

  const ocrFixtureEntries = await loadOcrFixtureFromEnv();
  const fallbackOcrEntries = Object.entries(supplementFactsBySku)
    .filter(([, rawText]) => Boolean(rawText && rawText.trim()))
    .map(([sku, rawText]) => ({
      sku,
      rawText,
      sourcePage: catalogLinksBySku[normalizeRocktomicSku(sku)]?.catalogPage ?? null,
      sourceAsset: "catalog_pdf_text_layer_fallback",
    }));

  const ocrEntries = ocrFixtureEntries.length > 0 ? ocrFixtureEntries : fallbackOcrEntries;
  const ocrEvidence = buildRocktomicSupplementFactsOcrEvidence({ entries: ocrEntries });
  const ocrBySku = Object.fromEntries(ocrEvidence.map((entry) => [entry.sku, entry]));

  const allSkus = Array.from(
    new Set([
      ...catalogSkus,
      ...pricingRows.map((entry) => entry.sku),
      ...inventoryRows.map((entry) => entry.sku),
      ...catalogLinkExtraction.skusDiscovered,
      ...templateExtraction.assetsBySku.map((entry) => entry.sku),
      ...ocrEvidence.map((entry) => entry.sku),
    ])
  )
    .map((sku) => normalizeRocktomicSku(sku))
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right));

  const sourceFacts: SourceFactRecord[] = allSkus.map((sku) => {
    const pricing = pricingBySku[sku];
    const ocr = ocrBySku[sku];
    const supplementFactsText = ocr?.rawText || supplementFactsBySku[sku] || null;
    const supplementFacts = ocr
      ? {
          servingSize: ocr.parsed.servingSize,
          servingsPerContainer: ocr.parsed.servingsPerContainer,
          activeIngredients: ocr.parsed.activeIngredients,
          amountPerServing: ocr.parsed.amountPerServing,
          dailyValuePercentages: ocr.parsed.dailyValuePercentages,
          otherIngredients: ocr.parsed.otherIngredients,
          suggestedUse: ocr.parsed.suggestedUse,
          warnings: ocr.parsed.warnings,
          storage: ocr.parsed.storage,
        }
      : null;

    const record: SourceFactRecord = {
      sku,
      productName: pricing?.productName || null,
      category: null,
      supplementFactsText,
      supplementFacts,
      sourceEvidence: ocr
        ? {
            supplementFacts: {
              sourceMethod: "ocr",
              sourcePage: ocr.sourcePage,
              sourceAsset: ocr.sourceAsset,
              confidence: ocr.confidence,
              needsReview: ocr.needsReview,
              parseWarnings: ocr.parseWarnings,
            },
          }
        : undefined,
      sourceReferences: [
        supplementFactsText ? "catalog_pdf" : null,
        pricing ? "plds_catalog" : null,
        ocr ? "ocr_evidence" : null,
      ].filter((value): value is string => Boolean(value)),
      missingFields: [],
    };

    record.missingFields = [
      record.productName ? null : "productName",
      record.category ? null : "category",
      record.supplementFacts?.servingSize || /serving\s*size/i.test(record.supplementFactsText || "") ? null : "supplementFacts.servingSize",
      record.supplementFacts?.servingsPerContainer || /servings?\s*per\s*container/i.test(record.supplementFactsText || "")
        ? null
        : "supplementFacts.servingsPerContainer",
      (record.supplementFacts?.activeIngredients.length || 0) > 0 || /active\s+ingredients?/i.test(record.supplementFactsText || "")
        ? null
        : "supplementFacts.activeIngredients",
      ocr ? null : "supplementFacts.ocrEvidence",
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
    const catalogLinks = catalogLinksBySku[sku];
    const templateAssets = templateBySku[sku];

    const coaUrl = catalogLinks?.links.coaUrl || null;
    const catalogTemplateUrl = catalogLinks?.links.labelAnd3dMockupTemplateUrl || null;
    const labelTemplateAiUrl = templateAssets?.templateAssets.labelTemplateAi?.url || null;
    const mockupTemplateTifUrl = templateAssets?.templateAssets.mockupTemplateTif?.url || null;

    const labelTemplateUrl = labelTemplateAiUrl || catalogTemplateUrl;
    const mockupUrl = mockupTemplateTifUrl || catalogTemplateUrl;

    const record: AssetsRecord = {
      sku,
      coaUrl,
      catalogTemplateUrl,
      labelTemplateAiUrl,
      mockupTemplateTifUrl,
      labelTemplateUrl,
      mockupUrl,
      assets: [
        coaUrl
          ? {
              role: "coa",
              url: coaUrl,
              source: "catalog_pdf_annotation",
              confidence: "high",
            }
          : null,
        catalogTemplateUrl
          ? {
              role: "catalog_template",
              url: catalogTemplateUrl,
              source: "catalog_pdf_annotation",
              confidence: "high",
            }
          : null,
        labelTemplateAiUrl
          ? {
              role: "label_template",
              format: "ai",
              url: labelTemplateAiUrl,
              source: "templates_page",
              confidence: "high",
            }
          : null,
        mockupTemplateTifUrl
          ? {
              role: "mockup_template",
              format: "tif",
              url: mockupTemplateTifUrl,
              source: "templates_page",
              confidence: "high",
            }
          : null,
      ].filter((value): value is NonNullable<AssetsRecord["assets"][number]> => Boolean(value)),
      assetReadiness: {
        hasCoa: Boolean(coaUrl),
        hasLabelTemplateAi: Boolean(labelTemplateAiUrl),
        hasMockupTemplateTif: Boolean(mockupTemplateTifUrl),
        readyForProductEditor: Boolean(coaUrl && (labelTemplateAiUrl || catalogTemplateUrl)),
        readyForOptiPixelAssets: Boolean(labelTemplateAiUrl && mockupTemplateTifUrl),
        readyForChannelImageGeneration: Boolean(labelTemplateAiUrl && mockupTemplateTifUrl),
      },
      sourceReferences: [
        coaUrl ? "catalog_pdf" : null,
        catalogTemplateUrl ? "catalog_pdf" : null,
        labelTemplateAiUrl ? "label_mockup_templates" : null,
        mockupTemplateTifUrl ? "label_mockup_templates" : null,
      ].filter((value): value is string => Boolean(value)),
      missingFields: [],
    };

    record.missingFields = [
      coaUrl ? null : "coaUrl",
      labelTemplateAiUrl ? null : "labelTemplateAiUrl",
      mockupTemplateTifUrl ? null : "mockupTemplateTifUrl",
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
  await fs.writeFile(path.join(LATEST_DIR, "catalog-link-evidence.json"), JSON.stringify(catalogLinkExtraction, null, 2));
  await fs.writeFile(path.join(LATEST_DIR, "template-asset-evidence.json"), JSON.stringify(templateExtraction, null, 2));
  await fs.writeFile(path.join(LATEST_DIR, "ocr-evidence.json"), JSON.stringify(ocrEvidence, null, 2));

  const ocrSucceeded = ocrEvidence.filter((entry) => !entry.needsReview).length;
  const ocrPartial = ocrEvidence.filter((entry) => entry.needsReview).length;

  log(`skus_discovered: ${allSkus.length}`);
  log(`catalog_links_mapped: ${catalogLinkExtraction.counts.linksDetected}`);
  log(`coa_links_mapped: ${catalogLinkExtraction.counts.coaLinksMapped}`);
  log(`template_links_mapped: ${catalogLinkExtraction.counts.templateLinksMapped}`);
  log(`pricing_sheet_links_mapped: ${catalogLinkExtraction.counts.pricingLinksMapped}`);
  log(`label_template_ai_found: ${templateExtraction.counts.labelTemplatesFound}`);
  log(`mockup_template_tif_found: ${templateExtraction.counts.mockupTemplatesFound}`);
  log(`ocr_attempted: ${ocrEvidence.length}`);
  log(`ocr_succeeded: ${ocrSucceeded}`);
  log(`ocr_partial_or_low_confidence: ${ocrPartial}`);
  log(`skus_blocked: ${validationReport.blockedSkuCount}`);

  const topBlockingCounts = new Map<string, number>();
  for (const sku of validationReport.skuValidationResults) {
    for (const defect of sku.blockingDefects) {
      topBlockingCounts.set(defect.field, (topBlockingCounts.get(defect.field) || 0) + 1);
    }
  }
  const topBlocking = Array.from(topBlockingCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([field, count]) => `${field}:${count}`)
    .join(", ");
  log(`top_blocking_defect_types: ${topBlocking || "none"}`);

  if (!templatesSourceUrl) {
    log("warning: templates source not found in registry run");
  }
  if (ocrFixtureEntries.length === 0) {
    log("ocr_mode: fallback_catalog_text (set ROCKTOMIC_OCR_FIXTURE_PATH for deterministic OCR fixtures)");
  } else {
    log(`ocr_mode: fixture (${ocrFixtureEntries.length} rows)`);
  }

  log(`completed: ${allSkus.length} SKUs, ${sourceErrors.length} source errors`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
