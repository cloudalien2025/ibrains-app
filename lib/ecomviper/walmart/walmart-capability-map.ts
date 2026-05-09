import type { WalmartCapabilityModule } from "@/lib/ecomviper/walmart/walmart-types";

export const walmartCapabilityModules: WalmartCapabilityModule[] = [
  {
    id: "catalog_optimizer",
    title: "Catalog Optimizer",
    description: "Marketplace catalog/items optimization with staged content edits.",
    status: "available",
    apiFamily: "marketplace",
  },
  {
    id: "inventory_optimizer",
    title: "Inventory Optimizer",
    description: "Inventory sync and quantity-aware optimization rules.",
    status: "available",
    apiFamily: "marketplace",
  },
  {
    id: "pricing_optimizer",
    title: "Pricing Optimizer",
    description: "Pricing update workflows with staged validation before submit.",
    status: "available",
    apiFamily: "marketplace",
  },
  {
    id: "feed_manager",
    title: "Feed Manager",
    description: "Item maintenance feed preparation and status tracking.",
    status: "available",
    apiFamily: "marketplace",
  },
  {
    id: "orders_returns_intelligence",
    title: "Orders/Returns Intelligence",
    description: "Order/returns/reporting workflows planned on Marketplace endpoints.",
    status: "foundation",
    apiFamily: "marketplace",
  },
  {
    id: "walmart_connect_ads_optimizer",
    title: "Walmart Connect Ads Optimizer",
    description: "Sponsored Search/ads workflows require separate Walmart Connect credentials.",
    status: "separate_integration_required",
    apiFamily: "walmart_connect_ads",
  },
];
