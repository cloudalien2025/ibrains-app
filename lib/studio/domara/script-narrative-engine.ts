import { nowIso, stableCasaHudId } from "@/lib/studio/domara/ai-channel-engine/ids";
import type { CasaHudListingLocationInsight } from "@/lib/studio/domara/campaign-location-intelligence";
import {
  createEmptyCasaHudScriptData,
  parseCasaHudScriptData,
  type CasaHudPropertySegment,
  type CasaHudScriptData,
  type CasaHudScriptProviderStatus,
  type CasaHudScriptSegment,
} from "@/lib/studio/domara/campaign-script-narrative";
import type { CasaHudCampaign, CasaHudValidatedListing } from "@/lib/studio/domara/campaigns";

type FetchLike = typeof fetch;

type CasaHudScriptNarrativeOptions = {
  openAiApiKey?: string | null;
  fetchImpl?: FetchLike;
  providerTimeoutMs?: number;
  model?: string | null;
  generatedAt?: string;
};

type OpenAiChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
};

const DEFAULT_OPENAI_TIMEOUT_MS = 4_500;
const BANNED_SCRIPT_PHRASES: Array<[RegExp, string]> = [
  [/If this title is going to resonate/gi, "Here is the question we're answering today"],
  [/Keep the narrative anchored/gi, "Keep this grounded in real details"],
  [/candidate listing pattern/gi, "listing pattern"],
  [/title promise/gi, "video hook"],
  [/validation phase/gi, "review step"],
  [/location signal/gi, "location detail"],
  [/provider metadata/gi, "source details"],
  [/deterministic fallback/gi, "fallback approach"],
  [/use the listing/gi, "reference the property"],
  [/Video Premise/gi, "What We'll Explore"],
];

function uniqueStrings(values: Array<string | undefined | null>): string[] {
  return Array.from(
    new Set(
      values
        .flatMap((value) => (typeof value === "string" ? [value.trim()] : []))
        .filter((value) => value.length > 0),
    ),
  );
}

function sanitizeViewerLine(value: string | null | undefined): string | null {
  if (!value) return null;
  let current = value;
  for (const [pattern, replacement] of BANNED_SCRIPT_PHRASES) {
    current = current.replace(pattern, replacement);
  }
  current = current.replace(/\s+/g, " ").trim();
  return current || null;
}

