import {
  normalizeSku,
  type NormalizedSupplierIntelligenceRecord,
  type SupplierFactProvenance,
} from "@/lib/ecomviper/suppliers/rocktomic/supplier-intelligence-schema";

export interface CatalogMarkdownParserOptions {
  markdown: string;
  sourceUrl: string;
  supplierId: string;
  supplierName: string;
  skuFilter?: string[] | null;
  extractedAt?: string;
}

export interface CatalogMarkdownParserResult {
  records: NormalizedSupplierIntelligenceRecord[];
  warnings: string[];
  reason: "ok" | "sku_not_found" | "parser_no_record_boundary" | "source_unavailable";
}

const SKU_PATTERN = /\bROC\s*-?\s*\d{3,5}\b/gi;

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeWhitespace(value: string): string {
  return value
    .replace(/\\n/g, "\n")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanName(raw: string): string {
  return normalizeWhitespace(
    raw
      .replace(/^Name\s*:?\s*/i, "")
      .replace(/^SKU\s*:?\s*/i, "")
      .replace(/^(?:Name|SKU|Label Size|Container Size|Product Weight)\s*:?/gi, "")
      .replace(/\bSKU\s*:?\s*ROC\s*-?\s*\d{3,5}\b.*$/i, "")
      .replace(/[|*]+/g, " ")
      .replace(/\b(?:Label Size|Container Size|Product Weight|Cert\.? of Analysis|Label & 3D Mockup Template)\b[\s\S]*$/i, "")
  );
}

function findValue(window: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = window.match(pattern);
    if (match?.[1]) {
      const value = normalizeWhitespace(match[1]);
      if (value) return value;
    }
  }
  return null;
}

function safeProductName(window: string, sku: string): string | null {
  const rowCell = findValue(window, [
    new RegExp(`\\|\\s*([^|]{0,280}\\b${sku}\\b[^|]{0,280})\\|`, "i"),
  ]);
  if (rowCell) {
    const maybeName = rowCell.match(new RegExp(`^(.*?)\\s+${sku}\\b`, "i"))?.[1] || rowCell;
    const cleaned = cleanName(maybeName);
    if (cleaned && !/^name\\s*:?\\s*sku\\s*:?$/i.test(cleaned)) return cleaned;
  }

  const direct = findValue(window, [
    new RegExp(`Name\\s*:?\\s*([\\s\\S]{0,180}?)\\s+SKU\\s*:?\\s*${sku}\\b`, "i"),
    new RegExp(`\\|\\s*([\\s\\S]{0,180}?)\\s+${sku}\\s+[0-9]`, "i"),
  ]);
  if (direct) {
    const cleaned = cleanName(direct);
    return cleaned || null;
  }

  const skuIndex = window.toUpperCase().indexOf(sku);
  if (skuIndex >= 0) {
    const prefix = window.slice(Math.max(0, skuIndex - 180), skuIndex);
    const candidate = cleanName(prefix);
    if (candidate && candidate.length >= 5) return candidate;
  }

  return null;
}

function rowCellBySku(window: string, sku: string): string | null {
  return findValue(window, [new RegExp(`\\|\\s*([^|]{0,340}\\b${sku}\\b[^|]{0,340})\\|`, "i")]);
}

function createProvenance(input: {
  sourceUrl: string;
  rawSnippet: string;
  extractedAt: string;
  confidence: number;
}): SupplierFactProvenance {
  return {
    sourceType: "catalog_pdf",
    sourceUrl: input.sourceUrl,
    pageNumber: null,
    extractedAt: input.extractedAt,
    extractor: "rocktomic_firecrawl_markdown_parser_v1",
    rawSnippet: input.rawSnippet,
    confidence: input.confidence,
  };
}

function buildSnippet(markdown: string, index: number): string {
  const start = Math.max(0, index - 650);
  const end = Math.min(markdown.length, index + 1100);
  return normalizeWhitespace(markdown.slice(start, end));
}

