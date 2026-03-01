import { headers } from "next/headers";
import BrainWorkspaceFrame from "@/components/brains/BrainWorkspaceFrame";
import LockedBrainView from "@/components/brains/LockedBrainView";
import { isEntitled, resolveUserFromHeaders } from "@/lib/auth/entitlements";
import { brainCatalogById } from "@/lib/brains/brainCatalog";
import { aiSelectionCopy } from "@/lib/copy/aiSelectionCopy";
import DirectoryIqSettingsClient from "./directoryiq-settings-client";

export const dynamic = "force-dynamic";

export default async function DirectoryIqSettingsPage() {
  const headersList = await headers();
  const user = resolveUserFromHeaders(headersList);

  if (!isEntitled(user, "directoryiq")) {
    const meta = brainCatalogById.directoryiq;
    return <LockedBrainView title={meta.upsellTitle} message={meta.upsellMessage} ctaLabel="Request Access" />;
  }

  return (
    <BrainWorkspaceFrame
      brainLabel="DirectoryIQ"
      subtitle={aiSelectionCopy.directoryiq.shellSubtitle}
      navItems={[
        { href: "/directoryiq", label: "Dashboard" },
        { href: "/directoryiq/listings", label: "Listings" },
        { href: "/directoryiq/listings/321", label: "Authority" },
        { href: "/directoryiq/settings/integrations", label: "Integrations" },
        { href: "/directoryiq/versions", label: "History" },
      ]}
    >
      <DirectoryIqSettingsClient />
    </BrainWorkspaceFrame>
  );
}
