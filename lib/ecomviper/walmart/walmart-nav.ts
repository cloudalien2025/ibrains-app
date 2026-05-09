export interface WalmartNavItem {
  label: string;
  href: string;
}

export const walmartNavItems: WalmartNavItem[] = [
  { label: "Dashboard", href: "/apps/ecomviper/walmart" },
  { label: "Connect", href: "/apps/ecomviper/walmart/connect" },
  { label: "Products", href: "/apps/ecomviper/walmart/products" },
  { label: "Drafts", href: "/apps/ecomviper/walmart/drafts" },
  { label: "Inventory", href: "/apps/ecomviper/walmart/inventory" },
  { label: "Pricing", href: "/apps/ecomviper/walmart/pricing" },
  { label: "Feeds", href: "/apps/ecomviper/walmart/feeds" },
  { label: "Activity Log", href: "/apps/ecomviper/walmart/activity" },
  { label: "Settings", href: "/apps/ecomviper/walmart/settings" },
];
