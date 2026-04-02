"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type StartRunDialogProps = {
  brainId: string;
  brainName: string;
};

type ToastState = {
  message: string;
  tone: "success" | "error";
};

export default function StartRunDialog({ brainId, brainName }: StartRunDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [limit, setLimit] = useState(20);
  const [keyword, setKeyword] = useState(brainName);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  const apiSnippet = useMemo(() => {
    return `curl -X POST http://127.0.0.1:3001/api/brains/${brainId}/ingest -H "Content-Type: application/json" -d '{"keyword":"${keyword.replace(/"/g, '\\"')}","selected_new":${limit},"n_new_videos":${limit},"max_candidates":50,"mode":"audio_first"}'`;
  }, [brainId, keyword, limit]);

  function clampLimit(value: number) {
    if (Number.isNaN(value)) return 50;
    return Math.min(200, Math.max(1, value));
  }

  function showToast(state: ToastState) {
    setToast(state);
    setTimeout(() => setToast(null), 4000);
  }

  async function startRun() {
    setIsSubmitting(true);
    setError(null);

    try {
      if (!brainId) {
        const message = "Brain ID is missing. Reload and try again.";
        setError(message);
        showToast({ message, tone: "error" });
        return;
      }

      const trimmedKeyword = keyword.trim();
      if (!trimmedKeyword) {
        const message = "Discovery keyword is required.";
        setError(message);
        showToast({ message, tone: "error" });
        return;
      }

      const res = await fetch(`/api/brains/${brainId}/ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword: trimmedKeyword,
          selected_new: limit,
          n_new_videos: limit,
          max_candidates: 50,
          mode: "audio_first",
        }),
      });

      const raw = await res.text();
      let payload: any = null;
      try {
        payload = raw ? JSON.parse(raw) : null;
      } catch {
        payload = null;
      }

      if (!res.ok) {
        const reason = payload?.error?.message || payload?.message;
        const message = reason
          ? `Unable to start ingest: ${reason}`
          : `Unable to start ingest (HTTP ${res.status}).`;
        setError(message);
        showToast({ message, tone: "error" });
        return;
      }

      const runId = payload?.run_id || payload?.id;
      if (!runId) {
        const message = "Ingest started, but no run ID was returned.";
        setError(message);
        showToast({ message, tone: "error" });
        return;
      }

      showToast({ message: `Ingest started: ${runId}`, tone: "success" });
      setTimeout(() => {
        router.push(`/runs/${runId}`);
      }, 600);
      setOpen(false);
    } catch (e) {
      const message = e instanceof Error ? `Unable to start ingest: ${e.message}` : "Unable to start ingest.";
      setError(message);
      showToast({ message, tone: "error" });
    } finally {
      setIsSubmitting(false);
    }
  }

  function copySnippet() {
    if (!apiSnippet) return;
    void navigator.clipboard?.writeText(apiSnippet);
    showToast({ message: "Request copied to clipboard.", tone: "success" });
  }

  return (
    <>
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Trigger asChild>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm font-medium text-emerald-100 transition hover:bg-emerald-400/20"
          >
            Run Ingest
          </button>
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/70 backdrop-blur-sm" />
          <Dialog.Content className="fixed left-1/2 top-1/2 w-[min(94vw,560px)] -translate-x-1/2 -translate-y-1/2 rounded-[28px] border border-white/10 bg-[#0b1222] p-6 text-slate-100 shadow-[0_40px_120px_rgba(2,6,23,0.7)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Dialog.Title className="text-xl font-semibold text-white">
                  Run Ingest
                </Dialog.Title>
                <Dialog.Description className="mt-2 text-sm text-slate-300">
                  Start a new ingest for <span className="font-medium text-white">{brainName} Brain</span>.
                </Dialog.Description>
              </div>
              <Dialog.Close className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200 transition hover:bg-white/10">
                Close
              </Dialog.Close>
            </div>

            <div className="mt-6 space-y-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-400/80">
                  Discovery keyword
                </div>
                <input
                  type="text"
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                  className="mt-3 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                />
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-400/80">
                  New items to process
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <input
                    type="number"
                    min={1}
                    max={200}
                    value={limit}
                    onChange={(event) =>
                      setLimit(clampLimit(Number(event.target.value)))
                    }
                    className="w-28 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                  />
                  <span className="text-xs text-slate-400">
                    1-200 items for this ingest cycle.
                  </span>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={startRun}
                    disabled={isSubmitting}
                    className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-1 text-xs font-medium text-emerald-100 transition hover:bg-emerald-400/20 disabled:opacity-60"
                  >
                    {isSubmitting ? "Starting..." : "Start ingest"}
                  </button>
                  <button
                    type="button"
                    onClick={copySnippet}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white transition hover:bg-white/10"
                  >
                    Copy request
                  </button>
                </div>

                <details className="mt-3 rounded-xl border border-white/10 bg-black/30 p-3">
                  <summary className="cursor-pointer text-xs uppercase tracking-[0.16em] text-slate-400/80">
                    Developer details
                  </summary>
                  <pre className="mt-3 overflow-x-auto rounded-xl bg-black/50 p-3 text-xs text-slate-200">
                    {apiSnippet}
                  </pre>
                </details>

                {error ? (
                  <div className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-100">
                    {error}
                  </div>
                ) : null}
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {toast ? (
        <div className="fixed right-6 top-6 z-50 rounded-2xl border border-white/10 bg-[#0b1222] px-4 py-3 text-sm text-white shadow-[0_20px_50px_rgba(2,6,23,0.6)]">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-400/80">
            {toast.tone === "success" ? "Ingest update" : "Action needed"}
          </div>
          <div className="mt-1 text-sm text-slate-100">{toast.message}</div>
        </div>
      ) : null}
    </>
  );
}
