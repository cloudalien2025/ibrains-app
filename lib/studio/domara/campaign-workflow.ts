import type {
  Campaign,
  CampaignSource,
  EnrichedListing,
  ListingCandidate,
  ListingCandidateStatus,
  ListingScore,
  NarrationAsset,
  PoiPriority,
  PublishingPackage,
  ResearchBrief,
  Storyboard,
  StoryboardScene,
  TitleIdea,
  VideoProject,
} from "@/lib/studio/domara/types";
import { createLocationMediaRequest, generateLocationMediaAssets } from "@/lib/studio/domara/location-media-provider";

const SOURCE_ORDER: CampaignSource[] = [
  "immobiliare",
  "idealista",
  "gate_away",
  "kyero",
  "agency_site",
  "csv_manual",
  "future_api",
];

const DEFAULT_SOURCES: CampaignSource[] = ["immobiliare", "idealista", "gate_away", "kyero", "agency_site", "csv_manual"];

const POI_PRIORITY_DEFAULTS: PoiPriority[] = ["beach", "marina", "airport", "restaurants", "historic_center"];

const CITY_COORDINATES: Record<string, { latitude: number; longitude: number; region: string; country: string }> = {
  palermo: { latitude: 38.1157, longitude: 13.3615, region: "Sicily", country: "Italy" },
  catania: { latitude: 37.5079, longitude: 15.083, region: "Sicily", country: "Italy" },
  taormina: { latitude: 37.8532, longitude: 15.2866, region: "Sicily", country: "Italy" },
  bari: { latitude: 41.1171, longitude: 16.8719, region: "Puglia", country: "Italy" },
  lecce: { latitude: 40.3515, longitude: 18.175, region: "Puglia", country: "Italy" },
  ostuni: { latitude: 40.7283, longitude: 17.5775, region: "Puglia", country: "Italy" },
  reggio_calabria: { latitude: 38.1113, longitude: 15.6479, region: "Calabria", country: "Italy" },
  tropea: { latitude: 38.6746, longitude: 15.8953, region: "Calabria", country: "Italy" },
  scalea: { latitude: 39.812, longitude: 15.7932, region: "Calabria", country: "Italy" },
  genoa: { latitude: 44.4056, longitude: 8.9463, region: "Liguria", country: "Italy" },
  la_spezia: { latitude: 44.1025, longitude: 9.8241, region: "Liguria", country: "Italy" },
  sanremo: { latitude: 43.8179, longitude: 7.7772, region: "Liguria", country: "Italy" },
};

function stableHash(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return hash >>> 0;
}

