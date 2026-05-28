"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import TopBar from "@/components/ecomviper/TopBar";
import HudCard from "@/components/ecomviper/HudCard";
import NeonButton from "@/components/ecomviper/NeonButton";

const VERTICALS = ["home-services", "health-medical", "legal-financial", "hospitality-travel", "education", "general"] as const;

export default function DirectoryIqSettingsClient() {
  const [verticalOverride, setVerticalOverride] = useState<string>("");
  const [imageStyle, setImageStyle] = useState("editorial clean");
  const [riskOverrides, setRiskOverrides] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const settingsRes = await fetch("/api/directoryiq/settings", { cache: "no-store" });

      const settingsJson = (await settingsRes.json()) as {
        settings?: {
          verticalOverride: string | null;
          riskTierOverrides: Record<string, string>;
          imageStylePreference: string;
        };
      };
      if (settingsJson.settings) {
        setVerticalOverride(settingsJson.settings.verticalOverride ?? "");
        setRiskOverrides(settingsJson.settings.riskTierOverrides ?? {});
        setImageStyle(settingsJson.settings.imageStylePreference ?? "editorial clean");
      }
    })();
  }, []);

  async function saveSettings() {
    setError(null);
    const response = await fetch("/api/directoryiq/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vertical_override: verticalOverride || null,
        risk_tier_overrides: riskOverrides,
        image_style_preference: imageStyle,
      }),
    });
    const json = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(json.error ?? "Failed to save settings");
      return;
    }
    setNotice("Settings saved.");
  }

  return (
    <>
      <TopBar
        breadcrumbs={["Home", "DirectoryIQ", "Settings"]}
        searchPlaceholder="Search settings..."
      />

      {error ? <div className="rounded-xl border border-rose-300/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">{error}</div> : null}
      {notice ? <div className="rounded-xl border border-emerald-300/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">{notice}</div> : null}

      <HudCard title="Connections" subtitle="Manage website and AI connections in one place.">
        <div className="text-sm text-slate-300">
          Configure your website and AI providers in Connections.
        </div>
        <div className="mt-3">
          <Link href="/directoryiq/signal-sources">
            <NeonButton>Open Connections</NeonButton>
          </Link>
        </div>
      </HudCard>

      <HudCard title="Vertical + Risk Settings" subtitle="Internal modeling controls only (weights are never exposed).">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-slate-400">Vertical override</label>
            <select
              value={verticalOverride}
              onChange={(event) => setVerticalOverride(event.target.value)}
              className="w-full rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2 text-sm text-slate-100"
            >
              <option value="">Auto-detect</option>
              {VERTICALS.map((vertical) => (
                <option key={vertical} value={vertical}>{vertical}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs text-slate-400">Image style preference</label>
            <input
              value={imageStyle}
              onChange={(event) => setImageStyle(event.target.value)}
              className="w-full rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2 text-sm text-slate-100"
            />
          </div>
        </div>

        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {VERTICALS.map((vertical) => (
            <div key={vertical} className="rounded-xl border border-white/10 bg-white/[0.03] p-2">
              <div className="mb-1 text-xs text-slate-300">{vertical}</div>
              <select
                value={riskOverrides[vertical] ?? ""}
                onChange={(event) =>
                  setRiskOverrides((prev) => ({
                    ...prev,
                    [vertical]: event.target.value,
                  }))
                }
                className="w-full rounded-lg border border-white/15 bg-white/[0.04] px-2 py-1 text-xs text-slate-100"
              >
                <option value="">Default</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          ))}
        </div>

        <div className="mt-4">
          <NeonButton onClick={saveSettings}>Save Settings</NeonButton>
        </div>
      </HudCard>
    </>
  );
}
