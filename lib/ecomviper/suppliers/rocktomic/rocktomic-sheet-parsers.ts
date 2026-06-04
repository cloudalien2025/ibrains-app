import { lookupRowBySku, parseRfc4180Csv } from "@/lib/ecomviper/suppliers/rocktomic/rocktomic-csv-parser";

export type FieldProvenance = {
  source: string;
  row?: number;
  column?: string;
  url?: string;
};

export interface PldsCatalogRecord {
  sku: string;
  productName: string | null;
  category: string | null;
  labelSize: string | null;
  containerSize: string | null;
  productWeight: string | null;
  membershipAccess: string;
  provenance: Record<string, FieldProvenance>;
  warnings: string[];
  rowIndex: number;
}

export interface MsrpRecord {
  sku: string;
  productName: string | null;
  msrp: number | null;
  wholesaleCost: number | null;
  estimatedProfit: number | null;
  estimatedMarginPct: number | null;
  tiers: Record<string, number | null>;
  provenance: Record<string, FieldProvenance>;
  warnings: string[];
  rowIndex: number;
}

export interface InventoryRecord {
  sku: string;
  productName: string | null;
  inventoryStatus: "in_stock" | "low_stock" | "out_of_stock" | "backordered" | "unknown";
  rawInventoryValue: string | null;
  replenishmentEta: string | null;
  replenishmentComments: string | null;
  provenance: Record<string, FieldProvenance>;
  warnings: string[];
  rowIndex: number;
}

const TIER_COLUMN_PATTERNS: Array<{ pattern: RegExp; tierKey: string }> = [
  { pattern: /T1|Non.?Member/i, tierKey: "t1" },
  { pattern: /T2/i, tierKey: "t2" },
  { pattern: /T3/i, tierKey: "t3" },
  { pattern: /T4|Standard.*VIP|VIP.*Standard/i, tierKey: "t4" },
  { pattern: /T5|VIP.*PLUS|PLUS.*VIP|Premium.*Pricing/i, tierKey: "t5" },
  { pattern: /T6/i, tierKey: "t6" },
  { pattern: /T7|Launch/i, tierKey: "t7" },
];

function parsePrice(raw: string | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[^0-9.]/g, "").trim();
  if (!cleaned) return null;
  const value = Number.parseFloat(cleaned);
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : null;
}

function normalizeSku(raw: string | undefined): string {
  if (!raw) return "";
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "").trim();
}

function detectInventoryStatus(raw: string | null | undefined): InventoryRecord["inventoryStatus"] {
  if (!raw) return "unknown";
  const lower = raw.toLowerCase().trim();
  if (/in.?stock|available|yes/i.test(lower)) return "in_stock";
  if (/low.?stock|limited/i.test(lower)) return "low_stock";
  if (/out.?of.?stock|oos|no/i.test(lower)) return "out_of_stock";
  if (/backorder|back.?order|replenish/i.test(lower)) return "backordered";
  return "unknown";
}

function findColumn(headers: string[], patterns: RegExp[]): string | null {
  // Check patterns in priority order so more-specific patterns win over broad fallbacks
  for (const pattern of patterns) {
    for (const header of headers) {
      if (pattern.test(header)) return header;
    }
  }
  return null;
}

