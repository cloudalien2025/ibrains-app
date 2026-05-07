import "server-only";

import { checkFeedStatus, listFeeds, submitMaintenanceFeed } from "@/lib/ecomviper/walmart/walmart-mock-data";

export function submitWalmartMaintenanceFeed(payload: unknown) {
  return submitMaintenanceFeed(payload);
}

export function listWalmartFeedSubmissions() {
  return listFeeds();
}

export function getWalmartFeedStatus(feedId: string) {
  return checkFeedStatus(feedId);
}
