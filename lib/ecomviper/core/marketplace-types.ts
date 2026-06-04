export type MarketplaceId = "walmart" | "amazon" | "ebay" | "shopify";

export type MarketplaceLifecycleStatus = "active" | "coming-soon" | "future";

export type RuntimeMode = "mock" | "dry-run" | "live-ready";

export type Severity = "ok" | "warning" | "critical" | "unknown";

export interface MarketplaceCard {
  id: MarketplaceId;
  name: string;
  route: string;
  status: MarketplaceLifecycleStatus;
  description: string;
}

export interface MarketplaceMetric {
  id:
    | "connected-marketplaces"
    | "products-imported"
    | "draft-changes"
    | "sync-errors"
    | "listings-needing-attention";
  label: string;
  value: number;
  trend?: string;
}

export interface ActivityLogEntry {
  id: string;
  marketplace: MarketplaceId;
  actionType: string;
  result: "success" | "warning" | "error";
  message: string;
  sku: string | null;
  actor: string | null;
  createdAt: string;
  beforePayload?: unknown;
  afterPayload?: unknown;
}
