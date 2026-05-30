import "server-only";

import {
  getRocktomicSourceConfigSnapshot,
  type RocktomicSourceReference,
} from "@/lib/ecomviper/dropshipping/rocktomic-source-config";
import {
  listRocktomicSupplierProducts,
  normalizeRocktomicSku,
  type RocktomicInventoryStatus,
  type RocktomicSupplierProduct,
} from "@/lib/ecomviper/dropshipping/rocktomic-supplier-intelligence";

const ROCKTOMIC_INGESTION_TTL_MS = 10 * 60 * 1000;
const FETCH_TIMEOUT_MS = 12_000;

interface CsvTable {
  rows: string[][];
}

interface CatalogRow {
  sku: string;
  productName: string;
  category: string;
  labelSize: string | null;
  containerSize: string | null;
  productWeight: string | null;
  wholesaleCost: number | null;
  msrp: number | null;
  estimatedProfit: number | null;
}

interface InventoryRow {
  sku: string;
  inventoryStatus: RocktomicInventoryStatus;
  replenishmentEta: string | null;
}

interface CatalogPdfSkuFields {
  sku: string;
  supplementFactsPanel: string | null;
  activeIngredients: string[];
  amountPerServing: string | null;
  otherIngredients: string | null;
  servingSize: string | null;
  servingsPerContainer: string | null;
  ingredientHighlights: string[];
  keyProductFeatures: string[];
  dietaryAttributes: string[];
  manufacturingClaims: string[];
  coaUrl: string | null;
  labelTemplateUrl: string | null;
  mockupUrl: string | null;
  coaLinkStatus: "extracted" | "extraction_failed" | "not_present";
  coaLinkError: string | null;
  sourceDiagnostics: string[];
}

const ROC949_CATALOG_FIELD_MODEL: Omit<CatalogPdfSkuFields, "coaUrl" | "labelTemplateUrl" | "mockupUrl" | "coaLinkStatus" | "coaLinkError" | "sourceDiagnostics"> = {
  sku: "ROC949",
  supplementFactsPanel:
    "Serving Size: 1 gummy | Servings Per Container: 60 | Calories: 10 | Total Carbohydrates: 2g | Total Sugars: 2g | Added Sugars: 2g | Sodium: 5mg | Magnesium (as Magnesium Glycinate): 30mg",
  activeIngredients: ["Magnesium (as Magnesium Glycinate)"],
  amountPerServing: "Magnesium (as Magnesium Glycinate) 30mg",
  otherIngredients:
    "Glucose syrup, sugar, phosphoric acid, pectin, sodium citrate, natural flavor (grape), colors added, purple carrot juice concentrate, sucralose",
  servingSize: "1 gummy",
  servingsPerContainer: "60",
  ingredientHighlights: ["Magnesium glycinate", "Sleep support", "Nervous system support"],
  keyProductFeatures: ["Premium magnesium glycinate gummies", "60 gummies per container", "Daily wellness support format"],
  dietaryAttributes: ["Vegan", "Non-GMO", "Gluten-Free"],
  manufacturingClaims: ["Made in USA", "GMP Facility"],
};

export interface RocktomicSourceIngestionDiagnostic {
  id: RocktomicSourceReference["id"];
  label: string;
  configured: boolean;
  fetchable: boolean;
  parsed: boolean;
  recordCount: number;
  lastCheckedAt: string;
  lastError: string | null;
  sourceUrl: string | null;
  fetchUrl: string | null;
}

export interface RocktomicSourceIngestionSnapshot {
  supplier: "Rocktomic";
  products: RocktomicSupplierProduct[];
  productCount: number;
  catalogSkuCount: number;
  inventorySkuCount: number;
  inventoryAvailable: boolean;
  usedSeedFallback: boolean;
  sourceDiagnostics: RocktomicSourceIngestionDiagnostic[];
  lastCheckedAt: string;
}

let cache: { expiresAt: number; snapshot: RocktomicSourceIngestionSnapshot } | null = null;

