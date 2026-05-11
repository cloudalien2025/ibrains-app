import EbayDashboardClient from "@/app/apps/ecomviper/ebay/ebay-dashboard-client";
import { resolveEbayDashboardConnectionSummary } from "@/lib/ecomviper/ebay/ebay-inventory-provider";

export const dynamic = "force-dynamic";

export default function EcomViperEbayDashboardPage() {
  const connection = resolveEbayDashboardConnectionSummary();
  return <EbayDashboardClient connection={connection} />;
}
