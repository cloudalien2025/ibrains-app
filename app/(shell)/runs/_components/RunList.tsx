"use client";

import Link from "next/link";
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
    <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-[0_30px_70px_rgba(2,6,23,0.5)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-slate-300/70">
            Recent activity
          </div>
          <h3 className="mt-2 text-xl font-semibold text-white">Recent runs</h3>
        </div>
        <div className="text-xs text-slate-400">
          {runs.length} {runs.length === 1 ? "run" : "runs"}
        </div>
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-sm text-slate-200">
          <thead className="text-xs uppercase tracking-[0.2em] text-slate-400/80">
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
                className="border-t border-white/10 text-slate-200"
              >
                <td className="px-4 py-3 font-mono text-xs text-slate-300">
                  {run.id}
                </td>
                <td className="px-4 py-3 text-slate-300">
                  {run.brainId || "Unknown"}
                </td>
                <td className="px-4 py-3">
                  <RunStatusBadge status={run.status} />
                </td>
                <td className="px-4 py-3 text-slate-300">
                  {run.startedAt || "Not reported"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end">
                    <Link
                      href={`/runs/${run.id}`}
                      className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white transition hover:bg-white/10"
                    >
                      View
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
