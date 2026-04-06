"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type ToastState = {
  message: string;
  tone: "success" | "error";
};

type FormState = {
  name: string;
  slug: string;
  description: string;
  domain: string;
  agentName: string;
};

const initialFormState: FormState = {
  name: "",
  slug: "",
  description: "",
  domain: "",
  agentName: "",
};

function normalizeSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function looksLikeDuplicateError(message: string): boolean {
  const lowered = message.toLowerCase();
  return lowered.includes("duplicate") || lowered.includes("already exists") || lowered.includes("unique");
}

export default function CreateBrainDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(initialFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  function showToast(state: ToastState) {
    setToast(state);
    setTimeout(() => setToast(null), 4000);
  }

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  const normalizedSlug = useMemo(() => normalizeSlug(form.slug), [form.slug]);

  async function createBrain() {
    setIsSubmitting(true);
    setError(null);
    try {
      const name = form.name.trim();
      const slug = normalizeSlug(form.slug);
      const description = form.description.trim();
      const domain = form.domain.trim();
      const agentName = form.agentName.trim();

      if (!name || !slug || !description || !domain || !agentName) {
        const message = "Complete all required fields before creating a brain.";
        setError(message);
        showToast({ message, tone: "error" });
        return;
      }

      const res = await fetch("/api/brains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          slug,
          description,
          domain,
          agentName,
          status: "active",
        }),
      });

      const raw = await res.text();
      let payload: Record<string, unknown> | null = null;
      try {
        payload = raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
      } catch {
        payload = null;
      }

      if (!res.ok) {
        const message =
          (payload?.error as { message?: string } | undefined)?.message ||
          (typeof payload?.detail === "string" ? payload.detail : undefined) ||
          (typeof payload?.message === "string" ? payload.message : undefined) ||
          `Create Brain rejected with HTTP ${res.status}`;

        const friendlyMessage = looksLikeDuplicateError(message)
          ? "Slug already exists. Choose a unique slug."
          : message;
        setError(friendlyMessage);
        showToast({ message: friendlyMessage, tone: "error" });
        return;
      }

      const createdId =
        (typeof payload?.brain_id === "string" && payload.brain_id) ||
        (typeof payload?.id === "string" && payload.id) ||
        slug;

      showToast({
        message: `Brain created: ${name}`,
        tone: "success",
      });
      setOpen(false);
      setForm(initialFormState);
      router.push(`/brains/${encodeURIComponent(createdId)}`);
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
            className="rounded-full border border-emerald-400/30 bg-emerald-400/15 px-5 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-400/25"
          >
            Create Brain
          </button>
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/70 backdrop-blur-sm" />
          <Dialog.Content className="fixed left-1/2 top-1/2 w-[min(94vw,620px)] -translate-x-1/2 -translate-y-1/2 rounded-[28px] border border-white/10 bg-[#0b1222] p-6 text-slate-100 shadow-[0_40px_120px_rgba(2,6,23,0.7)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Dialog.Title className="text-xl font-semibold text-white">Create Brain</Dialog.Title>
                <Dialog.Description className="mt-2 text-sm text-slate-300">
                  Add a new brain with the minimum required configuration.
                </Dialog.Description>
              </div>
              <Dialog.Close className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200 transition hover:bg-white/10">
                Close
              </Dialog.Close>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <label className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-400/80">Brain Name</div>
                <input
                  type="text"
                  value={form.name}
                  onChange={(event) => updateField("name", event.target.value)}
                  placeholder="DirectoryIQ Pro"
                  className="mt-3 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                />
              </label>

              <label className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-400/80">Slug</div>
                <input
                  type="text"
                  value={form.slug}
                  onChange={(event) => updateField("slug", event.target.value)}
                  placeholder="directoryiq-pro"
                  className="mt-3 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                />
                <div className="mt-2 text-[11px] text-slate-400">
                  Saved as <span className="text-slate-200">{normalizedSlug || "invalid slug"}</span>
                </div>
              </label>

              <label className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-400/80">Domain</div>
                <input
                  type="text"
                  value={form.domain}
                  onChange={(event) => updateField("domain", event.target.value)}
                  placeholder="local directories"
                  className="mt-3 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                />
              </label>

              <label className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-400/80">Agent Name</div>
                <input
                  type="text"
                  value={form.agentName}
                  onChange={(event) => updateField("agentName", event.target.value)}
                  placeholder="Atlas"
                  className="mt-3 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                />
              </label>

              <label className="rounded-2xl border border-white/10 bg-white/5 p-4 md:col-span-2">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-400/80">Description</div>
                <textarea
                  value={form.description}
                  onChange={(event) => updateField("description", event.target.value)}
                  placeholder="Describe what this brain is responsible for."
                  rows={4}
                  className="mt-3 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                />
              </label>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={createBrain}
                disabled={isSubmitting}
                className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-5 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-400/20 disabled:opacity-60"
              >
                {isSubmitting ? "Creating..." : "Create Brain"}
              </button>
            </div>
            {error ? (
              <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-100">
                {error}
              </div>
            ) : null}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {toast ? (
        <div className="fixed right-6 top-6 z-50 rounded-2xl border border-white/10 bg-[#0b1222] px-4 py-3 text-sm text-white shadow-[0_20px_50px_rgba(2,6,23,0.6)]">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-400/80">
            {toast.tone === "success" ? "Brain Created" : "Action Needed"}
          </div>
          <div className="mt-1 text-sm text-slate-100">{toast.message}</div>
        </div>
      ) : null}
    </>
  );
}
