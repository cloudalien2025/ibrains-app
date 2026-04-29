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

function uniqueStrings(values: Array<string | undefined | null>): string[] {
  return Array.from(
    new Set(
      values
        .flatMap((value) => (typeof value === "string" ? [value.trim()] : []))
        .filter((value) => value.length > 0),
    ),
  );
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
  const factLine = facts.length > 0 ? facts.join(", ") : listing.locationText;
  return `${listing.title} in ${listing.locationText} keeps the segment grounded with ${factLine}.`;
}

function titleSupportWarning(campaign: CasaHudCampaign): string | null {
  if (typeof campaign.titleSupportConfidence !== "number") return "Title-support confidence is still unscored, so the narrative should stay conservative about the title promise.";
  if (campaign.titleSupportConfidence < 55) {
    return `Title support is weak at ${campaign.titleSupportConfidence}%, so the script should clearly frame the promise as partial rather than proven.`;
  }
  if (campaign.titleSupportConfidence < 72) {
    return `Title support is moderate at ${campaign.titleSupportConfidence}%, so avoid overcommitting the hook beyond what the validated listings prove.`;
  }
  return null;
}

function locationFallbackWarning(campaign: CasaHudCampaign): string | null {
  const fallbackUsed = campaign.locationProviderStatuses.some(
    (status) => status.state === "fallback" || status.state === "missing_credentials",
  );
  if (!fallbackUsed) return null;
  return "Location storytelling uses fallback or incomplete provider coverage, so the narration should avoid live-distance, venue-recency, or inventory-freshness claims.";
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
    regionHighlights.length > 0 ? `Lead the place story through ${joinNatural(regionHighlights)} before drilling into property specifics.` : null,
    lifestyleAnchors.length > 0 ? `Keep the lifestyle framing tied to ${joinNatural(lifestyleAnchors)} rather than generic travel copy.` : null,
    ...localHighlightLines,
    ...insightLines,
  ]).slice(0, 5);
}

function campaignTypePremise(campaign: CasaHudCampaign, listings: CasaHudValidatedListing[]): string {
  const propertyCount = listings.length;
  switch (campaign.campaignType) {
    case "roundup":
      return `Frame the video as a moving shortlist of ${propertyCount} validated properties that each reinforce the title promise without turning the piece into a rigid ranking explainer.`;
    case "single_property_showcase":
      return "Frame the video as a cinematic walkthrough concept centered on the top-ranked property, with place context used only to deepen that one story.";
    case "niche_category":
      return "Open by defining the niche clearly, then let each approved property act as proof that the category is real rather than theoretical.";
    case "location_led":
      return "Let the place story lead the structure, then use the validated properties as evidence for why the location is worth the viewer's attention.";
    case "lifestyle_relocation":
      return "Keep the narrative anchored in day-to-day fit, mobility, and affordability signals so the viewer understands how the move could feel without drifting into advice.";
  }
}

function buildOpeningHook(campaign: CasaHudCampaign, listings: CasaHudValidatedListing[]): string {
  const leadListing = listings[0];
  const region = campaign.marketRegionHint || leadListing?.region || leadListing?.locationText || "this market";
  switch (campaign.campaignType) {
    case "roundup":
      return `The hook here is simple: if the title promise is going to hold up, these are the validated properties in ${region} that actually keep the story honest.`;
    case "single_property_showcase":
      return `${leadListing?.title || "This property"} is the kind of listing that only works on YouTube when the home and the place can carry the same story, and that is exactly what this script sets up.`;
    case "niche_category":
      return `This video opens by proving the niche before it sells the fantasy, using validated listings that make the category feel real and repeatable.`;
    case "location_led":
      return `${region} has to land as a place first and a property package second, so the opening should make the location feel like the thesis of the video.`;
    case "lifestyle_relocation":
      return `If this title is going to resonate, the opening has to answer one question fast: what does life in ${region} actually look like when the homes are real and the budget still matters?`;
  }
}

