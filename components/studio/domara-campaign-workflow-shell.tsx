"use client";

import { useMemo, useState } from "react";
import {
  buildShortlist,
  createSuggestedDiscoverySources,
  createDefaultCampaign,
  createNarrationAssetSeam,
  createVideoProjectSeam,
  discoverCandidatesFromSavedSources,
  domaraCampaignSources,
  enrichListingCandidate,
  generatePublishingPackage,
  generateResearchBrief,
  generateStoryboard,
  generateTitleIdeas,
  listingCandidateToInput,
  rankListingCandidates,
  selectTitleIdea,
} from "@/lib/studio/domara/campaign-workflow";
import type {
  Campaign,
  CampaignSource,
  DiscoverySource,
  DiscoverySourceCandidateResult,
  EnrichedListing,
  ListingCandidate,
  ListingCandidateStatus,
  NarrationAsset,
  PropertyListingInput,
  PublishingPackage,
  ResearchBrief,
  Storyboard,
  TitleIdea,
  VideoProject,
} from "@/lib/studio/domara/types";

const fieldClass =
  "mt-1 w-full rounded-lg border border-[#D9E4F0] bg-white px-3 py-2 text-sm text-[#0F172A] placeholder:text-[#94A3B8]";

const panelClass = "rounded-3xl border border-[#D9E4F0] bg-white/95 p-5 shadow-[0_20px_45px_rgba(15,23,42,0.06)]";

type RankedCandidate = ReturnType<typeof rankListingCandidates>[number];

function sourceLabel(source: CampaignSource): string {
  if (source === "gate_away") return "Gate-away";
  if (source === "agency_site") return "Agency Website";
  if (source === "csv_manual") return "CSV / Manual";
  if (source === "future_api") return "Future API";
  return source.charAt(0).toUpperCase() + source.slice(1);
}

function discoverySourceTypeLabel(source: DiscoverySource["sourceType"]): string {
  if (source === "gateaway") return "Gate-away";
  if (source === "agency_site") return "Agency Site";
  if (source === "csv_manual") return "CSV / Manual";
  if (source === "api_provider") return "API Provider";
  return source.charAt(0).toUpperCase() + source.slice(1);
}

function updateCampaignTimestamp(campaign: Campaign): Campaign {
  return {
    ...campaign,
    updatedAt: new Date().toISOString(),
  };
}