export function parsePldsCatalogCsv(csv: string, sourceUrl: string, sourceId = "plds_catalog_csv"): PldsCatalogRecord[] {
  const { headers, rows } = parseRfc4180Csv(csv);
  if (rows.length === 0) return [];

  const skuCol = findColumn(headers, [/^sku$/i, /^product.?sku$/i, /^item.?sku$/i, /^product.?code$/i]);
  const nameCol = findColumn(headers, [/^product.?name$/i, /^name$/i, /^title$/i, /^description$/i]);
  const categoryCol = findColumn(headers, [/^category$/i, /^type$/i, /^product.?type$/i]);
  const labelSizeCol = findColumn(headers, [/label.?size/i, /label$/i]);
  const containerSizeCol = findColumn(headers, [/container.?size/i, /container$/i, /size$/i]);
  const weightCol = findColumn(headers, [/weight/i, /product.?weight/i]);
  const membershipCol = findColumn(headers, [/membership/i, /access/i, /member.?access/i]);

  const results: PldsCatalogRecord[] = [];

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const rawSku = skuCol ? row[skuCol] : undefined;
    if (!rawSku) continue;
    const sku = normalizeSku(rawSku);
    if (!sku) continue;

    const rowIndex = i + 2; // header=1, data rows start at 2
    const prov = (col: string | null, value: unknown): FieldProvenance | undefined =>
      col && value !== null && value !== undefined && value !== "" ? { source: sourceId, row: rowIndex, column: col, url: sourceUrl } : undefined;

    const productName = nameCol ? (row[nameCol]?.trim() || null) : null;
    const category = categoryCol ? (row[categoryCol]?.trim() || null) : null;
    const labelSize = labelSizeCol ? (row[labelSizeCol]?.trim() || null) : null;
    const containerSize = containerSizeCol ? (row[containerSizeCol]?.trim() || null) : null;
    const productWeight = weightCol ? (row[weightCol]?.trim() || null) : null;
    const rawMembership = membershipCol ? (row[membershipCol]?.trim() || null) : null;
    const membershipAccess = rawMembership ? rawMembership : "unknown";

    const provenance: Record<string, FieldProvenance> = {};
    const nameP = prov(nameCol, productName);
    if (nameP) provenance.productName = nameP;
    const catP = prov(categoryCol, category);
    if (catP) provenance.category = catP;
    const lsP = prov(labelSizeCol, labelSize);
    if (lsP) provenance["labelSize"] = lsP;
    const csP = prov(containerSizeCol, containerSize);
    if (csP) provenance["containerSize"] = csP;
    const wpP = prov(weightCol, productWeight);
    if (wpP) provenance["productWeight"] = wpP;
    if (rawMembership && membershipCol) provenance["membershipAccess"] = { source: sourceId, row: rowIndex, column: membershipCol, url: sourceUrl };

    results.push({ sku, productName, category, labelSize, containerSize, productWeight, membershipAccess, provenance, warnings: [], rowIndex });
  }

  return results;
}

export function parseMsrpReportCsv(csv: string, sourceUrl: string, sourceId = "msrp_report_csv"): MsrpRecord[] {
  const { headers, rows } = parseRfc4180Csv(csv);
  if (rows.length === 0) return [];

  const skuCol = findColumn(headers, [/^sku$/i, /^product.?sku$/i, /^item.?sku$/i]);
  const nameCol = findColumn(headers, [/^product.?name$/i, /^name$/i, /^title$/i]);
  const msrpCol = findColumn(headers, [/^msrp$/i, /retail/i, /suggested.?retail/i]);
  const wholesaleCol = findColumn(headers, [/wholesale/i, /cost$/i, /^cost/i]);
  const profitCol = findColumn(headers, [/^profit$/i, /estimated.?profit/i, /gross.?profit/i]);
  const marginCol = findColumn(headers, [/margin/i, /margin.?%/i, /%.*margin/i]);

  const tierColMap: Record<string, string> = {};
  for (const header of headers) {
    for (const { pattern, tierKey } of TIER_COLUMN_PATTERNS) {
      if (pattern.test(header)) {
        tierColMap[tierKey] = header;
        break;
      }
    }
  }

  const results: MsrpRecord[] = [];

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const rawSku = skuCol ? row[skuCol] : undefined;
    if (!rawSku) continue;
    const sku = normalizeSku(rawSku);
    if (!sku) continue;

    const rowIndex = i + 2;
    const productName = nameCol ? (row[nameCol]?.trim() || null) : null;
    const msrp = msrpCol ? parsePrice(row[msrpCol]) : null;
    const wholesaleCost = wholesaleCol ? parsePrice(row[wholesaleCol]) : null;
    const estimatedProfit = profitCol ? parsePrice(row[profitCol]) : null;
    const estimatedMarginPct = marginCol ? parsePrice(row[marginCol]) : null;

    const tiers: Record<string, number | null> = {};
    for (const [tierKey, col] of Object.entries(tierColMap)) {
      tiers[tierKey] = parsePrice(row[col]);
    }

    const provenance: Record<string, FieldProvenance> = {};
    if (productName && nameCol) provenance.productName = { source: sourceId, row: rowIndex, column: nameCol, url: sourceUrl };
    if (msrp !== null && msrpCol) provenance["pricing.msrp"] = { source: sourceId, row: rowIndex, column: msrpCol, url: sourceUrl };
    if (wholesaleCost !== null && wholesaleCol) provenance["pricing.wholesaleCost"] = { source: sourceId, row: rowIndex, column: wholesaleCol, url: sourceUrl };
    if (estimatedProfit !== null && profitCol) provenance["pricing.estimatedProfit"] = { source: sourceId, row: rowIndex, column: profitCol, url: sourceUrl };
    if (estimatedMarginPct !== null && marginCol) provenance["pricing.estimatedMarginPct"] = { source: sourceId, row: rowIndex, column: marginCol, url: sourceUrl };
    for (const [tierKey, col] of Object.entries(tierColMap)) {
      if (tiers[tierKey] !== null) provenance[`pricing.tiers.${tierKey}`] = { source: sourceId, row: rowIndex, column: col, url: sourceUrl };
    }

    results.push({ sku, productName, msrp, wholesaleCost, estimatedProfit, estimatedMarginPct, tiers, provenance, warnings: [], rowIndex });
  }

  return results;
}

