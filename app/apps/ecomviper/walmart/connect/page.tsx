import WalmartConnectClient from "@/app/apps/ecomviper/walmart/connect/connect-client";
import { requireSignedInUser } from "@/lib/auth/requireSignedInUser";
import {
  getWalmartConnectionHealth,
  getWalmartConnectionHealthForUser,
} from "@/lib/ecomviper/walmart/walmart-auth";

export const dynamic = "force-dynamic";

export default async function WalmartConnectPage() {
  let initialHealth = getWalmartConnectionHealth();

  try {
    const { userId, unauthorizedResponse } = await requireSignedInUser();
    if (!unauthorizedResponse && userId) {
      initialHealth = await getWalmartConnectionHealthForUser(userId);
    }
  } catch {
    // Fall back to default snapshot so the page remains usable if auth is unavailable.
  }

  return <WalmartConnectClient initialHealth={initialHealth} />;
}