function joinNatural(values: string[]): string {
  if (values.length === 0) return "";
  if (values.length === 1) return values[0]!;
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(", ")}, and ${values[values.length - 1]}`;
}

function formatListingPrice(price?: number, currency?: string): string | null {
  if (typeof price !== "number" || !Number.isFinite(price)) return null;
  if (currency === "EUR") return `EUR ${price.toLocaleString("en-US")}`;
  if (currency === "USD") return `USD ${price.toLocaleString("en-US")}`;
  return `${currency || "EUR"} ${price.toLocaleString("en-US")}`;
}

function orderedApprovedListings(campaign: CasaHudCampaign): CasaHudValidatedListing[] {
  const rankMap = new Map(campaign.listingRankOrder.map((id, index) => [id, index]));
  return [...campaign.approvedListings].sort((left, right) => {
    const leftRank = rankMap.get(left.id) ?? left.rank ?? Number.MAX_SAFE_INTEGER;
    const rightRank = rankMap.get(right.id) ?? right.rank ?? Number.MAX_SAFE_INTEGER;
    if (leftRank !== rightRank) return leftRank - rightRank;
    return right.overallScore - left.overallScore;
  });
}

function listingInsightById(campaign: CasaHudCampaign): Map<string, CasaHudListingLocationInsight> {
  return new Map(campaign.listingLocationInsights.map((insight) => [insight.listingId, insight]));
}

function buildListingFactBullets(listing: CasaHudValidatedListing): string[] {
  return uniqueStrings([
    formatListingPrice(listing.price, listing.currency),
    listing.propertyType,
    typeof listing.bedrooms === "number" ? `${listing.bedrooms} bedrooms` : undefined,
    typeof listing.bathrooms === "number" ? `${listing.bathrooms} bathrooms` : undefined,
    typeof listing.sizeSqm === "number" ? `${listing.sizeSqm} sqm` : undefined,
    listing.city || listing.region || listing.locationText,
  ]);
}

function listingSetupLine(listing: CasaHudValidatedListing): string {
  const facts = buildListingFactBullets(listing);
  if (facts.length === 0) {
    return `${listing.title} is in ${listing.locationText}, and it still gives us a useful local benchmark for this episode.`;
  }
  return `${listing.title} is in ${listing.locationText}, with ${facts.join(", ")}.`;
}

function titleSupportWarning(campaign: CasaHudCampaign): string | null {
  if (typeof campaign.titleSupportConfidence !== "number") return "Story support is still unscored, so the narration should stay conservative about the main hook.";
  if (campaign.titleSupportConfidence < 55) {
    return `Story support is weak at ${campaign.titleSupportConfidence}%, so the script should frame the hook as an honest exploration rather than a finished verdict.`;
  }
  if (campaign.titleSupportConfidence < 72) {
    return `Story support is moderate at ${campaign.titleSupportConfidence}%, so keep the hook ambitious but grounded in what the shortlist actually proves.`;
  }
  return null;
}

function locationFallbackWarning(campaign: CasaHudCampaign): string | null {
  const fallbackUsed = campaign.locationProviderStatuses.some(
    (status) => status.state === "fallback" || status.state === "missing_credentials",
  );
  if (!fallbackUsed) return null;
  return "Location coverage is still partial, so the narration should avoid live-distance, venue-recency, or inventory-freshness claims.";
}

function listingCoverageWarnings(campaign: CasaHudCampaign, listings: CasaHudValidatedListing[]): string[] {
  const warnings: string[] = [];
  if (listings.length === 0) {
    warnings.push("No approved listings are available for script generation.");
    return warnings;
  }
  if (campaign.campaignType === "roundup" && listings.length < 2) {
    warnings.push("This roundup only has one approved listing, so the narrative should frame it as a focused shortlist rather than a broad countdown.");
  }
  if (campaign.campaignType === "single_property_showcase" && listings.length > 1) {
    warnings.push("More than one approved listing exists, but the script should keep the first-ranked property as the clear primary focus.");
  }
  if (listings.some((listing) => listing.photoAvailability === "none")) {
    warnings.push("One or more approved listings have no photo coverage, so the script should avoid overly visual line reads for those segments.");
  }
  if (listings.some((listing) => !listing.descriptionSnippet && listing.features.length === 0)) {
    warnings.push("At least one approved listing has thin source detail, so keep that property segment concise and factual.");
  }
  return warnings;
}

function buildLocationLifestyleLines(campaign: CasaHudCampaign, listings: CasaHudValidatedListing[]): string[] {
  const insightMap = listingInsightById(campaign);
  const regionHighlights = campaign.locationStory?.regionHighlights || [];
  const lifestyleAnchors = campaign.locationStory?.lifestyleAnchors || [];
  const localHighlightLines = campaign.localHighlights.slice(0, 2).map((highlight) => highlight.description);
  const insightLines = listings
    .slice(0, 3)
    .flatMap((listing) => {
      const insight = insightMap.get(listing.id);
      return uniqueStrings([insight?.summary, insight?.highlights[0], insight?.locationStrengths[0]]);
    })
    .slice(0, 3);

  return uniqueStrings([
    regionHighlights.length > 0 ? `Before we tour the homes, let's place this in context around ${joinNatural(regionHighlights)}.` : null,
    lifestyleAnchors.length > 0 ? `What matters most here is day-to-day life: ${joinNatural(lifestyleAnchors)}.` : null,
    ...localHighlightLines,
    ...insightLines,
  ])
    .map((line) => sanitizeViewerLine(line))
    .filter((line): line is string => Boolean(line))
    .slice(0, 5);
}

