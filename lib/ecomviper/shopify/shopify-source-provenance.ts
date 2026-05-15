export type ShopifyWorkspaceSource = "live_shopify" | "demo" | "fallback_snapshot" | "unavailable";

export type ShopifyWorkspaceSourceLabel =
  | "Live Shopify API"
  | "Demo data"
  | "Fallback snapshot"
  | "Unavailable";

export type ShopifyWorkspaceHydrationMode = "live" | "demo" | "fallback" | "unavailable";

export interface ShopifyEntitySourceProvenance {
  entityType:
    | "shop"
    | "product"
    | "variant"
    | "collection"
    | "page"
    | "blog_article"
    | "policy"
    | "knowledge_base"
    | "trust_signal"
    | "visibility_scan";
  source: ShopifyWorkspaceSource;
  fetchedAt: string | null;
  storeDomain: string;
  rawId: string | null;
  connectionId: string | null;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function sourceLabel(source: ShopifyWorkspaceSource): ShopifyWorkspaceSourceLabel {
  if (source === "live_shopify") return "Live Shopify API";
  if (source === "demo") return "Demo data";
  if (source === "fallback_snapshot") return "Fallback snapshot";
  return "Unavailable";
}

export function sourceToHydrationMode(source: ShopifyWorkspaceSource): ShopifyWorkspaceHydrationMode {
  if (source === "live_shopify") return "live";
  if (source === "demo") return "demo";
  if (source === "fallback_snapshot") return "fallback";
  return "unavailable";
}

export function buildShopifyEntitySourceProvenance(input: {
  entityType: ShopifyEntitySourceProvenance["entityType"];
  source: ShopifyWorkspaceSource;
  fetchedAt?: string | null;
  storeDomain?: string | null;
  rawId?: string | null;
  connectionId?: string | null;
}): ShopifyEntitySourceProvenance {
  return {
    entityType: input.entityType,
    source: input.source,
    fetchedAt: asString(input.fetchedAt) || null,
    storeDomain: asString(input.storeDomain),
    rawId: asString(input.rawId) || null,
    connectionId: asString(input.connectionId) || null,
  };
}
