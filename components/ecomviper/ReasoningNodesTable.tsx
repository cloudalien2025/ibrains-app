import NeonButton from "./NeonButton";

export type ReasoningNodeStatus = "Published" | "Missing" | "Linked";

export interface ReasoningNodeRow {
  topicNode: string;
  scheduledBlogPost: string;
  linkOut: string;
  status: ReasoningNodeStatus;
  actionLabel: string;
}

interface ReasoningNodesTableProps {
  rows: ReasoningNodeRow[];
}

function statusClasses(status: ReasoningNodeStatus): string {
  if (status === "Published") {
    return "border-emerald-300/30 bg-emerald-400/12 text-emerald-200";
  }
  if (status === "Linked") {
    return "border-cyan-300/35 bg-cyan-400/12 text-cyan-100";
  }
  return "border-amber-300/35 bg-amber-400/12 text-amber-100";
}

export default function ReasoningNodesTable({ rows }: ReasoningNodesTableProps) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-cyan-300/25 bg-cyan-400/5 p-6 text-sm text-slate-300">
        No linked blog nodes yet. Run a Shopify ingest from Integrations to populate reasoning links.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-cyan-300/20">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-900/90 text-xs uppercase tracking-[0.14em] text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium">Topic Node</th>
              <th className="px-4 py-3 font-medium">Scheduled Blog Post</th>
              <th className="px-4 py-3 font-medium">Link Out</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-cyan-300/10 bg-slate-950/45">
            {rows.map((row) => (
              <tr key={`${row.topicNode}-${row.scheduledBlogPost}`} className="hover:bg-white/[0.03]">
                <td className="px-4 py-3 text-slate-100">{row.topicNode}</td>
                <td className="px-4 py-3 text-slate-300">{row.scheduledBlogPost}</td>
                <td className="px-4 py-3 text-slate-300">{row.linkOut}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusClasses(row.status)}`}
                  >
                    {row.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <NeonButton variant={row.actionLabel === "Linked" ? "secondary" : "primary"}>
                    {row.actionLabel}
                  </NeonButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
