import type { ShopifyAgenticWorkspaceState } from "@/lib/ecomviper/shopify/shopify-agentic-types";

interface ShopifyKnowledgeBasePanelProps {
  state: ShopifyAgenticWorkspaceState;
}

export default function ShopifyKnowledgeBasePanel({ state }: ShopifyKnowledgeBasePanelProps) {
  return (
    <section className="space-y-4" data-testid="ecomviper-shopify-knowledge-base-panel">
      <article className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5 shadow-[0_16px_36px_rgba(15,23,42,0.08)]">
        <h2 className="text-lg font-semibold text-[#0F172A]">Knowledge Base</h2>
        <p className="mt-1 text-sm text-[#475569]">
          FAQ question list, current answers, generated answers, gap status, and copy-ready output.
        </p>
        <p className="mt-2 text-xs text-[#64748B]">Data source: {state.workspaceSourceLabel}</p>
      </article>

      <article className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5 shadow-[0_16px_36px_rgba(15,23,42,0.08)]">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-[0.1em] text-[#64748B]">
              <tr>
                <th className="py-2 pr-3">Category</th>
                <th className="py-2 pr-3">Question</th>
                <th className="py-2 pr-3">Current Answer</th>
                <th className="py-2 pr-3">Generated Answer</th>
                <th className="py-2 pr-3">Gap Status</th>
              </tr>
            </thead>
            <tbody>
              {state.knowledgeBaseQuestions.map((question) => (
                <tr key={question.id} className="border-t border-[#E2E8F0] align-top text-[#334155]">
                  <td className="py-3 pr-3">
                    <span className="rounded-full border border-[#D9E4F0] bg-[#F8FBFF] px-2 py-1 text-xs text-[#334155]">
                      {question.category.replace("_", " ")}
                    </span>
                  </td>
                  <td className="py-3 pr-3">{question.question}</td>
                  <td className="py-3 pr-3">{question.currentAnswer || "Missing"}</td>
                  <td className="py-3 pr-3">{question.generatedAnswer}</td>
                  <td className="py-3 pr-3">
                    <p className="font-medium">{question.coverageStatus}</p>
                    {question.gapReason ? (
                      <p className="mt-1 text-xs text-[#64748B]">{question.gapReason}</p>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      <article className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5 shadow-[0_16px_36px_rgba(15,23,42,0.08)]">
        <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-[#64748B]">Copy-ready FAQ bundle</h3>
        <pre className="mt-3 whitespace-pre-wrap rounded-lg border border-[#E2E8F0] bg-[#F8FBFF] p-3 text-xs text-[#334155]">
          {state.knowledgeBaseSummary.generatedFaqBundle}
        </pre>
      </article>
    </section>
  );
}
