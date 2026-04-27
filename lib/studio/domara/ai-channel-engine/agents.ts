import { stableCasaHudId } from "@/lib/studio/domara/ai-channel-engine/ids";
import type {
  CasaHudContentStrategy,
  CasaHudListingDiscoveryResult,
  CasaHudListingValidationResult,
  CasaHudLocationIntelligenceResult,
  CasaHudScriptPackage,
  CasaHudStoryboardPackage,
  CasaHudTitleCandidate,
  CasaHudValidatedListings,
  CasaHudVideoType,
  CasaHudYouTubeResearchResult,
} from "@/lib/studio/domara/ai-channel-engine/types";
import { normalizePropertyListingInput } from "@/lib/studio/domara/listing-normalizer";
import { createLocationProvider } from "@/lib/studio/domara/location-provider";
import { resolveDomaraMapVisuals, applyMapVisualsToRenderPlan } from "@/lib/studio/domara/map-visual-provider";
import { createDomaraRenderPlan } from "@/lib/studio/domara/render-plan";
import type { PropertyListingInput, PropertyVideoPlan, PropertyVideoScene } from "@/lib/studio/domara/types";
import { generateDomaraYouTubePackage, type DomaraYouTubePackage } from "@/lib/studio/domara/youtube-package";

export interface CasaHudListingDiscoveryProvider {
  providerName: "idealista" | "immobiliare" | "multi_provider" | "fixture";
  discover(strategy: CasaHudContentStrategy): Promise<PropertyListingInput[]>;
}

const TITLE_SEEDS = [
  "5 Affordable Beachfront Homes in Southern Italy",
  "7 Tuscany Farmhouses Under 1M You Can Actually Buy",
  "10 Lake Como Homes That Cost Less Than a Florida Condo",
  "Could You Retire in Abruzzo for Under 300K?",
  "6 Dream Italian Villas Near Florence Under 750K",
];

function clampScore(value: number): number {
  return Math.max(1, Math.min(100, Math.round(value)));
}

