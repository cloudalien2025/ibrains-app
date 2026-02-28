import HudCard from "@/components/ecomviper/HudCard";
import NeonButton from "@/components/ecomviper/NeonButton";
import TopBar from "@/components/ecomviper/TopBar";
import Link from "next/link";
import { aiSelectionCopy } from "@/lib/copy/aiSelectionCopy";

export const dynamic = "force-dynamic";

export default function EcomViperDashboardPage() {
  return (
    <>
      <TopBar
        breadcrumbs={["Home", "EcomViper", "AI Product Selection Engine"]}
        searchPlaceholder="Search product entity, signal, or selection blueprint..."
        userLabel="Ariel Viper"
      />

      <HudCard
        title={aiSelectionCopy.ecomviper.dashboardTitle}
        subtitle={aiSelectionCopy.ecomviper.dashboardSubtitle}
      >
        <div className="space-y-4 rounded-xl border border-dashed border-cyan-300/25 bg-cyan-400/5 p-8 text-sm text-slate-300">
          <p>
            Connect signal sources, register credentials, and open selection hubs for product mention readiness.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href="/ecomviper/settings/integrations">
              <NeonButton>Open Signal Sources</NeonButton>
            </Link>
            <Link href="/ecomviper/help/connect-shopify">
              <NeonButton variant="secondary">Connection Guide</NeonButton>
            </Link>
          </div>
        </div>
      </HudCard>
    </>
  );
}