export default function DomaraCampaignWorkflowShell(props: { onBridgeToListing: (input: PropertyListingInput) => void }) {
  const [campaign, setCampaign] = useState<Campaign>(() => createDefaultCampaign());
  const [titleIdeas, setTitleIdeas] = useState<TitleIdea[]>([]);
  const [brief, setBrief] = useState<ResearchBrief | null>(null);
  const [discoverySources, setDiscoverySources] = useState<DiscoverySource[]>([]);
  const [discoveryResult, setDiscoveryResult] = useState<DiscoverySourceCandidateResult | null>(null);
  const [rankedCandidates, setRankedCandidates] = useState<RankedCandidate[]>([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [enriched, setEnriched] = useState<EnrichedListing | null>(null);
  const [storyboard, setStoryboard] = useState<Storyboard | null>(null);
  const [narrationAsset, setNarrationAsset] = useState<NarrationAsset | null>(null);
  const [videoProject, setVideoProject] = useState<VideoProject | null>(null);
  const [publishingPackage, setPublishingPackage] = useState<PublishingPackage | null>(null);

  const selectedTitleIdea = useMemo(() => titleIdeas.find((idea) => idea.selected) || null, [titleIdeas]);
  const selectedCandidate = useMemo(() => {
    if (!rankedCandidates.length) return null;
    if (!selectedCandidateId) return rankedCandidates[0]?.candidate || null;
    return rankedCandidates.find((entry) => entry.candidate.id === selectedCandidateId)?.candidate || rankedCandidates[0]?.candidate || null;
  }, [rankedCandidates, selectedCandidateId]);

  const shortlistedCount = useMemo(
    () => rankedCandidates.filter((entry) => entry.candidate.status === "shortlist").length,
    [rankedCandidates],
  );

  function onGenerateTitleIdeas() {
    setTitleIdeas(generateTitleIdeas(updateCampaignTimestamp(campaign)));
    setBrief(null);
    setDiscoverySources([]);
    setDiscoveryResult(null);
    setRankedCandidates([]);
    setSelectedCandidateId(null);
    setEnriched(null);
    setStoryboard(null);
    setNarrationAsset(null);
    setVideoProject(null);
    setPublishingPackage(null);
  }

  function onSelectTitle(id: string) {
    setTitleIdeas((current) => selectTitleIdea(current, id));
    setBrief(null);
    setDiscoverySources([]);
    setDiscoveryResult(null);
    setRankedCandidates([]);
    setSelectedCandidateId(null);
    setEnriched(null);
    setStoryboard(null);
    setNarrationAsset(null);
    setVideoProject(null);
    setPublishingPackage(null);
  }

  function onGenerateBrief() {
    if (!selectedTitleIdea) return;
    const nextBrief = generateResearchBrief(campaign, selectedTitleIdea);
    const nextSources = createSuggestedDiscoverySources(campaign, nextBrief);
    setBrief(nextBrief);
    setDiscoverySources(nextSources);
    setDiscoveryResult(null);
    setRankedCandidates([]);
    setSelectedCandidateId(null);
    setEnriched(null);
    setStoryboard(null);
    setNarrationAsset(null);
    setVideoProject(null);
    setPublishingPackage(null);
  }

  function onDiscover() {
    if (!brief) return;
    const activeSources = discoverySources.length > 0 ? discoverySources : createSuggestedDiscoverySources(campaign, brief);
    const sourceResult = discoverCandidatesFromSavedSources(campaign, brief, activeSources);
    const ranked = rankListingCandidates(campaign, brief, sourceResult.candidates);
    const shortlist = new Set(buildShortlist(ranked, 3).map((entry) => entry.candidate.id));

    const seeded = ranked.map((entry) => {
      const nextStatus: ListingCandidateStatus = shortlist.has(entry.candidate.id) ? "shortlist" : "new";
      return {
        ...entry,
        candidate: {
          ...entry.candidate,
          status: nextStatus,
        },
      };
    });

    setDiscoverySources(sourceResult.sources);
    setDiscoveryResult(sourceResult);
    setRankedCandidates(seeded);
    setSelectedCandidateId(seeded[0]?.candidate.id || null);
    setEnriched(null);
    setStoryboard(null);
    setNarrationAsset(null);
    setVideoProject(null);
    setPublishingPackage(null);
  }

  function updateCandidateStatus(candidateId: string, status: ListingCandidateStatus) {
    setRankedCandidates((current) =>
      current.map((entry) =>
        entry.candidate.id === candidateId
          ? {
              ...entry,
              candidate: {
                ...entry.candidate,
                status,
              },
            }
          : entry,
      ),
    );
  }

  function onEnrich() {
    if (!brief || !selectedCandidate) return;
    const nextEnriched = enrichListingCandidate(selectedCandidate, brief);
    setEnriched(nextEnriched);
    setStoryboard(null);
    setNarrationAsset(null);
    setVideoProject(null);
    setPublishingPackage(null);
  }

  function onGenerateStoryboard() {
    if (!enriched || !selectedCandidate) return;
    const nextStoryboard = generateStoryboard(campaign, selectedCandidate, enriched);
    const nextNarration = createNarrationAssetSeam(nextStoryboard);
    const nextVideoProject = createVideoProjectSeam(campaign, nextStoryboard, nextNarration, enriched);

    setStoryboard(nextStoryboard);
    setNarrationAsset(nextNarration);
    setVideoProject(nextVideoProject);
    setPublishingPackage(null);
  }

  function onGeneratePublishPackage() {
    if (!selectedCandidate || !storyboard || !videoProject) return;
    setPublishingPackage(generatePublishingPackage(campaign, selectedCandidate, storyboard, videoProject));
  }

  function onBridgeCandidate(candidate: ListingCandidate | null) {
    if (!candidate) return;
    props.onBridgeToListing(listingCandidateToInput(candidate));
  }

  return (
    <section className="mt-6 space-y-4">
      <header className={panelClass}>
        <h2 className="text-lg font-semibold">Campaign Workflow Shell</h2>
        <p className="mt-1 text-sm text-[#475569]">
          Campaign-first path: setup, title ideation, research brief, mock discovery, scoring, shortlist, enrichment,
          storyboard, narration/video seams, and publish package.
        </p>
      </header>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className={panelClass}>
          <h3 className="text-base font-semibold">1. Campaign Setup</h3>
          <p className="mt-1 text-xs text-[#64748B]">Default campaign is editable and remains deterministic for mock outputs.</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <label className="text-sm">
              Campaign name
              <input
                className={fieldClass}
                value={campaign.name}
                onChange={(event) =>
                  setCampaign((current) => updateCampaignTimestamp({ ...current, name: event.target.value }))
                }
              />
            </label>
            <label className="text-sm">
              Budget max ({campaign.currency})
              <input
                className={fieldClass}
                type="number"
                value={campaign.budgetMax}
                onChange={(event) =>
                  setCampaign((current) =>
                    updateCampaignTimestamp({
                      ...current,
                      budgetMax: Number(event.target.value || current.budgetMax),
                    }),
                  )
                }
              />
            </label>
            <label className="text-sm md:col-span-2">
              Markets (comma-separated)
              <input
                className={fieldClass}
                value={campaign.markets.join(", ")}
                onChange={(event) =>
                  setCampaign((current) =>
                    updateCampaignTimestamp({
                      ...current,
                      markets: event.target.value
                        .split(",")
                        .map((part) => part.trim())
                        .filter(Boolean),
                    }),
                  )
                }
              />
            </label>
            <label className="text-sm md:col-span-2">
              Property types (comma-separated)
              <input
                className={fieldClass}
                value={campaign.propertyTypes.join(", ")}
                onChange={(event) =>
                  setCampaign((current) =>
                    updateCampaignTimestamp({
                      ...current,
                      propertyTypes: event.target.value
                        .split(",")
                        .map((part) => part.trim().toLowerCase())
                        .filter(Boolean),
                    }),
                  )
                }
              />
            </label>
            <label className="text-sm md:col-span-2">
              Buyer persona
              <input
                className={fieldClass}
                value={campaign.buyerPersona}
                onChange={(event) =>
                  setCampaign((current) => updateCampaignTimestamp({ ...current, buyerPersona: event.target.value }))
                }
              />
            </label>
            <label className="text-sm md:col-span-2">
              Video angle
              <input
                className={fieldClass}
                value={campaign.videoAngle}
                onChange={(event) =>
                  setCampaign((current) => updateCampaignTimestamp({ ...current, videoAngle: event.target.value }))
                }
              />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {domaraCampaignSources.map((source) => {
              const enabled = campaign.sources.includes(source);
              return (
                <button
                  key={source}
                  type="button"
                  className={`rounded-full border px-3 py-1 text-xs ${
                    enabled ? "border-[#2563EB] bg-[#EFF6FF] text-[#1D4ED8]" : "border-[#D9E4F0] bg-white text-[#334155]"
                  }`}
                  onClick={() =>
                    setCampaign((current) => {
                      const hasSource = current.sources.includes(source);
                      const nextSources = hasSource
                        ? current.sources.filter((item) => item !== source)
                        : [...current.sources, source];
                      return updateCampaignTimestamp({ ...current, sources: nextSources });
                    })
                  }
                >
                  {sourceLabel(source)}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-[#475569]">
            Markets: {campaign.markets.join(", ")} | Sources: {campaign.sources.map(sourceLabel).join(", ")}
          </p>
        </section>

        <section className={panelClass}>
          <h3 className="text-base font-semibold">2. Title Lab</h3>
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              className="rounded-lg border border-[#2563EB] bg-[#2563EB] px-3 py-2 text-sm font-medium text-white"
              onClick={onGenerateTitleIdeas}
            >
              Generate Mock Viral Titles
            </button>
            <button
              type="button"
              className="rounded-lg border border-[#D9E4F0] bg-white px-3 py-2 text-sm text-[#334155] disabled:opacity-50"
              onClick={onGenerateBrief}
              disabled={!selectedTitleIdea}
            >
              Convert Selected Title to Research Brief
            </button>
          </div>
          <div className="mt-3 space-y-2">
            {titleIdeas.length === 0 ? <p className="text-sm text-[#64748B]">No title ideas yet.</p> : null}
            {titleIdeas.map((idea) => (
              <article
                key={idea.id}
                className={`rounded-xl border p-3 text-sm ${
                  idea.selected ? "border-[#2563EB] bg-[#EFF6FF]" : "border-[#D9E4F0] bg-white"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-[#0F172A]">{idea.title}</p>
                  <button
                    type="button"
                    className="rounded border border-[#D9E4F0] bg-white px-2 py-0.5 text-xs"
                    onClick={() => onSelectTitle(idea.id)}
                  >
                    {idea.selected ? "Selected" : "Select"}
                  </button>
                </div>
                <p className="mt-1 text-xs text-[#475569]">Hook: {idea.thumbnailHook}</p>
                <p className="mt-1 text-xs text-[#475569]">Brief summary: {idea.researchBriefSummary}</p>
                <p className="mt-1 text-xs text-[#64748B]">Score: {idea.score}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={panelClass}>
          <h3 className="text-base font-semibold">3. Discovery</h3>
          <p className="mt-1 text-xs text-amber-700">
            Mock/provider seam only. No live crawling, no CAPTCHA bypass, and no credential dependency.
          </p>
          <p className="mt-2 text-xs text-[#64748B]">Saved search URLs feed deterministic candidate queue generation.</p>
          <button
            type="button"
            className="mt-3 rounded-lg border border-[#2563EB] bg-[#2563EB] px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            onClick={onDiscover}
            disabled={!brief}
          >
            Check Saved Sources + Generate Candidate Queue
          </button>
          {brief ? (
            <div className="mt-3 rounded-xl border border-[#D9E4F0] bg-[#F8FBFF] p-3 text-xs text-[#334155]">
              <p>Markets: {brief.markets.join(", ")}</p>
              <p>Cities: {brief.cities.join(", ")}</p>
              <p>
                Budget ceiling: {campaign.currency} {brief.priceMax.toLocaleString("en-US")}
              </p>
              <p>POI priorities: {brief.poiPriorities.join(", ")}</p>
            </div>
          ) : null}
          <div className="mt-3 space-y-2">
            {discoverySources.length === 0 ? <p className="text-sm text-[#64748B]">No saved discovery sources yet.</p> : null}
            {discoverySources.map((source) => (
              <article key={source.id} className="rounded-xl border border-[#D9E4F0] bg-white p-3 text-xs text-[#334155]">
                <p className="font-medium text-[#0F172A]">{source.name}</p>
                <p className="mt-1">
                  Type: {discoverySourceTypeLabel(source.sourceType)} | Status: {source.status} | Confidence:{" "}
                  {(source.confidence * 100).toFixed(0)}%
                </p>
                <p className="mt-1 break-all">URL: {source.sourceUrl}</p>
                <p className="mt-1">
                  Markets: {source.marketTags.join(", ")} | Property types: {source.propertyTypeTags.join(", ")}
                </p>
                <p className="mt-1">
                  Candidates: {source.candidateCount} | Imported: {source.importedCandidateCount} | Rejected: {source.rejectedCandidateCount}
                </p>
                {source.notes ? <p className="mt-1 text-[#475569]">Notes: {source.notes}</p> : null}
              </article>
            ))}
          </div>
          {discoveryResult ? (
            <div className="mt-3 rounded-xl border border-[#D9E4F0] bg-[#F8FBFF] p-3 text-xs text-[#334155]">
              <p>
                Provider: {discoveryResult.provider} | Generated at: {discoveryResult.generatedAt}
              </p>
              <p className="mt-1">Validated sources: {discoveryResult.validations.filter((item) => item.valid).length}</p>
              <p className="mt-1">Candidate queue size: {discoveryResult.candidates.length}</p>
            </div>
          ) : null}
        </section>

        <section className={panelClass}>
          <h3 className="text-base font-semibold">4. Candidate Queue / Shortlist</h3>
          <p className="mt-1 text-xs text-[#64748B]">Ranked by deterministic Video Fit Score. Shortlisted: {shortlistedCount}</p>
          <div className="mt-3 space-y-2">
            {rankedCandidates.length === 0 ? <p className="text-sm text-[#64748B]">No candidates generated yet.</p> : null}
            {rankedCandidates.map((entry) => (
              <article key={entry.candidate.id} className="rounded-xl border border-[#D9E4F0] bg-white p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-[#0F172A]">{entry.candidate.title}</p>
                  <button
                    type="button"
                    className="rounded border border-[#D9E4F0] bg-[#F8FBFF] px-2 py-0.5 text-xs"
                    onClick={() => setSelectedCandidateId(entry.candidate.id)}
                  >
                    {selectedCandidateId === entry.candidate.id ? "Selected" : "Inspect"}
                  </button>
                </div>
                <p className="mt-1 text-xs text-[#475569]">
                  {entry.candidate.city}, {entry.candidate.region} | {entry.candidate.currency} {entry.candidate.price.toLocaleString("en-US")} | {sourceLabel(entry.candidate.source)}
                </p>
                <p className="mt-1 text-xs text-[#475569] break-all">
                  Source attribution: {(entry.candidate.providerMetadata?.sourceName as string) || "Saved source"} |{" "}
                  {(entry.candidate.providerMetadata?.sourceType as string) || entry.candidate.source} | {entry.candidate.sourceUrl}
                </p>
                <p className="mt-1 text-xs text-[#334155]">
                  Images: {entry.candidate.imageUrls.length} | Confidence: {(entry.candidate.extractionConfidence * 100).toFixed(0)}% | Score: {entry.score.totalScore} ({entry.score.scoreBand})
                </p>
                <p className="mt-1 text-xs text-[#475569]">Status: {entry.candidate.status}</p>
                <p className="mt-1 text-xs text-[#475569]">Reason: {entry.score.reasons[0]}</p>
                {entry.candidate.providerMetadata?.complianceNote ? (
                  <p className="mt-1 text-xs text-[#475569]">Compliance: {String(entry.candidate.providerMetadata.complianceNote)}</p>
                ) : null}
                {entry.score.riskFlags.length > 0 ? <p className="mt-1 text-xs text-amber-700">Risk: {entry.score.riskFlags.join(" | ")}</p> : null}
                <div className="mt-2 flex flex-wrap gap-1 text-xs">
                  <button type="button" className="rounded border border-[#D9E4F0] px-2 py-0.5" onClick={() => updateCandidateStatus(entry.candidate.id, "shortlist")}>
                    Shortlist
                  </button>
                  <button type="button" className="rounded border border-[#D9E4F0] px-2 py-0.5" onClick={() => updateCandidateStatus(entry.candidate.id, "reject")}>
                    Reject
                  </button>
                  <button type="button" className="rounded border border-[#D9E4F0] px-2 py-0.5" onClick={() => updateCandidateStatus(entry.candidate.id, "saved")}>
                    Save
                  </button>
                  <button type="button" className="rounded border border-[#D9E4F0] px-2 py-0.5" onClick={() => updateCandidateStatus(entry.candidate.id, "needs_review")}>
                    Needs Review
                  </button>
                  <button
                    type="button"
                    className="rounded border border-[#2563EB] bg-[#EFF6FF] px-2 py-0.5 text-[#1D4ED8]"
                    onClick={() => onBridgeCandidate(entry.candidate)}
                  >
                    Bridge to Listing Input
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className={panelClass}>
          <h3 className="text-base font-semibold">5. Location / POI Enrichment</h3>
          <p className="mt-1 text-xs text-[#64748B]">Provider seam: deterministic location media assets with mock-first fallback.</p>
          <button
            type="button"
            className="mt-3 rounded-lg border border-[#2563EB] bg-[#2563EB] px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            onClick={onEnrich}
            disabled={!brief || !selectedCandidate}
          >
            Enrich + Generate Location Media
          </button>
          {enriched ? (
            <div className="mt-3 rounded-xl border border-[#D9E4F0] bg-[#F8FBFF] p-3 text-xs text-[#334155]">
              <p>
                Address: {enriched.resolvedAddress} | Confidence: {enriched.locationConfidence}
              </p>
              <p>
                Coordinates: {enriched.latitude.toFixed(4)}, {enriched.longitude.toFixed(4)}
              </p>
              <p className="mt-1">
                Provider mode: {enriched.locationMedia.providerStatus} | Map scenes:{" "}
                {enriched.locationMedia.assets.filter((asset) => asset.kind !== "poi_photo").length} | POI photo candidates:{" "}
                {enriched.locationMedia.poiMediaCandidates.length}
              </p>
              <p className="mt-1">Map assets: {enriched.mapAssets.staticMapUrl} | {enriched.mapAssets.poiOverlayUrl}</p>
              <p className="mt-1">POIs: {enriched.pois.map((poi) => `${poi.name} (${poi.distanceKm} km)`).join(" | ")}</p>
              <p className="mt-1">Distance highlights: {enriched.distanceHighlights.join(" | ")}</p>
              <p className="mt-1">Attribution/source notes: {enriched.locationMedia.sourceNotes.join(" | ")}</p>
              <div className="mt-2 rounded-lg border border-[#D9E4F0] bg-white p-2">
                <p className="font-medium text-[#0F172A]">Location media assets</p>
                <div className="mt-1 space-y-1">
                  {enriched.locationMedia.assets.map((asset) => (
                    <p key={asset.id}>
                      {asset.label} [{asset.kind}] - {asset.status} - {asset.url || asset.placeholderUrl || "n/a"}
                    </p>
                  ))}
                </div>
              </div>
              <div className="mt-2 rounded-lg border border-[#D9E4F0] bg-white p-2">
                <p className="font-medium text-[#0F172A]">Attribution</p>
                <div className="mt-1 space-y-1">
                  {enriched.locationMedia.attribution.map((entry) => (
                    <p key={`${entry.provider}-${entry.sourceLabel}`}>{entry.sourceLabel}</p>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </section>

        <section className={panelClass}>
          <h3 className="text-base font-semibold">6. Story Studio</h3>
          <button
            type="button"
            className="mt-2 rounded-lg border border-[#2563EB] bg-[#2563EB] px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            onClick={onGenerateStoryboard}
            disabled={!enriched || !selectedCandidate}
          >
            Generate Storyboard + Narration Seam
          </button>
          {storyboard ? (
            <div className="mt-3 space-y-2 text-xs text-[#334155]">
              <p>
                {storyboard.title} | Duration: {storyboard.estimatedDuration}s | Status: {storyboard.status}
              </p>
              <div className="space-y-1 rounded-xl border border-[#D9E4F0] bg-[#F8FBFF] p-3">
                {storyboard.scenes.map((scene) => (
                  <p key={scene.id}>
                    {scene.order}. {scene.title} ({scene.visualType}) - {scene.overlayText}
                  </p>
                ))}
              </div>
              {narrationAsset ? (
                <p>
                  Narration seam: {narrationAsset.provider} | Voice: {narrationAsset.voiceId} | Audio URL: {narrationAsset.audioUrl} | Fallback used: {String(narrationAsset.fallbackUsed)}
                </p>
              ) : null}
              {videoProject ? (
                <p>
                  Video seam: {videoProject.renderStatus} | MP4 placeholder: {videoProject.mp4Url}
                </p>
              ) : null}
            </div>
          ) : null}
        </section>

        <section className={`${panelClass} xl:col-span-2`}>
          <h3 className="text-base font-semibold">7. Publish Package</h3>
          <button
            type="button"
            className="mt-2 rounded-lg border border-[#2563EB] bg-[#2563EB] px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            onClick={onGeneratePublishPackage}
            disabled={!storyboard || !videoProject || !selectedCandidate}
          >
            Generate YouTube Package
          </button>
          {publishingPackage ? (
            <div className="mt-3 rounded-xl border border-[#D9E4F0] bg-[#F8FBFF] p-3 text-xs text-[#334155]">
              <p>
                Title: <span className="font-medium">{publishingPackage.youtubeTitle}</span>
              </p>
              <p className="mt-1">Status: {publishingPackage.status}</p>
              <p className="mt-1">Tags: {publishingPackage.tags.join(", ")}</p>
              <p className="mt-1">Thumbnail hooks: {publishingPackage.thumbnailHooks.join(" | ")}</p>
              <p className="mt-1">Pinned comment: {publishingPackage.pinnedComment}</p>
              <div className="mt-2">
                <p className="font-medium">Chapters</p>
                <ul className="mt-1 space-y-1">
                  {publishingPackage.chapters.map((chapter) => (
                    <li key={`${chapter.timestamp}-${chapter.title}`}>
                      {chapter.timestamp} {chapter.title}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </section>
  );
}
