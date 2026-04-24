"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { generatePropertyVideoPlan } from "@/lib/studio/domara/property-video-plan";
import { createDomaraRenderPlan, DomaraRenderStyle, DomaraVideoRenderResult } from "@/lib/studio/domara/render-plan";
import { DomaraContentAngle, PropertyListingInput, PropertyVideoPlan } from "@/lib/studio/domara/types";

type FormState = {
  listingUrl: string;
  source: string;
  country: string;
  city: string;
  region: string;
  neighborhood: string;
  title: string;
  description: string;
  price: string;
  propertyType: string;
  bedrooms: string;
  bathrooms: string;
  squareMeters: string;
  imageUrls: string;
  latitude: string;
  longitude: string;
  contentAngle: DomaraContentAngle;
  renderStyle: DomaraRenderStyle;
};

const initialState: FormState = {
  listingUrl: "",
  source: "",
  country: "Italy",
  city: "",
  region: "",
  neighborhood: "",
  title: "",
  description: "",
  price: "",
  propertyType: "",
  bedrooms: "",
  bathrooms: "",
  squareMeters: "",
  imageUrls: "",
  latitude: "",
  longitude: "",
  contentAngle: "lifestyle",
  renderStyle: "expat_ai_editorial",
};

const fieldClass =
  "mt-1 w-full rounded-lg border border-[#D9E4F0] bg-white px-3 py-2 text-sm text-[#0F172A] placeholder:text-[#94A3B8]";

function toInput(state: FormState): PropertyListingInput {
  return {
    listingUrl: state.listingUrl || undefined,
    source: state.source || undefined,
    country: state.country || "Italy",
    city: state.city || undefined,
    region: state.region || undefined,
    neighborhood: state.neighborhood || undefined,
    title: state.title,
    description: state.description || undefined,
    price: state.price || undefined,
    propertyType: state.propertyType || undefined,
    bedrooms: state.bedrooms || undefined,
    bathrooms: state.bathrooms || undefined,
    squareMeters: state.squareMeters || undefined,
    imageUrls: state.imageUrls
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean),
    latitude: state.latitude || undefined,
    longitude: state.longitude || undefined,
    contentAngle: state.contentAngle,
  };
}

