import WalmartFeedsClient from "@/app/apps/ecomviper/walmart/feeds/feeds-client";
import { listWalmartFeedSubmissions } from "@/lib/ecomviper/walmart/walmart-feeds";
import { getWalmartRuntimeMode } from "@/lib/ecomviper/walmart/walmart-mock-data";

export const dynamic = "force-dynamic";

export default function WalmartFeedsPage() {
  return <WalmartFeedsClient initialFeeds={listWalmartFeedSubmissions()} mode={getWalmartRuntimeMode()} />;
}
