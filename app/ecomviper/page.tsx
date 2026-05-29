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
    id: "shopify",
    name: "Shopify Source Catalog",
    status: "Active",
    description: "Connect Shopify store domain + Admin API token, import Shopify products/images, and reconcile Walmart images by SKU/barcode/title.",
    href: "/ecomviper/shopify",
    actionLabel: "Open Shopify Source",
    disabled: false,
  },
  {
    id: "products",
    name: "Products",
    status: "Active",
    description: "Track imported products, readiness posture, and product-level intelligence from one EcomViper workspace.",
    href: "#products",
    actionLabel: "View Products",
    disabled: false,
  },
  {
    id: "hub",
    name: "Hub",
    status: "Active",
    description:
      "Operate canonical feed and routing workflows in EcomViper Hub with approval-aware controls and operational visibility.",
    href: "/ecomviper/hub",
    actionLabel: "Open Hub",
    disabled: false,
  },
  {
    id: "feed-operations",
    name: "Feed Operations",
    status: "Active",
    description: "Monitor sync health, import exceptions, and draft validation posture before publishing channel changes.",
    href: "#feed-operations",
    actionLabel: "Open Feed Operations",
    disabled: false,
  },
  {
    id: "product-intelligence",
    name: "Product Intelligence",
    status: "Active",
    description: "Review AI commerce visibility, catalog readiness, and recommendation coverage by product and feed segment.",
    href: "#product-intelligence",
    actionLabel: "Open Product Intelligence",
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
                Manage EcomViper product intelligence, Shopify source imports, feed operations, and sync safety from one console.
              </p>
            </div>
            <nav className="grid gap-1" aria-label="EcomViper workspace navigation">
              <Link href="/ecomviper" className="rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-2 text-sm text-[#0F172A]">
                Overview
              </Link>
              <Link href="#products" className="rounded-lg border border-transparent px-3 py-2 text-sm text-[#334155] transition hover:border-[#D9E4F0] hover:bg-white">
                Products
              </Link>
              <Link href="/ecomviper/shopify" className="rounded-lg border border-transparent px-3 py-2 text-sm text-[#334155] transition hover:border-[#D9E4F0] hover:bg-white">
                Shopify Source
              </Link>
              <Link href="/ecomviper/hub" className="rounded-lg border border-transparent px-3 py-2 text-sm text-[#334155] transition hover:border-[#D9E4F0] hover:bg-white">
                Hub
              </Link>
              <Link href="#product-intelligence" className="rounded-lg border border-transparent px-3 py-2 text-sm text-[#334155] transition hover:border-[#D9E4F0] hover:bg-white">
                Product Intelligence
              </Link>
              <Link href="#feed-operations" className="rounded-lg border border-transparent px-3 py-2 text-sm text-[#334155] transition hover:border-[#D9E4F0] hover:bg-white">
                Feed Operations
              </Link>
              <Link href="#drafts" className="rounded-lg border border-transparent px-3 py-2 text-sm text-[#334155] transition hover:border-[#D9E4F0] hover:bg-white">
                Drafts
              </Link>
              <Link href="#settings" className="rounded-lg border border-transparent px-3 py-2 text-sm text-[#334155] transition hover:border-[#D9E4F0] hover:bg-white">
                Settings
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
                Manage EcomViper products, Shopify source imports, draft validation, feed operations, and sync safety from one standalone brain console.
              </p>
              <p className="mt-2 text-sm text-[#475569]">
                Other commerce brains are available from{" "}
                <Link href="/brains" className="font-medium text-[#2563EB] hover:text-[#1D4ED8]">
                  My Brains
                </Link>
                .
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
                  </div>
                </article>
              ))}
            </section>

            <section id="products" className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-6 shadow-[0_18px_42px_rgba(15,23,42,0.06)]">
              <h2 className="text-xl font-semibold text-[#0F172A]">Products</h2>
              <p className="mt-2 text-sm text-[#475569]">
                Source catalog imports, product readiness checks, and SKU-level signal quality for EcomViper operations.
              </p>
            </section>

            <section
              id="product-intelligence"
              className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-6 shadow-[0_18px_42px_rgba(15,23,42,0.06)]"
            >
              <h2 className="text-xl font-semibold text-[#0F172A]">Product Intelligence</h2>
              <p className="mt-2 text-sm text-[#475569]">
                AI commerce visibility posture, attribute coverage, and recommendation confidence for product publishing decisions.
              </p>
            </section>

            <section id="feed-operations" className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-6 shadow-[0_18px_42px_rgba(15,23,42,0.06)]">
              <h2 className="text-xl font-semibold text-[#0F172A]">Feed Operations</h2>
              <p className="mt-2 text-sm text-[#475569]">
                Sync safety checks, ingestion exception visibility, and feed-health workflows to keep product changes stable.
              </p>
            </section>

            <section id="drafts" className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-6 shadow-[0_18px_42px_rgba(15,23,42,0.06)]">
              <h2 className="text-xl font-semibold text-[#0F172A]">Drafts</h2>
              <p className="mt-2 text-sm text-[#475569]">
                Draft readiness and validation checkpoints to ensure content quality before channel publishing.
              </p>
            </section>

            <section id="settings" className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-6 shadow-[0_18px_42px_rgba(15,23,42,0.06)]">
              <h2 className="text-xl font-semibold text-[#0F172A]">Settings</h2>
              <p className="mt-2 text-sm text-[#475569]">
                Configure workspace defaults and operational guardrails for EcomViper-specific product and feed workflows.
              </p>
            </section>
          </section>
        </div>
      </div>
    </main>
  );
}
