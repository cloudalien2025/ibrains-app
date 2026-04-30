"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { CasaHudCampaignSummary } from "@/lib/studio/domara/campaigns";
import {
  parseCasaHudBrowserListingCapture,
  type CasaHudBrowserListingCapturePayload,
  type CasaHudBrowserListingCapturePreview,
} from "@/lib/studio/domara/browser-listing-capture-parser";

type CasaHudCampaignListPayload = {
  ok?: boolean;
  campaigns?: CasaHudCampaignSummary[];
  error?: { message?: string };
};

type CasaHudBrowserImportSavePayload = {
  ok?: boolean;
  duplicate?: boolean;
  listing?: { id?: string; title?: string };
  message?: string;
  error?: { message?: string };
};

type ManualDraft = {
  title: string;
  price: string;
  currency: string;
  locationText: string;
  propertyType: string;
  bedrooms: string;
  bathrooms: string;
  rooms: string;
  sizeSqm: string;
  commercialSurfaceSqm: string;
  landSizeSqm: string;
  garageParking: string;
  balcony: boolean;
  terrace: boolean;
  condition: string;
  energyClass: string;
  descriptionSnippet: string;
  keyFeatures: string;
  manualFeaturedImageUrl: string;
  sourceUrl: string;
  manualLifestyleAngle: string;
};

function buildDraft(preview: CasaHudBrowserListingCapturePreview): ManualDraft {
  const listing = preview.candidate;
  return {
    title: listing.title || "",
    price: typeof listing.price === "number" ? String(listing.price) : "",
    currency: listing.currency || "EUR",
    locationText: listing.locationText || "",
    propertyType: listing.propertyType || "",
    bedrooms: typeof listing.bedrooms === "number" ? String(listing.bedrooms) : "",
    bathrooms: typeof listing.bathrooms === "number" ? String(listing.bathrooms) : "",
    rooms: typeof listing.rooms === "number" ? String(listing.rooms) : "",
    sizeSqm: typeof listing.sizeSqm === "number" ? String(listing.sizeSqm) : "",
    commercialSurfaceSqm: typeof listing.commercialSurfaceSqm === "number" ? String(listing.commercialSurfaceSqm) : "",
    landSizeSqm: typeof listing.landSizeSqm === "number" ? String(listing.landSizeSqm) : "",
    garageParking: listing.garageParking || "",
    balcony: Boolean(listing.balcony),
    terrace: Boolean(listing.terrace),
    condition: listing.condition || "",
    energyClass: listing.energyClass || "",
    descriptionSnippet: listing.descriptionSnippet || "",
    keyFeatures: (listing.keyFeatures || []).join("\n"),
    manualFeaturedImageUrl: listing.featuredImageUrl || "",
    sourceUrl: listing.sourceUrl || listing.canonicalUrl || "",
    manualLifestyleAngle: listing.manualLifestyleAngle || listing.lifestyleHighlights?.[0] || "",
  };
}

