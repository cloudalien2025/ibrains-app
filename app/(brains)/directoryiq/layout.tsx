import type { ReactNode } from "react";
import { headers } from "next/headers";
import BrainWorkspaceFrame from "@/components/brains/BrainWorkspaceFrame";
import LockedBrainView from "@/components/brains/LockedBrainView";
import { isEntitled, resolveUserFromHeaders } from "@/lib/auth/entitlements";
import { brainCatalogById } from "@/lib/brains/brainCatalog";
import { aiSelectionCopy } from "@/lib/copy/aiSelectionCopy";

const navItems = [
  { href: "/directoryiq", label: "Dashboard" },
  { href: "/directoryiq/listings", label: "Listings" },
  { href: "/directoryiq/authority", label: "Authority" },
  { href: "/directoryiq/signal-sources", label: "Signal Sources" },
  { href: "/directoryiq/versions", label: "History" },
];

export default async function DirectoryIqLayout({ children }: { children: ReactNode }) {
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
      navItems={navItems}
    >
      {children}
    </BrainWorkspaceFrame>
  );
}
