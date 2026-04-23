"use client";

import Link from "next/link";
import CopyButton from "../../_components/CopyButton";
import RunStatusBadge from "./RunStatusBadge";

export type RunView = {
  id: string;
  brainId?: string | null;
  status?: string | null;
  startedAt?: string | null;
};

type RunListProps = {
  runs: RunView[];
};

export default function RunList({ runs }: RunListProps) {
  return (
    <div className="rounded-[28px] border border-[#D9E4F0] bg-white/95 p-6 shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#D9E4F0] pb-4">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-[#64748B]">
            Recent activity
          </div>
          <h3 className="mt-2 text-xl font-semibold text-[#0F172A]">Recent runs</h3>
        </div>
        <div className="text-xs text-[#64748B]">
          {runs.length} {runs.length === 1 ? "run" : "runs"}
        </div>
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-sm text-[#334155]">
          <thead className="text-xs uppercase tracking-[0.2em] text-[#64748B]">
            <tr>
              <th className="px-4 py-3">Run ID</th>
              <th className="px-4 py-3">Brain ID</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Started</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <tr
                key={run.id}
                className="border-t border-[#D9E4F0] text-[#334155]"
              >
                <td className="px-4 py-3 font-mono text-xs text-[#64748B]">
                  <div className="flex flex-wrap items-center gap-2">
                    <span>{run.id}</span>
                    <CopyButton value={run.id} label="Copy ID" />
                  </div>
                </td>
                <td className="px-4 py-3 text-[#334155]">
                  {run.brainId || "Unknown"}
                </td>
                <td className="px-4 py-3">
                  <RunStatusBadge status={run.status} />
                </td>
                <td className="px-4 py-3 text-[#334155]">
                  {run.startedAt || "Not reported"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap justify-end gap-2">
                    <Link
                      href={`/runs/${run.id}`}
                      className="rounded-full border border-[#D9E4F0] bg-white px-3 py-1 text-xs font-medium text-[#0F172A] transition hover:bg-[#F8FBFF]"
                    >
                      View
                    </Link>
                    <Link
                      href={`/runs/${run.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full border border-[#D9E4F0] bg-white px-3 py-1 text-xs font-medium text-[#0F172A] transition hover:bg-[#F8FBFF]"
                    >
                      Open in new tab
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