export function parseInventoryReportCsv(csv: string, sourceUrl: string, sourceId = "inventory_report_csv"): InventoryRecord[] {
  const { headers, rows } = parseRfc4180Csv(csv);
  if (rows.length === 0) return [];

  const skuCol = findColumn(headers, [/^sku$/i, /^product.?sku$/i, /^item.?sku$/i]);
  const nameCol = findColumn(headers, [/^product.?name$/i, /^name$/i]);
  const statusCol = findColumn(headers, [/^status$/i, /inventory.?status/i, /stock.?status/i, /in.?stock/i]);
  const rawValueCol = findColumn(headers, [/^quantity$/i, /^qty$/i, /inventory$/i, /^stock$/i]);
  const etaCol = findColumn(headers, [/eta$/i, /replenish.?date/i, /restock.?date/i, /expected.?date/i]);
  const commentsCol = findColumn(headers, [/comment/i, /note/i, /remarks/i]);

  const results: InventoryRecord[] = [];

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const rawSku = skuCol ? row[skuCol] : undefined;
    if (!rawSku) continue;
    const sku = normalizeSku(rawSku);
    if (!sku) continue;

    const rowIndex = i + 2;
    const productName = nameCol ? (row[nameCol]?.trim() || null) : null;
    const rawStatus = statusCol ? (row[statusCol]?.trim() || null) : null;
    const rawInventoryValue = rawValueCol ? (row[rawValueCol]?.trim() || null) : rawStatus;
    const inventoryStatus = detectInventoryStatus(rawStatus || rawInventoryValue);
    const replenishmentEta = etaCol ? (row[etaCol]?.trim() || null) : null;
    const replenishmentComments = commentsCol ? (row[commentsCol]?.trim() || null) : null;

    const provenance: Record<string, FieldProvenance> = {};
    if (productName && nameCol) provenance.productName = { source: sourceId, row: rowIndex, column: nameCol, url: sourceUrl };
    if (rawStatus && statusCol) provenance["inventory.status"] = { source: sourceId, row: rowIndex, column: statusCol, url: sourceUrl };
    if (rawInventoryValue && rawValueCol) provenance["inventory.rawValue"] = { source: sourceId, row: rowIndex, column: rawValueCol, url: sourceUrl };
    if (replenishmentEta && etaCol) provenance["inventory.replenishmentEta"] = { source: sourceId, row: rowIndex, column: etaCol, url: sourceUrl };
    if (replenishmentComments && commentsCol) provenance["inventory.replenishmentComments"] = { source: sourceId, row: rowIndex, column: commentsCol, url: sourceUrl };

    results.push({ sku, productName, inventoryStatus, rawInventoryValue, replenishmentEta, replenishmentComments, provenance, warnings: [], rowIndex });
  }

  return results;
}

export function indexBySku<T extends { sku: string }>(records: T[]): Map<string, T> {
  const map = new Map<string, T>();
  for (const record of records) {
    map.set(normalizeSku(record.sku), record);
  }
  return map;
}

export { lookupRowBySku };
