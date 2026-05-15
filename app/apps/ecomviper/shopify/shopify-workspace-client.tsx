"use client";

import { useMemo, useState } from "react";
import ShopifyCommandCenter from "@/app/apps/ecomviper/shopify/_components/shopify-command-center";
import ShopifyKnowledgeBasePanel from "@/app/apps/ecomviper/shopify/_components/shopify-knowledge-base-panel";
import ShopifyPromptMatchPanel from "@/app/apps/ecomviper/shopify/_components/shopify-prompt-match-panel";
import ShopifySidebar from "@/app/apps/ecomviper/shopify/_components/shopify-sidebar";
import ShopifyTrustSignalsPanel from "@/app/apps/ecomviper/shopify/_components/shopify-trust-signals-panel";
import type {
  ShopifyAgenticWorkspaceState,
  ShopifyWorkspaceLaneId,
} from "@/lib/ecomviper/shopify/shopify-agentic-types";

interface ShopifyWorkspaceClientProps {
  initialState: ShopifyAgenticWorkspaceState;
}

interface ApiErrorShape {
  error?: {
    message?: string;
  };
  message?: string;
}

function laneDescription(lane: ShopifyWorkspaceLaneId): string {
  if (lane === "command-center") {
    return "Summary of readiness, MCP diagnostics, Knowledge Base coverage, and next best actions.";
  }
  if (lane === "products") {
    return "Product-level readiness across facts, content, image semantics, schema, and FAQ coverage.";
  }
  if (lane === "knowledge-base") {
    return "Knowledge Base answer quality, live-content gaps, and copy-ready outputs.";
  }
  if (lane === "prompt-match") {
    return "Buyer query matching against product, policy, and FAQ resources.";
  }
  if (lane === "trust-signals") {
    return "Trust signal coverage across support, policies, checkout, and marketplace availability.";
  }
  if (lane === "semantic-gaps") {
    return "Intent and topic gaps reducing referral confidence from AI surfaces.";
  }
  if (lane === "product-opportunities") {
    return "Product-page and FAQ optimization opportunities ranked by expected referral impact.";
  }
  if (lane === "marketplace-health") {
    return "Shopify catalog + MCP + Knowledge Base operational health overview.";
  }
  return "Connection settings, sync controls, and source provenance for live/demo workspace data.";
}

function formatTimestamp(value: string | null): string {
  if (!value) return "Never";
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return value;
  return new Date(parsed).toISOString();
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const payload = (await response.json().catch(() => null)) as (T & ApiErrorShape) | null;
  if (!response.ok || !payload) {
    const message = payload?.error?.message || payload?.message || `Request failed (${response.status})`;
    throw new Error(message);
  }

  return payload;
}