function stableId(prefix: string, seed: string): string {
  return `${prefix}-${stableHash(seed).toString(16).slice(0, 10)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function titleCase(value: string): string {
  return value
    .split(" ")
    .map((part) => (part ? `${part[0]!.toUpperCase()}${part.slice(1).toLowerCase()}` : part))
    .join(" ");
}

function toNumericPrice(price: number | string): number | null {
  if (typeof price === "number") return Number.isFinite(price) ? price : null;
  const cleaned = price.replace(/[^\d.,]/g, "").replace(/\./g, "").replace(/,/g, ".");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function scoreBand(totalScore: number): ListingScore["scoreBand"] {
  if (totalScore >= 90) return "excellent";
  if (totalScore >= 75) return "strong";
  if (totalScore >= 60) return "possible";
  return "skip";
}

export function createDefaultCampaign(): Campaign {
  const now = nowIso();
  return {
    id: stableId("campaign", "sicily-puglia-calabria-liguria"),
    name: "Italy Coastal Lifestyle + Investment Series",
    markets: ["Sicily", "Puglia", "Calabria", "Liguria"],
    budgetMin: 120000,
    budgetMax: 400000,
    currency: "EUR",
    propertyTypes: ["apartment", "villa", "townhouse"],
    buyerPersona: "American remote worker / vacation-home buyer",
    videoAngle: "lifestyle + investment",
    sources: [...DEFAULT_SOURCES],
    status: "draft",
    createdAt: now,
    updatedAt: now,
  };
}

export function generateTitleIdeas(campaign: Campaign): TitleIdea[] {
  const leadMarket = campaign.markets[0] || "Italy";
  const budgetLabel = `under ${campaign.currency} ${campaign.budgetMax.toLocaleString("en-US")}`;
  const seeds = [
    {
      title: `${leadMarket} Coastal Homes ${budgetLabel}: 7 Picks for Remote Workers in 2026`,
      thumbnailHook: "Beach town life without million-euro pricing",
      angle: "value coastal lifestyle",
      targetBuyer: campaign.buyerPersona,
      score: 94,
    },
    {
      title: `Best Italian Second-Home Deals ${budgetLabel} (Sicily + Puglia Hidden Gems)`,
      thumbnailHook: "Mediterranean living + rental upside",
      angle: "lifestyle + rental potential",
      targetBuyer: "US vacation-home buyer",
      score: 91,
    },
    {
      title: `I Ranked ${campaign.markets.length} Italian Regions for US Buyers: Where ${budgetLabel} Still Works`,
      thumbnailHook: "Data-backed ranking for US buyers",
      angle: "market comparison",
      targetBuyer: "American relocation planner",
      score: 88,
    },
    {
      title: `Italy Coastal Property Battle: Apartment vs Villa vs Townhouse ${budgetLabel}`,
      thumbnailHook: "Which format wins for lifestyle and yield?",
      angle: "format showdown",
      targetBuyer: campaign.buyerPersona,
      score: 84,
    },
  ];

  return seeds.map((seed, index) => ({
    id: stableId("title", `${campaign.id}-${seed.title}`),
    campaignId: campaign.id,
    title: seed.title,
    thumbnailHook: seed.thumbnailHook,
    angle: seed.angle,
    targetBuyer: seed.targetBuyer,
    researchBriefSummary: `Focus ${campaign.markets.join(", ")} with ${budgetLabel}, ${campaign.propertyTypes.join("/")}, and ${campaign.videoAngle} narrative.`,
    score: seed.score - index,
    selected: index === 0,
  }));
}

export function selectTitleIdea(titleIdeas: TitleIdea[], selectedId: string): TitleIdea[] {
  return titleIdeas.map((idea) => ({
    ...idea,
    selected: idea.id === selectedId,
  }));
}

export function generateResearchBrief(campaign: Campaign, selectedTitleIdea: TitleIdea): ResearchBrief {
  const cityMap: Record<string, string[]> = {
    Sicily: ["Palermo", "Catania", "Taormina"],
    Puglia: ["Bari", "Lecce", "Ostuni"],
    Calabria: ["Reggio Calabria", "Tropea", "Scalea"],
    Liguria: ["Genoa", "La Spezia", "Sanremo"],
  };

  return {
    id: stableId("brief", `${campaign.id}-${selectedTitleIdea.id}`),
    campaignId: campaign.id,
    titleIdeaId: selectedTitleIdea.id,
    markets: [...campaign.markets],
    cities: campaign.markets.flatMap((market) => cityMap[market] || []),
    priceMax: campaign.budgetMax,
    propertyTypes: [...campaign.propertyTypes],
    poiPriorities: [...POI_PRIORITY_DEFAULTS],
    mustHaveCriteria: [
      "Walkable to lifestyle POIs",
      "At least 8 listing images",
      "Strong lifestyle and remote-work framing",
    ],
    avoidCriteria: [
      "Out-of-budget inventory",
      "Low-confidence extraction",
      "Weak location context",
    ],
    buyerPersona: campaign.buyerPersona,
    videoAngle: campaign.videoAngle,
  };
}

export function mockDiscoverListings(brief: ResearchBrief, sources: CampaignSource[]): ListingCandidate[] {
  const selectedSources = sources.length > 0 ? sources : DEFAULT_SOURCES;
  const cities = brief.cities.length > 0 ? brief.cities : ["Palermo", "Bari", "Tropea", "La Spezia"];
  const propertyTypes = brief.propertyTypes.length > 0 ? brief.propertyTypes : ["apartment", "villa", "townhouse"];
  const generatedAt = nowIso();

  return selectedSources.slice(0, 8).map((source, index) => {
    const city = cities[index % cities.length] || "Palermo";
    const propertyType = propertyTypes[index % propertyTypes.length] || "apartment";
    const cityKey = city.toLowerCase().replace(/\s+/g, "_");
    const coordMeta = CITY_COORDINATES[cityKey] || CITY_COORDINATES.palermo;
    const isStrong = index % 3 !== 2;
    const price = isStrong ? Math.max(brief.priceMax - 25000 - index * 7000, 145000) : brief.priceMax + 95000 + index * 6000;
    const imageCount = isStrong ? 14 - (index % 4) : 4 + (index % 2);

    const rawCandidate: ListingCandidate = {
      id: stableId("candidate", `${brief.id}-${source}-${city}-${propertyType}`),
      campaignId: brief.campaignId,
      source,
      sourceUrl: `https://example.com/${source}`,
      listingUrl: `https://example.com/${source}/${stableHash(`${city}-${propertyType}-${index}`).toString(16).slice(0, 8)}`,
      title: `${titleCase(city.replace(/_/g, " "))} ${titleCase(propertyType)} with ${isStrong ? "Sea-View Terrace" : "Limited Media"}`,
      price,
      currency: "EUR",
      locationText: `${titleCase(city)}, ${coordMeta.region}, ${coordMeta.country}`,
      city: titleCase(city.replace(/_/g, " ")),
      region: coordMeta.region,
      country: coordMeta.country,
      propertyType,
      bedrooms: isStrong ? 2 + (index % 3) : 1,
      bathrooms: isStrong ? 2 : 1,
      sqm: isStrong ? 78 + index * 9 : 49,
      description: isStrong
        ? "Bright coastal layout suited for remote work, seasonal living, and short-term rental demand."
        : "Sparse listing details with limited context. Requires manual due diligence before production.",
      imageUrls: Array.from({ length: imageCount }, (_, imageIndex) => `https://images.example.com/campaign/${source}/${index + 1}-${imageIndex + 1}.jpg`),
      thumbnailUrl: `https://images.example.com/campaign/${source}/thumb-${index + 1}.jpg`,
      agencyName: source === "agency_site" ? "Mediterraneo Living" : "Mock Feed Agency",
      status: "new",
      extractionConfidence: isStrong ? 0.91 - index * 0.03 : 0.56,
      discoveredAt: generatedAt,
      providerMetadata: {
        deterministicSeed: stableHash(`${brief.id}-${source}-${index}`),
        cityKey,
      },
    };

    return normalizeListingCandidate(rawCandidate, brief.campaignId);
  });
}