function factLine(preview: CasaHudBrowserListingCapturePreview) {
  const listing = preview.candidate;
  return [
    listing.propertyType,
    typeof listing.bedrooms === "number" ? `${listing.bedrooms} bd` : null,
    typeof listing.bathrooms === "number" ? `${listing.bathrooms} ba` : null,
    typeof listing.rooms === "number" ? `${listing.rooms}+ rooms` : null,
    typeof listing.sizeSqm === "number" ? `${listing.sizeSqm} sqm` : null,
    typeof listing.landSizeSqm === "number" ? `${listing.landSizeSqm.toLocaleString("en-US")} sqm land` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function badgeClass(tone: "neutral" | "gold" | "sage" | "red" | "blue") {
  if (tone === "gold") return "border-[#E3C7A0] bg-[#FFF4E0] text-[#835122]";
  if (tone === "sage") return "border-[#CDE4D3] bg-[#F3FBF5] text-[#0F5132]";
  if (tone === "red") return "border-[#F1C9C9] bg-[#FFF4F4] text-[#9A2727]";
  if (tone === "blue") return "border-[#CEDAF0] bg-[#F4F8FF] text-[#274C87]";
  return "border-[#E6D8C7] bg-white text-[#435064]";
}

function formatExtractionStatus(status: CasaHudBrowserListingCapturePreview["extractionStatus"]) {
  if (status === "extracted") return "Extracted";
  if (status === "partial") return "Partial";
  if (status === "blocked_or_unavailable") return "Blocked";
  return "Needs review";
}

export default function BrowserImportReviewClient() {
  const searchParams = useSearchParams();
  const initialCampaignId = searchParams.get("campaignId") || "";
  const [campaignId, setCampaignId] = useState(initialCampaignId);
  const [campaigns, setCampaigns] = useState<CasaHudCampaignSummary[]>([]);
  const [preview, setPreview] = useState<CasaHudBrowserListingCapturePreview | null>(null);
  const [payload, setPayload] = useState<CasaHudBrowserListingCapturePayload | null>(null);
  const [draft, setDraft] = useState<ManualDraft | null>(null);
  const [campaignLoading, setCampaignLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedTitle, setSavedTitle] = useState<string | null>(null);

  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      const raw = window.name || "";
      if (!raw.trim()) {
        setError("No browser import payload was found. Run the CasaFlix Importer from the listing page you can already view.");
        return;
      }

      const parsedPayload = JSON.parse(raw) as CasaHudBrowserListingCapturePayload;
      const parsedPreview = parseCasaHudBrowserListingCapture(parsedPayload);
      window.name = "";
      setPayload(parsedPayload);
      setPreview(parsedPreview);
      setDraft(buildDraft(parsedPreview));
      if (parsedPayload.campaignId) {
        setCampaignId((current) => current || parsedPayload.campaignId || "");
      }
    } catch (captureError) {
      setError(captureError instanceof Error ? captureError.message : "CasaFlix could not read the browser import payload.");
    }
  }, []);

  useEffect(() => {
    let active = true;
    setCampaignLoading(true);
    fetch("/api/studio/domara/campaigns", { cache: "no-store" })
      .then(async (response) => {
        const result = (await response.json().catch(() => null)) as CasaHudCampaignListPayload | null;
        if (!active) return;
        if (!response.ok || !result?.ok) {
          setCampaigns([]);
          return;
        }
        setCampaigns(result.campaigns || []);
      })
      .catch(() => {
        if (active) setCampaigns([]);
      })
      .finally(() => {
        if (active) setCampaignLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const selectedCampaign = useMemo(
    () => campaigns.find((campaign) => campaign.id === campaignId) || null,
    [campaignId, campaigns],
  );

  async function onSave() {
    if (!payload || !preview || !draft) return;
    if (!campaignId) {
      setError("Choose a campaign before saving this browser import.");
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(`/api/studio/domara/campaigns/${campaignId}/browser-import`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          payload,
          manualDetails: {
            title: draft.title,
            price: draft.price,
            currency: draft.currency,
            locationText: draft.locationText,
            propertyType: draft.propertyType,
            bedrooms: draft.bedrooms,
            bathrooms: draft.bathrooms,
            rooms: draft.rooms,
            sizeSqm: draft.sizeSqm,
            commercialSurfaceSqm: draft.commercialSurfaceSqm,
            landSizeSqm: draft.landSizeSqm,
            garageParking: draft.garageParking,
            balcony: draft.balcony,
            terrace: draft.terrace,
            condition: draft.condition,
            energyClass: draft.energyClass,
            descriptionSnippet: draft.descriptionSnippet,
            keyFeatures: draft.keyFeatures,
            manualFeaturedImageUrl: draft.manualFeaturedImageUrl,
            sourceUrl: draft.sourceUrl,
            manualLifestyleAngle: draft.manualLifestyleAngle,
          },
        }),
      });

      const result = (await response.json().catch(() => null)) as CasaHudBrowserImportSavePayload | null;
      if (!response.ok || !result?.ok) {
        throw new Error(result?.error?.message || "CasaFlix could not save that browser import.");
      }

      setNotice(result.message || "Browser import saved.");
      setSavedTitle(result.listing?.title || preview.candidate.title);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "CasaFlix could not save that browser import.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#F4E6D2_0%,#FFFDF8_24%,#FFF8EE_100%)] px-4 py-8 text-[#172033] md:px-6">
      <div className="mx-auto grid max-w-6xl gap-6">
        <section className="rounded-[2rem] border border-white/70 bg-white/92 p-6 shadow-[0_24px_60px_rgba(23,32,51,0.08)]">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8A5A34]">CasaFlix Browser Import Review</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-[#172033]">Review CasaFlix browser-assisted listing import</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[#526070]">
            CasaFlix Importer captures visible listing text, page metadata, and image candidates from the page you are viewing. It does not collect passwords, cookies, or account data.
          </p>
        </section>

        {error ? (
          <section className="rounded-[1.6rem] border border-[#F1C9C9] bg-[#FFF4F4] p-5 text-sm text-[#7C3030]">
            {error}
          </section>
        ) : null}

        {preview && draft ? (
          <section className="grid gap-6 lg:grid-cols-[1.08fr_0.92fr]" data-testid="casahud-browser-import-review">
            <article className="grid gap-5 rounded-[1.8rem] border border-[#E7DCCB] bg-white/94 p-5">
              <div className="flex flex-wrap gap-2">
                <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${badgeClass("blue")}`}>Imported from Browser</span>
                <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${badgeClass("neutral")}`}>{preview.providerName}</span>
                <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${badgeClass(preview.extractionStatus === "extracted" ? "sage" : preview.extractionStatus === "partial" ? "gold" : "red")}`}>
                  {formatExtractionStatus(preview.extractionStatus)}
                </span>
              </div>

              <div className="overflow-hidden rounded-[1.6rem] border border-[#E7DCCB] bg-[#F6F1E8]">
                {draft.manualFeaturedImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={draft.manualFeaturedImageUrl} alt={draft.title || "Captured listing preview"} className="h-[280px] w-full object-cover" />
                ) : (
                  <div className="flex h-[280px] items-center justify-center text-sm text-[#6A7687]">Image needed</div>
                )}
              </div>

              <div className="grid gap-3 text-sm leading-6 text-[#526070]">
                <p>
                  <span className="font-semibold text-[#172033]">Source URL:</span> {preview.candidate.sourceUrl}
                </p>
                <p>
                  <span className="font-semibold text-[#172033]">Provider:</span> {preview.providerName}
                </p>
                <p>
                  <span className="font-semibold text-[#172033]">Capture method:</span> Browser-assisted import
                </p>
                <p>
                  <span className="font-semibold text-[#172033]">Title:</span> {draft.title || "Needs review"}
                </p>
                <p>
                  <span className="font-semibold text-[#172033]">Price:</span> {preview.candidate.priceText || "Needs review"}
                </p>
                <p>
                  <span className="font-semibold text-[#172033]">Location:</span> {draft.locationText || "Needs review"}
                </p>
                <p>
                  <span className="font-semibold text-[#172033]">Listing facts:</span> {factLine(preview) || "Facts pending"}
                </p>
                {draft.descriptionSnippet ? (
                  <p>
                    <span className="font-semibold text-[#172033]">Description:</span>{" "}
                    <span className="whitespace-pre-wrap" data-testid="casahud-browser-import-description-preview">
                      {draft.descriptionSnippet}
                    </span>
                  </p>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-3">
                <a
                  href={preview.candidate.sourceUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center rounded-full border border-[#D9E4F0] bg-white px-4 py-2 text-sm font-semibold text-[#172033]"
                >
                  View Source
                </a>
              </div>

              {preview.candidate.needsReviewFields?.length ? (
                <div className="flex flex-wrap gap-2">
                  {preview.candidate.needsReviewFields.map((field) => (
                    <span key={field} className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${badgeClass("red")}`}>
                      {field.replace(/_/g, " ")}
                    </span>
                  ))}
                </div>
              ) : null}

              {preview.warnings.length ? (
                <div className="grid gap-2">
                  {preview.warnings.map((warning) => (
                    <p key={warning} className="rounded-[1rem] border border-[#E9C4A5] bg-[#FFF5DA] px-3 py-2 text-sm text-[#7A4B13]">
                      {warning}
                    </p>
                  ))}
                </div>
              ) : null}

              {preview.candidate.imageUrls.length ? (
                <div className="grid gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8A5A34]">Image candidates</p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {preview.candidate.imageUrls.map((imageUrl) => (
                      <button
                        key={imageUrl}
                        type="button"
                        onClick={() => setDraft((current) => (current ? { ...current, manualFeaturedImageUrl: imageUrl } : current))}
                        className={`overflow-hidden rounded-[1.2rem] border ${
                          draft.manualFeaturedImageUrl === imageUrl ? "border-[#172033]" : "border-[#E7DCCB]"
                        } bg-white text-left`}
                        data-testid="casahud-browser-import-image-option"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={imageUrl} alt="Browser import candidate" className="h-28 w-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </article>

            <article className="grid gap-5 rounded-[1.8rem] border border-[#D9E4F0] bg-[#F8FAFC] p-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#475569]">Save Context</p>
                <p className="mt-2 text-sm leading-6 text-[#526070]">
                  Save this browser capture into a campaign shortlist. Manual details remain user-provided and the listing stays labeled as a browser import, not an official API listing.
                </p>
              </div>

              <label className="grid gap-2 text-sm text-[#172033]">
                <span className="font-medium">Campaign</span>
                <select
                  value={campaignId}
                  onChange={(event) => setCampaignId(event.target.value)}
                  className="rounded-2xl border border-[#D9E4F0] bg-white px-3 py-2"
                  data-testid="casahud-browser-import-campaign-select"
                >
                  <option value="">{campaignLoading ? "Loading campaigns..." : "Choose a campaign"}</option>
                  {campaigns.map((campaign) => (
                    <option key={campaign.id} value={campaign.id}>
                      {campaign.name}
                    </option>
                  ))}
                </select>
              </label>

              {selectedCampaign ? (
                <p className="text-sm text-[#526070]">
                  Saving into <span className="font-semibold text-[#172033]">{selectedCampaign.name}</span>.
                </p>
              ) : null}

              <div className="grid gap-3 md:grid-cols-2">
                <label className="grid gap-2 text-sm text-[#172033]">
                  <span className="font-medium">Display title</span>
                  <input
                    value={draft.title}
                    onChange={(event) => setDraft((current) => (current ? { ...current, title: event.target.value } : current))}
                    className="rounded-2xl border border-[#D9E4F0] bg-white px-3 py-2"
                  />
                </label>
                <label className="grid gap-2 text-sm text-[#172033]">
                  <span className="font-medium">Location</span>
                  <input
                    value={draft.locationText}
                    onChange={(event) => setDraft((current) => (current ? { ...current, locationText: event.target.value } : current))}
                    className="rounded-2xl border border-[#D9E4F0] bg-white px-3 py-2"
                    data-testid="casahud-browser-import-location-input"
                  />
                </label>
                <label className="grid gap-2 text-sm text-[#172033]">
                  <span className="font-medium">Price</span>
                  <input
                    value={draft.price}
                    onChange={(event) => setDraft((current) => (current ? { ...current, price: event.target.value } : current))}
                    className="rounded-2xl border border-[#D9E4F0] bg-white px-3 py-2"
                    data-testid="casahud-browser-import-price-input"
                  />
                </label>
                <label className="grid gap-2 text-sm text-[#172033]">
                  <span className="font-medium">Currency</span>
                  <input
                    value={draft.currency}
                    onChange={(event) => setDraft((current) => (current ? { ...current, currency: event.target.value } : current))}
                    className="rounded-2xl border border-[#D9E4F0] bg-white px-3 py-2"
                  />
                </label>
                <label className="grid gap-2 text-sm text-[#172033]">
                  <span className="font-medium">Property type</span>
                  <input
                    value={draft.propertyType}
                    onChange={(event) => setDraft((current) => (current ? { ...current, propertyType: event.target.value } : current))}
                    className="rounded-2xl border border-[#D9E4F0] bg-white px-3 py-2"
                  />
                </label>
                <label className="grid gap-2 text-sm text-[#172033]">
                  <span className="font-medium">Garage / parking</span>
                  <input
                    value={draft.garageParking}
                    onChange={(event) => setDraft((current) => (current ? { ...current, garageParking: event.target.value } : current))}
                    className="rounded-2xl border border-[#D9E4F0] bg-white px-3 py-2"
                  />
                </label>
                <label className="grid gap-2 text-sm text-[#172033]">
                  <span className="font-medium">Bedrooms</span>
                  <input
                    value={draft.bedrooms}
                    onChange={(event) => setDraft((current) => (current ? { ...current, bedrooms: event.target.value } : current))}
                    className="rounded-2xl border border-[#D9E4F0] bg-white px-3 py-2"
                  />
                </label>
                <label className="grid gap-2 text-sm text-[#172033]">
                  <span className="font-medium">Bathrooms</span>
                  <input
                    value={draft.bathrooms}
                    onChange={(event) => setDraft((current) => (current ? { ...current, bathrooms: event.target.value } : current))}
                    className="rounded-2xl border border-[#D9E4F0] bg-white px-3 py-2"
                  />
                </label>
                <label className="grid gap-2 text-sm text-[#172033]">
                  <span className="font-medium">Rooms</span>
                  <input
                    value={draft.rooms}
                    onChange={(event) => setDraft((current) => (current ? { ...current, rooms: event.target.value } : current))}
                    className="rounded-2xl border border-[#D9E4F0] bg-white px-3 py-2"
                  />
                </label>
                <label className="grid gap-2 text-sm text-[#172033]">
                  <span className="font-medium">Interior size (m²)</span>
                  <input
                    value={draft.sizeSqm}
                    onChange={(event) => setDraft((current) => (current ? { ...current, sizeSqm: event.target.value } : current))}
                    className="rounded-2xl border border-[#D9E4F0] bg-white px-3 py-2"
                  />
                </label>
                <label className="grid gap-2 text-sm text-[#172033]">
                  <span className="font-medium">Commercial surface (m²)</span>
                  <input
                    value={draft.commercialSurfaceSqm}
                    onChange={(event) => setDraft((current) => (current ? { ...current, commercialSurfaceSqm: event.target.value } : current))}
                    className="rounded-2xl border border-[#D9E4F0] bg-white px-3 py-2"
                  />
                </label>
                <label className="grid gap-2 text-sm text-[#172033]">
                  <span className="font-medium">Garden / land size (m²)</span>
                  <input
                    value={draft.landSizeSqm}
                    onChange={(event) => setDraft((current) => (current ? { ...current, landSizeSqm: event.target.value } : current))}
                    className="rounded-2xl border border-[#D9E4F0] bg-white px-3 py-2"
                  />
                </label>
                <label className="grid gap-2 text-sm text-[#172033]">
                  <span className="font-medium">Condition</span>
                  <input
                    value={draft.condition}
                    onChange={(event) => setDraft((current) => (current ? { ...current, condition: event.target.value } : current))}
                    className="rounded-2xl border border-[#D9E4F0] bg-white px-3 py-2"
                  />
                </label>
                <label className="grid gap-2 text-sm text-[#172033]">
                  <span className="font-medium">Energy class</span>
                  <input
                    value={draft.energyClass}
                    onChange={(event) => setDraft((current) => (current ? { ...current, energyClass: event.target.value } : current))}
                    className="rounded-2xl border border-[#D9E4F0] bg-white px-3 py-2"
                  />
                </label>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="flex items-center gap-3 rounded-2xl border border-[#D9E4F0] bg-white px-3 py-3 text-sm text-[#172033]">
                  <input
                    type="checkbox"
                    checked={draft.balcony}
                    onChange={(event) => setDraft((current) => (current ? { ...current, balcony: event.target.checked } : current))}
                  />
                  Balcony
                </label>
                <label className="flex items-center gap-3 rounded-2xl border border-[#D9E4F0] bg-white px-3 py-3 text-sm text-[#172033]">
                  <input
                    type="checkbox"
                    checked={draft.terrace}
                    onChange={(event) => setDraft((current) => (current ? { ...current, terrace: event.target.checked } : current))}
                  />
                  Terrace
                </label>
              </div>

              <label className="grid gap-2 text-sm text-[#172033]">
                <span className="font-medium">Description</span>
                <textarea
                  value={draft.descriptionSnippet}
                  onChange={(event) => setDraft((current) => (current ? { ...current, descriptionSnippet: event.target.value } : current))}
                  rows={8}
                  className="rounded-2xl border border-[#D9E4F0] bg-white px-3 py-2"
                  data-testid="casahud-browser-import-description-input"
                />
              </label>

              <label className="grid gap-2 text-sm text-[#172033]">
                <span className="font-medium">Key features</span>
                <textarea
                  value={draft.keyFeatures}
                  onChange={(event) => setDraft((current) => (current ? { ...current, keyFeatures: event.target.value } : current))}
                  rows={3}
                  className="rounded-2xl border border-[#D9E4F0] bg-white px-3 py-2"
                />
              </label>

              <label className="grid gap-2 text-sm text-[#172033]">
                <span className="font-medium">Lifestyle angle / notes</span>
                <textarea
                  value={draft.manualLifestyleAngle}
                  onChange={(event) => setDraft((current) => (current ? { ...current, manualLifestyleAngle: event.target.value } : current))}
                  rows={3}
                  className="rounded-2xl border border-[#D9E4F0] bg-white px-3 py-2"
                />
              </label>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="grid gap-2 text-sm text-[#172033]">
                  <span className="font-medium">Featured image URL</span>
                  <input
                    value={draft.manualFeaturedImageUrl}
                    onChange={(event) => setDraft((current) => (current ? { ...current, manualFeaturedImageUrl: event.target.value } : current))}
                    className="rounded-2xl border border-[#D9E4F0] bg-white px-3 py-2"
                  />
                </label>
                <label className="grid gap-2 text-sm text-[#172033]">
                  <span className="font-medium">Source URL</span>
                  <input
                    value={draft.sourceUrl}
                    onChange={(event) => setDraft((current) => (current ? { ...current, sourceUrl: event.target.value } : current))}
                    className="rounded-2xl border border-[#D9E4F0] bg-white px-3 py-2"
                  />
                </label>
              </div>

              {notice ? (
                <p className="rounded-[1rem] border border-[#CDE4D3] bg-[#F3FBF5] px-3 py-2 text-sm text-[#0F5132]">{notice}</p>
              ) : null}

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void onSave()}
                  disabled={saving || !campaignId}
                  className="inline-flex items-center rounded-full bg-[#172033] px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#94A3B8]"
                  data-testid="casahud-browser-import-save"
                >
                  {saving ? "Saving Browser Import..." : "Save to Property Shortlist"}
                </button>
                <Link
                  href="/apps/studio/casaflix"
                  className="inline-flex items-center rounded-full border border-[#D9E4F0] bg-white px-5 py-3 text-sm font-semibold text-[#172033]"
                >
                  {savedTitle ? "Open CasaFlix" : "Back to CasaFlix"}
                </Link>
              </div>

              {savedTitle ? (
                <p className="text-sm leading-6 text-[#526070]">
                  {savedTitle} is now on the shortlist. You can keep refining it in CasaFlix with <span className="font-semibold text-[#172033]">Edit Details</span> and continue into validation, Video Builder, and publish planning.
                </p>
              ) : null}
            </article>
          </section>
        ) : (
          !error && <section className="rounded-[1.6rem] border border-[#E7DCCB] bg-white/94 p-5 text-sm text-[#526070]">Reading browser capture…</section>
        )}
      </div>
    </main>
  );
}