function campaignTypePremise(campaign: CasaHudCampaign, listings: CasaHudValidatedListing[]): string {
  const propertyCount = listings.length;
  switch (campaign.campaignType) {
    case "roundup":
      return `Today we're touring ${propertyCount} approved homes that all fit the same story, so you can compare real options side by side.`;
    case "single_property_showcase":
      return "Today we're focusing on one standout home, then using local context to show what life around that property would actually feel like.";
    case "niche_category":
      return `We'll define this niche first, then test it against ${propertyCount} approved homes to see whether the category really holds up.`;
    case "location_led":
      return `This is a place-first episode: we'll start with the location, then use ${propertyCount} approved homes to show what you actually get there.`;
    case "lifestyle_relocation":
      return `This episode is about relocation fit: budget, daily routine, and the tradeoffs behind ${propertyCount} approved listings.`;
  }
}

function buildOpeningHook(campaign: CasaHudCampaign, listings: CasaHudValidatedListing[]): string {
  const leadListing = listings[0];
  const region = campaign.marketRegionHint || leadListing?.region || leadListing?.locationText || "this market";
  switch (campaign.campaignType) {
    case "roundup":
      return `Can you still find real opportunities in ${region}? In this video, we're looking at approved listings and what each one gets you.`;
    case "single_property_showcase":
      return `${leadListing?.title || "This home"} is our focus today, and we're breaking down why it stands out once you factor in price, space, and location.`;
    case "niche_category":
      return `Is this niche actually buyable in ${region}? Let's test it using real, approved listings instead of wishful examples.`;
    case "location_led":
      return `Before we talk floor plans and pricing, we need to understand ${region} itself, because place is the real headline of this episode.`;
    case "lifestyle_relocation":
      return `Could you really build a comfortable life in ${region} without blowing your budget? That's what we're testing with real homes and real tradeoffs.`;
  }
}

function buildPropertyNarration(
  campaign: CasaHudCampaign,
  listing: CasaHudValidatedListing,
  insight?: CasaHudListingLocationInsight,
): CasaHudPropertySegment {
  const supportedFacts = buildListingFactBullets(listing);
  const insightLine = insight?.summary || insight?.highlights[0] || insight?.locationStrengths[0];
  const descriptionLead =
    listing.casaHudNarrationSeed ||
    listing.summary ||
    (listing.descriptionSnippet
      ? listing.descriptionSnippet.replace(/\s+/g, " ").trim()
      : "Source detail is lighter on this one, so we'll stick to the verified facts.");

  let whyItMadeTheCut = `It helps answer the main question with concrete details: ${supportedFacts.slice(0, 3).join(", ")}.`;
  if (campaign.campaignType === "location_led") {
    whyItMadeTheCut = "It shows how the location story translates into a real home option.";
  } else if (campaign.campaignType === "single_property_showcase") {
    whyItMadeTheCut = "It is the clear centerpiece, so we can stay with the home long enough to show what really matters.";
  } else if (campaign.campaignType === "lifestyle_relocation") {
    whyItMadeTheCut = "It balances affordability, livability, and location in a way relocation viewers can evaluate honestly.";
  }

  const narration = uniqueStrings([
    listingSetupLine(listing),
    descriptionLead,
    insightLine ? insightLine : null,
  ])
    .map((line) => sanitizeViewerLine(line))
    .filter((line): line is string => Boolean(line))
    .join(" ");

  const caution = uniqueStrings([
    ...listing.warnings,
    ...(insight?.warnings || []),
  ])[0];

  return {
    listingId: listing.id,
    title: listing.title,
    locationText: listing.locationText,
    narration,
    whyItMadeTheCut,
    supportedFacts,
    locationLine: insightLine || undefined,
    caution: caution || undefined,
  };
}

