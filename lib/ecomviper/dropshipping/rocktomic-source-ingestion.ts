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
import { getSupplierMembershipTierSelectionForUser } from "@/lib/ecomviper/settings/supplier-membership";
import {
  acquireSupplierSyncLock,
  clearRocktomicNormalizedStoreForTests,
  GLOBAL_SUPPLIER_SCOPE_USER_ID,
  getSupplierNormalizedSnapshot,
  persistSupplierNormalizedSnapshot,
  releaseSupplierSyncLock,
  type PersistedSupplierAssetsNormalized,
  type PersistedSupplierInventoryNormalized,
  type PersistedSupplierPricingNormalized,
  type PersistedSupplierProductNormalized,
  type PersistedSupplierSourceStatus,
  type PersistedSupplierSyncRun,
  type SupplierSourceSyncStatus,
} from "@/lib/ecomviper/dropshipping/rocktomic-normalized-store";

const ROCKTOMIC_INGESTION_TTL_MS = 10 * 60 * 1000;
const FETCH_TIMEOUT_MS = 12_000;
const MAX_TEXT_PAYLOAD_BYTES = 4 * 1024 * 1024;
const MAX_BINARY_PAYLOAD_BYTES = 8 * 1024 * 1024;
const MAX_TRUSTED_CATALOG_PDF_PAYLOAD_BYTES = 32 * 1024 * 1024;
const MAX_PDF_RAW_STRING_FALLBACK_SCAN_BYTES = 2 * 1024 * 1024;
const MAX_PDF_EXTRACTED_LINES = 10_000;
const MAX_PDF_TEXT_LAYER_EXTRACTION_BYTES = 12 * 1024 * 1024;

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
  membershipTierCosts: Record<string, number>;
  membershipTiersDetected: string[];
  selectedMembershipTier: string | null;
  selectedMembershipSourceColumn: string | null;
  pricingStatusLabel: string;
}

interface InventoryRow {
  sku: string;
  inventoryStatus: RocktomicInventoryStatus;
  replenishmentEta: string | null;
}

interface CatalogPdfSkuFields {
  sku: string;
  extractionStatus: "extracted" | "partial" | "failed";
  extractionErrors: string[];
  sourcePage: number | null;
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

export interface RocktomicSourceIngestionDiagnostic {
  id: RocktomicSourceReference["id"];
  label: string;
  configured: boolean;
  fetchable: boolean;
  parsed: boolean;
  recordCount: number;
  syncStatus: SupplierSourceSyncStatus;
  lastCheckedAt: string;
  lastSuccessfulSyncAt: string | null;
  lastError: string | null;
  sourceUrl: string | null;
  fetchUrl: string | null;
}

export interface RocktomicSourceIngestionSnapshot {
  supplier: "Rocktomic";
  products: RocktomicSupplierProduct[];
  productCount: number;
  catalogSkuCount: number;
  catalogExtractedSkuCount: number;
  inventorySkuCount: number;
  inventoryAvailable: boolean;
  usedSeedFallback: boolean;
  membershipTiersDetected: string[];
  sourceDiagnostics: RocktomicSourceIngestionDiagnostic[];
  lastCheckedAt: string;
  lastSuccessfulSyncAt: string | null;
  lastAttemptedSyncAt: string | null;
  syncStatus: SupplierSourceSyncStatus;
  lastSyncError: string | null;
  syncRunSummary: {
    productsParsedCount: number;
    inventoryRecordsParsedCount: number;
    pricingRecordsParsedCount: number;
    assetRecordsParsedCount: number;
  } | null;
  cacheState?: "fresh" | "stale" | "seed_fallback";
  refreshState?: "idle" | "refreshing";
}

let cache = new Map<string, { expiresAt: number; snapshot: RocktomicSourceIngestionSnapshot }>();
let inFlightByCacheKey = new Map<string, Promise<RocktomicSourceIngestionSnapshot>>();

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

function normalizeTierKey(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toTierLabel(header: string): string {
  const normalized = header.replace(/\s+/g, " ").trim();
  if (!normalized) return "Unknown Tier";
  return normalized.replace(/\s*\(t[0-9]+\)\s*$/i, "");
}

function redactError(error: unknown): string {
  if (error instanceof Error && /abort/i.test(`${error.name} ${error.message}`)) {
    return `Request timed out after ${FETCH_TIMEOUT_MS}ms`;
  }
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

export function toInventoryAvailabilityDisplay(status: string): string {
  if (status === "in_stock") return "Available";
  if (status === "low_stock") return "Limited Availability";
  if (status === "out_of_stock") return "Currently Unavailable";
  if (status === "source_unavailable") return "Inventory Status Unavailable";
  return "Availability Unknown";
}

function parseGoogleSheetGid(parsed: URL): string {
  const direct = parsed.searchParams.get("gid");
  if (direct?.trim()) return direct.trim();
  const hashMatch = parsed.hash.match(/gid=([0-9]+)/i);
  if (hashMatch?.[1]) return hashMatch[1];
  return "0";
}

export function toGoogleSheetCsvUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/\/spreadsheets\/d\/([^/]+)/i);
    if (!match?.[1]) return null;
    const gid = parseGoogleSheetGid(parsed);
    return `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv&gid=${encodeURIComponent(gid)}`;
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

function parseCatalogCsv(
  text: string,
  options?: { selectedMembershipTierKey?: string | null }
): { rows: CatalogRow[]; membershipTiersDetected: string[] } {
  const { rows } = parseCsv(text);
  const headerIndex = findHeaderIndex(rows, ["sku", "category", "product"]);
  if (headerIndex < 0) return { rows: [], membershipTiersDetected: [] };

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

  if (skuIndex < 0 || productNameIndex < 0 || categoryIndex < 0) return { rows: [], membershipTiersDetected: [] };

  const membershipTierColumns = headers
    .map((header, index) => ({
      index,
      rawHeader: header,
      normalized: normalizeHeader(header),
      label: toTierLabel(header),
    }))
    .filter((entry) => {
      if (entry.index === skuIndex || entry.index === categoryIndex || entry.index === productNameIndex) return false;
      if (entry.index === labelSizeIndex || entry.index === containerSizeIndex || entry.index === productWeightIndex) return false;
      if (entry.normalized.includes("msrp") || entry.normalized.includes("estimatedprofit")) return false;
      return (
        entry.normalized.includes("costperunit") ||
        entry.normalized.includes("nonmemberpricing") ||
        entry.normalized.includes("membership") ||
        /\(t[0-9]+\)/i.test(entry.rawHeader)
      );
    });

  const membershipTiersDetected = Array.from(new Set(membershipTierColumns.map((entry) => entry.label)));
  const selectedTierKey = normalizeTierKey(options?.selectedMembershipTierKey || "");
  const selectedTierColumn =
    membershipTierColumns.find((entry) => normalizeTierKey(entry.label) === selectedTierKey) ??
    membershipTierColumns[0] ??
    null;

  const bySku = new Map<string, CatalogRow>();
  for (let index = headerIndex + 1; index < rows.length; index += 1) {
    const row = rows[index] ?? [];
    const sku = normalizeRocktomicSku(row[skuIndex] || "");
    if (!sku || !/^ROC[0-9A-Z]+$/.test(sku)) continue;

    const productName = normalizeCell(row[productNameIndex] || "");
    const category = normalizeCell(row[categoryIndex] || "") || "Uncategorized";
    if (!productName) continue;

    const membershipTierCosts = membershipTierColumns.reduce<Record<string, number>>((accumulator, tier) => {
      const value = parseMoney(row[tier.index] || "");
      if (value != null) {
        accumulator[tier.label] = value;
      }
      return accumulator;
    }, {});

    const selectedMembershipTier = selectedTierColumn?.label ?? null;
    const selectedMembershipSourceColumn = selectedTierColumn?.rawHeader ?? null;
    const selectedWholesaleCost = selectedTierColumn
      ? parseMoney(row[selectedTierColumn.index] || "")
      : wholesaleIndex >= 0
        ? parseMoney(row[wholesaleIndex] || "")
        : null;

    const pricingStatusLabel =
      selectedMembershipTier && selectedWholesaleCost == null
        ? "source_unavailable_for_selected_membership_tier"
        : selectedMembershipTier
          ? "tier_pricing_mapped"
          : selectedWholesaleCost != null
            ? "default_pricing_mapped"
            : "pricing_source_unavailable";

    bySku.set(sku, {
      sku,
      productName,
      category,
      labelSize: labelSizeIndex >= 0 ? normalizeCell(row[labelSizeIndex] || "") || null : null,
      containerSize: containerSizeIndex >= 0 ? normalizeCell(row[containerSizeIndex] || "") || null : null,
      productWeight: productWeightIndex >= 0 ? normalizeCell(row[productWeightIndex] || "") || null : null,
      wholesaleCost: selectedWholesaleCost,
      msrp: msrpIndex >= 0 ? parseMoney(row[msrpIndex] || "") : null,
      estimatedProfit: estimatedProfitIndex >= 0 ? parseMoney(row[estimatedProfitIndex] || "") : null,
      membershipTierCosts,
      membershipTiersDetected,
      selectedMembershipTier,
      selectedMembershipSourceColumn,
      pricingStatusLabel,
    });
  }

  return { rows: Array.from(bySku.values()), membershipTiersDetected };
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

function decodePdfString(input: string): string {
  return input
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\\\/g, "\\")
    .replace(/\r\n/g, " ")
    .replace(/\r/g, " ")
    .replace(/\n/g, " ");
}

function extractPdfTextContent(content: string): string[] {
  const lines: string[] = [];
  const streamPattern = /stream\r?\n([\s\S]*?)\r?\nendstream/g;

  for (const match of content.matchAll(streamPattern)) {
    const streamBytes = Buffer.from(match[1] || "", "latin1");
    let decoded = "";
    try {
      decoded = require("node:zlib").inflateSync(streamBytes).toString("latin1");
    } catch {
      continue;
    }

    const tjPattern = /\[((?:[^\]\\]|\\.|\\\])*)\]\s*TJ/g;
    for (const tj of decoded.matchAll(tjPattern)) {
      const inner = tj[1] || "";
      const textSegments = Array.from(inner.matchAll(/\(([^\\)]*(?:\\.[^\\)]*)*)\)/g)).map((segment) =>
        decodePdfString(segment[1] || "")
      );
      if (textSegments.length) lines.push(textSegments.join(""));
      if (lines.length >= MAX_PDF_EXTRACTED_LINES) break;
    }
    if (lines.length >= MAX_PDF_EXTRACTED_LINES) break;

    const tjPatternSingle = /\(([^\\)]*(?:\\.[^\\)]*)*)\)\s*Tj/g;
    for (const tj of decoded.matchAll(tjPatternSingle)) {
      lines.push(decodePdfString(tj[1] || ""));
      if (lines.length >= MAX_PDF_EXTRACTED_LINES) break;
    }
    if (lines.length >= MAX_PDF_EXTRACTED_LINES) break;
  }

  if (
    lines.length < MAX_PDF_EXTRACTED_LINES &&
    Buffer.byteLength(content, "latin1") <= MAX_PDF_RAW_STRING_FALLBACK_SCAN_BYTES
  ) {
    const rawPattern = /\(([^\\)]*(?:\\.[^\\)]*)*)\)/g;
    for (const match of content.matchAll(rawPattern)) {
      const decoded = decodePdfString(match[1] || "");
      if (decoded.length < 3) continue;
      if (!/[a-z0-9]/i.test(decoded)) continue;
      lines.push(decoded);
      if (lines.length >= MAX_PDF_EXTRACTED_LINES) break;
    }
  }

  const normalized = lines
    .join("\n")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .split(/\r?\n/g)
    .map((entry) => normalizeCell(entry))
    .filter((entry) => entry.length > 1);

  return Array.from(new Set(normalized));
}

