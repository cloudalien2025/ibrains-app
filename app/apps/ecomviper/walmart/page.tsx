import Link from "next/link";
import WalmartPageHeader from "@/app/apps/ecomviper/walmart/_components/page-header";
import StatusBadge from "@/app/apps/ecomviper/walmart/_components/status-badge";
import { getWalmartDashboardSnapshot, getWalmartDashboardSnapshotForUser } from "@/lib/ecomviper/walmart/walmart-products";
import { getWalmartConnectionHealth, getWalmartConnectionHealthForUser } from "@/lib/ecomviper/walmart/walmart-auth";
import { requireSignedInUser } from "@/lib/auth/requireSignedInUser";
import { walmartCapabilityModules } from "@/lib/ecomviper/walmart/walmart-capability-map";
import type {
  WalmartConnectionHealth,
  WalmartDashboardSnapshot,
  WalmartProductRecord,
} from "@/lib/ecomviper/walmart/walmart-types";

export const dynamic = "force-dynamic";

function apiErrorMessage(value: { code: string; message: string } | null): string {
  if (!value) return "None";
  return `${value.message} (${value.code})`;
}

function formatTimestamp(value: unknown, fallback: string): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || fallback;
  }
  return fallback;
}

interface WalmartDashboardConnectionUi {
  badgeLabel: "Connected" | "Failed" | "Not Connected";
  connected: boolean;
  primaryActionLabel: "Connect Walmart" | "Manage Walmart Connection";
  primaryActionHref: "/apps/ecomviper/walmart/connect";
  primaryActionClassName: string;
  lastAuth: string;
  lastSync: string;
  lastImport: string;
  lastError: string;
}

function hasRecentSuccessfulWalmartApiSignal(
  snapshot: WalmartDashboardSnapshot,
  connection: WalmartConnectionHealth
): boolean {
  if (snapshot.productsImported > 0) return true;
  if (snapshot.lastImportAt) return true;
  if (connection.lastSuccessfulApiCall) return true;
  if (connection.summary.lastSuccessfulAuth) return true;
  if (connection.summary.lastSuccessfulRead) return true;

  return snapshot.recentActivity.some(
    (entry) =>
      entry.result === "success" &&
      (entry.action === "product_import" || entry.action === "inventory_update" || entry.action === "pricing_update")
  );
}

function hasStoredCredentialSignal(connection: WalmartConnectionHealth): boolean {
  return connection.summary.clientSecretStored || connection.summary.maskedClientId !== "Not configured";
}

export function buildWalmartDashboardConnectionUi(
  snapshot: WalmartDashboardSnapshot,
  connection: WalmartConnectionHealth
): WalmartDashboardConnectionUi {
  const successfulApiSignal = hasRecentSuccessfulWalmartApiSignal(snapshot, connection);
  const storedCredentials = hasStoredCredentialSignal(connection);

  const connectedByStatus =
    connection.connectionStatus === "connected" ||
    connection.connectionStatus === "token_valid" ||
    connection.connectionStatus === "token_valid_read_not_configured";

  const connected = connectedByStatus ? storedCredentials || successfulApiSignal : successfulApiSignal;
  const badgeLabel = connected ? "Connected" : connection.connectionStatus === "failed" ? "Failed" : "Not Connected";

  const primaryActionClassName = connected
    ? "rounded-lg border border-emerald-600 bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition hover:border-emerald-700 hover:bg-emerald-700"
    : "rounded-lg border border-[#2563EB] bg-[#2563EB] px-3 py-2 text-sm font-medium text-white transition hover:border-[#1D4ED8] hover:bg-[#1D4ED8]";

  return {
    badgeLabel,
    connected,
    primaryActionLabel: connected ? "Manage Walmart Connection" : "Connect Walmart",
    primaryActionHref: "/apps/ecomviper/walmart/connect",
    primaryActionClassName,
    lastAuth: formatTimestamp(connection.summary.lastSuccessfulAuth, "Never"),
    lastSync: formatTimestamp(
      connection.summary.lastSuccessfulRead ?? connection.lastSuccessfulApiCall ?? snapshot.lastImportAt,
      "Not yet"
    ),
    lastImport: formatTimestamp(snapshot.lastImportAt, "Not imported yet"),
    lastError: apiErrorMessage(connection.lastApiError),
  };
}