function buildTransitions(campaign: CasaHudCampaign, propertySegments: CasaHudPropertySegment[]): string[] {
  return propertySegments.slice(0, -1).map((segment, index) => {
    const nextSegment = propertySegments[index + 1]!;
    switch (campaign.campaignType) {
      case "roundup":
        return `From ${segment.locationText}, let's jump to ${nextSegment.locationText} and see how the value shifts.`;
      case "single_property_showcase":
        return "Now that you've seen the core layout, let's zoom out to the surrounding area and then come back to the home's key selling point.";
      case "niche_category":
        return `Next up is ${nextSegment.title}, and we'll judge it against the same niche criteria so the comparison stays fair.`;
      case "location_led":
        return `Let's step back to the location for a moment, then drop into ${nextSegment.title} as another real example.`;
      case "lifestyle_relocation":
        return `Let's move to ${nextSegment.locationText} and see how that changes the daily-life equation for a relocation decision.`;
    }
  });
}

function buildToneAndPacingNotes(campaign: CasaHudCampaign, propertySegments: CasaHudPropertySegment[]): string[] {
  const notes = [
    "Keep the delivery premium and clear; cinematic phrasing is fine, but every claim still needs to trace back to validated listing or location support.",
    "Move quickly through verified facts first, then let the lifestyle and location framing add texture instead of replacing substance.",
    "Avoid sounding like a sales brochure; the narration should feel editorial, specific, and grounded in the shortlist.",
  ];

  if (campaign.campaignType === "roundup") {
    notes.push("Treat each property segment as a brisk beat, not a full walkthrough, so the list format keeps momentum.");
  }
  if (campaign.campaignType === "single_property_showcase") {
    notes.push("Slow the pacing slightly around the lead property so the structure feels like a walkthrough concept rather than a list.");
  }
  if (propertySegments.some((segment) => segment.caution)) {
    notes.push("Where source detail is thinner, use shorter sentences and avoid decorative specifics the listing package does not prove.");
  }

  return notes;
}

function buildClosingCta(campaign: CasaHudCampaign): string {
  switch (campaign.campaignType) {
    case "roundup":
      return "Which of these homes would you shortlist first? Drop your pick in the comments, and tell us why.";
    case "single_property_showcase":
      return "If this walkthrough helped, subscribe for the next property breakdown and let us know what you'd want to see next.";
    case "niche_category":
      return "If this niche is on your radar, comment with the example that felt most realistic for your goals.";
    case "location_led":
      return "If you want more place-first home tours, follow along and tell us which area we should break down next.";
    case "lifestyle_relocation":
      return "If you're seriously considering a move, tell us which home felt like the best fit and what tradeoff mattered most to you.";
  }
}

function buildSummary(campaign: CasaHudCampaign, propertySegments: CasaHudPropertySegment[]): string {
  const count = propertySegments.length;
  switch (campaign.campaignType) {
    case "roundup":
      return `A viewer-facing roundup script built around ${count} approved listings with fast transitions and clear comparisons.`;
    case "single_property_showcase":
      return "A viewer-facing showcase script centered on one lead property with supporting local context.";
    case "niche_category":
      return `A category-led script that tests the niche against ${count} approved property examples.`;
    case "location_led":
      return `A place-first script that uses ${count} approved listings to ground the location story in real options.`;
    case "lifestyle_relocation":
      return `A relocation-focused script that translates ${count} approved listings into practical day-to-day tradeoffs for viewers.`;
  }
}

