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

  let loadError: string | null = null;
  let products = [] as Awaited<ReturnType<typeof listWalmartProductsForUser>>;
  let drafts = [] as Awaited<ReturnType<typeof listWalmartDraftsForUser>>;
  let effectiveProducts = [] as typeof products;

  try {
    products = await listWalmartProductsForUser(userId);
    effectiveProducts = products;
  } catch (error) {
    console.error("[ecomviper:walmart:products-page] product load failed", {
      message: error instanceof Error ? error.message : "unknown_error",
    });
    loadError = "Could not load Walmart products right now. Please refresh in a moment.";
  }

  if (products.length > 0) {
    try {
      drafts = await listWalmartDraftsForUser(userId);
    } catch (error) {
      console.error("[ecomviper:walmart:products-page] draft load failed", {
        message: error instanceof Error ? error.message : "unknown_error",
      });
      loadError = "Could not load draft overlays right now. Showing base imported products.";
    }
  }

  if (products.length > 0 && drafts.length > 0) {
    try {
      effectiveProducts = mergeProductsWithLatestDrafts({
        products,
        drafts,
      });
    } catch (error) {
      console.error("[ecomviper:walmart:products-page] draft merge failed", {
        message: error instanceof Error ? error.message : "unknown_error",
      });
      effectiveProducts = products;
      loadError = "Could not apply draft overlays right now. Showing base imported products.";
    }
  }

  return <WalmartProductsClient products={effectiveProducts} loadError={loadError} />;
}
