import { stableCasaHudId } from "@/lib/studio/domara/ai-channel-engine/ids";
import { resolveCasaHudMarketProfile } from "@/lib/studio/domara/opportunity-engine/market-profiles";
import type {
  CasaHudOpportunityCampaignType,
  CasaHudOpportunityResearchResult,
  CasaHudOpportunitySelectedTitle,
  CasaHudOpportunityTitleCandidate,
} from "@/lib/studio/domara/opportunity-engine/types";

const CAMPAIGN_TYPES: CasaHudOpportunityCampaignType[] = [
  "roundup",
  "single_property_showcase",
  "niche_category",
  "location_led",
  "lifestyle_relocation",
];

function clampScore(value: number): number {
  return Math.max(1, Math.min(100, Math.round(value)));
}

function formatCampaignType(type: CasaHudOpportunityCampaignType): string {
  switch (type) {
    case "roundup":
      return "roundup";
    case "single_property_showcase":
      return "single-property showcase";
    case "niche_category":
      return "niche/category";
    case "location_led":
      return "location-led";
    case "lifestyle_relocation":
      return "lifestyle/relocation";
  }
}

function classifyCampaignType(title: string): CasaHudOpportunityCampaignType {
  const lower = title.toLowerCase();
  if (/inside /.test(lower)) return "single_property_showcase";
  if (/could you|retire|move to|american buyers/i.test(title)) return "lifestyle_relocation";
  if (/best .* under|farmhouses|townhouses|stone homes|quinta/i.test(lower)) return "niche_category";
  if (/near /i.test(title)) return "location_led";
  return "roundup";
}

function listingSearchHintsForTitle(title: string, regionHint?: string): string[] {
  const hints = [title, regionHint].filter((value): value is string => Boolean(value));
  if (/under\s+\$?\€?\d+/i.test(title) || /under\s+\d+/i.test(title)) {
    hints.push("price-filtered inventory");
  }
  if (/american buyers|retire/i.test(title)) {
    hints.push("relocation-friendly towns");
  }
  return hints.slice(0, 3);
}

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function seededIndex(seed: string, salt: string, maxExclusive: number): number {
  if (maxExclusive <= 0) return 0;
  return hashString(`${seed}:${salt}`) % maxExclusive;
}

