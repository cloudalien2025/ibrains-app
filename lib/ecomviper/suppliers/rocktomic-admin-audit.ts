import "server-only";

import fs from "node:fs/promises";
import path from "node:path";

export type RocktomicPackageStatus = "pass" | "pass_with_warnings" | "fail" | "unavailable";
export type RocktomicSkuStatus = "usable" | "usable_with_warnings" | "blocked" | "not_applicable" | "extraction_error" | "unknown";

export interface RocktomicCoverageRow {
  field: string;
  requiredSkuCount: number;
  presentSkuCount: number;
  missingSkuCount: number;
  coveragePercent: number;
}

export interface RocktomicSourceRegistrySummaryRow {
  id: string;
  name: string;
  type: string;
  urlLabel: string;
  urlPreview: string;
  notes: string;
  status: "present" | "source_error" | "unreferenced";
}

export interface RocktomicArtifactStatus {
  artifact:
    | "sources.json"
    | "sourceFacts.json"
    | "pricing.json"
    | "inventory.json"
    | "assets.json"
    | "audit.csv"
    | "validation-report.json"
    | "catalog-link-evidence.json"
    | "template-asset-evidence.json"
    | "ocr-evidence.json"
    | "ai-label-text-evidence.json";
  relativePath: string;
  exists: boolean;
  sizeBytes: number | null;
  lastModifiedAt: string | null;
  error: string | null;
}

export interface RocktomicTopSkuDefect {
  sku: string;
  productName: string | null;
  skuType: string | null;
  status: RocktomicSkuStatus;
  blockingDefectCount: number;
  warningDefectCount: number;
  blockingDefects: string[];
  warningDefects: string[];
  missingFields: string[];
  sourceNotes: string[];
}

export interface RocktomicSkuValidationPreviewRow {
  sku: string;
  productName: string | null;
  skuType: string | null;
  status: RocktomicSkuStatus;
  blockingDefectCount: number;
  warningDefectCount: number;
  readiness: {
    usableForProductEditor: boolean;
    usableForGenerateIntelligence: boolean;
    usableForImageStudio: boolean;
    usableForOptiPixel: boolean;
    usableForOptiBay: boolean;
    usableForOptiWal: boolean;
    usableForOptizon: boolean;
    readyForChannelImageGeneration: boolean;
  };
  missingFields: string[];
  sourceNotes: string[];
}

export interface RocktomicAdminAuditViewModel {
  supplierSlug: "rocktomic";
  supplierName: string;
  packageGeneratedAt: string | null;
  validationPolicyVersion: string | null;
  packageStatus: RocktomicPackageStatus;
  totalSkusDiscovered: number;
  totalSkusValidated: number;
  usableSkuCount: number;
  usableWithWarningsSkuCount: number;
  blockedSkuCount: number;
  extractionErrorSkuCount: number;
  ocrNeedsReviewSkuCount: number;
  aiTextFactsCoverage: RocktomicCoverageRow | null;
  ocrFactsCoverage: RocktomicCoverageRow | null;
  supplementFactsCoverageTotal: RocktomicCoverageRow | null;
  aiLabelTextExtractionAttempted: number;
  aiLabelTextExtractionSucceeded: number;
  aiLabelTextNeedsReview: number;
  aiLabelTextNonPdfCompatible: number;
  aiLabelTextNoExtractableText: number;
  aiLabelTextExtractionErrors: number;
  usableForOptiPixelSkuCount: number;
  readyForChannelImageGenerationSkuCount: number;
  fieldCoverageSummary: RocktomicCoverageRow[];
  blockingFieldCoverageSummary: RocktomicCoverageRow[];
  warningFieldCoverageSummary: RocktomicCoverageRow[];
  sourceErrors: string[];
  packageDefects: string[];
  topSkuDefects: RocktomicTopSkuDefect[];
  skuValidationPreview: RocktomicSkuValidationPreviewRow[];
  totalSkuValidationResults: number;
  sourceRegistrySummary: RocktomicSourceRegistrySummaryRow[];
  artifactStatuses: RocktomicArtifactStatus[];
  auditCsvPresent: boolean;
  auditCsvRowCount: number;
  issues: string[];
}

