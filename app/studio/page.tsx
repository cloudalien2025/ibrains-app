import { headers } from "next/headers";
import Link from "next/link";
import { Clapperboard, FileText, MicVocal, Scissors, Send } from "lucide-react";
import LockedBrainView from "@/components/brains/LockedBrainView";
import { brainTheme } from "@/components/brain-dock/brainTheme";
import SignalSourcesPanel from "@/components/signal-sources/SignalSourcesPanel";
import { isEntitled, resolveUserFromHeaders } from "@/lib/auth/entitlements";
import { brainCatalogById } from "@/lib/brains/brainCatalog";
import { aiSelectionCopy } from "@/lib/copy/aiSelectionCopy";
import { studioSignalSources } from "@/lib/copy/signalSourcesCatalog";

export const dynamic = "force-dynamic";

const studioTiles = [
  { title: "Podcast", description: "Increase mention probability with structured episode evidence.", icon: MicVocal },
  { title: "Video", description: "Build AI-legible narrative arcs with clear evidence density.", icon: Clapperboard },
  { title: "Scripts", description: "Draft scripts optimized for consistency across channels.", icon: FileText },
  { title: "Clips", description: "Extract reusable highlights with strong claim legibility.", icon: Scissors },
  { title: "Publishing", description: "Coordinate channels for persistent narrative consistency.", icon: Send },
];

export default async function StudioPage() {
  const headersList = await headers();
  const user = resolveUserFromHeaders(headersList);
  const entitled = isEntitled(user, "studio");

  if (!entitled) {
    const meta = brainCatalogById.studio;
    return <LockedBrainView title={meta.upsellTitle} message={meta.upsellMessage} ctaLabel="Upgrade" />;
  }

  return (
    <div className="ecomviper-hud min-h-screen text-[#0F172A]">
      <div className="ecomviper-vignette pointer-events-none fixed inset-0" />
      <div className="ecomviper-grid pointer-events-none fixed inset-0 opacity-35" />

      <main className="relative mx-auto max-w-6xl px-6 py-10">
        <section className={`${brainTheme.glassCard} p-6`}>
          <div className="text-xs uppercase tracking-[0.2em] text-[#2563EB]">Studio</div>
          <h1 className="mt-2 text-3xl font-semibold text-[#0F172A]">{aiSelectionCopy.studio.title}</h1>
          <p className="mt-2 max-w-3xl text-sm text-[#334155]">{aiSelectionCopy.studio.subtitle}</p>
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {studioTiles.map((tile) => {
            const Icon = tile.icon;
            return (
              <article key={tile.title} className={`${brainTheme.glassCard} p-5`}>
                <div className="inline-flex rounded-xl border border-[#22D3EE]/35 bg-[#22D3EE]/12 p-2">
                  <Icon className="h-5 w-5 text-[#2563EB]" />
                </div>
                <h2 className="mt-3 text-lg font-semibold text-[#0F172A]">{tile.title}</h2>
                <p className="mt-2 text-sm text-[#334155]">{tile.description}</p>
              </article>
            );
          })}
        </section>

        <section className={`${brainTheme.glassCard} mt-6 p-6`}>
          <h2 className="text-lg font-semibold text-[#0F172A]">Domara Property Video Engine</h2>
          <p className="mt-2 text-sm text-[#334155]">
            Transform European property listings into premium YouTube-ready real-estate videos with a mock-first
            listing-to-storyboard workflow for Expat AI.
          </p>
          <div className="mt-4">
            <Link href="/apps/studio" className={`${brainTheme.glowButton} text-sm`}>
              Open Domara in Apps Studio
            </Link>
          </div>
        </section>

        <section id="signal-sources" className="mt-6">
          <SignalSourcesPanel
            title="Studio Signal Sources"
            subtitle="Connector scaffolding for AI Narrative Selection Index inputs. Actions are UI-only in this release."
            connectors={studioSignalSources}
          />
          <div className="mt-4">
            <Link
              href="/studio/signal-sources"
              className={`${brainTheme.secondaryButton} text-sm`}
            >
              Open Studio Signal Source Settings
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
