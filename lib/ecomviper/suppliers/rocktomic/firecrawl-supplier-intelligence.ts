import fs from "node:fs/promises";
import path from "node:path";
import { FirecrawlClient } from "@/lib/ecomviper/suppliers/firecrawl/firecrawl-client";
import {
  mergeSupplierRecordsBySku,
  parseRocktomicCatalogMarkdown,
} from "@/lib/ecomviper/suppliers/rocktomic/firecrawl-catalog-markdown-parser";
import {
  extractPdfEvidence,
  resolveOrAcquireCatalogPdfPath,
} from "@/lib/ecomviper/suppliers/rocktomic/pdf-evidence";
import {
  extractSupplementFactsViaOpenAiVision,
} from "@/lib/ecomviper/suppliers/rocktomic/openai-vision-supplement-facts";
import {
  extractSupplementFactsDeterministic,
  isStructuredSupplementFactsValid,
} from "@/lib/ecomviper/suppliers/rocktomic/supplement-facts-panel";
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
  extractPanels?: boolean;
  renderPdfPages?: boolean;
  useOpenAiVision?: boolean;
  writeCandidates?: boolean;
  candidateDir?: string | null;
  debugPanel?: boolean;
}

export interface BuildSupplierIntelligenceResult {
  package: NormalizedSupplierIntelligencePackage;
  assets: Array<{ sku: string; coaUrl: string | null; labelTemplateUrl: string | null; mockupUrl: string | null; sourceStatus: string; missingFields: string[] }>;
  pricing: Array<{ sku: string; wholesaleCost: number | null; msrp: number | null; currency: string | null; sourceStatus: string; missingFields: string[] }>;
  inventory: Array<{ sku: string; status: string | null; quantityText: string | null; sourceStatus: string; missingFields: string[] }>;
  sourceOrigin: "fixture" | "firecrawl";
  firecrawlSource: "live" | "cache" | "fixture" | "not_applicable";
  reason?: "ok" | "sku_not_found" | "parser_no_record_boundary" | "source_unavailable";
  logs: string[];
  candidateArtifacts?: Array<{ sku: string; renderedImagePath: string | null; panelImagePath: string | null; pageNumber: number | null }>;
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
    firecrawlSource: "not_applicable",
    reason: records.length > 0 ? "ok" : "sku_not_found",
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

  const supplierId = options.manifest.supplierId || "rocktomic";
  const supplierName = options.manifest.supplierName || "Rocktomic";
  const normalizedSkuFilter = options.skuFilter?.map((entry) => normalizeSku(entry)).filter(Boolean) || null;

  const json = scrape.json || {};
  const recordsArray = Array.isArray(json.records) ? json.records : [];
  const jsonRecords: NormalizedSupplierIntelligenceRecord[] = recordsArray
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
              confidence: 0.84,
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
              confidence: 0.84,
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
        supplierId,
        supplierName,
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
    .filter((record) => !normalizedSkuFilter || normalizedSkuFilter.includes(record.sku))
    .sort((a, b) => a.sku.localeCompare(b.sku));

  const markdownParse = parseRocktomicCatalogMarkdown({
    markdown: scrape.markdown || "",
    sourceUrl: catalog.url,
    supplierId,
    supplierName,
    skuFilter: options.skuFilter,
  });

  let normalizedRecords = mergeSupplierRecordsBySku({
    primary: jsonRecords,
    fallback: markdownParse.records,
  }).map((record) => {
    const missingFields = ensureUniqueMissingFields(record.missingFields || []);
    return {
      ...record,
      missingFields,
      sourceStatus: calculateRecordSourceStatus({ ...record, missingFields }),
    };
  });

  const writeCandidateArtifacts = Boolean(options.writeCandidates && options.candidateDir);
  const panelRenderDirRoot = options.candidateDir
    ? path.join(options.candidateDir, "panel-candidates")
    : path.join(process.cwd(), "artifacts/ecomviper/suppliers/rocktomic/panel-candidates");
  const canDownloadPdfLive = process.env.NODE_ENV !== "test";
  const pdfResolution = await resolveOrAcquireCatalogPdfPath({
    sourceUrl: catalog.url,
    allowLiveDownload: canDownloadPdfLive,
  });
  const candidateArtifacts: Array<{ sku: string; renderedImagePath: string | null; panelImagePath: string | null; pageNumber: number | null }> = [];