interface ReadOptions {
  rootDir?: string;
  previewLimit?: number;
  topDefectLimit?: number;
}

interface CoverageRecord {
  requiredSkuCount?: unknown;
  presentSkuCount?: unknown;
  missingSkuCount?: unknown;
}

interface ValidationDefectRecord {
  field?: unknown;
  code?: unknown;
  message?: unknown;
}

interface ValidationSkuRecord {
  sku?: unknown;
  productName?: unknown;
  skuType?: unknown;
  status?: unknown;
  blockingDefects?: unknown;
  warningDefects?: unknown;
  missingFields?: unknown;
  sourceNotes?: unknown;
  readiness?: unknown;
}

interface SourceRegistryRecord {
  supplier?: unknown;
  sources?: unknown;
}

const SUPPLIER_SLUG = "rocktomic" as const;
const SUPPLIER_NAME = "Rocktomic";

const EXPECTED_ARTIFACTS: Array<Pick<RocktomicArtifactStatus, "artifact" | "relativePath">> = [
  { artifact: "sources.json", relativePath: "sources.json" },
  { artifact: "sourceFacts.json", relativePath: "latest/sourceFacts.json" },
  { artifact: "pricing.json", relativePath: "latest/pricing.json" },
  { artifact: "inventory.json", relativePath: "latest/inventory.json" },
  { artifact: "assets.json", relativePath: "latest/assets.json" },
  { artifact: "audit.csv", relativePath: "latest/audit.csv" },
  { artifact: "validation-report.json", relativePath: "latest/validation-report.json" },
  { artifact: "catalog-link-evidence.json", relativePath: "latest/catalog-link-evidence.json" },
  { artifact: "template-asset-evidence.json", relativePath: "latest/template-asset-evidence.json" },
  { artifact: "ocr-evidence.json", relativePath: "latest/ocr-evidence.json" },
  { artifact: "ai-label-text-evidence.json", relativePath: "latest/ai-label-text-evidence.json" },
];

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => asString(entry)).filter((entry): entry is string => Boolean(entry));
}

function asBool(value: unknown): boolean {
  return value === true;
}

