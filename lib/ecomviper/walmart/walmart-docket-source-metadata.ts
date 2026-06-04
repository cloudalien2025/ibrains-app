export type WalmartDocketFieldSource =
  | "items_list"
  | "item_detail"
  | "item_report"
  | "public_catalog"
  | "serpapi_public_listing"
  | "shopify_import_fallback"
  | "page_live_refresh"
  | "user_edit"
  | "ai_optimized"
  | "fallback"
  | "unknown";

export type WalmartDocketFieldConfidence = "high" | "medium" | "low" | "unknown";

export interface WalmartDocketFieldMetadata {
  source: WalmartDocketFieldSource;
  sourceLabel: string;
  retrievedAt: string | null;
  updatedAt: string | null;
  confidence: WalmartDocketFieldConfidence;
  warnings: string[];
}

export function sourceLabelForWalmartDocket(source: WalmartDocketFieldSource): string {
  if (source === "items_list") return "Items List";
  if (source === "item_detail") return "Item Detail";
  if (source === "item_report") return "Item Report";
  if (source === "public_catalog") return "Public Catalog";
  if (source === "serpapi_public_listing") return "SerpApi Public Listing";
  if (source === "shopify_import_fallback") return "Shopify Import Fallback";
  if (source === "page_live_refresh") return "Page Live Refresh";
  if (source === "user_edit") return "User Edit";
  if (source === "ai_optimized") return "AI Optimized";
  if (source === "fallback") return "Fallback";
  return "Unknown";
}

export function createWalmartDocketFieldMetadata(input?: Partial<WalmartDocketFieldMetadata>): WalmartDocketFieldMetadata {
  const source = input?.source ?? "unknown";
  const sourceLabel = input?.sourceLabel?.trim() || sourceLabelForWalmartDocket(source);
  return {
    source,
    sourceLabel,
    retrievedAt: input?.retrievedAt ?? null,
    updatedAt: input?.updatedAt ?? null,
    confidence: input?.confidence ?? "unknown",
    warnings: [...(input?.warnings ?? [])],
  };
}
