import Link from "next/link";
import { headers } from "next/headers";
import TopBar from "@/components/ecomviper/TopBar";
import HudCard from "@/components/ecomviper/HudCard";
import BrainWorkspaceFrame from "@/components/brains/BrainWorkspaceFrame";
import LockedBrainView from "@/components/brains/LockedBrainView";
import { isEntitled, resolveUserFromHeaders } from "@/lib/auth/entitlements";
import { brainCatalogById } from "@/lib/brains/brainCatalog";
import { aiSelectionCopy } from "@/lib/copy/aiSelectionCopy";
import { query } from "@/app/api/ecomviper/_utils/db";
import { resolveUserIdFromHeaders } from "@/app/api/ecomviper/_utils/user";

type ListingRow = {
  source_id: string;
  title: string | null;
  url: string | null;
};

export const dynamic = "force-dynamic";

export default async function DirectoryIqListingsPage() {
  const headersList = await headers();
  const user = resolveUserFromHeaders(headersList);
  const userId = resolveUserIdFromHeaders(headersList);

  if (!isEntitled(user, "directoryiq")) {
    const meta = brainCatalogById.directoryiq;
    return <LockedBrainView title={meta.upsellTitle} message={meta.upsellMessage} ctaLabel="Request Access" />;
  }

  const rows = await query<ListingRow>(
    `
    SELECT source_id, title, url
    FROM directoryiq_nodes
    WHERE user_id = $1 AND source_type = 'listing'
    ORDER BY updated_at DESC
    LIMIT 50
    `,
    [userId]
  );

  return (
    <BrainWorkspaceFrame
      brainLabel="DirectoryIQ"
      subtitle={aiSelectionCopy.directoryiq.shellSubtitle}
      navItems={[
        { href: "/directoryiq", label: aiSelectionCopy.directoryiq.nav.dashboard },
        { href: "/directoryiq/listings", label: "Listings" },
        { href: "/directoryiq/signal-sources", label: aiSelectionCopy.directoryiq.nav.signalSources },
      ]}
    >
      <TopBar breadcrumbs={["Home", "DirectoryIQ", "Listings"]} searchPlaceholder="Search listings..." />
      <HudCard title="Select a Listing" subtitle="Choose a listing to continue optimization.">
        {rows.length === 0 ? (
          <div className="text-sm text-slate-300">No listings yet. Return to Dashboard to run analysis.</div>
        ) : (
          <div className="space-y-2">
            {rows.map((row) => (
              <div key={row.source_id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div className="text-sm font-medium text-slate-100">{row.title ?? row.source_id}</div>
                {row.url ? <div className="text-xs text-slate-400">{row.url}</div> : null}
              </div>
            ))}
          </div>
        )}
        <div className="mt-4">
          <Link href="/directoryiq" className="text-sm text-cyan-200 underline">
            Back to Snapshot
          </Link>
        </div>
      </HudCard>
    </BrainWorkspaceFrame>
  );
}