function extractLineValue(block: string, label: string): string | null {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matcher = new RegExp(`${escaped}\\s*[:\\-]?\\s*([^\\n\\r|]{1,260})`, "i");
  const match = block.match(matcher);
  if (!match?.[1]) return null;
  const value = normalizeCell(match[1]).replace(/^[\u2022\-–]\s*/, "");
  return value || null;
}

function listDelimitedValues(input: string | null): string[] {
  if (!input) return [];
  return input
    .split(/[,;|]/g)
    .map((entry) => normalizeCell(entry))
    .filter(Boolean);
}

function firstDelimitedValue(input: string | null): string | null {
  if (!input) return null;
  const value = input.split(/[;|]/g)[0] || "";
  const normalized = normalizeCell(value);
  return normalized || null;
}

function collectSkuBlock(lines: string[], sku: string, productName: string | null): { block: string; textAnchorFound: boolean } {
  const lowerSku = sku.toLowerCase();
  const productNameLower = (productName || "").toLowerCase();
  let anchorIndex = lines.findIndex((line) => line.toLowerCase().includes(lowerSku));
  if (anchorIndex < 0 && productNameLower) {
    anchorIndex = lines.findIndex((line) => line.toLowerCase().includes(productNameLower));
  }
  if (anchorIndex < 0) {
    return { block: "", textAnchorFound: false };
  }

  const start = Math.max(0, anchorIndex - 12);
  const end = Math.min(lines.length, anchorIndex + 56);
  const block = lines.slice(start, end).join("\n");
  return { block, textAnchorFound: true };
}

