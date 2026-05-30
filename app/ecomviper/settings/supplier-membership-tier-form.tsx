"use client";

import { useMemo, useState } from "react";

interface SupplierMembershipTierFormProps {
  detectedTiers: string[];
  initialTier: string | null;
}

export default function SupplierMembershipTierForm({
  detectedTiers,
  initialTier,
}: SupplierMembershipTierFormProps) {
  const normalizedDetectedTiers = useMemo(
    () => Array.from(new Set(detectedTiers.map((entry) => entry.trim()).filter(Boolean))),
    [detectedTiers]
  );
  const [selectedTier, setSelectedTier] = useState<string>(initialTier || "");
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function handleSave() {
    setStatus("saving");
    setMessage(null);
    try {
      const response = await fetch("/api/ecomviper/settings/supplier-membership", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          membershipTier: selectedTier || null,
        }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        membershipTier?: string | null;
        error?: { message?: string };
      };
      if (!response.ok || !body.ok) {
        throw new Error(body.error?.message || "Could not save supplier membership tier.");
      }
      setSelectedTier(body.membershipTier || "");
      setStatus("success");
      setMessage("Membership tier saved.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Could not save supplier membership tier.");
    }
  }

  return (
    <section className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-4" data-testid="supplier-membership-tier-settings">
      <h2 className="text-base font-semibold text-[#0F172A]">Supplier Membership Tier</h2>
      <p className="mt-1 text-sm text-[#475569]">
        Select membership tier to calculate SKU cost, profit, and margin in Product Editor Commerce.
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="grid gap-1 text-sm text-[#334155]">
          Membership tier
          <select
            value={selectedTier}
            onChange={(event) => setSelectedTier(event.target.value)}
            className="min-w-[260px] rounded-lg border border-[#D9E4F0] px-3 py-2 text-sm"
          >
            <option value="">Select membership tier</option>
            {normalizedDetectedTiers.map((tier) => (
              <option key={tier} value={tier}>
                {tier}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={handleSave}
          disabled={status === "saving"}
          className="rounded-lg border border-[#1D4ED8] bg-[#1D4ED8] px-3 py-2 text-sm font-medium text-white disabled:opacity-70"
        >
          {status === "saving" ? "Saving..." : "Save"}
        </button>
      </div>
      {selectedTier ? (
        <p className="mt-2 text-xs text-[#64748B]">Selected tier: {selectedTier}</p>
      ) : (
        <p className="mt-2 text-xs text-[#64748B]">
          Select membership tier in Settings to calculate cost and profit.
        </p>
      )}
      {message ? (
        <p className={`mt-2 text-sm ${status === "error" ? "text-rose-700" : "text-emerald-700"}`}>{message}</p>
      ) : null}
    </section>
  );
}