function buildScriptSegments(
  campaign: CasaHudCampaign,
  propertySegments: CasaHudPropertySegment[],
  locationLifestyleLines: string[],
  transitions: string[],
): CasaHudScriptSegment[] {
  const segments: CasaHudScriptSegment[] = [];
  const locationLead =
    locationLifestyleLines[0] ||
    campaign.locationStory?.summary ||
    campaign.locationIntelligenceSummary?.coverageSummary ||
    "Let's quickly set the scene so the property choices make sense in real life.";

  segments.push({
    id: stableCasaHudId("casahud-script-segment", `${campaign.id}:hook`),
    title: "Opening Hook",
    segmentType: "hook",
    narration: buildOpeningHook(campaign, orderedApprovedListings(campaign)),
    durationSeconds: campaign.campaignType === "single_property_showcase" ? 18 : 14,
    visualNote: campaign.mapSceneIdeas[0]?.suggestedVisual || "Open on the strongest verified place or listing anchor once the visual package is assembled.",
  });

  segments.push({
    id: stableCasaHudId("casahud-script-segment", `${campaign.id}:premise`),
    title: "What We'll Explore",
    segmentType: "premise",
    narration: campaignTypePremise(campaign, orderedApprovedListings(campaign)),
    durationSeconds: 16,
    visualNote: "Use headline overlays and premium framing, not raw provider or debug language.",
  });

  segments.push({
    id: stableCasaHudId("casahud-script-segment", `${campaign.id}:location`),
    title: "Location Story",
    segmentType: "location_context",
    narration: locationLead,
    durationSeconds: campaign.campaignType === "location_led" ? 18 : 12,
    visualNote: campaign.mapSceneIdeas[0]?.suggestedVisual || "Reuse the location visual plan at a high level only.",
  });

  propertySegments.forEach((segment, index) => {
    segments.push({
      id: stableCasaHudId("casahud-script-segment", `${campaign.id}:property:${segment.listingId}`),
      title: `Property ${index + 1}: ${segment.title}`,
      segmentType: "property_focus",
      narration: segment.narration,
      durationSeconds: campaign.campaignType === "single_property_showcase" ? 32 : 24,
      associatedListingId: segment.listingId,
      visualNote: "Keep the segment anchored to verified listing facts and place support; final asset mapping belongs in the visual plan.",
    });

    const transition = transitions[index];
    if (transition) {
      segments.push({
        id: stableCasaHudId("casahud-script-segment", `${campaign.id}:transition:${index}`),
        title: `Transition ${index + 1}`,
        segmentType: "transition",
        narration: transition,
        durationSeconds: 8,
        visualNote: "Use this beat to reset pacing between properties without introducing unverified claims.",
      });
    }
  });

  segments.push({
    id: stableCasaHudId("casahud-script-segment", `${campaign.id}:closing`),
    title: "Closing CTA",
    segmentType: "closing_cta",
    narration: buildClosingCta(campaign),
    durationSeconds: 12,
    visualNote: "End on a clean editorial CTA and hand forward to media planning.",
  });

  return segments;
}

function buildFullScriptText(segments: CasaHudScriptSegment[]): string {
  return segments
    .map((segment) => sanitizeViewerLine(segment.narration))
    .filter((line): line is string => Boolean(line))
    .join("\n\n");
}

function sanitizeScriptData(script: CasaHudScriptData): CasaHudScriptData {
  const scriptSegments = script.scriptSegments.map((segment) => ({
    ...segment,
    title: sanitizeViewerLine(segment.title) || segment.title,
    narration: sanitizeViewerLine(segment.narration) || segment.narration,
  }));
  const propertySegments = script.propertySegments.map((segment) => ({
    ...segment,
    narration: sanitizeViewerLine(segment.narration) || segment.narration,
    whyItMadeTheCut: sanitizeViewerLine(segment.whyItMadeTheCut) || segment.whyItMadeTheCut,
    locationLine: sanitizeViewerLine(segment.locationLine) || segment.locationLine,
    caution: sanitizeViewerLine(segment.caution) || segment.caution,
  }));

  return {
    ...script,
    scriptSummary: sanitizeViewerLine(script.scriptSummary),
    openingHook: sanitizeViewerLine(script.openingHook),
    tone: sanitizeViewerLine(script.tone),
    scriptSegments,
    propertySegments,
    locationLifestyleLines: script.locationLifestyleLines
      .map((line) => sanitizeViewerLine(line))
      .filter((line): line is string => Boolean(line)),
    transitions: script.transitions
      .map((line) => sanitizeViewerLine(line))
      .filter((line): line is string => Boolean(line)),
    closingCta: sanitizeViewerLine(script.closingCta),
    toneAndPacingNotes: script.toneAndPacingNotes
      .map((line) => sanitizeViewerLine(line))
      .filter((line): line is string => Boolean(line)),
    scriptWarnings: script.scriptWarnings
      .map((line) => sanitizeViewerLine(line))
      .filter((line): line is string => Boolean(line)),
    fullScriptText: buildFullScriptText(scriptSegments),
  };
}

