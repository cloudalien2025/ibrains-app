import Link from "next/link";
import { headers } from "next/headers";
import HudCard from "@/components/ecomviper/HudCard";
import TopBar from "@/components/ecomviper/TopBar";
import BrainWorkspaceFrame from "@/components/brains/BrainWorkspaceFrame";
import LockedBrainView from "@/components/brains/LockedBrainView";
import SignalSourcesPanel from "@/components/signal-sources/SignalSourcesPanel";
import { isEntitled, resolveUserFromHeaders } from "@/lib/auth/entitlements";
import { brainCatalogById } from "@/lib/brains/brainCatalog";
import { aiSelectionCopy } from "@/lib/copy/aiSelectionCopy";
import { directoryIqSignalSources } from "@/lib/copy/signalSourcesCatalog";
import DirectoryIqSignalSourcesClient from "./directoryiq-signal-sources-client";
import { query } from "@/app/api/ecomviper/_utils/db";
import { resolveUserIdFromHeaders } from "@/app/api/ecomviper/_utils/user";

type ConnectorRow = {
  connector_id: string;
};

export const dynamic = "force-dynamic";

export default async function DirectoryIQSignalSourcesPage() {
  const headersList = await headers();
  const user = resolveUserFromHeaders(headersList);
  const userId = resolveUserIdFromHeaders(headersList);
  const entitled = isEntitled(user, "directoryiq");

  if (!entitled) {
    const meta = brainCatalogById.directoryiq;
    return <LockedBrainView title={meta.upsellTitle} message={meta.upsellMessage} ctaLabel="Request Access" />;
  }

  const userLabel = typeof user.name === "string" && user.name.trim().length > 0 ? user.name : "Operator";
  const connectedRows = await query<ConnectorRow>(
    `SELECT connector_id FROM directoryiq_signal_source_credentials WHERE user_id = $1`,
    [userId]
  );
  const connectedIds = new Set(connectedRows.map((row) => row.connector_id));
  const panelConnectors = directoryIqSignalSources.map((connector) => {
    const mapToConnectorId =
      connector.id === "brilliant-directories"
        ? "brilliant_directories_api"
        : connector.id === "openai" || connector.id === "serpapi" || connector.id === "ga4"
          ? connector.id
          : null;

    if (!mapToConnectorId || !connectedIds.has(mapToConnectorId)) return connector;

    return {
      ...connector,
      status: "connected" as const,
      actionLabel: "Configured",
    };
  });

  return (
    <BrainWorkspaceFrame
      brainLabel="DirectoryIQ"
      subtitle={aiSelectionCopy.directoryiq.shellSubtitle}
      navItems={[
        { href: "/directoryiq", label: aiSelectionCopy.directoryiq.nav.dashboard },
        { href: "/directoryiq?panel=surfaces", label: aiSelectionCopy.directoryiq.nav.surfaces },
        { href: "/directoryiq?panel=coverage", label: aiSelectionCopy.directoryiq.nav.coverage },
        { href: "/directoryiq/signal-sources", label: aiSelectionCopy.directoryiq.nav.signalSources },
      ]}
    >
      <TopBar
        breadcrumbs={["Home", "DirectoryIQ", "Signal Sources"]}
        searchPlaceholder="Search connector or signal source..."
        userLabel={userLabel}
      />

      <SignalSourcesPanel
        title="DirectoryIQ Signal Sources"
        subtitle="DirectoryIQ connectors are configured within this brain only. No cross-brain routing."
        connectors={panelConnectors}
      />

      <HudCard
        title="Connector Credentials"
        subtitle="DirectoryIQ credentials are stored server-side per user with masked reload status."
      >
        <DirectoryIqSignalSourcesClient />
        <div className="mt-4">
          <Link
            href="/directoryiq"
            className="inline-flex items-center rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-100 transition hover:bg-white/10"
          >
            Back to DirectoryIQ
          </Link>
        </div>
      </HudCard>
    </BrainWorkspaceFrame>
  );
}