export function normalizeListingCandidate(candidate: ListingCandidate, campaignId: string): ListingCandidate {
  const normalizedType = candidate.propertyType.trim().toLowerCase();
  const normalizedStatus: ListingCandidateStatus = ["new", "shortlist", "reject", "saved", "needs_review"].includes(candidate.status)
    ? candidate.status
    : "new";

  return {
    ...candidate,
    campaignId,
    propertyType: normalizedType,
    imageUrls: candidate.imageUrls.filter((url) => url.startsWith("http")),
    status: normalizedStatus,
    extractionConfidence: Math.min(1, Math.max(0, candidate.extractionConfidence)),
  };
}

function locationFit(campaignMarkets: string[], region: string): number {
  return campaignMarkets.some((market) => market.toLowerCase() === region.toLowerCase()) ? 10 : 4;
}

function propertyTypeFit(propertyTypes: string[], candidateType: string): number {
  return propertyTypes.map((value) => value.toLowerCase()).includes(candidateType.toLowerCase()) ? 10 : 3;
}

function priceFit(price: number, budgetMin: number, budgetMax: number): number {
  if (price >= budgetMin && price <= budgetMax) return 12;
  if (price <= budgetMax * 1.08) return 7;
  if (price < budgetMin) return 6;
  return 2;
}

function imageFit(imageCount: number): number {
  if (imageCount >= 12) return 8;
  if (imageCount >= 8) return 6;
  if (imageCount >= 5) return 4;
  return 1;
}

function poiStrength(poiPriorities: PoiPriority[], description: string, city: string): number {
  const corpus = `${description} ${city}`.toLowerCase();
  const hints = [
    { token: "beach", weight: 3 },
    { token: "marina", weight: 2 },
    { token: "airport", weight: 2 },
    { token: "restaurant", weight: 2 },
    { token: "historic", weight: 2 },
  ];

  const matched = hints.reduce((total, hint) => total + (corpus.includes(hint.token) ? hint.weight : 0), 0);
  const priorityBoost = Math.min(2, Math.floor(poiPriorities.length / 3));
  return Math.min(12, Math.max(3, matched + priorityBoost));
}

