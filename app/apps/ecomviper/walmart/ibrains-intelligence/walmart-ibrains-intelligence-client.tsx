"use client";

import { useMemo, useState } from "react";
import WalmartPageHeader from "@/app/apps/ecomviper/walmart/_components/page-header";
import type { WalmartNetworkConnection } from "@/lib/ecomviper/walmart/walmart-network-connections";
import { hostFromUrl } from "@/lib/ecomviper/walmart/walmart-network-connections";
import type { WalmartEffectiveProductRecord } from "@/lib/ecomviper/walmart/walmart-product-display";
import {
  runWalmartIBrainsIntelligence,
  type IBrainsComplianceRisk,
  type IBrainsIntelligenceOpportunity,
  type IBrainsIntelligenceRun,
  type IBrainsOpportunityStatus,
} from "@/lib/ecomviper/walmart/walmart-ibrains-intelligence";

interface WalmartIBrainsIntelligenceClientProps {
  products: WalmartEffectiveProductRecord[];
  loadError?: string | null;
  networkConnections?: WalmartNetworkConnection[];
}

function labelForStatus(status: IBrainsOpportunityStatus): string {
  if (status === "draft_ready") return "Draft Ready";
  if (status === "needs_approval") return "Needs Approval";
  if (status === "approved") return "Approved";
  if (status === "rejected") return "Rejected";
  if (status === "completed") return "Completed";
  if (status === "monitoring") return "Monitoring";
  return "New";
}