function buildCandidateSeeds(
  research: CasaHudOpportunityResearchResult,
  variationSeed?: string,
): Array<{ title: string; regionHint: string }> {
  const profile = resolveCasaHudMarketProfile(research.preferredMarket);
  const seed = variationSeed?.trim() || `${research.generatedAt}:${research.preferredMarket}`;
  const roundupTemplates = [
    `${profile.roundupCount} Affordable Beachfront Homes in ${profile.roundupRegion}`,
    `${profile.roundupCount + 1} Budget-Friendly Homes in ${profile.roundupRegion}`,
    `${profile.roundupCount} Real Listings in ${profile.roundupRegion} for Price-Conscious Buyers`,
  ];
  const lifestyleTemplates = [
    `Could You Retire in ${profile.lifestyleRegion} for Under ${profile.budgetLabel}?`,
    `Can Buyers Relocate to ${profile.lifestyleRegion} Under ${profile.budgetLabel}?`,
    `Is ${profile.lifestyleRegion} Still Affordable for Relocation Buyers?`,
  ];
  const nicheTemplates = [
    `Best ${profile.nicheRegion} ${profile.nichePropertyPlural} Under €1M`,
    `${profile.nicheRegion} ${profile.nichePropertyPlural} Buyers Can Still Find This Year`,
    `${profile.nicheRegion} ${profile.nichePropertyPlural}: What Budget Buyers Can Actually Buy`,
  ];
  const locationTemplates = [
    `The Best Homes Near ${profile.locationCity} for ${profile.buyerPersona}`,
    `Where ${profile.buyerPersona} Can Still Buy Near ${profile.locationCity}`,
    `Homes Near ${profile.locationCity}: What Buyers Should Compare First`,
  ];
  const showcaseTemplates = [
    `Inside a ${profile.showcaseDescriptor} ${profile.showcaseLocation} ${profile.showcaseProperty} With ${profile.showcaseHook}`,
    `Inside ${profile.showcaseLocation}: ${profile.showcaseDescriptor} ${profile.showcaseProperty} Tour`,
    `${profile.showcaseLocation} Property Tour: ${profile.showcaseDescriptor} ${profile.showcaseProperty} With ${profile.showcaseHook}`,
  ];
  const comparisonTemplates = [
    `${profile.roundupCount + 1} ${profile.roundupRegion} Homes That Cost Less Than a ${profile.comparisonBenchmark}`,
    `What ${profile.roundupRegion} Buyers Get for the Price of a ${profile.comparisonBenchmark}`,
    `${profile.roundupRegion} Home Prices vs a ${profile.comparisonBenchmark}: Real Listings`,
  ];

  return [
    {
      title: roundupTemplates[seededIndex(seed, "roundup", roundupTemplates.length)]!,
      regionHint: profile.roundupRegion,
    },
    {
      title: lifestyleTemplates[seededIndex(seed, "lifestyle", lifestyleTemplates.length)]!,
      regionHint: profile.lifestyleRegion,
    },
    {
      title: nicheTemplates[seededIndex(seed, "niche", nicheTemplates.length)]!,
      regionHint: profile.nicheRegion,
    },
    {
      title: locationTemplates[seededIndex(seed, "location", locationTemplates.length)]!,
      regionHint: profile.locationCity,
    },
    {
      title: showcaseTemplates[seededIndex(seed, "showcase", showcaseTemplates.length)]!,
      regionHint: profile.showcaseLocation,
    },
    {
      title: comparisonTemplates[seededIndex(seed, "comparison", comparisonTemplates.length)]!,
      regionHint: profile.roundupRegion,
    },
  ];
}

function reasoningForCandidate(
  title: string,
  campaignType: CasaHudOpportunityCampaignType,
  research: CasaHudOpportunityResearchResult,
  listingAvailability: number,
  titleTruthfulness: number,
): string {
  const livePrefix =
    research.providerStatus.mode === "live_youtube" ? "Live research favored" : "CasaFlix opportunity patterns favored";
  const focus =
    campaignType === "single_property_showcase"
      ? "a single standout property hook"
      : campaignType === "lifestyle_relocation"
        ? "a relocation decision angle"
        : campaignType === "location_led"
          ? "a place-first buyer search"
          : campaignType === "niche_category"
            ? "a high-intent niche inventory promise"
            : "a repeatable multi-listing concept";

  return `${livePrefix} ${focus}. "${title}" stays supportable because the promise is specific, searchable, and more realistic than a broad inspiration-only property video. Listing support outlook is ${listingAvailability}/100 and title truthfulness is ${titleTruthfulness}/100.`;
}