function lifestyleStrength(description: string, videoAngle: string): number {
  const corpus = `${description} ${videoAngle}`.toLowerCase();
  const hits = ["lifestyle", "walkable", "coastal", "remote work", "historic"].filter((token) => corpus.includes(token)).length;
  if (hits >= 4) return 10;
  if (hits === 3) return 8;
  if (hits === 2) return 6;
  return 4;
}

function investmentStrength(description: string, videoAngle: string): number {
  const corpus = `${description} ${videoAngle}`.toLowerCase();
  const hits = ["investment", "rental", "yield", "short-term", "value"].filter((token) => corpus.includes(token)).length;
  if (hits >= 4) return 10;
  if (hits === 3) return 8;
  if (hits === 2) return 6;
  return 4;
}

function buyerPersonaFit(description: string, buyerPersona: string): number {
  const corpus = `${description} ${buyerPersona}`.toLowerCase();
  const hits = ["american", "remote", "vacation", "second home", "expat"].filter((token) => corpus.includes(token)).length;
  if (hits >= 4) return 8;
  if (hits === 3) return 7;
  if (hits === 2) return 5;
  return 3;
}

export function scoreListingCandidate(campaign: Campaign, brief: ResearchBrief, candidate: ListingCandidate): ListingScore {
  const numericPrice = toNumericPrice(candidate.price);
  const campaignFitScore = 10;
  const priceFitScore = numericPrice !== null ? priceFit(numericPrice, campaign.budgetMin, campaign.budgetMax) : 2;
  const locationScore = locationFit(campaign.markets, candidate.region);
  const propertyTypeScore = propertyTypeFit(campaign.propertyTypes, candidate.propertyType);
  const imageScore = imageFit(candidate.imageUrls.length);
  const poiScore = poiStrength(brief.poiPriorities, candidate.description, candidate.city);
  const lifestyleScore = lifestyleStrength(candidate.description, campaign.videoAngle);
  const investmentScore = investmentStrength(candidate.description, campaign.videoAngle);
  const personaScore = buyerPersonaFit(candidate.description, campaign.buyerPersona);
  const confidenceScore = Math.round(Math.max(0, Math.min(1, candidate.extractionConfidence)) * 10);

  const totalScore = Math.max(
    0,
    Math.min(
      100,
      campaignFitScore +
        priceFitScore +
        locationScore +
        propertyTypeScore +
        imageScore +
        poiScore +
        lifestyleScore +
        investmentScore +
        personaScore +
        confidenceScore,
    ),
  );

  const reasons = [
    `Campaign fit ${campaignFitScore}/10 for ${campaign.markets.join(", ")} and ${campaign.videoAngle}.`,
    `Price fit ${priceFitScore}/12 against max ${campaign.currency} ${campaign.budgetMax.toLocaleString("en-US")}.`,
    `Location fit ${locationScore}/10 for ${candidate.region}.`,
    `Property type fit ${propertyTypeScore}/10 for ${candidate.propertyType}.`,
    `Media fit ${imageScore}/8 with ${candidate.imageUrls.length} image(s).`,
    `POI signal ${poiScore}/12 aligned to ${brief.poiPriorities.join(", ")}.`,
    `Lifestyle ${lifestyleScore}/10 and investment ${investmentScore}/10 narrative strength.`,
    `Buyer-persona alignment ${personaScore}/8 and extraction confidence ${confidenceScore}/10.`,
  ];

  const riskFlags: string[] = [];
  if (numericPrice === null) riskFlags.push("Missing numeric price format.");
  if (numericPrice !== null && numericPrice > campaign.budgetMax) riskFlags.push("Above campaign budget ceiling.");
  if (candidate.imageUrls.length < 6) riskFlags.push("Low media count for video storytelling.");
  if (candidate.extractionConfidence < 0.7) riskFlags.push("Low extraction confidence; manual validation recommended.");
  if (locationScore < 7) riskFlags.push("Location is outside the strongest campaign market fit.");

  return {
    id: stableId("score", candidate.id),
    candidateId: candidate.id,
    totalScore,
    campaignFitScore,
    priceFitScore,
    locationScore,
    propertyTypeFitScore: propertyTypeScore,
    poiScore,
    imageScore,
    investmentScore,
    lifestyleScore,
    buyerPersonaFitScore: personaScore,
    confidenceScore,
    reasons,
    riskFlags,
    scoreBand: scoreBand(totalScore),
  };
}