function extractRecordsFromMarkdown(options: CatalogMarkdownParserOptions): NormalizedSupplierIntelligenceRecord[] {
  const markdown = options.markdown || "";
  const extractedAt = options.extractedAt || nowIso();
  const normalizedFilter = options.skuFilter?.map((sku) => normalizeSku(sku)).filter(Boolean) || null;

  const results = new Map<string, NormalizedSupplierIntelligenceRecord>();
  for (const match of markdown.matchAll(SKU_PATTERN)) {
    if (!match[0]) continue;
    const sku = normalizeSku(match[0]);
    if (!sku) continue;
    if (normalizedFilter && !normalizedFilter.includes(sku)) continue;

    const index = match.index || 0;
    const snippet = buildSnippet(markdown, index);

    const productName = safeProductName(snippet, sku);
    const rowCell = rowCellBySku(snippet, sku);
    const rowDimensions = rowCell?.match(
      new RegExp(`\\b${sku}\\b\\s+([0-9.]+\\s*x\\s*[0-9.]+\\s*in)\\s+([0-9.]+\\s*x\\s*[0-9.]+\\s*in)\\s+([0-9.]+\\s*(?:oz|lb|lbs|g|kg))`, "i")
    );
    const labelSize = rowDimensions?.[1] || findValue(snippet, [
      /Label\s*Size\s*:?\s*([0-9.]+\s*x\s*[0-9.]+\s*(?:in|inch|inches))/i,
    ]);
    const containerSize = rowDimensions?.[2] || findValue(snippet, [
      /Container\s*Size\s*:?\s*([0-9.]+\s*x\s*[0-9.]+\s*(?:in|inch|inches))/i,
    ]);
    const productWeight = rowDimensions?.[3] || findValue(snippet, [
      /Product\s*Weight\s*:?\s*([0-9.]+\s*(?:oz|lb|lbs|g|kg))/i,
    ]);
    const servingSize = findValue(snippet, [
      /Serving\s*Size\s*:?\s*([^|]{1,60})/i,
    ]);

    const servingsPerContainerRaw = findValue(snippet, [
      /Serv(?:ing|ings)\s*(?:Per|per)?\s*Container\s*:?\s*(\d{1,4})/i,
    ]);

    const hasCoaReference = /Cert\.?\s*of\s*Analysis\s*:?\s*Click\s*HERE/i.test(snippet);
    const hasTemplateReference = /Label\s*&\s*3D\s*Mockup\s*Template\s*:?\s*Click\s*HERE/i.test(snippet);

    const provenance = createProvenance({
      sourceUrl: options.sourceUrl,
      rawSnippet: snippet,
      extractedAt,
      confidence: 0.77,
    });

    const missingFields = [
      ...(productName ? [] : ["productName"]),
      ...(labelSize ? [] : ["labelSize"]),
      ...(containerSize ? [] : ["containerSize"]),
      ...(productWeight ? [] : ["productWeight"]),
      ...(servingSize ? [] : ["servingSize"]),
      ...(servingsPerContainerRaw ? [] : ["servingsPerContainer"]),
      "nutrientFacts",
      "activeIngredients",
    ];

    const extractionWarnings = [
      "supplement_facts_incomplete_markdown",
      "catalog_click_here_links_without_embedded_url",
      ...(hasCoaReference ? [] : ["coa_reference_not_detected"]),
      ...(hasTemplateReference ? [] : ["template_reference_not_detected"]),
    ];

    const record: NormalizedSupplierIntelligenceRecord = {
      supplierId: options.supplierId,
      supplierName: options.supplierName,
      sku,
      productName,
      productType: "supplement",
      brand: "Rocktomic",
      labelSize,
      containerSize,
      productWeight,
      servingSize,
      servingsPerContainer: servingsPerContainerRaw ? Number.parseInt(servingsPerContainerRaw, 10) : null,
      nutrientFacts: [],
      activeIngredients: [],
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
        provenance: [provenance],
      },
      inventory: {
        status: null,
        quantityText: null,
        sourceStatus: "missing",
        provenance: [provenance],
      },
      shippingPolicy: { sourceUrl: null, summary: null, provenance: [provenance] },
      returnPolicy: { sourceUrl: null, summary: null, provenance: [provenance] },
      sourceStatus: productName ? "needs_review" : "missing",
      missingFields,
      extractionWarnings,
      confidence: productName ? 0.74 : 0.58,
      provenance: [provenance],
    };

    if (!results.has(sku) || ((results.get(sku)?.productName ? 1 : 0) < (productName ? 1 : 0))) {
      results.set(sku, record);
    }
  }

  return Array.from(results.values()).sort((a, b) => a.sku.localeCompare(b.sku));
}

export function parseRocktomicCatalogMarkdown(options: CatalogMarkdownParserOptions): CatalogMarkdownParserResult {
  const markdown = options.markdown?.trim() || "";
  if (!markdown) {
    return {
      records: [],
      warnings: ["catalog_markdown_empty"],
      reason: "source_unavailable",
    };
  }

  const records = extractRecordsFromMarkdown(options);
  if (records.length > 0) {
    return {
      records,
      warnings: [],
      reason: "ok",
    };
  }

  const filter = options.skuFilter?.map((entry) => normalizeSku(entry)).filter(Boolean) || [];
  if (filter.length > 0 && filter.some((sku) => markdown.toUpperCase().includes(sku))) {
    return {
      records: [],
      warnings: ["catalog_markdown_contains_sku_but_boundary_parse_failed"],
      reason: "parser_no_record_boundary",
    };
  }

  return {
    records: [],
    warnings: [],
    reason: "sku_not_found",
  };
}

export function mergeSupplierRecordsBySku(input: {
  primary: NormalizedSupplierIntelligenceRecord[];
  fallback: NormalizedSupplierIntelligenceRecord[];
}): NormalizedSupplierIntelligenceRecord[] {
  const bySku = new Map<string, NormalizedSupplierIntelligenceRecord>();
  for (const record of input.fallback) bySku.set(record.sku, record);

  for (const record of input.primary) {
    const existing = bySku.get(record.sku);
    if (!existing) {
      bySku.set(record.sku, record);
      continue;
    }

    bySku.set(record.sku, {
      ...existing,
      ...record,
      productName: record.productName || existing.productName,
      labelSize: record.labelSize || existing.labelSize,
      containerSize: record.containerSize || existing.containerSize,
      productWeight: record.productWeight || existing.productWeight,
      servingSize: record.servingSize || existing.servingSize,
      servingsPerContainer: record.servingsPerContainer ?? existing.servingsPerContainer,
      coaUrl: record.coaUrl || existing.coaUrl,
      labelTemplateUrl: record.labelTemplateUrl || existing.labelTemplateUrl,
      mockupUrl: record.mockupUrl || existing.mockupUrl,
      missingFields: Array.from(new Set([...(record.missingFields || []), ...(existing.missingFields || [])])).sort(),
      extractionWarnings: Array.from(
        new Set([...(record.extractionWarnings || []), ...(existing.extractionWarnings || [])])
      ).sort(),
      provenance: [...(record.provenance || []), ...(existing.provenance || [])],
    });
  }

  return Array.from(bySku.values()).sort((a, b) => a.sku.localeCompare(b.sku));
}
