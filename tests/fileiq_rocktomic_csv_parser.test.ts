/**
 * Rocktomic inventory CSV parser tests.
 *
 * Covers: category section header detection, status/access-level normalization,
 * ETA/date mapping, product count accuracy (Task C + Task E.4).
 */

import { describe, expect, it } from "vitest";
import { parseRocktomicInventoryCsv } from "@/lib/fileiq/csv/rocktomic-inventory-parser";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeInventoryCsv(rows: string[]): string {
  return rows.join("\n");
}

const HEADER = "SKU,Product Name,Status,Access Level,MSRP,Comments/ETA";

// ─── Basic parsing ────────────────────────────────────────────────────────────

describe("parseRocktomicInventoryCsv — basic parsing", () => {
  it("parses a minimal CSV with one product row", () => {
    const csv = makeInventoryCsv([
      HEADER,
      "ROC001,Omega-3 Fish Oil,IN STOCK,All Memberships,$29.99,",
    ]);
    const result = parseRocktomicInventoryCsv(csv);
    expect(result.confidence).toBe("high");
    expect(result.productCount).toBe(1);
    const product = (result.payload.products as Record<string, unknown>[])[0];
    expect(product.sku).toBe("ROC001");
    expect(product.productName).toBe("Omega-3 Fish Oil");
  });

  it("sets schemaType=product_catalog and schemaVersion=1.1", () => {
    const csv = makeInventoryCsv([HEADER, "ROC001,Product A,IN STOCK,All Memberships,$19.99,"]);
    const result = parseRocktomicInventoryCsv(csv);
    expect(result.payload.schemaType).toBe("product_catalog");
    expect(result.payload.schemaVersion).toBe("1.1");
  });

  it("sets Rocktomic Labs LLC as the supplier name", () => {
    const csv = makeInventoryCsv([HEADER, "ROC001,Product A,IN STOCK,All Memberships,$19.99,"]);
    const result = parseRocktomicInventoryCsv(csv);
    const supplier = result.payload.supplier as Record<string, unknown>;
    expect(supplier.name).toBe("Rocktomic Labs LLC");
    expect(supplier.supplierName).toBe("Rocktomic Labs LLC");
  });

  it("sets totalProductsFound equal to parsed product count", () => {
    const csv = makeInventoryCsv([
      HEADER,
      "ROC001,Product A,IN STOCK,All Memberships,$10.00,",
      "ROC002,Product B,LOW STOCK,Scale Plan Only,$20.00,",
      "ROC003,Product C,OUT OF STOCK,,,",
    ]);
    const result = parseRocktomicInventoryCsv(csv);
    expect(result.productCount).toBe(3);
    expect(result.payload.totalProductsFound).toBe(3);
  });

  it("returns confidence=low for empty CSV", () => {
    const result = parseRocktomicInventoryCsv("");
    expect(result.confidence).toBe("low");
    expect(result.productCount).toBe(0);
  });

  it("returns confidence=low when no header row found", () => {
    const csv = makeInventoryCsv([
      "ROC001,Product A,$10.00",
      "ROC002,Product B,$20.00",
    ]);
    const result = parseRocktomicInventoryCsv(csv);
    expect(result.confidence).toBe("low");
  });
});

// ─── Category section header detection ────────────────────────────────────────

describe("parseRocktomicInventoryCsv — category section headers", () => {
  it("detects and skips a category header row (no SKU)", () => {
    const csv = makeInventoryCsv([
      HEADER,
      ",PROTEIN SUPPLEMENTS,,,,",
      "ROC001,Whey Protein,IN STOCK,All Memberships,$49.99,",
    ]);
    const result = parseRocktomicInventoryCsv(csv);
    expect(result.productCount).toBe(1);
    const product = (result.payload.products as Record<string, unknown>[])[0];
    // Category should be carried to the product
    expect(product.category).toBe("PROTEIN SUPPLEMENTS");
  });

  it("assigns current category to subsequent product rows until a new category row", () => {
    const csv = makeInventoryCsv([
      HEADER,
      ",PROTEINS,,,,",
      "ROC001,Protein A,IN STOCK,All Memberships,$49.99,",
      "ROC002,Protein B,IN STOCK,All Memberships,$39.99,",
      ",VITAMINS,,,,",
      "ROC003,Vitamin C,IN STOCK,All Memberships,$19.99,",
    ]);
    const result = parseRocktomicInventoryCsv(csv);
    expect(result.productCount).toBe(3);
    const products = result.payload.products as Record<string, unknown>[];
    expect(products[0].category).toBe("PROTEINS");
    expect(products[1].category).toBe("PROTEINS");
    expect(products[2].category).toBe("VITAMINS");
  });
});

