import type { ShopifyAgenticWorkspaceState } from "@/lib/ecomviper/shopify/shopify-agentic-types";

interface ShopifyPromptMatchPanelProps {
  state: ShopifyAgenticWorkspaceState;
}

function statusClass(status: "matched" | "partial" | "gap"): string {
  if (status === "matched") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "partial") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-rose-200 bg-rose-50 text-rose-700";
}

export default function ShopifyPromptMatchPanel({ state }: ShopifyPromptMatchPanelProps) {
  return (
    <section className="space-y-4" data-testid="ecomviper-shopify-prompt-match-panel">
      <article className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5 shadow-[0_16px_36px_rgba(15,23,42,0.08)]">
        <h2 className="text-lg font-semibold text-[#0F172A]">Prompt Match</h2>
        <p className="mt-1 text-sm text-[#475569]">
          Buyer/AI-agent query matching with confidence, gap warnings, and suggested Knowledge Base answers.
        </p>
        <p className="mt-2 text-xs text-[#64748B]">Data source: {state.workspaceSourceLabel}</p>
      </article>

      <div className="grid gap-3">
        {state.testQueries.map((query) => (
          <article key={query.id} className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-4 shadow-[0_16px_36px_rgba(15,23,42,0.08)]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-[#0F172A]">{query.query}</p>
              <span className={`rounded-full border px-2 py-0.5 text-xs ${statusClass(query.status)}`}>
                {query.status}
              </span>
            </div>
            <p className="mt-2 text-xs text-[#64748B]">Matched resource: {query.matchedResource}</p>
            <p className="mt-1 text-xs text-[#64748B]">Match confidence: {query.matchConfidence}%</p>
            {query.missingAnswerWarning ? (
              <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800">
                {query.missingAnswerWarning}
              </p>
            ) : null}
            <p className="mt-2 text-sm text-[#334155]">
              Suggested Knowledge Base answer: {query.suggestedKnowledgeBaseAnswer}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
