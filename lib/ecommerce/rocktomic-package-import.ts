import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export interface RocktomicPackageArtifacts {
  sources: { supplier: string; version?: number; generatedBy?: string; sources: Array<Record<string, JsonValue>> };
  sourceFacts: Array<Record<string, JsonValue>>;
  pricing: Array<Record<string, JsonValue>>;
  inventory: Array<Record<string, JsonValue>>;
  assets: Array<Record<string, JsonValue>>;
  validationReport: Record<string, JsonValue>;
  catalogLinkEvidence: Record<string, JsonValue>;
  templateAssetEvidence: Record<string, JsonValue>;
  aiLabelTextEvidence: { supplierSlug?: string; generatedAt?: string; policyVersion?: string; records: Array<Record<string, JsonValue>> };
  ocrEvidence: Array<Record<string, JsonValue>>;
}

export interface EcomImportIds {
  supplierId: string;
  packageImportId: string;
  productId: string;
  productFactsId: string;
  pricingId: string;
  inventoryId: string;
  assetsId: string;
  validationResultId: string;
}

export interface EcomImportRowSet {
  supplier: {
    id: string;
    supplierSlug: string;
    supplierName: string;
    status: string;
    sourceRegistry: Record<string, JsonValue>;
  };
  packageImport: {
    id: string;
    supplierId: string;
    supplierSlug: string;
    packagePolicyVersion: string | null;
    packageStatus: string;
    packageGeneratedAt: string | null;
    sourceGitSha: string | null;
    totalSkusDiscovered: number;
    totalSkusValidated: number;
    usableCount: number;
    usableWithWarningsCount: number;
    blockedCount: number;
    extractionErrorCount: number;
    aiTextFactsCoverage: Record<string, JsonValue>;
    ocrFactsCoverage: Record<string, JsonValue>;
    assetCoverage: Record<string, JsonValue>;
    validationSummary: Record<string, JsonValue>;
    artifactManifest: Record<string, JsonValue>;
    importStatus: string;
    importErrors: string[];
  };
  products: Array<Record<string, JsonValue>>;
  productFacts: Array<Record<string, JsonValue>>;
  pricing: Array<Record<string, JsonValue>>;
  inventory: Array<Record<string, JsonValue>>;
  assets: Array<Record<string, JsonValue>>;
  validationResults: Array<Record<string, JsonValue>>;
  summary: {
    supplierSlug: string;
    importId: string;
    packageStatus: string;
    totalSkus: number;
    usable: number;
    usableWithWarnings: number;
    blocked: number;
    extractionError: number;
    productFactsRows: number;
    pricingRows: number;
    inventoryRows: number;
    assetsRows: number;
    validationRows: number;
    skippedRows: number;
    erroredRows: number;
  };
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.replace(/\u0000/g, "").trim() : "";
}

function asNullableString(value: unknown): string | null {
  const text = asString(value);
  return text || null;
}

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function asArray(value: unknown): JsonValue[] {
  return Array.isArray(value) ? (value as JsonValue[]) : [];
}

function asObject(value: unknown): Record<string, JsonValue> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, JsonValue>;
}

function asBoolean(value: unknown): boolean {
  return value === true;
}

function toIsoOrNull(value: unknown): string | null {
  const text = asString(value);
  if (!text) return null;
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString();
}

function stableId(prefix: string, ...parts: Array<string | null | undefined>): string {
  const seed = parts.map((entry) => entry || "").join("|");
  const hash = crypto.createHash("sha1").update(seed).digest("hex").slice(0, 24);
  return `${prefix}_${hash}`;
}

function sanitizeSupplierSlug(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
}

