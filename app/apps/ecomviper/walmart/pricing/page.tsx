import WalmartPricingClient from "@/app/apps/ecomviper/walmart/pricing/pricing-client";
import { getPricingView } from "@/lib/ecomviper/walmart/walmart-pricing";
import { requireSignedInUser } from "@/lib/auth/requireSignedInUser";
import { mergeProductsWithLatestDrafts } from "@/lib/ecomviper/walmart/walmart-product-display";
import { listWalmartProductsForUser } from "@/lib/ecomviper/walmart/walmart-products";
import { listDraftsForUser } from "@/lib/ecomviper/walmart/walmart-store";

export const dynamic = "force-dynamic";

export default async function WalmartPricingPage() {
  const { userId, unauthorizedResponse } = await requireSignedInUser();
  if (unauthorizedResponse || !userId) {
    return (
      <WalmartPricingClient
        products={[]}
        warnings={[]}
        recentChanges={[]}
      />
    );
  }

  const products = await listWalmartProductsForUser(userId);
  const effectiveProducts = mergeProductsWithLatestDrafts({
    products,
    drafts: listDraftsForUser(userId),
  });
  const pricing = getPricingView(effectiveProducts);
  return (
    <WalmartPricingClient
      products={pricing.products}
      warnings={pricing.validationWarnings}
      recentChanges={pricing.recentChanges}
    />
  );
}
