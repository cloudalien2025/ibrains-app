import WalmartPricingClient from "@/app/apps/ecomviper/walmart/pricing/pricing-client";
import { getPricingView } from "@/lib/ecomviper/walmart/walmart-pricing";
import { getWalmartRuntimeMode } from "@/lib/ecomviper/walmart/walmart-mock-data";

export const dynamic = "force-dynamic";

export default function WalmartPricingPage() {
  const pricing = getPricingView();
  return (
    <WalmartPricingClient
      products={pricing.products}
      warnings={pricing.validationWarnings}
      recentChanges={pricing.recentChanges}
      mode={getWalmartRuntimeMode()}
    />
  );
}
