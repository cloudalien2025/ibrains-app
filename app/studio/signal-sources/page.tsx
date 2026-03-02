import { headers } from "next/headers";
import LockedBrainView from "@/components/brains/LockedBrainView";
import { isEntitled, resolveUserFromHeaders } from "@/lib/auth/entitlements";
import { brainCatalogById } from "@/lib/brains/brainCatalog";
import StudioSignalSourcesClient from "./studio-signal-sources-client";

export const dynamic = "force-dynamic";

export default async function StudioSignalSourcesPage() {
  const headersList = await headers();
  const user = resolveUserFromHeaders(headersList);
  const entitled = isEntitled(user, "studio");

  if (!entitled) {
    const meta = brainCatalogById.studio;
    return <LockedBrainView title={meta.upsellTitle} message={meta.upsellMessage} ctaLabel="Upgrade" />;
  }

  return (
    <div className="ecomviper-hud min-h-screen text-slate-100">
      <div className="ecomviper-vignette pointer-events-none fixed inset-0" />
      <div className="ecomviper-grid pointer-events-none fixed inset-0 opacity-35" />

      <main className="relative mx-auto max-w-6xl px-6 py-10">
        <StudioSignalSourcesClient />
      </main>
    </div>
  );
}