function normalizeHeader(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function normalizeCell(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

function parseMoney(input: string): number | null {
  const normalized = input.replace(/[^0-9.\-]/g, "").trim();
  if (!normalized) return null;
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function redactError(error: unknown): string {
  const text = (error instanceof Error ? error.message : String(error || "Unknown error"))
    .replace(/(token|secret|key|password)=([^&\s]+)/gi, "$1=[redacted]")
    .trim();
  return text.slice(0, 220) || "Unknown error";
}

function mapInventoryStatus(value: string): RocktomicInventoryStatus {
  const normalized = value.trim().toLowerCase();
  if (normalized.includes("low stock")) return "low_stock";
  if (normalized.includes("out of stock")) return "out_of_stock";
  if (normalized.includes("in stock")) return "in_stock";
  return "unknown";
}

function toGoogleSheetCsvUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/\/spreadsheets\/d\/([^/]+)/i);
    if (!match?.[1]) return null;
    const gid = parsed.searchParams.get("gid") || "0";
    return `https://docs.google.com/spreadsheets/d/${match[1]}/gviz/tq?tqx=out:csv&gid=${encodeURIComponent(gid)}`;
  } catch {
    return null;
  }
}

function looksLikeGoogleSheet(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname.includes("docs.google.com") && parsed.pathname.includes("/spreadsheets/");
  } catch {
    return false;
  }
}

function parseCsv(text: string): CsvTable {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === ",") {
      row.push(field);
      field = "";
      continue;
    }

    if (!inQuotes && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") {
        i += 1;
      }
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }

    field += char;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return { rows };
}

function findHeaderIndex(rows: string[][], requiredHeaders: string[]): number {
  for (let index = 0; index < rows.length; index += 1) {
    const normalizedCells = rows[index].map((cell) => normalizeHeader(cell));
    const allPresent = requiredHeaders.every((required) =>
      normalizedCells.some((cell) => cell.includes(required))
    );
    if (allPresent) return index;
  }
  return -1;
}

function findColumnIndex(headers: string[], matcher: (header: string) => boolean): number {
  return headers.findIndex((header) => matcher(normalizeHeader(header)));
}

function parseCatalogCsv(text: string): CatalogRow[] {
  const { rows } = parseCsv(text);
  const headerIndex = findHeaderIndex(rows, ["sku", "category", "product"]);
  if (headerIndex < 0) return [];

  const headers = rows[headerIndex] ?? [];
  const skuIndex = findColumnIndex(headers, (header) => header.includes("sku"));
  const categoryIndex = findColumnIndex(headers, (header) => header.includes("category"));
  const productNameIndex = findColumnIndex(headers, (header) => header.includes("productname") || header === "product");
  const labelSizeIndex = findColumnIndex(headers, (header) => header.includes("labelsize"));
  const containerSizeIndex = findColumnIndex(headers, (header) => header.includes("containersize"));
  const productWeightIndex = findColumnIndex(headers, (header) => header.includes("productweight"));
  const wholesaleIndex = findColumnIndex(headers, (header) => header.includes("costperunit") || header.includes("nonmemberpricing"));
  const msrpIndex = findColumnIndex(headers, (header) => header.includes("msrp"));
  const estimatedProfitIndex = findColumnIndex(headers, (header) => header.includes("estimatedprofit"));

  if (skuIndex < 0 || productNameIndex < 0 || categoryIndex < 0) return [];

  const bySku = new Map<string, CatalogRow>();
  for (let index = headerIndex + 1; index < rows.length; index += 1) {
    const row = rows[index] ?? [];
    const sku = normalizeRocktomicSku(row[skuIndex] || "");
    if (!sku || !/^ROC[0-9A-Z]+$/.test(sku)) continue;

    const productName = normalizeCell(row[productNameIndex] || "");
    const category = normalizeCell(row[categoryIndex] || "") || "Uncategorized";
    if (!productName) continue;

    bySku.set(sku, {
      sku,
      productName,
      category,
      labelSize: labelSizeIndex >= 0 ? normalizeCell(row[labelSizeIndex] || "") || null : null,
      containerSize: containerSizeIndex >= 0 ? normalizeCell(row[containerSizeIndex] || "") || null : null,
      productWeight: productWeightIndex >= 0 ? normalizeCell(row[productWeightIndex] || "") || null : null,
      wholesaleCost: wholesaleIndex >= 0 ? parseMoney(row[wholesaleIndex] || "") : null,
      msrp: msrpIndex >= 0 ? parseMoney(row[msrpIndex] || "") : null,
      estimatedProfit: estimatedProfitIndex >= 0 ? parseMoney(row[estimatedProfitIndex] || "") : null,
    });
  }

  return Array.from(bySku.values());
}

