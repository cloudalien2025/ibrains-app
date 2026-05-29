import Link from "next/link";
import BackToBrainsLink from "@/components/brains/back-to-brains-link";
import { requireSignedInUser } from "@/lib/auth/requireSignedInUser";
import {
  getEcomViperMarketplaceMetrics,
  getEcomViperMarketplaceMetricsForUser,
} from "@/lib/ecomviper/walmart/walmart-products";

export const dynamic = "force-dynamic";

const marketplaceCards = [
  {
    id: "walmart",
    name: "OptiWal",
    status: "Active",
    description: "Connected marketplace manager for listings, drafts, inventory, pricing, and feed workflows.",
    href: "/optiwal",
    actionLabel: "Open OptiWal",
    secondaryLabel: "Connect",
    secondaryHref: "/optiwal/connect",
    disabled: false,
  },
  {
    id: "hub",
    name: "EcomViper Hub",
    status: "Active",
    description:
      "Canonical-first control plane for marketplace feed aggregation, product intelligence graph workflows, routing, and trust-aware operations.",
    href: "/ecomviper/hub",
    actionLabel: "Open Hub",
    disabled: false,
  },
  {
    id: "amazon",
    name: "OptiZon",
    status: "Coming Soon",
    description: "Planned marketplace extension for Amazon catalog and listing operations.",
    href: "/optizon",
    actionLabel: "Coming Soon",
    disabled: true,
  },
  {
    id: "ebay",
    name: "OptiBay",
    status: "Active",
    description: "Phase 1 read-only mock-first dashboard for eBay listing import, optimization scoring, and AI-ready recommendations.",
    href: "/optibay",
    actionLabel: "Open OptiBay",
    disabled: false,
  },
  {
    id: "shopify",
    name: "Shopify Source Catalog",
    status: "Active",
    description: "Connect Shopify store domain + Admin API token, import Shopify products/images, and reconcile Walmart images by SKU/barcode/title.",
    href: "/ecomviper/shopify",
    actionLabel: "Open Shopify",
    disabled: false,
  },
] as const;

function statusClasses(status: string) {
  if (status === "Active") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "Coming Soon") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