function buildFallbackProviderStatus(detail: string, warning?: string): CasaHudScriptProviderStatus {
  return {
    provider: "casahud_script_patterns",
    label: "CasaFlix script patterns",
    state: "fallback",
    configured: true,
    used: true,
    detail,
    warning,
  };
}

function buildLiveProviderStatus(detail: string): CasaHudScriptProviderStatus {
  return {
    provider: "openai",
    label: "OpenAI",
    state: "connected",
    configured: true,
    used: true,
    detail,
  };
}

function buildFallbackScript(campaign: CasaHudCampaign, generatedAt = nowIso(), extraWarnings: string[] = []): CasaHudScriptData {
  const listings = campaign.campaignType === "single_property_showcase"
    ? orderedApprovedListings(campaign).slice(0, 1)
    : orderedApprovedListings(campaign);
  const insightMap = listingInsightById(campaign);
  const propertySegments = listings.map((listing) => buildPropertyNarration(campaign, listing, insightMap.get(listing.id)));
  const locationLifestyleLines = buildLocationLifestyleLines(campaign, listings);
  const transitions = buildTransitions(campaign, propertySegments);
  const scriptSegments = buildScriptSegments(campaign, propertySegments, locationLifestyleLines, transitions);
  const estimatedDurationSeconds = scriptSegments.reduce((sum, segment) => sum + segment.durationSeconds, 0);
  const warnings = uniqueStrings([
    titleSupportWarning(campaign),
    locationFallbackWarning(campaign),
    ...listingCoverageWarnings(campaign, listings),
    ...campaign.validationWarnings,
    ...campaign.locationWarnings,
    ...extraWarnings,
  ]);

  return sanitizeScriptData({
    ...createEmptyCasaHudScriptData(),
    scriptGenerationStatus: "script_generated",
    scriptSummary: buildSummary(campaign, propertySegments),
    openingHook: buildOpeningHook(campaign, listings),
    estimatedDurationSeconds,
    tone: "Premium, clear, cinematic where appropriate, and tightly grounded in validated property and location support.",
    scriptSegments,
    propertySegments,
    locationLifestyleLines,
    transitions,
    closingCta: buildClosingCta(campaign),
    toneAndPacingNotes: buildToneAndPacingNotes(campaign, propertySegments),
    scriptWarnings: warnings,
    scriptProviderStatus: buildFallbackProviderStatus(
      `Using deterministic CasaFlix script composition generated from validated listings and saved location intelligence at ${generatedAt}.`,
      warnings[0],
    ),
    fullScriptText: buildFullScriptText(scriptSegments),
  });
}

