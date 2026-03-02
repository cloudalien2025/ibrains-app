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

  return (
    <BrainWorkspaceFrame
      brainLabel="DirectoryIQ"
      subtitle={aiSelectionCopy.directoryiq.shellSubtitle}
      navItems={[
        { href: "/directoryiq", label: "Dashboard" },
        { href: "/directoryiq/authority-network", label: "Authority Network" },
        { href: "/directoryiq/listings", label: "Listings" },
        { href: "/directoryiq/listings/321", label: "Authority" },
        { href: "/directoryiq/settings/integrations", label: "Integrations" },
        { href: "/directoryiq/versions", label: "History" },
      ]}
    >
      <DirectoryIqDashboardClient />
    </BrainWorkspaceFrame>
  );
}
