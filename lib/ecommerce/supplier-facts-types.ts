import type { SupplierMatchConfidence } from "@/lib/ecommerce/supplier-product-match";

export type SupplierFactsReadinessStatus =
  | "ready"
  | "ready_with_warnings"
  | "blocked"
  | "not_applicable"
  | "needs_review"
  | "unknown";

export type SupplierFactsPanelStatus = "unavailable" | "no_match" | "candidate" | "matched";

export interface SupplierFactsPanelViewModel {
  status: SupplierFactsPanelStatus;
  supplierSlug: string;
  message: string;
  checkedIdentifiers: {
    skus: string[];
    normalizedSkus: string[];
    barcodes: string[];
    handle: string | null;
    title: string | null;
  };
  matchStatus: SupplierFactsPanelStatus;
  matchConfidence: SupplierMatchConfidence;
  matchReasons: string[];
  supplierName: string | null;
  supplierSku: string | null;
  supplierProductName: string | null;
  validationStatus: string | null;
  readiness: {
    ingredientMatching: SupplierFactsReadinessStatus;
    productEditorFacts: SupplierFactsReadinessStatus;
    pricing: SupplierFactsReadinessStatus;
    inventory: SupplierFactsReadinessStatus;
    complianceEvidence: SupplierFactsReadinessStatus;
    optiPixelAssets: SupplierFactsReadinessStatus;
    channelImageGeneration: SupplierFactsReadinessStatus;
  };
  sourceFactsSummary: string[];
  supplementFactsSummary: string[];
  activeIngredients: string[];
  otherIngredients: string[];
  servingSize: string | null;
  servingsPerContainer: string | null;
  directions: string | null;
  warnings: string | null;
  pricingSummary: {
    available: boolean;
    wholesaleCost: number | null;
    msrp: number | null;
    currency: string | null;
    statusLabel: string;
  };
  inventorySummary: {
    available: boolean;
    status: string | null;
    raw: string | null;
    comments: string | null;
  };
  assetSummary: {
    coaPresent: boolean;
    coaUrl: string | null;
    labelTemplateAiPresent: boolean;
    mockupTemplateTifPresent: boolean;
    readyForOptiPixel: boolean;
  };
  evidence: {
    sourceMethod: string | null;
    aiLabelTextEvidenceStatus: string;
    needsReview: boolean;
    missingCoaWarning: boolean;
    topDefects: string[];
  };
}
