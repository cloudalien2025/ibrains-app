import WalmartConnectClient from "@/app/apps/ecomviper/walmart/connect/connect-client";
import { getWalmartConnectionHealth } from "@/lib/ecomviper/walmart/walmart-auth";

export const dynamic = "force-dynamic";

export default function WalmartConnectPage() {
  return <WalmartConnectClient initialHealth={getWalmartConnectionHealth()} />;
}