function buildOpenAiPrompt(campaign: CasaHudCampaign, fallback: CasaHudScriptData): string {
  const listings = orderedApprovedListings(campaign).map((listing) => ({
    id: listing.id,
    title: listing.title,
    locationText: listing.locationText,
    price: formatListingPrice(listing.price, listing.currency),
    propertyType: listing.propertyType || null,
    bedrooms: typeof listing.bedrooms === "number" ? listing.bedrooms : null,
    bathrooms: typeof listing.bathrooms === "number" ? listing.bathrooms : null,
    sizeSqm: typeof listing.sizeSqm === "number" ? listing.sizeSqm : null,
    descriptionSnippet: listing.descriptionSnippet || null,
    features: listing.features,
    validationReasons: listing.validationReasons,
    warnings: listing.warnings,
    rank: listing.rank ?? null,
  }));

  const context = {
    campaignType: campaign.campaignType,
    selectedViralTitle: campaign.selectedViralTitle,
    researchSummary: campaign.researchBrief.summary,
    titleSupportConfidence: campaign.titleSupportConfidence,
    locationStory: campaign.locationStory,
    localHighlights: campaign.localHighlights,
    mapSceneIdeas: campaign.mapSceneIdeas,
    listingLocationInsights: campaign.listingLocationInsights,
    providerStatuses: campaign.locationProviderStatuses,
    listings,
    deterministicBaseline: {
      scriptSummary: fallback.scriptSummary,
      openingHook: fallback.openingHook,
      transitions: fallback.transitions,
      scriptWarnings: fallback.scriptWarnings,
      toneAndPacingNotes: fallback.toneAndPacingNotes,
    },
  };

  return [
    "You are CasaFlix's real-estate YouTube script agent.",
    "Return only JSON.",
    "Do not invent unsupported listing facts, distances, amenities, or live-provider claims.",
    "Respect fallback provider coverage warnings when writing location copy.",
    "Keys required:",
    "scriptSummary, openingHook, estimatedDurationSeconds, tone, scriptSegments, propertySegments, locationLifestyleLines, transitions, closingCta, toneAndPacingNotes, scriptWarnings, fullScriptText",
    "Each scriptSegments item must include id, title, segmentType, narration, durationSeconds, optional associatedListingId, optional visualNote.",
    "Each propertySegments item must include listingId, title, locationText, narration, whyItMadeTheCut, supportedFacts, optional locationLine, optional caution.",
    "",
    JSON.stringify(context),
  ].join("\n");
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutId: NodeJS.Timeout | undefined;
  try {
    return await new Promise<T>((resolve, reject) => {
      timeoutId = setTimeout(() => reject(new Error(`timeout after ${timeoutMs}ms`)), timeoutMs);
      promise.then(resolve).catch(reject);
    });
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

async function tryLiveOpenAiScript(
  campaign: CasaHudCampaign,
  fallback: CasaHudScriptData,
  options: Required<Pick<CasaHudScriptNarrativeOptions, "openAiApiKey" | "fetchImpl" | "providerTimeoutMs" | "model">>,
): Promise<CasaHudScriptData | null> {
  const response = await withTimeout(
    options.fetchImpl("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${options.openAiApiKey}`,
      },
      body: JSON.stringify({
        model: options.model,
        temperature: 0.5,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You write truthful, premium YouTube real-estate scripts and return machine-readable JSON only.",
          },
          {
            role: "user",
            content: buildOpenAiPrompt(campaign, fallback),
          },
        ],
      }),
    }).then(async (res) => {
      if (!res.ok) {
        throw new Error(`openai http ${res.status}`);
      }
      return (await res.json()) as OpenAiChatCompletionResponse;
    }),
    options.providerTimeoutMs,
  );

  const content = response.choices?.[0]?.message?.content?.trim();
  if (!content) return null;

  const parsed = JSON.parse(content) as Record<string, unknown>;
  const script = parseCasaHudScriptData(parsed);
  if (script.scriptGenerationStatus !== "script_generated") return null;

  return sanitizeScriptData({
    ...script,
    scriptProviderStatus: buildLiveProviderStatus("Using OpenAI to turn the validated campaign package into the review-ready narrative structure."),
  });
}

export async function runCasaHudScriptNarrative(
  campaign: CasaHudCampaign,
  options: CasaHudScriptNarrativeOptions = {},
): Promise<CasaHudScriptData> {
  const generatedAt = options.generatedAt || nowIso();
  const fallback = buildFallbackScript(campaign, generatedAt);
  const openAiApiKey = options.openAiApiKey?.trim();

  if (!openAiApiKey) {
    return fallback;
  }

  try {
    const liveScript = await tryLiveOpenAiScript(campaign, fallback, {
      openAiApiKey,
      fetchImpl: options.fetchImpl || fetch,
      providerTimeoutMs: Math.max(500, options.providerTimeoutMs || DEFAULT_OPENAI_TIMEOUT_MS),
      model: options.model?.trim() || process.env.OPENAI_MODEL?.trim() || "gpt-4.1-mini",
    });
    if (liveScript) return liveScript;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Live script generation failed.";
    return buildFallbackScript(campaign, generatedAt, [
      `OpenAI script generation was unavailable (${message}), so CasaFlix used deterministic narrative composition instead.`,
    ]);
  }

  return buildFallbackScript(campaign, generatedAt, [
    "OpenAI returned an incomplete narrative payload, so CasaFlix used deterministic narrative composition instead.",
  ]);
}
