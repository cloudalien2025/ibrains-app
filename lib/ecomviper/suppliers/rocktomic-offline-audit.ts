import fs from "node:fs/promises";

export type RocktomicSourceType = "pdf" | "html" | "docx" | "google_sheet";

export interface RocktomicSourceRegistryEntry {
  id:
    | "catalog_pdf"
    | "label_mockup_templates"
    | "order_refund_policy"
    | "msrp_profit_margins_report"
    | "plds_catalog"
    | "inventory_report";
  name: string;
  url: string;
  type: RocktomicSourceType;
  notes: string;
}

export interface RocktomicSourceRegistry {
  supplier: string;
  version: number;
  generatedBy?: string;
  sources: RocktomicSourceRegistryEntry[];
}

export interface SourceFactRecord {
  sku: string;
  productName: string | null;
  category: string | null;
  supplementFactsText: string | null;
  sourceReferences: string[];
  missingFields: string[];
}

export interface PricingRecord {
  sku: string;
  productName: string | null;
  wholesaleCost: number | null;
  msrp: number | null;
  estimatedProfit: number | null;
  membershipTierCosts: Record<string, number>;
  sourceReferences: string[];
  missingFields: string[];
}

export interface InventoryRecord {
  sku: string;
  rawInventoryValue: string | null;
  inventoryStatus: "in_stock" | "low_stock" | "out_of_stock" | "unknown" | "missing";
  sourceReferences: string[];
  missingFields: string[];
}

export interface AssetsRecord {
  sku: string;
  coaUrl: string | null;
  labelTemplateUrl: string | null;
  mockupUrl: string | null;
  sourceReferences: string[];
  missingFields: string[];
}

export interface AuditRow {
  sku: string;
  productName: string;
  hasProductName: boolean;
  hasCategory: boolean;
  hasSupplementFacts: boolean;
  hasPricing: boolean;
  hasInventory: boolean;
  hasCoa: boolean;
  hasLabelTemplate: boolean;
  hasMockup: boolean;
  missingFieldCount: number;
  missingFields: string[];
  sourceNotes: string[];
}

export interface ValidationReport {
  generatedAt: string;
  totalSkusDiscovered: number;
  recordsWritten: {
    sourceFacts: number;
    pricing: number;
    inventory: number;
    assets: number;
    audit: number;
  };
  coverageCounts: Record<string, number>;
  missingFieldCounts: Record<string, number>;
  skuLevelDefects: Array<{
    sku: string;
    missingFields: string[];
    sourceNotes: string[];
  }>;
  sourceErrors: Array<{
    sourceId: string;
    error: string;
  }>;
}