export function rankListingCandidates(
  campaign: Campaign,
  brief: ResearchBrief,
  candidates: ListingCandidate[],
): Array<{ candidate: ListingCandidate; score: ListingScore }> {
  return candidates
    .map((candidate) => ({
      candidate,
      score: scoreListingCandidate(campaign, brief, candidate),
    }))
    .sort((a, b) => b.score.totalScore - a.score.totalScore || b.candidate.extractionConfidence - a.candidate.extractionConfidence);
}

export function buildShortlist(
  ranked: Array<{ candidate: ListingCandidate; score: ListingScore }>,
  topN = 3,
): Array<{ candidate: ListingCandidate; score: ListingScore }> {
  return ranked.slice(0, topN).map((entry) => ({
    candidate: {
      ...entry.candidate,
      status: "shortlist",
    },
    score: entry.score,
  }));
}

export function enrichListingCandidate(candidate: ListingCandidate, brief: ResearchBrief): EnrichedListing {
  const cityKey = candidate.city.toLowerCase().replace(/\s+/g, "_");
  const cityMeta = CITY_COORDINATES[cityKey] || CITY_COORDINATES.palermo;
  const locationConfidence: EnrichedListing["locationConfidence"] =
    candidate.extractionConfidence >= 0.8 ? "high" : candidate.extractionConfidence >= 0.65 ? "medium" : "low";

  const pois: EnrichedListing["pois"] = brief.poiPriorities.map((priority, index) => ({
    id: stableId("poi", `${candidate.id}-${priority}`),
    name: `${titleCase(priority.replace(/_/g, " "))} spot ${index + 1}`,
    category: priority,
    distanceKm: Number((0.6 + index * 1.2).toFixed(1)),
    travelMinutes: 6 + index * 4,
    confidence: locationConfidence,
    source: "mock_poi_provider",
  }));

  const locationMediaRequest = createLocationMediaRequest({
    candidateId: candidate.id,
    title: candidate.title,
    resolvedAddress: `${candidate.city}, ${candidate.region}, ${candidate.country}`,
    latitude: cityMeta.latitude,
    longitude: cityMeta.longitude,
    locationConfidence,
    pois,
  });
  const locationMedia = generateLocationMediaAssets(locationMediaRequest);
  const propertyPinAsset = locationMedia.assets.find((asset) => asset.kind === "property_pin");
  const localPoiAsset = locationMedia.assets.find((asset) => asset.kind === "local_poi");

  return {
    id: stableId("enriched", candidate.id),
    candidateId: candidate.id,
    latitude: cityMeta.latitude,
    longitude: cityMeta.longitude,
    resolvedAddress: `${candidate.city}, ${candidate.region}, ${candidate.country}`,
    locationConfidence,
    pois,
    mapAssets: {
      staticMapUrl: propertyPinAsset?.url || propertyPinAsset?.placeholderUrl || `https://maps.example.com/static/${cityKey}.png`,
      poiOverlayUrl: localPoiAsset?.url || localPoiAsset?.placeholderUrl || `https://maps.example.com/overlay/${cityKey}-poi.png`,
      provider: locationMedia.provider,
    },
    locationMedia,
    distanceHighlights: pois.map((poi) => `${poi.name}: ${poi.distanceKm} km (${poi.travelMinutes} min)`),
    lifestyleSummary: `Lifestyle frame: ${candidate.city} delivers ${brief.poiPriorities.join(", ")} access suited to ${brief.buyerPersona}.`,
    investmentSummary: `Investment frame: ${candidate.currency} ${candidate.price.toLocaleString("en-US")} range with tourism-linked demand assumptions kept as scenario placeholders.`,
  };
}

