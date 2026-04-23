"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { isValidBrainSlug, normalizeBrainSlug } from "@/lib/brains/createBrain";

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

  const normalizedSlug = useMemo(() => normalizeBrainSlug(form.slug), [form.slug]);
  const slugIsValid = normalizedSlug.length > 0 && isValidBrainSlug(normalizedSlug);
  const slugHelperText =
    form.slug.trim().length === 0
      ? "Enter a lowercase slug"
      : slugIsValid
        ? normalizedSlug
        : "invalid slug";

  async function createBrain() {
    setIsSubmitting(true);
    setError(null);
    try {
      const name = form.name.trim();
      const slug = normalizeBrainSlug(form.slug);
      const description = form.description.trim();
      const domain = form.domain.trim();
      const agentName = form.agentName.trim();

      if (!name || !slug || !description || !domain || !agentName) {
        const message = "Complete all required fields before creating a brain.";
        setError(message);
        showToast({ message, tone: "error" });
        return;
      }
      if (!isValidBrainSlug(slug)) {
        const message = "Slug must use lowercase letters, numbers, and single hyphens.";
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
            className="rounded-full border border-[#2563EB] bg-[#2563EB] px-5 py-2 text-sm font-semibold text-white transition hover:border-[#1D4ED8] hover:bg-[#1D4ED8]"
          >
            Create Brain
          </button>
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/70 backdrop-blur-sm" />
          <Dialog.Content className="fixed left-1/2 top-1/2 w-[min(94vw,620px)] -translate-x-1/2 -translate-y-1/2 rounded-[28px] border border-[#D9E4F0] bg-[#F4F8FC] p-6 text-[#0F172A] shadow-[0_28px_80px_rgba(15,23,42,0.18)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Dialog.Title className="text-xl font-semibold text-[#0F172A]">Create Brain</Dialog.Title>
                <Dialog.Description className="mt-2 text-sm text-[#334155]">
                  Add a new brain with the minimum required configuration.
                </Dialog.Description>
              </div>
              <Dialog.Close className="rounded-full border border-[#D9E4F0] bg-white px-3 py-1 text-xs text-[#334155] transition hover:bg-[#F8FBFF]">
                Close
              </Dialog.Close>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <label className="rounded-2xl border border-[#D9E4F0] bg-white p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-[#64748B]">Brain Name</div>
                <input
                  type="text"
                  value={form.name}
                  onChange={(event) => updateField("name", event.target.value)}
                  placeholder="DirectoryIQ Pro"
                  className="mt-3 w-full rounded-xl border border-[#D9E4F0] bg-white px-3 py-2 text-sm text-[#0F172A]"
                />
              </label>

              <label className="rounded-2xl border border-[#D9E4F0] bg-white p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-[#64748B]">Slug</div>
                <input
                  type="text"
                  value={form.slug}
                  onChange={(event) => updateField("slug", event.target.value)}
                  placeholder="directoryiq-pro"
                  className="mt-3 w-full rounded-xl border border-[#D9E4F0] bg-white px-3 py-2 text-sm text-[#0F172A]"
                />
                <div className="mt-2 text-[11px] text-[#64748B]">
                  Saved as <span className="text-[#334155]">{slugHelperText}</span>
                </div>
              </label>

              <label className="rounded-2xl border border-[#D9E4F0] bg-white p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-[#64748B]">Topic</div>
                <input
                  type="text"
                  value={form.domain}
                  onChange={(event) => updateField("domain", event.target.value)}
                  placeholder="local business listings"
                  className="mt-3 w-full rounded-xl border border-[#D9E4F0] bg-white px-3 py-2 text-sm text-[#0F172A]"
                />
              </label>

              <label className="rounded-2xl border border-[#D9E4F0] bg-white p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-[#64748B]">Agent Name</div>
                <input
                  type="text"
                  value={form.agentName}
                  onChange={(event) => updateField("agentName", event.target.value)}
                  placeholder="Atlas"
                  className="mt-3 w-full rounded-xl border border-[#D9E4F0] bg-white px-3 py-2 text-sm text-[#0F172A]"
                />
              </label>

              <label className="rounded-2xl border border-[#D9E4F0] bg-white p-4 md:col-span-2">
                <div className="text-xs uppercase tracking-[0.2em] text-[#64748B]">Description</div>
                <textarea
                  value={form.description}
                  onChange={(event) => updateField("description", event.target.value)}
                  placeholder="Describe what this brain is responsible for."
                  rows={4}
                  className="mt-3 w-full rounded-xl border border-[#D9E4F0] bg-white px-3 py-2 text-sm text-[#0F172A]"
                />
              </label>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={createBrain}
                disabled={isSubmitting}
                className="rounded-full border border-[#2563EB] bg-[#2563EB] px-5 py-2 text-sm font-semibold text-white transition hover:border-[#1D4ED8] hover:bg-[#1D4ED8] disabled:opacity-60"
              >
                {isSubmitting ? "Creating..." : "Create Brain"}
              </button>
            </div>
            {error ? (
              <div className="mt-4 rounded-xl border border-rose-200 bg-rose-100 p-3 text-xs text-rose-700">
                {error}
              </div>
            ) : null}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {toast ? (
        <div className="fixed right-6 top-6 z-50 rounded-2xl border border-[#D9E4F0] bg-white px-4 py-3 text-sm text-[#0F172A] shadow-[0_16px_36px_rgba(15,23,42,0.12)]">
          <div className="text-xs uppercase tracking-[0.2em] text-[#64748B]">
            {toast.tone === "success" ? "Brain Created" : "Action Needed"}
          </div>
          <div className="mt-1 text-sm text-[#0F172A]">{toast.message}</div>
        </div>
      ) : null}
    </>
  );
}
