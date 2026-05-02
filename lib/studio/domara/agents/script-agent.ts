import { stableCasaHudId } from "@/lib/studio/domara/ai-channel-engine/ids";
import type { CasaHudListingLocationInsight } from "@/lib/studio/domara/campaign-location-intelligence";
import {
  createEmptyCasaHudScriptData,
  type CasaHudPropertySegment,
  type CasaHudScriptData,
  type CasaHudScriptProviderStatus,
  type CasaHudScriptSegment,
} from "@/lib/studio/domara/campaign-script-narrative";
import type { CasaHudCampaign, CasaHudValidatedListing } from "@/lib/studio/domara/campaigns";
import { deriveCasaHudWorkingListings } from "@/lib/studio/domara/listing-working-set";
import type { CasaHudScriptAgentOptions, CasaHudScriptAgentPromptContext } from "@/lib/studio/domara/agents/types";

const BANNED_VIEWER_REPLACEMENTS: Array<[RegExp, string]> = [
  [/If this title is going to resonate/gi, "The real question in this episode is"],
  [/Keep the narrative anchored/gi, "Keep this grounded"],
  [/candidate listing pattern/gi, "listing pattern"],
  [/title promise/gi, "video hook"],
  [/validation phase/gi, "review step"],
  [/location signal/gi, "location detail"],
  [/provider metadata/gi, "source details"],
  [/deterministic fallback/gi, "fallback approach"],
  [/use the listing/gi, "reference the property"],
  [/Video Premise/gi, "What We Explore"],
];

const DROPPED_VIEWER_PATTERNS: RegExp[] = [
  /\bscript-ready\s+listings?\b/i,
  /\bapproved\s+listings?\b/i,
  /\blisting\s+candidate\b/i,
  /\bcandidate\s+listing\b/i,
  /\bdeterministic\s+fallback\b/i,
  /\bprovider\s+metadata\b/i,
  /\bvalidation\s+phase\b/i,
  /\btitle\s+promise\b/i,
  /\blocation\s+signal\b/i,
  /\bvideo\s+premise\b/i,
  /\bSale\s+villa\b/i,
  /\bHouses?\s+for\s+sale\b/i,
  /\bReal\s+estate\s+agencies?\b/i,
  /\b\d+\s*\/\s*\d+\b/i,
  /^\+?\d+\s+photos?\b/i,
  /^\d+\s+photos?\b/i,
  /\bcookie\b/i,
  /\bprivacy\b/i,
  /\bcontact\s+advertiser\b/i,
];

const HTML_ENTITY_MAP: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&lt;": "<",
  "&gt;": ">",
  "&euro;": "EUR ",
};

export const SCRIPT_QUALITY_REGEN_WARNING =
  "Script needs regeneration because imported source text contained provider/SEO fragments.";

function decodeHtmlEntities(value: string): string {
  let current = value;
  for (const [entity, replacement] of Object.entries(HTML_ENTITY_MAP)) {
    current = current.split(entity).join(replacement);
  }
  return current;
}

function normalizeSpaces(value: string): string {
  return value
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueStrings(values: Array<string | undefined | null>): string[] {
  return Array.from(
    new Set(
      values
        .flatMap((value) => (typeof value === "string" ? [value.trim()] : []))
        .filter((value) => value.length > 0),
    ),
  );
}

function uniqueByCaseFold(values: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const value of values) {
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(value);
  }
  return output;
}

