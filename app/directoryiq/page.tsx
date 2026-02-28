import { headers } from "next/headers";
import BrainWorkspaceFrame from "@/components/brains/BrainWorkspaceFrame";
import LockedBrainView from "@/components/brains/LockedBrainView";
import { isEntitled, resolveUserFromHeaders } from "@/lib/auth/entitlements";
import { brainCatalogById } from "@/lib/brains/brainCatalog";
import { aiSelectionCopy } from "@/lib/copy/aiSelectionCopy";
import DirectoryIqDashboardClient from "./directoryiq-dashboard-client";

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
      <DirectoryIqDashboardClient userLabel={userLabel} />
    </BrainWorkspaceFrame>
  );
}