export function normalizeRocktomicSku(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

export async function loadSourceRegistry(path: string): Promise<RocktomicSourceRegistry> {
  const content = await fs.readFile(path, "utf8");
  const parsed = JSON.parse(content) as RocktomicSourceRegistry;
  if (!Array.isArray(parsed.sources) || parsed.sources.length === 0) {
    throw new Error("Invalid source registry: no sources.");
  }
  return parsed;
}

export function parseGoogleSheetGid(url: URL): string {
  const queryGid = url.searchParams.get("gid");
  if (queryGid?.trim()) return queryGid.trim();
  const hashMatch = url.hash.match(/gid=([0-9]+)/i);
  if (hashMatch?.[1]) return hashMatch[1];
  return "0";
}

export function toGoogleSheetCsvUrl(sheetUrl: string): string | null {
  try {
    const parsed = new URL(sheetUrl);
    const idMatch = parsed.pathname.match(/\/spreadsheets\/d\/([^/]+)/i);
    if (!idMatch?.[1]) return null;
    const gid = parseGoogleSheetGid(parsed);
    return `https://docs.google.com/spreadsheets/d/${idMatch[1]}/export?format=csv&gid=${encodeURIComponent(gid)}`;
  } catch {
    return null;
  }
}

function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    const next = input[i + 1];
    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (!inQuotes && char === ",") {
      row.push(cell);
      cell = "";
      continue;
    }
    if (!inQuotes && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += char;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

function parseMoney(value: string): number | null {
  const cleaned = value.replace(/[^0-9.\-]/g, "").trim();
  if (!cleaned) return null;
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function detectHeaderRow(rows: string[][], required: string[]): number {
  for (let i = 0; i < rows.length; i += 1) {
    const headers = rows[i].map((cell) => normalizeHeader(cell));
    const ok = required.every((needle) => headers.some((header) => header.includes(needle)));
    if (ok) return i;
  }
  return -1;
}

function detectMembershipColumns(headers: string[]): number[] {
  return headers
    .map((header, index) => ({ header: normalizeHeader(header), index }))
    .filter(({ header }) =>
      header.includes("member") ||
      header.includes("tier") ||
      /(^|[^a-z0-9])t[0-9]+/.test(header)
    )
    .filter(({ header }) => !header.includes("msrp") && !header.includes("estimatedprofit"))
    .map(({ index }) => index);
}

export function parsePricingCsv(csvBody: string): PricingRecord[] {
  const rows = parseCsv(csvBody);
  const headerIndex = detectHeaderRow(rows, ["sku"]);
  if (headerIndex < 0) return [];
  const headers = rows[headerIndex] ?? [];
  const normalized = headers.map((header) => normalizeHeader(header));
  const skuIndex = normalized.findIndex((value) => value.includes("sku"));
  const productIndex = normalized.findIndex((value) => value.includes("product") || value.includes("name"));
  const wholesaleIndex = normalized.findIndex((value) => value.includes("costperunit") || value.includes("wholesale"));
  const msrpIndex = normalized.findIndex((value) => value.includes("msrp"));
  const profitIndex = normalized.findIndex((value) => value.includes("estimatedprofit"));
  const membershipColumns = detectMembershipColumns(headers);

  const records: PricingRecord[] = [];
  for (const row of rows.slice(headerIndex + 1)) {
    const sku = normalizeRocktomicSku(row[skuIndex] || "");
    if (!sku) continue;
    const membershipTierCosts: Record<string, number> = {};
    for (const index of membershipColumns) {
      const amount = parseMoney(row[index] || "");
      if (amount == null) continue;
      const label = (headers[index] || `tier_${index}`).trim();
      membershipTierCosts[label] = amount;
    }
    const wholesaleCost = parseMoney(row[wholesaleIndex] || "") ?? Object.values(membershipTierCosts)[0] ?? null;
    const record: PricingRecord = {
      sku,
      productName: (row[productIndex] || "").trim() || null,
      wholesaleCost,
      msrp: parseMoney(row[msrpIndex] || ""),
      estimatedProfit: parseMoney(row[profitIndex] || ""),
      membershipTierCosts,
      sourceReferences: ["msrp_profit_margins_report", "plds_catalog"],
      missingFields: [],
    };
    record.missingFields = [
      record.productName ? null : "productName",
      record.wholesaleCost != null ? null : "wholesaleCost",
      record.msrp != null ? null : "msrp",
      record.estimatedProfit != null ? null : "estimatedProfit",
      Object.keys(record.membershipTierCosts).length > 0 ? null : "membershipTierCosts",
    ].filter((value): value is string => Boolean(value));
    records.push(record);
  }
  return records.sort((left, right) => left.sku.localeCompare(right.sku));
}

export function normalizeInventoryStatus(raw: string | null): InventoryRecord["inventoryStatus"] {
  const normalized = (raw || "").toLowerCase();
  if (!normalized) return "missing";
  if (normalized.includes("low")) return "low_stock";
  if (normalized.includes("out")) return "out_of_stock";
  if (normalized.includes("in stock") || normalized.includes("available") || normalized.includes("instock")) {
    return "in_stock";
  }
  return "unknown";
}

export function parseInventoryCsv(csvBody: string): InventoryRecord[] {
  const rows = parseCsv(csvBody);
  const headerIndex = detectHeaderRow(rows, ["sku"]);
  if (headerIndex < 0) return [];
  const headers = rows[headerIndex] ?? [];
  const normalized = headers.map((header) => normalizeHeader(header));
  const skuIndex = normalized.findIndex((value) => value.includes("sku"));
  const statusIndex = normalized.findIndex((value) => value.includes("status") || value.includes("inventory"));
  const quantityIndex = normalized.findIndex((value) => value.includes("qty") || value.includes("quantity"));

  const records: InventoryRecord[] = [];
  for (const row of rows.slice(headerIndex + 1)) {
    const sku = normalizeRocktomicSku(row[skuIndex] || "");
    if (!sku) continue;
    const rawStatus = (row[statusIndex] || "").trim();
    const rawQty = (row[quantityIndex] || "").trim();
    const rawValue = rawStatus || rawQty || null;
    const inventoryStatus = normalizeInventoryStatus(rawStatus || rawQty || null);
    const record: InventoryRecord = {
      sku,
      rawInventoryValue: rawValue,
      inventoryStatus,
      sourceReferences: ["inventory_report"],
      missingFields: [],
    };
    record.missingFields = [
      rawValue ? null : "rawInventoryValue",
      inventoryStatus !== "missing" ? null : "inventoryStatus",
    ].filter((value): value is string => Boolean(value));
    records.push(record);
  }
  return records.sort((left, right) => left.sku.localeCompare(right.sku));
}

export function extractCatalogPdfSignals(bytes: ArrayBuffer): {
  skus: string[];
  coaBySku: Record<string, string>;
  supplementFactsBySku: Record<string, string>;
} {
  const content = Buffer.from(bytes).toString("latin1");
  const skuMatches = content.match(/\bROC[\s\-]?\d{3,5}\b/g) || [];
  const skus = Array.from(
    new Set(
      skuMatches.map((sku) => normalizeRocktomicSku(sku)).filter(Boolean)
    )
  ).sort((left, right) => left.localeCompare(right));

  const coaBySku: Record<string, string> = {};
  const uriPattern = /\/URI\s*\((https?:\/\/[^)\s]+)\)/g;
  let uriMatch: RegExpExecArray | null = null;
  while ((uriMatch = uriPattern.exec(content)) !== null) {
    const url = uriMatch[1];
    const windowStart = Math.max(0, uriMatch.index - 500);
    const windowEnd = Math.min(content.length, uriMatch.index + 500);
    const windowContent = content.slice(windowStart, windowEnd);
    const localSkuMatch = windowContent.match(/\bROC[\s\-]?\d{3,5}\b/i);
    if (!localSkuMatch) continue;
    const sku = normalizeRocktomicSku(localSkuMatch[0]);
    if (!sku) continue;
    if (!coaBySku[sku] && /coa/i.test(url)) {
      coaBySku[sku] = url;
    }
  }

  const supplementFactsBySku: Record<string, string> = {};
  for (const sku of skus) {
    const skuIndex = content.indexOf(sku);
    if (skuIndex < 0) continue;
    const windowContent = content.slice(Math.max(0, skuIndex - 1200), Math.min(content.length, skuIndex + 2400));
    const factsMatch = windowContent.match(/Supplement Facts[:\s]+([^.\n\r]{8,400})/i);
    if (!factsMatch?.[1]) continue;
    supplementFactsBySku[sku] = factsMatch[1].replace(/\s+/g, " ").trim();
  }

  return { skus, coaBySku, supplementFactsBySku };
}

export function extractTemplateLinks(html: string): {
  labelTemplateBySku: Record<string, string>;
  mockupBySku: Record<string, string>;
} {
  const labelTemplateBySku: Record<string, string> = {};
  const mockupBySku: Record<string, string> = {};
  const hrefPattern = /href\s*=\s*"([^"]+)"/gi;
  let match: RegExpExecArray | null = null;
  while ((match = hrefPattern.exec(html)) !== null) {
    const href = match[1];
    const skuMatch = href.match(/\bROC[\s\-]?\d{3,5}\b/i);
    if (!skuMatch) continue;
    const sku = normalizeRocktomicSku(skuMatch[0]);
    if (!sku) continue;
    if (/mockup|3d/i.test(href) && !mockupBySku[sku]) {
      mockupBySku[sku] = href;
      continue;
    }
    if (/label|template/i.test(href) && !labelTemplateBySku[sku]) {
      labelTemplateBySku[sku] = href;
    }
  }
  return { labelTemplateBySku, mockupBySku };
}