function scoreCandidate(
  title: string,
  campaignType: CasaHudOpportunityCampaignType,
  research: CasaHudOpportunityResearchResult,
  variationSeed?: string,
): Omit<CasaHudOpportunityTitleCandidate, "id" | "reasoning" | "regionHint" | "listingSearchHints"> {
  const lower = title.toLowerCase();
  const hasBudget = /under|less than/.test(lower);
  const hasQuestion = /\?$/.test(title) || /could you|how|can you/.test(lower);
  const hasNumber = /\b\d+\b/.test(title);
  const hasLocation = /\bitaly|tuscany|florence|lake como|southern italy|algarve|portugal|spain|greece|crete|valencia|andalusia|athens|peloponnese|paros\b/i.test(
    title,
  );
  const hasBuyerIntent = /buyers|retire|american/i.test(title);
  const liveBoost = research.providerStatus.mode === "live_youtube" ? 4 : 0;

  const ctrPotential = clampScore(72 + (hasBudget ? 10 : 0) + (hasQuestion ? 7 : 0) + (hasNumber ? 6 : 0) + (hasLocation ? 5 : 0));
  const searchAppeal = clampScore(70 + (hasLocation ? 11 : 0) + (hasBudget ? 7 : 0) + (hasBuyerIntent ? 6 : 0) + liveBoost);
  const novelty = clampScore(68 + (campaignType === "single_property_showcase" ? 6 : 0) + (hasQuestion ? 7 : 0) + (hasBuyerIntent ? 5 : 0));
  const realism = clampScore(74 + (hasBudget ? 6 : 0) + (campaignType === "roundup" || campaignType === "niche_category" ? 8 : 3));
  const listingAvailability = clampScore(
    69 +
      (campaignType === "roundup" ? 12 : 0) +
      (campaignType === "niche_category" ? 9 : 0) +
      (campaignType === "location_led" ? 7 : 0) +
      (campaignType === "single_property_showcase" ? -4 : 0) +
      (hasBudget ? 4 : 0),
  );
  const channelFit = clampScore(76 + (hasLocation ? 8 : 0) + (hasBudget ? 7 : 0) + (hasBuyerIntent ? 5 : 0));
  const titleTruthfulness = clampScore(
    78 +
      (campaignType === "single_property_showcase" ? -5 : 0) +
      (campaignType === "roundup" || campaignType === "niche_category" ? 7 : 0) +
      (hasBudget ? 4 : 0),
  );

  const scoreNudge = variationSeed ? (hashString(`${variationSeed}:${title}`) % 9) - 4 : 0;
  return {
    title,
    score: clampScore(
      ctrPotential * 0.22 +
        searchAppeal * 0.18 +
        novelty * 0.12 +
        realism * 0.16 +
        listingAvailability * 0.15 +
        channelFit * 0.09 +
        titleTruthfulness * 0.08 +
        scoreNudge,
    ),
    ctrPotential,
    searchAppeal,
    novelty,
    realism,
    listingAvailability,
    channelFit,
    titleTruthfulness,
    campaignType,
  };
}

export function getSupportedCasaHudOpportunityCampaignTypes(): CasaHudOpportunityCampaignType[] {
  return [...CAMPAIGN_TYPES];
}

export function buildCasaHudOpportunityTitleCandidates(
  research: CasaHudOpportunityResearchResult,
  options?: {
    variationSeed?: string;
  },
): CasaHudOpportunityTitleCandidate[] {
  return buildCandidateSeeds(research, options?.variationSeed)
    .map((seed) => {
      const campaignType = classifyCampaignType(seed.title);
      const scored = scoreCandidate(seed.title, campaignType, research, options?.variationSeed);
      const listingSearchHints = listingSearchHintsForTitle(seed.title, seed.regionHint);

      return {
        id: stableCasaHudId("opportunity-title", `${research.generatedAt}:${seed.title}`),
        ...scored,
        regionHint: seed.regionHint,
        listingSearchHints,
        reasoning: reasoningForCandidate(
          seed.title,
          campaignType,
          research,
          scored.listingAvailability,
          scored.titleTruthfulness,
        ),
      };
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, 6);
}

export function selectWinningCasaHudOpportunityTitle(
  candidates: CasaHudOpportunityTitleCandidate[],
  research: CasaHudOpportunityResearchResult,
): CasaHudOpportunitySelectedTitle {
  const winner = candidates[0]!;
  const confidenceBase = winner.score / 100;
  const confidenceBoost = research.providerStatus.mode === "live_youtube" ? 0.04 : 0;
  const confidence = Number(Math.min(0.97, Math.max(0.7, confidenceBase + confidenceBoost)).toFixed(2));

  return {
    title: winner.title,
    score: winner.score,
    campaignType: winner.campaignType,
    confidence,
    regionHint: winner.regionHint,
    listingSearchHints: winner.listingSearchHints,
    reasoning: `CasaFlix chose this ${formatCampaignType(winner.campaignType)} title because it balances click potential with search specificity and a believable listing-backed promise. It is the strongest blend of CTR, search intent, realism, and repeatability across the candidate set.`,
  };
}
