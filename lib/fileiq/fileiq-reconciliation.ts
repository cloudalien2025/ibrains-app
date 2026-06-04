import "server-only";

import { randomUUID } from "node:crypto";
import type { FileIqProductCatalogV1 } from "@/lib/fileiq/schema/product-catalog-v1";
import {
  getLatestFileIqReconciledCatalogForSupplier,
  insertFileIqReconciledCatalog,
  listLatestCompletedFileIqArtifactsForSupplier,
  type FileIqReconciledCatalogRecord,
  type FileIqSupplierArtifactRecord,
} from "@/lib/fileiq/fileiq-db";
import { ROCKTOMIC_SUPPLIER, supplierIdFromName } from "@/lib/fileiq/supplier-detection";

type SourceKind =
  | "supplement_catalog_pdf"
  | "inventory_csv"
  | "msrp_report"
  | "plds_catalog"
  | "policy_doc"
  | "unknown";

type JsonRecord = Record<string, unknown>;

interface FieldProvenance {
  sourceKind: SourceKind;
  sourceFileId: string | null;
  sourceFileName: string | null;
  jobId: string;
  artifactId: string;
  sourceRef: string | null;
  recordedAt: string;
}

interface ConflictCandidate {
  sourceKind: SourceKind;
  sourceFileId: string | null;
  sourceFileName: string | null;
  jobId: string;
  value: unknown;
}

interface FieldConflict {
  fieldPath: string;
  chosenSourceKind: SourceKind;
  chosenValue: unknown;
  ignored: ConflictCandidate[];
}

interface CompletenessEntry {
  identityPresent: boolean;
  inventoryPresent: boolean;
  pricingPresent: boolean;
  supplementFactsPresent: boolean;
  physicalSpecsPresent: boolean;
  certificationsPresent: boolean;
  assetsPresent: boolean;
  policyPresent: boolean;
  readyForEcomViper: boolean;
  warnings: string[];
  score: number;
}

interface ReconciledCatalogEnvelope {
  catalog: FileIqProductCatalogV1;
  metadata: {
    supplierId: string;
    generatedAt: string;
    sourceArtifacts: Array<{
      artifactId: string;
      jobId: string;
      bundleId: string;
      sourceFileId: string | null;
      sourceFileName: string | null;
      sourceKind: SourceKind;
      createdAt: string;
    }>;
    provenanceBySku: Record<string, Record<string, FieldProvenance>>;
    conflictsBySku: Record<string, FieldConflict[]>;
    completenessBySku: Record<string, CompletenessEntry>;
  };
}

export interface FileIqResolvedSupplierProduct {
  catalog: FileIqProductCatalogV1;
  metadata: ReconciledCatalogEnvelope["metadata"];
  product: JsonRecord;
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as JsonRecord;
}

function isNonEmpty(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value as JsonRecord).length > 0;
  return true;
}

