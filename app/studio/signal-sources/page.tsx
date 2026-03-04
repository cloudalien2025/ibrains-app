import Link from "next/link";
import { headers } from "next/headers";
import LockedBrainView from "@/components/brains/LockedBrainView";
import SignalSourcesPanel from "@/components/signal-sources/SignalSourcesPanel";
import { brainTheme } from "@/components/brain-dock/brainTheme";
import { isEntitled, resolveUserFromHeaders } from "@/lib/auth/entitlements";
import { brainCatalogById } from "@/lib/brains/brainCatalog";
import { studioSignalSources } from "@/lib/copy/signalSourcesCatalog";

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
        <SignalSourcesPanel
          title="Studio Signal Sources"
          subtitle="Studio connectors are configured within Studio only. No cross-brain routing."
          connectors={studioSignalSources}
        />

        <section className={`${brainTheme.glassCard} mt-6 p-6`}>
          <h2 className="text-lg font-semibold text-white">Studio Credential Registry</h2>
          <p id="credentials" className="mt-2 text-sm text-slate-300">
            This registry is Studio-scoped and intentionally separated from EcomViper credential settings in this phase.
          </p>
          <div className="mt-4">
            <Link
              href="/studio"
              className="inline-flex items-center rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-100 transition hover:bg-white/10"
            >
              Back to Studio
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