// ─── Inventory status normalization ───────────────────────────────────────────

describe("parseRocktomicInventoryCsv — status normalization", () => {
  const statusCases: Array<[string, string]> = [
    ["IN STOCK", "in_stock"],
    ["LOW STOCK", "low_stock"],
    ["OUT OF STOCK", "out_of_stock"],
    ["R&D In Progress", "rd_in_progress"],
    ["Discontinued", "discontinued"],
  ];

  for (const [raw, expected] of statusCases) {
    it(`normalizes "${raw}" → "${expected}"`, () => {
      const csv = makeInventoryCsv([
        HEADER,
        `ROC001,Test Product,${raw},All Memberships,$9.99,`,
      ]);
      const result = parseRocktomicInventoryCsv(csv);
      const inventory = (result.payload.products as Record<string, unknown>[])[0]
        .inventory as Record<string, unknown>;
      expect(inventory.status).toBe(expected);
    });
  }

  it("defaults unknown status to out_of_stock", () => {
    const csv = makeInventoryCsv([HEADER, "ROC001,Product,UNKNOWN STATUS,,,,"]);
    const result = parseRocktomicInventoryCsv(csv);
    const inventory = (result.payload.products as Record<string, unknown>[])[0]
      .inventory as Record<string, unknown>;
    expect(inventory.status).toBe("out_of_stock");
  });
});

// ─── Access level normalization ───────────────────────────────────────────────

describe("parseRocktomicInventoryCsv — access level normalization", () => {
  const accessCases: Array<[string, string | null]> = [
    ["All Memberships", "all_memberships"],
    ["Scale Plan Only", "scale_plan"],
    ["Product Investment Club", "product_investment_club"],
    ["", null],
  ];

  for (const [raw, expected] of accessCases) {
    it(`normalizes access level "${raw}" → ${JSON.stringify(expected)}`, () => {
      const csv = makeInventoryCsv([
        HEADER,
        `ROC001,Test Product,IN STOCK,${raw},$9.99,`,
      ]);
      const result = parseRocktomicInventoryCsv(csv);
      const inventory = (result.payload.products as Record<string, unknown>[])[0]
        .inventory as Record<string, unknown>;
      expect(inventory.accessLevel).toBe(expected);
    });
  }
});

// ─── Comments/ETA → replenishmentEta ─────────────────────────────────────────

describe("parseRocktomicInventoryCsv — comments/ETA mapping", () => {
  it("maps non-empty comments column to inventory.replenishmentEta", () => {
    const csv = makeInventoryCsv([
      HEADER,
      "ROC001,Product A,OUT OF STOCK,All Memberships,$29.99,Back in stock Q3 2026",
    ]);
    const result = parseRocktomicInventoryCsv(csv);
    const inventory = (result.payload.products as Record<string, unknown>[])[0]
      .inventory as Record<string, unknown>;
    expect(inventory.replenishmentEta).toBe("Back in stock Q3 2026");
  });

  it("sets replenishmentEta=null when comments column is empty", () => {
    const csv = makeInventoryCsv([HEADER, "ROC001,Product A,IN STOCK,All Memberships,$29.99,"]);
    const result = parseRocktomicInventoryCsv(csv);
    const inventory = (result.payload.products as Record<string, unknown>[])[0]
      .inventory as Record<string, unknown>;
    expect(inventory.replenishmentEta).toBeNull();
  });
});

// ─── Report date → inventory.lastUpdated ──────────────────────────────────────

