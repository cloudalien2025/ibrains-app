import WalmartInventoryClient from "@/app/apps/ecomviper/walmart/inventory/inventory-client";
import { getInventoryView } from "@/lib/ecomviper/walmart/walmart-inventory";
import { listProducts } from "@/lib/ecomviper/walmart/walmart-store";

export const dynamic = "force-dynamic";

export default function WalmartInventoryPage() {
  const inventory = getInventoryView();
  return (
    <WalmartInventoryClient
      products={listProducts()}
      lowStock={inventory.lowStock}
      outOfStock={inventory.outOfStock}
      recentChanges={inventory.recentChanges}
    />
  );
}