function buildPropertyNarration(
  campaign: CasaHudCampaign,
  listing: CasaHudValidatedListing,
  insight?: CasaHudListingLocationInsight,
): CasaHudPropertySegment {
  const supportedFacts = buildListingFactBullets(listing);
  const insightLine = insight?.summary || insight?.highlights[0] || insight?.locationStrengths[0];
  const descriptionLead = listing.descriptionSnippet
    ? listing.descriptionSnippet.replace(/\s+/g, " ").trim()
    : "The source detail is lighter here, so the segment should stay focused on the verified listing facts.";

  let whyItMadeTheCut = `It keeps the title promise grounded through ${supportedFacts.slice(0, 3).join(", ")}.`;
  if (campaign.campaignType === "location_led") {
    whyItMadeTheCut = `It works best as proof that the place story holds up once the property facts arrive.`;
  } else if (campaign.campaignType === "single_property_showcase") {
    whyItMadeTheCut = "It becomes the main walkthrough anchor, so the segment can stay with the property long enough to feel cinematic.";
  } else if (campaign.campaignType === "lifestyle_relocation") {
    whyItMadeTheCut = "It gives the relocation story a believable mix of budget, livability, and location context.";
  }

  const narration = uniqueStrings([
    listingSetupLine(listing),
    descriptionLead,
    insightLine ? `On the location side, ${insightLine}` : null,
  ]).join(" ");

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
        return `From ${segment.locationText}, the script can move quickly into ${nextSegment.locationText} to keep the roundup pace moving without re-explaining the thesis.`;
      case "single_property_showcase":
        return `Use this beat to shift from the property itself into the surrounding context, then back into the home's main selling angle.`;
      case "niche_category":
        return `The transition should connect ${segment.title} to ${nextSegment.title} by reinforcing the niche criteria rather than comparing them like a leaderboard.`;
      case "location_led":
        return `Use the transition to zoom back out to the place story, then drop into ${nextSegment.title} as another proof point.`;
      case "lifestyle_relocation":
        return `Bridge the properties through daily-life fit, showing how ${nextSegment.locationText} changes the relocation story rather than restarting it.`;
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
      return "Close by recapping the strongest fit from the shortlist, then invite the viewer to weigh in on which property best delivers on the title promise.";
    case "single_property_showcase":
      return "Close by returning to the lead property's core appeal, then invite the viewer to follow along for the next verified walkthrough package.";
    case "niche_category":
      return "Close by restating why the niche matters, then invite the viewer to comment on which example best captured the category.";
    case "location_led":
      return "Close on the place story first, then invite the viewer to follow for the next location-led property package.";
    case "lifestyle_relocation":
      return "Close by summarizing who this move feels best suited for, then invite the viewer to follow for the next relocation-focused shortlist.";
  }
}

function buildSummary(campaign: CasaHudCampaign, propertySegments: CasaHudPropertySegment[]): string {
  const count = propertySegments.length;
  switch (campaign.campaignType) {
    case "roundup":
      return `A premium roundup script built around ${count} validated listings, with a fast-moving structure, concise property beats, and transitions that keep the title promise believable.`;
    case "single_property_showcase":
      return "A cinematic showcase script centered on the top-ranked property, with the location story used to deepen the walkthrough instead of distract from it.";
    case "niche_category":
      return `A category-led narrative that explains the niche clearly, then uses ${count} validated properties as supporting proof points.`;
    case "location_led":
      return `A place-first narrative that leads with location context, then uses ${count} validated listings as evidence for why the area matters.`;
    case "lifestyle_relocation":
      return `A relocation-oriented narrative that uses ${count} validated listings and place context to translate the title into a believable daily-life story.`;
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
    "Use the place story to explain why the shortlist works in context.";

  segments.push({
    id: stableCasaHudId("casahud-script-segment", `${campaign.id}:hook`),
    title: "Opening Hook",
    segmentType: "hook",
    narration: buildOpeningHook(campaign, orderedApprovedListings(campaign)),
    durationSeconds: campaign.campaignType === "single_property_showcase" ? 18 : 14,
    visualNote: campaign.mapSceneIdeas[0]?.suggestedVisual || "Open on the strongest verified place or listing anchor once Phase 8 assembles assets.",
  });

  segments.push({
    id: stableCasaHudId("casahud-script-segment", `${campaign.id}:premise`),
    title: "Video Premise",
    segmentType: "premise",
    narration: campaignTypePremise(campaign, orderedApprovedListings(campaign)),
    durationSeconds: 16,
    visualNote: "Use headline overlays and title framing, not raw provider or debug language.",
  });

  segments.push({
    id: stableCasaHudId("casahud-script-segment", `${campaign.id}:location`),
    title: "Location Story",
    segmentType: "location_context",
    narration: locationLead,
    durationSeconds: campaign.campaignType === "location_led" ? 18 : 12,
    visualNote: campaign.mapSceneIdeas[0]?.suggestedVisual || "Reuse Phase 6 map-scene ideas at a high level only.",
  });

  propertySegments.forEach((segment, index) => {
    segments.push({
      id: stableCasaHudId("casahud-script-segment", `${campaign.id}:property:${segment.listingId}`),
      title: `Property ${index + 1}: ${segment.title}`,
      segmentType: "property_focus",
      narration: segment.narration,
      durationSeconds: campaign.campaignType === "single_property_showcase" ? 32 : 24,
      associatedListingId: segment.listingId,
      visualNote: "Keep the segment anchored to verified listing facts and location support; asset mapping belongs to Phase 8.",
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
  return segments.map((segment) => `${segment.title}\n${segment.narration}`).join("\n\n");
}

function buildFallbackProviderStatus(detail: string, warning?: string): CasaHudScriptProviderStatus {
  return {
    provider: "casahud_script_patterns",
    label: "CasaHUD script patterns",
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

  return {
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
      `Using deterministic CasaHUD script composition generated from validated listings and saved location intelligence at ${generatedAt}.`,
      warnings[0],
    ),
    fullScriptText: buildFullScriptText(scriptSegments),
  };
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
    "You are CasaHUD's real-estate YouTube script agent.",
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

  return {
    ...script,
    scriptProviderStatus: buildLiveProviderStatus("Using OpenAI to turn the validated campaign package into the review-ready narrative structure."),
  };
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
      `OpenAI script generation was unavailable (${message}), so CasaHUD used deterministic narrative composition instead.`,
    ]);
  }

  return buildFallbackScript(campaign, generatedAt, [
    "OpenAI returned an incomplete narrative payload, so CasaHUD used deterministic narrative composition instead.",
  ]);
}