describe("parseRocktomicInventoryCsv — report date mapping", () => {
  it("maps reportDate param to inventory.lastUpdated on all products", () => {
    const csv = makeInventoryCsv([
      HEADER,
      "ROC001,Product A,IN STOCK,All Memberships,$29.99,",
      "ROC002,Product B,LOW STOCK,Scale Plan Only,$49.99,",
    ]);
    const result = parseRocktomicInventoryCsv(csv, "2026-06-04");
    const products = result.payload.products as Array<Record<string, unknown>>;
    for (const product of products) {
      const inventory = product.inventory as Record<string, unknown>;
      expect(inventory.lastUpdated).toBe("2026-06-04");
    }
  });

  it("sets lastUpdated=null when no reportDate is provided", () => {
    const csv = makeInventoryCsv([HEADER, "ROC001,Product A,IN STOCK,,,"]);
    const result = parseRocktomicInventoryCsv(csv);
    const inventory = (result.payload.products as Record<string, unknown>[])[0]
      .inventory as Record<string, unknown>;
    expect(inventory.lastUpdated).toBeNull();
  });
});

// ─── MSRP parsing ─────────────────────────────────────────────────────────────

describe("parseRocktomicInventoryCsv — MSRP parsing", () => {
  it("parses dollar-sign MSRP to a number", () => {
    const csv = makeInventoryCsv([HEADER, "ROC001,Product A,IN STOCK,All Memberships,$29.99,"]);
    const result = parseRocktomicInventoryCsv(csv);
    const pricing = (result.payload.products as Record<string, unknown>[])[0]
      .pricing as Record<string, unknown>;
    expect(pricing.msrp).toBe(29.99);
    expect(pricing.currency).toBe("USD");
  });

  it("sets msrp=null for empty price column", () => {
    const csv = makeInventoryCsv([HEADER, "ROC001,Product A,IN STOCK,,,"]);
    const result = parseRocktomicInventoryCsv(csv);
    const pricing = (result.payload.products as Record<string, unknown>[])[0]
      .pricing as Record<string, unknown>;
    expect(pricing.msrp).toBeNull();
  });
});

// ─── Product count accuracy ───────────────────────────────────────────────────

describe("parseRocktomicInventoryCsv — product count", () => {
  it("totalProductsFound equals productCount", () => {
    const rows = [HEADER];
    for (let i = 1; i <= 10; i++) {
      rows.push(`ROC${String(i).padStart(3, "0")},Product ${i},IN STOCK,All Memberships,$${i * 10}.00,`);
    }
    const result = parseRocktomicInventoryCsv(makeInventoryCsv(rows));
    expect(result.productCount).toBe(10);
    expect(result.payload.totalProductsFound).toBe(10);
  });

  it("skips header rows and category rows when counting products", () => {
    const csv = makeInventoryCsv([
      HEADER,
      ",CATEGORY A,,,,",
      "ROC001,Product A,IN STOCK,,,",
      "ROC002,Product B,IN STOCK,,,",
      ",CATEGORY B,,,,",
      "ROC003,Product C,IN STOCK,,,",
    ]);
    const result = parseRocktomicInventoryCsv(csv);
    expect(result.productCount).toBe(3);
  });
});

// ─── Header detection beyond the first 5 rows ────────────────────────────────

