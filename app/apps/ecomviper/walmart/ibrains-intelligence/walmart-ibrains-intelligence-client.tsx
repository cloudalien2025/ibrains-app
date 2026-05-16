"use client";

import { useMemo, useState } from "react";
import WalmartPageHeader from "@/app/apps/ecomviper/walmart/_components/page-header";
import type { WalmartEffectiveProductRecord } from "@/lib/ecomviper/walmart/walmart-product-display";
import {
  runWalmartIBrainsIntelligence,
  type IBrainsComplianceRisk,
  type IBrainsIntelligenceOpportunity,
  type IBrainsIntelligenceRun,
  type IBrainsOpportunityStatus,
  type IBrainsOpportunityType,
} from "@/lib/ecomviper/walmart/walmart-ibrains-intelligence";

interface WalmartIBrainsIntelligenceClientProps {
  products: WalmartEffectiveProductRecord[];
  loadError?: string | null;
}

function labelForOpportunityType(type: IBrainsOpportunityType): string {
  if (type === "citation") return "Citation opportunities";
  if (type === "community") return "Community/Q&A opportunities";
  if (type === "marketplace") return "Marketplace optimization opportunities";
  if (type === "owned_content") return "Owned content opportunities";
  if (type === "image_media") return "Image and media opportunities";
  if (type === "backlink_outreach") return "Backlink/outreach opportunities";
  if (type === "competitor_gap") return "Competitor gap opportunities";
  return "FAQ/content gap opportunities";
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

export default function WalmartIBrainsIntelligenceClient({
  products,
  loadError,
}: WalmartIBrainsIntelligenceClientProps) {
  const [selectedSku, setSelectedSku] = useState(products[0]?.sku ?? "");
  const [runResult, setRunResult] = useState<IBrainsIntelligenceRun | null>(null);
  const [running, setRunning] = useState(false);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  const selectedProduct = useMemo(
    () => products.find((product) => product.sku === selectedSku) ?? null,
    [products, selectedSku]
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

    const result = runWalmartIBrainsIntelligence(selectedProduct);
    setRunResult(result);
    setRunning(false);
  }

  return (
    <div className="space-y-4" data-testid="ibrains-intelligence-page">
      <WalmartPageHeader
        title="iBrains Intelligence"
        subtitle="Find and create trusted web signals that help AI agents, search engines, marketplaces, and recommendation systems discover, cite, recommend, and select your Walmart products."
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
          iBrains Intelligence discovers and drafts. You approve before anything is published externally.
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
            <p className="mt-1 text-xs text-[#64748B]">Product: {runResult.productName}</p>
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
            <p className="text-xs uppercase tracking-[0.12em] text-[#64748B]">Drafts Ready</p>
            <p className="mt-2 text-3xl font-semibold text-[#0F172A]">{runResult.summary.draftsReady}</p>
          </article>
        </section>
      ) : null}

      {runResult ? (
        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)]">
          <article
            className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5 shadow-[0_16px_36px_rgba(15,23,42,0.08)]"
            data-testid="ibrains-intelligence-opportunities-table"
          >
            <h2 className="text-lg font-semibold text-[#0F172A]">Opportunity Intelligence</h2>
            <p className="mt-1 text-sm text-[#475569]">
              Prioritized opportunities to improve Agentic Visibility and Selection. High-impact rows are highlighted.
            </p>

            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-[0.1em] text-[#64748B]">
                  <tr>
                    <th className="py-2 pr-3">Category</th>
                    <th className="py-2 pr-3">Opportunity</th>
                    <th className="py-2 pr-3">Scores</th>
                    <th className="py-2 pr-3">Risk</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2">Recommended action</th>
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
                        <td className="py-3 pr-3 text-[#334155]">{labelForOpportunityType(opportunity.type)}</td>
                        <td className="py-3 pr-3 text-[#334155]">
                          <p className="font-medium text-[#0F172A]">{opportunity.title}</p>
                          <p className="mt-1 text-xs text-[#64748B]">
                            {opportunity.sourceName} ({opportunity.sourceDomain})
                          </p>
                          {highImpact ? (
                            <p className="mt-1 text-xs font-medium text-[#1D4ED8]">High-impact priority</p>
                          ) : null}
                        </td>
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
                        <td className="py-3 pr-3">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${classForStatus(opportunity.status)}`}
                          >
                            {labelForStatus(opportunity.status)}
                          </span>
                        </td>
                        <td className="py-3 text-[#334155]">
                          <p>{opportunity.recommendedAction}</p>
                          <p className="mt-1 text-xs text-[#64748B]">{opportunity.rationale}</p>
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
