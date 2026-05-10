import WalmartProductsClient from "@/app/apps/ecomviper/walmart/products/products-client";
import { requireSignedInUser } from "@/lib/auth/requireSignedInUser";
import { listWalmartDraftsForUser } from "@/lib/ecomviper/walmart/walmart-drafts";
import { listWalmartProductsForUser } from "@/lib/ecomviper/walmart/walmart-products";
import { mergeProductsWithLatestDrafts } from "@/lib/ecomviper/walmart/walmart-product-display";

export const dynamic = "force-dynamic";

export default async function WalmartProductsPage() {
  const { userId, unauthorizedResponse } = await requireSignedInUser();
  if (unauthorizedResponse || !userId) {
    return <WalmartProductsClient products={[]} />;
  }

  const products = await listWalmartProductsForUser(userId);
  const drafts = await listWalmartDraftsForUser(userId);
  const effectiveProducts = mergeProductsWithLatestDrafts({
    products,
    drafts,
  });

  return <WalmartProductsClient products={effectiveProducts} />;
}
