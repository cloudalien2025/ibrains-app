import "server-only";

export type RocktomicSourceStatus = "configured" | "pending";

export interface RocktomicSourceReference {
  id:
    | "catalog_pdf"
    | "label_mockup_templates"
    | "order_refund_policy"
    | "msrp_profit_margins_report"
    | "plds_catalog"
    | "inventory_report"
    | "coa_repository";
  label: string;
  status: RocktomicSourceStatus;
  sourceUrl: string | null;
  sourceUpdatedAt: string | null;
  sourceVersion: string | null;
}

export interface RocktomicSourceConfigSnapshot {
  supplier: "Rocktomic";
  references: RocktomicSourceReference[];
  configuredReferenceCount: number;
  pendingReferenceCount: number;
  lastSyncedAt: string | null;
}

const DEFAULT_SUPPLEMENT_CATALOG_URL =
  process.env.ECOMVIPER_ROCKTOMIC_SUPPLEMENT_CATALOG_URL ||
  "https://rocktomicplatform.blob.core.windows.net/client-resources/Supplement-&-Apparel-Catalog.pdf?t=1780083599627";

const DEFAULT_LABEL_TEMPLATES_URL =
  process.env.ECOMVIPER_ROCKTOMIC_LABEL_TEMPLATES_URL ||
  "https://rocktomicplatform.blob.core.windows.net/client-resources/templates.html?t=1780083599627";

const DEFAULT_POLICY_URL =
  process.env.ECOMVIPER_ROCKTOMIC_ORDER_REFUND_POLICY_URL ||
  "https://rocktomicplatform.blob.core.windows.net/client-resources/Order-Refund-Policy-Template.docx?t=1780083599627";

const DEFAULT_MSRP_PROFIT_MARGINS_REPORT_URL =
  process.env.ECOMVIPER_ROCKTOMIC_MSRP_PROFIT_MARGINS_REPORT_URL ||
  "https://docs.google.com/spreadsheets/d/15lZ6M5SqNby_uOIzZEhBYEn6rtLZYQmVUVF4yWzKIbU/edit?usp=sharing";

const DEFAULT_PLDS_CATALOG_URL =
  process.env.ECOMVIPER_ROCKTOMIC_PLDS_CATALOG_URL ||
  "https://docs.google.com/spreadsheets/d/15lZ6M5SqNby_uOIzZEhBYEn6rtLZYQmVUVF4yWzKIbU/edit?usp=sharing";

const DEFAULT_INVENTORY_REPORT_URL =
  process.env.ECOMVIPER_ROCKTOMIC_INVENTORY_REPORT_URL ||
  "https://docs.google.com/spreadsheets/d/1oOjqXsaCAjSOkA1lXrasNtUVtrsxvyxcFcolD8n6YXY/edit?usp=sharing";

const DEFAULT_COA_REPOSITORY_URL =
  process.env.ECOMVIPER_ROCKTOMIC_COA_REPOSITORY_URL || null;

function extractVersion(url: string): string | null {
  try {
    const parsed = new URL(url);
    const version = parsed.searchParams.get("t");
    return version ? version.trim() : null;
  } catch {
    return null;
  }
}

function extractGoogleSheetId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/\/spreadsheets\/d\/([^/]+)/i);
    if (!match?.[1]) return null;
    return match[1].trim() || null;
  } catch {
    return null;
  }
}

export function getRocktomicSourceConfigSnapshot(): RocktomicSourceConfigSnapshot {
  const sourceUpdatedAt = "2026-05-29T00:00:00.000Z";

  const references: RocktomicSourceReference[] = [
    {
      id: "catalog_pdf",
      label: "Supplement & Apparel Catalog",
      status: "configured",
      sourceUrl: DEFAULT_SUPPLEMENT_CATALOG_URL,
      sourceUpdatedAt,
      sourceVersion: extractVersion(DEFAULT_SUPPLEMENT_CATALOG_URL) || "catalog_reference_2026_05_29",
    },
    {
      id: "label_mockup_templates",
      label: "Label & 3D Mockup Templates",
      status: "configured",
      sourceUrl: DEFAULT_LABEL_TEMPLATES_URL,
      sourceUpdatedAt,
      sourceVersion: extractVersion(DEFAULT_LABEL_TEMPLATES_URL),
    },
    {
      id: "order_refund_policy",
      label: "Order Refund Policy Template",
      status: "configured",
      sourceUrl: DEFAULT_POLICY_URL,
      sourceUpdatedAt,
      sourceVersion: extractVersion(DEFAULT_POLICY_URL),
    },
    {
      id: "msrp_profit_margins_report",
      label: "Full MSRP and Estimated Profit Margins Report",
      status: "configured",
      sourceUrl: DEFAULT_MSRP_PROFIT_MARGINS_REPORT_URL,
      sourceUpdatedAt,
      sourceVersion: extractGoogleSheetId(DEFAULT_MSRP_PROFIT_MARGINS_REPORT_URL),
    },
    {
      id: "plds_catalog",
      label: "PLDS Catalog",
      status: "configured",
      sourceUrl: DEFAULT_PLDS_CATALOG_URL,
      sourceUpdatedAt,
      sourceVersion: extractGoogleSheetId(DEFAULT_PLDS_CATALOG_URL),
    },
    {
      id: "inventory_report",
      label: "Inventory Report",
      status: "configured",
      sourceUrl: DEFAULT_INVENTORY_REPORT_URL,
      sourceUpdatedAt,
      sourceVersion: extractGoogleSheetId(DEFAULT_INVENTORY_REPORT_URL),
    },
    {
      id: "coa_repository",
      label: "COA Repository",
      status: DEFAULT_COA_REPOSITORY_URL ? "configured" : "pending",
      sourceUrl: DEFAULT_COA_REPOSITORY_URL,
      sourceUpdatedAt: DEFAULT_COA_REPOSITORY_URL ? sourceUpdatedAt : null,
      sourceVersion: DEFAULT_COA_REPOSITORY_URL ? extractVersion(DEFAULT_COA_REPOSITORY_URL) : null,
    },
  ];

  const configuredReferenceCount = references.filter((reference) => reference.status === "configured").length;
  const pendingReferenceCount = references.length - configuredReferenceCount;

  return {
    supplier: "Rocktomic",
    references,
    configuredReferenceCount,
    pendingReferenceCount,
    lastSyncedAt: sourceUpdatedAt,
  };
}
