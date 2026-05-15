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

function laneDescription(lane: ShopifyWorkspaceLaneId): string {
  if (lane === "command-center") {
    return "Summary of readiness, MCP diagnostics, Knowledge Base coverage, and next best actions.";
  }
  if (lane === "products") {
    return "Product-level readiness across facts, content, image semantics, schema, and FAQ coverage.";
  }
  if (lane === "knowledge-base") {
    return "Shopify Knowledge Base answer quality, gaps, and copy-ready outputs.";
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
  return "Workspace settings for mock-first operation and credential-safe implementation.";
}

function ProductsPanel({ state }: { state: ShopifyAgenticWorkspaceState }) {
  return (
    <section className="space-y-4" data-testid="ecomviper-shopify-products-panel">
      <article className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5 shadow-[0_16px_36px_rgba(15,23,42,0.08)]">
        <h2 className="text-lg font-semibold text-[#0F172A]">Products</h2>
        <p className="mt-1 text-sm text-[#475569]">
          Demo product readiness table for product facts, content quality, image alt text, schema/metafields, FAQ readiness, and referral notes.
        </p>
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
                  <td className="py-3 pr-3">{product.agenticReferralNotes}</td>
                </tr>
              ))}
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
          Shopify catalog, Knowledge Base, MCP, AI referral readiness, policy readiness, and supplement compliance status.
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
        </div>
      </article>
    </section>
  );
}

function SettingsPanel({ state }: { state: ShopifyAgenticWorkspaceState }) {
  return (
    <section className="space-y-4" data-testid="ecomviper-shopify-settings-panel">
      <article className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5 shadow-[0_16px_36px_rgba(15,23,42,0.08)]">
        <h2 className="text-lg font-semibold text-[#0F172A]">Settings</h2>
        <div className="mt-3 grid gap-3 text-sm text-[#334155] sm:grid-cols-2">
          <p className="rounded-lg border border-[#E2E8F0] bg-[#F8FBFF] px-3 py-2">Store domain: {state.storeDomain}</p>
          <p className="rounded-lg border border-[#E2E8F0] bg-[#F8FBFF] px-3 py-2">BYO API model: supported</p>
          <p className="rounded-lg border border-[#E2E8F0] bg-[#F8FBFF] px-3 py-2">Mode: mock-first with optional live probing flag</p>
          <p className="rounded-lg border border-[#E2E8F0] bg-[#F8FBFF] px-3 py-2">Knowledge Base app: review/approve answers in Shopify Knowledge Base</p>
        </div>
        <p className="mt-3 text-xs text-[#64748B]">
          Safe implementation note: no live Shopify credentials are stored in this workspace lane.
        </p>
      </article>
    </section>
  );
}

function renderLaneContent(lane: ShopifyWorkspaceLaneId, state: ShopifyAgenticWorkspaceState) {
  if (lane === "command-center") return <ShopifyCommandCenter state={state} />;
  if (lane === "products") return <ProductsPanel state={state} />;
  if (lane === "knowledge-base") return <ShopifyKnowledgeBasePanel state={state} />;
  if (lane === "prompt-match") return <ShopifyPromptMatchPanel state={state} />;
  if (lane === "trust-signals") return <ShopifyTrustSignalsPanel state={state} />;
  if (lane === "semantic-gaps") return <SemanticGapsPanel state={state} />;
  if (lane === "product-opportunities") return <ProductOpportunitiesPanel state={state} />;
  if (lane === "marketplace-health") return <MarketplaceHealthPanel state={state} />;
  return <SettingsPanel state={state} />;
}

export default function ShopifyWorkspaceClient({ initialState }: ShopifyWorkspaceClientProps) {
  const [activeLane, setActiveLane] = useState<ShopifyWorkspaceLaneId>("command-center");
  const laneSubtitle = useMemo(() => laneDescription(activeLane), [activeLane]);

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
              Storefront MCP, Knowledge Base, product facts, FAQs, policies, and AI referral readiness.
            </p>
            <p className="mt-2 text-xs text-[#64748B]">{laneSubtitle}</p>

            <div className="mt-4 flex flex-wrap gap-2" data-testid="ecomviper-shopify-status-pills">
              <span className="rounded-full border border-[#D9E4F0] bg-[#F8FBFF] px-3 py-1 text-xs font-medium text-[#334155]">
                Environment: {initialState.environmentLabel}
              </span>
              <span className="rounded-full border border-[#D9E4F0] bg-[#F8FBFF] px-3 py-1 text-xs font-medium text-[#334155]">
                Store: {initialState.storeLabel}
              </span>
              <span className="rounded-full border border-[#D9E4F0] bg-[#F8FBFF] px-3 py-1 text-xs font-medium text-[#334155]">
                Mode: {initialState.modeLabel}
              </span>
            </div>
          </header>

          {renderLaneContent(activeLane, initialState)}
        </section>
      </div>
    </main>
  );
}
