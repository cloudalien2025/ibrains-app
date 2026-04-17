"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { brainTheme } from "@/components/brain-dock/brainTheme";

const quickSuggestions = ["Health & Wellness", "Ecommerce", "Coaching", "SaaS"];

const buildSteps = ["Planning", "Writing", "Building", "Reviewing", "Finalizing"];

const buildActivity = [
  "Got it. I'm building your website.",
  "Planning your site structure",
  "Creating homepage, about, and contact pages",
  "Writing conversion-focused copy",
  "Applying layout and styling",
  "Finalizing your site",
];

function Stepper({ activeStep }: { activeStep: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-5">
      <div className="flex items-center justify-between gap-3 overflow-x-auto">
        {buildSteps.map((step, index) => {
          const complete = index < activeStep;
          const active = index === activeStep;
          const tone = complete
            ? "border-emerald-300/60 bg-emerald-300/20 text-emerald-100"
            : active
              ? "border-cyan-300/60 bg-cyan-300/15 text-cyan-100"
              : "border-white/20 bg-white/5 text-slate-300";

          return (
            <div key={step} className="flex min-w-max items-center gap-3">
              <div className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold ${tone}`}>
                {index + 1}
              </div>
              <div className="text-sm font-medium text-slate-100">{step}</div>
              {index < buildSteps.length - 1 ? (
                <div className={`h-px w-12 ${index < activeStep ? "bg-emerald-300/50" : "bg-white/15"}`} />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function SiteForgeAppPage() {
  const [prompt, setPrompt] = useState("");
  const [buildMode, setBuildMode] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [activityCount, setActivityCount] = useState(1);
  const [refinePrompt, setRefinePrompt] = useState("");

  useEffect(() => {
    if (!buildMode) return;

    const timer = window.setInterval(() => {
      setActiveStep((current) => (current >= buildSteps.length - 1 ? current : current + 1));
      setActivityCount((current) => (current >= buildActivity.length ? current : current + 1));
    }, 1300);

    return () => window.clearInterval(timer);
  }, [buildMode]);

  const shownActivity = useMemo(() => buildActivity.slice(0, activityCount), [activityCount]);

  function startBuild() {
    setBuildMode(true);
    setActiveStep(0);
    setActivityCount(1);
  }

  return (
    <div className="ecomviper-hud min-h-screen text-slate-100">
      <div className="ecomviper-vignette pointer-events-none fixed inset-0" />
      <div className="ecomviper-grid pointer-events-none fixed inset-0 opacity-35" />

      <main className="relative mx-auto max-w-7xl px-6 py-10">
        <section className={`${brainTheme.glassCard} p-6`}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-cyan-300/75">Apps</div>
              <h1 className="mt-2 text-3xl font-semibold text-white">SiteForge</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-300">
                SiteForge builds websites with AI. Describe your business and goals, then generate a launch-ready site.
              </p>
            </div>
            <Link href="/" className={brainTheme.secondaryButton}>
              Back to iBrains
            </Link>
          </div>
        </section>

        {!buildMode ? (
          <section className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className={`${brainTheme.glassCard} p-6`}>
              <label htmlFor="siteforge-prompt" className="text-sm font-medium text-slate-100">
                Website Prompt
              </label>
              <textarea
                id="siteforge-prompt"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="Describe the website you want…"
                className="mt-3 h-48 w-full rounded-2xl border border-white/15 bg-slate-950/65 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-400 focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/35"
              />

              <div className="mt-4 flex flex-wrap gap-2">
                {quickSuggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() =>
                      setPrompt(
                        `Build a ${suggestion.toLowerCase()} website with clear offers and strong calls to action.`
                      )
                    }
                    className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-slate-200 transition hover:bg-white/10"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>

              <button type="button" onClick={startBuild} className={`${brainTheme.glowButton} mt-6 w-full sm:w-auto`}>
                Generate My Website
              </button>
            </div>

            <aside className={`${brainTheme.glassCard} h-fit p-5`}>
              <div className="text-xs uppercase tracking-[0.18em] text-slate-300/75">Connection Status</div>
              <p className="mt-2 text-sm text-slate-200">WordPress connection: Not connected</p>
              <p className="mt-1 text-xs text-slate-400">Stub only for this release.</p>
            </aside>
          </section>
        ) : (
          <section className="mt-6 space-y-4">
            <Stepper activeStep={activeStep} />

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
              <article className={`${brainTheme.glassCard} p-5`}>
                <h2 className="text-lg font-semibold text-white">Build Activity</h2>
                <ul className="mt-4 space-y-3">
                  {shownActivity.map((update, index) => (
                    <li
                      key={`${update}-${index}`}
                      className="rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-slate-200"
                    >
                      {update}
                    </li>
                  ))}
                </ul>
              </article>

              <aside className={`${brainTheme.glassCard} p-5`}>
                <h2 className="text-lg font-semibold text-white">Live Preview</h2>
                <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                  <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                    <div className="h-2 w-24 rounded bg-cyan-200/40" />
                    <div className="mt-3 h-20 rounded-md bg-gradient-to-br from-cyan-300/25 to-emerald-300/15" />
                    <div className="mt-3 h-2 w-full rounded bg-white/20" />
                    <div className="mt-2 h-2 w-10/12 rounded bg-white/15" />
                    <div className="mt-2 h-2 w-7/12 rounded bg-white/15" />
                  </div>
                  <p className="mt-3 text-xs text-slate-400">
                    Preview updates will stream here once backend generation is connected.
                  </p>
                </div>
              </aside>
            </div>

            <div className={`${brainTheme.glassCard} p-4`}>
              <label htmlFor="siteforge-refine" className="text-xs uppercase tracking-[0.18em] text-slate-300/75">
                Refine
              </label>
              <div className="mt-2 flex gap-2">
                <input
                  id="siteforge-refine"
                  type="text"
                  value={refinePrompt}
                  onChange={(event) => setRefinePrompt(event.target.value)}
                  placeholder="Make changes or refine your site…"
                  className="w-full rounded-xl border border-white/15 bg-slate-950/65 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-400 focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/35"
                />
                <button type="button" className={brainTheme.secondaryButton}>
                  Apply
                </button>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