export function generateStoryboard(campaign: Campaign, candidate: ListingCandidate, enrichment: EnrichedListing): Storyboard {
  const propertyPinMedia =
    enrichment.locationMedia.assets.find((asset) => asset.kind === "property_pin") ||
    enrichment.locationMedia.assets.find((asset) => asset.kind === "local_poi");
  const routeMedia = enrichment.locationMedia.assets.find((asset) => asset.kind === "route_context");
  const mapVisualSource = propertyPinMedia?.url || propertyPinMedia?.placeholderUrl || enrichment.mapAssets.staticMapUrl;
  const routeVisualSource = routeMedia?.url || routeMedia?.placeholderUrl || enrichment.mapAssets.poiOverlayUrl;

  const scenes: StoryboardScene[] = [
    {
      id: stableId("scene", `${candidate.id}-hook`),
      order: 1,
      title: "Campaign Hook",
      visualType: "listing_hero",
      visualSource: candidate.thumbnailUrl || candidate.imageUrls[0] || "mock://hero",
      narration: `Today we test ${campaign.name} with ${candidate.title} in ${candidate.city}.`,
      overlayText: `${candidate.city} | ${campaign.currency} ${candidate.price.toLocaleString("en-US")}`,
      durationSeconds: 10,
    },
    {
      id: stableId("scene", `${candidate.id}-location`),
      order: 2,
      title: "Location + POI Story",
      visualType: "map",
      visualSource: mapVisualSource,
      narration: enrichment.lifestyleSummary,
      overlayText: `POI priorities: ${enrichment.pois.slice(0, 3).map((poi) => poi.category).join(", ")}`,
      durationSeconds: 16,
    },
    {
      id: stableId("scene", `${candidate.id}-route-context`),
      order: 3,
      title: "Route + Distance Context",
      visualType: "map",
      visualSource: routeVisualSource,
      narration: enrichment.distanceHighlights.slice(0, 3).join(" | "),
      overlayText: `Location media: ${enrichment.locationMedia.providerStatus}`,
      durationSeconds: 9,
    },
    {
      id: stableId("scene", `${candidate.id}-investment`),
      order: 4,
      title: "Investment Angle",
      visualType: "listing_gallery",
      visualSource: candidate.imageUrls[1] || candidate.imageUrls[0] || "mock://gallery",
      narration: enrichment.investmentSummary,
      overlayText: `Type: ${candidate.propertyType} | ${candidate.bedrooms} bed / ${candidate.bathrooms} bath`,
      durationSeconds: 14,
    },
    {
      id: stableId("scene", `${candidate.id}-cta`),
      order: 5,
      title: "Shortlist CTA",
      visualType: "cta",
      visualSource: "mock://cta",
      narration: `If this candidate matches your target profile, add it to production queue and continue with publish package review.`,
      overlayText: "Expat AI | Campaign Shortlist",
      durationSeconds: 8,
    },
  ];

  return {
    id: stableId("storyboard", `${campaign.id}-${candidate.id}`),
    campaignId: campaign.id,
    candidateIds: [candidate.id],
    title: `${candidate.city} ${titleCase(candidate.propertyType)} Storyboard`,
    scenes,
    locationMediaAssetIds: enrichment.locationMedia.assets.map((asset) => asset.id),
    narrationScript: scenes.map((scene) => `Scene ${scene.order} - ${scene.title}: ${scene.narration}`).join("\n\n"),
    estimatedDuration: scenes.reduce((total, scene) => total + scene.durationSeconds, 0),
    status: "draft",
  };
}

export function createNarrationAssetSeam(storyboard: Storyboard): NarrationAsset {
  return {
    id: stableId("narration", storyboard.id),
    storyboardId: storyboard.id,
    provider: "mock_narration_provider",
    voiceId: "expat-ai-host-v1",
    audioUrl: `https://audio.example.com/${storyboard.id}.mp3`,
    duration: storyboard.estimatedDuration,
    status: "ready",
    fallbackUsed: true,
  };
}

