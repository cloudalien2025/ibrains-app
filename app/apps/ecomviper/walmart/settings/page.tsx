import WalmartSettingsClient from "@/app/apps/ecomviper/walmart/settings/settings-client";
import { getWalmartConnectionHealth } from "@/lib/ecomviper/walmart/walmart-auth";
import { getWalmartRuntimeMode } from "@/lib/ecomviper/walmart/walmart-mock-data";

export const dynamic = "force-dynamic";

export default function WalmartSettingsPage() {
  const health = getWalmartConnectionHealth();

  return (
    <WalmartSettingsClient
      mode={getWalmartRuntimeMode()}
      environment={health.summary.environment}
      region={health.summary.region}
    />
  );
}