describe("parseRocktomicInventoryCsv — header beyond row 5", () => {
  it("detects header when preceded by 10 metadata rows", () => {
    const metadata = [
      "Rocktomic Inventory Report - Confidential",
      "Report Date: 2026-06-04",
      "Generated by: Rocktomic ERP",
      "Category Count: 8",
      "Confidential - Internal Use Only",
      "Region: North America",
      "Currency: USD",
      "Version: 2.1",
      "---",
      "Begin Inventory Data",
    ];
    const csv = makeInventoryCsv([
      ...metadata,
      HEADER,
      "ROC948,Grass-Fed Whey Protein,IN STOCK,All Memberships,$59.99,",
    ]);
    const result = parseRocktomicInventoryCsv(csv);
    expect(result.confidence).toBe("high");
    expect(result.productCount).toBe(1);
    const product = (result.payload.products as Record<string, unknown>[])[0];
    expect(product.sku).toBe("ROC948");
  });

  it("uses 'Item Name' as the product name column", () => {
    const header = "SKU,Item Name,Status,Access Level,MSRP,Comments";
    const csv = makeInventoryCsv([
      header,
      "ROC948,Grass-Fed Whey Protein,IN STOCK,All Memberships,$59.99,",
    ]);
    const result = parseRocktomicInventoryCsv(csv);
    expect(result.productCount).toBe(1);
    const product = (result.payload.products as Record<string, unknown>[])[0];
    expect(product.productName).toBe("Grass-Fed Whey Protein");
  });

  it("uses 'Inventory Status' as the status column", () => {
    const header = "SKU,Product Name,Inventory Status,Access Level,MSRP,Comments";
    const csv = makeInventoryCsv([
      header,
      "ROC948,Grass-Fed Whey Protein,In Stock,All Memberships,$59.99,",
    ]);
    const result = parseRocktomicInventoryCsv(csv);
    const product = (result.payload.products as Record<string, unknown>[])[0];
    const inventory = product.inventory as Record<string, unknown>;
    expect(inventory.status).toBe("in_stock");
  });

  it("uses 'Stock Status' as the status column", () => {
    const header = "SKU,Product Name,Stock Status,Access Level,MSRP,Comments";
    const csv = makeInventoryCsv([
      header,
      "ROC948,Grass-Fed Whey Protein,Low Stock,All Memberships,$59.99,",
    ]);
    const result = parseRocktomicInventoryCsv(csv);
    const inventory = (result.payload.products as Record<string, unknown>[])[0]
      .inventory as Record<string, unknown>;
    expect(inventory.status).toBe("low_stock");
  });

  it("uses 'Additional Comments' as the replenishmentEta column", () => {
    const header = "SKU,Product Name,Inventory Status,Access Level,MSRP,Additional Comments";
    const csv = makeInventoryCsv([
      header,
      "ROC980,Collagen Peptides,Out of Stock,All Memberships,$49.99,Back in Q3 2026",
    ]);
    const result = parseRocktomicInventoryCsv(csv);
    const inventory = (result.payload.products as Record<string, unknown>[])[0]
      .inventory as Record<string, unknown>;
    expect(inventory.replenishmentEta).toBe("Back in Q3 2026");
  });

  it("uses 'Plan Access' as the access level column", () => {
    const header = "SKU,Product Name,Inventory Status,Plan Access,MSRP,Comments";
    const csv = makeInventoryCsv([
      header,
      "ROC948,Grass-Fed Whey Protein,In Stock,Scale Plan Only,$59.99,",
    ]);
    const result = parseRocktomicInventoryCsv(csv);
    const inventory = (result.payload.products as Record<string, unknown>[])[0]
      .inventory as Record<string, unknown>;
    expect(inventory.accessLevel).toBe("scale_plan");
  });
});

// ─── Realistic Rocktomic CSV shape ───────────────────────────────────────────

const REALISTIC_CSV_HEADER = "SKU,Product Name,Inventory Status,Access Level,MSRP,Additional Comments";

const REALISTIC_CSV_ROWS = [
  "Rocktomic Supplier Inventory - CONFIDENTIAL",
  "Report Date: 2026-06-04",
  "Internal use only - do not distribute",
  REALISTIC_CSV_HEADER,
  ",PROTEIN SUPPLEMENTS,,,,",
  "ROC948,Grass-Fed Whey Protein,In Stock,All Memberships,$59.99,",
  "ROC980,Collagen Peptides,Low Stock,Scale Plan Only,$49.99,Restocking Q3 2026",
  "ROC945,Vegan Protein Blend,In Stock,All Memberships,$54.99,",
  ",VITAMINS & MINERALS,,,,",
  "ROC508,Vitamin D3 K2 Complex,Out of Stock,All Memberships,$29.99,ETA 2026-08-01",
  "ROC512,Magnesium Glycinate,In Stock,All Memberships,$24.99,",
];

