/**
 * Deterministic Rocktomic inventory CSV parser for FileIQ.
 *
 * Parses the Rocktomic supplier inventory CSV format without invoking
 * the Claude Agent SDK. Detects category section headers, normalizes
 * inventory status and access level, and emits a product_catalog v1.1
 * payload for direct storage.
 *
 * Pure and side-effect-free; safe to call from worker or test contexts.
 */

export type DeterministicInventoryStatus =
  | "in_stock"
  | "low_stock"
  | "out_of_stock"
  | "rd_in_progress"
  | "discontinued"
  | "preorder";

export interface RocktomicParserResult {
  payload: Record<string, unknown>;
  /** High when ≥1 product was found with a valid SKU. Low otherwise. */
  confidence: "high" | "low";
  parseNotes: string[];
  productCount: number;
}

const STATUS_MAP: Record<string, DeterministicInventoryStatus> = {
  "in stock": "in_stock",
  "in-stock": "in_stock",
  "low stock": "low_stock",
  "low-stock": "low_stock",
  "out of stock": "out_of_stock",
  "out-of-stock": "out_of_stock",
  "r&d in progress": "rd_in_progress",
  "r&d": "rd_in_progress",
  "rd in progress": "rd_in_progress",
  discontinued: "discontinued",
  preorder: "preorder",
  "pre-order": "preorder",
};

const ACCESS_LEVEL_MAP: Record<string, string | null> = {
  "all memberships": "all_memberships",
  "all membership": "all_memberships",
  all: "all_memberships",
  "scale plan only": "scale_plan",
  "scale plan": "scale_plan",
  scale: "scale_plan",
  "product investment club": "product_investment_club",
  pic: "product_investment_club",
  "": null,
};

function normalizeStatus(raw: string): DeterministicInventoryStatus {
  const key = raw.trim().toLowerCase();
  return STATUS_MAP[key] ?? "out_of_stock";
}

function normalizeAccessLevel(raw: string): string | null {
  const key = raw.trim().toLowerCase();
  if (key in ACCESS_LEVEL_MAP) return ACCESS_LEVEL_MAP[key];
  return raw.trim() || null;
}

/**
 * Minimal CSV line splitter that handles double-quoted fields and escaped
 * double quotes. Trims each field.
 */
function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        field += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      fields.push(field.trim());
      field = "";
    } else {
      field += ch;
    }
  }
  fields.push(field.trim());
  return fields;
}

