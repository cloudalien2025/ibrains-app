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
import {
  extractRocktomicTemplateAssetsFromTemplatesPage,
  type RocktomicTemplateAssetExtractionResult,
} from "../../lib/ecomviper/suppliers/rocktomic-template-assets";
import { buildRocktomicSupplementFactsOcrEvidence } from "../../lib/ecomviper/suppliers/rocktomic-supplement-facts-ocr";
import {
  extractRocktomicAiLabelTextForSku,
  maskAssetUrlForLogs,
  type RocktomicAiLabelTextEvidenceRecord,
} from "../../lib/ecomviper/suppliers/rocktomic-ai-label-text";

const ROOT_DIR = process.cwd();
const PACKAGE_DIR = path.join(ROOT_DIR, "data/ecomviper/suppliers/rocktomic");
const LATEST_DIR = path.join(PACKAGE_DIR, "latest");
const SOURCES_PATH = path.join(PACKAGE_DIR, "sources.json");
const FETCH_TIMEOUT_MS = 30_000;
const AI_POLICY_VERSION = "rocktomic_phase3_6_v1";

function log(line: string): void {
  process.stdout.write(`${line}\n`);
}

async function readJsonIfPresent<T>(absolutePath: string): Promise<T | null> {
  try {
    const text = await fs.readFile(absolutePath, "utf8");
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
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

async function mapWithConcurrency<T, R>(values: T[], concurrency: number, mapper: (value: T) => Promise<R>): Promise<R[]> {
  const safeConcurrency = Math.max(1, concurrency);
  const results: R[] = new Array(values.length);
  let index = 0;
  const workers = new Array(Math.min(safeConcurrency, values.length)).fill(null).map(async () => {
    while (true) {
      const current = index;
      index += 1;
      if (current >= values.length) break;
      results[current] = await mapper(values[current]);
    }
  });
  await Promise.all(workers);
  return results;
}

async function main(): Promise<void> {
  log("Rocktomic offline build phase3.6: starting");
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
  let templateExtraction: RocktomicTemplateAssetExtractionResult = {
    assetsBySku: [],
    evidence: [],
    counts: {
      skusDetected: 0,
      labelTemplatesFound: 0,
      mockupTemplatesFound: 0,
      readyForOptiPixelAssets: 0,
      containersListed: 0,
      blobAssetsScanned: 0,
    },
  };

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
        templateExtraction = await extractRocktomicTemplateAssetsFromTemplatesPage({ html, sourcePageUrl: source.url });
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

  const previousAiEvidenceDoc = await readJsonIfPresent<{ records?: RocktomicAiLabelTextEvidenceRecord[] }>(
    path.join(LATEST_DIR, "ai-label-text-evidence.json")
  );
  const previousAiEvidenceBySku = new Map(
    (previousAiEvidenceDoc?.records || [])
      .filter((entry) => entry && typeof entry === "object" && typeof entry.sku === "string")
      .map((entry) => [normalizeRocktomicSku(entry.sku), entry] as const)
  );

  const aiInputRows = templateExtraction.assetsBySku
    .map((entry) => {
      const aiAsset = entry.templateAssets.labelTemplateAi;
      return {
        sku: entry.sku,
        url: aiAsset?.url || null,
        fileName: aiAsset?.fileName || `${entry.sku}.ai`,
        templatePageLastUpdated: aiAsset?.lastUpdated || null,
      };
    })
    .filter((entry) => Boolean(entry.url));

  const aiEvidenceRows = await mapWithConcurrency(aiInputRows, 4, async (entry) => {
    const sku = normalizeRocktomicSku(entry.sku);
    const previous = previousAiEvidenceBySku.get(sku);
    try {
      return await extractRocktomicAiLabelTextForSku({
        sku,
        assetUrl: entry.url!,
        fileName: entry.fileName,
        templatePageLastUpdated: entry.templatePageLastUpdated,
        previousEvidence: previous,
      });
    } catch (error) {
      return {
        sku,
        url: entry.url!,
        fileName: entry.fileName,
        format: "ai" as const,
        assetRole: "label_template" as const,
        templatePageLastUpdated: entry.templatePageLastUpdated,
        httpEtag: null,
        httpLastModified: null,
        httpContentLength: null,
        httpContentType: null,
        lastCheckedAt: new Date().toISOString(),
        source: "templates_page" as const,
        compatibility: null,
        extractionStatus: "extraction_error" as const,
        extractedAt: null,
        extractionMethod: "none" as const,
        tempDownloadedBytes: null,
        rawText: null,
        normalizedLabelText: null,
        parsedFacts: null,
        confidence: null,
        needsReview: true,
        parseWarnings: [],
        errorDetail: error instanceof Error ? error.message : "ai_extraction_error",
      };
    }
  });
  const aiEvidenceBySku = new Map(aiEvidenceRows.map((entry) => [entry.sku, entry]));

  const fallbackOcrEntries = Object.entries(supplementFactsBySku)
    .filter(([, rawText]) => Boolean(rawText && rawText.trim()))
    .map(([sku, rawText]) => ({
      sku: normalizeRocktomicSku(sku),
      rawText,
      sourcePage: catalogLinksBySku[normalizeRocktomicSku(sku)]?.catalogPage ?? null,
      sourceAsset: "catalog_pdf_text_layer_fallback",
    }));
  const fallbackOcrBySku = new Map(fallbackOcrEntries.map((entry) => [entry.sku, entry]));

  const ocrFixtureEntries = await loadOcrFixtureFromEnv();
  const ocrFixtureBySku = new Map(
    ocrFixtureEntries.map((entry) => [
      normalizeRocktomicSku(entry.sku),
      {
        sku: normalizeRocktomicSku(entry.sku),
        rawText: entry.rawText,
        sourcePage: entry.sourcePage ?? null,
        sourceAsset: entry.sourceAsset ?? "ocr_fixture",
      },
    ])
  );

  const ocrFallbackSkus = Array.from(aiEvidenceBySku.values())
    .filter((entry) => entry.extractionStatus !== "success" && entry.extractionStatus !== "reused_cached")
    .map((entry) => entry.sku);

  const ocrEntries: Array<{ sku: string; rawText: string; sourcePage: number | null; sourceAsset: string | null }> = [];
  for (const sku of ocrFallbackSkus) {
    const entry = ocrFixtureBySku.get(sku) || fallbackOcrBySku.get(sku);
    if (!entry) continue;
    ocrEntries.push({
      sku: entry.sku,
      rawText: entry.rawText,
      sourcePage: entry.sourcePage ?? null,
      sourceAsset: entry.sourceAsset ?? null,
    });
  }

  const ocrEvidence = buildRocktomicSupplementFactsOcrEvidence({ entries: ocrEntries });
  const ocrBySku = Object.fromEntries(ocrEvidence.map((entry) => [entry.sku, entry]));

  const allSkus = Array.from(
    new Set([
      ...catalogSkus,
      ...pricingRows.map((entry) => entry.sku),
      ...inventoryRows.map((entry) => entry.sku),
      ...catalogLinkExtraction.skusDiscovered,
      ...templateExtraction.assetsBySku.map((entry) => entry.sku),
      ...aiEvidenceRows.map((entry) => entry.sku),
      ...ocrEvidence.map((entry) => entry.sku),
    ])
  )
    .map((sku) => normalizeRocktomicSku(sku))
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right));

  const sourceFacts: SourceFactRecord[] = allSkus.map((sku) => {
    const pricing = pricingBySku[sku];
    const aiEvidence = aiEvidenceBySku.get(sku);
    const ocr = ocrBySku[sku];
    const preferredFacts = aiEvidence?.parsedFacts || ocr?.parsed || null;
    const preferredEvidenceMethod = aiEvidence?.parsedFacts ? "ai_pdf_text" : ocr ? "ocr" : null;

    const supplementFactsText = aiEvidence?.normalizedLabelText || aiEvidence?.rawText || ocr?.rawText || supplementFactsBySku[sku] || null;
    const preferredDirections =
      preferredEvidenceMethod === "ai_pdf_text"
        ? (preferredFacts as { directions?: string | null } | null)?.directions || null
        : (preferredFacts as { suggestedUse?: string | null } | null)?.suggestedUse || null;

    const supplementFacts = preferredFacts
      ? {
          servingSize: preferredFacts.servingSize,
          servingsPerContainer: preferredFacts.servingsPerContainer,
          activeIngredients: preferredFacts.activeIngredients,
          amountPerServing: preferredFacts.amountPerServing,
          dailyValuePercentages: preferredFacts.dailyValuePercentages,
          otherIngredients: preferredFacts.otherIngredients,
          suggestedUse: preferredDirections,
          warnings: preferredFacts.warnings,
          storage: preferredFacts.storage,
        }
      : null;

    const aiWarnings = aiEvidence?.parseWarnings || [];
    const ocrWarnings = ocr?.parseWarnings || [];

    const record: SourceFactRecord = {
      sku,
      productName: pricing?.productName || null,
      category: null,
      supplementFactsText,
      supplementFacts,
      directions: preferredDirections,
      warnings: preferredFacts?.warnings || null,
      sourceEvidence:
        preferredEvidenceMethod === "ai_pdf_text" && aiEvidence
          ? {
              supplementFacts: {
                sourceMethod: "ai_pdf_text",
                sourcePage: null,
                sourceAsset: aiEvidence.fileName,
                sourceUrl: aiEvidence.url,
                sourceFileName: aiEvidence.fileName,
                templatePageLastUpdated: aiEvidence.templatePageLastUpdated,
                httpEtag: aiEvidence.httpEtag,
                httpLastModified: aiEvidence.httpLastModified,
                httpContentLength: aiEvidence.httpContentLength,
                httpContentType: aiEvidence.httpContentType,
                confidence: aiEvidence.confidence || "low",
                needsReview: aiEvidence.needsReview,
                parseWarnings: aiEvidence.parseWarnings,
              },
            }
          : ocr
            ? {
                supplementFacts: {
                  sourceMethod: "ocr",
                  sourcePage: ocr.sourcePage,
                  sourceAsset: ocr.sourceAsset,
                  sourceUrl: null,
                  sourceFileName: null,
                  templatePageLastUpdated: null,
                  httpEtag: null,
                  httpLastModified: null,
                  httpContentLength: null,
                  httpContentType: null,
                  confidence: ocr.confidence,
                  needsReview: ocr.needsReview,
                  parseWarnings: ocr.parseWarnings,
                },
              }
            : undefined,
      sourceReferences: [
        supplementFactsText ? "catalog_pdf" : null,
        pricing ? "plds_catalog" : null,
        aiEvidence ? "label_mockup_templates" : null,
        ocr ? "ocr_evidence" : null,
      ].filter((value): value is string => Boolean(value)),
      missingFields: [],
    };

    record.missingFields = [
      record.productName ? null : "productName",
      record.category ? null : "category",
      record.supplementFacts?.servingSize ? null : "supplementFacts.servingSize",
      record.supplementFacts?.servingsPerContainer ? null : "supplementFacts.servingsPerContainer",
      (record.supplementFacts?.activeIngredients.length || 0) > 0 || (record.supplementFacts?.amountPerServing.length || 0) > 0
        ? null
        : "supplementFacts.activeIngredients",
      record.sourceEvidence?.supplementFacts ? null : "supplementFacts.aiOrOcrEvidence",
      ...aiWarnings.map((warning) => `ai_parse_warning:${warning}`),
      ...ocrWarnings.map((warning) => `ocr_parse_warning:${warning}`),
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
    const aiEvidence = aiEvidenceBySku.get(sku);

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
      templatePageLastUpdated: templateAssets?.templateAssets.labelTemplateAi?.lastUpdated || null,
      httpEtag: aiEvidence?.httpEtag || null,
      httpLastModified: aiEvidence?.httpLastModified || null,
      httpContentLength: aiEvidence?.httpContentLength || null,
      httpContentType: aiEvidence?.httpContentType || null,
      lastCheckedAt: aiEvidence?.lastCheckedAt || null,
      extractedAt: aiEvidence?.extractedAt || null,
      extractionStatus: aiEvidence?.extractionStatus || null,
      extractionMethod: aiEvidence?.extractionMethod || null,
      readyForAiLabelTextExtraction: Boolean(labelTemplateAiUrl),
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
              confidence: aiEvidence?.extractionStatus === "success" || aiEvidence?.extractionStatus === "reused_cached" ? "high" : "medium",
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

  const aiArtifact = {
    supplierSlug: "rocktomic",
    generatedAt,
    policyVersion: AI_POLICY_VERSION,
    records: aiEvidenceRows,
  };

  await fs.writeFile(path.join(LATEST_DIR, "sourceFacts.json"), JSON.stringify(sourceFacts, null, 2));
  await fs.writeFile(path.join(LATEST_DIR, "pricing.json"), JSON.stringify(pricing, null, 2));
  await fs.writeFile(path.join(LATEST_DIR, "inventory.json"), JSON.stringify(inventory, null, 2));
  await fs.writeFile(path.join(LATEST_DIR, "assets.json"), JSON.stringify(assets, null, 2));
  await fs.writeFile(path.join(LATEST_DIR, "audit.csv"), `${auditCsv}\n`);
  await fs.writeFile(path.join(LATEST_DIR, "validation-report.json"), JSON.stringify(validationReport, null, 2));
  await fs.writeFile(path.join(LATEST_DIR, "catalog-link-evidence.json"), JSON.stringify(catalogLinkExtraction, null, 2));
  await fs.writeFile(path.join(LATEST_DIR, "template-asset-evidence.json"), JSON.stringify(templateExtraction, null, 2));
  await fs.writeFile(path.join(LATEST_DIR, "ocr-evidence.json"), JSON.stringify(ocrEvidence, null, 2));
  await fs.writeFile(path.join(LATEST_DIR, "ai-label-text-evidence.json"), JSON.stringify(aiArtifact, null, 2));

  const aiAttempted = aiEvidenceRows.length;
  const aiReused = aiEvidenceRows.filter((entry) => entry.extractionStatus === "reused_cached").length;
  const aiSuccess = aiEvidenceRows.filter((entry) => entry.extractionStatus === "success" || entry.extractionStatus === "reused_cached").length;
  const aiNeedsReview = aiEvidenceRows.filter(
    (entry) => (entry.extractionStatus === "success" || entry.extractionStatus === "reused_cached") && entry.needsReview
  ).length;
  const aiNonPdf = aiEvidenceRows.filter((entry) => entry.extractionStatus === "non_pdf_ai").length;
  const aiNoText = aiEvidenceRows.filter((entry) => entry.extractionStatus === "no_extractable_text").length;
  const aiErrors = aiEvidenceRows.filter((entry) => entry.extractionStatus === "extraction_error").length;

  const ocrSucceeded = ocrEvidence.filter((entry) => !entry.needsReview).length;
  const ocrPartial = ocrEvidence.filter((entry) => entry.needsReview).length;

  log(`skus_discovered: ${allSkus.length}`);
  log(`catalog_links_mapped: ${catalogLinkExtraction.counts.linksDetected}`);
  log(`coa_links_mapped: ${catalogLinkExtraction.counts.coaLinksMapped}`);
  log(`template_links_mapped: ${catalogLinkExtraction.counts.templateLinksMapped}`);
  log(`pricing_sheet_links_mapped: ${catalogLinkExtraction.counts.pricingLinksMapped}`);
  log(`label_template_ai_found: ${templateExtraction.counts.labelTemplatesFound}`);
  log(`mockup_template_tif_found: ${templateExtraction.counts.mockupTemplatesFound}`);
  log(`ai_label_assets_discovered: ${aiInputRows.length}`);
  log(`ai_metadata_checked: ${aiAttempted}`);
  log(`ai_files_skipped_unchanged: ${aiReused}`);
  log(`ai_files_temp_downloaded: ${aiAttempted - aiReused}`);
  log(`pdf_compatible_ai_count: ${aiEvidenceRows.filter((entry) => entry.compatibility === "pdf_compatible").length}`);
  log(`non_pdf_ai_count: ${aiNonPdf}`);
  log(`ai_text_extraction_successes: ${aiSuccess}`);
  log(`ai_text_extraction_partial_or_needs_review: ${aiNeedsReview}`);
  log(`ai_text_extraction_no_extractable_text: ${aiNoText}`);
  log(`ai_text_extraction_errors: ${aiErrors}`);
  log(`ocr_fallback_eligible_count: ${ocrFallbackSkus.length}`);
  log(`ocr_attempted: ${ocrEvidence.length}`);
  log(`ocr_succeeded: ${ocrSucceeded}`);
  log(`ocr_partial_or_low_confidence: ${ocrPartial}`);
  log(`supplement_facts_coverage_total: ${validationReport.supplementFactsCoverageTotal.presentSkuCount}/${validationReport.supplementFactsCoverageTotal.requiredSkuCount}`);
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

  for (const aiRow of aiEvidenceRows.filter((entry) => entry.errorDetail)) {
    log(`ai_error_${aiRow.sku}: ${maskAssetUrlForLogs(aiRow.url)} -> ${aiRow.errorDetail}`);
  }

  if (ocrFixtureEntries.length === 0) {
    log("ocr_mode: fallback_only (set ROCKTOMIC_OCR_FIXTURE_PATH for deterministic OCR fixtures)");
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
