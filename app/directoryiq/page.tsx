import { headers } from "next/headers";
import HudCard from "@/components/ecomviper/HudCard";
import NeonButton from "@/components/ecomviper/NeonButton";
import TopBar from "@/components/ecomviper/TopBar";
import BrainWorkspaceFrame from "@/components/brains/BrainWorkspaceFrame";
import LockedBrainView from "@/components/brains/LockedBrainView";
import SignalSourcesPanel from "@/components/signal-sources/SignalSourcesPanel";
import { isEntitled, resolveUserFromHeaders } from "@/lib/auth/entitlements";
import { brainCatalogById } from "@/lib/brains/brainCatalog";
import { aiSelectionCopy } from "@/lib/copy/aiSelectionCopy";
import { directoryIqSignalSources } from "@/lib/copy/signalSourcesCatalog";

export const dynamic = "force-dynamic";

export default async function DirectoryIQPage() {
  const headersList = await headers();
  const user = resolveUserFromHeaders(headersList);
  const entitled = isEntitled(user, "directoryiq");

  if (!entitled) {
    const meta = brainCatalogById.directoryiq;
    return <LockedBrainView title={meta.upsellTitle} message={meta.upsellMessage} ctaLabel="Request Access" />;
  }

  const userLabel = typeof user.name === "string" && user.name.trim().length > 0 ? user.name : "Operator";

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
        breadcrumbs={["Home", "DirectoryIQ", "AI Travel Selection Engine"]}
        searchPlaceholder="Search travel entity, surface, or authority blueprint..."
        userLabel={userLabel}
      />

      <HudCard title={aiSelectionCopy.directoryiq.pageTitle} subtitle={aiSelectionCopy.directoryiq.pageSubtitle}>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
            <div className="text-xs uppercase tracking-[0.14em] text-slate-400">Entity Readiness</div>
            <div className="mt-2 text-2xl font-semibold text-cyan-100">Stub</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
            <div className="text-xs uppercase tracking-[0.14em] text-slate-400">Selection Confidence</div>
            <div className="mt-2 text-2xl font-semibold text-cyan-100">Stub</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
            <div className="text-xs uppercase tracking-[0.14em] text-slate-400">Authority Blueprint</div>
            <div className="mt-2 text-2xl font-semibold text-cyan-100">Stub</div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <NeonButton disabled>Open Entity Surfaces</NeonButton>
          <NeonButton variant="secondary" disabled>
            Review Authority Coverage
          </NeonButton>
        </div>
      </HudCard>

      <div id="signal-sources">
        <SignalSourcesPanel
          title="DirectoryIQ Signal Sources"
          subtitle="Connector scaffolding for travel entity selection signals. No ingestion logic changes are included in this release."
          connectors={directoryIqSignalSources}
        />
      </div>
    </BrainWorkspaceFrame>
  );
}
