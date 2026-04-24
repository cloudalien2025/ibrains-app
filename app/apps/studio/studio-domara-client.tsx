"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { generatePropertyVideoPlan } from "@/lib/studio/domara/property-video-plan";
import { createDomaraRenderPlan, DomaraRenderStyle, DomaraVideoRenderResult } from "@/lib/studio/domara/render-plan";
import { DomaraVoiceMode, DomaraVoicePace, DomaraVoicePersona, DomaraVoiceTone } from "@/lib/studio/domara/narration-provider";
import { generateDomaraYouTubePackage } from "@/lib/studio/domara/youtube-package";
import {
  DOMARA_BATCH_LIMIT,
  DomaraBatch,
  DomaraSeriesTemplateName,
  buildBulkExportManifest,
  createDomaraBatch,
  generateContentCalendar,
  listSeriesTemplates,
  transitionBatchItemStatus,
} from "@/lib/studio/domara/batch-calendar";
import { DomaraContentAngle, PropertyListingInput, PropertyVideoPlan } from "@/lib/studio/domara/types";

type FormState = {
  listingProvider: "manual" | "idealista" | "immobiliare";
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
  voiceMode: DomaraVoiceMode;
  voicePersona: DomaraVoicePersona;
  voiceTone: DomaraVoiceTone;
  voicePace: DomaraVoicePace;
};

type ListingFetchState = "idle" | "fetching" | "ready" | "failed";

const initialState: FormState = {
  listingProvider: "manual",
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
  voiceMode: "silent",
  voicePersona: "expat_ai_host",
  voiceTone: "informative",
  voicePace: "normal",
};

const fieldClass =
  "mt-1 w-full rounded-lg border border-[#D9E4F0] bg-white px-3 py-2 text-sm text-[#0F172A] placeholder:text-[#94A3B8]";