function ProductsPanel({ state }: { state: ShopifyAgenticWorkspaceState }) {
  return (
    <section className="space-y-4" data-testid="ecomviper-shopify-products-panel">
      <article className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5 shadow-[0_16px_36px_rgba(15,23,42,0.08)]">
        <h2 className="text-lg font-semibold text-[#0F172A]">Products</h2>
        <p className="mt-1 text-sm text-[#475569]">
          Live Shopify product readiness table for facts, content quality, image alt text, schema/metafields, and referral notes.
        </p>
        <p className="mt-2 text-xs text-[#64748B]">Source: {state.workspaceSourceLabel}</p>
      </article>

      <article className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5 shadow-[0_16px_36px_rgba(15,23,42,0.08)]">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-[0.1em] text-[#64748B]">
              <tr>
                <th className="py-2 pr-3">Product</th>
                <th className="py-2 pr-3">Facts</th>
                <th className="py-2 pr-3">Title/Description</th>
                <th className="py-2 pr-3">Image Alt Text</th>
                <th className="py-2 pr-3">Schema/Metafields</th>
                <th className="py-2 pr-3">FAQ</th>
                <th className="py-2 pr-3">Source</th>
                <th className="py-2 pr-3">Agentic Referral Notes</th>
              </tr>
            </thead>
            <tbody>
              {state.products.map((product) => (
                <tr key={product.id} className="border-t border-[#E2E8F0] text-[#334155] align-top">
                  <td className="py-3 pr-3">
                    <p className="font-medium text-[#0F172A]">{product.title}</p>
                    <p className="mt-1 text-xs text-[#64748B]">{product.category}</p>
                  </td>
                  <td className="py-3 pr-3">{product.productFactsReadiness}</td>
                  <td className="py-3 pr-3">{product.titleDescriptionReadiness}</td>
                  <td className="py-3 pr-3">{product.imageAltTextReadiness}</td>
                  <td className="py-3 pr-3">{product.schemaMetafieldReadiness}</td>
                  <td className="py-3 pr-3">{product.productFaqReadiness}</td>
                  <td className="py-3 pr-3">{product.sourceLabel || state.workspaceSourceLabel}</td>
                  <td className="py-3 pr-3">{product.agenticReferralNotes}</td>
                </tr>
              ))}
              {!state.products.length ? (
                <tr className="border-t border-[#E2E8F0]">
                  <td colSpan={8} className="py-6 text-center text-sm text-[#64748B]">
                    Connect Shopify to hydrate real product data, or enable Demo mode explicitly.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}

function SemanticGapsPanel({ state }: { state: ShopifyAgenticWorkspaceState }) {
  return (
    <section className="space-y-4" data-testid="ecomviper-shopify-semantic-gaps-panel">
      <article className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5 shadow-[0_16px_36px_rgba(15,23,42,0.08)]">
        <h2 className="text-lg font-semibold text-[#0F172A]">Semantic Gaps</h2>
        <p className="mt-1 text-sm text-[#475569]">
          Missing topical coverage, weak intent coverage, long-tail question gaps, comparison gaps, and bundle guidance gaps.
        </p>
      </article>

      <div className="grid gap-3">
        {state.semanticGaps.map((gap) => (
          <article key={gap.id} className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-4 shadow-[0_16px_36px_rgba(15,23,42,0.08)]">
            <p className="text-sm font-medium text-[#0F172A]">{gap.topic}</p>
            <p className="mt-1 text-xs text-[#64748B]">Severity: {gap.severity}</p>
            <p className="mt-2 text-sm text-[#334155]">{gap.explanation}</p>
            <p className="mt-2 text-xs text-[#475569]">Recommended action: {gap.recommendedAction}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function ProductOpportunitiesPanel({ state }: { state: ShopifyAgenticWorkspaceState }) {
  const opportunities = state.nextBestActions.filter(
    (action) => action.lane === "products" || action.lane === "knowledge-base" || action.lane === "prompt-match"
  );

  return (
    <section className="space-y-4" data-testid="ecomviper-shopify-product-opportunities-panel">
      <article className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5 shadow-[0_16px_36px_rgba(15,23,42,0.08)]">
        <h2 className="text-lg font-semibold text-[#0F172A]">Product Opportunities</h2>
        <p className="mt-1 text-sm text-[#475569]">
          Product-page, FAQ, image/alt text, bundle, and schema/metafield opportunities ranked by referral impact.
        </p>
      </article>

      <ol className="space-y-2 text-sm text-[#334155]">
        {opportunities.map((action, index) => (
          <li key={action.id} className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-4 shadow-[0_16px_36px_rgba(15,23,42,0.08)]">
            <p className="font-medium text-[#0F172A]">{index + 1}. {action.title}</p>
            <p className="mt-1 text-xs text-[#64748B]">Impact: {action.impact} · Effort: {action.effort}</p>
            <p className="mt-2 text-sm text-[#334155]">{action.rationale}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function MarketplaceHealthPanel({ state }: { state: ShopifyAgenticWorkspaceState }) {
  const mcpStatus = state.readiness.dimensions.storefrontMcpReadiness.status;
  const knowledgeBaseStatus = state.readiness.dimensions.knowledgeBaseCoverage.status;
  const catalogStatus = state.readiness.dimensions.ucpCatalogReadiness.status;
  const aiReferralStatus = state.readiness.dimensions.aiReferralReadiness.status;
  const policyStatus = state.readiness.dimensions.policyCoverage.status;
  const complianceStatus = state.readiness.dimensions.supplementComplianceSafety.status;

  return (
    <section className="space-y-4" data-testid="ecomviper-shopify-marketplace-health-panel">
      <article className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5 shadow-[0_16px_36px_rgba(15,23,42,0.08)]">
        <h2 className="text-lg font-semibold text-[#0F172A]">Marketplace Health</h2>
        <p className="mt-1 text-sm text-[#475569]">
          Shopify catalog, Knowledge Base, MCP, AI readiness, connection health, and visibility scan status.
        </p>
      </article>

      <article className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5 shadow-[0_16px_36px_rgba(15,23,42,0.08)]">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm text-[#334155]">
          <p className="rounded-lg border border-[#E2E8F0] bg-[#F8FBFF] px-3 py-2">Shopify catalog status: {catalogStatus}</p>
          <p className="rounded-lg border border-[#E2E8F0] bg-[#F8FBFF] px-3 py-2">Knowledge Base status: {knowledgeBaseStatus}</p>
          <p className="rounded-lg border border-[#E2E8F0] bg-[#F8FBFF] px-3 py-2">MCP status: {mcpStatus}</p>
          <p className="rounded-lg border border-[#E2E8F0] bg-[#F8FBFF] px-3 py-2">AI referral readiness: {aiReferralStatus}</p>
          <p className="rounded-lg border border-[#E2E8F0] bg-[#F8FBFF] px-3 py-2">Store policy readiness: {policyStatus}</p>
          <p className="rounded-lg border border-[#E2E8F0] bg-[#F8FBFF] px-3 py-2">Compliance status: {complianceStatus}</p>
          <p className="rounded-lg border border-[#E2E8F0] bg-[#F8FBFF] px-3 py-2">Shopify products: {state.catalogCounts.products}</p>
          <p className="rounded-lg border border-[#E2E8F0] bg-[#F8FBFF] px-3 py-2">Collections: {state.catalogCounts.collections}</p>
          <p className="rounded-lg border border-[#E2E8F0] bg-[#F8FBFF] px-3 py-2">Pages + Blog articles: {state.catalogCounts.pages + state.catalogCounts.blogArticles}</p>
          <p className="rounded-lg border border-[#E2E8F0] bg-[#F8FBFF] px-3 py-2">Last Shopify sync: {formatTimestamp(state.lastSyncedAt)}</p>
          <p className="rounded-lg border border-[#E2E8F0] bg-[#F8FBFF] px-3 py-2">Last visibility scan: {formatTimestamp(state.lastVisibilityScanAt)}</p>
          <p className="rounded-lg border border-[#E2E8F0] bg-[#F8FBFF] px-3 py-2">Workspace source: {state.workspaceSourceLabel}</p>
        </div>
      </article>
    </section>
  );
}

interface SettingsPanelProps {
  state: ShopifyAgenticWorkspaceState;
  onRefresh: (demoMode: boolean) => Promise<void>;
}

function SettingsPanel({ state, onRefresh }: SettingsPanelProps) {
  const [shopifyStoreDomain, setShopifyStoreDomain] = useState(state.storeDomain || "");
  const [shopifyClientId, setShopifyClientId] = useState("");
  const [shopifyClientSecret, setShopifyClientSecret] = useState("");
  const [shopifyAdminToken, setShopifyAdminToken] = useState("");
  const [openAiApiKey, setOpenAiApiKey] = useState("");
  const [serpApiKey, setSerpApiKey] = useState("");
  const [scanQuery, setScanQuery] = useState("");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function runAction(actionId: string, runner: () => Promise<{ message?: string } | void>) {
    setBusyAction(actionId);
    setFeedback(null);
    try {
      const result = await runner();
      setFeedback(result?.message || "Action completed.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Action failed.");
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <section className="space-y-4" data-testid="ecomviper-shopify-settings-panel">
      <article className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5 shadow-[0_16px_36px_rgba(15,23,42,0.08)]">
        <h2 className="text-lg font-semibold text-[#0F172A]">Settings</h2>
        <p className="mt-1 text-sm text-[#475569]">
          Configure live credentials, test connections, sync Shopify data, and run visibility scans.
        </p>

        <div className="mt-4 grid gap-3 text-sm text-[#334155] sm:grid-cols-2 lg:grid-cols-3">
          <p className="rounded-lg border border-[#E2E8F0] bg-[#F8FBFF] px-3 py-2">Shopify: {state.connectionStatus.shopify.statusLabel}</p>
          <p className="rounded-lg border border-[#E2E8F0] bg-[#F8FBFF] px-3 py-2">OpenAI: {state.connectionStatus.openai.statusLabel}</p>
          <p className="rounded-lg border border-[#E2E8F0] bg-[#F8FBFF] px-3 py-2">SerpAPI: {state.connectionStatus.serpapi.statusLabel}</p>
          <p className="rounded-lg border border-[#E2E8F0] bg-[#F8FBFF] px-3 py-2">Mock mode: {state.mockModeEnabled ? "On" : "Off"}</p>
          <p className="rounded-lg border border-[#E2E8F0] bg-[#F8FBFF] px-3 py-2">Last Shopify sync: {formatTimestamp(state.lastSyncedAt)}</p>
          <p className="rounded-lg border border-[#E2E8F0] bg-[#F8FBFF] px-3 py-2">Last visibility scan: {formatTimestamp(state.lastVisibilityScanAt)}</p>
        </div>
      </article>

      <article className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5 shadow-[0_16px_36px_rgba(15,23,42,0.08)]">
        <h3 className="text-base font-semibold text-[#0F172A]">Shopify Admin API</h3>
        <p className="mt-1 text-xs text-[#64748B]">
          Connected: {state.connectionStatus.shopify.statusLabel} · Credential: {state.connectionStatus.shopify.maskedCredential || "Not configured"}
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <input
            value={shopifyStoreDomain}
            onChange={(event) => setShopifyStoreDomain(event.target.value)}
            placeholder="store.myshopify.com"
            className="rounded-lg border border-[#D9E4F0] px-3 py-2 text-sm"
          />
          <input
            value={shopifyClientId}
            onChange={(event) => setShopifyClientId(event.target.value)}
            placeholder="Client ID"
            className="rounded-lg border border-[#D9E4F0] px-3 py-2 text-sm"
          />
          <input
            value={shopifyClientSecret}
            onChange={(event) => setShopifyClientSecret(event.target.value)}
            placeholder="Client Secret"
            type="password"
            className="rounded-lg border border-[#D9E4F0] px-3 py-2 text-sm"
          />
          <input
            value={shopifyAdminToken}
            onChange={(event) => setShopifyAdminToken(event.target.value)}
            placeholder="Admin API Token (optional legacy mode)"
            type="password"
            className="rounded-lg border border-[#D9E4F0] px-3 py-2 text-sm"
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              runAction("shopify_test", async () => {
                const payload = await requestJson<{ message?: string }>(
                  "/api/ecomviper/shopify/connect/shopify/test",
                  {
                    method: "POST",
                    body: JSON.stringify({
                      storeDomain: shopifyStoreDomain,
                      clientId: shopifyClientId,
                      clientSecret: shopifyClientSecret,
                      adminApiToken: shopifyAdminToken,
                    }),
                  }
                );
                await onRefresh(state.mockModeEnabled);
                return payload;
              })
            }
            disabled={busyAction !== null}
            className="rounded-lg border border-[#2563EB] bg-[#2563EB] px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            Test Connection
          </button>
          <button
            type="button"
            onClick={() =>
              runAction("shopify_save", async () => {
                const payload = await requestJson<{ message?: string }>(
                  "/api/ecomviper/shopify/connect/shopify",
                  {
                    method: "POST",
                    body: JSON.stringify({
                      storeDomain: shopifyStoreDomain,
                      clientId: shopifyClientId,
                      clientSecret: shopifyClientSecret,
                      adminApiToken: shopifyAdminToken,
                    }),
                  }
                );
                await onRefresh(state.mockModeEnabled);
                return payload;
              })
            }
            disabled={busyAction !== null}
            className="rounded-lg border border-[#1D4ED8] bg-[#1D4ED8] px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            Save/Update Credentials
          </button>
          <button
            type="button"
            onClick={() =>
              runAction("shopify_sync", async () => {
                const payload = await requestJson<{ message?: string }>("/api/ecomviper/shopify/sync", {
                  method: "POST",
                  body: JSON.stringify({ boundedRuntime: true }),
                });
                await onRefresh(state.mockModeEnabled);
                return payload;
              })
            }
            disabled={busyAction !== null}
            className="rounded-lg border border-[#0F766E] bg-[#0F766E] px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            Sync Now
          </button>
        </div>
      </article>

      <article className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5 shadow-[0_16px_36px_rgba(15,23,42,0.08)]">
        <h3 className="text-base font-semibold text-[#0F172A]">OpenAI API</h3>
        <p className="mt-1 text-xs text-[#64748B]">
          Connected: {state.connectionStatus.openai.statusLabel} · Credential: {state.connectionStatus.openai.maskedCredential || "Not configured"}
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
          <input
            value={openAiApiKey}
            onChange={(event) => setOpenAiApiKey(event.target.value)}
            placeholder="sk-..."
            type="password"
            className="rounded-lg border border-[#D9E4F0] px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() =>
              runAction("openai_test", async () => {
                const payload = await requestJson<{ message?: string }>(
                  "/api/ecomviper/shopify/connect/openai/test",
                  {
                    method: "POST",
                    body: JSON.stringify({ apiKey: openAiApiKey }),
                  }
                );
                await onRefresh(state.mockModeEnabled);
                return payload;
              })
            }
            disabled={busyAction !== null}
            className="rounded-lg border border-[#2563EB] bg-[#2563EB] px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            Test Connection
          </button>
          <button
            type="button"
            onClick={() =>
              runAction("openai_save", async () => {
                const payload = await requestJson<{ message?: string }>(
                  "/api/ecomviper/shopify/connect/openai",
                  {
                    method: "POST",
                    body: JSON.stringify({ apiKey: openAiApiKey }),
                  }
                );
                setOpenAiApiKey("");
                await onRefresh(state.mockModeEnabled);
                return payload;
              })
            }
            disabled={busyAction !== null}
            className="rounded-lg border border-[#1D4ED8] bg-[#1D4ED8] px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            Save/Update Credentials
          </button>
        </div>
      </article>

      <article className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5 shadow-[0_16px_36px_rgba(15,23,42,0.08)]">
        <h3 className="text-base font-semibold text-[#0F172A]">SerpAPI</h3>
        <p className="mt-1 text-xs text-[#64748B]">
          Connected: {state.connectionStatus.serpapi.statusLabel} · Credential: {state.connectionStatus.serpapi.maskedCredential || "Not configured"}
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
          <input
            value={serpApiKey}
            onChange={(event) => setSerpApiKey(event.target.value)}
            placeholder="serpapi_..."
            type="password"
            className="rounded-lg border border-[#D9E4F0] px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() =>
              runAction("serpapi_test", async () => {
                const payload = await requestJson<{ message?: string }>(
                  "/api/ecomviper/shopify/connect/serpapi/test",
                  {
                    method: "POST",
                    body: JSON.stringify({ apiKey: serpApiKey }),
                  }
                );
                await onRefresh(state.mockModeEnabled);
                return payload;
              })
            }
            disabled={busyAction !== null}
            className="rounded-lg border border-[#2563EB] bg-[#2563EB] px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            Test Connection
          </button>
          <button
            type="button"
            onClick={() =>
              runAction("serpapi_save", async () => {
                const payload = await requestJson<{ message?: string }>(
                  "/api/ecomviper/shopify/connect/serpapi",
                  {
                    method: "POST",
                    body: JSON.stringify({ apiKey: serpApiKey }),
                  }
                );
                setSerpApiKey("");
                await onRefresh(state.mockModeEnabled);
                return payload;
              })
            }
            disabled={busyAction !== null}
            className="rounded-lg border border-[#1D4ED8] bg-[#1D4ED8] px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            Save/Update Credentials
          </button>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
          <input
            value={scanQuery}
            onChange={(event) => setScanQuery(event.target.value)}
            placeholder={`site:${state.storeDomain || "store.myshopify.com"}`}
            className="rounded-lg border border-[#D9E4F0] px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() =>
              runAction("serpapi_scan", async () => {
                const payload = await requestJson<{ message?: string }>("/api/ecomviper/shopify/visibility/scan", {
                  method: "POST",
                  body: JSON.stringify({ query: scanQuery }),
                });
                await onRefresh(state.mockModeEnabled);
                return payload;
              })
            }
            disabled={busyAction !== null}
            className="rounded-lg border border-[#0F766E] bg-[#0F766E] px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            Run Visibility Scan
          </button>
        </div>
      </article>

      <article className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5 shadow-[0_16px_36px_rgba(15,23,42,0.08)]">
        <h3 className="text-base font-semibold text-[#0F172A]">Demo Mode</h3>
        <p className="mt-1 text-sm text-[#475569]">
          Demo data is only shown when explicitly enabled.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              runAction("demo_on", async () => {
                await onRefresh(true);
                return { message: "Demo mode enabled." };
              })
            }
            disabled={busyAction !== null}
            className="rounded-lg border border-[#334155] bg-[#334155] px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            Enable Demo Mode
          </button>
          <button
            type="button"
            onClick={() =>
              runAction("demo_off", async () => {
                await onRefresh(false);
                return { message: "Demo mode disabled." };
              })
            }
            disabled={busyAction !== null}
            className="rounded-lg border border-[#0F172A] bg-[#0F172A] px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            Disable Demo Mode
          </button>
        </div>
      </article>

      {feedback ? (
        <article className="rounded-xl border border-[#D9E4F0] bg-[#F8FBFF] px-4 py-3 text-sm text-[#334155]">
          {feedback}
        </article>
      ) : null}
    </section>
  );
}

function renderLaneContent(
  lane: ShopifyWorkspaceLaneId,
  state: ShopifyAgenticWorkspaceState,
  onRefresh: (demoMode: boolean) => Promise<void>
) {
  if (lane === "command-center") return <ShopifyCommandCenter state={state} />;
  if (lane === "products") return <ProductsPanel state={state} />;
  if (lane === "knowledge-base") return <ShopifyKnowledgeBasePanel state={state} />;
  if (lane === "prompt-match") return <ShopifyPromptMatchPanel state={state} />;
  if (lane === "trust-signals") return <ShopifyTrustSignalsPanel state={state} />;
  if (lane === "semantic-gaps") return <SemanticGapsPanel state={state} />;
  if (lane === "product-opportunities") return <ProductOpportunitiesPanel state={state} />;
  if (lane === "marketplace-health") return <MarketplaceHealthPanel state={state} />;
  return <SettingsPanel state={state} onRefresh={onRefresh} />;
}

export default function ShopifyWorkspaceClient({ initialState }: ShopifyWorkspaceClientProps) {
  const [activeLane, setActiveLane] = useState<ShopifyWorkspaceLaneId>("command-center");
  const [workspaceState, setWorkspaceState] = useState<ShopifyAgenticWorkspaceState>(initialState);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const laneSubtitle = useMemo(() => laneDescription(activeLane), [activeLane]);

  async function refreshWorkspace(demoMode: boolean) {
    setRefreshError(null);
    try {
      const query = demoMode ? "?demo=1" : "";
      const payload = await requestJson<{ workspace?: ShopifyAgenticWorkspaceState }>(
        `/api/ecomviper/shopify/workspace${query}`
      );

      if (!payload.workspace) {
        throw new Error("Workspace payload missing.");
      }

      setWorkspaceState(payload.workspace);
    } catch (error) {
      setRefreshError(error instanceof Error ? error.message : "Failed to refresh workspace.");
      throw error;
    }
  }

  return (
    <main className="space-y-4" data-testid="ecomviper-shopify-workspace">
      <div className="grid gap-4 lg:grid-cols-[236px_minmax(0,1fr)]">
        <ShopifySidebar activeLane={activeLane} onSelectLane={setActiveLane} />

        <section className="space-y-4">
          <div className="inline-flex items-center rounded-full border border-[#D9E4F0] bg-white/90 px-3 py-1 text-xs text-[#475569]">
            Agentic Commerce Command Center
          </div>

          <header className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
            <div className="inline-flex items-center rounded-full border border-[#D9E4F0] bg-[#EFF4F9] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#475569]">
              SHOPIFY AGENTIC COMMERCE
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-[#0F172A]">Shopify Agentic Workspace</h1>
            <p className="mt-1 text-sm text-[#475569]">
              Live store hydration, policy-aware knowledge coverage, and AI referral readiness.
            </p>
            <p className="mt-2 text-xs text-[#64748B]">{laneSubtitle}</p>

            <div className="mt-4 flex flex-wrap gap-2" data-testid="ecomviper-shopify-status-pills">
              <span className="rounded-full border border-[#D9E4F0] bg-[#F8FBFF] px-3 py-1 text-xs font-medium text-[#334155]">
                Environment: {workspaceState.environmentLabel}
              </span>
              <span className="rounded-full border border-[#D9E4F0] bg-[#F8FBFF] px-3 py-1 text-xs font-medium text-[#334155]">
                Store: {workspaceState.storeLabel}
              </span>
              <span className="rounded-full border border-[#D9E4F0] bg-[#F8FBFF] px-3 py-1 text-xs font-medium text-[#334155]">
                Mode: {workspaceState.modeLabel}
              </span>
              <span className="rounded-full border border-[#D9E4F0] bg-[#F8FBFF] px-3 py-1 text-xs font-medium text-[#334155]">
                Shopify: {workspaceState.connectionStatus.shopify.statusLabel}
              </span>
              <span className="rounded-full border border-[#D9E4F0] bg-[#F8FBFF] px-3 py-1 text-xs font-medium text-[#334155]">
                OpenAI: {workspaceState.connectionStatus.openai.statusLabel}
              </span>
              <span className="rounded-full border border-[#D9E4F0] bg-[#F8FBFF] px-3 py-1 text-xs font-medium text-[#334155]">
                SerpAPI: {workspaceState.connectionStatus.serpapi.statusLabel}
              </span>
              <span className="rounded-full border border-[#D9E4F0] bg-[#F8FBFF] px-3 py-1 text-xs font-medium text-[#334155]">
                Mock mode: {workspaceState.mockModeEnabled ? "On" : "Off"}
              </span>
              <span className="rounded-full border border-[#D9E4F0] bg-[#F8FBFF] px-3 py-1 text-xs font-medium text-[#334155]">
                Last Shopify sync: {formatTimestamp(workspaceState.lastSyncedAt)}
              </span>
              <span className="rounded-full border border-[#D9E4F0] bg-[#F8FBFF] px-3 py-1 text-xs font-medium text-[#334155]">
                Last visibility scan: {formatTimestamp(workspaceState.lastVisibilityScanAt)}
              </span>
            </div>
          </header>

          {workspaceState.sourceWarnings.length > 0 ? (
            <article className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {workspaceState.sourceWarnings.join(" ")}
            </article>
          ) : null}

          {workspaceState.sourceErrors.length > 0 ? (
            <article className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
              {workspaceState.sourceErrors.join(" ")}
            </article>
          ) : null}

          {refreshError ? (
            <article className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
              {refreshError}
            </article>
          ) : null}

          {renderLaneContent(activeLane, workspaceState, refreshWorkspace)}
        </section>
      </div>
    </main>
  );
}
