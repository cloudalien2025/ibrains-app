import WalmartFeedsClient from "@/app/optiwal/feeds/feeds-client";
import { listWalmartFeedSubmissions } from "@/lib/ecomviper/walmart/walmart-feeds";

export const dynamic = "force-dynamic";

export default function WalmartFeedsPage() {
  return <WalmartFeedsClient initialFeeds={listWalmartFeedSubmissions()} />;
}
