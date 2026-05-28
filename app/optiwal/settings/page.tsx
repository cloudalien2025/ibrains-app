import WalmartSettingsClient from "@/app/optiwal/settings/settings-client";
import { getWalmartConnectionHealth } from "@/lib/ecomviper/walmart/walmart-auth";

export const dynamic = "force-dynamic";

export default function WalmartSettingsPage() {
  const health = getWalmartConnectionHealth();

  return (
    <WalmartSettingsClient
      environment={health.summary.environment}
      region={health.summary.region}
    />
  );
}
