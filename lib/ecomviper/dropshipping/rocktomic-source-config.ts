import "server-only";

export type RocktomicSourceStatus = "configured" | "pending";

export interface RocktomicSourceReference {
  id: "catalog_pdf" | "label_templates" | "order_refund_policy" | "plds_catalog" | "inventory_report_loc1" | "pricing_feed" | "shipping_policy" | "coa_repository";
  label: string;
  status: RocktomicSourceStatus;
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

const DEFAULT_LABEL_TEMPLATES_URL =
  process.env.ECOMVIPER_ROCKTOMIC_LABEL_TEMPLATES_URL ||
  "https://rocktomicplatform.blob.core.windows.net/client-resources/templates.html?t=1780038447445";
const DEFAULT_POLICY_URL =
  process.env.ECOMVIPER_ROCKTOMIC_ORDER_REFUND_POLICY_URL ||
  "https://rocktomicplatform.blob.core.windows.net/client-resources/Order-Refund-Policy-Template.docx?t=1780037728245";

function extractVersion(url: string): string | null {
  try {
    const parsed = new URL(url);
    const version = parsed.searchParams.get("t");
    return version ? version.trim() : null;
  } catch {
    return null;
  }
}

export function getRocktomicSourceConfigSnapshot(): RocktomicSourceConfigSnapshot {
  const references: RocktomicSourceReference[] = [
    {
      id: "catalog_pdf",
      label: "Supplement & Apparel Catalog",
      status: "configured",
      sourceUpdatedAt: "2026-05-29T00:00:00.000Z",
      sourceVersion: "catalog_reference_2026_05_29",
    },
    {
      id: "label_templates",
      label: "Label Templates",
      status: "configured",
      sourceUpdatedAt: "2026-05-29T00:00:00.000Z",
      sourceVersion: extractVersion(DEFAULT_LABEL_TEMPLATES_URL),
    },
    {
      id: "order_refund_policy",
      label: "Order / Refund Policy Template",
      status: "configured",
      sourceUpdatedAt: "2026-05-29T00:00:00.000Z",
      sourceVersion: extractVersion(DEFAULT_POLICY_URL),
    },
    {
      id: "plds_catalog",
      label: "PLDS Catalog",
      status: "pending",
      sourceUpdatedAt: null,
      sourceVersion: null,
    },
    {
      id: "inventory_report_loc1",
      label: "Inventory Report LOC1",
      status: "pending",
      sourceUpdatedAt: null,
      sourceVersion: null,
    },
    {
      id: "pricing_feed",
      label: "Pricing Feed",
      status: "pending",
      sourceUpdatedAt: null,
      sourceVersion: null,
    },
    {
      id: "shipping_policy",
      label: "Shipping Policy",
      status: "pending",
      sourceUpdatedAt: null,
      sourceVersion: null,
    },
    {
      id: "coa_repository",
      label: "COA Repository",
      status: "pending",
      sourceUpdatedAt: null,
      sourceVersion: null,
    },
  ];

  const configuredReferenceCount = references.filter((reference) => reference.status === "configured").length;
  const pendingReferenceCount = references.length - configuredReferenceCount;

  return {
    supplier: "Rocktomic",
    references,
    configuredReferenceCount,
    pendingReferenceCount,
    lastSyncedAt: "2026-05-29T00:00:00.000Z",
  };
}