export function buildAuditRows(input: {
  sourceFactsBySku: Record<string, SourceFactRecord>;
  pricingBySku: Record<string, PricingRecord>;
  inventoryBySku: Record<string, InventoryRecord>;
  assetsBySku: Record<string, AssetsRecord>;
  sourceErrors: Array<{ sourceId: string; error: string }>;
}): AuditRow[] {
  const allSkus = Array.from(
    new Set([
      ...Object.keys(input.sourceFactsBySku),
      ...Object.keys(input.pricingBySku),
      ...Object.keys(input.inventoryBySku),
      ...Object.keys(input.assetsBySku),
    ])
  ).sort((left, right) => left.localeCompare(right));

  return allSkus.map((sku) => {
    const facts = input.sourceFactsBySku[sku];
    const pricing = input.pricingBySku[sku];
    const inventory = input.inventoryBySku[sku];
    const assets = input.assetsBySku[sku];
    const missingFields = [
      ...(facts?.missingFields ?? ["productName", "category", "supplementFactsText"]),
      ...(pricing?.missingFields ?? ["wholesaleCost", "msrp", "estimatedProfit", "membershipTierCosts"]),
      ...(inventory?.missingFields ?? ["rawInventoryValue", "inventoryStatus"]),
      ...(assets?.missingFields ?? ["coaUrl", "labelTemplateUrl", "mockupUrl"]),
    ];
    const uniqueMissing = Array.from(new Set(missingFields)).sort((left, right) => left.localeCompare(right));
    return {
      sku,
      productName: facts?.productName || pricing?.productName || "",
      hasProductName: Boolean(facts?.productName || pricing?.productName),
      hasCategory: Boolean(facts?.category),
      hasSupplementFacts: Boolean(facts?.supplementFactsText),
      hasPricing: Boolean(pricing && pricing.wholesaleCost != null),
      hasInventory: Boolean(inventory && inventory.rawInventoryValue),
      hasCoa: Boolean(assets?.coaUrl),
      hasLabelTemplate: Boolean(assets?.labelTemplateUrl),
      hasMockup: Boolean(assets?.mockupUrl),
      missingFieldCount: uniqueMissing.length,
      missingFields: uniqueMissing,
      sourceNotes: input.sourceErrors.map((entry) => `${entry.sourceId}: ${entry.error}`),
    } satisfies AuditRow;
  });
}

