import { headers } from "next/headers";
import BrainWorkspaceFrame from "@/components/brains/BrainWorkspaceFrame";
import LockedBrainView from "@/components/brains/LockedBrainView";
import { isEntitled, resolveUserFromHeaders } from "@/lib/auth/entitlements";
import { brainCatalogById } from "@/lib/brains/brainCatalog";
import { aiSelectionCopy } from "@/lib/copy/aiSelectionCopy";
import DirectoryIqVersionsClient from "./directoryiq-versions-client";

export const dynamic = "force-dynamic";

export default async function DirectoryIqVersionsPage() {
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
        { href: "/directoryiq/authority-support", label: "Authority" },
        { href: "/directoryiq/settings/integrations", label: "Integrations" },
        { href: "/directoryiq/versions", label: "History" },
      ]}
    >
      <DirectoryIqVersionsClient />
    </BrainWorkspaceFrame>
  );
}