function classForStatus(status: IBrainsOpportunityStatus): string {
  if (status === "completed" || status === "approved") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (status === "needs_approval") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }
  if (status === "draft_ready") {
    return "border-sky-200 bg-sky-50 text-sky-700";
  }
  if (status === "monitoring") {
    return "border-violet-200 bg-violet-50 text-violet-700";
  }
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function classForRisk(risk: IBrainsComplianceRisk): string {
  if (risk === "high") return "border-rose-200 bg-rose-50 text-rose-700";
  if (risk === "medium") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function formatProductOptionLabel(product: WalmartEffectiveProductRecord): string {
  return `${product.title} | SKU: ${product.sku}`;
}

function scoreClass(score: number): string {
  if (score >= 85) return "text-emerald-700";
  if (score >= 70) return "text-sky-700";
  if (score >= 50) return "text-amber-700";
  return "text-rose-700";
}

function normalizeConnectionLabel(connection: WalmartNetworkConnection): string {
  return hostFromUrl(connection.url) || connection.name;
}

export default function WalmartIBrainsIntelligenceClient({
  products,
  loadError,
  networkConnections = [],
}: WalmartIBrainsIntelligenceClientProps) {
  const [selectedSku, setSelectedSku] = useState(products[0]?.sku ?? "");
  const [runResult, setRunResult] = useState<IBrainsIntelligenceRun | null>(null);
  const [running, setRunning] = useState(false);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  const selectedProduct = useMemo(
    () => products.find((product) => product.sku === selectedSku) ?? null,
    [products, selectedSku]
  );

  const connectedProperties = useMemo(
    () => networkConnections.filter((connection) => connection.platform === "wordpress"),
    [networkConnections]
  );

  const draftOpportunities = useMemo(
    () =>
      runResult?.opportunities.filter(
        (opportunity) => opportunity.draftTitle?.trim() || opportunity.draftBody?.trim()
      ) ?? [],
    [runResult]
  );

  async function copyDraft(opportunity: IBrainsIntelligenceOpportunity): Promise<void> {
    const payload = `${opportunity.draftTitle ?? "Draft"}\n\n${opportunity.draftBody ?? ""}`.trim();
    if (!payload) {
      setCopyMessage("No draft text available to copy.");
      return;
    }

    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(payload);
        setCopyMessage("Draft copied for review.");
        return;
      }
      setCopyMessage("Clipboard is unavailable in this environment.");
    } catch {
      setCopyMessage("Could not copy draft right now.");
    }
  }

  function runIntelligence(): void {
    if (!selectedProduct) return;

    setRunning(true);
    setCopyMessage(null);

    const result = runWalmartIBrainsIntelligence(selectedProduct, {
      networkConnections,
    });
    setRunResult(result);
    setRunning(false);
  }

  return (
    <div className="space-y-4" data-testid="ibrains-intelligence-page">
      <WalmartPageHeader
        title="iBrains Intelligence"
        subtitle="Find and draft destination-aware web signals that help AI agents, search engines, and marketplaces discover, cite, recommend, and select your Walmart products."
      />

      <section className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5 shadow-[0_16px_36px_rgba(15,23,42,0.08)]">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <label className="text-sm text-[#334155]">
            Select product by name and SKU
            <select
              data-testid="ibrains-intelligence-product-select"
              value={selectedSku}
              onChange={(event) => setSelectedSku(event.target.value)}
              className="mt-1 w-full rounded-lg border border-[#D9E4F0] px-3 py-2"
              disabled={!products.length || running}
            >
              {!products.length ? <option value="">No products available</option> : null}
              {products.map((product) => (
                <option key={product.sku} value={product.sku}>
                  {formatProductOptionLabel(product)}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            data-testid="ibrains-intelligence-run-button"
            onClick={runIntelligence}
            disabled={!selectedProduct || running}
            className="rounded-lg border border-[#2563EB] bg-[#2563EB] px-4 py-2 text-sm font-medium text-white transition hover:border-[#1D4ED8] hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {running ? "Running iBrains Intelligence..." : "Run iBrains Intelligence"}
          </button>
        </div>

        <p className="mt-3 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-2 text-sm text-[#1E3A8A]">
          iBrains Intelligence creates drafts and recommendations. You approve before anything is published externally.
        </p>

        {loadError ? (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {loadError}
          </p>
        ) : null}

        {!products.length ? (
          <p className="mt-3 rounded-lg border border-dashed border-[#D9E4F0] px-3 py-2 text-sm text-[#64748B]">
            Import Walmart products first, then select a product to run iBrains Intelligence.
          </p>
        ) : null}
      </section>

      <section
        className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5 shadow-[0_16px_36px_rgba(15,23,42,0.08)]"
        data-testid="ibrains-intelligence-connected-properties"
      >
        <h2 className="text-lg font-semibold text-[#0F172A]">Connected Properties</h2>
        <p className="mt-1 text-sm text-[#475569]">Walmart Marketplace and connected properties available for destination-aware recommendations.</p>
        <ul className="mt-3 space-y-2">
          <li className="rounded-lg border border-[#E2E8F0] bg-[#F8FBFF] px-3 py-2 text-sm text-[#334155]">
            Walmart Marketplace - Connected
          </li>
          {connectedProperties.map((connection) => (
            <li key={connection.id} className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#334155]">
              {normalizeConnectionLabel(connection)} - WordPress - {connection.status === "connected" ? "Connected" : "Needs attention"}
            </li>
          ))}
          {connectedProperties.length === 0 ? (
            <li className="rounded-lg border border-dashed border-[#D9E4F0] px-3 py-2 text-sm text-[#64748B]">
              No connected WordPress properties yet. Add destinations in Network Connections.
            </li>
          ) : null}
        </ul>
      </section>

      {runResult ? (
        <section
          data-testid="ibrains-intelligence-summary"
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"
        >
          <article
            className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-4 shadow-[0_14px_34px_rgba(15,23,42,0.08)]"
            data-testid="ibrains-intelligence-score-card"
          >
            <p className="text-xs uppercase tracking-[0.12em] text-[#64748B]">Agentic Visibility Score</p>
            <p className={`mt-2 text-3xl font-semibold ${scoreClass(runResult.summary.agenticVisibilityScore)}`}>
              {runResult.summary.agenticVisibilityScore}
            </p>
            <p className="mt-1 text-xs text-[#64748B]">Optimized using iBrains scoring guidance.</p>
          </article>

          <article className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-4 shadow-[0_14px_34px_rgba(15,23,42,0.08)]">
            <p className="text-xs uppercase tracking-[0.12em] text-[#64748B]">Opportunities Found</p>
            <p className="mt-2 text-3xl font-semibold text-[#0F172A]">{runResult.summary.opportunitiesFound}</p>
          </article>

          <article className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-4 shadow-[0_14px_34px_rgba(15,23,42,0.08)]">
            <p className="text-xs uppercase tracking-[0.12em] text-[#64748B]">High-Impact Actions</p>
            <p className="mt-2 text-3xl font-semibold text-[#0F172A]">{runResult.summary.highImpactActions}</p>
          </article>

          <article className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-4 shadow-[0_14px_34px_rgba(15,23,42,0.08)]">
            <p className="text-xs uppercase tracking-[0.12em] text-[#64748B]">Compliance Warnings</p>
            <p className="mt-2 text-3xl font-semibold text-[#0F172A]">{runResult.summary.complianceWarnings}</p>
          </article>

          <article className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-4 shadow-[0_14px_34px_rgba(15,23,42,0.08)]">
            <p className="text-xs uppercase tracking-[0.12em] text-[#64748B]">Strong Destinations</p>
            <p className="mt-2 text-3xl font-semibold text-[#0F172A]">{runResult.summary.strongDestinationMatches}</p>
          </article>
        </section>
      ) : null}

      {runResult ? (
        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)]">
          <article
            className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5 shadow-[0_16px_36px_rgba(15,23,42,0.08)]"
            data-testid="ibrains-intelligence-opportunities-table"
          >
            <h2 className="text-lg font-semibold text-[#0F172A]">Destination-Aware Opportunities</h2>
            <p className="mt-1 text-sm text-[#475569]">
              Each recommendation shows where to place content, what to draft, and why it helps Agentic Visibility and Selection.
            </p>

            {runResult.summary.topDestinations.length > 0 ? (
              <div className="mt-3 rounded-lg border border-[#E2E8F0] bg-[#F8FBFF] px-3 py-2 text-sm text-[#334155]">
                <span className="font-medium text-[#0F172A]">Best destinations in your network: </span>
                {runResult.summary.topDestinations.map((destination) => destination.destinationName).join(", ")}
              </div>
            ) : (
              <div className="mt-3 rounded-lg border border-dashed border-[#D9E4F0] px-3 py-2 text-sm text-[#475569]">
                No strong matching connected property found for this topic yet. Use on Walmart listing, create a draft for manual use, or add a new WordPress property for this niche.
              </div>
            )}

            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-[0.1em] text-[#64748B]">
                  <tr>
                    <th className="py-2 pr-3">Opportunity</th>
                    <th className="py-2 pr-3">Recommended destination</th>
                    <th className="py-2 pr-3">Recommended action</th>
                    <th className="py-2 pr-3">Why this destination</th>
                    <th className="py-2 pr-3">Scores</th>
                    <th className="py-2 pr-3">Risk</th>
                    <th className="py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {runResult.opportunities.map((opportunity) => {
                    const highImpact = opportunity.agenticVisibilityScore >= 80;
                    return (
                      <tr
                        key={opportunity.id}
                        data-testid="ibrains-intelligence-opportunity-row"
                        className={`border-t border-[#E2E8F0] align-top ${highImpact ? "bg-[#F8FBFF]" : ""}`}
                      >
                        <td className="py-3 pr-3 text-[#334155]">
                          <p className="font-medium text-[#0F172A]">{opportunity.title}</p>
                          <p className="mt-1 text-xs text-[#64748B]">{opportunity.destination.contentAngle}</p>
                        </td>
                        <td className="py-3 pr-3 text-[#334155]">
                          <p className="font-medium text-[#0F172A]">{opportunity.destination.destinationName}</p>
                          <p className="mt-1 text-xs text-[#64748B]">
                            {opportunity.destination.destinationType === "wordpress_site"
                              ? "WordPress"
                              : opportunity.destination.destinationType === "marketplace_listing"
                                ? "Marketplace listing"
                                : "Manual"}
                          </p>
                        </td>
                        <td className="py-3 pr-3 text-[#334155]">{opportunity.recommendedAction}</td>
                        <td className="py-3 pr-3 text-[#334155]">{opportunity.destination.whyThisDestination}</td>
                        <td className="py-3 pr-3 text-[#334155]">
                          <p>Relevance: {opportunity.relevanceScore}</p>
                          <p>Citation: {opportunity.citationPotentialScore}</p>
                          <p>Agentic impact: {opportunity.agenticVisibilityScore}</p>
                        </td>
                        <td className="py-3 pr-3">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${classForRisk(opportunity.complianceRisk)}`}
                          >
                            {opportunity.complianceRisk.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-3">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${classForStatus(opportunity.status)}`}
                          >
                            {labelForStatus(opportunity.status)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </article>

          <article
            className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5 shadow-[0_16px_36px_rgba(15,23,42,0.08)]"
            data-testid="ibrains-intelligence-drafts-panel"
          >
            <h2 className="text-lg font-semibold text-[#0F172A]">Drafts and Recommendations</h2>
            <p className="mt-1 text-sm text-[#475569]">
              Review all drafts before approval. External publishing remains approval-first.
            </p>

            <ul className="mt-3 space-y-2">
              {draftOpportunities.map((opportunity) => (
                <li key={`${opportunity.id}-draft`} className="rounded-lg border border-[#E2E8F0] bg-[#F8FBFF] p-3">
                  <p className="text-sm font-semibold text-[#0F172A]">{opportunity.draftTitle}</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-[#334155]">{opportunity.draftBody}</p>
                  <button
                    type="button"
                    data-testid="ibrains-intelligence-copy-draft-button"
                    onClick={() => {
                      void copyDraft(opportunity);
                    }}
                    className="mt-2 rounded-lg border border-[#D9E4F0] bg-white px-3 py-1.5 text-xs font-medium text-[#0F172A] transition hover:bg-[#EFF6FF]"
                  >
                    Copy draft
                  </button>
                </li>
              ))}
              {!draftOpportunities.length ? (
                <li className="rounded-lg border border-dashed border-[#D9E4F0] p-3 text-sm text-[#64748B]">
                  No drafts generated yet.
                </li>
              ) : null}
            </ul>

            {copyMessage ? <p className="mt-3 text-sm text-[#334155]">{copyMessage}</p> : null}
          </article>
        </section>
      ) : null}
    </div>
  );
}
