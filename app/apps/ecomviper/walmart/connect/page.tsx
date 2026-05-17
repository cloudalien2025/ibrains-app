import WalmartConnectClient from "@/app/apps/ecomviper/walmart/connect/connect-client";
import { requireSignedInUser } from "@/lib/auth/requireSignedInUser";
import {
  getWalmartConnectionHealth,
  getWalmartConnectionHealthForUser,
} from "@/lib/ecomviper/walmart/walmart-auth";
import { listWalmartNetworkConnectionsForUser } from "@/lib/ecomviper/walmart/walmart-network-connections-repository";
import type { WalmartNetworkConnection } from "@/lib/ecomviper/walmart/walmart-network-connections";

export const dynamic = "force-dynamic";

export default async function WalmartConnectPage() {
  let initialHealth = getWalmartConnectionHealth();
  let initialNetworkConnections: WalmartNetworkConnection[] = [];

  try {
    const { userId, unauthorizedResponse } = await requireSignedInUser();
    if (!unauthorizedResponse && userId) {
      initialHealth = await getWalmartConnectionHealthForUser(userId);
      initialNetworkConnections = await listWalmartNetworkConnectionsForUser(userId);
    }
  } catch {
    // Fall back to default snapshot so the page remains usable if auth is unavailable.
  }

  return (
    <WalmartConnectClient
      initialHealth={initialHealth}
      initialNetworkConnections={initialNetworkConnections}
    />
  );
}