function toInput(state: FormState): PropertyListingInput {
  return {
    listingUrl: state.listingUrl || undefined,
    source: state.source || undefined,
    provider: state.listingProvider,
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

function formStateFromListing(current: FormState, listing: PropertyListingInput): FormState {
  return {
    ...current,
    listingUrl: listing.listingUrl || current.listingUrl,
    source: listing.source || current.source,
    country: listing.country || current.country,
    city: listing.city || "",
    region: listing.region || "",
    neighborhood: listing.neighborhood || "",
    title: listing.title || current.title,
    description: listing.description || "",
    price: listing.price || "",
    propertyType: listing.propertyType || "",
    bedrooms: listing.bedrooms !== undefined ? String(listing.bedrooms) : "",
    bathrooms: listing.bathrooms !== undefined ? String(listing.bathrooms) : "",
    squareMeters: listing.squareMeters !== undefined ? String(listing.squareMeters) : "",
    imageUrls: (listing.imageUrls || []).join("\n"),
    latitude: listing.latitude !== undefined ? String(listing.latitude) : "",
    longitude: listing.longitude !== undefined ? String(listing.longitude) : "",
  };
}

export default function StudioDomaraClient() {
  const seriesTemplates = useMemo(() => listSeriesTemplates(), []);
  const [form, setForm] = useState<FormState>(initialState);
  const [plan, setPlan] = useState<PropertyVideoPlan | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [generatedInput, setGeneratedInput] = useState<PropertyListingInput | null>(null);
  const [renderStatus, setRenderStatus] = useState<"idle" | "queued" | "rendering" | "complete" | "failed">("idle");
  const [renderError, setRenderError] = useState<string | null>(null);
  const [renderResult, setRenderResult] = useState<DomaraVideoRenderResult | null>(null);
  const [listingFetchStatus, setListingFetchStatus] = useState<ListingFetchState>("idle");
  const [listingFetchError, setListingFetchError] = useState<string | null>(null);
  const [listingFetchWarnings, setListingFetchWarnings] = useState<string[]>([]);
  const [listingFetchFallbackUsed, setListingFetchFallbackUsed] = useState(false);
  const [batchTemplate, setBatchTemplate] = useState<DomaraSeriesTemplateName>("hidden_gems_tuscany");
  const [batch, setBatch] = useState<DomaraBatch>(createDomaraBatch([], "hidden_gems_tuscany"));
  const [batchNotice, setBatchNotice] = useState<string | null>(null);
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
  const youtubePackage = useMemo(() => {
    if (!plan || !generatedInput) return null;
    return generateDomaraYouTubePackage({
      plan,
      listingInput: generatedInput,
      renderResult: renderResult || undefined,
    });
  }, [plan, generatedInput, renderResult]);
  const contentCalendar = useMemo(() => generateContentCalendar(batch), [batch]);
  const batchExportManifest = useMemo(() => buildBulkExportManifest(batch), [batch]);

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
          voiceSettings: {
            mode: form.voiceMode,
            persona: form.voicePersona,
            tone: form.voiceTone,
            pace: form.voicePace,
          },
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

  async function onFetchListing() {
    setListingFetchError(null);
    setListingFetchWarnings([]);
    setListingFetchFallbackUsed(false);

    if (form.listingProvider === "manual") {
      setListingFetchStatus("failed");
      setListingFetchError("Select Idealista or Immobiliare to use Fetch Listing.");
      return;
    }
    if (!form.listingUrl.trim()) {
      setListingFetchStatus("failed");
      setListingFetchError("Listing URL or listing ID is required.");
      return;
    }

    try {
      setListingFetchStatus("fetching");
      const response = await fetch("/api/studio/domara/listing/fetch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          provider: form.listingProvider,
          listingRef: form.listingUrl.trim(),
          country: form.country,
          fallbackToMock: true,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | {
            ok?: boolean;
            result?: {
              listing: PropertyListingInput;
              warnings?: string[];
              fallbackUsed?: boolean;
            };
            error?: { message?: string; details?: string };
          }
        | null;
      if (!response.ok || !payload?.ok || !payload.result?.listing) {
        throw new Error(payload?.error?.details || payload?.error?.message || "Failed to fetch listing.");
      }

      setForm((curr) => formStateFromListing(curr, payload.result!.listing));
      setListingFetchWarnings(payload.result.warnings || []);
      setListingFetchFallbackUsed(Boolean(payload.result.fallbackUsed));
      setListingFetchStatus("ready");
    } catch (fetchError) {
      setListingFetchStatus("failed");
      setListingFetchError(fetchError instanceof Error ? fetchError.message : "Failed to fetch listing.");
    }
  }

  function onAddCurrentToBatch() {
    const listing = generatedInput ?? (form.title.trim() ? toInput(form) : null);
    if (!listing) {
      setBatchNotice("Generate or enter a listing first.");
      return;
    }

    const combined = [...batch.items.map((item) => item.listing), listing];
    const nextBatch = createDomaraBatch(combined, batchTemplate);
    setBatch(nextBatch);
    if (combined.length > DOMARA_BATCH_LIMIT) {
      setBatchNotice(`Batch limit is ${DOMARA_BATCH_LIMIT}; additional items were dropped.`);
    } else {
      setBatchNotice(`Added to batch (${nextBatch.items.length}/${DOMARA_BATCH_LIMIT}).`);
    }
  }

  function onBatchStatus(itemId: string, status: "ready" | "queued" | "ready_to_publish" | "failed") {
    setBatch((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.id === itemId ? transitionBatchItemStatus(item, status, status === "failed" ? "Marked failed." : undefined) : item,
      ),
    }));
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
              <div className="grid gap-4 md:grid-cols-4">
                <label className="text-sm">
                  Listing provider
                  <select
                    className={fieldClass}
                    value={form.listingProvider}
                    onChange={(event) =>
                      setForm((curr) => ({
                        ...curr,
                        listingProvider: event.target.value as FormState["listingProvider"],
                      }))
                    }
                  >
                    <option value="manual">Manual</option>
                    <option value="idealista">Idealista</option>
                    <option value="immobiliare">Immobiliare.it</option>
                  </select>
                </label>
                <label className="text-sm">
                  Listing URL or ID
                  <input
                    className={fieldClass}
                    value={form.listingUrl}
                    onChange={(event) => setForm((curr) => ({ ...curr, listingUrl: event.target.value }))}
                    placeholder="https://... or listing-id"
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
                <div className="text-sm">
                  <span className="text-[#334155]">Fetch listing</span>
                  <button
                    type="button"
                    className="mt-1 w-full rounded-lg border border-[#2563EB] bg-[#2563EB] px-3 py-2 text-sm font-medium text-white transition hover:border-[#1D4ED8] hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={() => void onFetchListing()}
                    disabled={listingFetchStatus === "fetching"}
                  >
                    {listingFetchStatus === "fetching" ? "Fetching..." : "Fetch Listing"}
                  </button>
                </div>
              </div>
              <p className="text-xs text-[#475569]">
                Fetch Listing is source-ingestion only for content generation. Marketplace search and buyer workflows are
                intentionally out of scope.
              </p>
              {listingFetchStatus === "ready" ? (
                <p className="text-xs text-emerald-700">
                  Listing fetched and mapped to Domara input model.
                  {listingFetchFallbackUsed ? " Provider fallback: deterministic mock listing used." : ""}
                </p>
              ) : null}
              {listingFetchWarnings.length > 0 ? (
                <ul className="space-y-1 text-xs text-amber-700">
                  {listingFetchWarnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              ) : null}
              {listingFetchError ? <p className="text-xs text-rose-600">{listingFetchError}</p> : null}
              <div className="grid gap-4 md:grid-cols-4">
                <label className="text-sm">
                  Voice mode
                  <select
                    className={fieldClass}
                    value={form.voiceMode}
                    onChange={(event) => setForm((curr) => ({ ...curr, voiceMode: event.target.value as DomaraVoiceMode }))}
                  >
                    <option value="silent">Silent / caption-only</option>
                    <option value="mock">Mock narration</option>
                    <option value="elevenlabs">ElevenLabs (if configured)</option>
                  </select>
                </label>
                <label className="text-sm">
                  Voice persona
                  <select
                    className={fieldClass}
                    value={form.voicePersona}
                    onChange={(event) =>
                      setForm((curr) => ({ ...curr, voicePersona: event.target.value as DomaraVoicePersona }))
                    }
                  >
                    <option value="expat_ai_host">Expat AI Host</option>
                  </select>
                </label>
                <label className="text-sm">
                  Tone
                  <select
                    className={fieldClass}
                    value={form.voiceTone}
                    onChange={(event) => setForm((curr) => ({ ...curr, voiceTone: event.target.value as DomaraVoiceTone }))}
                  >
                    <option value="cinematic">Cinematic</option>
                    <option value="warm">Warm</option>
                    <option value="luxury">Luxury</option>
                    <option value="informative">Informative</option>
                  </select>
                </label>
                <label className="text-sm">
                  Pace
                  <select
                    className={fieldClass}
                    value={form.voicePace}
                    onChange={(event) => setForm((curr) => ({ ...curr, voicePace: event.target.value as DomaraVoicePace }))}
                  >
                    <option value="relaxed">Relaxed</option>
                    <option value="normal">Normal</option>
                    <option value="energetic">Energetic</option>
                  </select>
                </label>
              </div>
              {form.voiceMode === "elevenlabs" ? (
                <p className="text-xs text-amber-700">
                  ElevenLabs narration uses provider fallback when API credentials are missing or unavailable. Silent MP4
                  rendering remains supported.
                </p>
              ) : null}

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
                  <h3 className="font-semibold">8. Publishing Package</h3>
                  {youtubePackage ? (
                    <div className="mt-2 space-y-3 rounded-xl border border-[#D9E4F0] bg-[#F8FBFF] p-3 text-xs text-[#334155]">
                      <p>
                        Recommended title: <span className="font-medium">{youtubePackage.finalRecommendedTitle}</span>
                      </p>
                      <div>
                        <p className="font-medium">Title variants</p>
                        <ul className="mt-1 space-y-1">
                          {youtubePackage.titleVariants.slice(0, 5).map((option) => (
                            <li key={`${option.angle}-${option.title}`}>
                              {option.angle}: {option.title}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="font-medium">Chapters</p>
                        <ul className="mt-1 space-y-1">
                          {youtubePackage.chapters.map((chapter) => (
                            <li key={`${chapter.timestamp}-${chapter.title}`}>
                              {chapter.timestamp} {chapter.title}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="font-medium">Hashtags</p>
                        <p>{youtubePackage.hashtags.join(" ")}</p>
                      </div>
                      <div>
                        <p className="font-medium">Pinned comment</p>
                        <p>{youtubePackage.pinnedComment}</p>
                      </div>
                      <div>
                        <p className="font-medium">Shorts ideas</p>
                        <ul className="mt-1 space-y-1">
                          {youtubePackage.shortsIdeas.slice(0, 3).map((idea) => (
                            <li key={idea.sourceSceneTitle}>
                              {idea.hook} ({idea.sourceSceneTitle})
                            </li>
                          ))}
                        </ul>
                      </div>
                      <p className="text-[11px] text-[#475569]">
                        Compliance: {youtubePackage.metadata.complianceNote} | Attribution:{" "}
                        {youtubePackage.metadata.sourceAttribution}
                      </p>
                    </div>
                  ) : (
                    <p className="mt-1 text-[#334155]">
                      Publishing package appears after a plan is generated.
                    </p>
                  )}
                </div>
                <div>
                  <h3 className="font-semibold">9. Export / Render</h3>
                  {phase3Preview ? (
                    <div className="mt-2 rounded-xl border border-[#D9E4F0] bg-[#F8FBFF] p-3 text-xs text-[#334155]">
                      <p>
                        Style: <span className="font-medium">{phase3Preview.stylePreset}</span> | Requested images:{" "}
                        {phase3Preview.requestedImageCount} | Pre-render skipped: {phase3Preview.skippedImageCount}
                      </p>
                      <p className="mt-1">
                        Voice mode: {form.voiceMode} | Persona: Expat AI Host | Tone: {form.voiceTone} | Pace: {form.voicePace}
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
                      <p className="mt-1">
                        Narration provider: {renderResult.narrationProvider || "none"} | Status:{" "}
                        {renderResult.narrationStatus || "disabled"}
                      </p>
                      {renderResult.narrationFallbackReason ? (
                        <p className="mt-1 text-amber-700">{renderResult.narrationFallbackReason}</p>
                      ) : null}
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
        <section className="mt-6 rounded-3xl border border-[#D9E4F0] bg-white/95 p-6 shadow-[0_20px_45px_rgba(15,23,42,0.08)]">
          <h2 className="text-lg font-semibold">10. Batch Generation + Content Calendar</h2>
          <p className="mt-1 text-sm text-[#475569]">
            Queue a small set of listings for repeatable production planning. Batch rendering remains bounded to protect
            server runtime.
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <label className="text-sm">
              Series template
              <select
                className={fieldClass}
                value={batchTemplate}
                onChange={(event) => setBatchTemplate(event.target.value as DomaraSeriesTemplateName)}
              >
                {seriesTemplates.map((template) => (
                  <option key={template.name} value={template.name}>
                    {template.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="text-sm">
              <span className="text-[#334155]">Batch action</span>
              <button
                type="button"
                className="mt-1 w-full rounded-lg border border-[#2563EB] bg-[#2563EB] px-3 py-2 text-sm font-medium text-white transition hover:border-[#1D4ED8] hover:bg-[#1D4ED8]"
                onClick={onAddCurrentToBatch}
              >
                Add Current Listing
              </button>
            </div>
            <div className="rounded-lg border border-[#D9E4F0] bg-[#F8FBFF] p-3 text-xs text-[#334155]">
              <p>
                Batch size: {batch.items.length}/{DOMARA_BATCH_LIMIT}
              </p>
              <p className="mt-1">Render queue safety: one item at a time.</p>
            </div>
          </div>
          {batchNotice ? <p className="mt-2 text-xs text-[#334155]">{batchNotice}</p> : null}

          <div className="mt-4 overflow-x-auto rounded-xl border border-[#D9E4F0]">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-[#F8FBFF] text-[#475569]">
                <tr>
                  <th className="px-3 py-2">Title</th>
                  <th className="px-3 py-2">Location</th>
                  <th className="px-3 py-2">Angle</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {batch.items.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-3 text-[#64748B]">
                      No batch items yet.
                    </td>
                  </tr>
                ) : (
                  batch.items.map((item) => (
                    <tr key={item.id} className="border-t border-[#E2E8F0]">
                      <td className="px-3 py-2">{item.listing.title}</td>
                      <td className="px-3 py-2">{[item.listing.city, item.listing.country].filter(Boolean).join(", ")}</td>
                      <td className="px-3 py-2">{item.contentAngle}</td>
                      <td className="px-3 py-2">{item.status}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          <button type="button" className="rounded border border-[#D9E4F0] bg-white px-2 py-0.5" onClick={() => onBatchStatus(item.id, "ready")}>
                            Ready
                          </button>
                          <button type="button" className="rounded border border-[#D9E4F0] bg-white px-2 py-0.5" onClick={() => onBatchStatus(item.id, "queued")}>
                            Queue
                          </button>
                          <button
                            type="button"
                            className="rounded border border-[#D9E4F0] bg-white px-2 py-0.5"
                            onClick={() => onBatchStatus(item.id, "ready_to_publish")}
                          >
                            Publish-Ready
                          </button>
                          <button type="button" className="rounded border border-[#D9E4F0] bg-white px-2 py-0.5" onClick={() => onBatchStatus(item.id, "failed")}>
                            Fail
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <div className="rounded-xl border border-[#D9E4F0] bg-[#F8FBFF] p-3 text-xs text-[#334155]">
              <p className="font-medium">Content Calendar</p>
              <ul className="mt-2 space-y-1">
                {contentCalendar.length === 0 ? <li>No calendar entries yet.</li> : null}
                {contentCalendar.map((entry) => (
                  <li key={entry.batchItemId}>
                    {entry.plannedPublishDate} | {entry.videoTitle} | {entry.status} | MP4: {entry.mp4Status} | YT:{" "}
                    {entry.youtubePackageStatus}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-[#D9E4F0] bg-[#F8FBFF] p-3 text-xs text-[#334155]">
              <p className="font-medium">Bulk Export Manifest</p>
              <pre className="mt-2 overflow-x-auto whitespace-pre-wrap">{JSON.stringify(batchExportManifest, null, 2)}</pre>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
