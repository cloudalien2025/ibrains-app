"use client";

import * as Dialog from "@radix-ui/react-dialog";
import Link from "next/link";
import { useMemo, useState } from "react";

export type BrainView = {
  id: string;
  name: string;
  lastUpdated?: string | null;
};

type BrainsTableProps = {
  brains: BrainView[];
};

export default function BrainsTable({ brains }: BrainsTableProps) {
  const [activeBrain, setActiveBrain] = useState<BrainView | null>(null);
  const [limit, setLimit] = useState(50);

  const apiSnippet = useMemo(() => {
    if (!activeBrain) return "";
    return `curl -X POST http://127.0.0.1:3001/api/brains/${activeBrain.id}/runs -H "Content-Type: application/json" -d '{"limit":${limit}}'`;
  }, [activeBrain, limit]);

  function copySnippet() {
    if (!apiSnippet) return;
    void navigator.clipboard?.writeText(apiSnippet);
  }

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
                  {brain.id}
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
                    <Dialog.Root onOpenChange={(open) => setActiveBrain(open ? brain : null)}>
                      <Dialog.Trigger asChild>
                        <button
                          type="button"
                          className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-100 transition hover:bg-emerald-400/20"
                        >
                          Start run
                        </button>
                      </Dialog.Trigger>
                      <Dialog.Portal>
                        <Dialog.Overlay className="fixed inset-0 bg-black/70 backdrop-blur-sm" />
                        <Dialog.Content className="fixed left-1/2 top-1/2 w-[min(94vw,560px)] -translate-x-1/2 -translate-y-1/2 rounded-[28px] border border-white/10 bg-[#0b1222] p-6 text-slate-100 shadow-[0_40px_120px_rgba(2,6,23,0.7)]">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <Dialog.Title className="text-xl font-semibold text-white">
                                Launch run
                              </Dialog.Title>
                              <Dialog.Description className="mt-2 text-sm text-slate-300">
                                Prepare the run request for <span className="font-medium text-white">{brain.name}</span>.
                              </Dialog.Description>
                            </div>
                            <Dialog.Close className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200 transition hover:bg-white/10">
                              Close
                            </Dialog.Close>
                          </div>

                          <div className="mt-6 space-y-4">
                            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                              <div className="text-xs uppercase tracking-[0.2em] text-slate-400/80">
                                Run limit
                              </div>
                              <div className="mt-3 flex items-center gap-3">
                                <input
                                  type="number"
                                  min={1}
                                  max={200}
                                  value={limit}
                                  onChange={(event) =>
                                    setLimit(
                                      Math.min(200, Math.max(1, Number(event.target.value)))
                                    )
                                  }
                                  className="w-28 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                                />
                                <span className="text-xs text-slate-400">
                                  1–200 documents per run.
                                </span>
                              </div>
                            </div>

                            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                              <div className="text-xs uppercase tracking-[0.2em] text-slate-400/80">
                                API request
                              </div>
                              <pre className="mt-3 overflow-x-auto rounded-xl bg-black/50 p-3 text-xs text-slate-200">
                                {apiSnippet}
                              </pre>
                              <div className="mt-3 flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={copySnippet}
                                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white transition hover:bg-white/10"
                                >
                                  Copy request
                                </button>
                                <Link
                                  href={`/brains/${brain.id}`}
                                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white transition hover:bg-white/10"
                                >
                                  Open brain
                                </Link>
                              </div>
                            </div>
                          </div>
                        </Dialog.Content>
                      </Dialog.Portal>
                    </Dialog.Root>
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
