import ShopifyWorkspaceClient from "@/app/apps/ecomviper/shopify/shopify-workspace-client";
import { buildShopifyAgenticDemoWorkspaceState } from "@/lib/ecomviper/shopify/shopify-agentic-demo-data";

export const dynamic = "force-dynamic";

export default function EcomViperShopifyPage() {
  const workspaceState = buildShopifyAgenticDemoWorkspaceState();
  return <ShopifyWorkspaceClient initialState={workspaceState} />;
}
