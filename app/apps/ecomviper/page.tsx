import Link from "next/link";
import { requireSignedInUser } from "@/lib/auth/requireSignedInUser";
import {
  getEcomViperMarketplaceMetrics,
  getEcomViperMarketplaceMetricsForUser,
} from "@/lib/ecomviper/walmart/walmart-products";

export const dynamic = "force-dynamic";

const marketplaceCards = [
  {
    id: "walmart",
    name: "Walmart",
    status: "Active",
    description: "Connected marketplace manager for listings, drafts, inventory, pricing, and feed workflows.",
    href: "/apps/ecomviper/walmart",
    actionLabel: "Open Walmart",
    secondaryLabel: "Connect",
    secondaryHref: "/apps/ecomviper/walmart/connect",
    disabled: false,
  },
  {
    id: "hub",
    name: "EcomViper Hub",
    status: "Active",
    description:
      "Canonical-first control plane for marketplace feed aggregation, product intelligence graph workflows, routing, and trust-aware operations.",
    href: "/apps/ecomviper/hub",
    actionLabel: "Open Hub",
    disabled: false,
  },
  {
    id: "amazon",
    name: "Amazon",
    status: "Coming Soon",
    description: "Planned marketplace extension for Amazon catalog and listing operations.",
    href: "/apps/ecomviper/amazon",
    actionLabel: "Coming Soon",
    disabled: true,
  },
  {
    id: "ebay",
    name: "eBay",
    status: "Active",
    description: "Phase 1 read-only mock-first dashboard for eBay listing import, optimization scoring, and AI-ready recommendations.",
    href: "/apps/ecomviper/ebay",
    actionLabel: "Open eBay",
    disabled: false,
  },
  {
    id: "shopify",
    name: "Shopify Source Catalog",
    status: "Active",
    description: "Connect Shopify store domain + Admin API token, import Shopify products/images, and reconcile Walmart images by SKU/barcode/title.",
    href: "/apps/ecomviper/shopify",
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
    <main className="mx-auto max-w-7xl px-6 py-10" data-testid="ecomviper-overview-page">
      <section className="rounded-[2rem] border border-[#D9E4F0] bg-white/95 p-8 shadow-[0_24px_56px_rgba(15,23,42,0.08)]">
        <div className="inline-flex rounded-full border border-[#D9E4F0] bg-[#EFF4F9] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#475569]">
          EcomViper
        </div>
        <h1 className="mt-4 text-4xl font-semibold tracking-[-0.03em] text-[#0F172A]">Marketplace Operations Workspace</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[#475569]">
          Manage connections, product edits, draft validation, feed operations, and sync safety workflows across marketplaces.
        </p>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5" data-testid="ecomviper-overview-metrics">
        {metricCards.map((metric) => (
          <article key={metric.label} className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-4 shadow-[0_14px_32px_rgba(15,23,42,0.06)]">
            <p className="text-xs uppercase tracking-[0.12em] text-[#64748B]">{metric.label}</p>
            <p className="mt-2 text-3xl font-semibold text-[#0F172A]">{metric.value}</p>
          </article>
        ))}
      </section>

      <section className="mt-6 grid gap-5 md:grid-cols-2" data-testid="ecomviper-marketplace-cards">
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
    </main>
  );
}
