import type { RuntimeMode } from "@/lib/ecomviper/core/marketplace-types";

export type EbayConnectionState = "mock_mode" | "not_connected" | "ready_for_credentials";

export type EbayEnvironment = "sandbox" | "production_placeholder";

export type EbayListingPriority = "low" | "medium" | "high";

export interface EbayConnectionChecklistItem {
  key: string;
  label: string;
  configured: boolean;
}

export interface EbayDashboardConnectionSummary {
  mode: RuntimeMode;
  connectionState: EbayConnectionState;
  environment: EbayEnvironment;
  marketplace: string;
  readOnlyScope: "sell.inventory.readonly";
  checklist: EbayConnectionChecklistItem[];
  readOnlyBoundaryNote: string;
}

export interface EbayListingIdentifiers {
  brand?: string;
  model?: string;
  upc?: string;
  ean?: string;
  mpn?: string;
}

export interface EbayListingRecord {
  id: string;
  sku: string;
  title: string;
  categoryId: string;
  categoryName: string;
  condition: string;
  quantity: number;
  descriptionSummary: string;
  bulletHighlights: string[];
  aspects: Record<string, string>;
  identifiers: EbayListingIdentifiers;
  imageUrls: string[];
}

export interface EbayCategoryAspectMetadata {
  categoryId: string;
  categoryName: string;
  requiredAspects: string[];
  recommendedAspects: string[];
}

export interface EbayInventoryImportRequest {
  marketplaceId: string;
  page: number;
  limit: number;
}

export interface EbayInventoryImportResult {
  mode: RuntimeMode;
  listings: EbayListingRecord[];
  warnings: string[];
}

export interface EbayInventoryProvider {
  mode: RuntimeMode;
  importInventoryItems(request: EbayInventoryImportRequest): Promise<EbayInventoryImportResult>;
}

export interface EbayTaxonomyProvider {
  mode: RuntimeMode;
  getItemAspectsForCategory(categoryId: string): Promise<EbayCategoryAspectMetadata>;
}

export interface EbayListingOptimizationScore {
  titleScore: number;
  descriptionScore: number;
  aspectScore: number;
  imageScore: number;
  identifierScore: number;
  inventoryScore: number;
  overallScore: number;
  missingRequiredAspects: string[];
  missingRecommendedAspects: string[];
  missingIdentifiers: Array<keyof EbayListingIdentifiers>;
  priority: EbayListingPriority;
  status: "Healthy" | "Improve" | "Needs Attention";
}

export interface EbayListingRecommendation {
  suggestedTitle: string;
  suggestedDescriptionDirection: string;
  missingRequiredAspects: string[];
  missingRecommendedAspects: string[];
  identifierIssues: string[];
  imageImprovementNotes: string[];
  searchVisibilityNotes: string[];
  conversionImprovementNotes: string[];
  complianceSafeRewriteNotes: string[];
  priorityExplanation: string;
}

export interface EbayListingAuditRow {
  listing: EbayListingRecord;
  score: EbayListingOptimizationScore;
  recommendation: EbayListingRecommendation;
}

export const ebayWriteOperationNames = [
  "createOffer",
  "publishOffer",
  "updateInventoryItem",
  "bulkUpdatePriceQuantity",
  "deleteInventoryItem",
  "revise",
  "fulfillment",
] as const;
