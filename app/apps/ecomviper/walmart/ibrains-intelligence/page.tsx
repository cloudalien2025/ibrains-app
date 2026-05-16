import WalmartIBrainsIntelligenceClient from "@/app/apps/ecomviper/walmart/ibrains-intelligence/walmart-ibrains-intelligence-client";
import { requireSignedInUser } from "@/lib/auth/requireSignedInUser";
import { listWalmartDraftsForUser } from "@/lib/ecomviper/walmart/walmart-drafts";
import { mergeProductsWithLatestDrafts } from "@/lib/ecomviper/walmart/walmart-product-display";
import { listWalmartProductsForUser } from "@/lib/ecomviper/walmart/walmart-products";

export const dynamic = "force-dynamic";

function asArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

export default async function WalmartIBrainsIntelligencePage() {
  const { userId, unauthorizedResponse } = await requireSignedInUser();
  if (unauthorizedResponse || !userId) {
    return <WalmartIBrainsIntelligenceClient products={[]} />;
  }

  let loadError: string | null = null;
  let products = [] as Awaited<ReturnType<typeof listWalmartProductsForUser>>;
  let drafts = [] as Awaited<ReturnType<typeof listWalmartDraftsForUser>>;
  let effectiveProducts = [] as typeof products;

  try {
    products = asArray(await listWalmartProductsForUser(userId));
    effectiveProducts = products;
  } catch (error) {
    console.error("[ecomviper:walmart:ibrains-intelligence] product load failed", {
      message: error instanceof Error ? error.message : "unknown_error",
    });
    loadError = "Could not load Walmart products right now. Please refresh in a moment.";
  }

  if (products.length > 0) {
    try {
      drafts = asArray(await listWalmartDraftsForUser(userId));
    } catch (error) {
      console.error("[ecomviper:walmart:ibrains-intelligence] draft load failed", {
        message: error instanceof Error ? error.message : "unknown_error",
      });
      loadError = "Could not load draft overlays right now. Showing base imported products.";
    }
  }

  if (products.length > 0 && drafts.length > 0) {
    try {
      effectiveProducts = mergeProductsWithLatestDrafts({ products, drafts });
    } catch (error) {
      console.error("[ecomviper:walmart:ibrains-intelligence] draft merge failed", {
        message: error instanceof Error ? error.message : "unknown_error",
      });
      effectiveProducts = products;
      loadError = "Could not apply draft overlays right now. Showing base imported products.";
    }
  }

  return <WalmartIBrainsIntelligenceClient products={effectiveProducts} loadError={loadError} />;
}