function mapCatalogPdfFieldsBySku(input: {
  pdfBytes: ArrayBuffer;
  catalogRowsBySku: Map<string, CatalogRow>;
}): Map<string, CatalogPdfSkuFields> {
  const contentBuffer = Buffer.from(input.pdfBytes);
  const content = contentBuffer.toString("latin1");
  const links = parsePdfUriLinks(content);
  const shouldExtractTextLayer = contentBuffer.byteLength <= MAX_PDF_TEXT_LAYER_EXTRACTION_BYTES;
  const extractedLines = shouldExtractTextLayer ? extractPdfTextContent(content) : [];
  const normalizedText = extractedLines.join("\n");
  const templateLink = links.find((entry) => entry.toLowerCase().includes("templates.html")) || null;

  const coaBySku = new Map<string, string>();
  for (const link of links) {
    const skuMatch = link.toUpperCase().match(/ROC[0-9A-Z]+/);
    if (!skuMatch?.[0]) continue;
    const sku = normalizeRocktomicSku(skuMatch[0]);
    if (/\.pdf(?:\?|$)/i.test(link)) {
      coaBySku.set(sku, link);
    }
  }

  const extractedSkus = new Set<string>();
  const skuTextMatches = normalizedText.toUpperCase().match(/ROC[0-9A-Z]{3,8}/g) || [];
  skuTextMatches.forEach((entry) => extractedSkus.add(normalizeRocktomicSku(entry)));
  Array.from(coaBySku.keys()).forEach((entry) => extractedSkus.add(entry));
  Array.from(input.catalogRowsBySku.keys()).forEach((entry) => extractedSkus.add(entry));

  const records = new Map<string, CatalogPdfSkuFields>();
  for (const sku of extractedSkus) {
    const catalogRow = input.catalogRowsBySku.get(sku);
    const blockResult = collectSkuBlock(extractedLines, sku, catalogRow?.productName || null);
    const block = blockResult.block;

    const supplementFactsPanel = extractLineValue(block, "Supplement Facts");
    const servingSize = firstDelimitedValue(extractLineValue(block, "Serving Size"));
    const servingsPerContainer = firstDelimitedValue(extractLineValue(block, "Servings Per Container"));
    const amountPerServing = extractLineValue(block, "Amount Per Serving");
    const otherIngredients = extractLineValue(block, "Other Ingredients");
    const activeIngredients = listDelimitedValues(extractLineValue(block, "Active Ingredients"));
    const ingredientHighlights = listDelimitedValues(extractLineValue(block, "Ingredient Highlights"));
    const keyProductFeatures = listDelimitedValues(extractLineValue(block, "Key Product Features"));
    const dietaryAttributes = listDelimitedValues(extractLineValue(block, "Dietary Attributes"));
    const manufacturingClaims = listDelimitedValues(extractLineValue(block, "Manufacturing Claims"));

    const coaUrl = coaBySku.get(sku) || null;
    const extractionErrors: string[] = [];
    if (!shouldExtractTextLayer) {
      extractionErrors.push("PDF text-layer extraction skipped due large payload guard; supplement facts may require OCR.");
    }
    if (!coaUrl) extractionErrors.push("PDF hyperlink not found for matched SKU row");
    if (!supplementFactsPanel) extractionErrors.push("Supplement Facts panel not extracted from PDF text layer");
    if (!servingSize) extractionErrors.push("Serving Size not extracted from PDF text layer");
    if (!servingsPerContainer) extractionErrors.push("Servings Per Container not extracted from PDF text layer");

    const extractedFieldsCount = [
      supplementFactsPanel,
      servingSize,
      servingsPerContainer,
      amountPerServing,
      otherIngredients,
      activeIngredients.length > 0 ? "activeIngredients" : "",
      ingredientHighlights.length > 0 ? "ingredientHighlights" : "",
      keyProductFeatures.length > 0 ? "keyProductFeatures" : "",
      dietaryAttributes.length > 0 ? "dietaryAttributes" : "",
      manufacturingClaims.length > 0 ? "manufacturingClaims" : "",
      coaUrl,
      templateLink,
    ].filter(Boolean).length;

    const extractionStatus: CatalogPdfSkuFields["extractionStatus"] =
      extractedFieldsCount >= 8 ? "extracted" : extractedFieldsCount > 0 ? "partial" : "failed";

    const coaLinkStatus: CatalogPdfSkuFields["coaLinkStatus"] = coaUrl ? "extracted" : "extraction_failed";
    const coaLinkError = coaUrl ? null : "PDF hyperlink not found for matched SKU row";

    records.set(sku, {
      sku,
      extractionStatus,
      extractionErrors,
      sourcePage: null,
      supplementFactsPanel,
      activeIngredients,
      amountPerServing,
      otherIngredients,
      servingSize,
      servingsPerContainer,
      ingredientHighlights,
      keyProductFeatures,
      dietaryAttributes,
      manufacturingClaims,
      coaUrl,
      labelTemplateUrl: templateLink,
      mockupUrl: templateLink,
      coaLinkStatus,
      coaLinkError,
      sourceDiagnostics: [
        "catalog_pdf_extraction_engine: universal_v1",
        `catalog_pdf_text_layer_mode: ${shouldExtractTextLayer ? "full_parse" : "skip_large_payload_guard"}`,
        `catalog_pdf_links_detected: ${links.length}`,
        `catalog_pdf_text_anchor: ${blockResult.textAnchorFound ? "found" : "not_found"}`,
        `catalog_extraction_status: ${extractionStatus}`,
        `coa_link_status: ${coaLinkStatus}`,
        `coa_link_error: ${coaLinkError || "none"}`,
      ],
    });
  }

  return records;
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
    sourceDiagnostics: pdfFields
      ? [
          ...pdfFields.sourceDiagnostics,
          `catalog_source_page: ${pdfFields.sourcePage != null ? pdfFields.sourcePage : "unknown"}`,
          ...(pdfFields.extractionErrors.length
            ? pdfFields.extractionErrors.map((entry) => `catalog_extraction_error: ${entry}`)
            : []),
        ]
      : [],
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
      status: pdfFields?.supplementFactsPanel ? "available" : pdfFields ? "ocr_required" : "pending_source",
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
      sourceStatus:
        input.catalogRow.wholesaleCost != null
          ? "available"
          : input.catalogRow.selectedMembershipTier
            ? "source_unavailable"
            : "unknown",
      membershipTier: input.catalogRow.selectedMembershipTier,
      membershipTiersDetected: input.catalogRow.membershipTiersDetected,
      membershipTierCosts: input.catalogRow.membershipTierCosts,
      sourceSheet: "PLDS/MSRP",
      sourceColumn: input.catalogRow.selectedMembershipSourceColumn,
      lastCheckedAt: input.lastSyncedAt,
      pricingStatusLabel: input.catalogRow.pricingStatusLabel,
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

function parseContentLength(header: string | null): number | null {
  if (!header) return null;
  const parsed = Number.parseInt(header, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function isTrustedCatalogPdfSourceUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    if (parsed.hostname !== "rocktomicplatform.blob.core.windows.net") return false;
    const pathname = parsed.pathname.toLowerCase();
    if (!pathname.startsWith("/client-resources/")) return false;
    return pathname.endsWith("/supplement-&-apparel-catalog.pdf");
  } catch {
    return false;
  }
}

function resolveBinaryPayloadLimit(input: {
  referenceId: RocktomicSourceReference["id"];
  sourceUrl: string;
}): number {
  if (input.referenceId === "catalog_pdf" && isTrustedCatalogPdfSourceUrl(input.sourceUrl)) {
    return MAX_TRUSTED_CATALOG_PDF_PAYLOAD_BYTES;
  }
  return MAX_BINARY_PAYLOAD_BYTES;
}

function assertPayloadLimit(input: { sizeBytes: number; maxBytes: number; sourceUrl: string }): void {
  if (input.sizeBytes <= input.maxBytes) return;
  throw new Error(
    `Payload too large (${input.sizeBytes} bytes) for ${input.sourceUrl}; max allowed is ${input.maxBytes} bytes.`
  );
}

function withRuntimeSnapshotState(
  snapshot: RocktomicSourceIngestionSnapshot,
  state: { cacheState: "fresh" | "stale" | "seed_fallback"; refreshState: "idle" | "refreshing" }
): RocktomicSourceIngestionSnapshot {
  return {
    ...snapshot,
    cacheState: state.cacheState,
    refreshState: state.refreshState,
  };
}

function buildSeedFallbackSnapshot(input: {
  config: ReturnType<typeof getRocktomicSourceConfigSnapshot>;
  lastCheckedAt: string;
  selectedMembershipTier: string | null;
  refreshScheduled: boolean;
  reason: string;
  includeProducts?: boolean;
  syncStatus?: SupplierSourceSyncStatus;
  lastAttemptedSyncAt?: string | null;
  lastSuccessfulSyncAt?: string | null;
  lastSyncError?: string | null;
}): RocktomicSourceIngestionSnapshot {
  const products = input.includeProducts === false ? [] : listRocktomicSupplierProducts();
  const syncStatus = input.syncStatus || "never_synced";
  return {
    supplier: "Rocktomic",
    products,
    productCount: products.length,
    catalogSkuCount: 0,
    catalogExtractedSkuCount: 0,
    inventorySkuCount: 0,
    inventoryAvailable: false,
    usedSeedFallback: true,
    membershipTiersDetected: input.selectedMembershipTier ? [input.selectedMembershipTier] : [],
    sourceDiagnostics: input.config.references.map((reference) => ({
      id: reference.id,
      label: reference.label,
      configured: reference.status === "configured" && Boolean(reference.sourceUrl),
      fetchable: false,
      parsed: false,
      recordCount: 0,
      syncStatus,
      lastCheckedAt: input.lastCheckedAt,
      lastSuccessfulSyncAt: input.lastSuccessfulSyncAt || null,
      lastError: input.reason,
      sourceUrl: reference.sourceUrl,
      fetchUrl: null,
    })),
    lastCheckedAt: input.lastCheckedAt,
    lastSuccessfulSyncAt: input.lastSuccessfulSyncAt || null,
    lastAttemptedSyncAt: input.lastAttemptedSyncAt || null,
    syncStatus,
    lastSyncError: input.lastSyncError || input.reason,
    syncRunSummary: null,
    cacheState: "seed_fallback",
    refreshState: input.refreshScheduled ? "refreshing" : "idle",
  };
}

function toSourceSyncStatus(input: {
  configured: boolean;
  fetchable: boolean;
  parsed: boolean;
  lastError: string | null;
  extractionStatusHint?: string | null;
}): SupplierSourceSyncStatus {
  if (!input.configured) return "never_synced";
  if (input.lastError) {
    const normalized = input.lastError.toLowerCase();
    if (normalized.includes("403") || normalized.includes("401")) return "source_auth_required";
    if (normalized.includes("404") || normalized.includes("not found")) return "source_inaccessible";
    return "sync_failed";
  }
  if (input.extractionStatusHint === "ocr_required") return "ocr_required";
  if (input.parsed && input.fetchable) return "synced";
  if (input.fetchable && !input.parsed) return "parsing_partial";
  if (!input.fetchable) return "source_inaccessible";
  return "never_synced";
}

function toPersistedSourceStatuses(input: {
  diagnostics: RocktomicSourceIngestionDiagnostic[];
  lastSuccessfulSyncAt: string | null;
}): PersistedSupplierSourceStatus[] {
  return input.diagnostics.map((diagnostic) => ({
    sourceId: diagnostic.id,
    sourceLabel: diagnostic.label,
    configured: diagnostic.configured,
    fetchable: diagnostic.fetchable,
    parsed: diagnostic.parsed,
    recordCount: diagnostic.recordCount,
    syncStatus: diagnostic.syncStatus,
    sourceUrl: diagnostic.sourceUrl,
    fetchUrl: diagnostic.fetchUrl,
    lastCheckedAt: diagnostic.lastCheckedAt,
    lastSuccessfulSyncAt: input.lastSuccessfulSyncAt,
    lastError: diagnostic.lastError,
    metadata: {},
  }));
}

function toPersistedProducts(input: {
  products: RocktomicSupplierProduct[];
  lastSyncedAt: string;
}): PersistedSupplierProductNormalized[] {
  return input.products.map((product) => ({
    sku: product.sku,
    productName: product.productName,
    category: product.category || null,
    labelSize: product.labelSize ?? null,
    containerSize: product.containerSize ?? null,
    productWeight: product.productWeight ?? null,
    productForm: null,
    supplementFactsRaw: product.supplementFacts.value ?? null,
    supplementFactsText: product.supplementFacts.value ?? null,
    servingSize: product.servingSize ?? null,
    servingsPerContainer: product.servingsPerContainer ?? null,
    activeIngredients: product.activeIngredients ?? [],
    amountPerServing: product.amountPerServing ?? null,
    otherIngredients: product.otherIngredients ?? null,
    ingredientHighlightsSource: product.ingredientHighlights ?? [],
    keyProductFeatures: product.productFeatures ?? [],
    dietaryAttributes: product.dietaryAttributes ?? [],
    manufacturingClaims: product.manufacturingClaims ?? [],
    certifications: product.certifications ?? [],
    warnings: product.warnings?.value ?? null,
    suggestedUse: product.suggestedUse?.value ?? null,
    coaUrl: product.coa.url ?? null,
    coaStatus: product.coa.status ?? null,
    coaExtractionStatus:
      product.coaLinkStatus === "extraction_failed" ? "extraction_failed" : product.coaLinkStatus === "extracted" ? "extracted" : "not_present",
    coaExtractionError: product.coaLinkError ?? null,
    labelTemplateUrl: product.labelTemplate.url ?? null,
    mockupUrl: product.mockup.url ?? null,
    sourceCatalogPage: null,
    sourceVersion: product.sourceVersion ?? null,
    extractionStatus: product.supplementFacts.status === "ocr_required" ? "ocr_required" : product.coaLinkStatus || "unknown",
    extractionErrors: product.sourceDiagnostics?.filter((entry) => entry.toLowerCase().includes("error")) ?? [],
    lastSyncedAt: input.lastSyncedAt,
    rawPayload: product as unknown as Record<string, unknown>,
  }));
}

function toPersistedInventory(input: {
  products: RocktomicSupplierProduct[];
  sourceUpdatedAt: string;
  lastSyncedAt: string;
}): PersistedSupplierInventoryNormalized[] {
  return input.products.map((product) => ({
    sku: product.sku,
    inventoryStatusRaw: product.inventoryStatus,
    inventoryStatusNormalized: product.inventoryStatus || "unknown",
    availabilityDisplay: toInventoryAvailabilityDisplay(product.inventoryStatus || "unknown"),
    sourceReport: "Inventory Report",
    sourceUpdatedAt: input.sourceUpdatedAt,
    lastSyncedAt: input.lastSyncedAt,
    extractionStatus: "synced",
    extractionErrors: [],
  }));
}

function toPersistedPricing(input: {
  products: RocktomicSupplierProduct[];
  lastSyncedAt: string;
}): PersistedSupplierPricingNormalized[] {
  return input.products.map((product) => ({
    sku: product.sku,
    productName: product.productName,
    category: product.category,
    detectedMembershipTiers: product.pricing?.membershipTiersDetected ?? [],
    costsByMembershipTier: product.pricing?.membershipTierCosts ?? {},
    msrp: product.pricing?.msrp ?? null,
    sourceSheet: product.pricing?.sourceSheet ?? "PLDS/MSRP",
    sourceTab: null,
    sourceRow: null,
    sourceVersion: product.sourceVersion,
    lastSyncedAt: input.lastSyncedAt,
    extractionStatus:
      product.pricing?.pricingStatusLabel === "source_unavailable_for_selected_membership_tier"
        ? "parsing_partial"
        : "synced",
    extractionErrors:
      product.pricing?.pricingStatusLabel === "source_unavailable_for_selected_membership_tier"
        ? ["Cost not found for selected membership tier."]
        : [],
  }));
}

function toPersistedAssets(input: {
  products: RocktomicSupplierProduct[];
  lastSyncedAt: string;
}): PersistedSupplierAssetsNormalized[] {
  return input.products.map((product) => ({
    sku: product.sku,
    labelTemplateUrl: product.labelTemplate.url ?? null,
    mockupUrl: product.mockup.url ?? null,
    supplementFactsAssetUrl: null,
    coaUrl: product.coa.url ?? null,
    assetStatus: product.labelTemplate.url || product.mockup.url || product.coa.url ? "available" : "pending_source",
    lastSyncedAt: input.lastSyncedAt,
    extractionStatus:
      product.supplementFacts.status === "ocr_required"
        ? "ocr_required"
        : product.coaLinkStatus === "extraction_failed"
          ? "parsing_partial"
          : "synced",
    extractionErrors: product.coaLinkError ? [product.coaLinkError] : [],
  }));
}

function toSyncSummary(snapshot: RocktomicSourceIngestionSnapshot): PersistedSupplierSyncRun {
  const syncStatus = snapshot.sourceDiagnostics.some((entry) => entry.syncStatus === "sync_failed")
    ? "sync_failed"
    : snapshot.sourceDiagnostics.some((entry) => entry.syncStatus === "source_auth_required")
      ? "source_auth_required"
      : snapshot.sourceDiagnostics.some((entry) => entry.syncStatus === "source_inaccessible")
        ? "source_inaccessible"
        : snapshot.sourceDiagnostics.some((entry) => entry.syncStatus === "parsing_partial")
          ? "parsing_partial"
          : snapshot.sourceDiagnostics.some((entry) => entry.syncStatus === "ocr_required")
            ? "ocr_required"
            : "synced";

  return {
    syncStatus,
    productsParsedCount: snapshot.productCount,
    inventoryRecordsParsedCount: snapshot.inventorySkuCount,
    pricingRecordsParsedCount: snapshot.catalogSkuCount,
    assetRecordsParsedCount: snapshot.catalogExtractedSkuCount,
    sourceDiagnostics: toPersistedSourceStatuses({
      diagnostics: snapshot.sourceDiagnostics,
      lastSuccessfulSyncAt: snapshot.lastSuccessfulSyncAt,
    }),
    attemptedAt: snapshot.lastAttemptedSyncAt || snapshot.lastCheckedAt,
    completedAt: snapshot.lastCheckedAt,
    lastError: snapshot.lastSyncError,
  };
}

function snapshotFromPersisted(input: {
  persisted: Awaited<ReturnType<typeof getSupplierNormalizedSnapshot>>;
  selectedMembershipTier: string | null;
}): RocktomicSourceIngestionSnapshot | null {
  if (!input.persisted) return null;
  const persisted = input.persisted;
  const products: RocktomicSupplierProduct[] = persisted.products.map((product) => {
    const inventory = persisted.inventoryBySku.get(product.sku);
    const pricing = persisted.pricingBySku.get(product.sku);
    const assets = persisted.assetsBySku.get(product.sku);
    const payload = product.rawPayload as unknown as Partial<RocktomicSupplierProduct>;
    const supplementFactsStatus = product.extractionStatus === "ocr_required" ? "ocr_required" : product.supplementFactsText ? "available" : "pending_source";
    const selectedCostFromTier =
      input.selectedMembershipTier && pricing?.costsByMembershipTier
        ? pricing.costsByMembershipTier[input.selectedMembershipTier] ?? null
        : null;
    const pricingRecordFound = Boolean(pricing);
    const inventoryRecordFound = Boolean(inventory);
    const assetRecordFound = Boolean(assets);
    return {
      supplier: "Rocktomic",
      sku: product.sku,
      productName: product.productName,
      category: product.category || "Uncategorized",
      labelSize: product.labelSize,
      containerSize: product.containerSize,
      productWeight: product.productWeight,
      servingSize: product.servingSize,
      servingsPerContainer: product.servingsPerContainer,
      activeIngredients: product.activeIngredients,
      amountPerServing: product.amountPerServing,
      ingredientHighlights: product.ingredientHighlightsSource,
      productFeatures: product.keyProductFeatures,
      otherIngredients: product.otherIngredients,
      allergenDietaryAttributes: product.dietaryAttributes,
      sourceDiagnostics: [
        ...(Array.isArray(payload.sourceDiagnostics) ? (payload.sourceDiagnostics as string[]) : []),
        "normalized_supplier_scope: global",
        "normalized_product_record_status: found",
        `normalized_pricing_record_status: ${pricingRecordFound ? "found" : "missing"}`,
        `normalized_inventory_record_status: ${inventoryRecordFound ? "found" : "missing"}`,
        `normalized_asset_record_status: ${assetRecordFound ? "found" : "missing"}`,
      ],
      coaLinkStatus:
        product.coaExtractionStatus === "extraction_failed"
          ? "extraction_failed"
          : product.coaExtractionStatus === "extracted"
            ? "extracted"
            : "not_present",
      coaLinkError: product.coaExtractionError,
      coa: {
        status: (product.coaStatus as RocktomicSupplierProduct["coa"]["status"]) || "pending_source",
        url: product.coaUrl,
        expiresAt: null,
        testingCategories: [],
        verificationStatus: product.coaUrl ? "pending" : "unavailable",
      },
      labelTemplate: {
        status: assets?.labelTemplateUrl ? "available" : "configured",
        url: assets?.labelTemplateUrl || product.labelTemplateUrl,
      },
      mockup: {
        status: assets?.mockupUrl ? "available" : "pending_source",
        url: assets?.mockupUrl || product.mockupUrl,
      },
      certifications: product.certifications,
      dietaryAttributes: product.dietaryAttributes,
      manufacturingClaims: product.manufacturingClaims,
      supplementFacts: {
        status: supplementFactsStatus,
        value: product.supplementFactsText,
      },
      suggestedUse: {
        status: product.suggestedUse ? "available" : "pending_source",
        value: product.suggestedUse,
      },
      warnings: {
        status: product.warnings ? "available" : "pending_source",
        value: product.warnings,
      },
      inventoryStatus: (inventory?.inventoryStatusNormalized as RocktomicInventoryStatus) || "unknown",
      discontinuedStatus: "unknown",
      pricingStatus: pricing?.detectedMembershipTiers?.length ? "current" : "pending_source",
      policyStatus: "available",
      pricing: {
        wholesaleCost: selectedCostFromTier,
        msrp: pricing?.msrp ?? null,
        estimatedProfit: null,
        marginPercent: null,
        currency: "USD",
        sourceStatus: pricingRecordFound ? "available" : "unknown",
        membershipTier: input.selectedMembershipTier,
        membershipTiersDetected: pricing?.detectedMembershipTiers || [],
        membershipTierCosts: pricing?.costsByMembershipTier || {},
        sourceSheet: pricing?.sourceSheet || null,
        sourceColumn: input.selectedMembershipTier || null,
        lastCheckedAt: product.lastSyncedAt,
        pricingStatusLabel:
          input.selectedMembershipTier &&
          (!pricing?.costsByMembershipTier || pricing.costsByMembershipTier[input.selectedMembershipTier] == null)
            ? "source_unavailable_for_selected_membership_tier"
            : input.selectedMembershipTier
              ? "tier_pricing_mapped"
              : pricingRecordFound
                ? "membership_tier_not_selected"
                : "pricing_record_not_found",
      },
      shipping: payload.shipping || {
        shipsFrom: "US",
        processingTime: "1-3 business days",
        shippingTime: "3-7 business days",
        returnPolicy: "Configured supplier order/refund policy available in internal diagnostics.",
        fulfillmentStatus: "platform_managed",
      },
      lastSyncedAt: product.lastSyncedAt,
      sourceVersion: product.sourceVersion || "rocktomic_normalized",
      sourceUpdatedAt: product.lastSyncedAt,
    };
  });

  const sourceDiagnostics: RocktomicSourceIngestionDiagnostic[] = persisted.sourceStatuses.map((status) => ({
    id: status.sourceId as RocktomicSourceReference["id"],
    label: status.sourceLabel,
    configured: status.configured,
    fetchable: status.fetchable,
    parsed: status.parsed,
    recordCount: status.recordCount,
    syncStatus: status.syncStatus,
    lastCheckedAt: status.lastCheckedAt || new Date().toISOString(),
    lastSuccessfulSyncAt: status.lastSuccessfulSyncAt,
    lastError: status.lastError,
    sourceUrl: status.sourceUrl,
    fetchUrl: status.fetchUrl,
  }));

  const latestRun = persisted.latestRun;
  const lastCheckedAt =
    latestRun?.completedAt ||
    latestRun?.attemptedAt ||
    sourceDiagnostics[0]?.lastCheckedAt ||
    new Date().toISOString();

  return {
    supplier: "Rocktomic",
    products,
    productCount: products.length,
    catalogSkuCount: products.length,
    catalogExtractedSkuCount: products.filter((entry) => entry.coaLinkStatus === "extracted").length,
    inventorySkuCount: persisted.inventoryBySku.size,
    inventoryAvailable: persisted.inventoryBySku.size > 0,
    usedSeedFallback: false,
    membershipTiersDetected: Array.from(
      new Set(
        Array.from(persisted.pricingBySku.values()).flatMap((entry) => entry.detectedMembershipTiers)
      )
    ),
    sourceDiagnostics,
    lastCheckedAt,
    lastSuccessfulSyncAt: sourceDiagnostics.find((entry) => entry.lastSuccessfulSyncAt)?.lastSuccessfulSyncAt || null,
    lastAttemptedSyncAt: latestRun?.attemptedAt || null,
    syncStatus: latestRun?.syncStatus || "never_synced",
    lastSyncError: latestRun?.lastError || null,
    syncRunSummary: latestRun
      ? {
          productsParsedCount: latestRun.productsParsedCount,
          inventoryRecordsParsedCount: latestRun.inventoryRecordsParsedCount,
          pricingRecordsParsedCount: latestRun.pricingRecordsParsedCount,
          assetRecordsParsedCount: latestRun.assetRecordsParsedCount,
        }
      : null,
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
    const contentLength = parseContentLength(response.headers.get("content-length"));
    if (contentLength != null) {
      assertPayloadLimit({
        sizeBytes: contentLength,
        maxBytes: MAX_TEXT_PAYLOAD_BYTES,
        sourceUrl: url,
      });
    }
    const bytes = await response.arrayBuffer();
    assertPayloadLimit({
      sizeBytes: bytes.byteLength,
      maxBytes: MAX_TEXT_PAYLOAD_BYTES,
      sourceUrl: url,
    });
    return new TextDecoder("utf-8").decode(bytes);
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchBinaryWithTimeout(url: string, maxBytes: number): Promise<ArrayBuffer> {
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
    const contentLength = parseContentLength(response.headers.get("content-length"));
    if (contentLength != null) {
      assertPayloadLimit({
        sizeBytes: contentLength,
        maxBytes,
        sourceUrl: url,
      });
    }
    const bytes = await response.arrayBuffer();
    assertPayloadLimit({
      sizeBytes: bytes.byteLength,
      maxBytes,
      sourceUrl: url,
    });
    return bytes;
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
  options?: {
    forceRefresh?: boolean;
    userId?: string | null;
    allowRefresh?: boolean;
    triggerBackgroundRefresh?: boolean;
    includeSeedFallbackProducts?: boolean;
  }
): Promise<RocktomicSourceIngestionSnapshot> {
  const selectedMembershipTier = options?.userId
    ? await getSupplierMembershipTierSelectionForUser(options.userId).catch(() => null)
    : null;
  const selectedMembershipTierKey = selectedMembershipTier
    ? normalizeTierKey(selectedMembershipTier)
    : "";
  const allowRefresh = options?.allowRefresh ?? true;
  const triggerBackgroundRefresh = options?.triggerBackgroundRefresh ?? true;
  const includeSeedFallbackProducts = options?.includeSeedFallbackProducts ?? true;
  const cacheKey = `${selectedMembershipTierKey || "__default__"}::seed:${includeSeedFallbackProducts ? "1" : "0"}`;
  const fallbackUserId = GLOBAL_SUPPLIER_SCOPE_USER_ID;
  const createSnapshotPromise = async (): Promise<RocktomicSourceIngestionSnapshot> => {
    const now = Date.now();
    const config = getRocktomicSourceConfigSnapshot();
    const lastCheckedAt = new Date(now).toISOString();
    const sourceDiagnostics: RocktomicSourceIngestionDiagnostic[] = [];
    const fetchedTextByUrl = new Map<string, Promise<string>>();
    const fetchedBinaryByUrl = new Map<string, Promise<ArrayBuffer>>();

    const catalogRowsBySku = new Map<string, CatalogRow>();
    const inventoryBySku = new Map<string, InventoryRow>();
    const catalogPdfFieldsBySku = new Map<string, CatalogPdfSkuFields>();
    const membershipTiersDetected = new Set<string>();
    let pendingCatalogPdf:
      | {
          referenceId: RocktomicSourceReference["id"];
          pdfBytes: ArrayBuffer;
        }
      | null = null;

    for (const reference of config.references) {
      const diagnostic: RocktomicSourceIngestionDiagnostic = {
        id: reference.id,
        label: reference.label,
        configured: reference.status === "configured" && !!reference.sourceUrl,
        fetchable: false,
        parsed: false,
        recordCount: 0,
        syncStatus: "never_synced",
        lastCheckedAt,
        lastSuccessfulSyncAt: null,
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
          let csvBodyPromise = fetchedTextByUrl.get(csvUrl);
          if (!csvBodyPromise) {
            csvBodyPromise = fetchWithTimeout(csvUrl);
            fetchedTextByUrl.set(csvUrl, csvBodyPromise);
          }
          const csvBody = await csvBodyPromise;
          diagnostic.fetchable = true;

          if (reference.id === "inventory_report") {
            const rows = parseInventoryCsv(csvBody);
            diagnostic.parsed = rows.length > 0;
            diagnostic.recordCount = rows.length;
            if (!rows.length) diagnostic.lastError = "No inventory rows parsed from source CSV.";
            rows.forEach((row) => inventoryBySku.set(row.sku, row));
          } else if (reference.id === "msrp_profit_margins_report" || reference.id === "plds_catalog") {
            const parsedCatalog = parseCatalogCsv(csvBody, {
              selectedMembershipTierKey,
            });
            const rows = parsedCatalog.rows;
            parsedCatalog.membershipTiersDetected.forEach((tier) => membershipTiersDetected.add(tier));
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
          let pdfBytesPromise = fetchedBinaryByUrl.get(reference.sourceUrl);
          if (!pdfBytesPromise) {
            pdfBytesPromise = fetchBinaryWithTimeout(
              reference.sourceUrl,
              resolveBinaryPayloadLimit({
                referenceId: reference.id,
                sourceUrl: reference.sourceUrl,
              })
            );
            fetchedBinaryByUrl.set(reference.sourceUrl, pdfBytesPromise);
          }
          const pdfBytes = await pdfBytesPromise;
          diagnostic.fetchable = true;
          pendingCatalogPdf = {
            referenceId: reference.id,
            pdfBytes,
          };
          diagnostic.parsed = false;
          diagnostic.recordCount = 0;
        } else {
          await checkUrlFetchable(reference.sourceUrl);
          diagnostic.fetchable = true;
          diagnostic.parsed = true;
          diagnostic.recordCount = 0;
        }
      } catch (error) {
        diagnostic.lastError = redactError(error);
      }

      diagnostic.syncStatus = toSourceSyncStatus({
        configured: diagnostic.configured,
        fetchable: diagnostic.fetchable,
        parsed: diagnostic.parsed,
        lastError: diagnostic.lastError,
      });

      sourceDiagnostics.push(diagnostic);
    }

    if (pendingCatalogPdf) {
      const parsed = mapCatalogPdfFieldsBySku({
        pdfBytes: pendingCatalogPdf.pdfBytes,
        catalogRowsBySku,
      });
      parsed.forEach((value, sku) => catalogPdfFieldsBySku.set(sku, value));
      const catalogPdfDiagnostic = sourceDiagnostics.find((entry) => entry.id === pendingCatalogPdf?.referenceId);
      if (catalogPdfDiagnostic) {
        catalogPdfDiagnostic.parsed = parsed.size > 0;
        catalogPdfDiagnostic.recordCount = parsed.size;
        catalogPdfDiagnostic.lastError = parsed.size > 0 ? null : "No deterministic catalog SKU blocks parsed from PDF.";
        const hasOcrRequired = Array.from(parsed.values()).some(
          (entry) => !entry.supplementFactsPanel && entry.extractionStatus !== "failed"
        );
        catalogPdfDiagnostic.syncStatus = toSourceSyncStatus({
          configured: catalogPdfDiagnostic.configured,
          fetchable: catalogPdfDiagnostic.fetchable,
          parsed: catalogPdfDiagnostic.parsed,
          lastError: catalogPdfDiagnostic.lastError,
          extractionStatusHint: hasOcrRequired ? "ocr_required" : null,
        });
      }
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

    const normalizedDiagnostics = sourceDiagnostics.map((diagnostic) => {
      if (diagnostic.lastError) return diagnostic;
      const reference = config.references.find((entry) => entry.id === diagnostic.id);
      if (!reference) return diagnostic;
      const normalizedError = diagnostic.parsed ? null : reference.status === "pending" ? "Source pending." : null;
      return {
        ...diagnostic,
        lastError: normalizedError,
        syncStatus: toSourceSyncStatus({
          configured: reference.status === "configured" && !!reference.sourceUrl,
          fetchable: diagnostic.fetchable,
          parsed: diagnostic.parsed,
          lastError: normalizedError,
        }),
        fetchUrl: diagnostic.fetchUrl,
        sourceUrl: reference.sourceUrl,
        lastCheckedAt,
        configured: reference.status === "configured" && !!reference.sourceUrl,
      };
    });

    const syncStatus = normalizedDiagnostics.some((entry) => entry.syncStatus === "sync_failed")
      ? "sync_failed"
      : normalizedDiagnostics.some((entry) => entry.syncStatus === "source_auth_required")
        ? "source_auth_required"
        : normalizedDiagnostics.some((entry) => entry.syncStatus === "source_inaccessible")
          ? "source_inaccessible"
          : normalizedDiagnostics.some((entry) => entry.syncStatus === "ocr_required")
            ? "ocr_required"
            : normalizedDiagnostics.some((entry) => entry.syncStatus === "parsing_partial")
              ? "parsing_partial"
              : "synced";
    const lastSyncError = normalizedDiagnostics.find((entry) => entry.lastError)?.lastError || null;
    const summary = {
      productsParsedCount: products.length,
      inventoryRecordsParsedCount: inventoryBySku.size,
      pricingRecordsParsedCount: catalogRows.length,
      assetRecordsParsedCount: catalogPdfFieldsBySku.size,
    };

    const snapshot: RocktomicSourceIngestionSnapshot = {
      supplier: "Rocktomic",
      products,
      productCount: products.length,
      catalogSkuCount: catalogRows.length,
      catalogExtractedSkuCount: catalogPdfFieldsBySku.size,
      inventorySkuCount: inventoryBySku.size,
      inventoryAvailable,
      usedSeedFallback: catalogRows.length === 0,
      membershipTiersDetected: Array.from(membershipTiersDetected.values()),
      sourceDiagnostics: normalizedDiagnostics,
      lastCheckedAt,
      lastSuccessfulSyncAt: syncStatus === "synced" || syncStatus === "parsing_partial" || syncStatus === "ocr_required" ? lastCheckedAt : null,
      lastAttemptedSyncAt: lastCheckedAt,
      syncStatus,
      lastSyncError,
      syncRunSummary: summary,
    };

    await persistSupplierNormalizedSnapshot({
      userId: fallbackUserId,
      supplierId: "rocktomic",
      products: toPersistedProducts({ products, lastSyncedAt: lastCheckedAt }),
      inventoryRows: toPersistedInventory({
        products,
        sourceUpdatedAt: sourceUpdatedAt || lastCheckedAt,
        lastSyncedAt: lastCheckedAt,
      }),
      pricingRows: toPersistedPricing({ products, lastSyncedAt: lastCheckedAt }),
      assetRows: toPersistedAssets({ products, lastSyncedAt: lastCheckedAt }),
      sourceStatuses: toPersistedSourceStatuses({
        diagnostics: normalizedDiagnostics,
        lastSuccessfulSyncAt: snapshot.lastSuccessfulSyncAt,
      }),
      run: toSyncSummary(snapshot),
    }).catch(() => undefined);

    cache.set(cacheKey, {
      snapshot,
      expiresAt: now + ROCKTOMIC_INGESTION_TTL_MS,
    });

    return snapshot;
  };

  const now = Date.now();
  const shouldPreferPersistedNormalizedSnapshot =
    !options?.forceRefresh && !allowRefresh && includeSeedFallbackProducts === false;
  if (shouldPreferPersistedNormalizedSnapshot) {
    const persisted = await getSupplierNormalizedSnapshot({
      userId: fallbackUserId,
      supplierId: "rocktomic",
    }).catch(() => null);
    const persistedSnapshot = snapshotFromPersisted({
      persisted,
      selectedMembershipTier,
    });
    if (persistedSnapshot) {
      cache.set(cacheKey, {
        snapshot: persistedSnapshot,
        expiresAt: now + ROCKTOMIC_INGESTION_TTL_MS,
      });
      return withRuntimeSnapshotState(persistedSnapshot, {
        cacheState: "fresh",
        refreshState: "idle",
      });
    }
  }

  const existing = cache.get(cacheKey);
  if (!options?.forceRefresh && existing) {
    if (existing.expiresAt > now) {
      const refreshInFlight = inFlightByCacheKey.has(cacheKey);
      return withRuntimeSnapshotState(existing.snapshot, {
        cacheState: "fresh",
        refreshState: refreshInFlight ? "refreshing" : "idle",
      });
    }

    const staleRefreshInFlight = inFlightByCacheKey.get(cacheKey);
    if (allowRefresh && !staleRefreshInFlight) {
      const backgroundRefresh = createSnapshotPromise();
      inFlightByCacheKey.set(cacheKey, backgroundRefresh);
      backgroundRefresh
        .catch(() => undefined)
        .finally(() => {
          inFlightByCacheKey.delete(cacheKey);
        });
    }

    return withRuntimeSnapshotState(existing.snapshot, {
      cacheState: "stale",
      refreshState: inFlightByCacheKey.has(cacheKey) ? "refreshing" : "idle",
    });
  }

  if (!options?.forceRefresh && !shouldPreferPersistedNormalizedSnapshot) {
    const persisted = await getSupplierNormalizedSnapshot({
      userId: fallbackUserId,
      supplierId: "rocktomic",
    }).catch(() => null);
    const persistedSnapshot = snapshotFromPersisted({
      persisted,
      selectedMembershipTier,
    });
    if (persistedSnapshot) {
      cache.set(cacheKey, {
        snapshot: persistedSnapshot,
        expiresAt: now + ROCKTOMIC_INGESTION_TTL_MS,
      });
      return withRuntimeSnapshotState(persistedSnapshot, {
        cacheState: "fresh",
        refreshState: "idle",
      });
    }
  }

  if (!options?.forceRefresh && !allowRefresh) {
    const refreshInFlight = inFlightByCacheKey.get(cacheKey);
    const shouldStartBackgroundRefresh = triggerBackgroundRefresh && !refreshInFlight;
    if (shouldStartBackgroundRefresh) {
      const backgroundRefresh = createSnapshotPromise();
      inFlightByCacheKey.set(cacheKey, backgroundRefresh);
      backgroundRefresh
        .catch(() => undefined)
        .finally(() => {
          inFlightByCacheKey.delete(cacheKey);
        });
    }
    return buildSeedFallbackSnapshot({
      config: getRocktomicSourceConfigSnapshot(),
      lastCheckedAt: new Date(now).toISOString(),
      selectedMembershipTier,
      refreshScheduled: shouldStartBackgroundRefresh || Boolean(refreshInFlight),
      syncStatus: "never_synced",
      lastAttemptedSyncAt: null,
      lastSuccessfulSyncAt: null,
      lastSyncError: null,
      reason: shouldStartBackgroundRefresh
        ? "Source refresh scheduled in background."
        : "Source refresh deferred for request safety.",
      includeProducts: includeSeedFallbackProducts,
    });
  }

  const inFlight = inFlightByCacheKey.get(cacheKey);
  if (inFlight) {
    const snapshot = await inFlight;
    return withRuntimeSnapshotState(snapshot, {
      cacheState: "fresh",
      refreshState: "refreshing",
    });
  }

  const snapshotPromise = createSnapshotPromise();

  inFlightByCacheKey.set(cacheKey, snapshotPromise);
  try {
    return await snapshotPromise;
  } finally {
    inFlightByCacheKey.delete(cacheKey);
  }
}

export async function runRocktomicSourceSync(input: {
  userId: string;
  triggerKind?: "manual" | "api" | "cli";
}): Promise<RocktomicSourceIngestionSnapshot> {
  const lock = await acquireSupplierSyncLock({
    userId: GLOBAL_SUPPLIER_SCOPE_USER_ID,
    supplierId: "rocktomic",
    ttlMs: 180_000,
  });
  if (!lock.acquired || !lock.token) {
    const existing = await getRocktomicSourceIngestionSnapshot({
      userId: input.userId,
      allowRefresh: false,
      triggerBackgroundRefresh: false,
      includeSeedFallbackProducts: false,
    });
    return {
      ...existing,
      syncStatus: "sync_in_progress",
      lastSyncError: "A supplier source sync is already in progress.",
    };
  }

  try {
    return await getRocktomicSourceIngestionSnapshot({
      userId: null,
      forceRefresh: true,
      allowRefresh: true,
      triggerBackgroundRefresh: false,
      includeSeedFallbackProducts: false,
    });
  } finally {
    await releaseSupplierSyncLock({
      userId: GLOBAL_SUPPLIER_SCOPE_USER_ID,
      supplierId: "rocktomic",
      token: lock.token,
    }).catch(() => undefined);
  }
}

export function clearRocktomicSourceIngestionCache(): void {
  cache = new Map<string, { expiresAt: number; snapshot: RocktomicSourceIngestionSnapshot }>();
  inFlightByCacheKey = new Map<string, Promise<RocktomicSourceIngestionSnapshot>>();
  void clearRocktomicNormalizedStoreForTests().catch(() => undefined);
}