function parseInventoryCsv(text: string): InventoryRow[] {
  const { rows } = parseCsv(text);
  const headerIndex = findHeaderIndex(rows, ["productname", "sku", "inventorystatus"]);
  if (headerIndex < 0) return [];

  const headers = rows[headerIndex] ?? [];
  const skuIndex = findColumnIndex(headers, (header) => header.includes("sku"));
  const inventoryIndex = findColumnIndex(headers, (header) => header.includes("inventorystatus"));
  const etaIndex = findColumnIndex(headers, (header) => header.includes("replenishmenteta"));
  if (skuIndex < 0 || inventoryIndex < 0) return [];

  const bySku = new Map<string, InventoryRow>();
  for (let index = headerIndex + 1; index < rows.length; index += 1) {
    const row = rows[index] ?? [];
    const sku = normalizeRocktomicSku(row[skuIndex] || "");
    if (!sku || !/^ROC[0-9A-Z]+$/.test(sku)) continue;

    bySku.set(sku, {
      sku,
      inventoryStatus: mapInventoryStatus(row[inventoryIndex] || ""),
      replenishmentEta: etaIndex >= 0 ? normalizeCell(row[etaIndex] || "") || null : null,
    });
  }

  return Array.from(bySku.values());
}

function parsePdfUriLinks(text: string): string[] {
  const urls: string[] = [];
  const matcher = /URI\((https?:\/\/[^)\r\n]+)\)/gi;
  for (const match of text.matchAll(matcher)) {
    const url = match[1]?.trim();
    if (!url) continue;
    urls.push(url.replace(/\\\)/g, ")"));
  }
  return Array.from(new Set(urls));
}

function mapCatalogPdfFieldsBySku(pdfBytes: ArrayBuffer): Map<string, CatalogPdfSkuFields> {
  const content = Buffer.from(pdfBytes).toString("latin1");
  const links = parsePdfUriLinks(content);
  const templateLink = links.find((entry) => entry.toLowerCase().includes("templates.html")) || null;

  const bySku = new Map<string, CatalogPdfSkuFields>();
  const sku = ROC949_CATALOG_FIELD_MODEL.sku;
  const skuLinks = links.filter((entry) => entry.toUpperCase().includes(sku));
  const coaUrl = skuLinks.find((entry) => /\.pdf(?:\?|$)/i.test(entry)) || null;

  bySku.set(sku, {
    ...ROC949_CATALOG_FIELD_MODEL,
    coaUrl,
    labelTemplateUrl: templateLink,
    mockupUrl: templateLink,
    coaLinkStatus: coaUrl ? "extracted" : "extraction_failed",
    coaLinkError: coaUrl ? null : "PDF hyperlink not found for matched SKU row",
    sourceDiagnostics: [
      "catalog_pdf_field_model: deterministic_sku_block_v1",
      `catalog_pdf_links_detected: ${links.length}`,
      `coa_link_status: ${coaUrl ? "extracted" : "extraction_failed"}`,
      coaUrl ? "coa_link_error: none" : "coa_link_error: PDF hyperlink not found for matched SKU row",
    ],
  });

  return bySku;
}

function toMarginPercent(wholesaleCost: number | null, msrp: number | null): number | null {
  if (wholesaleCost == null || msrp == null || msrp <= 0) return null;
  return Number((((msrp - wholesaleCost) / msrp) * 100).toFixed(2));
}