function csvEscape(value: string): string {
  if (value.includes('"') || value.includes(",") || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function toAuditCsv(rows: AuditRow[]): string {
  const header = [
    "sku",
    "productName",
    "hasProductName",
    "hasCategory",
    "hasSupplementFacts",
    "hasPricing",
    "hasInventory",
    "hasCoa",
    "hasLabelTemplate",
    "hasMockup",
    "missingFieldCount",
    "missingFields",
    "sourceNotes",
  ];

  const lines = [header.join(",")];
  for (const row of rows) {
    lines.push(
      [
        row.sku,
        row.productName,
        String(row.hasProductName),
        String(row.hasCategory),
        String(row.hasSupplementFacts),
        String(row.hasPricing),
        String(row.hasInventory),
        String(row.hasCoa),
        String(row.hasLabelTemplate),
        String(row.hasMockup),
        String(row.missingFieldCount),
        row.missingFields.join("|"),
        row.sourceNotes.join("|"),
      ]
        .map((value) => csvEscape(value))
        .join(",")
    );
  }
  return lines.join("\n");
}

export function buildValidationReport(input: {
  generatedAt: string;
  sourceFacts: SourceFactRecord[];
  pricing: PricingRecord[];
  inventory: InventoryRecord[];
  assets: AssetsRecord[];
  auditRows: AuditRow[];
  sourceErrors: Array<{ sourceId: string; error: string }>;
}): ValidationReport {
  const coverageCounts: Record<string, number> = {
    productName: 0,
    category: 0,
    supplementFactsText: 0,
    wholesaleCost: 0,
    msrp: 0,
    estimatedProfit: 0,
    inventoryStatus: 0,
    rawInventoryValue: 0,
    coaUrl: 0,
    labelTemplateUrl: 0,
    mockupUrl: 0,
  };
  const missingFieldCounts: Record<string, number> = {};

  for (const facts of input.sourceFacts) {
    if (facts.productName) coverageCounts.productName += 1;
    if (facts.category) coverageCounts.category += 1;
    if (facts.supplementFactsText) coverageCounts.supplementFactsText += 1;
  }
  for (const entry of input.pricing) {
    if (entry.wholesaleCost != null) coverageCounts.wholesaleCost += 1;
    if (entry.msrp != null) coverageCounts.msrp += 1;
    if (entry.estimatedProfit != null) coverageCounts.estimatedProfit += 1;
  }
  for (const entry of input.inventory) {
    if (entry.rawInventoryValue) coverageCounts.rawInventoryValue += 1;
    if (entry.inventoryStatus !== "missing") coverageCounts.inventoryStatus += 1;
  }
  for (const entry of input.assets) {
    if (entry.coaUrl) coverageCounts.coaUrl += 1;
    if (entry.labelTemplateUrl) coverageCounts.labelTemplateUrl += 1;
    if (entry.mockupUrl) coverageCounts.mockupUrl += 1;
  }
  for (const row of input.auditRows) {
    for (const field of row.missingFields) {
      missingFieldCounts[field] = (missingFieldCounts[field] || 0) + 1;
    }
  }

  return {
    generatedAt: input.generatedAt,
    totalSkusDiscovered: input.auditRows.length,
    recordsWritten: {
      sourceFacts: input.sourceFacts.length,
      pricing: input.pricing.length,
      inventory: input.inventory.length,
      assets: input.assets.length,
      audit: input.auditRows.length,
    },
    coverageCounts,
    missingFieldCounts,
    skuLevelDefects: input.auditRows
      .filter((row) => row.missingFieldCount > 0)
      .map((row) => ({
        sku: row.sku,
        missingFields: row.missingFields,
        sourceNotes: row.sourceNotes,
      })),
    sourceErrors: input.sourceErrors,
  };
}
