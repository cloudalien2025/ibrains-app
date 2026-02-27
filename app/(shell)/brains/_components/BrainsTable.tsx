"use client";

import Link from "next/link";
import CopyButton from "../../_components/CopyButton";
import StartRunDialog from "../../_components/StartRunDialog";

export type BrainView = {
  id: string;
  name: string;
  lastUpdated?: string | null;
};

type BrainsTableProps = {
  brains: BrainView[];
};

export default function BrainsTable({ brains }: BrainsTableProps) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-[0_30px_70px_rgba(2,6,23,0.5)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-slate-300/70">
            Active brains
          </div>
          <h3 className="mt-2 text-xl font-semibold text-white">Brains registry</h3>
        </div>
        <div className="text-xs text-slate-400">
          {brains.length} {brains.length === 1 ? "brain" : "brains"} detected
        </div>
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[540px] text-left text-sm text-slate-200">
          <thead className="text-xs uppercase tracking-[0.2em] text-slate-400/80">
            <tr>
              <th className="px-4 py-3">Brain ID</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Last updated</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {brains.map((brain) => (
              <tr
                key={brain.id}
                className="border-t border-white/10 text-slate-200"
              >
                <td className="px-4 py-3 font-mono text-xs text-slate-300">
                  <div className="flex flex-wrap items-center gap-2">
                    <span>{brain.id}</span>
                    <CopyButton value={brain.id} label="Copy ID" />
                  </div>
                </td>
                <td className="px-4 py-3 font-medium text-white">{brain.name}</td>
                <td className="px-4 py-3 text-slate-300">
                  {brain.lastUpdated || "Not reported"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <Link
                      href={`/brains/${brain.id}`}
                      className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white transition hover:bg-white/10"
                    >
                      Open
                    </Link>
                    <Link
                      href={`/brains/${brain.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white transition hover:bg-white/10"
                    >
                      Open in new tab
                    </Link>
                    <StartRunDialog
                      brainId={brain.id}
                      brainName={brain.name}
                    />
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