function titleNumber(title: string): number | null {
  const match = title.match(/\b(\d{1,2})\b/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseBudgetCeiling(title: string): number | undefined {
  const lower = title.toLowerCase();
  const underMatch = lower.match(/under\s+(\d+(?:[.,]\d+)?)\s*(k|m|million)?/);
  if (!underMatch) return undefined;
  const base = Number(underMatch[1]?.replace(",", "."));
  if (!Number.isFinite(base)) return undefined;
  const suffix = underMatch[2];
  if (suffix === "m" || suffix === "million") return Math.round(base * 1_000_000);
  if (suffix === "k") return Math.round(base * 1_000);
  return Math.round(base);
}

function classifyVideoType(title: string): CasaHudVideoType {
  const lower = title.toLowerCase();
  const count = titleNumber(title);
  if (count && count > 1) return "roundup";
  if (/retire|american|relocation|move to|could you live/.test(lower)) return "lifestyle_relocation";
  if (/waterfront|beachfront|lake como|near florence|southern italy/.test(lower)) return "location_category";
  if (/farmhouse|villa|under|affordable|investment/.test(lower)) return "niche";
  return "single_property";
}

function primaryMarketFromTitle(title: string): string {
  const pairs: Array<[RegExp, string]> = [
    [/tuscany|florence/i, "Tuscany"],
    [/lake como/i, "Lake Como"],
    [/abruzzo/i, "Abruzzo"],
    [/southern italy|beachfront|coastal/i, "Southern Italy"],
    [/italian|italy/i, "Italy"],
  ];
  return pairs.find(([pattern]) => pattern.test(title))?.[1] || "Italy";
}

export function generateCasaHudTitleCandidates(research: CasaHudYouTubeResearchResult): CasaHudTitleCandidate[] {
  const livePatternBoost = research.status === "live" ? 9 : 0;
  const candidates = TITLE_SEEDS.map((title, index) => {
    const numbered = titleNumber(title);
    const specificityBoost = /under|less than|retire|actually buy/i.test(title) ? 8 : 4;
    const listingAvailabilityScore = /under|affordable|actually buy/i.test(title) ? 88 - index : 78 - index * 2;
    const ctrPotential = 84 + specificityBoost + (numbered ? 3 : 0) - index * 2;
    const rankingPotential = 82 + livePatternBoost + (research.nicheGaps.length > 0 ? 4 : 0) - index * 2;
    const clarityScore = /italy|tuscany|como|abruzzo|florence/i.test(title) ? 92 - index : 80 - index;
    const channelFitScore = /retire|affordable|homes|villas|farmhouses/i.test(title) ? 90 - index : 76 - index;
    const score = clampScore(
      ctrPotential * 0.26 +
        rankingPotential * 0.25 +
        clarityScore * 0.18 +
        listingAvailabilityScore * 0.18 +
        channelFitScore * 0.13,
    );

    return {
      id: stableCasaHudId("title", `${research.generatedAt}:${title}`),
      title,
      score,
      ctrPotential: clampScore(ctrPotential),
      rankingPotential: clampScore(rankingPotential),
      clarityScore: clampScore(clarityScore),
      listingAvailabilityScore: clampScore(listingAvailabilityScore),
      channelFitScore: clampScore(channelFitScore),
      rationale: [
        research.status === "live" ? "Uses live YouTube pattern data." : "Uses built-in YouTube strategy heuristics.",
        "Specific location, budget, or buyer promise makes the title immediately legible.",
        "Listing proof requirement is explicit enough for validation before production.",
      ],
      selected: false,
    };
  });

  const sorted = candidates.sort((a, b) => b.score - a.score);
  return sorted.map((candidate, index) => ({ ...candidate, selected: index === 0 }));
}

export function createCasaHudContentStrategy(selectedTitle: string): CasaHudContentStrategy {
  const videoType = classifyVideoType(selectedTitle);
  const targetFromTitle = titleNumber(selectedTitle);
  const listingCountTarget =
    videoType === "single_property" ? 1 : Math.max(3, Math.min(10, targetFromTitle || (videoType === "roundup" ? 5 : 4)));
  const primaryMarket = primaryMarketFromTitle(selectedTitle);
  const budgetCeiling = parseBudgetCeiling(selectedTitle);
  const lower = selectedTitle.toLowerCase();
  const titlePromise = [
    lower.includes("beachfront") ? "beachfront or credible coastal access" : null,
    lower.includes("waterfront") ? "waterfront or lake-facing evidence" : null,
    lower.includes("under") || lower.includes("less than") ? "price must fit stated affordability promise" : null,
    lower.includes("actually buy") ? "active source URL and provider attribution required" : null,
    lower.includes("retire") ? "retirement lifestyle context required" : null,
  ].filter((value): value is string => Boolean(value));

  return {
    videoType,
    listingCountTarget,
    primaryMarket,
    budgetCeiling,
    currency: "EUR",
    buyerPersona: lower.includes("retire") ? "American retiree / relocation planner" : "international property-video viewer",
    titlePromise: titlePromise.length > 0 ? titlePromise : ["listings must support the title promise with source attribution"],
    requiredListingEvidence: [
      "source URL",
      "price",
      "city or region",
      "property type",
      "listing images",
      "provider metadata or source attribution",
    ],
    poiPriorities: lower.includes("beach") || lower.includes("waterfront")
      ? ["beaches", "marinas", "airports", "restaurants", "historic center"]
      : ["airports", "restaurants", "landmarks", "city center", "transport"],
    strategySummary: `${selectedTitle} should be produced as a ${videoType.replace(/_/g, " ")} video using ${listingCountTarget} validated listing(s) in ${primaryMarket}.`,
  };
}

export function createCredentialRequiredListingDiscovery(strategy: CasaHudContentStrategy): CasaHudListingDiscoveryResult {
  return {
    status: "needs_credentials",
    provider: "unavailable",
    listings: [],
    queries: [
      {
        provider: "idealista",
        query: `${strategy.primaryMarket} ${strategy.videoType} ${strategy.budgetCeiling ? `under ${strategy.budgetCeiling}` : ""}`.trim(),
        status: "needs_credentials",
      },
      {
        provider: "immobiliare",
        query: `${strategy.primaryMarket} homes ${strategy.poiPriorities.join(" ")}`,
        status: "needs_credentials",
      },
    ],
    credentialRequiredProviders: ["idealista", "immobiliare"],
    notes: [
      "CasaHUD did not fabricate production listings.",
      "Connect an approved listing provider or import real listings before script/render stages can run.",
    ],
  };
}

export async function discoverListingsForStrategy(params: {
  strategy: CasaHudContentStrategy;
  provider?: CasaHudListingDiscoveryProvider;
}): Promise<CasaHudListingDiscoveryResult> {
  if (!params.provider) return createCredentialRequiredListingDiscovery(params.strategy);
  const listings = await params.provider.discover(params.strategy);
  return {
    status: listings.length > 0 ? "ready" : "needs_credentials",
    provider: params.provider.providerName === "fixture" ? "multi_provider" : params.provider.providerName,
    listings,
    queries: [
      {
        provider: params.provider.providerName,
        query: `${params.strategy.primaryMarket} ${params.strategy.videoType}`,
        status: listings.length > 0 ? "ready" : "needs_credentials",
      },
    ],
    credentialRequiredProviders: [],
    notes: listings.length > 0 ? ["Provider returned listing candidates for validation."] : ["No listings returned."],
  };
}

function numericPrice(input: PropertyListingInput): number | null {
  const raw = typeof input.price === "string" ? input.price : "";
  const parsed = Number(raw.replace(/[^\d.]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function listingKey(input: PropertyListingInput): string {
  return `${input.listingUrl || input.title}:${input.price || ""}`.toLowerCase();
}

export function validateListingsAgainstStrategy(
  strategy: CasaHudContentStrategy,
  listings: PropertyListingInput[],
): CasaHudValidatedListings {
  const seen = new Set<string>();
  const validations: CasaHudListingValidationResult[] = listings.map((listing) => {
    const matchedClaims: string[] = [];
    const riskFlags: string[] = [];
    const price = numericPrice(listing);
    const key = listingKey(listing);
    if (listing.listingUrl) matchedClaims.push("source URL present");
    else riskFlags.push("Missing source URL.");
    if (price !== null) matchedClaims.push("price present");
    else riskFlags.push("Missing numeric price.");
    if (strategy.budgetCeiling && price !== null && price > strategy.budgetCeiling) {
      riskFlags.push("Price exceeds title budget promise.");
    }
    if ([listing.city, listing.region, listing.country].filter(Boolean).join(" ").toLowerCase().includes(strategy.primaryMarket.toLowerCase())) {
      matchedClaims.push("location matches target market");
    } else if (strategy.primaryMarket !== "Italy") {
      riskFlags.push("Location does not clearly match title market.");
    }
    if ((listing.imageUrls || []).length >= 3) matchedClaims.push("media available");
    else riskFlags.push("Too few listing images for video production.");
    if (seen.has(key)) riskFlags.push("Duplicate listing candidate.");
    seen.add(key);
    if (!listing.sourceAttribution && !listing.source) riskFlags.push("Missing source attribution.");

    const score = clampScore(100 - riskFlags.length * 18 + matchedClaims.length * 4);
    return {
      listingId: stableCasaHudId("listing", key),
      title: listing.title,
      valid: riskFlags.length === 0,
      score,
      matchedClaims,
      riskFlags,
      sourceUrl: listing.listingUrl,
    };
  });

  const selectedListings = listings
    .map((listing, index) => ({ listing, validation: validations[index] }))
    .filter((entry) => entry.validation?.valid)
    .sort((a, b) => (b.validation?.score || 0) - (a.validation?.score || 0))
    .slice(0, strategy.listingCountTarget)
    .map((entry) => entry.listing);

  const blockingReasons =
    selectedListings.length > 0
      ? []
      : ["No listing candidates passed the title-promise validation gate."];

  return {
    status: blockingReasons.length > 0 ? "blocked" : "ready",
    selectedListings,
    validations,
    blockingReasons,
  };
}

export async function enrichLocationsForListings(listings: PropertyListingInput[]): Promise<CasaHudLocationIntelligenceResult[]> {
  const provider = createLocationProvider();
  return Promise.all(
    listings.map(async (listing) => {
      const normalized = normalizePropertyListingInput(listing);
      const enrichment = await provider.enrich(normalized);
      return {
        listingTitle: listing.title,
        enrichment,
        influenceNotes: [
          `Hook uses ${enrichment.locationLabel} as the location anchor.`,
          `Storyboard reserves map/POI scenes for ${enrichment.pointsOfInterest.slice(0, 3).map((poi) => poi.category).join(", ")}.`,
          "Exact distance claims stay out of narration unless provider data supplies them.",
        ],
      };
    }),
  );
}

export function generateScriptPackage(params: {
  title: string;
  strategy: CasaHudContentStrategy;
  listings: PropertyListingInput[];
  locationIntelligence: CasaHudLocationIntelligenceResult[];
}): CasaHudScriptPackage {
  const listingLine = params.listings
    .map((listing, index) => `${index + 1}. ${listing.title} in ${[listing.city, listing.region].filter(Boolean).join(", ")}`)
    .join(" ");
  const poiLine = params.locationIntelligence
    .flatMap((item) => item.enrichment.pointsOfInterest.slice(0, 2).map((poi) => poi.category.replace(/_/g, " ")))
    .slice(0, 5)
    .join(", ");

  const hook = `${params.title} - but only if the listings and locations actually support the promise.`;
  const scenes: PropertyVideoScene[] = [
    {
      order: 1,
      title: "Viral Hook",
      visualDirection: "Fast title card, strongest listing image, then map orientation.",
      narration: hook,
      overlayText: params.title,
      suggestedMedia: ["selected listing hero image", "regional map"],
      durationSeconds: 10,
    },
    {
      order: 2,
      title: "Opportunity Setup",
      visualDirection: "YouTube-style pacing with clear market and budget context.",
      narration: params.strategy.strategySummary,
      overlayText: `${params.strategy.primaryMarket} | ${params.strategy.videoType.replace(/_/g, " ")}`,
      suggestedMedia: ["market map", "title pattern card"],
      durationSeconds: 14,
    },
    {
      order: 3,
      title: "Listing Proof",
      visualDirection: "Ranked listing sequence with source attribution and price lockups.",
      narration: listingLine,
      overlayText: `${params.listings.length} validated listing${params.listings.length === 1 ? "" : "s"}`,
      suggestedMedia: params.listings.flatMap((listing) => listing.imageUrls.slice(0, 1)),
      durationSeconds: Math.max(18, params.listings.length * 8),
    },
    {
      order: 4,
      title: "Map and POI Context",
      visualDirection: "Map scene with POI callouts, travel context, and lifestyle anchors.",
      narration: `Location matters because the viewer needs to understand daily life, access, and tradeoffs. Priority context: ${poiLine || "POI provider pending"}.`,
      overlayText: "Maps + POIs drive the story",
      suggestedMedia: ["map visual", "POI sequence"],
      durationSeconds: 16,
    },
    {
      order: 5,
      title: "Review Gate",
      visualDirection: "Editorial checklist before upload.",
      narration:
        "Before publishing, CasaHUD flags unsupported claims, missing source data, and any provider gaps for human approval.",
      overlayText: "Human review required",
      suggestedMedia: ["review checklist", "YouTube package preview"],
      durationSeconds: 9,
    },
  ];

  return {
    hook,
    narrationScript: scenes.map((scene) => `Scene ${scene.order} - ${scene.title}: ${scene.narration}`).join("\n\n"),
    scenes,
    factNotes: params.strategy.requiredListingEvidence,
    titleUsed: params.title,
  };
}

function toPropertyVideoPlan(params: {
  idSeed: string;
  title: string;
  script: CasaHudScriptPackage;
  locationIntelligence: CasaHudLocationIntelligenceResult[];
}): PropertyVideoPlan {
  return {
    id: stableCasaHudId("plan", params.idSeed),
    channel: "Expat AI",
    status: "draft_plan_ready",
    listingSummary: params.script.factNotes.join(" | "),
    hook: params.script.hook,
    scenes: params.script.scenes,
    narrationScript: params.script.narrationScript,
    youtubeTitle: params.title,
    youtubeDescription: params.script.narrationScript,
    enrichmentSummary: params.locationIntelligence.map((item) => item.enrichment.summary).join(" "),
    locationIntelligence: params.locationIntelligence[0]?.enrichment
      ? {
          status: params.locationIntelligence[0].enrichment.status,
          provider: params.locationIntelligence[0].enrichment.provider,
          locationLabel: params.locationIntelligence[0].enrichment.locationLabel,
          coordinates: params.locationIntelligence[0].enrichment.coordinates,
          pointsOfInterest: params.locationIntelligence[0].enrichment.pointsOfInterest,
          placeholderMessage: params.locationIntelligence[0].enrichment.placeholderMessage,
        }
      : undefined,
    renderPlaceholder: {
      status: "pending_provider_connection",
      nextStep: "Create Studio render job after human review.",
      provider: "CasaHUD Studio renderer",
    },
  };
}

export function generateStoryboardAndRenderPlan(params: {
  title: string;
  script: CasaHudScriptPackage;
  listings: PropertyListingInput[];
  locationIntelligence: CasaHudLocationIntelligenceResult[];
}): CasaHudStoryboardPackage {
  const plan = toPropertyVideoPlan({
    idSeed: `${params.title}:${params.listings.map((listing) => listing.title).join("|")}`,
    title: params.title,
    script: params.script,
    locationIntelligence: params.locationIntelligence,
  });
  const listingInput = params.listings[0] || {
    country: "Italy",
    title: params.title,
    imageUrls: [],
  };
  const baseRenderPlan = createDomaraRenderPlan({
    plan,
    listingInput,
    stylePreset: "expat_ai_editorial",
    mapSettings: { mode: "auto" },
  });
  const mapVisual = resolveDomaraMapVisuals({ mode: "auto", listingInput, plan });
  const renderPlan = applyMapVisualsToRenderPlan(baseRenderPlan, mapVisual);

  return {
    scenes: params.script.scenes,
    renderPlan,
    mapSceneCount: renderPlan.timeline.filter((scene) => /map|location|poi/i.test(`${scene.title} ${scene.overlayText}`)).length,
    poiDrivenSceneCount: params.script.scenes.filter((scene) => /poi|map|location/i.test(`${scene.title} ${scene.narration}`)).length,
  };
}

export function generateCasaHudYouTubePackage(params: {
  title: string;
  titleCandidates: CasaHudTitleCandidate[];
  script: CasaHudScriptPackage;
  listings: PropertyListingInput[];
  locationIntelligence: CasaHudLocationIntelligenceResult[];
}): DomaraYouTubePackage {
  const plan = toPropertyVideoPlan({
    idSeed: `${params.title}:youtube`,
    title: params.title,
    script: params.script,
    locationIntelligence: params.locationIntelligence,
  });
  const basePackage = generateDomaraYouTubePackage({
    plan,
    listingInput: params.listings[0] || { country: "Italy", title: params.title, imageUrls: [] },
  });

  return {
    ...basePackage,
    finalRecommendedTitle: params.title,
    titleVariants: params.titleCandidates.map((candidate) => ({
      angle: "lifestyle",
      title: candidate.title,
    })),
    description: [
      `Title: ${params.title}`,
      "",
      params.script.narrationScript,
      "",
      "Source attribution:",
      ...params.listings.map((listing) => [listing.sourceAttribution || listing.source, listing.listingUrl].filter(Boolean).join(" | ")),
      "",
      "Human approval required: publishing is blocked until a human approves provider data and claims.",
    ].join("\n"),
    tags: Array.from(
      new Set([
        ...basePackage.tags,
        "CasaHUD",
        "real estate YouTube",
        params.listings[0]?.region || "Italy real estate",
        params.listings[0]?.city || "property roundup",
      ].filter(Boolean)),
    ),
    thumbnailIdeas: [
      {
        text: params.title.slice(0, 44),
        visualDirection: "Best listing image plus clean budget/location lockup and one map cue.",
      },
      ...basePackage.thumbnailIdeas,
    ],
    metadata: {
      ...basePackage.metadata,
      renderLinked: false,
      complianceNote: "Human approval required before publish or schedule. Unsupported listing claims must be removed.",
    },
  };
}
