import WalmartInventoryClient from "@/app/apps/ecomviper/walmart/inventory/inventory-client";
import { getInventoryView } from "@/lib/ecomviper/walmart/walmart-inventory";
import { requireSignedInUser } from "@/lib/auth/requireSignedInUser";
import { listWalmartDraftsForUser } from "@/lib/ecomviper/walmart/walmart-drafts";
import { mergeProductsWithLatestDrafts } from "@/lib/ecomviper/walmart/walmart-product-display";
import { listWalmartProductsForUser } from "@/lib/ecomviper/walmart/walmart-products";

export const dynamic = "force-dynamic";

export default async function WalmartInventoryPage() {
  const { userId, unauthorizedResponse } = await requireSignedInUser();
  if (unauthorizedResponse || !userId) {
    return (
      <WalmartInventoryClient
        products={[]}
        lowStock={[]}
        outOfStock={[]}
        recentChanges={[]}
      />
    );
  }

  const products = await listWalmartProductsForUser(userId);
  const effectiveProducts = mergeProductsWithLatestDrafts({
    products,
    drafts: await listWalmartDraftsForUser(userId),
  });
  const inventory = getInventoryView(effectiveProducts);

  return (
    <WalmartInventoryClient
      products={effectiveProducts}
      lowStock={inventory.lowStock}
      outOfStock={inventory.outOfStock}
      recentChanges={inventory.recentChanges}
    />
  );
}