export default function StudioDomaraClient() {
  const [form, setForm] = useState<FormState>(initialState);
  const [plan, setPlan] = useState<PropertyVideoPlan | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [generatedInput, setGeneratedInput] = useState<PropertyListingInput | null>(null);
  const [renderStatus, setRenderStatus] = useState<"idle" | "queued" | "rendering" | "complete" | "failed">("idle");
  const [renderError, setRenderError] = useState<string | null>(null);
  const [renderResult, setRenderResult] = useState<DomaraVideoRenderResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sceneDuration = useMemo(
    () => (plan ? plan.scenes.reduce((total, scene) => total + scene.durationSeconds, 0) : 0),
    [plan],
  );
  const phase3Preview = useMemo(() => {
    if (!plan || !generatedInput) return null;
    return createDomaraRenderPlan({
      plan,
      listingInput: generatedInput,
      stylePreset: form.renderStyle,
    });
  }, [plan, generatedInput, form.renderStyle]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!form.title.trim()) {
      setStatus("error");
      setError("Property title is required.");
      return;
    }

    try {
      setStatus("loading");
      const input = toInput(form);
      const output = await generatePropertyVideoPlan(input);
      setPlan(output);
      setGeneratedInput(input);
      setStatus("ready");
      setRenderStatus("idle");
      setRenderError(null);
      setRenderResult(null);
    } catch (submissionError) {
      setStatus("error");
      setError(submissionError instanceof Error ? submissionError.message : "Failed to generate property video plan.");
    }
  }

  async function onRenderMp4() {
    if (!plan) return;
    const input = generatedInput ?? toInput(form);
    setRenderStatus("queued");
    setRenderError(null);
    try {
      setRenderStatus("rendering");
      const response = await fetch("/api/studio/domara/render", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          plan,
          listingInput: input,
          stylePreset: form.renderStyle,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | {
            ok?: boolean;
            render?: DomaraVideoRenderResult;
            error?: { message?: string; details?: string };
          }
        | null;
      if (!response.ok || !payload?.ok || !payload.render) {
        throw new Error(payload?.error?.details || payload?.error?.message || "Render failed.");
      }

      setRenderResult(payload.render);
      setRenderStatus("complete");
    } catch (renderSubmissionError) {
      setRenderStatus("failed");
      setRenderError(renderSubmissionError instanceof Error ? renderSubmissionError.message : "Failed to render MP4.");
    }
  }

  return (
    <div className="ibrains-shell min-h-screen text-[#0F172A]">
      <div className="mx-auto max-w-7xl px-6 py-12">
        <header className="rounded-3xl border border-[#D9E4F0] bg-white/95 p-6 shadow-[0_20px_45px_rgba(15,23,42,0.08)]">
          <div className="inline-flex items-center rounded-full border border-[#D9E4F0] bg-[#EAF1F8] px-3 py-1 text-xs font-medium text-[#334155]">
            Studio Module
          </div>
                  <h1 className="mt-3 text-3xl font-semibold tracking-tight">Domara Property Video Engine</h1>
          <p className="mt-2 max-w-4xl text-sm text-[#334155]">
            Transform European property listings into premium YouTube-ready real-estate videos using listing data,
            images, and location intelligence.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-[#334155]">
            <span className="rounded-full border border-[#D9E4F0] bg-white px-3 py-1">Initial market: Italy</span>
            <span className="rounded-full border border-[#D9E4F0] bg-white px-3 py-1">Channel: Expat AI</span>
            <span className="rounded-full border border-[#D9E4F0] bg-white px-3 py-1">Mode: Mock-first MVP</span>
          </div>
        </header>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_1fr]">
          <section className="rounded-3xl border border-[#D9E4F0] bg-white/95 p-6 shadow-[0_20px_45px_rgba(15,23,42,0.08)]">
            <h2 className="text-lg font-semibold">Listing Input</h2>
            <p className="mt-1 text-sm text-[#475569]">
              Provide manual listing details now. API providers for Idealista, Immobiliare, Google Maps, ElevenLabs,
              and Studio render jobs are scaffolded as integration seams.
            </p>

            <form onSubmit={onSubmit} className="mt-5 space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <label className="text-sm">
                  Listing URL
                  <input
                    className={fieldClass}
                    value={form.listingUrl}
                    onChange={(event) => setForm((curr) => ({ ...curr, listingUrl: event.target.value }))}
                    placeholder="https://..."
                  />
                </label>
                <label className="text-sm">
                  Optional agency / listing source
                  <input
                    className={fieldClass}
                    value={form.source}
                    onChange={(event) => setForm((curr) => ({ ...curr, source: event.target.value }))}
                    placeholder="Immobiliare.it"
                  />
                </label>
              </div>

              <label className="text-sm">
                Property title
                <input
                  className={fieldClass}
                  value={form.title}
                  onChange={(event) => setForm((curr) => ({ ...curr, title: event.target.value }))}
                  placeholder="Panoramic Lakeview Villa"
                  required
                />
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="text-sm">
                  Country
                  <input
                    className={fieldClass}
                    value={form.country}
                    onChange={(event) => setForm((curr) => ({ ...curr, country: event.target.value }))}
                  />
                </label>
                <label className="text-sm">
                  Content angle
                  <select
                    className={fieldClass}
                    value={form.contentAngle}
                    onChange={(event) =>
                      setForm((curr) => ({ ...curr, contentAngle: event.target.value as DomaraContentAngle }))
                    }
                  >
                    <option value="lifestyle">Lifestyle</option>
                    <option value="investment">Investment</option>
                    <option value="second_home">Second Home</option>
                    <option value="hidden_gem">Hidden Gem</option>
                    <option value="deal_spotlight">Deal Spotlight</option>
                  </select>
                </label>
                <label className="text-sm">
                  Render style preset
                  <select
                    className={fieldClass}
                    value={form.renderStyle}
                    onChange={(event) => setForm((curr) => ({ ...curr, renderStyle: event.target.value as DomaraRenderStyle }))}
                  >
                    <option value="expat_ai_editorial">Expat AI Editorial</option>
                    <option value="premium_listing">Premium Listing</option>
                    <option value="property_showcase">Property Showcase</option>
                  </select>
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <label className="text-sm">
                  City
                  <input
                    className={fieldClass}
                    value={form.city}
                    onChange={(event) => setForm((curr) => ({ ...curr, city: event.target.value }))}
                    placeholder="Florence"
                  />
                </label>
                <label className="text-sm">
                  Region
                  <input
                    className={fieldClass}
                    value={form.region}
                    onChange={(event) => setForm((curr) => ({ ...curr, region: event.target.value }))}
                    placeholder="Tuscany"
                  />
                </label>
                <label className="text-sm">
                  Neighborhood
                  <input
                    className={fieldClass}
                    value={form.neighborhood}
                    onChange={(event) => setForm((curr) => ({ ...curr, neighborhood: event.target.value }))}
                    placeholder="Oltrarno"
                  />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-4">
                <label className="text-sm">
                  Asking price
                  <input
                    className={fieldClass}
                    value={form.price}
                    onChange={(event) => setForm((curr) => ({ ...curr, price: event.target.value }))}
                    placeholder="€1,450,000"
                  />
                </label>
                <label className="text-sm">
                  Property type
                  <input
                    className={fieldClass}
                    value={form.propertyType}
                    onChange={(event) => setForm((curr) => ({ ...curr, propertyType: event.target.value }))}
                    placeholder="Villa"
                  />
                </label>
                <label className="text-sm">
                  Bedrooms
                  <input
                    className={fieldClass}
                    value={form.bedrooms}
                    onChange={(event) => setForm((curr) => ({ ...curr, bedrooms: event.target.value }))}
                    placeholder="4"
                  />
                </label>
                <label className="text-sm">
                  Bathrooms
                  <input
                    className={fieldClass}
                    value={form.bathrooms}
                    onChange={(event) => setForm((curr) => ({ ...curr, bathrooms: event.target.value }))}
                    placeholder="3"
                  />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <label className="text-sm md:col-span-1">
                  Square meters
                  <input
                    className={fieldClass}
                    value={form.squareMeters}
                    onChange={(event) => setForm((curr) => ({ ...curr, squareMeters: event.target.value }))}
                    placeholder="220"
                  />
                </label>
                <label className="text-sm">
                  Optional latitude
                  <input
                    className={fieldClass}
                    value={form.latitude}
                    onChange={(event) => setForm((curr) => ({ ...curr, latitude: event.target.value }))}
                    placeholder="43.76956"
                  />
                </label>
                <label className="text-sm">
                  Optional longitude
                  <input
                    className={fieldClass}
                    value={form.longitude}
                    onChange={(event) => setForm((curr) => ({ ...curr, longitude: event.target.value }))}
                    placeholder="11.25581"
                  />
                </label>
              </div>

              <label className="text-sm">
                Listing description
                <textarea
                  className={`${fieldClass} min-h-28`}
                  value={form.description}
                  onChange={(event) => setForm((curr) => ({ ...curr, description: event.target.value }))}
                  placeholder="Describe key features, finishes, and style..."
                />
              </label>

              <label className="text-sm">
                Image URLs (one per line)
                <textarea
                  className={`${fieldClass} min-h-24 font-mono text-xs`}
                  value={form.imageUrls}
                  onChange={(event) => setForm((curr) => ({ ...curr, imageUrls: event.target.value }))}
                  placeholder="https://images.example.com/1.jpg&#10;https://images.example.com/2.jpg"
                />
              </label>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  className="rounded-xl border border-[#2563EB] bg-[#2563EB] px-4 py-2 text-sm font-medium text-white transition hover:border-[#1D4ED8] hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={status === "loading"}
                >
                  {status === "loading" ? "Generating..." : "Generate Property Video Plan"}
                </button>
                <button
                  type="button"
                  className="rounded-xl border border-[#D9E4F0] bg-white px-4 py-2 text-sm text-[#334155] transition hover:bg-[#F8FBFF]"
                  onClick={() => {
                    setForm(initialState);
                    setPlan(null);
                    setGeneratedInput(null);
                    setStatus("idle");
                    setRenderStatus("idle");
                    setRenderResult(null);
                    setRenderError(null);
                    setError(null);
                  }}
                >
                  Reset
                </button>
                <Link
                  href="/apps"
                  className="rounded-xl border border-[#D9E4F0] bg-white px-4 py-2 text-sm text-[#334155] transition hover:bg-[#F8FBFF]"
                >
                  Back to Apps
                </Link>
              </div>

              {error ? <p className="text-sm text-rose-600">{error}</p> : null}
            </form>
          </section>

          <section className="rounded-3xl border border-[#D9E4F0] bg-white/95 p-6 shadow-[0_20px_45px_rgba(15,23,42,0.08)]">
            <h2 className="text-lg font-semibold">Generated Output</h2>
            {!plan ? (
              <p className="mt-3 text-sm text-[#475569]">
                Submit a listing to generate a normalized property summary, storyboard, narration script, and YouTube
                metadata.
              </p>
            ) : (
              <div className="mt-4 space-y-5 text-sm text-[#1E293B]">
                <div>
                  <h3 className="font-semibold">1. Property Summary</h3>
                  <p className="mt-1 text-[#334155]">{plan.listingSummary}</p>
                </div>
                <div>
                  <h3 className="font-semibold">2. Opening Hook</h3>
                  <p className="mt-1 text-[#334155]">{plan.hook}</p>
                </div>
                <div>
                  <h3 className="font-semibold">3. Scene Plan / Storyboard</h3>
                  <div className="mt-2 space-y-2">
                    {plan.scenes.map((scene) => (
                      <article key={`${scene.order}-${scene.title}`} className="rounded-xl border border-[#D9E4F0] p-3">
                        <p className="font-medium">
                          {scene.order}. {scene.title} ({scene.durationSeconds}s)
                        </p>
                        <p className="mt-1 text-[#334155]">{scene.visualDirection}</p>
                        <p className="mt-1 text-[#334155]">{scene.narration}</p>
                        <p className="mt-1 text-xs text-[#475569]">Overlay: {scene.overlayText}</p>
                      </article>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-[#475569]">Estimated runtime: {sceneDuration} seconds</p>
                </div>
                <div>
                  <h3 className="font-semibold">4. Narration Script</h3>
                  <pre className="mt-2 overflow-x-auto rounded-xl border border-[#D9E4F0] bg-[#F8FBFF] p-3 text-xs leading-relaxed text-[#1E293B]">
                    {plan.narrationScript}
                  </pre>
                </div>
                <div>
                  <h3 className="font-semibold">5. Location / POI Placeholders</h3>
                  <p className="mt-1 text-[#334155]">{plan.enrichmentSummary}</p>
                </div>
                <div>
                  <h3 className="font-semibold">6. YouTube Title</h3>
                  <p className="mt-1 text-[#334155]">{plan.youtubeTitle}</p>
                </div>
                <div>
                  <h3 className="font-semibold">7. YouTube Description</h3>
                  <pre className="mt-2 overflow-x-auto rounded-xl border border-[#D9E4F0] bg-[#F8FBFF] p-3 text-xs leading-relaxed text-[#1E293B]">
                    {plan.youtubeDescription}
                  </pre>
                </div>
                <div>
                  <h3 className="font-semibold">8. Export / Render</h3>
                  {phase3Preview ? (
                    <div className="mt-2 rounded-xl border border-[#D9E4F0] bg-[#F8FBFF] p-3 text-xs text-[#334155]">
                      <p>
                        Style: <span className="font-medium">{phase3Preview.stylePreset}</span> | Requested images:{" "}
                        {phase3Preview.requestedImageCount} | Pre-render skipped: {phase3Preview.skippedImageCount}
                      </p>
                      {phase3Preview.imageValidationWarnings.length > 0 ? (
                        <ul className="mt-2 space-y-1 text-amber-700">
                          {phase3Preview.imageValidationWarnings.slice(0, 4).map((warning) => (
                            <li key={warning}>{warning}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-1 text-emerald-700">No image URL issues detected in current input.</p>
                      )}
                    </div>
                  ) : null}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className="rounded-xl border border-[#2563EB] bg-[#2563EB] px-4 py-2 text-sm font-medium text-white transition hover:border-[#1D4ED8] hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={() => void onRenderMp4()}
                      disabled={renderStatus === "queued" || renderStatus === "rendering"}
                    >
                      {renderStatus === "queued" || renderStatus === "rendering" ? "Rendering MP4..." : "Render MP4"}
                    </button>
                    <span className="rounded-full border border-[#D9E4F0] bg-[#F8FBFF] px-2.5 py-1 text-xs text-[#334155]">
                      Status: {renderStatus}
                    </span>
                    <span className="rounded-full border border-[#D9E4F0] bg-[#F8FBFF] px-2.5 py-1 text-xs text-[#334155]">
                      Mode: mock-first local render
                    </span>
                    <span className="rounded-full border border-[#D9E4F0] bg-[#F8FBFF] px-2.5 py-1 text-xs text-[#334155]">
                      Created for Expat AI
                    </span>
                  </div>
                  {renderError ? <p className="mt-2 text-sm text-rose-600">{renderError}</p> : null}
                  {renderResult ? (
                    <div className="mt-3 rounded-xl border border-[#D9E4F0] bg-[#F8FBFF] p-3 text-xs text-[#334155]">
                      <p>
                        Render complete. Duration: {renderResult.durationSeconds}s | Scenes: {renderResult.sceneCount}{" "}
                        | Images used: {renderResult.imageCount} | Skipped images: {renderResult.skippedImageCount}
                      </p>
                      <p className="mt-1">
                        Artifact: {renderResult.filename} | Style: {renderResult.stylePreset} | Audio:{" "}
                        {renderResult.audioIncluded ? "included" : "not included"}
                      </p>
                      <p className="mt-1">Generated: {new Date(renderResult.generatedAt).toLocaleString()}</p>
                      {renderResult.sourceAttribution?.source || renderResult.sourceAttribution?.listingUrl ? (
                        <p className="mt-1">
                          Attribution: {renderResult.sourceAttribution?.source || "Manual source"}{" "}
                          {renderResult.sourceAttribution?.listingUrl ? `| ${renderResult.sourceAttribution.listingUrl}` : ""}
                        </p>
                      ) : null}
                      <div className="mt-2">
                        <a
                          href={renderResult.downloadUrl}
                          className="inline-flex rounded-lg border border-[#2563EB] bg-white px-3 py-1.5 text-xs font-medium text-[#1D4ED8] transition hover:bg-[#EEF4FF]"
                          download
                        >
                          Download MP4
                        </a>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="mt-2 text-[#334155]">
                        {plan.renderPlaceholder.nextStep}
                      </p>
                      <p className="mt-1 text-xs text-[#475569]">Provider seam: {plan.renderPlaceholder.provider}</p>
                    </>
                  )}
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