function normalizeSku(value: unknown): string {
  return asString(value).toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function mapBySku(rows: Array<Record<string, JsonValue>>): Map<string, Record<string, JsonValue>> {
  const output = new Map<string, Record<string, JsonValue>>();
  for (const row of rows) {
    const sku = normalizeSku(row.sku);
    if (!sku) continue;
    output.set(sku, row);
  }
  return output;
}

function buildArtifactManifest(files: Array<{ fileName: string; sizeBytes: number; modifiedAt: string }>): Record<string, JsonValue> {
  return {
    files: files.map((entry) => ({
      fileName: entry.fileName,
      sizeBytes: entry.sizeBytes,
      modifiedAt: entry.modifiedAt,
    })),
  };
}

export async function loadRocktomicPackageArtifacts(baseDir: string): Promise<{ artifacts: RocktomicPackageArtifacts; artifactManifest: Record<string, JsonValue> }> {
  const supplierRoot = path.join(baseDir, "data/ecomviper/suppliers/rocktomic");
  const latestRoot = path.join(supplierRoot, "latest");

  const files = [
    { key: "sources", fileName: "sources.json", fullPath: path.join(supplierRoot, "sources.json") },
    { key: "sourceFacts", fileName: "sourceFacts.json", fullPath: path.join(latestRoot, "sourceFacts.json") },
    { key: "pricing", fileName: "pricing.json", fullPath: path.join(latestRoot, "pricing.json") },
    { key: "inventory", fileName: "inventory.json", fullPath: path.join(latestRoot, "inventory.json") },
    { key: "assets", fileName: "assets.json", fullPath: path.join(latestRoot, "assets.json") },
    { key: "validationReport", fileName: "validation-report.json", fullPath: path.join(latestRoot, "validation-report.json") },
    { key: "catalogLinkEvidence", fileName: "catalog-link-evidence.json", fullPath: path.join(latestRoot, "catalog-link-evidence.json") },
    { key: "templateAssetEvidence", fileName: "template-asset-evidence.json", fullPath: path.join(latestRoot, "template-asset-evidence.json") },
    { key: "aiLabelTextEvidence", fileName: "ai-label-text-evidence.json", fullPath: path.join(latestRoot, "ai-label-text-evidence.json") },
    { key: "ocrEvidence", fileName: "ocr-evidence.json", fullPath: path.join(latestRoot, "ocr-evidence.json") },
  ] as const;

  const loaded: Record<string, unknown> = {};
  const manifestRows: Array<{ fileName: string; sizeBytes: number; modifiedAt: string }> = [];

  for (const file of files) {
    const content = await fs.readFile(file.fullPath, "utf8");
    loaded[file.key] = JSON.parse(content);
    const stats = await fs.stat(file.fullPath);
    manifestRows.push({
      fileName: file.fileName,
      sizeBytes: stats.size,
      modifiedAt: stats.mtime.toISOString(),
    });
  }

  const artifacts: RocktomicPackageArtifacts = {
    sources: loaded.sources as RocktomicPackageArtifacts["sources"],
    sourceFacts: loaded.sourceFacts as RocktomicPackageArtifacts["sourceFacts"],
    pricing: loaded.pricing as RocktomicPackageArtifacts["pricing"],
    inventory: loaded.inventory as RocktomicPackageArtifacts["inventory"],
    assets: loaded.assets as RocktomicPackageArtifacts["assets"],
    validationReport: loaded.validationReport as RocktomicPackageArtifacts["validationReport"],
    catalogLinkEvidence: loaded.catalogLinkEvidence as RocktomicPackageArtifacts["catalogLinkEvidence"],
    templateAssetEvidence: loaded.templateAssetEvidence as RocktomicPackageArtifacts["templateAssetEvidence"],
    aiLabelTextEvidence: loaded.aiLabelTextEvidence as RocktomicPackageArtifacts["aiLabelTextEvidence"],
    ocrEvidence: loaded.ocrEvidence as RocktomicPackageArtifacts["ocrEvidence"],
  };

  return {
    artifacts,
    artifactManifest: buildArtifactManifest(manifestRows),
  };
}

export function mapRocktomicPackageToEcommerceRows(input: {
  artifacts: RocktomicPackageArtifacts;
  artifactManifest: Record<string, JsonValue>;
  sourceGitSha?: string | null;
  importStatus?: string;
}): EcomImportRowSet {
  const supplierSlug = sanitizeSupplierSlug(asString(input.artifacts.validationReport.supplierSlug || input.artifacts.validationReport.supplierId || "rocktomic"));
  const supplierName = asString(input.artifacts.sources.supplier) || "Rocktomic";
  const packageGeneratedAt = toIsoOrNull(input.artifacts.validationReport.generatedAt || input.artifacts.validationReport.packageGeneratedAt);
  const packagePolicyVersion = asNullableString(input.artifacts.validationReport.validationPolicyVersion);
  const packageStatus = asString(input.artifacts.validationReport.packageStatus) || "fail";

  const supplierId = stableId("esup", supplierSlug);
  const packageImportId = stableId("eimp", supplierSlug, packageGeneratedAt || "unknown", packagePolicyVersion || "unknown");

  const sourceFactsBySku = mapBySku(input.artifacts.sourceFacts);
  const pricingBySku = mapBySku(input.artifacts.pricing);
  const inventoryBySku = mapBySku(input.artifacts.inventory);
  const assetsBySku = mapBySku(input.artifacts.assets);
  const aiBySku = mapBySku(input.artifacts.aiLabelTextEvidence.records || []);
  const ocrBySku = mapBySku(input.artifacts.ocrEvidence || []);

  const skuValidationResults = asArray(input.artifacts.validationReport.skuValidationResults).map((value) => asObject(value));
  const skuSet = new Set<string>();
  for (const row of skuValidationResults) {
    const sku = normalizeSku(row.sku);
    if (sku) skuSet.add(sku);
  }

  const products: Array<Record<string, JsonValue>> = [];
  const productFacts: Array<Record<string, JsonValue>> = [];
  const pricingRows: Array<Record<string, JsonValue>> = [];
  const inventoryRows: Array<Record<string, JsonValue>> = [];
  const assetsRows: Array<Record<string, JsonValue>> = [];
  const validationRows: Array<Record<string, JsonValue>> = [];

  for (const result of skuValidationResults) {
    const sku = normalizeSku(result.sku);
    if (!sku) continue;

    const sourceFact = sourceFactsBySku.get(sku) || {};
    const pricing = pricingBySku.get(sku) || {};
    const inventory = inventoryBySku.get(sku) || {};
    const asset = assetsBySku.get(sku) || {};
    const aiEvidence = aiBySku.get(sku) || {};
    const ocrEvidence = ocrBySku.get(sku) || {};

    const ids: EcomImportIds = {
      supplierId,
      packageImportId,
      productId: stableId("eprd", supplierSlug, sku),
      productFactsId: stableId("efct", supplierSlug, sku),
      pricingId: stableId("eprc", supplierSlug, sku),
      inventoryId: stableId("einv", supplierSlug, sku),
      assetsId: stableId("east", supplierSlug, sku),
      validationResultId: stableId("evld", supplierSlug, sku),
    };

    const validationStatus = asString(result.status) || "blocked";
    const productType = asNullableString(result.skuType);
    const productName = asNullableString(result.productName || sourceFact.productName || pricing.productName);
    const category = asNullableString(sourceFact.category);

    const blockingDefects = asArray(result.blockingDefects).map((entry) => asObject(entry));
    const warningDefects = asArray(result.warningDefects).map((entry) => asObject(entry));
    const missingFields = asArray(result.missingFields).map((entry) => asString(entry)).filter(Boolean);
    const sourceNotes = asArray(result.sourceNotes).map((entry) => asString(entry)).filter(Boolean);
    const readiness = asObject(result.readiness);

    const sourceEvidence = asObject(sourceFact.sourceEvidence);
    const supplementEvidence = asObject(sourceEvidence.supplementFacts);
    const extractionMethod = asString(supplementEvidence.sourceMethod);
    const needsReview = asBoolean(supplementEvidence.needsReview);

    products.push({
      id: ids.productId,
      supplier_id: ids.supplierId,
      supplier_slug: supplierSlug,
      sku,
      product_name: productName,
      category,
      product_type: productType,
      status: "active",
      validation_status: validationStatus,
      readiness,
      missing_fields: missingFields,
      blocking_defects: blockingDefects,
      warning_defects: warningDefects,
      source_notes: sourceNotes,
      package_import_id: ids.packageImportId,
      source_facts: sourceFact,
    });

    productFacts.push({
      id: ids.productFactsId,
      supplier_product_id: ids.productId,
      supplier_slug: supplierSlug,
      sku,
      product_name: productName,
      label_size: asNullableString(sourceFact.labelSize),
      container_size: asNullableString(sourceFact.containerSize),
      product_weight: asNullableString(sourceFact.productWeight),
      key_features: asArray(sourceFact.keyFeatures),
      dietary_attributes: asArray(sourceFact.dietaryAttributes),
      certifications: asArray(sourceFact.certifications),
      manufacturing_claims: asArray(sourceFact.manufacturingClaims),
      supplement_facts: asObject(sourceFact.supplementFacts),
      directions: asNullableString(sourceFact.directions),
      warnings: asNullableString(sourceFact.warnings),
      storage: asNullableString(asObject(sourceFact.supplementFacts).storage),
      source_evidence: sourceEvidence,
      extraction_methods: extractionMethod ? [extractionMethod] : [],
      needs_review: needsReview,
    });

    pricingRows.push({
      id: ids.pricingId,
      supplier_product_id: ids.productId,
      supplier_slug: supplierSlug,
      sku,
      currency: "USD",
      pricing: {
        wholesaleCost: pricing.wholesaleCost ?? null,
        msrp: pricing.msrp ?? null,
        estimatedProfit: pricing.estimatedProfit ?? null,
      },
      tiers: asObject(pricing.membershipTierCosts),
      moq: null,
      source_evidence: {
        sourceReferences: asArray(pricing.sourceReferences),
        missingFields: asArray(pricing.missingFields),
      },
    });

    inventoryRows.push({
      id: ids.inventoryId,
      supplier_product_id: ids.productId,
      supplier_slug: supplierSlug,
      sku,
      inventory_status: asNullableString(inventory.inventoryStatus),
      inventory_raw: asNullableString(inventory.rawInventoryValue),
      replenishment_eta: null,
      comments: null,
      source_evidence: {
        sourceReferences: asArray(inventory.sourceReferences),
        missingFields: asArray(inventory.missingFields),
      },
      updated_by_supplier_at: null,
    });

    const readyForOptiPixel = asBoolean(asObject(asset.assetReadiness).readyForOptiPixelAssets);
    const readyForChannel = asBoolean(asObject(asset.assetReadiness).readyForChannelImageGeneration);

    assetsRows.push({
      id: ids.assetsId,
      supplier_product_id: ids.productId,
      supplier_slug: supplierSlug,
      sku,
      coa_url: asNullableString(asset.coaUrl),
      catalog_template_url: asNullableString(asset.catalogTemplateUrl),
      label_template_ai_url: asNullableString(asset.labelTemplateAiUrl),
      mockup_template_tif_url: asNullableString(asset.mockupTemplateTifUrl),
      assets: asArray(asset.assets),
      asset_readiness: asObject(asset.assetReadiness),
      remote_metadata: {
        templatePageLastUpdated: asset.templatePageLastUpdated ?? null,
        httpEtag: asset.httpEtag ?? null,
        httpLastModified: asset.httpLastModified ?? null,
        httpContentLength: asset.httpContentLength ?? null,
        httpContentType: asset.httpContentType ?? null,
        lastCheckedAt: asset.lastCheckedAt ?? null,
        extractedAt: asset.extractedAt ?? null,
        extractionStatus: asset.extractionStatus ?? null,
        extractionMethod: asset.extractionMethod ?? null,
      },
      ai_label_text_evidence: aiEvidence,
      ocr_evidence: ocrEvidence,
      source_evidence: {
        sourceReferences: asArray(asset.sourceReferences),
        missingFields: asArray(asset.missingFields),
      },
      ready_for_optipixel: readyForOptiPixel,
      ready_for_channel_image_generation: readyForChannel,
    });

    validationRows.push({
      id: ids.validationResultId,
      supplier_product_id: ids.productId,
      supplier_slug: supplierSlug,
      sku,
      validation_policy_version: packagePolicyVersion,
      validation_status: validationStatus,
      package_status_at_import: packageStatus,
      blocking_defects: blockingDefects,
      warning_defects: warningDefects,
      not_applicable_fields: asArray(result.notApplicableFields),
      readiness,
      coverage: {
        requiredBlockingFields: asArray(result.requiredBlockingFields),
        satisfiedBlockingFields: asArray(result.satisfiedBlockingFields),
        requiredWarningFields: asArray(result.requiredWarningFields),
        satisfiedWarningFields: asArray(result.satisfiedWarningFields),
      },
      needs_review: needsReview,
      validation_result: result,
    });
  }

  const fieldCoverageSummary = asObject(input.artifacts.validationReport.fieldCoverageSummary);
  const assetCoverage = {
    coaCoverage: asObject(fieldCoverageSummary["assets.coaUrl"]),
    labelTemplateAiCoverage: asObject(fieldCoverageSummary["assets.labelTemplateAiUrl"]),
    mockupTemplateTifCoverage: asObject(fieldCoverageSummary["assets.mockupTemplateTifUrl"]),
  };

  const summary = {
    supplierSlug,
    importId: packageImportId,
    packageStatus,
    totalSkus: skuSet.size,
    usable: asNumber(input.artifacts.validationReport.usableSkuCount),
    usableWithWarnings: asNumber(input.artifacts.validationReport.usableWithWarningsSkuCount),
    blocked: asNumber(input.artifacts.validationReport.blockedSkuCount),
    extractionError: asNumber(input.artifacts.validationReport.extractionErrorSkuCount),
    productFactsRows: productFacts.length,
    pricingRows: pricingRows.length,
    inventoryRows: inventoryRows.length,
    assetsRows: assetsRows.length,
    validationRows: validationRows.length,
    skippedRows: Math.max(0, skuSet.size - products.length),
    erroredRows: 0,
  };

  return {
    supplier: {
      id: supplierId,
      supplierSlug,
      supplierName,
      status: "active",
      sourceRegistry: asObject(input.artifacts.sources as unknown),
    },
    packageImport: {
      id: packageImportId,
      supplierId,
      supplierSlug,
      packagePolicyVersion,
      packageStatus,
      packageGeneratedAt,
      sourceGitSha: input.sourceGitSha || null,
      totalSkusDiscovered: asNumber(input.artifacts.validationReport.totalSkusDiscovered),
      totalSkusValidated: asNumber(input.artifacts.validationReport.totalSkusValidated),
      usableCount: asNumber(input.artifacts.validationReport.usableSkuCount),
      usableWithWarningsCount: asNumber(input.artifacts.validationReport.usableWithWarningsSkuCount),
      blockedCount: asNumber(input.artifacts.validationReport.blockedSkuCount),
      extractionErrorCount: asNumber(input.artifacts.validationReport.extractionErrorSkuCount),
      aiTextFactsCoverage: asObject(input.artifacts.validationReport.aiTextFactsCoverage),
      ocrFactsCoverage: asObject(input.artifacts.validationReport.ocrFactsCoverage),
      assetCoverage,
      validationSummary: asObject(input.artifacts.validationReport),
      artifactManifest: input.artifactManifest,
      importStatus: input.importStatus || "completed",
      importErrors: [],
    },
    products,
    productFacts,
    pricing: pricingRows,
    inventory: inventoryRows,
    assets: assetsRows,
    validationResults: validationRows,
    summary,
  };
}
