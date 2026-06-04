import Link from "next/link";
import {
  hubCanonicalizationQueuePreview,
  hubFeedControlSources,
  hubPublicationReadinessPreview,
} from "@/app/ecomviper/hub/hub-feed-control-content";

function sumReadyProducts(): number {
  return hubFeedControlSources.reduce((total, source) => total + source.productsReadyForHub, 0);
}

function sumReviewProducts(): number {
  return hubFeedControlSources.reduce((total, source) => total + source.productsNeedingReview, 0);
}

function syncedSourceCount(): number {
  return hubFeedControlSources.filter((source) => source.optimizedFeedStatus === "Synced to Hub").length;
}

export default function HubFeedControlCenter() {
  return (
    <section
      id="feed-control-center"
      className="space-y-4 rounded-2xl border border-[#D9E4F0] bg-white/95 p-5 shadow-[0_16px_36px_rgba(15,23,42,0.08)]"
      data-testid="ecomviper-hub-feed-control-center"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#0F172A]">Feed Control Center</h2>
          <p className="mt-2 text-sm text-[#334155]">
            Track optimized marketplace feeds flowing from channel workspaces into private Hub intake for canonicalization, routing readiness, and public visibility approval.
          </p>
          <p className="mt-1 text-xs text-[#64748B]">
            Workflow: Walmart/eBay/Amazon/Shopify optimization → private Hub feed intake → canonicalization → visibility/routing approval → future public publication to `ecomviper.com`.
          </p>
        </div>
        <div className="rounded-lg border border-dashed border-[#D9E4F0] bg-[#F8FBFF] px-3 py-2 text-xs text-[#475569]">
          Static foundation only: no live sync, marketplace APIs, or persistence in this sprint.
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" data-testid="ecomviper-hub-feed-intake-summary">
        <article className="rounded-xl border border-[#E2E8F0] bg-[#F8FBFF] p-3">
          <p className="text-xs uppercase tracking-[0.12em] text-[#64748B]">Feeds Synced To Hub</p>
          <p className="mt-1 text-lg font-semibold text-[#0F172A]">{syncedSourceCount()} / 4</p>
          <p className="mt-1 text-xs text-[#475569]">Demo source-state rollup</p>
        </article>
        <article className="rounded-xl border border-[#E2E8F0] bg-[#F8FBFF] p-3">
          <p className="text-xs uppercase tracking-[0.12em] text-[#64748B]">Products Ready For Hub</p>
          <p className="mt-1 text-lg font-semibold text-[#0F172A]">{sumReadyProducts()}</p>
          <p className="mt-1 text-xs text-[#475569]">Optimized feed records ready for intake</p>
        </article>
        <article className="rounded-xl border border-[#E2E8F0] bg-[#F8FBFF] p-3">
          <p className="text-xs uppercase tracking-[0.12em] text-[#64748B]">Canonicalization Queue</p>
          <p className="mt-1 text-lg font-semibold text-[#0F172A]">{hubCanonicalizationQueuePreview.length}</p>
          <p className="mt-1 text-xs text-[#475569]">Demo canonical merge review items</p>
        </article>
        <article className="rounded-xl border border-[#E2E8F0] bg-[#F8FBFF] p-3">
          <p className="text-xs uppercase tracking-[0.12em] text-[#64748B]">Needs Review</p>
          <p className="mt-1 text-lg font-semibold text-[#0F172A]">{sumReviewProducts()}</p>
          <p className="mt-1 text-xs text-[#475569]">Trust, merge, or publication review required</p>
        </article>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[#E2E8F0]" data-testid="ecomviper-hub-feed-sources-table">
        <table className="min-w-full text-sm">
          <thead className="bg-[#F8FBFF] text-left text-xs uppercase tracking-[0.1em] text-[#64748B]">
            <tr>
              <th className="px-3 py-2">Source</th>
              <th className="px-3 py-2">Feed Status</th>
              <th className="px-3 py-2">Products Ready</th>
              <th className="px-3 py-2">Needs Review</th>
              <th className="px-3 py-2">Canonicalization</th>
              <th className="px-3 py-2">Publication</th>
              <th className="px-3 py-2">Routing</th>
              <th className="px-3 py-2">Trust</th>
              <th className="px-3 py-2">Next Action</th>
            </tr>
          </thead>
          <tbody>
            {hubFeedControlSources.map((source) => (
              <tr key={source.sourceLabel} className="border-t border-[#E2E8F0] align-top text-[#334155]">
                <td className="px-3 py-2">
                  <p className="font-medium text-[#0F172A]">{source.sourceLabel}</p>
                  <p className="mt-1 text-xs text-[#64748B]">{source.marketplace}</p>
                  <Link href={source.sourceRoute} className="mt-1 inline-block text-xs text-[#2563EB] hover:text-[#1D4ED8]">
                    {source.sourceRoute}
                  </Link>
                  <p className="mt-1 text-xs text-[#64748B]">{source.lastSyncStatus}</p>
                </td>
                <td className="px-3 py-2">{source.optimizedFeedStatus}</td>
                <td className="px-3 py-2">{source.productsReadyForHub}</td>
                <td className="px-3 py-2">{source.productsNeedingReview}</td>
                <td className="px-3 py-2">{source.canonicalizationReadiness}</td>
                <td className="px-3 py-2">{source.publicationEligibility}</td>
                <td className="px-3 py-2">{source.routingReadiness}</td>
                <td className="px-3 py-2">{source.trustComplianceReview}</td>
                <td className="px-3 py-2">{source.nextAction}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <article className="rounded-xl border border-[#E2E8F0] bg-[#F8FBFF] p-4" data-testid="ecomviper-hub-canonicalization-queue-preview">
          <h3 className="text-sm font-semibold text-[#0F172A]">Canonicalization Queue Preview</h3>
          <ul className="mt-2 space-y-2">
            {hubCanonicalizationQueuePreview.map((item) => (
              <li key={item.canonicalProduct} className="rounded-lg border border-[#D9E4F0] bg-white p-3 text-sm text-[#334155]">
                <p className="font-medium text-[#0F172A]">{item.canonicalProduct}</p>
                <p className="mt-1 text-xs text-[#64748B]">Sources: {item.sourceMarketplaces}</p>
                <p className="mt-1 text-xs text-[#475569]">Status: {item.status}</p>
                <p className="mt-1 text-xs text-[#475569]">Next: {item.operatorAction}</p>
              </li>
            ))}
          </ul>
        </article>

        <article className="rounded-xl border border-[#E2E8F0] bg-[#F8FBFF] p-4" data-testid="ecomviper-hub-publication-readiness-preview">
          <h3 className="text-sm font-semibold text-[#0F172A]">Publication Readiness Preview</h3>
          <p className="mt-2 text-xs text-[#64748B]">
            Private Hub approval controls determine what can eventually publish to the public Hub surface at `ecomviper.com`.
          </p>
          <ul className="mt-2 space-y-2">
            {hubPublicationReadinessPreview.map((item) => (
              <li key={item.label} className="rounded-lg border border-[#D9E4F0] bg-white p-3 text-sm text-[#334155]">
                <p className="text-xs uppercase tracking-[0.12em] text-[#64748B]">{item.label}</p>
                <p className="mt-1 text-lg font-semibold text-[#0F172A]">{item.value}</p>
                <p className="mt-1 text-xs text-[#475569]">{item.detail}</p>
              </li>
            ))}
          </ul>
        </article>
      </div>
    </section>
  );
}