function parseCurrency(raw: string): number | null {
  const cleaned = raw.replace(/[$,\s]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function isCategoryHeaderRow(cols: string[], skuColIdx: number): boolean {
  const skuVal = skuColIdx >= 0 ? (cols[skuColIdx] ?? "").trim() : "";
  // Category header: no SKU and ≤2 non-empty columns
  if (skuVal !== "") return false;
  const nonEmpty = cols.filter((c) => c.trim() !== "").length;
  return nonEmpty > 0 && nonEmpty <= 2;
}

function buildEmptyProductCatalog(
  notes: string,
  reportDate?: string,
): Record<string, unknown> {
  return {
    schemaType: "product_catalog",
    schemaVersion: "1.1",
    supplier: {
      supplierId: "rocktomic",
      name: "Rocktomic Labs LLC",
      supplierName: "Rocktomic Labs LLC",
      website: null,
      contactEmail: null,
      contactPhone: null,
    },
    products: [],
    totalProductsFound: 0,
    sourcesProcessed: 0,
    extractionNotes: notes,
    _meta: {
      parseMode: "deterministic_structured",
      reportDate: reportDate ?? null,
    },
  };
}

/**
 * Parse a Rocktomic inventory CSV file.
 *
 * @param content  Raw CSV text content of the inventory file.
 * @param reportDate  Optional ISO date string representing the report date
 *                   (e.g. extracted from the file name or a header row);
 *                   mapped to `inventory.lastUpdated` on each product.
 */
export function parseRocktomicInventoryCsv(
  content: string,
  reportDate?: string,
): RocktomicParserResult {
  const parseNotes: string[] = [];
  const lines = content
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0);

  if (lines.length === 0) {
    return {
      payload: buildEmptyProductCatalog("Empty CSV file", reportDate),
      confidence: "low",
      parseNotes: ["Empty CSV — no lines found"],
      productCount: 0,
    };
  }

  // Detect header row within the first 100 non-empty lines.
  // hasSku: column value is exactly a SKU header label (guards against "Total SKUs: 154").
  // matchCount: number of columns that contain a recognizable label keyword.
  // A row is a header if hasSku is true OR ≥2 columns match distinct label keywords.
  // "sku" is intentionally excluded from HEADER_TRIGGERS so that cells like
  // "Total SKUs: 154" don't inflate matchCount alongside another trigger.
  const HEADER_TRIGGERS = [
    "item", "product", "name",
    "status", "availability", "stock",
    "access", "membership",
    "comment", "eta",
  ] as const;

  let headerIdx = -1;
  let headers: string[] = [];
  for (let i = 0; i < Math.min(100, lines.length); i++) {
    const cols = splitCsvLine(lines[i]).map((c) => c.toLowerCase().trim());
    // Match "sku", "sku#", "sku #", "item sku", "product sku" but not "total skus: 154"
    const hasSku = cols.some(
      (c) => /^sku[\s#]*$/.test(c) || c === "item sku" || c === "product sku",
    );
    const matchCount = cols.filter(
      (c) => HEADER_TRIGGERS.some((t) => c.includes(t)),
    ).length;
    if (hasSku || matchCount >= 2) {
      headerIdx = i;
      headers = splitCsvLine(lines[i]).map((c) => c.trim().toLowerCase());
      break;
    }
  }

  if (headerIdx === -1) {
    parseNotes.push("No header row detected in first 100 lines");
    return {
      payload: buildEmptyProductCatalog("No header row detected", reportDate),
      confidence: "low",
      parseNotes,
      productCount: 0,
    };
  }

  // Map column names to indices
  function findCol(...candidates: string[]): number {
    for (const c of candidates) {
      const idx = headers.findIndex((h) => h.includes(c));
      if (idx !== -1) return idx;
    }
    return -1;
  }

  const colIdx = {
    sku: findCol("sku", "item #", "item#", "item no", "part"),
    productName: findCol("product name", "item name", "product", "item", "name", "description", "title"),
    // "inventory status", "stock status" → matched via "status"; "availability" explicit
    status: findCol("inventory status", "stock status", "status", "availability", "stock"),
    // "plan access" → matched via "access"; "membership" explicit
    accessLevel: findCol("access level", "plan access", "access", "membership", "tier", "level"),
    msrp: findCol("msrp", "retail", "price"),
    // "additional comments" → matched via "comment"; "eta" and "comments" explicit
    comments: findCol("additional comments", "comments/eta", "comments", "comment", "eta", "note", "remarks"),
    category: findCol("category", "type", "group"),
  };

  if (colIdx.sku === -1 && colIdx.productName === -1) {
    parseNotes.push("Could not identify SKU or product name column");
    return {
      payload: buildEmptyProductCatalog("Could not identify required columns", reportDate),
      confidence: "low",
      parseNotes,
      productCount: 0,
    };
  }

  const products: Record<string, unknown>[] = [];
  let currentCategory: string | null = null;

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);

    const rawSku = (colIdx.sku >= 0 ? cols[colIdx.sku] : "") ?? "";
    const rawName = (colIdx.productName >= 0 ? cols[colIdx.productName] : "") ?? "";

    // Detect category header rows
    if (isCategoryHeaderRow(cols, colIdx.sku)) {
      // First non-empty col value is the category
      currentCategory = cols.find((c) => c.trim() !== "") ?? null;
      continue;
    }

    // Skip rows missing both SKU and product name
    if (!rawSku.trim() && !rawName.trim()) continue;

    // If name looks like a category header (no SKU, name is all-caps or bold marker)
    if (!rawSku.trim() && rawName.trim()) {
      // Treat as category divider
      currentCategory = rawName.trim();
      continue;
    }

    const rawStatus = (colIdx.status >= 0 ? cols[colIdx.status] : "") ?? "";
    const rawAccess = (colIdx.accessLevel >= 0 ? cols[colIdx.accessLevel] : "") ?? "";
    const rawMsrp = (colIdx.msrp >= 0 ? cols[colIdx.msrp] : "") ?? "";
    const rawComments = (colIdx.comments >= 0 ? cols[colIdx.comments] : "") ?? "";
    const rawCategory = (colIdx.category >= 0 ? cols[colIdx.category] : "") ?? "";

    products.push({
      sku: rawSku.trim(),
      productName: rawName.trim(),
      productType: "supplement",
      category: rawCategory.trim() || currentCategory || null,
      subcategory: null,
      brand: null,
      upc: null,
      asin: null,
      inventory: {
        status: normalizeStatus(rawStatus),
        quantityOnHand: null,
        reorderPoint: null,
        leadTimeDays: null,
        moq: null,
        // Rocktomic inventory extensions
        replenishmentEta: rawComments.trim() || null,
        accessLevel: normalizeAccessLevel(rawAccess),
        lastUpdated: reportDate ?? null,
      },
      pricing: {
        msrp: parseCurrency(rawMsrp),
        wholesaleCost: null,
        currency: "USD",
        wholesaleTiers: {
          nonMember: null,
          standard: null,
          vipPlus: null,
          basic: null,
          launch: null,
          scale: null,
        },
        mapPrice: null,
        salePrice: null,
      },
      physical: {
        weightLbs: null,
        weightOz: null,
        heightIn: null,
        widthIn: null,
        depthIn: null,
        unitCount: null,
        unitCountType: null,
      },
      details: {
        description: null,
        shortDescription: null,
        suggestedUse: null,
        warnings: null,
        storageInstructions: null,
        countryOfOrigin: null,
        certifications: [],
        flavor: null,
        form: null,
        coaUrl: null,
      },
      supplementFacts: {
        servingSize: null,
        servingsPerContainer: null,
        ingredients: [],
        otherIngredients: null,
        allergenWarning: null,
        raw: null,
      },
      assets: {
        imageUrls: [],
        labelUrls: [],
        coaUrls: [],
        sheetUrls: [],
        videoUrls: [],
        coaExpiryDate: null,
      },
      shipping: {
        shipsFromState: null,
        shipsFromCountry: null,
        freeShippingThreshold: null,
        standardRoute: {
          carriers: [],
          fulfillmentDays: null,
          transitDays: null,
          totalEstimatedDays: null,
        },
        expeditedRoute: null,
        internationalAvailable: null,
        hazmat: null,
      },
      agenticVisibility: {
        priorityScore: null,
        tags: [],
        relatedSkus: [],
        bundleSuggestions: [],
        notes: null,
        certifications: [],
      },
      seo: {
        metaTitle: null,
        metaDescription: null,
        keywords: [],
        canonicalUrl: null,
      },
      policy: {
        refundWindowDays: null,
        refundType: null,
        returnShippingPaidBy: null,
        policyNotes: null,
      },
      extraction: {
        sourceRef: `row ${i + 1}`,
        sourceFileId: null,
        extractedAt: null,
        confidence: 0.9,
        extractionNotes: "Deterministic CSV parse",
      },
    });
  }

  if (products.length === 0) {
    parseNotes.push("No product rows found after header");
  }

  // Majority of parsed rows must have both a non-empty SKU and a productName
  // to qualify as high confidence; status always has a default so is not checked.
  const wellFormedRows = products.filter(
    (p) =>
      typeof p.sku === "string" && (p.sku as string).trim() !== "" &&
      typeof p.productName === "string" && (p.productName as string).trim() !== "",
  ).length;
  const majorityWellFormed =
    products.length > 0 && wellFormedRows >= products.length / 2;
  const confidence: "high" | "low" =
    products.length > 0 && majorityWellFormed ? "high" : "low";

  const payload: Record<string, unknown> = {
    schemaType: "product_catalog",
    schemaVersion: "1.1",
    supplier: {
      supplierId: "rocktomic",
      name: "Rocktomic Labs LLC",
      supplierName: "Rocktomic Labs LLC",
      website: null,
      contactEmail: null,
      contactPhone: null,
    },
    products,
    totalProductsFound: products.length,
    sourcesProcessed: 1,
    extractionNotes: `Deterministically parsed from Rocktomic inventory CSV. ${products.length} products found.`,
    _meta: {
      parseMode: "deterministic_structured",
      reportDate: reportDate ?? null,
    },
  };

  return { payload, confidence, parseNotes, productCount: products.length };
}