function joinNatural(values: string[]): string {
  if (values.length === 0) return "";
  if (values.length === 1) return values[0]!;
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(", ")}, and ${values[values.length - 1]}`;
}

function dropNoiseFragments(value: string): string {
  let current = value;
  for (const pattern of DROPPED_VIEWER_PATTERNS) {
    current = current.replace(pattern, " ");
  }
  current = current.replace(/([a-z])([A-Z])/g, "$1 $2");
  current = current.replace(/([A-Za-z]{2,})(\1){2,}/gi, "$1");
  current = current.replace(/\b(\d{5})\s+([A-Za-z]+)\s+\2\b/g, "$1 $2");
  return normalizeSpaces(current);
}

function cleanSourceText(value: string | null | undefined): string | null {
  if (!value) return null;
  const decoded = normalizeSpaces(decodeHtmlEntities(value));
  if (!decoded) return null;

  const rawParts = decoded
    .split(/(?<=[.!?])\s+|\s+[|]\s+|\s+[•]\s+|\s+[-]{2,}\s+/)
    .map((part) => normalizeSpaces(part))
    .filter(Boolean);

  const cleanedParts = rawParts
    .map((part) => dropNoiseFragments(part))
    .filter((part) => part.length >= 8)
    .filter((part) => !DROPPED_VIEWER_PATTERNS.some((pattern) => pattern.test(part)));

  if (cleanedParts.length === 0) return null;
  return uniqueByCaseFold(cleanedParts).join(" ");
}

function sanitizeLocationText(value: string | null | undefined): string {
  if (!value) return "this area";
  const cleaned = dropNoiseFragments(decodeHtmlEntities(value));
  const parts = cleaned
    .split(",")
    .map((part) => normalizeSpaces(part))
    .filter(Boolean);

  if (parts.length === 0) return "this area";
  return uniqueByCaseFold(parts).join(", ");
}

function finalizeSentence(value: string): string {
  const trimmed = normalizeSpaces(value);
  if (!trimmed) return "";
  if (/[.!?]$/.test(trimmed)) return trimmed;
  return `${trimmed}.`;
}

function sanitizeViewerLine(value: string | null | undefined, ensureSentence = true): string | null {
  if (!value) return null;
  let current = cleanSourceText(value);
  if (!current) return null;

  for (const [pattern, replacement] of BANNED_VIEWER_REPLACEMENTS) {
    current = current.replace(pattern, replacement);
  }

  current = dropNoiseFragments(current);
  if (!current) return null;

  if (DROPPED_VIEWER_PATTERNS.some((pattern) => pattern.test(current))) return null;
  if (!ensureSentence) return normalizeSpaces(current);
  return finalizeSentence(current);
}

function truncateAtBoundary(value: string, maxChars = 240): string {
  if (value.length <= maxChars) return value;
  const boundary = value.slice(0, maxChars + 1);
  const lastPunctuation = Math.max(boundary.lastIndexOf("."), boundary.lastIndexOf("!"), boundary.lastIndexOf("?"));
  if (lastPunctuation >= 120) {
    return value.slice(0, lastPunctuation + 1);
  }
  const lastSpace = boundary.lastIndexOf(" ");
  if (lastSpace >= 100) {
    return `${value.slice(0, lastSpace).trimEnd()}...`;
  }
  return `${value.slice(0, maxChars).trimEnd()}...`;
}

function sentenceFragments(value: string | null | undefined): string[] {
  const cleaned = cleanSourceText(value);
  if (!cleaned) return [];
  return cleaned
    .split(/(?<=[.!?])\s+/)
    .map((part) => normalizeSpaces(part))
    .filter((part) => part.length > 0)
    .map((part) => finalizeSentence(part));
}

export function formatListingPrice(price?: number, currency?: string): string | null {
  if (typeof price !== "number" || !Number.isFinite(price)) return null;
  const normalizedCurrency = (currency || "EUR").toUpperCase();
  return `${normalizedCurrency} ${price.toLocaleString("en-US")}`;
}

function formatRooms(rooms?: number): string | null {
  if (typeof rooms !== "number" || !Number.isFinite(rooms) || rooms <= 0) return null;
  return rooms === 1 ? "1 room" : `${Math.round(rooms)} rooms`;
}

function formatBathrooms(bathrooms?: number): string | null {
  if (typeof bathrooms !== "number" || !Number.isFinite(bathrooms) || bathrooms <= 0) return null;
  return bathrooms === 1 ? "1 bathroom" : `${Math.round(bathrooms)} bathrooms`;
}

function formatInteriorSize(sizeSqm?: number): string | null {
  if (typeof sizeSqm !== "number" || !Number.isFinite(sizeSqm) || sizeSqm <= 0) return null;
  return `about ${Math.round(sizeSqm)} square meters`;
}

function orderedWorkingListings(campaign: CasaHudCampaign): CasaHudValidatedListing[] {
  const rankMap = new Map(campaign.listingRankOrder.map((id, index) => [id, index]));
  return [...deriveCasaHudWorkingListings(campaign)].sort((left, right) => {
    const leftRank = rankMap.get(left.id) ?? left.rank ?? Number.MAX_SAFE_INTEGER;
    const rightRank = rankMap.get(right.id) ?? right.rank ?? Number.MAX_SAFE_INTEGER;
    if (leftRank !== rightRank) return leftRank - rightRank;
    return right.overallScore - left.overallScore;
  });
}

function listingInsightById(campaign: CasaHudCampaign): Map<string, CasaHudListingLocationInsight> {
  return new Map(campaign.listingLocationInsights.map((insight) => [insight.listingId, insight]));
}

function titleSupportWarning(campaign: CasaHudCampaign): string | null {
  if (typeof campaign.titleSupportConfidence !== "number") {
    return "Story support has not been scored yet, so narration should stay conservative about the headline claim.";
  }
  if (campaign.titleSupportConfidence < 55) {
    return `Story support is currently ${campaign.titleSupportConfidence}%, so present this as an open evaluation rather than a final verdict.`;
  }
  if (campaign.titleSupportConfidence < 72) {
    return `Story support is ${campaign.titleSupportConfidence}%, so keep the hook ambitious but tied to what this shortlist can actually prove.`;
  }
  return null;
}

function locationFallbackWarning(campaign: CasaHudCampaign): string | null {
  const fallbackUsed = campaign.locationProviderStatuses.some(
    (status) => status.state === "fallback" || status.state === "missing_credentials",
  );
  if (!fallbackUsed) return null;
  return "Location coverage is partial, so avoid claims about exact distances, recency, or venue availability.";
}

function listingCoverageWarnings(campaign: CasaHudCampaign, listings: CasaHudValidatedListing[]): string[] {
  const warnings: string[] = [];
  if (listings.length === 0) {
    warnings.push("No complete listings are available for script generation.");
    return warnings;
  }
  if (campaign.campaignType === "roundup" && listings.length < 2) {
    warnings.push("This roundup currently has one listing, so the narration should frame this as the first pass rather than a full countdown.");
  }
  if (campaign.campaignType === "single_property_showcase" && listings.length > 1) {
    warnings.push("More than one property is available, but the script should keep the lead home as the clear center of gravity.");
  }
  if (listings.some((listing) => listing.photoAvailability === "none")) {
    warnings.push("At least one listing has no photo coverage, so visual claims should stay minimal for that section.");
  }
  if (listings.some((listing) => !listing.descriptionSnippet && listing.features.length === 0)) {
    warnings.push("At least one listing has thin source detail, so keep that segment short and factual.");
  }
  return warnings;
}

function buildLocationLifestyleLines(campaign: CasaHudCampaign, listings: CasaHudValidatedListing[]): string[] {
  const insightMap = listingInsightById(campaign);
  const regionHighlights = uniqueByCaseFold((campaign.locationStory?.regionHighlights || []).map((item) => sanitizeLocationText(item)));
  const lifestyleAnchors = uniqueByCaseFold(
    (campaign.locationStory?.lifestyleAnchors || [])
      .map((anchor) => sanitizeViewerLine(anchor))
      .filter((anchor): anchor is string => Boolean(anchor)),
  );

  const localHighlightLines = campaign.localHighlights
    .slice(0, 2)
    .map((highlight) => sanitizeViewerLine(highlight.description))
    .filter((line): line is string => Boolean(line));

  const insightLines = listings
    .slice(0, 3)
    .flatMap((listing) => {
      const insight = insightMap.get(listing.id);
      return uniqueStrings([insight?.summary, insight?.highlights[0], insight?.locationStrengths[0]]);
    })
    .map((line) => sanitizeViewerLine(line))
    .filter((line): line is string => Boolean(line));

  const contextLead =
    regionHighlights.length > 0
      ? sanitizeViewerLine(
          regionHighlights.length === 1
            ? `Our location anchor for this episode is ${regionHighlights[0]}.`
            : `Our location context centers on ${joinNatural(regionHighlights)}.`,
        )
      : null;

  const lifestyleLead =
    lifestyleAnchors.length > 0
      ? sanitizeViewerLine(`The day-to-day angle matters here: ${joinNatural(lifestyleAnchors)}.`)
      : null;

  return uniqueStrings([contextLead, lifestyleLead, ...localHighlightLines, ...insightLines]).slice(0, 5);
}

function campaignTypePremise(campaign: CasaHudCampaign, listings: CasaHudValidatedListing[]): string {
  const propertyCount = listings.length;

  if (campaign.campaignType === "roundup") {
    if (propertyCount <= 1) {
      return "We are starting with one real property today, then testing whether the title claim still holds as the shortlist expands.";
    }
    return `Today we are comparing ${propertyCount} real properties side by side to see where the value actually shifts.`;
  }

  if (campaign.campaignType === "single_property_showcase") {
    return "Today we focus on one standout home, then use local context to show what life around that property could really feel like.";
  }

  if (campaign.campaignType === "niche_category") {
    if (propertyCount <= 1) {
      return "We are testing this niche with one real property first, so we can see if the category claim survives real-world details.";
    }
    return `We will define this niche first, then test it against ${propertyCount} real listings to see if the category claim holds up.`;
  }

  if (campaign.campaignType === "location_led") {
    if (propertyCount <= 1) {
      return "This is a place-first episode: we start with local context, then pressure-test it through one real property.";
    }
    return `This is a place-first episode: we start with location context, then use ${propertyCount} real properties to show what buyers actually get.`;
  }

  if (propertyCount <= 1) {
    return "This episode is about relocation fit: budget, daily routine, and the tradeoffs behind one real property.";
  }

  return `This episode is about relocation fit: budget, daily routine, and the tradeoffs behind ${propertyCount} real properties.`;
}

function buildOpeningHook(campaign: CasaHudCampaign, listings: CasaHudValidatedListing[]): string {
  const leadListing = listings[0];
  const region = sanitizeLocationText(campaign.marketRegionHint || leadListing?.region || leadListing?.locationText || "this market");

  switch (campaign.campaignType) {
    case "roundup":
      return `Can you still find honest value in ${region}? In this video, we test real properties and the tradeoffs behind each one.`;
    case "single_property_showcase":
      return `${sanitizeViewerLine(leadListing?.title || "This home", false)} is our focus today, and we are breaking down why it stands out once price, layout, and location are all on the table.`;
    case "niche_category":
      return `Is this niche actually buyable in ${region}? We are testing it with real listings, not wishlist examples.`;
    case "location_led":
      return `Before we talk floor plans and price tags, we need to understand ${region}, because place is the story spine of this episode.`;
    case "lifestyle_relocation":
      return `Could you really build a comfortable life in ${region} without blowing your budget? That is what we are testing with real properties and real tradeoffs.`;
  }
}

function buildListingFactBullets(listing: CasaHudValidatedListing): string[] {
  return uniqueStrings([
    formatListingPrice(listing.price, listing.currency),
    listing.propertyType,
    formatRooms(listing.rooms),
    formatBathrooms(listing.bathrooms),
    formatInteriorSize(listing.sizeSqm),
    listing.city || listing.region,
  ]);
}

function selectNarrativeDescription(listing: CasaHudValidatedListing): string | null {
  const candidates = [listing.casaHudNarrationSeed, listing.summary, listing.descriptionSnippet, listing.preliminaryMatchNotes];
  for (const candidate of candidates) {
    const sentences = sentenceFragments(candidate);
    if (sentences.length === 0) continue;
    const merged = truncateAtBoundary(sentences.slice(0, 2).join(" "));
    const sanitized = sanitizeViewerLine(merged);
    if (sanitized) return sanitized;
  }
  return null;
}

function listingLeadLine(listing: CasaHudValidatedListing): string {
  const location = sanitizeLocationText(listing.locationText);
  const title = sanitizeViewerLine(listing.title, false) || "this property";
  return finalizeSentence(`First up is ${title} in ${location}`);
}

function listingFactsLine(listing: CasaHudValidatedListing): string {
  const price = formatListingPrice(listing.price, listing.currency);
  const propertyType = sanitizeViewerLine(listing.propertyType || "", false) || "home";
  const parts = uniqueStrings([formatInteriorSize(listing.sizeSqm), formatRooms(listing.rooms), formatBathrooms(listing.bathrooms)]);

  if (price && parts.length > 0) {
    return finalizeSentence(`${propertyType} is listed around ${price}, with ${joinNatural(parts)}`);
  }
  if (price) {
    return finalizeSentence(`${propertyType} is listed around ${price}`);
  }
  if (parts.length > 0) {
    return finalizeSentence(`Key facts here are ${joinNatural(parts)}`);
  }
  return finalizeSentence("Source detail is lighter here, so we stick to verified facts only");
}

function buildPropertyNarration(
  campaign: CasaHudCampaign,
  listing: CasaHudValidatedListing,
  insight?: CasaHudListingLocationInsight,
): CasaHudPropertySegment {
  const supportedFacts = buildListingFactBullets(listing);
  const insightLine = sanitizeViewerLine(insight?.summary || insight?.highlights[0] || insight?.locationStrengths[0]);
  const descriptionLead = selectNarrativeDescription(listing);

  let whyItMadeTheCut = "It contributes directly to the headline question with specific, verifiable details viewers can evaluate.";
  if (campaign.campaignType === "location_led") {
    whyItMadeTheCut = "It shows how the location story translates into one concrete property option.";
  } else if (campaign.campaignType === "single_property_showcase") {
    whyItMadeTheCut = "It is the clear centerpiece, so we can stay with one home long enough to explain what really matters.";
  } else if (campaign.campaignType === "lifestyle_relocation") {
    whyItMadeTheCut = "It balances affordability, livability, and location in a way relocation viewers can evaluate honestly.";
  }

  const narration = uniqueStrings([
    listingLeadLine(listing),
    listingFactsLine(listing),
    descriptionLead,
    insightLine ? finalizeSentence(`Local context: ${insightLine}`) : null,
  ])
    .map((line) => sanitizeViewerLine(line))
    .filter((line): line is string => Boolean(line))
    .join(" ");

  const caution = uniqueStrings([...listing.warnings, ...(insight?.warnings || [])])
    .map((warning) => sanitizeViewerLine(warning))
    .find((warning): warning is string => Boolean(warning));

  return {
    listingId: listing.id,
    title: sanitizeViewerLine(listing.title, false) || listing.title,
    locationText: sanitizeLocationText(listing.locationText),
    narration,
    whyItMadeTheCut: sanitizeViewerLine(whyItMadeTheCut) || whyItMadeTheCut,
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
        return `From ${segment.locationText}, we now move to ${nextSegment.locationText} and compare how the value equation changes.`;
      case "single_property_showcase":
        return "Now that we have covered the home itself, we can zoom out to context before returning to the biggest practical tradeoff.";
      case "niche_category":
        return `Next is ${nextSegment.title}, and we apply the same niche criteria so the comparison stays fair.`;
      case "location_led":
        return `We briefly reset to place context, then move into ${nextSegment.title} as another grounded example.`;
      case "lifestyle_relocation":
        return `Next, we move to ${nextSegment.locationText} to see how the daily-life equation shifts for relocation buyers.`;
    }
  });
}

function buildToneAndPacingNotes(campaign: CasaHudCampaign, propertySegments: CasaHudPropertySegment[]): string[] {
  const notes = [
    "Keep delivery clear and human, with specific claims tied to verified listing or location support.",
    "Lead with practical facts, then add lifestyle context without sounding promotional.",
    "Avoid marketplace or provider UI language in spoken narration.",
  ];

  if (campaign.campaignType === "roundup") {
    notes.push("Treat each property segment as a quick beat so the episode maintains momentum.");
  }
  if (campaign.campaignType === "single_property_showcase") {
    notes.push("Slow pacing around the lead property so the episode feels like a walkthrough, not a list.");
  }
  if (propertySegments.some((segment) => segment.caution)) {
    notes.push("When source detail is thin, keep those lines short and avoid decorative specifics.");
  }

  return notes;
}

function buildClosingCta(campaign: CasaHudCampaign): string {
  switch (campaign.campaignType) {
    case "roundup":
      return "Which property would you shortlist first? Share your pick in the comments and tell us why.";
    case "single_property_showcase":
      return "If this walkthrough helped, subscribe for the next property breakdown and tell us what to analyze next.";
    case "niche_category":
      return "If this niche is on your radar, comment with the option that felt most realistic for your goals.";
    case "location_led":
      return "If you want more place-first tours, follow along and tell us which area we should break down next.";
    case "lifestyle_relocation":
      return "If you are seriously considering a move, tell us which tradeoff matters most for your lifestyle.";
  }
}

function buildSummary(campaign: CasaHudCampaign, propertySegments: CasaHudPropertySegment[]): string {
  const count = propertySegments.length;
  switch (campaign.campaignType) {
    case "roundup":
      return `A viewer-facing roundup script package built around ${count} current properties with clear comparisons and transitions.`;
    case "single_property_showcase":
      return "A viewer-facing showcase script centered on one lead property and practical local context.";
    case "niche_category":
      return `A category-led script package that tests this niche with ${count} current property examples.`;
    case "location_led":
      return `A place-first script package that grounds the location story in ${count} current property examples.`;
    case "lifestyle_relocation":
      return `A relocation-focused script package that translates ${count} current properties into practical day-to-day tradeoffs.`;
  }
}

function buildScriptSegments(
  campaign: CasaHudCampaign,
  propertySegments: CasaHudPropertySegment[],
  locationLifestyleLines: string[],
  transitions: string[],
): CasaHudScriptSegment[] {
  const listings = orderedWorkingListings(campaign);
  const segments: CasaHudScriptSegment[] = [];
  const locationLead =
    locationLifestyleLines[0] ||
    sanitizeViewerLine(campaign.locationStory?.summary) ||
    sanitizeViewerLine(campaign.locationIntelligenceSummary?.coverageSummary) ||
    "We start with place context so the property decisions make sense in daily life.";

  segments.push({
    id: stableCasaHudId("casahud-script-segment", `${campaign.id}:hook`),
    title: "Opening Hook",
    segmentType: "hook",
    narration: buildOpeningHook(campaign, listings),
    durationSeconds: campaign.campaignType === "single_property_showcase" ? 18 : 14,
    visualNote: campaign.mapSceneIdeas[0]?.suggestedVisual || "Open on the strongest verified place or property anchor.",
  });

  segments.push({
    id: stableCasaHudId("casahud-script-segment", `${campaign.id}:premise`),
    title: "What We Explore",
    segmentType: "premise",
    narration: campaignTypePremise(campaign, listings),
    durationSeconds: 16,
    visualNote: "Use clean headline overlays and avoid provider or debug language.",
  });

  segments.push({
    id: stableCasaHudId("casahud-script-segment", `${campaign.id}:location`),
    title: "Location Story",
    segmentType: "location_context",
    narration: locationLead,
    durationSeconds: campaign.campaignType === "location_led" ? 18 : 12,
    visualNote: campaign.mapSceneIdeas[0]?.suggestedVisual || "Reuse location visual context at a high level.",
  });

  propertySegments.forEach((segment, index) => {
    segments.push({
      id: stableCasaHudId("casahud-script-segment", `${campaign.id}:property:${segment.listingId}`),
      title: `Property ${index + 1}: ${segment.title}`,
      segmentType: "property_focus",
      narration: segment.narration,
      durationSeconds: campaign.campaignType === "single_property_showcase" ? 32 : 24,
      associatedListingId: segment.listingId,
      visualNote: "Keep this segment tied to verified listing and location facts.",
    });

    const transition = transitions[index];
    if (transition) {
      segments.push({
        id: stableCasaHudId("casahud-script-segment", `${campaign.id}:transition:${index}`),
        title: `Transition ${index + 1}`,
        segmentType: "transition",
        narration: transition,
        durationSeconds: 8,
        visualNote: "Use this beat to reset pacing without introducing unverified claims.",
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

export function sanitizeCasaHudScriptData(script: CasaHudScriptData): CasaHudScriptData {
  const scriptSegments = script.scriptSegments.map((segment) => ({
    ...segment,
    title: sanitizeViewerLine(segment.title, false) || segment.title,
    narration: sanitizeViewerLine(segment.narration) || segment.narration,
  }));

  const propertySegments = script.propertySegments.map((segment) => ({
    ...segment,
    title: sanitizeViewerLine(segment.title, false) || segment.title,
    locationText: sanitizeLocationText(segment.locationText),
    narration: sanitizeViewerLine(segment.narration) || segment.narration,
    whyItMadeTheCut: sanitizeViewerLine(segment.whyItMadeTheCut) || segment.whyItMadeTheCut,
    locationLine: sanitizeViewerLine(segment.locationLine) || segment.locationLine,
    caution: sanitizeViewerLine(segment.caution) || segment.caution,
    supportedFacts: uniqueByCaseFold(
      segment.supportedFacts
        .map((fact) => sanitizeViewerLine(fact))
        .filter((fact): fact is string => Boolean(fact)),
    ),
  }));

  const fullScriptText = buildFullScriptText(scriptSegments);

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
    scriptWarnings: uniqueByCaseFold(
      script.scriptWarnings
        .map((line) => sanitizeViewerLine(line))
        .filter((line): line is string => Boolean(line)),
    ),
    fullScriptText,
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

export function buildLiveScriptProviderStatus(detail: string): CasaHudScriptProviderStatus {
  return {
    provider: "openai",
    label: "OpenAI",
    state: "connected",
    configured: true,
    used: true,
    detail,
  };
}

export function buildCasaHudScriptPromptContext(
  campaign: CasaHudCampaign,
  deterministicBaseline: CasaHudScriptData,
): CasaHudScriptAgentPromptContext {
  const listings = orderedWorkingListings(campaign).map((listing) => ({
    id: listing.id,
    title: sanitizeViewerLine(listing.title, false) || listing.title,
    locationText: sanitizeLocationText(listing.locationText),
    price: formatListingPrice(listing.price, listing.currency),
    propertyType: sanitizeViewerLine(listing.propertyType, false) || null,
    bedrooms: typeof listing.bedrooms === "number" ? listing.bedrooms : null,
    bathrooms: typeof listing.bathrooms === "number" ? listing.bathrooms : null,
    sizeSqm: typeof listing.sizeSqm === "number" ? listing.sizeSqm : null,
    descriptionSnippet: cleanSourceText(listing.descriptionSnippet) || null,
    features: uniqueByCaseFold(
      (listing.features || [])
        .map((feature) => sanitizeViewerLine(feature, false))
        .filter((feature): feature is string => Boolean(feature)),
    ),
    validationReasons: uniqueByCaseFold(
      (listing.validationReasons || [])
        .map((reason) => sanitizeViewerLine(reason))
        .filter((reason): reason is string => Boolean(reason)),
    ),
    warnings: uniqueByCaseFold(
      (listing.warnings || [])
        .map((warning) => sanitizeViewerLine(warning))
        .filter((warning): warning is string => Boolean(warning)),
    ),
    rank: listing.rank ?? null,
  }));

  return {
    campaignType: campaign.campaignType,
    selectedViralTitle: campaign.selectedViralTitle,
    researchSummary: campaign.researchBrief.summary,
    titleSupportConfidence:
      typeof campaign.titleSupportConfidence === "number" ? campaign.titleSupportConfidence : undefined,
    locationStory: campaign.locationStory,
    localHighlights: campaign.localHighlights,
    mapSceneIdeas: campaign.mapSceneIdeas,
    listingLocationInsights: campaign.listingLocationInsights,
    providerStatuses: campaign.locationProviderStatuses,
    listings,
    deterministicBaseline: {
      scriptSummary: deterministicBaseline.scriptSummary,
      openingHook: deterministicBaseline.openingHook,
      transitions: deterministicBaseline.transitions,
      scriptWarnings: deterministicBaseline.scriptWarnings,
      toneAndPacingNotes: deterministicBaseline.toneAndPacingNotes,
    },
  };
}

export function buildCasaHudFallbackScript(
  campaign: CasaHudCampaign,
  options: CasaHudScriptAgentOptions = {},
): CasaHudScriptData {
  const generatedAt = options.generatedAt || new Date().toISOString();
  const extraWarnings = options.extraWarnings || [];
  const listings = campaign.campaignType === "single_property_showcase"
    ? orderedWorkingListings(campaign).slice(0, 1)
    : orderedWorkingListings(campaign);
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

  return sanitizeCasaHudScriptData({
    ...createEmptyCasaHudScriptData(),
    scriptGenerationStatus: "script_generated",
    scriptSummary: buildSummary(campaign, propertySegments),
    openingHook: buildOpeningHook(campaign, listings),
    estimatedDurationSeconds,
    tone: "Premium, clear, human, and grounded in verified listing and location facts.",
    scriptSegments,
    propertySegments,
    locationLifestyleLines,
    transitions,
    closingCta: buildClosingCta(campaign),
    toneAndPacingNotes: buildToneAndPacingNotes(campaign, propertySegments),
    scriptWarnings: warnings,
    scriptProviderStatus: buildFallbackProviderStatus(
      `Using deterministic CasaFlix script agent composition from current listings and saved location intelligence at ${generatedAt}.`,
      warnings[0],
    ),
    fullScriptText: buildFullScriptText(scriptSegments),
  });
}
