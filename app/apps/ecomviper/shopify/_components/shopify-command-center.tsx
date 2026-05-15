import ShopifyReadinessCard from "@/app/apps/ecomviper/shopify/_components/shopify-readiness-card";
import type { ShopifyAgenticWorkspaceState } from "@/lib/ecomviper/shopify/shopify-agentic-types";

interface ShopifyCommandCenterProps {
  state: ShopifyAgenticWorkspaceState;
}

function mcpStatusClass(status: string): string {
  if (status === "reachable") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "mock_ready") return "border-sky-200 bg-sky-50 text-sky-700";
  if (status === "needs_credentials") return "border-violet-200 bg-violet-50 text-violet-700";
  if (status === "failed") return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

export default function ShopifyCommandCenter({ state }: ShopifyCommandCenterProps) {
  const readinessDimensions = state.readiness.dimensions;

  return (
    <div className="space-y-4" data-testid="ecomviper-shopify-command-center-panel">
      <section className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5 shadow-[0_16px_36px_rgba(15,23,42,0.08)]">
        <h2 className="text-lg font-semibold text-[#0F172A]">Shopify Agentic Readiness Summary</h2>
        <p className="mt-1 text-sm text-[#475569]">
          Overall readiness score with MCP, Knowledge Base, catalog facts, policy coverage, supplement guardrails, and AI referral diagnostics.
        </p>
        <p className="mt-2 text-xs text-[#64748B]">Data source: {state.workspaceSourceLabel}</p>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3" data-testid="ecomviper-shopify-readiness-cards">
          <ShopifyReadinessCard dimension={readinessDimensions.storefrontMcpReadiness} />
          <ShopifyReadinessCard dimension={readinessDimensions.knowledgeBaseCoverage} />
          <ShopifyReadinessCard dimension={readinessDimensions.productFactsReadiness} />
          <ShopifyReadinessCard dimension={readinessDimensions.policyCoverage} />
          <ShopifyReadinessCard dimension={readinessDimensions.supplementComplianceSafety} />
          <ShopifyReadinessCard dimension={readinessDimensions.aiReferralReadiness} />
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5 shadow-[0_16px_36px_rgba(15,23,42,0.08)]">
          <h2 className="text-lg font-semibold text-[#0F172A]">Storefront MCP Connection</h2>
          <p className="mt-1 text-sm text-[#475569]">
            Endpoint candidates and diagnostics for storefront MCP readiness validation.
          </p>

          <ul className="mt-3 space-y-2 text-sm text-[#334155]" data-testid="ecomviper-shopify-mcp-endpoints">
            {state.storefrontMcpEndpoints.map((endpoint) => (
              <li key={endpoint.id} className="rounded-lg border border-[#E2E8F0] bg-[#F8FBFF] px-3 py-2">
                <p className="font-medium text-[#0F172A]">{endpoint.label}</p>
                <p className="mt-1 break-all text-xs text-[#64748B]">{endpoint.url}</p>
              </li>
            ))}
          </ul>

          <ul className="mt-3 space-y-2" data-testid="ecomviper-shopify-mcp-diagnostics">
            {state.mcpDiagnostics.map((diagnostic) => (
              <li key={diagnostic.endpoint.id} className="rounded-lg border border-[#E2E8F0] bg-white p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-[#0F172A]">{diagnostic.endpoint.label}</p>
                  <span className={`rounded-full border px-2 py-0.5 text-xs ${mcpStatusClass(diagnostic.status)}`}>
                    {diagnostic.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[#64748B]">{diagnostic.message}</p>
              </li>
            ))}
          </ul>

          <p className="mt-3 text-xs text-[#64748B]">
            Diagnostic states: not_configured, mock_ready, reachable, failed, needs_credentials.
          </p>
        </article>

        <article className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5 shadow-[0_16px_36px_rgba(15,23,42,0.08)]">
          <h2 className="text-lg font-semibold text-[#0F172A]">Knowledge Base Coverage</h2>
          <p className="mt-1 text-sm text-[#475569]">
            FAQ coverage, policy gaps, guardrails, and query log placeholders for agentic support answers.
          </p>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <p className="rounded-lg border border-[#E2E8F0] bg-[#F8FBFF] px-3 py-2 text-sm text-[#334155]">
              Generated FAQ coverage: <span className="font-semibold">{state.knowledgeBaseSummary.coveragePercent}%</span>
            </p>
            <p className="rounded-lg border border-[#E2E8F0] bg-[#F8FBFF] px-3 py-2 text-sm text-[#334155]">
              Missing buyer questions: <span className="font-semibold">{state.knowledgeBaseSummary.missingBuyerQuestions}</span>
            </p>
            <p className="rounded-lg border border-[#E2E8F0] bg-[#F8FBFF] px-3 py-2 text-sm text-[#334155]">
              Policy gaps: <span className="font-semibold">{state.knowledgeBaseSummary.policyGapCount}</span>
            </p>
            <p className="rounded-lg border border-[#E2E8F0] bg-[#F8FBFF] px-3 py-2 text-sm text-[#334155]">
              Brand voice guardrails: <span className="font-semibold">{state.knowledgeBaseSummary.brandVoiceGuardrails.length}</span>
            </p>
          </div>

          <div className="mt-3 rounded-lg border border-[#E2E8F0] bg-white p-3">
            <p className="text-xs uppercase tracking-[0.08em] text-[#64748B]">Agentic query log placeholder</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[#334155]">
              {state.knowledgeBaseSummary.queryLogPlaceholder.map((entry) => (
                <li key={entry}>{entry}</li>
              ))}
            </ul>
          </div>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5 shadow-[0_16px_36px_rgba(15,23,42,0.08)]">
          <h2 className="text-lg font-semibold text-[#0F172A]">AI Test Queries</h2>
          <ul className="mt-3 space-y-2" data-testid="ecomviper-shopify-test-queries">
            {state.testQueries.map((query) => (
              <li key={query.id} className="rounded-lg border border-[#E2E8F0] bg-[#F8FBFF] px-3 py-2 text-sm text-[#334155]">
                {query.query}
              </li>
            ))}
          </ul>
        </article>

        <article className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5 shadow-[0_16px_36px_rgba(15,23,42,0.08)]" data-testid="ecomviper-shopify-next-best-actions">
          <h2 className="text-lg font-semibold text-[#0F172A]">Next Best Actions</h2>
          <p className="mt-1 text-sm text-[#475569]">Ranked by likely impact on AI referrals.</p>
          <ol className="mt-3 space-y-2 text-sm text-[#334155]">
            {state.nextBestActions.map((action, index) => (
              <li key={action.id} className="rounded-lg border border-[#E2E8F0] bg-[#F8FBFF] px-3 py-2">
                <p className="font-medium text-[#0F172A]">{index + 1}. {action.title}</p>
                <p className="mt-1 text-xs text-[#64748B]">
                  Impact: {action.impact} · Effort: {action.effort} · Lane: {action.lane}
                </p>
              </li>
            ))}
          </ol>
        </article>
      </section>
    </div>
  );
}