function normalizeSku(value: unknown): string {
  return (asString(value) ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function uniqueStrings(values: unknown[]): string[] {
  return Array.from(
    new Set(
      values
        .flatMap((value) => (Array.isArray(value) ? value : [value]))
        .map((entry) => asString(entry))
        .filter((entry): entry is string => Boolean(entry)),
    ),
  );
}

function valuesEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function classifySourceKind(record: FileIqSupplierArtifactRecord): SourceKind {
  const fileName = `${record.sourceFileName ?? ""} ${record.bundleName ?? ""}`.toLowerCase();
  const fileType = (record.sourceFileType ?? "").toLowerCase();

  if (fileType === "csv" || /inventory/.test(fileName)) return "inventory_csv";
  if (/(msrp|wholesale|price list|pricing)/.test(fileName)) return "msrp_report";
  if (/(plds|dimensions|spec)/.test(fileName)) return "plds_catalog";
  if (/(shipping|return|refund|credit|policy)/.test(fileName)) return "policy_doc";
  if (fileType === "pdf" || /(catalog|supplement|apparel)/.test(fileName)) return "supplement_catalog_pdf";
  return "unknown";
}

function priorityForField(fieldPath: string, sourceKind: SourceKind): number {
  if (fieldPath.startsWith("inventory.")) {
    return sourceKind === "inventory_csv" ? 100 : sourceKind === "supplement_catalog_pdf" ? 40 : 10;
  }
  if (fieldPath.startsWith("pricing.")) {
    return sourceKind === "msrp_report" ? 100 : sourceKind === "plds_catalog" ? 70 : sourceKind === "supplement_catalog_pdf" ? 55 : 10;
  }
  if (fieldPath.startsWith("physical.")) {
    return sourceKind === "plds_catalog" ? 100 : sourceKind === "supplement_catalog_pdf" ? 80 : 10;
  }
  if (fieldPath.startsWith("shipping.") || fieldPath.startsWith("policy.")) {
    return sourceKind === "policy_doc" ? 100 : sourceKind === "plds_catalog" ? 55 : sourceKind === "supplement_catalog_pdf" ? 45 : 10;
  }
  if (
    fieldPath.startsWith("details.") ||
    fieldPath.startsWith("supplementFacts.") ||
    fieldPath.startsWith("assets.") ||
    fieldPath.startsWith("agenticVisibility.")
  ) {
    return sourceKind === "supplement_catalog_pdf" ? 100 : sourceKind === "plds_catalog" ? 65 : 10;
  }
  return sourceKind === "supplement_catalog_pdf" ? 100 : sourceKind === "plds_catalog" ? 80 : sourceKind === "inventory_csv" ? 60 : sourceKind === "msrp_report" ? 50 : 20;
}

function attachConflict(
  conflicts: FieldConflict[],
  fieldPath: string,
  existing: { sourceKind: SourceKind; value: unknown },
  candidate: ConflictCandidate,
): void {
  if (!isNonEmpty(candidate.value) || valuesEqual(existing.value, candidate.value)) return;
  const prior = conflicts.find((entry) => entry.fieldPath === fieldPath);
  if (prior) {
    prior.ignored.push(candidate);
    return;
  }
  conflicts.push({
    fieldPath,
    chosenSourceKind: existing.sourceKind,
    chosenValue: existing.value,
    ignored: [candidate],
  });
}

function pickScalar(
  state: JsonRecord,
  targetKey: string,
  fieldPath: string,
  nextValue: unknown,
  sourceKind: SourceKind,
  provenance: FieldProvenance,
  provenanceMap: Record<string, FieldProvenance>,
  conflicts: FieldConflict[],
): void {
  if (!isNonEmpty(nextValue)) return;
  const current = state[targetKey];
  const currentProvenance = provenanceMap[fieldPath];

  if (!isNonEmpty(current)) {
    state[targetKey] = nextValue;
    provenanceMap[fieldPath] = provenance;
    return;
  }

  const currentPriority = currentProvenance ? priorityForField(fieldPath, currentProvenance.sourceKind) : -1;
  const nextPriority = priorityForField(fieldPath, sourceKind);

  if (nextPriority > currentPriority) {
    conflicts.push({
      fieldPath,
      chosenSourceKind: sourceKind,
      chosenValue: nextValue,
      ignored: [
        {
          sourceKind: currentProvenance?.sourceKind ?? "unknown",
          sourceFileId: currentProvenance?.sourceFileId ?? null,
          sourceFileName: currentProvenance?.sourceFileName ?? null,
          jobId: currentProvenance?.jobId ?? provenance.jobId,
          value: current,
        },
      ],
    });
    state[targetKey] = nextValue;
    provenanceMap[fieldPath] = provenance;
    return;
  }

  attachConflict(conflicts, fieldPath, { sourceKind: currentProvenance?.sourceKind ?? "unknown", value: current }, {
    sourceKind,
    sourceFileId: provenance.sourceFileId,
    sourceFileName: provenance.sourceFileName,
    jobId: provenance.jobId,
    value: nextValue,
  });
}

function pickStringArray(
  state: JsonRecord,
  targetKey: string,
  fieldPath: string,
  nextValue: unknown,
  provenance: FieldProvenance,
  provenanceMap: Record<string, FieldProvenance>,
): void {
  const merged = uniqueStrings([...(asArray(state[targetKey])), ...asArray(nextValue)]);
  if (merged.length === 0) return;
  state[targetKey] = merged;
  if (!provenanceMap[fieldPath]) provenanceMap[fieldPath] = provenance;
}

function buildSupplierIdAlias(input: string): string[] {
  const normalized = input.trim().toLowerCase();
  const aliases = new Set<string>([normalized, supplierIdFromName(input)]);
  if (normalized === "rocktomic" || normalized === "rocktomic-labs-llc") {
    aliases.add("rocktomic");
    aliases.add("rocktomic-labs-llc");
    aliases.add(supplierIdFromName(ROCKTOMIC_SUPPLIER));
  }
  return [...aliases];
}

function mergeProduct(
  current: JsonRecord,
  incoming: JsonRecord,
  sourceKind: SourceKind,
  artifact: FileIqSupplierArtifactRecord,
  provenanceMap: Record<string, FieldProvenance>,
  conflicts: FieldConflict[],
): JsonRecord {
  const next = { ...current };
  const productProvenance: FieldProvenance = {
    sourceKind,
    sourceFileId: artifact.sourceFileId,
    sourceFileName: artifact.sourceFileName,
    jobId: artifact.jobId,
    artifactId: artifact.artifactId,
    sourceRef: asString(asRecord(incoming.extraction)?.sourceRef),
    recordedAt: artifact.createdAt,
  };

  pickScalar(next, "productName", "productName", incoming.productName, sourceKind, productProvenance, provenanceMap, conflicts);
  pickScalar(next, "productType", "productType", incoming.productType, sourceKind, productProvenance, provenanceMap, conflicts);
  pickScalar(next, "category", "category", incoming.category, sourceKind, productProvenance, provenanceMap, conflicts);
  pickScalar(next, "subcategory", "subcategory", incoming.subcategory, sourceKind, productProvenance, provenanceMap, conflicts);
  pickScalar(next, "brand", "brand", incoming.brand, sourceKind, productProvenance, provenanceMap, conflicts);
  pickScalar(next, "upc", "upc", incoming.upc, sourceKind, productProvenance, provenanceMap, conflicts);
  pickScalar(next, "asin", "asin", incoming.asin, sourceKind, productProvenance, provenanceMap, conflicts);

  const inventory = { ...(asRecord(next.inventory) ?? {}) };
  const incomingInventory = asRecord(incoming.inventory) ?? {};
  for (const key of [
    "status",
    "quantityOnHand",
    "reorderPoint",
    "leadTimeDays",
    "moq",
    "replenishmentEta",
    "accessLevel",
    "lastUpdated",
  ]) {
    pickScalar(inventory, key, `inventory.${key}`, incomingInventory[key], sourceKind, productProvenance, provenanceMap, conflicts);
  }
  next.inventory = inventory;

  const pricing = { ...(asRecord(next.pricing) ?? {}), wholesaleTiers: { ...(asRecord(asRecord(next.pricing)?.wholesaleTiers) ?? {}) } };
  const incomingPricing = asRecord(incoming.pricing) ?? {};
  for (const key of ["msrp", "wholesaleCost", "currency", "mapPrice", "salePrice"]) {
    pickScalar(pricing, key, `pricing.${key}`, incomingPricing[key], sourceKind, productProvenance, provenanceMap, conflicts);
  }
  const incomingTiers = asRecord(incomingPricing.wholesaleTiers) ?? {};
  const tiers = asRecord(pricing.wholesaleTiers) ?? {};
  for (const key of ["nonMember", "standard", "vipPlus", "basic", "launch", "scale"]) {
    pickScalar(tiers, key, `pricing.wholesaleTiers.${key}`, incomingTiers[key], sourceKind, productProvenance, provenanceMap, conflicts);
  }
  pricing.wholesaleTiers = tiers;
  next.pricing = pricing;

  const physical = { ...(asRecord(next.physical) ?? {}) };
  const incomingPhysical = asRecord(incoming.physical) ?? {};
  for (const key of ["weightLbs", "weightOz", "heightIn", "widthIn", "depthIn", "unitCount", "unitCountType"]) {
    pickScalar(physical, key, `physical.${key}`, incomingPhysical[key], sourceKind, productProvenance, provenanceMap, conflicts);
  }
  next.physical = physical;

  const details = { ...(asRecord(next.details) ?? {}) };
  const incomingDetails = asRecord(incoming.details) ?? {};
  for (const key of [
    "description",
    "shortDescription",
    "suggestedUse",
    "warnings",
    "storageInstructions",
    "countryOfOrigin",
    "flavor",
    "form",
    "coaUrl",
  ]) {
    pickScalar(details, key, `details.${key}`, incomingDetails[key], sourceKind, productProvenance, provenanceMap, conflicts);
  }
  pickStringArray(details, "certifications", "details.certifications", incomingDetails.certifications, productProvenance, provenanceMap);
  next.details = details;

  const supplementFacts = { ...(asRecord(next.supplementFacts) ?? {}) };
  const incomingSupplementFacts = asRecord(incoming.supplementFacts) ?? {};
  for (const key of ["servingSize", "servingsPerContainer", "otherIngredients", "allergenWarning", "raw"]) {
    pickScalar(supplementFacts, key, `supplementFacts.${key}`, incomingSupplementFacts[key], sourceKind, productProvenance, provenanceMap, conflicts);
  }
  const incomingIngredients = asArray(incomingSupplementFacts.ingredients);
  if (incomingIngredients.length > 0) {
    const currentIngredients = asArray(supplementFacts.ingredients);
    if (currentIngredients.length === 0 || priorityForField("supplementFacts.ingredients", sourceKind) >= priorityForField("supplementFacts.ingredients", provenanceMap["supplementFacts.ingredients"]?.sourceKind ?? "unknown")) {
      supplementFacts.ingredients = incomingIngredients;
      provenanceMap["supplementFacts.ingredients"] = productProvenance;
    }
  }
  next.supplementFacts = supplementFacts;

  const assets = { ...(asRecord(next.assets) ?? {}) };
  const incomingAssets = asRecord(incoming.assets) ?? {};
  for (const key of ["coaExpiryDate"]) {
    pickScalar(assets, key, `assets.${key}`, incomingAssets[key], sourceKind, productProvenance, provenanceMap, conflicts);
  }
  for (const key of ["imageUrls", "labelUrls", "coaUrls", "sheetUrls", "videoUrls"]) {
    pickStringArray(assets, key, `assets.${key}`, incomingAssets[key], productProvenance, provenanceMap);
  }
  next.assets = assets;

  const shipping = { ...(asRecord(next.shipping) ?? {}) };
  const incomingShipping = asRecord(incoming.shipping) ?? {};
  for (const key of ["shipsFromState", "shipsFromCountry", "freeShippingThreshold", "internationalAvailable", "hazmat"]) {
    pickScalar(shipping, key, `shipping.${key}`, incomingShipping[key], sourceKind, productProvenance, provenanceMap, conflicts);
  }
  for (const routeKey of ["standardRoute", "expeditedRoute"]) {
    const route = { ...(asRecord(shipping[routeKey]) ?? {}) };
    const incomingRoute = asRecord(incomingShipping[routeKey]) ?? {};
    for (const key of ["fulfillmentDays", "transitDays", "totalEstimatedDays"]) {
      pickScalar(route, key, `shipping.${routeKey}.${key}`, incomingRoute[key], sourceKind, productProvenance, provenanceMap, conflicts);
    }
    pickStringArray(route, "carriers", `shipping.${routeKey}.carriers`, incomingRoute.carriers, productProvenance, provenanceMap);
    shipping[routeKey] = route;
  }
  next.shipping = shipping;

  const policy = { ...(asRecord(next.policy) ?? {}) };
  const incomingPolicy = asRecord(incoming.policy) ?? {};
  for (const key of ["refundWindowDays", "refundType", "returnShippingPaidBy", "policyNotes"]) {
    pickScalar(policy, key, `policy.${key}`, incomingPolicy[key], sourceKind, productProvenance, provenanceMap, conflicts);
  }
  next.policy = policy;

  const agenticVisibility = { ...(asRecord(next.agenticVisibility) ?? {}) };
  const incomingAgenticVisibility = asRecord(incoming.agenticVisibility) ?? {};
  for (const key of ["priorityScore", "notes"]) {
    pickScalar(agenticVisibility, key, `agenticVisibility.${key}`, incomingAgenticVisibility[key], sourceKind, productProvenance, provenanceMap, conflicts);
  }
  for (const key of ["tags", "relatedSkus", "bundleSuggestions", "certifications"]) {
    pickStringArray(agenticVisibility, key, `agenticVisibility.${key}`, incomingAgenticVisibility[key], productProvenance, provenanceMap);
  }
  next.agenticVisibility = agenticVisibility;

  const extraction = { ...(asRecord(next.extraction) ?? {}) };
  const incomingExtraction = asRecord(incoming.extraction) ?? {};
  for (const key of ["sourceRef", "sourceFileId", "extractedAt", "confidence", "extractionNotes"]) {
    if (!isNonEmpty(extraction[key])) extraction[key] = incomingExtraction[key] ?? extraction[key];
  }
  next.extraction = extraction;

  return next;
}

function buildCompleteness(product: JsonRecord): CompletenessEntry {
  const details = asRecord(product.details) ?? {};
  const inventory = asRecord(product.inventory) ?? {};
  const pricing = asRecord(product.pricing) ?? {};
  const physical = asRecord(product.physical) ?? {};
  const supplementFacts = asRecord(product.supplementFacts) ?? {};
  const assets = asRecord(product.assets) ?? {};
  const policy = asRecord(product.policy) ?? {};

  const entry: CompletenessEntry = {
    identityPresent: Boolean(asString(product.sku) && asString(product.productName)),
    inventoryPresent: Boolean(asString(inventory.status) || asString(inventory.accessLevel) || asNumber(inventory.quantityOnHand) !== null),
    pricingPresent: Boolean(asNumber(pricing.msrp) !== null || asNumber(pricing.wholesaleCost) !== null || Object.keys(asRecord(pricing.wholesaleTiers) ?? {}).some((key) => isNonEmpty((asRecord(pricing.wholesaleTiers) ?? {})[key]))),
    supplementFactsPresent: Boolean(asString(supplementFacts.servingSize) || asArray(supplementFacts.ingredients).length > 0 || asString(details.suggestedUse)),
    physicalSpecsPresent: Boolean(
      asNumber(physical.weightLbs) !== null ||
      asNumber(physical.weightOz) !== null ||
      asNumber(physical.heightIn) !== null ||
      asNumber(physical.widthIn) !== null ||
      asNumber(physical.depthIn) !== null
    ),
    certificationsPresent: uniqueStrings([details.certifications]).length > 0,
    assetsPresent: Boolean(uniqueStrings([assets.coaUrls, assets.imageUrls, assets.labelUrls]).length > 0 || asString(details.coaUrl)),
    policyPresent: Boolean(asString(policy.policyNotes) || asString(policy.refundType) || asString(asRecord(product.shipping)?.shipsFromCountry)),
    readyForEcomViper: false,
    warnings: [],
    score: 0,
  };

  if (!entry.pricingPresent) entry.warnings.push("pricing_missing");
  if (!entry.inventoryPresent) entry.warnings.push("inventory_missing");
  if (!entry.supplementFactsPresent) entry.warnings.push("supplement_facts_missing");
  if (!entry.physicalSpecsPresent) entry.warnings.push("physical_specs_missing");
  if (!entry.assetsPresent) entry.warnings.push("assets_missing");

  const dimensions = [
    entry.identityPresent,
    entry.inventoryPresent,
    entry.pricingPresent,
    entry.supplementFactsPresent,
    entry.physicalSpecsPresent,
    entry.certificationsPresent,
    entry.assetsPresent,
    entry.policyPresent,
  ];
  entry.score = dimensions.filter(Boolean).length;
  entry.readyForEcomViper =
    entry.identityPresent &&
    entry.inventoryPresent &&
    entry.pricingPresent &&
    entry.supplementFactsPresent;

  return entry;
}

function computeFingerprint(records: FileIqSupplierArtifactRecord[]): string[] {
  return records.map((record) => `${record.artifactId}:${record.createdAt}`).sort();
}

export function reconcileFileIqArtifactsForSupplier(
  supplierId: string,
  artifacts: FileIqSupplierArtifactRecord[],
): ReconciledCatalogEnvelope | null {
  const products = new Map<string, JsonRecord>();
  const provenanceBySku: Record<string, Record<string, FieldProvenance>> = {};
  const conflictsBySku: Record<string, FieldConflict[]> = {};

  const productArtifacts = artifacts.filter((artifact) => {
    const payload = asRecord(artifact.payload);
    return payload?.schemaType === "product_catalog" && Array.isArray(payload.products);
  });
  if (productArtifacts.length === 0) return null;

  for (const artifact of productArtifacts) {
    const payload = asRecord(artifact.payload)!;
    const sourceKind = classifySourceKind(artifact);
    for (const productValue of asArray(payload.products)) {
      const product = asRecord(productValue);
      const sku = normalizeSku(product?.sku);
      if (!product || !sku) continue;
      if (!provenanceBySku[sku]) provenanceBySku[sku] = {};
      if (!conflictsBySku[sku]) conflictsBySku[sku] = [];
      const merged = mergeProduct(
        products.get(sku) ?? { sku },
        { ...product, sku },
        sourceKind,
        artifact,
        provenanceBySku[sku],
        conflictsBySku[sku],
      );
      products.set(sku, merged);
    }
  }

  const catalogProducts = [...products.values()].sort((left, right) =>
    normalizeSku(left.sku).localeCompare(normalizeSku(right.sku)),
  );
  const completenessBySku: Record<string, CompletenessEntry> = {};
  for (const product of catalogProducts) {
    completenessBySku[normalizeSku(product.sku)] = buildCompleteness(product);
  }

  const supplierName =
    supplierId === "rocktomic-labs-llc" || supplierId === "rocktomic"
      ? ROCKTOMIC_SUPPLIER
      : supplierId.replace(/-/g, " ");
  const generatedAt = new Date().toISOString();

  return {
    catalog: {
      schemaType: "product_catalog",
      schemaVersion: "1.1",
      supplier: {
        supplierId,
        name: supplierName,
        supplierName: supplierName,
        website: null,
        contactEmail: null,
        contactPhone: null,
      },
      products: catalogProducts as unknown as FileIqProductCatalogV1["products"],
      totalProductsFound: catalogProducts.length,
      sourcesProcessed: productArtifacts.length,
      extractionNotes: `Reconciled ${productArtifacts.length} FileIQ source extraction(s) into one canonical product catalog.`,
    },
    metadata: {
      supplierId,
      generatedAt,
      sourceArtifacts: productArtifacts.map((artifact) => ({
        artifactId: artifact.artifactId,
        jobId: artifact.jobId,
        bundleId: artifact.bundleId,
        sourceFileId: artifact.sourceFileId,
        sourceFileName: artifact.sourceFileName,
        sourceKind: classifySourceKind(artifact),
        createdAt: artifact.createdAt,
      })),
      provenanceBySku,
      conflictsBySku,
      completenessBySku,
    },
  };
}

export async function getOrCreateLatestFileIqReconciledCatalogForSupplier(
  supplierId: string,
): Promise<FileIqReconciledCatalogRecord | null> {
  const aliases = buildSupplierIdAlias(supplierId);
  const artifacts = await listLatestCompletedFileIqArtifactsForSupplier(aliases, 40);
  if (artifacts.length === 0) return null;

  const latest = await getLatestFileIqReconciledCatalogForSupplier(aliases);
  const latestFingerprint = asArray(latest?.metadata.sourceArtifactFingerprints).map((value) => String(value));
  const currentFingerprint = computeFingerprint(artifacts);
  if (latest && valuesEqual(latestFingerprint, currentFingerprint)) {
    return latest;
  }

  const envelope = reconcileFileIqArtifactsForSupplier(aliases[0], artifacts);
  if (!envelope) return null;

  const record: FileIqReconciledCatalogRecord = {
    id: randomUUID(),
    supplierId: aliases[0],
    sourceBundleId: artifacts[0]?.bundleId ?? null,
    status: "completed",
    schemaVersion: envelope.catalog.schemaVersion,
    catalog: envelope.catalog as unknown as JsonRecord,
    metadata: {
      ...envelope.metadata,
      sourceArtifactFingerprints: currentFingerprint,
      supplierAliases: aliases,
    },
    createdBy: artifacts[0]?.createdBy ?? null,
    createdAt: new Date().toISOString(),
  };

  await insertFileIqReconciledCatalog(record);
  return record;
}

export async function getLatestFileIqResolvedProductBySupplierAndSku(
  supplierId: string,
  sku: string,
): Promise<FileIqResolvedSupplierProduct | null> {
  const normalizedSku = normalizeSku(sku);
  if (!normalizedSku) return null;
  const latest = await getOrCreateLatestFileIqReconciledCatalogForSupplier(supplierId);
  if (!latest) return null;

  const catalog = latest.catalog as unknown as FileIqProductCatalogV1;
  const metadata = latest.metadata as ReconciledCatalogEnvelope["metadata"];
  const product = asArray(catalog.products).find((entry) => normalizeSku(asRecord(entry)?.sku) === normalizedSku);
  if (!product || !asRecord(product)) return null;

  return {
    catalog,
    metadata,
    product: asRecord(product)!,
  };
}