export default async function EcomViperDashboardPage() {
  const { userId, unauthorizedResponse } = await requireSignedInUser();
  const metrics =
    !unauthorizedResponse && userId
      ? await getEcomViperMarketplaceMetricsForUser(userId)
      : getEcomViperMarketplaceMetrics();

  const metricCards = [
    { label: "Connected marketplaces", value: metrics.connectedMarketplaces },
    { label: "Products imported", value: metrics.productsImported },
    { label: "Draft changes", value: metrics.draftChanges },
    { label: "Sync/feed errors", value: metrics.syncErrors },
    { label: "Listings needing attention", value: metrics.listingsNeedingAttention },
  ];

  return (
    <main className="ibrains-shell min-h-screen text-[#0F172A]" data-testid="ecomviper-overview-page">
      <div className="mx-auto max-w-[1320px] px-4 py-6 sm:px-6">
        <div className="mb-4 flex items-center justify-between">
          <BackToBrainsLink />
          <div className="inline-flex items-center rounded-full border border-[#D9E4F0] bg-white/90 px-3 py-1 text-xs text-[#475569]">
            EcomViper Brain Console
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[236px_minmax(0,1fr)]">
          <aside
            className="rounded-2xl border border-[#D9E4F0] bg-white/90 p-3 shadow-[0_12px_30px_rgba(15,23,42,0.06)]"
            data-testid="ecomviper-brain-sidebar"
          >
            <div className="mb-3 border-b border-[#E2E8F0] pb-3">
              <p className="text-[11px] uppercase tracking-[0.16em] text-[#64748B]">ECOMVIPER</p>
              <h2 className="mt-1 text-base font-semibold text-[#0F172A]">Marketplace Brain Workspace</h2>
              <p className="mt-1 text-xs text-[#64748B]">
                Coordinate independent commerce brains and channel workspaces from one console.
              </p>
            </div>
            <nav className="grid gap-1" aria-label="EcomViper workspace navigation">
              <Link href="/ecomviper" className="rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-2 text-sm text-[#0F172A]">
                Overview
              </Link>
              <Link href="/optiwal" className="rounded-lg border border-transparent px-3 py-2 text-sm text-[#334155] transition hover:border-[#D9E4F0] hover:bg-white">
                Open OptiWal
              </Link>
              <Link href="/optibay" className="rounded-lg border border-transparent px-3 py-2 text-sm text-[#334155] transition hover:border-[#D9E4F0] hover:bg-white">
                Open OptiBay
              </Link>
              <Link href="/optizon" className="rounded-lg border border-transparent px-3 py-2 text-sm text-[#334155] transition hover:border-[#D9E4F0] hover:bg-white">
                Open OptiZon
              </Link>
              <Link href="/ecomviper/shopify" className="rounded-lg border border-transparent px-3 py-2 text-sm text-[#334155] transition hover:border-[#D9E4F0] hover:bg-white">
                Open Shopify Source
              </Link>
              <Link href="/ecomviper/hub" className="rounded-lg border border-transparent px-3 py-2 text-sm text-[#334155] transition hover:border-[#D9E4F0] hover:bg-white">
                Open Hub
              </Link>
            </nav>
          </aside>

          <section className="space-y-6" data-testid="ecomviper-brain-workspace">
            <section className="rounded-[2rem] border border-[#D9E4F0] bg-white/95 p-8 shadow-[0_24px_56px_rgba(15,23,42,0.08)]">
              <div className="inline-flex rounded-full border border-[#D9E4F0] bg-[#EFF4F9] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#475569]">
                EcomViper
              </div>
              <h1 className="mt-4 text-4xl font-semibold tracking-[-0.03em] text-[#0F172A]">Marketplace Operations Workspace</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[#475569]">
                Manage connections, product edits, draft validation, feed operations, and sync safety workflows across marketplaces.
              </p>
            </section>

            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5" data-testid="ecomviper-overview-metrics">
              {metricCards.map((metric) => (
                <article key={metric.label} className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-4 shadow-[0_14px_32px_rgba(15,23,42,0.06)]">
                  <p className="text-xs uppercase tracking-[0.12em] text-[#64748B]">{metric.label}</p>
                  <p className="mt-2 text-3xl font-semibold text-[#0F172A]">{metric.value}</p>
                </article>
              ))}
            </section>

            <section className="grid gap-5 md:grid-cols-2" data-testid="ecomviper-marketplace-cards">
              {marketplaceCards.map((card) => (
                <article key={card.id} className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-6 shadow-[0_18px_42px_rgba(15,23,42,0.08)]">
                  <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClasses(card.status)}`}>
                    {card.status}
                  </span>
                  <h2 className="mt-4 text-2xl font-semibold tracking-tight text-[#0F172A]">{card.name}</h2>
                  <p className="mt-2 text-sm leading-6 text-[#475569]">{card.description}</p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {card.disabled ? (
                      <span className="inline-flex rounded-full border border-[#D9E4F0] bg-[#F8FAFC] px-4 py-2 text-sm text-[#64748B]">
                        {card.actionLabel}
                      </span>
                    ) : (
                      <Link
                        href={card.href}
                        className="inline-flex rounded-full border border-[#2563EB] bg-[#2563EB] px-4 py-2 text-sm font-medium text-white transition hover:border-[#1D4ED8] hover:bg-[#1D4ED8]"
                      >
                        {card.actionLabel}
                      </Link>
                    )}
                    {"secondaryHref" in card && card.secondaryHref && "secondaryLabel" in card && card.secondaryLabel ? (
                      <Link
                        href={card.secondaryHref}
                        className="inline-flex rounded-full border border-[#D9E4F0] bg-white px-4 py-2 text-sm text-[#0F172A] transition hover:bg-[#F8FBFF]"
                      >
                        {card.secondaryLabel}
                      </Link>
                    ) : null}
                  </div>
                </article>
              ))}
            </section>
          </section>
        </div>
      </div>
    </main>
  );
}
