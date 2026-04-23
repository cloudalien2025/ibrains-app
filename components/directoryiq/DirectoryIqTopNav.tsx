"use client";

import { useState } from "react";
import Link from "next/link";
import { Building2, RefreshCw } from "lucide-react";
import NeonButton from "@/components/ecomviper/NeonButton";

type Props = {
  connected: boolean;
  verticalDetected: string;
  verticalOverride: string | null;
  lastAnalyzedAt: string | null;
  onRefresh?: () => Promise<void>;
  onVerticalOverride?: (value: string | null) => Promise<void>;
};

const VERTICALS = [
  { value: "", label: "Auto-detect" },
  { value: "home-services", label: "Home Services" },
  { value: "health-medical", label: "Health & Medical" },
  { value: "legal-financial", label: "Legal & Financial" },
  { value: "hospitality-travel", label: "Hospitality & Travel" },
  { value: "education", label: "Education" },
  { value: "general", label: "General" },
];

export default function DirectoryIqTopNav({
  connected,
  verticalDetected,
  verticalOverride,
  lastAnalyzedAt,
  onRefresh,
  onVerticalOverride,
}: Props) {
  const [busy, setBusy] = useState(false);
  const connectionHref = "/apps/directoryiq/signal-sources?connector=brilliant-directories";

  async function handleRefresh() {
    if (!onRefresh) return;
    setBusy(true);
    try {
      await onRefresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleOverride(next: string) {
    if (!onVerticalOverride) return;
    setBusy(true);
    try {
      await onVerticalOverride(next || null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-4 shadow-[0_16px_36px_rgba(15,23,42,0.08)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center gap-2 rounded-xl border border-[#D9E4F0] bg-[#EAF1F8] px-3 py-2 text-sm font-semibold text-[#0F172A]">
            <Building2 className="h-4 w-4" />
            DirectoryIQ
          </div>
          <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${connected ? "border-emerald-200 bg-emerald-100 text-emerald-700" : "border-amber-200 bg-amber-100 text-amber-700"}`}>
            {connected ? "Website Connected" : "Website Not Connected"}
          </span>
          <Link
            href={connectionHref}
            className="rounded-lg border border-[#93C5FD] bg-[#EAF1F8] px-2.5 py-1 text-xs font-medium text-[#2563EB] hover:bg-[#DBEAFE]"
          >
            {connected ? "Manage Website Connection" : "Connect Website"}
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-[#64748B]">
          <span>Detected Vertical: <span className="text-[#0F172A]">{verticalDetected}</span></span>
          <select
            value={verticalOverride ?? ""}
            onChange={(event) => void handleOverride(event.target.value)}
            className="rounded-lg border border-[#D9E4F0] bg-white px-2 py-1 text-xs text-[#0F172A]"
          >
            {VERTICALS.map((vertical) => (
              <option key={vertical.label} value={vertical.value}>
                {vertical.label}
              </option>
            ))}
          </select>
          <span>Last analyzed: {lastAnalyzedAt ? new Date(lastAnalyzedAt).toLocaleString() : "Never"}</span>
          {onRefresh ? (
            <NeonButton onClick={handleRefresh} disabled={busy}>
              <RefreshCw className={`mr-1 h-4 w-4 ${busy ? "animate-spin" : ""}`} />
              Refresh Analysis
            </NeonButton>
          ) : null}
        </div>
      </div>
    </section>
  );
}