function formatInventory(product: WalmartProductRecord): string {
  if (product.inventoryStatus === "unknown") return "Not synced";
  if (product.inventoryStatus === "out_of_stock") return "Out of stock";
  return String(product.inventoryQuantity);
}

async function resolveDashboardConnectionHealth(userId: string | null): Promise<WalmartConnectionHealth> {
  try {
    if (!userId) {
      return getWalmartConnectionHealth();
    }
    return await getWalmartConnectionHealthForUser(userId);
  } catch {
    return getWalmartConnectionHealth();
  }
}

export default async function WalmartDashboardPage() {
  const { userId, unauthorizedResponse } = await requireSignedInUser();
  const snapshot = !unauthorizedResponse && userId
    ? await getWalmartDashboardSnapshotForUser(userId)
    : getWalmartDashboardSnapshot();
  const connection = await resolveDashboardConnectionHealth(!unauthorizedResponse ? userId : null);
  const connectionUi = buildWalmartDashboardConnectionUi(snapshot, connection);

  return (
    <div className="space-y-4" data-testid="ecomviper-walmart-dashboard">
      <WalmartPageHeader
        title="Walmart Agentic Commerce Command Center"
        subtitle="Monitor AI visibility, listing intelligence, trust signals, and action queues for Walmart catalog growth."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href={connectionUi.primaryActionHref}
              className={connectionUi.primaryActionClassName}
            >
              {connectionUi.primaryActionLabel}
            </Link>
            <Link
              href="/apps/ecomviper/walmart/products"
              className="rounded-lg border border-[#D9E4F0] bg-white px-3 py-2 text-sm text-[#0F172A] transition hover:bg-[#F8FBFF]"
            >
              Review AI Visibility
            </Link>
            <Link
              href="/apps/ecomviper/walmart/feeds"
              className="rounded-lg border border-[#D9E4F0] bg-white px-3 py-2 text-sm text-[#0F172A] transition hover:bg-[#F8FBFF]"
            >
              Review Trust Signals
            </Link>
          </div>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5" data-testid="ecomviper-walmart-metric-cards">
        <article className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-4 shadow-[0_14px_34px_rgba(15,23,42,0.08)]">
          <p className="text-xs uppercase tracking-[0.12em] text-[#64748B]">Command Center Health</p>
          <div className="mt-2"><StatusBadge status={connectionUi.badgeLabel} /></div>
          <p className="mt-2 text-sm text-[#334155]">Control Plane: Production</p>
          <p className="mt-1 text-xs text-[#64748B]">Last auth: {connectionUi.lastAuth}</p>
          <p className="mt-1 text-xs text-[#64748B]">Last sync: {connectionUi.lastSync}</p>
          <p className="mt-1 text-xs text-[#64748B]">Last import: {connectionUi.lastImport}</p>
          <p className="mt-1 text-xs text-[#64748B]">Last error: {connectionUi.lastError}</p>
        </article>
        <article className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-4 shadow-[0_14px_34px_rgba(15,23,42,0.08)]">
          <p className="text-xs uppercase tracking-[0.12em] text-[#64748B]">Catalog Coverage</p>
          <p className="mt-2 text-3xl font-semibold text-[#0F172A]">{snapshot.productsImported}</p>
          <p className="mt-1 text-xs text-[#64748B]">
            Last import: {formatTimestamp(snapshot.lastImportAt, "Not imported yet")}
          </p>
        </article>
        <article className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-4 shadow-[0_14px_34px_rgba(15,23,42,0.08)]">
          <p className="text-xs uppercase tracking-[0.12em] text-[#64748B]">Action Queue</p>
          <p className="mt-2 text-3xl font-semibold text-[#0F172A]">{snapshot.draftChanges}</p>
          <p className="mt-1 text-xs text-[#64748B]">Pending listing changes awaiting publish</p>
        </article>
        <article className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-4 shadow-[0_14px_34px_rgba(15,23,42,0.08)]">
          <p className="text-xs uppercase tracking-[0.12em] text-[#64748B]">Trust Signal Alerts</p>
          <p className="mt-2 text-3xl font-semibold text-[#0F172A]">{snapshot.feedErrors}</p>
          <p className="mt-1 text-xs text-[#64748B]">Recent feed events impacting discoverability</p>
        </article>
        <article className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-4 shadow-[0_14px_34px_rgba(15,23,42,0.08)]">
          <p className="text-xs uppercase tracking-[0.12em] text-[#64748B]">Priority Opportunities</p>
          <p className="mt-2 text-3xl font-semibold text-[#0F172A]">{snapshot.listingsNeedingAttention.count}</p>
          <p className="mt-1 text-xs text-[#64748B]">{snapshot.listingsNeedingAttention.categories.join(", ") || "No categories"}</p>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5 shadow-[0_16px_36px_rgba(15,23,42,0.08)]">
          <h2 className="text-lg font-semibold text-[#0F172A]">AI Visibility Queue</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-[0.1em] text-[#64748B]">
                <tr>
                  <th className="py-2">SKU</th>
                  <th className="py-2">Title</th>
                  <th className="py-2">Price</th>
                  <th className="py-2">Inventory</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.recentProducts.map((product) => (
                  <tr key={product.sku} className="border-t border-[#E2E8F0] text-[#334155]">
                    <td className="py-2 pr-3 font-medium">{product.sku}</td>
                    <td className="py-2 pr-3">{product.title}</td>
                    <td className="py-2 pr-3">${product.price.toFixed(2)}</td>
                    <td className="py-2">{formatInventory(product)}</td>
                  </tr>
                ))}
                {!snapshot.recentProducts.length ? (
                  <tr className="border-t border-[#E2E8F0]">
                    <td colSpan={4} className="py-6 text-center text-sm text-[#64748B]">
                      No Walmart products imported yet. Connect Walmart, then import your products.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </article>

        <article className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5 shadow-[0_16px_36px_rgba(15,23,42,0.08)]">
          <h2 className="text-lg font-semibold text-[#0F172A]">Signal Timeline</h2>
          <ul className="mt-3 space-y-2">
            {snapshot.recentActivity.length ? (
              snapshot.recentActivity.map((entry) => {
                const activityTime = formatTimestamp(entry.time, "Unknown");
                return (
                  <li key={`${activityTime}-${entry.action}`} className="rounded-lg border border-[#E2E8F0] bg-[#F8FBFF] p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-[#0F172A]">{entry.action}</span>
                      <StatusBadge status={entry.result} />
                    </div>
                    <p className="mt-1 text-[#475569]">{entry.message}</p>
                    <p className="mt-1 text-xs text-[#64748B]">{activityTime}</p>
                  </li>
                );
              })
            ) : (
              <li className="rounded-lg border border-dashed border-[#D9E4F0] p-3 text-sm text-[#64748B]">No activity yet.</li>
            )}
          </ul>
        </article>
      </section>

      <section className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5 shadow-[0_16px_36px_rgba(15,23,42,0.08)]">
        <h2 className="text-lg font-semibold text-[#0F172A]">Listings Needing Intervention</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {snapshot.attentionProducts.length ? (
            snapshot.attentionProducts.map((product) => (
              <article key={product.sku} className="rounded-lg border border-[#E2E8F0] bg-[#F8FBFF] p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-[#0F172A]">{product.sku}</p>
                  <StatusBadge status={product.status} />
                </div>
                <p className="mt-1 text-sm text-[#334155]">{product.title}</p>
                <p className="mt-1 text-xs text-[#64748B]">Issues: {product.issues.join(", ") || "None"}</p>
              </article>
            ))
          ) : (
            <p className="text-sm text-[#64748B]">No products currently flagged.</p>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5 shadow-[0_16px_36px_rgba(15,23,42,0.08)]" data-testid="ecomviper-walmart-capability-map">
        <h2 className="text-lg font-semibold text-[#0F172A]">Command Center Lanes</h2>
        <p className="mt-1 text-sm text-[#64748B]">
          Agentic commerce lanes stay focused on Walmart Marketplace readiness while ad-channel tooling remains separate.
        </p>
        <div className="mt-3 grid gap-2">
          {walmartCapabilityModules.map((module) => (
            <article key={module.id} className="rounded-lg border border-[#E2E8F0] bg-[#F8FBFF] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-[#0F172A]">{module.title}</p>
                <StatusBadge
                  status={
                    module.status === "available"
                      ? "Available"
                      : module.status === "foundation"
                        ? "Foundation"
                        : "Separate integration required"
                  }
                />
              </div>
              <p className="mt-1 text-sm text-[#475569]">{module.description}</p>
              <p className="mt-1 text-xs text-[#64748B]">
                API family: {module.apiFamily === "marketplace" ? "Walmart Marketplace APIs" : "Walmart Connect Ads APIs"}
              </p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
