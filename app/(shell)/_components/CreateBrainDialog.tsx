"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useRouter } from "next/navigation";
import { useState } from "react";

type ToastState = {
  message: string;
  tone: "success" | "error";
};

export default function CreateBrainDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [brainType, setBrainType] = useState<"BD" | "UAP">("BD");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  function showToast(state: ToastState) {
    setToast(state);
    setTimeout(() => setToast(null), 4000);
  }

  async function createBrain() {
    setIsSubmitting(true);
    setError(null);
    try {
      const trimmed = name.trim();
      if (!trimmed) {
        const message = "Brain name is required.";
        setError(message);
        showToast({ message, tone: "error" });
        return;
      }

      const res = await fetch("/api/brains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, brain_type: brainType }),
      });

      const raw = await res.text();
      let payload: any = null;
      try {
        payload = raw ? JSON.parse(raw) : null;
      } catch {
        payload = null;
      }

      if (!res.ok) {
        const message =
          payload?.error?.message ||
          payload?.detail ||
          payload?.message ||
          `Create brain rejected with HTTP ${res.status}`;
        setError(message);
        showToast({ message, tone: "error" });
        return;
      }

      const createdId = payload?.brain_id || payload?.id;
      showToast({
        message: createdId ? `Brain created: ${createdId}` : "Brain created.",
        tone: "success",
      });
      setOpen(false);
      setName("");
      router.refresh();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unable to create brain";
      setError(message);
      showToast({ message, tone: "error" });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Trigger asChild>
          <button
            type="button"
            className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm font-medium text-emerald-100 transition hover:bg-emerald-400/20"
          >
            Create brain
          </button>
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/70 backdrop-blur-sm" />
          <Dialog.Content className="fixed left-1/2 top-1/2 w-[min(94vw,560px)] -translate-x-1/2 -translate-y-1/2 rounded-[28px] border border-white/10 bg-[#0b1222] p-6 text-slate-100 shadow-[0_40px_120px_rgba(2,6,23,0.7)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Dialog.Title className="text-xl font-semibold text-white">
                  Create brain
                </Dialog.Title>
                <Dialog.Description className="mt-2 text-sm text-slate-300">
                  Creates a canonical worker v1 brain entry.
                </Dialog.Description>
              </div>
              <Dialog.Close className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200 transition hover:bg-white/10">
                Close
              </Dialog.Close>
            </div>

            <div className="mt-6 space-y-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-400/80">
                  Brain name
                </div>
                <input
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Brilliant Directories"
                  className="mt-3 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                />
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-400/80">
                  Brain type
                </div>
                <select
                  value={brainType}
                  onChange={(event) => setBrainType(event.target.value === "UAP" ? "UAP" : "BD")}
                  className="mt-3 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                >
                  <option value="BD">BD</option>
                  <option value="UAP">UAP</option>
                </select>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={createBrain}
                  disabled={isSubmitting}
                  className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm font-medium text-emerald-100 transition hover:bg-emerald-400/20 disabled:opacity-60"
                >
                  {isSubmitting ? "Creating..." : "Create"}
                </button>
              </div>
              {error ? (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-100">
                  {error}
                </div>
              ) : null}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {toast ? (
        <div className="fixed right-6 top-6 z-50 rounded-2xl border border-white/10 bg-[#0b1222] px-4 py-3 text-sm text-white shadow-[0_20px_50px_rgba(2,6,23,0.6)]">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-400/80">
            {toast.tone === "success" ? "Brain update" : "Action needed"}
          </div>
          <div className="mt-1 text-sm text-slate-100">{toast.message}</div>
        </div>
      ) : null}
    </>
  );
}
