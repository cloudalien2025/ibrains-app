"use client";

import { useState } from "react";
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
    <section className="rounded-2xl border border-cyan-300/20 bg-slate-950/55 p-4 backdrop-blur-xl shadow-[0_20px_45px_rgba(2,6,23,0.75)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/25 bg-cyan-400/10 px-3 py-2 text-sm font-semibold text-cyan-100">
            <Building2 className="h-4 w-4" />
            DirectoryIQ
          </div>
          <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${connected ? "border-emerald-300/40 bg-emerald-400/10 text-emerald-100" : "border-amber-300/40 bg-amber-400/10 text-amber-100"}`}>
            {connected ? "Website Connected" : "Website Not Connected"}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
          <span>Detected Vertical: <span className="text-slate-100">{verticalDetected}</span></span>
          <select
            value={verticalOverride ?? ""}
            onChange={(event) => void handleOverride(event.target.value)}
            className="rounded-lg border border-white/15 bg-white/[0.04] px-2 py-1 text-xs text-slate-100"
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