export function createVideoProjectSeam(
  campaign: Campaign,
  storyboard: Storyboard,
  narrationAsset: NarrationAsset,
  enrichment?: EnrichedListing,
): VideoProject {
  return {
    id: stableId("video-project", `${campaign.id}-${storyboard.id}`),
    campaignId: campaign.id,
    storyboardId: storyboard.id,
    assets: {
      listingImages: storyboard.scenes.map((scene) => scene.visualSource),
      mapAssets: storyboard.scenes.filter((scene) => scene.visualType === "map").map((scene) => scene.visualSource),
      locationMediaAssetIds: storyboard.locationMediaAssetIds,
      poiMediaCandidateIds: enrichment?.locationMedia.poiMediaCandidates.map((candidate) => candidate.id) || [],
      narrationAudioUrl: narrationAsset.audioUrl,
    },
    timeline: storyboard.scenes.map((scene) => ({
      sceneId: scene.id,
      startSeconds: storyboard.scenes
        .filter((candidateScene) => candidateScene.order < scene.order)
        .reduce((total, candidateScene) => total + candidateScene.durationSeconds, 0),
      durationSeconds: scene.durationSeconds,
      layer: scene.visualType,
    })),
    renderStatus: "provider_seam_ready",
    mp4Url: `https://video.example.com/${storyboard.id}.mp4`,
    metadata: {
      mock: true,
      createdAt: nowIso(),
      renderNote: "Provider seam only. Live renderer can be attached in next task.",
      locationMediaProviderStatus: enrichment?.locationMedia.providerStatus || "mock",
      locationMediaMapAssetCount:
        enrichment?.locationMedia.assets.filter((asset) => asset.kind !== "poi_photo").length || storyboard.scenes.filter((scene) => scene.visualType === "map").length,
      locationMediaPoiAssetCount: enrichment?.locationMedia.assets.filter((asset) => asset.kind === "poi_photo").length || 0,
    },
  };
}

export function generatePublishingPackage(
  campaign: Campaign,
  candidate: ListingCandidate,
  storyboard: Storyboard,
  videoProject: VideoProject,
): PublishingPackage {
  const chapters = storyboard.scenes.map((scene) => ({
    timestamp: `${String((scene.order - 1) * 15).padStart(2, "0")}:00`,
    title: scene.title,
  }));

  return {
    id: stableId("publish", videoProject.id),
    videoProjectId: videoProject.id,
    youtubeTitle: `${candidate.city} ${titleCase(candidate.propertyType)} Under ${campaign.currency} ${campaign.budgetMax.toLocaleString("en-US")} | ${campaign.videoAngle}`,
    description: [
      `Campaign: ${campaign.name}`,
      `Candidate: ${candidate.title}`,
      `Market: ${candidate.city}, ${candidate.region}`,
      `Angle: ${campaign.videoAngle}`,
      "",
      "Mock/provider seam package generated for Studio workflow validation.",
    ].join("\n"),
    tags: [
      "italy real estate",
      "remote work italy",
      "vacation home italy",
      candidate.city.toLowerCase(),
      candidate.region.toLowerCase(),
    ],
    chapters,
    thumbnailHooks: [
      `Under ${campaign.currency} ${campaign.budgetMax.toLocaleString("en-US")} in ${candidate.city}`,
      `${campaign.videoAngle} in one shortlist candidate`,
      "US-buyer lens: lifestyle + investment",
    ],
    pinnedComment:
      "Want the next shortlist breakdown? Comment your preferred market (Sicily, Puglia, Calabria, or Liguria).",
    status: "draft_ready",
  };
}

export function listingCandidateToInput(candidate: ListingCandidate): {
  listingUrl: string;
  source: string;
  provider: "manual" | "import_url" | "idealista" | "immobiliare" | "mock";
  country: string;
  city: string;
  region: string;
  title: string;
  description: string;
  price: string;
  propertyType: string;
  bedrooms: number;
  bathrooms: number;
  squareMeters: number;
  imageUrls: string[];
  latitude?: number;
  longitude?: number;
} {
  const cityKey = candidate.city.toLowerCase().replace(/\s+/g, "_");
  const cityMeta = CITY_COORDINATES[cityKey];

  return {
    listingUrl: candidate.listingUrl,
    source: candidate.source,
    provider: candidate.source === "idealista" ? "idealista" : candidate.source === "immobiliare" ? "immobiliare" : "mock",
    country: candidate.country,
    city: candidate.city,
    region: candidate.region,
    title: candidate.title,
    description: candidate.description,
    price: `${candidate.currency} ${candidate.price.toLocaleString("en-US")}`,
    propertyType: candidate.propertyType,
    bedrooms: candidate.bedrooms,
    bathrooms: candidate.bathrooms,
    squareMeters: candidate.sqm,
    imageUrls: candidate.imageUrls,
    latitude: cityMeta?.latitude,
    longitude: cityMeta?.longitude,
  };
}

export const domaraCampaignSources = SOURCE_ORDER;