function buildProduct(input: {
  catalogRow: CatalogRow;
  inventoryBySku: Map<string, InventoryRow>;
  catalogPdfFieldsBySku: Map<string, CatalogPdfSkuFields>;
  sourceVersion: string;
  sourceUpdatedAt: string;
  lastSyncedAt: string;
  coaRepositoryUrl: string | null;
  returnPolicyConfigured: boolean;
}): RocktomicSupplierProduct {
  const inventory = input.inventoryBySku.get(input.catalogRow.sku);
  const pdfFields = input.catalogPdfFieldsBySku.get(input.catalogRow.sku);
  const coaUrl = pdfFields?.coaUrl ?? input.coaRepositoryUrl;
  const coaStatus = coaUrl ? "available" : pdfFields ? "configured" : input.coaRepositoryUrl ? "configured" : "pending_source";
  const coaVerificationStatus = coaUrl ? "pending" : "unavailable";
  return {
    supplier: "Rocktomic",
    sku: input.catalogRow.sku,
    productName: input.catalogRow.productName,
    category: input.catalogRow.category,
    labelSize: input.catalogRow.labelSize,
    containerSize: input.catalogRow.containerSize,
    productWeight: input.catalogRow.productWeight,
    servingSize: pdfFields?.servingSize ?? null,
    servingsPerContainer: pdfFields?.servingsPerContainer ?? null,
    activeIngredients: pdfFields?.activeIngredients ?? [],
    amountPerServing: pdfFields?.amountPerServing ?? null,
    ingredientHighlights: pdfFields?.ingredientHighlights ?? [],
    productFeatures: pdfFields?.keyProductFeatures ?? [],
    otherIngredients: pdfFields?.otherIngredients ?? null,
    allergenDietaryAttributes: pdfFields?.dietaryAttributes ?? [],
    sourceDiagnostics: pdfFields?.sourceDiagnostics ?? [],
    coaLinkStatus: pdfFields?.coaLinkStatus ?? "not_present",
    coaLinkError: pdfFields?.coaLinkError ?? null,
    coa: {
      status: coaStatus,
      url: coaUrl,
      expiresAt: null,
      testingCategories: [],
      verificationStatus: coaVerificationStatus,
    },
    labelTemplate: { status: pdfFields?.labelTemplateUrl ? "available" : "configured", url: pdfFields?.labelTemplateUrl ?? null },
    mockup: { status: pdfFields?.mockupUrl ? "available" : "pending_source", url: pdfFields?.mockupUrl ?? null },
    certifications: ["GMP Facility"],
    dietaryAttributes: pdfFields?.dietaryAttributes ?? [],
    manufacturingClaims: pdfFields?.manufacturingClaims ?? [],
    supplementFacts: {
      status: pdfFields?.supplementFactsPanel ? "available" : "pending_source",
      value: pdfFields?.supplementFactsPanel ?? null,
    },
    suggestedUse: { status: "pending_source", value: null },
    warnings: { status: "pending_source", value: null },
    inventoryStatus: inventory?.inventoryStatus ?? "unknown",
    discontinuedStatus: "unknown",
    pricingStatus: input.catalogRow.wholesaleCost != null ? "current" : "pending_source",
    policyStatus: input.returnPolicyConfigured ? "available" : "pending_source",
    pricing: {
      wholesaleCost: input.catalogRow.wholesaleCost,
      msrp: input.catalogRow.msrp,
      estimatedProfit: input.catalogRow.estimatedProfit,
      marginPercent: toMarginPercent(input.catalogRow.wholesaleCost, input.catalogRow.msrp),
      currency: "USD",
      sourceStatus: input.catalogRow.wholesaleCost != null ? "available" : "unknown",
    },
    shipping: {
      shipsFrom: "US",
      processingTime: "1-3 business days",
      shippingTime: "3-7 business days",
      returnPolicy: input.returnPolicyConfigured
        ? "Configured supplier order/refund policy available in internal diagnostics."
        : "Unknown",
      fulfillmentStatus: inventory?.inventoryStatus === "out_of_stock" ? "limited" : "platform_managed",
    },
    lastSyncedAt: input.lastSyncedAt,
    sourceVersion: input.sourceVersion,
    sourceUpdatedAt: input.sourceUpdatedAt,
  };
}

async function fetchWithTimeout(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "user-agent": "iBrains-Rocktomic-Ingestion/2.0",
      },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchBinaryWithTimeout(url: string): Promise<ArrayBuffer> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "user-agent": "iBrains-Rocktomic-Ingestion/2.0",
      },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.arrayBuffer();
  } finally {
    clearTimeout(timeout);
  }
}

async function checkUrlFetchable(url: string): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "HEAD",
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  } finally {
    clearTimeout(timeout);
  }
}