function toIso(value: unknown): string | null {
  const text = asString(value);
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function truncateUrl(input: string): string {
  if (input.length <= 72) return input;
  return `${input.slice(0, 69)}...`;
}

function urlLabel(input: string): string {
  try {
    const parsed = new URL(input);
    return `${parsed.hostname}${parsed.pathname}`;
  } catch {
    return input;
  }
}

function buildCoverageRows(input: unknown): RocktomicCoverageRow[] {
  const record = asObject(input);
  return Object.entries(record)
    .map(([field, value]) => {
      const coverage = asObject(value) as CoverageRecord;
      const requiredSkuCount = asNumber(coverage.requiredSkuCount);
      const presentSkuCount = asNumber(coverage.presentSkuCount);
      const missingSkuCount = asNumber(coverage.missingSkuCount);
      const coveragePercent = requiredSkuCount > 0 ? Number(((presentSkuCount / requiredSkuCount) * 100).toFixed(1)) : 100;
      return {
        field,
        requiredSkuCount,
        presentSkuCount,
        missingSkuCount,
        coveragePercent,
      };
    })
    .sort((a, b) => a.field.localeCompare(b.field));
}

function buildSingleCoverage(input: unknown): RocktomicCoverageRow | null {
  const row = asObject(input);
  if (Object.keys(row).length === 0) return null;
  const requiredSkuCount = asNumber(row.requiredSkuCount);
  const presentSkuCount = asNumber(row.presentSkuCount);
  const missingSkuCount = asNumber(row.missingSkuCount);
  const coveragePercent = requiredSkuCount > 0 ? Number(((presentSkuCount / requiredSkuCount) * 100).toFixed(1)) : 100;
  return {
    field: "coverage",
    requiredSkuCount,
    presentSkuCount,
    missingSkuCount,
    coveragePercent,
  };
}

function defectToText(value: unknown): string | null {
  const entry = asObject(value) as ValidationDefectRecord;
  const field = asString(entry.field);
  const code = asString(entry.code);
  const message = asString(entry.message);
  if (!field && !code && !message) return null;
  return [field, code, message].filter(Boolean).join(": ");
}

function skuStatus(value: unknown): RocktomicSkuStatus {
  const normalized = asString(value)?.toLowerCase();
  switch (normalized) {
    case "usable":
    case "usable_with_warnings":
    case "blocked":
    case "not_applicable":
    case "extraction_error":
      return normalized;
    default:
      return "unknown";
  }
}

function packageStatus(value: unknown): RocktomicPackageStatus {
  const normalized = asString(value)?.toLowerCase();
  switch (normalized) {
    case "pass":
    case "pass_with_warnings":
    case "fail":
      return normalized;
    default:
      return "unavailable";
  }
}

function sortByDefects(rows: RocktomicTopSkuDefect[]): RocktomicTopSkuDefect[] {
  return rows.sort((a, b) => {
    if (b.blockingDefectCount !== a.blockingDefectCount) {
      return b.blockingDefectCount - a.blockingDefectCount;
    }
    if (b.warningDefectCount !== a.warningDefectCount) {
      return b.warningDefectCount - a.warningDefectCount;
    }
    return a.sku.localeCompare(b.sku);
  });
}

function parseSkuValidationResults(input: unknown): {
  topSkuDefects: RocktomicTopSkuDefect[];
  skuValidationPreview: RocktomicSkuValidationPreviewRow[];
  total: number;
} {
  if (!Array.isArray(input)) {
    return {
      topSkuDefects: [],
      skuValidationPreview: [],
      total: 0,
    };
  }

  const rows: RocktomicTopSkuDefect[] = input.map((value) => {
    const entry = asObject(value) as ValidationSkuRecord;
    const blockingDefects = (Array.isArray(entry.blockingDefects) ? entry.blockingDefects : [])
      .map((defect) => defectToText(defect))
      .filter((defect): defect is string => Boolean(defect));
    const warningDefects = (Array.isArray(entry.warningDefects) ? entry.warningDefects : [])
      .map((defect) => defectToText(defect))
      .filter((defect): defect is string => Boolean(defect));

    return {
      sku: asString(entry.sku) || "UNKNOWN_SKU",
      productName: asString(entry.productName),
      skuType: asString(entry.skuType),
      status: skuStatus(entry.status),
      blockingDefectCount: blockingDefects.length,
      warningDefectCount: warningDefects.length,
      blockingDefects,
      warningDefects,
      missingFields: asStringArray(entry.missingFields),
      sourceNotes: asStringArray(entry.sourceNotes),
    };
  });

  const sorted = sortByDefects(rows);

  const preview: RocktomicSkuValidationPreviewRow[] = rows
    .map((row, index) => {
      const entry = asObject((input as unknown[])[index]) as ValidationSkuRecord;
      const readiness = asObject(entry.readiness);
      return {
        sku: row.sku,
        productName: row.productName,
        skuType: row.skuType,
        status: row.status,
        blockingDefectCount: row.blockingDefectCount,
        warningDefectCount: row.warningDefectCount,
        readiness: {
          usableForProductEditor: asBool(readiness.usableForProductEditor),
          usableForGenerateIntelligence: asBool(readiness.usableForGenerateIntelligence),
          usableForImageStudio: asBool(readiness.usableForImageStudio),
          usableForOptiPixel: asBool(readiness.usableForOptiPixel),
          usableForOptiBay: asBool(readiness.usableForOptiBay),
          usableForOptiWal: asBool(readiness.usableForOptiWal),
          usableForOptizon: asBool(readiness.usableForOptizon),
          readyForChannelImageGeneration: asBool(readiness.readyForChannelImageGeneration),
        },
        missingFields: row.missingFields,
        sourceNotes: row.sourceNotes,
      };
    })
    .sort((a, b) => a.sku.localeCompare(b.sku));

  return {
    topSkuDefects: sorted,
    skuValidationPreview: preview,
    total: rows.length,
  };
}

async function getArtifactStatus(packageDir: string, artifact: Pick<RocktomicArtifactStatus, "artifact" | "relativePath">): Promise<RocktomicArtifactStatus> {
  const absolutePath = path.join(packageDir, artifact.relativePath);
  try {
    const stats = await fs.stat(absolutePath);
    return {
      artifact: artifact.artifact,
      relativePath: artifact.relativePath,
      exists: true,
      sizeBytes: stats.size,
      lastModifiedAt: stats.mtime.toISOString(),
      error: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      artifact: artifact.artifact,
      relativePath: artifact.relativePath,
      exists: false,
      sizeBytes: null,
      lastModifiedAt: null,
      error: message,
    };
  }
}

async function readJsonIfPresent(absolutePath: string): Promise<unknown | null> {
  try {
    const text = await fs.readFile(absolutePath, "utf8");
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function readAuditCsvRowCount(absolutePath: string): Promise<number> {
  try {
    const text = await fs.readFile(absolutePath, "utf8");
    const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
    return Math.max(0, lines.length - 1);
  } catch {
    return 0;
  }
}

function gatherSourceReferences(...datasets: unknown[]): Set<string> {
  const references = new Set<string>();
  for (const dataset of datasets) {
    if (!Array.isArray(dataset)) continue;
    for (const row of dataset) {
      const sourceRefs = asStringArray(asObject(row).sourceReferences);
      for (const ref of sourceRefs) {
        references.add(ref);
      }
    }
  }
  return references;
}

export async function getRocktomicAdminAuditViewModel(options: ReadOptions = {}): Promise<RocktomicAdminAuditViewModel> {
  const rootDir = options.rootDir || process.cwd();
  const previewLimit = Math.max(1, options.previewLimit ?? 120);
  const topDefectLimit = Math.max(1, options.topDefectLimit ?? 25);

  const packageDir = path.join(rootDir, "data/ecomviper/suppliers/rocktomic");
  const latestDir = path.join(packageDir, "latest");

  const artifactStatuses = await Promise.all(EXPECTED_ARTIFACTS.map((artifact) => getArtifactStatus(packageDir, artifact)));
  const artifactByName = new Map(artifactStatuses.map((artifact) => [artifact.artifact, artifact]));

  const sourcesJson = await readJsonIfPresent(path.join(packageDir, "sources.json"));
  const validationJson = await readJsonIfPresent(path.join(latestDir, "validation-report.json"));
  const sourceFactsJson = await readJsonIfPresent(path.join(latestDir, "sourceFacts.json"));
  const pricingJson = await readJsonIfPresent(path.join(latestDir, "pricing.json"));
  const inventoryJson = await readJsonIfPresent(path.join(latestDir, "inventory.json"));
  const assetsJson = await readJsonIfPresent(path.join(latestDir, "assets.json"));
  const auditCsvRowCount = await readAuditCsvRowCount(path.join(latestDir, "audit.csv"));

  const issues: string[] = [];
  for (const artifact of artifactStatuses) {
    if (!artifact.exists) {
      issues.push(`Missing artifact: ${artifact.relativePath}`);
    }
  }

  const validation = asObject(validationJson);
  const registry = asObject(sourcesJson) as SourceRegistryRecord;

  const sourceErrors = asStringArray(validation.sourceErrors)
    .concat(
      Array.isArray(validation.sourceErrors)
        ? (validation.sourceErrors as unknown[])
            .map((entry) => {
              const sourceEntry = asObject(entry);
              const sourceId = asString(sourceEntry.sourceId) || "unknown_source";
              const errorMessage = asString(sourceEntry.error) || "unknown_error";
              return `${sourceId}: ${errorMessage}`;
            })
            .filter(Boolean)
        : []
    );

  const packageDefects = Array.isArray(validation.packageDefects)
    ? (validation.packageDefects as unknown[])
        .map((defect) => defectToText(defect))
        .filter((defect): defect is string => Boolean(defect))
    : [];

  const skuResults = parseSkuValidationResults(validation.skuValidationResults);

  const sourceReferences = gatherSourceReferences(sourceFactsJson, pricingJson, inventoryJson, assetsJson);
  const sourceErrorsSet = new Set(sourceErrors.map((entry) => entry.split(":")[0]));

  const sourceRegistrySummary: RocktomicSourceRegistrySummaryRow[] = Array.isArray(registry.sources)
    ? (registry.sources as unknown[])
        .map((source) => {
          const row = asObject(source);
          const id = asString(row.id) || "unknown_source";
          const url = asString(row.url) || "";
          const status: RocktomicSourceRegistrySummaryRow["status"] = sourceErrorsSet.has(id)
            ? "source_error"
            : sourceReferences.has(id)
              ? "present"
              : "unreferenced";
          return {
            id,
            name: asString(row.name) || id,
            type: asString(row.type) || "unknown",
            urlLabel: url ? urlLabel(url) : "N/A",
            urlPreview: url ? truncateUrl(url) : "N/A",
            notes: asString(row.notes) || "",
            status,
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name))
    : [];

  if (sourceRegistrySummary.length === 0) {
    issues.push("Source registry is missing or invalid.");
  }

  const model: RocktomicAdminAuditViewModel = {
    supplierSlug: SUPPLIER_SLUG,
    supplierName: SUPPLIER_NAME,
    packageGeneratedAt: toIso(validation.generatedAt),
    validationPolicyVersion: asString(validation.validationPolicyVersion),
    packageStatus: packageStatus(validation.packageStatus),
    totalSkusDiscovered: asNumber(validation.totalSkusDiscovered),
    totalSkusValidated: asNumber(validation.totalSkusValidated),
    usableSkuCount: asNumber(validation.usableSkuCount),
    usableWithWarningsSkuCount: asNumber(validation.usableWithWarningsSkuCount),
    blockedSkuCount: asNumber(validation.blockedSkuCount),
    extractionErrorSkuCount: asNumber(validation.extractionErrorSkuCount),
    ocrNeedsReviewSkuCount: asNumber(validation.ocrNeedsReviewSkuCount),
    aiTextFactsCoverage: buildSingleCoverage(validation.aiTextFactsCoverage),
    ocrFactsCoverage: buildSingleCoverage(validation.ocrFactsCoverage),
    supplementFactsCoverageTotal: buildSingleCoverage(validation.supplementFactsCoverageTotal),
    aiLabelTextExtractionAttempted: asNumber(validation.aiLabelTextExtractionAttempted),
    aiLabelTextExtractionSucceeded: asNumber(validation.aiLabelTextExtractionSucceeded),
    aiLabelTextNeedsReview: asNumber(validation.aiLabelTextNeedsReview),
    aiLabelTextNonPdfCompatible: asNumber(validation.aiLabelTextNonPdfCompatible),
    aiLabelTextNoExtractableText: asNumber(validation.aiLabelTextNoExtractableText),
    aiLabelTextExtractionErrors: asNumber(validation.aiLabelTextExtractionErrors),
    usableForOptiPixelSkuCount: asNumber(validation.usableForOptiPixelSkuCount),
    readyForChannelImageGenerationSkuCount: asNumber(validation.readyForChannelImageGenerationSkuCount),
    fieldCoverageSummary: buildCoverageRows(validation.fieldCoverageSummary),
    blockingFieldCoverageSummary: buildCoverageRows(validation.blockingFieldCoverageSummary),
    warningFieldCoverageSummary: buildCoverageRows(validation.warningFieldCoverageSummary),
    sourceErrors,
    packageDefects,
    topSkuDefects: skuResults.topSkuDefects.slice(0, topDefectLimit),
    skuValidationPreview: skuResults.skuValidationPreview.slice(0, previewLimit),
    totalSkuValidationResults: skuResults.total,
    sourceRegistrySummary,
    artifactStatuses,
    auditCsvPresent: artifactByName.get("audit.csv")?.exists === true,
    auditCsvRowCount,
    issues,
  };

  if (!validationJson) {
    model.packageStatus = "unavailable";
    model.packageGeneratedAt = null;
    model.validationPolicyVersion = null;
    model.sourceErrors.push("validation-report.json is missing or unreadable.");
  }

  return model;
}