  if (pdfResolution.pdfPath && normalizedRecords.length > 0) {
    const pdfPath = pdfResolution.pdfPath;
    const enriched = await Promise.all(
      normalizedRecords.map(async (record) => {
        const renderDir = path.join(panelRenderDirRoot, record.sku);
        if (writeCandidateArtifacts) {
          await fs.mkdir(renderDir, { recursive: true });
        }
        const evidence = await extractPdfEvidence({
          pdfPath,
          query: record.sku || String(record.productName || ""),
          sku: record.sku,
          productName: record.productName,
          renderPages: Boolean(options.renderPdfPages || options.extractPanels || options.useOpenAiVision),
          cropPanel: Boolean(options.extractPanels || options.useOpenAiVision),
          renderDir: writeCandidateArtifacts ? renderDir : null,
        });
        if (!evidence.found) {
          return {
            ...record,
            extractionWarnings: ensureUniqueMissingFields([
              ...(record.extractionWarnings || []),
              ...evidence.errors.map((entry) => `pdf_evidence_${entry}`),
              "pdf_evidence_not_found",
            ]),
          };
        }

        const firstCandidate = evidence.candidatePages[0] || null;
        const snippet = firstCandidate?.text || evidence.textSnippets[0]?.text || `PyMuPDF evidence for ${record.sku}`;
        const evidenceProvenance = createProvenance({
          sourceType: "catalog_pdf",
          sourceUrl: catalog.url,
          pageNumber: firstCandidate?.pageNumber ?? evidence.pageNumbers[0] ?? null,
          rawSnippet: snippet,
          confidence: 0.84,
        });
        const linkPool = firstCandidate?.links || evidence.links.map((entry) => entry.uri);
        const coaLink = linkPool.find((entry) => /coa|analysis|certificate/i.test(entry)) || null;
        const templateLink = linkPool.find((entry) => /templates\\.html|\\.ai(?:\\?|$)|\\.tif(?:\\?|$)/i.test(entry)) || null;

        let nextRecord: NormalizedSupplierIntelligenceRecord = {
          ...record,
          coaUrl: record.coaUrl || coaLink,
          labelTemplateUrl: record.labelTemplateUrl || templateLink,
          mockupUrl: record.mockupUrl || templateLink,
          extractionWarnings: ensureUniqueMissingFields([
            ...(record.extractionWarnings || []),
            ...(evidence.errors || []),
          ]),
          provenance: [...record.provenance, evidenceProvenance],
        };

        const deterministic = extractSupplementFactsDeterministic({
          text: snippet,
          provenance: [evidenceProvenance],
          extractionMethod: "deterministic_pdf_text",
        });

        const deterministicValid = isStructuredSupplementFactsValid({
          sku: nextRecord.sku,
          productName: nextRecord.productName,
          servingSize: deterministic.servingSize,
          servingsPerContainer: deterministic.servingsPerContainer,
          nutrientFacts: deterministic.nutrientFacts,
          activeIngredients: deterministic.activeIngredients,
        });

        if (deterministicValid.valid && deterministic.confidence >= 0.8) {
          nextRecord = {
            ...nextRecord,
            servingSize: deterministic.servingSize,
            servingsPerContainer: deterministic.servingsPerContainer,
            nutrientFacts: deterministic.nutrientFacts,
            activeIngredients: deterministic.activeIngredients,
            otherIngredients: deterministic.otherIngredients,
            missingFields: ensureUniqueMissingFields([
              ...nextRecord.missingFields.filter((field) =>
                field !== "servingSize"
                && field !== "servingsPerContainer"
                && field !== "nutrientFacts"
                && field !== "activeIngredients"
                && field !== "otherIngredients"
              ),
              ...deterministic.missingFields.filter((field) => !["nutrientFacts", "activeIngredients"].includes(field)),
            ]),
            extractionWarnings: ensureUniqueMissingFields([
              ...(nextRecord.extractionWarnings || []),
              ...deterministic.warnings,
            ]),
            confidence: Math.max(nextRecord.confidence, deterministic.confidence),
          };
        } else {
          nextRecord = {
            ...nextRecord,
            sourceStatus: "needs_review",
            extractionWarnings: ensureUniqueMissingFields([
              ...(nextRecord.extractionWarnings || []),
              ...deterministic.warnings,
              ...deterministicValid.errors.map((entry) => `panel_validation_${entry}`),
            ]),
            missingFields: ensureUniqueMissingFields([
              ...nextRecord.missingFields,
              ...deterministic.missingFields,
            ]),
          };
        }

        if (options.useOpenAiVision) {
            const vision = await extractSupplementFactsViaOpenAiVision({
              enabledByCli: true,
              imagePath: firstCandidate?.panelImagePath || firstCandidate?.renderedImagePath || null,
              sku: nextRecord.sku,
              productName: nextRecord.productName,
              provenance: [evidenceProvenance],
            });
            if (vision.status === "success" && vision.extraction) {
              nextRecord = {
                ...nextRecord,
                servingSize: vision.extraction.servingSize,
                servingsPerContainer: vision.extraction.servingsPerContainer,
                nutrientFacts: vision.extraction.nutrientFacts,
                activeIngredients: vision.extraction.activeIngredients,
                otherIngredients: vision.extraction.otherIngredients,
                missingFields: ensureUniqueMissingFields(
                  nextRecord.missingFields.filter((field) =>
                    field !== "servingSize"
                    && field !== "servingsPerContainer"
                    && field !== "nutrientFacts"
                    && field !== "activeIngredients"
                  )
                ),
                extractionWarnings: ensureUniqueMissingFields([
                  ...(nextRecord.extractionWarnings || []),
                  ...vision.extraction.warnings,
                ]),
                confidence: Math.max(nextRecord.confidence, vision.extraction.confidence),
              };
            } else if (vision.status !== "skipped") {
              nextRecord = {
                ...nextRecord,
                sourceStatus: "needs_review",
                extractionWarnings: ensureUniqueMissingFields([
                  ...(nextRecord.extractionWarnings || []),
                  `vision_${vision.reason}`,
                ]),
              };
            }
        }

        candidateArtifacts.push({
          sku: record.sku,
          renderedImagePath: firstCandidate?.renderedImagePath || null,
          panelImagePath: firstCandidate?.panelImagePath || null,
          pageNumber: firstCandidate?.pageNumber || null,
        });

        return nextRecord;
      })
    );
    normalizedRecords = enriched.map((record) => {
      const missingFields = ensureUniqueMissingFields(record.missingFields || []);
      return {
        ...record,
        missingFields,
        sourceStatus: calculateRecordSourceStatus({ ...record, missingFields }),
      };
    });
  } else if (normalizedRecords.length > 0) {
    normalizedRecords = normalizedRecords.map((record) => ({
      ...record,
      extractionWarnings: ensureUniqueMissingFields([
        ...(record.extractionWarnings || []),
        ...pdfResolution.errors.map((entry) => `pdf_source_${entry}`),
        ...(pdfResolution.warnings.length > 0 ? pdfResolution.warnings : ["pdf_source_unavailable"]),
      ]),
    }));
  }

  const supplierPackage: NormalizedSupplierIntelligencePackage = {
    supplierId,
    supplierName,
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
    firecrawlSource: scrape.source,
    reason: normalizedRecords.length > 0 ? "ok" : markdownParse.reason,
    logs: [
      `firecrawl_source=${scrape.source}`,
      `pdf_source=${pdfResolution.acquisitionSource}`,
      ...(pdfResolution.sourceHash ? [`pdf_source_hash=${pdfResolution.sourceHash}`] : []),
      `records_extracted=${normalizedRecords.length}`,
      `json_records_extracted=${jsonRecords.length}`,
      `markdown_records_extracted=${markdownParse.records.length}`,
      ...(markdownParse.warnings || []).map((entry) => `warning:${entry}`),
    ],
    candidateArtifacts,
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