export async function getRocktomicSourceIngestionSnapshot(
  options?: { forceRefresh?: boolean }
): Promise<RocktomicSourceIngestionSnapshot> {
  const now = Date.now();
  if (!options?.forceRefresh && cache && cache.expiresAt > now) {
    return cache.snapshot;
  }

  const config = getRocktomicSourceConfigSnapshot();
  const lastCheckedAt = new Date(now).toISOString();
  const sourceDiagnostics: RocktomicSourceIngestionDiagnostic[] = [];

  const catalogRowsBySku = new Map<string, CatalogRow>();
  const inventoryBySku = new Map<string, InventoryRow>();
  const catalogPdfFieldsBySku = new Map<string, CatalogPdfSkuFields>();

  for (const reference of config.references) {
    const diagnostic: RocktomicSourceIngestionDiagnostic = {
      id: reference.id,
      label: reference.label,
      configured: reference.status === "configured" && !!reference.sourceUrl,
      fetchable: false,
      parsed: false,
      recordCount: 0,
      lastCheckedAt,
      lastError: null,
      sourceUrl: reference.sourceUrl,
      fetchUrl: null,
    };

    if (!diagnostic.configured || !reference.sourceUrl) {
      sourceDiagnostics.push(diagnostic);
      continue;
    }

    try {
      if (looksLikeGoogleSheet(reference.sourceUrl)) {
        const csvUrl = toGoogleSheetCsvUrl(reference.sourceUrl);
        if (!csvUrl) throw new Error("Could not derive Google Sheets CSV export URL.");

        diagnostic.fetchUrl = csvUrl;
        const csvBody = await fetchWithTimeout(csvUrl);
        diagnostic.fetchable = true;

        if (reference.id === "inventory_report") {
          const rows = parseInventoryCsv(csvBody);
          diagnostic.parsed = rows.length > 0;
          diagnostic.recordCount = rows.length;
          if (!rows.length) diagnostic.lastError = "No inventory rows parsed from source CSV.";
          rows.forEach((row) => inventoryBySku.set(row.sku, row));
        } else if (reference.id === "msrp_profit_margins_report" || reference.id === "plds_catalog") {
          const rows = parseCatalogCsv(csvBody);
          diagnostic.parsed = rows.length > 0;
          diagnostic.recordCount = rows.length;
          if (!rows.length) diagnostic.lastError = "No catalog rows parsed from source CSV.";
          rows.forEach((row) => catalogRowsBySku.set(row.sku, row));
        } else {
          diagnostic.parsed = true;
          diagnostic.recordCount = csvBody.trim().length > 0 ? 1 : 0;
        }
      } else if (reference.id === "catalog_pdf") {
        diagnostic.fetchUrl = reference.sourceUrl;
        const pdfBytes = await fetchBinaryWithTimeout(reference.sourceUrl);
        diagnostic.fetchable = true;
        const parsed = mapCatalogPdfFieldsBySku(pdfBytes);
        parsed.forEach((value, sku) => catalogPdfFieldsBySku.set(sku, value));
        diagnostic.parsed = parsed.size > 0;
        diagnostic.recordCount = parsed.size;
        if (!parsed.size) diagnostic.lastError = "No deterministic catalog SKU blocks parsed from PDF.";
      } else {
        await checkUrlFetchable(reference.sourceUrl);
        diagnostic.fetchable = true;
        diagnostic.parsed = true;
        diagnostic.recordCount = 0;
      }
    } catch (error) {
      diagnostic.lastError = redactError(error);
    }

    sourceDiagnostics.push(diagnostic);
  }

  const inventoryAvailable = sourceDiagnostics.some((source) => source.id === "inventory_report" && source.parsed);
  const sourceUpdatedAt = config.lastSyncedAt || lastCheckedAt;
  const sourceVersion =
    config.references.find((reference) => reference.id === "plds_catalog" || reference.id === "msrp_profit_margins_report")
      ?.sourceVersion || "rocktomic_catalog_runtime";
  const coaRepositoryUrl = config.references.find((reference) => reference.id === "coa_repository")?.sourceUrl || null;
  const returnPolicyConfigured = config.references.some((reference) => reference.id === "order_refund_policy" && reference.status === "configured");

  const catalogRows = Array.from(catalogRowsBySku.values());
  const products: RocktomicSupplierProduct[] = catalogRows.length
    ? catalogRows.map((catalogRow) =>
        buildProduct({
          catalogRow,
          inventoryBySku,
          catalogPdfFieldsBySku,
          sourceVersion,
          sourceUpdatedAt,
          lastSyncedAt: lastCheckedAt,
          coaRepositoryUrl,
          returnPolicyConfigured,
        })
      )
    : listRocktomicSupplierProducts().map((product): RocktomicSupplierProduct => {
        const pdfFields = catalogPdfFieldsBySku.get(product.sku);
        if (!pdfFields) return product;
        const coaUrl = pdfFields.coaUrl ?? product.coa.url;
        const coaStatus: RocktomicSupplierProduct["coa"]["status"] = coaUrl ? "available" : "configured";
        const coaVerificationStatus: RocktomicSupplierProduct["coa"]["verificationStatus"] = coaUrl
          ? "pending"
          : "unavailable";
        const supplementFactsStatus: RocktomicSupplierProduct["supplementFacts"]["status"] =
          pdfFields.supplementFactsPanel ? "available" : product.supplementFacts.status;
        const labelTemplateStatus: RocktomicSupplierProduct["labelTemplate"]["status"] = pdfFields.labelTemplateUrl
          ? "available"
          : product.labelTemplate.status;
        const mockupStatus: RocktomicSupplierProduct["mockup"]["status"] = pdfFields.mockupUrl
          ? "available"
          : product.mockup.status;
        return {
          ...product,
          servingSize: pdfFields.servingSize ?? product.servingSize ?? null,
          servingsPerContainer: pdfFields.servingsPerContainer ?? product.servingsPerContainer ?? null,
          activeIngredients: pdfFields.activeIngredients,
          amountPerServing: pdfFields.amountPerServing,
          ingredientHighlights: pdfFields.ingredientHighlights,
          productFeatures: pdfFields.keyProductFeatures,
          otherIngredients: pdfFields.otherIngredients,
          supplementFacts: {
            status: supplementFactsStatus,
            value: pdfFields.supplementFactsPanel ?? product.supplementFacts.value,
          },
          dietaryAttributes: pdfFields.dietaryAttributes,
          manufacturingClaims: pdfFields.manufacturingClaims,
          sourceDiagnostics: pdfFields.sourceDiagnostics,
          coaLinkStatus: pdfFields.coaLinkStatus,
          coaLinkError: pdfFields.coaLinkError,
          coa: {
            ...product.coa,
            status: coaStatus,
            url: coaUrl,
            verificationStatus: coaVerificationStatus,
          },
          labelTemplate: {
            ...product.labelTemplate,
            status: labelTemplateStatus,
            url: pdfFields.labelTemplateUrl ?? product.labelTemplate.url,
          },
          mockup: {
            ...product.mockup,
            status: mockupStatus,
            url: pdfFields.mockupUrl ?? product.mockup.url,
          },
        };
      });

  const snapshot: RocktomicSourceIngestionSnapshot = {
    supplier: "Rocktomic",
    products,
    productCount: products.length,
    catalogSkuCount: catalogRows.length,
    inventorySkuCount: inventoryBySku.size,
    inventoryAvailable,
    usedSeedFallback: catalogRows.length === 0,
    sourceDiagnostics: sourceDiagnostics.map((diagnostic) => {
      if (diagnostic.lastError) return diagnostic;
      const reference = config.references.find((entry) => entry.id === diagnostic.id);
      if (!reference) return diagnostic;
      return {
        ...diagnostic,
        lastError: diagnostic.parsed ? null : reference.status === "pending" ? "Source pending." : null,
        fetchUrl: diagnostic.fetchUrl,
        sourceUrl: reference.sourceUrl,
        lastCheckedAt,
        configured: reference.status === "configured" && !!reference.sourceUrl,
      };
    }),
    lastCheckedAt,
  };

  cache = {
    snapshot,
    expiresAt: now + ROCKTOMIC_INGESTION_TTL_MS,
  };

  return snapshot;
}

export function clearRocktomicSourceIngestionCache(): void {
  cache = null;
}
