import WalmartInventoryClient from "@/app/apps/ecomviper/walmart/inventory/inventory-client";
import { getInventoryView } from "@/lib/ecomviper/walmart/walmart-inventory";
import { getWalmartRuntimeMode, listMockProducts } from "@/lib/ecomviper/walmart/walmart-mock-data";

export const dynamic = "force-dynamic";

export default function WalmartInventoryPage() {
  const inventory = getInventoryView();
  return (
    <WalmartInventoryClient
      products={listMockProducts()}
      lowStock={inventory.lowStock}
      outOfStock={inventory.outOfStock}
      recentChanges={inventory.recentChanges}
      mode={getWalmartRuntimeMode()}
    />
  );
}