describe("parseRocktomicInventoryCsv — realistic Rocktomic CSV shape", () => {
  it("parses a realistic Rocktomic-shaped CSV with metadata rows before the header", () => {
    const csv = makeInventoryCsv(REALISTIC_CSV_ROWS);
    const result = parseRocktomicInventoryCsv(csv);
    expect(result.productCount).toBe(5);
    expect(result.payload.totalProductsFound).toBe(5);
  });

  it("confidence=high on realistic Rocktomic CSV with productCount > 0", () => {
    const csv = makeInventoryCsv(REALISTIC_CSV_ROWS);
    const result = parseRocktomicInventoryCsv(csv);
    expect(result.confidence).toBe("high");
  });

  it("ROC948 parsed as status=in_stock, accessLevel=all_memberships", () => {
    const csv = makeInventoryCsv(REALISTIC_CSV_ROWS);
    const result = parseRocktomicInventoryCsv(csv);
    const products = result.payload.products as Record<string, unknown>[];
    const roc948 = products.find((p) => p.sku === "ROC948");
    expect(roc948).toBeDefined();
    const inventory = roc948!.inventory as Record<string, unknown>;
    expect(inventory.status).toBe("in_stock");
    expect(inventory.accessLevel).toBe("all_memberships");
  });

  it("category headers assigned to following product rows across sections", () => {
    const csv = makeInventoryCsv(REALISTIC_CSV_ROWS);
    const result = parseRocktomicInventoryCsv(csv);
    const products = result.payload.products as Record<string, unknown>[];
    const roc948 = products.find((p) => p.sku === "ROC948")!;
    const roc980 = products.find((p) => p.sku === "ROC980")!;
    const roc508 = products.find((p) => p.sku === "ROC508")!;
    expect(roc948.category).toBe("PROTEIN SUPPLEMENTS");
    expect(roc980.category).toBe("PROTEIN SUPPLEMENTS");
    expect(roc508.category).toBe("VITAMINS & MINERALS");
  });

  it("comments/ETA column mapped to replenishmentEta on products that have it", () => {
    const csv = makeInventoryCsv(REALISTIC_CSV_ROWS);
    const result = parseRocktomicInventoryCsv(csv);
    const products = result.payload.products as Record<string, unknown>[];
    const roc980 = products.find((p) => p.sku === "ROC980")!;
    const roc508 = products.find((p) => p.sku === "ROC508")!;
    const roc948 = products.find((p) => p.sku === "ROC948")!;
    const inv980 = roc980.inventory as Record<string, unknown>;
    const inv508 = roc508.inventory as Record<string, unknown>;
    const inv948 = roc948.inventory as Record<string, unknown>;
    expect(inv980.replenishmentEta).toBe("Restocking Q3 2026");
    expect(inv508.replenishmentEta).toBe("ETA 2026-08-01");
    expect(inv948.replenishmentEta).toBeNull();
  });

  it("maps reportDate to inventory.lastUpdated on all products", () => {
    const csv = makeInventoryCsv(REALISTIC_CSV_ROWS);
    const result = parseRocktomicInventoryCsv(csv, "2026-06-04");
    const products = result.payload.products as Record<string, unknown>[];
    for (const product of products) {
      const inventory = product.inventory as Record<string, unknown>;
      expect(inventory.lastUpdated).toBe("2026-06-04");
    }
  });
});

// ─── v1.1 schema compliance ───────────────────────────────────────────────────

describe("parseRocktomicInventoryCsv — v1.1 schema compliance", () => {
  it("each product has the required v1.1 top-level fields", () => {
    const csv = makeInventoryCsv([HEADER, "ROC001,Product A,IN STOCK,All Memberships,$9.99,"]);
    const result = parseRocktomicInventoryCsv(csv);
    const product = (result.payload.products as Record<string, unknown>[])[0];
    expect(product).toHaveProperty("sku");
    expect(product).toHaveProperty("productName");
    expect(product).toHaveProperty("inventory");
    expect(product).toHaveProperty("pricing");
    expect(product).toHaveProperty("assets");
    expect(product).toHaveProperty("agenticVisibility");
    expect((product.assets as Record<string, unknown>).coaExpiryDate).toBeNull();
  });

  it("payload includes _meta.parseMode=deterministic_structured", () => {
    const csv = makeInventoryCsv([HEADER, "ROC001,Product A,IN STOCK,,,"]);
    const result = parseRocktomicInventoryCsv(csv);
    const meta = result.payload._meta as Record<string, unknown>;
    expect(meta.parseMode).toBe("deterministic_structured");
  });
});
