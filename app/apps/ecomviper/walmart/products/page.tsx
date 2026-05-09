import WalmartProductsClient from "@/app/apps/ecomviper/walmart/products/products-client";
import { requireSignedInUser } from "@/lib/auth/requireSignedInUser";
import { listWalmartProductsForUser } from "@/lib/ecomviper/walmart/walmart-products";

export const dynamic = "force-dynamic";

export default async function WalmartProductsPage() {
  const { userId, unauthorizedResponse } = await requireSignedInUser();
  if (unauthorizedResponse || !userId) {
    return <WalmartProductsClient products={[]} />;
  }

  const products = await listWalmartProductsForUser(userId);
  return <WalmartProductsClient products={products} />;
}
