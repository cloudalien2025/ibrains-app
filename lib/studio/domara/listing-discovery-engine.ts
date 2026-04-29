import { nowIso, stableCasaHudId } from "@/lib/studio/domara/ai-channel-engine/ids";
import type {
  CasaHudCampaign,
  CasaHudListingCandidate,
  CasaHudListingDiscoverySummary,
  CasaHudListingProvider,
  CasaHudListingProviderStatus,
  CasaHudListingSearchCriteria,
} from "@/lib/studio/domara/campaigns";

const DEFAULT_PROVIDER_TIMEOUT_MS = 1200;

type ListingDiscoveryProviderResult = {
  providerStatus: CasaHudListingProviderStatus;
  candidates: CasaHudListingCandidate[];
  warnings: string[];
};

type ListingDiscoveryProviderContext = {
  campaign: CasaHudCampaign;
  criteria: CasaHudListingSearchCriteria;
  credential?: string | null;
  timeoutMs: number;
};

type RunCasaHudListingDiscoveryOptions = {
  idealistaCredential?: string | null;
  immobiliareCredential?: string | null;
  timeoutMs?: number;
};

type RegionProfile = {
  regionHint: string;
  country: string;
  cities: string[];
  coordinates: Array<{ city: string; region: string; latitude: number; longitude: number }>;
};

type BudgetResult = {
  maxPrice?: number;
  currency?: string;
};

const REGION_PROFILES: RegionProfile[] = [
  {
    regionHint: "Southern Italy",
    country: "Italy",
    cities: ["Tropea", "Lecce", "Bari", "Palermo", "Catania"],
    coordinates: [
      { city: "Tropea", region: "Calabria", latitude: 38.6746, longitude: 15.8953 },
      { city: "Lecce", region: "Puglia", latitude: 40.3515, longitude: 18.175 },
      { city: "Bari", region: "Puglia", latitude: 41.1171, longitude: 16.8719 },
      { city: "Palermo", region: "Sicily", latitude: 38.1157, longitude: 13.3615 },
      { city: "Catania", region: "Sicily", latitude: 37.5079, longitude: 15.083 },
    ],
  },
  {
    regionHint: "Tuscany",
    country: "Italy",
    cities: ["Florence", "Siena", "Lucca", "Arezzo"],
    coordinates: [
      { city: "Florence", region: "Tuscany", latitude: 43.7696, longitude: 11.2558 },
      { city: "Siena", region: "Tuscany", latitude: 43.3188, longitude: 11.3308 },
      { city: "Lucca", region: "Tuscany", latitude: 43.8429, longitude: 10.5027 },
      { city: "Arezzo", region: "Tuscany", latitude: 43.4633, longitude: 11.8796 },
    ],
  },
  {
    regionHint: "Lake Como",
    country: "Italy",
    cities: ["Como", "Bellagio", "Lecco", "Menaggio"],
    coordinates: [
      { city: "Como", region: "Lombardy", latitude: 45.8081, longitude: 9.0852 },
      { city: "Bellagio", region: "Lombardy", latitude: 45.9876, longitude: 9.261 },
      { city: "Lecco", region: "Lombardy", latitude: 45.8566, longitude: 9.3977 },
      { city: "Menaggio", region: "Lombardy", latitude: 46.0199, longitude: 9.2381 },
    ],
  },
  {
    regionHint: "Sicily",
    country: "Italy",
    cities: ["Palermo", "Taormina", "Catania", "Siracusa"],
    coordinates: [
      { city: "Palermo", region: "Sicily", latitude: 38.1157, longitude: 13.3615 },
      { city: "Taormina", region: "Sicily", latitude: 37.8532, longitude: 15.2866 },
      { city: "Catania", region: "Sicily", latitude: 37.5079, longitude: 15.083 },
      { city: "Siracusa", region: "Sicily", latitude: 37.0755, longitude: 15.2866 },
    ],
  },
  {
    regionHint: "Puglia",
    country: "Italy",
    cities: ["Bari", "Lecce", "Ostuni", "Monopoli"],
    coordinates: [
      { city: "Bari", region: "Puglia", latitude: 41.1171, longitude: 16.8719 },
      { city: "Lecce", region: "Puglia", latitude: 40.3515, longitude: 18.175 },
      { city: "Ostuni", region: "Puglia", latitude: 40.7283, longitude: 17.5775 },
      { city: "Monopoli", region: "Puglia", latitude: 40.952, longitude: 17.2974 },
    ],
  },
];

function stableHash(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return hash >>> 0;
}

function uniqueStrings(values: Array<string | undefined>): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  );
}

function lowercaseIncludes(input: string, token: string): boolean {
  return input.toLowerCase().includes(token.toLowerCase());
}

function profileForCampaign(campaign: CasaHudCampaign): RegionProfile {
  const regionHint = campaign.marketRegionHint || campaign.selectedTitle.regionHint || campaign.preferredMarket || "Italy";
  const matched =
    REGION_PROFILES.find((profile) => lowercaseIncludes(regionHint, profile.regionHint)) ||
    REGION_PROFILES.find((profile) => lowercaseIncludes(campaign.selectedViralTitle, profile.regionHint));
  if (matched) return matched;

  return {
    regionHint,
    country: lowercaseIncludes(regionHint, "italy") ? "Italy" : "Italy",
    cities: ["Florence", "Bari", "Palermo", "Como"],
    coordinates: [
      { city: "Florence", region: "Tuscany", latitude: 43.7696, longitude: 11.2558 },
      { city: "Bari", region: "Puglia", latitude: 41.1171, longitude: 16.8719 },
      { city: "Palermo", region: "Sicily", latitude: 38.1157, longitude: 13.3615 },
      { city: "Como", region: "Lombardy", latitude: 45.8081, longitude: 9.0852 },
    ],
  };
}

function parseBudget(title: string): BudgetResult {
  const underMatch = title.match(/under\s*([€$])?\s*(\d[\d.,]*)\s*([kKmM])?/i);
  if (!underMatch) return {};

  const [, symbol, rawAmount, suffix] = underMatch;
  const numeric = Number(rawAmount.replace(/,/g, "").replace(/\.(?=\d{3}\b)/g, ""));
  if (!Number.isFinite(numeric)) return {};

  const multiplier = suffix?.toLowerCase() === "m" ? 1_000_000 : suffix?.toLowerCase() === "k" ? 1_000 : 1;
  const currency = symbol === "€" ? "EUR" : symbol === "$" ? "USD" : undefined;

  return {
    maxPrice: Math.round(numeric * multiplier),
    currency,
  };
}

function inferTargetListingCount(title: string, singlePropertyFocus: boolean): number {
  if (singlePropertyFocus) return 1;
  const numberMatch = title.match(/\b(\d{1,2})\b/);
  if (numberMatch) {
    const parsed = Number(numberMatch[1]);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return 6;
}

function inferPropertyTypes(campaign: CasaHudCampaign, title: string): string[] {
  const hints = uniqueStrings([...(campaign.selectedTitle.listingSearchHints || [])]).join(" ");
  const corpus = `${title} ${hints}`.toLowerCase();

  if (corpus.includes("farmhouse")) return ["farmhouse", "country house"];
  if (corpus.includes("villa")) return ["villa"];
  if (corpus.includes("apartment")) return ["apartment"];
  if (corpus.includes("townhouse")) return ["townhouse"];
  if (corpus.includes("beachfront") || corpus.includes("coastal")) return ["apartment", "villa", "townhouse"];
  if (campaign.campaignType === "single_property_showcase") return ["villa", "apartment"];
  return ["apartment", "villa", "house"];
}

function relatedSearchHints(campaign: CasaHudCampaign): string[] {
  const selectedRegion = campaign.selectedTitle.regionHint?.trim().toLowerCase();

  return uniqueStrings([
    ...(campaign.selectedTitle.listingSearchHints || []),
    ...campaign.titleCandidates
      .filter((candidate) => {
        const candidateRegion = candidate.regionHint?.trim().toLowerCase();
        return (
          candidate.id === campaign.titleCandidates[0]?.id ||
          candidate.campaignType === campaign.campaignType ||
          (selectedRegion && candidateRegion === selectedRegion)
        );
      })
      .flatMap((candidate) => candidate.listingSearchHints || []),
  ]);
}

function inferFeatureTags(campaign: CasaHudCampaign, title: string): string[] {
  const features = new Set<string>();
  const corpus = `${title} ${(campaign.selectedTitle.listingSearchHints || []).join(" ")}`.toLowerCase();

  if (corpus.includes("beach")) features.add("beach proximity");
  if (corpus.includes("beachfront")) features.add("beachfront");
  if (corpus.includes("lake")) features.add("lake views");
  if (corpus.includes("view")) features.add("stunning views");
  if (corpus.includes("modern")) features.add("modern finishes");
  if (corpus.includes("affordable") || corpus.includes("under ")) features.add("budget-conscious");
  if (corpus.includes("retire") || corpus.includes("relocat")) features.add("move-in ready");
  if (corpus.includes("farmhouse")) features.add("character features");
  if (corpus.includes("villa")) features.add("outdoor space");

  return Array.from(features);
}

function inferLifestyleTags(campaign: CasaHudCampaign, title: string): string[] {
  const tags = new Set<string>();
  const corpus = `${title} ${campaign.researchBrief.summary} ${campaign.researchBrief.audienceIntent.join(" ")}`.toLowerCase();

  if (campaign.campaignType === "lifestyle_relocation") tags.add("relocation");
  if (corpus.includes("retire")) tags.add("retirement");
  if (corpus.includes("relocat")) tags.add("relocation");
  if (corpus.includes("remote")) tags.add("remote work");
  if (corpus.includes("coastal") || corpus.includes("beach")) tags.add("coastal lifestyle");
  if (corpus.includes("lake")) tags.add("lakeside living");
  if (corpus.includes("farmhouse")) tags.add("countryside living");
  if (corpus.includes("luxury") || corpus.includes("villa")) tags.add("premium home tour");

  return Array.from(tags);
}

function inferPricePositioning(title: string, budget: BudgetResult): CasaHudListingSearchCriteria["pricePositioning"] {
  const lower = title.toLowerCase();
  if (lower.includes("affordable")) return "affordable";
  if (lower.includes("luxury")) return "luxury";
  if (lower.includes("best")) return "premium";
  if (budget.maxPrice !== undefined) {
    if (budget.maxPrice <= 350_000) return "affordable";
    if (budget.maxPrice <= 1_000_000) return "mainstream";
    return "premium";
  }
  return "mainstream";
}

export function deriveCasaHudListingSearchCriteria(campaign: CasaHudCampaign): CasaHudListingSearchCriteria {
  const title = campaign.selectedViralTitle;
  const profile = profileForCampaign(campaign);
  const budget = parseBudget(title);
  const singlePropertyFocus = campaign.campaignType === "single_property_showcase";

  return {
    operation: "sale",
    campaignType: campaign.campaignType,
    titlePromise: title,
    regionHint: campaign.marketRegionHint || campaign.selectedTitle.regionHint || profile.regionHint,
    country: profile.country,
    cities: uniqueStrings(profile.cities.slice(0, 3)),
    propertyTypes: inferPropertyTypes(campaign, title),
    featureTags: inferFeatureTags(campaign, title),
    lifestyleTags: inferLifestyleTags(campaign, title),
    searchTerms: uniqueStrings([
      title,
      campaign.selectedTitle.regionHint,
      ...relatedSearchHints(campaign),
    ]),
    pricePositioning: inferPricePositioning(title, budget),
    targetListingCount: inferTargetListingCount(title, singlePropertyFocus),
    singlePropertyFocus,
    maxPrice: budget.maxPrice,
    currency: budget.currency || "EUR",
  };
}

export function summarizeCasaHudListingCriteria(criteria: CasaHudListingSearchCriteria): string {
  const priceText = criteria.maxPrice
    ? `up to ${criteria.currency || "EUR"} ${criteria.maxPrice.toLocaleString("en-US")}`
    : criteria.pricePositioning === "affordable"
      ? "with an affordability angle"
      : criteria.pricePositioning === "luxury"
        ? "with premium positioning"
        : "with mainstream pricing";

  const featureText = criteria.featureTags.length > 0 ? criteria.featureTags.slice(0, 2).join(" and ") : "story-worthy property fit";
  return `Searching sale listings around ${criteria.regionHint || criteria.country || "the target market"} ${priceText}, focused on ${featureText}.`;
}

function providerLabel(provider: CasaHudListingProvider): string {
  if (provider === "idealista") return "Idealista";
  if (provider === "immobiliare") return "Immobiliare";
  if (provider === "generic") return "Source domain";
  return "CasaHUD sample patterns";
}

function previewPrice(criteria: CasaHudListingSearchCriteria, index: number): number {
  if (criteria.maxPrice !== undefined) {
    const offset = 18_000 + index * 12_000;
    return Math.max(65_000, criteria.maxPrice - offset);
  }

  if (criteria.pricePositioning === "affordable") return 175_000 + index * 18_000;
  if (criteria.pricePositioning === "luxury") return 1_250_000 + index * 160_000;
  if (criteria.pricePositioning === "premium") return 720_000 + index * 90_000;
  return 360_000 + index * 42_000;
}

function featurePool(criteria: CasaHudListingSearchCriteria): string[] {
  const defaults =
    criteria.campaignType === "single_property_showcase"
      ? ["cinematic photo set", "architectural details", "strong hero angle"]
      : ["usable photo set", "clear location framing", "strong visual hook"];
  return uniqueStrings([...criteria.featureTags, ...criteria.lifestyleTags, ...defaults]);
}

function candidateHeadline(criteria: CasaHudListingSearchCriteria, city: string, propertyType: string, index: number): string {
  const capitalizedType = propertyType.replace(/\b\w/g, (char) => char.toUpperCase());
  if (criteria.singlePropertyFocus) {
    return `Inside a ${criteria.featureTags.includes("modern finishes") ? "Modern " : ""}${city} ${capitalizedType}`;
  }
  if (criteria.featureTags.includes("beachfront")) {
    return `${city} ${capitalizedType} with Beachfront Position`;
  }
  if (criteria.lifestyleTags.includes("retirement")) {
    return `${city} ${capitalizedType} for a Southern Italy Reset`;
  }
  return `${city} ${capitalizedType} Candidate ${index + 1}`;
}

function preliminaryMatchNotes(criteria: CasaHudListingSearchCriteria, city: string, index: number): string {
  const notes = [
    `${city} lines up with the ${criteria.regionHint || criteria.country || "campaign"} location promise.`,
    criteria.maxPrice !== undefined ? `Price shape stays within the ${criteria.currency || "EUR"} budget ceiling.` : "Pricing fits the intended market positioning.",
    criteria.featureTags.length > 0 ? `Matches the title angle through ${criteria.featureTags.slice(0, 2).join(" and ")}.` : "Keeps the listing visually supportable for the title concept.",
  ];
  return notes[index % notes.length] || notes[0]!;
}

function deterministicFallbackCandidates(criteria: CasaHudListingSearchCriteria, campaign: CasaHudCampaign): CasaHudListingCandidate[] {
  const profile = profileForCampaign(campaign);
  const features = featurePool(criteria);
  const propertyTypes = criteria.propertyTypes.length > 0 ? criteria.propertyTypes : ["apartment", "villa", "house"];
  const count = Math.max(criteria.singlePropertyFocus ? 1 : 4, Math.min(criteria.targetListingCount, 7));

  return Array.from({ length: count }, (_, index) => {
    const location = profile.coordinates[index % profile.coordinates.length] || profile.coordinates[0]!;
    const propertyType = propertyTypes[index % propertyTypes.length] || "house";
    const bedrooms = propertyType === "apartment" ? 2 + (index % 2) : 3 + (index % 2);
    const bathrooms = Math.max(1, bedrooms - 1);
    const imageCount = criteria.singlePropertyFocus ? 18 - (index % 3) : 11 - (index % 4);
    const seed = `${campaign.id}:${criteria.titlePromise}:${location.city}:${propertyType}:${index}`;
    const imageUrls = Array.from({ length: Math.max(4, imageCount) }, (_, imageIndex) => {
      const hash = stableHash(`${seed}:${imageIndex}`).toString(16).slice(0, 8);
      return `https://images.example.com/casahud/sample/${hash}.jpg`;
    });

    return {
      id: stableCasaHudId("listing", seed),
      provider: "casahud_sample",
      sourceType: "sample_pattern",
      sourceLabel: "Sample Pattern",
      title: candidateHeadline(criteria, location.city, propertyType, index),
      locationText: `${location.city}, ${location.region}, ${profile.country}`,
      country: profile.country,
      region: location.region,
      city: location.city,
      price: previewPrice(criteria, index),
      currency: criteria.currency || "EUR",
      propertyType,
      bedrooms,
      bathrooms,
      sizeSqm: criteria.singlePropertyFocus ? 190 + index * 18 : 78 + index * 14,
      descriptionSnippet:
        criteria.singlePropertyFocus
          ? "A cinematic home anchor with strong visual coverage and enough detail to shape the story."
          : "A sample property anchor with enough public detail to test the shortlist and story flow.",
      features: features.slice(index % 2, index % 2 + 3).length > 0 ? features.slice(index % 2, index % 2 + 3) : features.slice(0, 3),
      imageUrls,
      imageCount: imageUrls.length,
      photoAvailability: imageUrls.length >= 8 ? "available" : imageUrls.length >= 4 ? "limited" : "none",
      coordinates: {
        latitude: location.latitude,
        longitude: location.longitude,
      },
      rawProviderMetadata: {
        patternSeed: stableHash(seed),
        discoveryMode: "sample_patterns",
        sourceNote: "Using CasaHUD sample patterns until live listing sources are connected.",
      },
      discoveredAt: nowIso(),
      preliminaryMatchNotes: preliminaryMatchNotes(criteria, location.city, index),
    };
  });
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: () => T): Promise<T> {
  let timeoutId: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timeoutId = setTimeout(() => resolve(fallback()), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

class IdealistaListingDiscoveryProvider {
  readonly provider = "idealista" as const;

  async searchListings(context: ListingDiscoveryProviderContext): Promise<ListingDiscoveryProviderResult> {
    if (!context.credential?.trim()) {
      return {
        providerStatus: {
          provider: this.provider,
          label: providerLabel(this.provider),
          state: "missing_credentials",
          configured: false,
          used: false,
          candidateCount: 0,
          detail: "Idealista is not connected yet. CasaHUD can still prepare candidate properties with sample patterns.",
          warning: "Connect Idealista to search live listings.",
        },
        candidates: [],
        warnings: ["Idealista is not connected for live listing search."],
      };
    }

    return {
      providerStatus: {
        provider: this.provider,
        label: providerLabel(this.provider),
        state: "connected",
        configured: true,
        used: false,
        candidateCount: 0,
        detail:
          "Idealista is connected, but this workspace is still using sample patterns while live search access is pending.",
        warning: "Live Idealista search is not active in this workspace yet.",
      },
      candidates: [],
      warnings: ["Idealista connection detected, but live listing search is not active in this workspace yet."],
    };
  }
}

class ImmobiliareListingDiscoveryProvider {
  readonly provider = "immobiliare" as const;

  async searchListings(context: ListingDiscoveryProviderContext): Promise<ListingDiscoveryProviderResult> {
    if (!context.credential?.trim()) {
      return {
        providerStatus: {
          provider: this.provider,
          label: providerLabel(this.provider),
          state: "missing_credentials",
          configured: false,
          used: false,
          candidateCount: 0,
          detail: "Immobiliare is not connected yet. CasaHUD can still prepare candidate properties with sample patterns.",
          warning: "Connect Immobiliare to search live listings.",
        },
        candidates: [],
        warnings: ["Immobiliare is not connected for live listing search."],
      };
    }

    return {
      providerStatus: {
        provider: this.provider,
        label: providerLabel(this.provider),
        state: "connected",
        configured: true,
        used: false,
        candidateCount: 0,
        detail:
          "Immobiliare is connected, but this workspace is still using sample patterns while live search access is pending.",
        warning: "Live Immobiliare search is not active in this workspace yet.",
      },
      candidates: [],
      warnings: ["Immobiliare connection detected, but live listing search is not active in this workspace yet."],
    };
  }
}

class CasaHudSampleListingProvider {
  readonly provider = "casahud_sample" as const;

  async searchListings(context: ListingDiscoveryProviderContext): Promise<ListingDiscoveryProviderResult> {
    const candidates = deterministicFallbackCandidates(context.criteria, context.campaign);
    return {
      providerStatus: {
        provider: this.provider,
        label: providerLabel(this.provider),
        state: "fallback",
        configured: true,
        used: true,
        candidateCount: candidates.length,
        detail: "Using CasaHUD sample patterns until listing sources are connected.",
        warning: "Connect Idealista or Immobiliare to search live listings.",
      },
      candidates,
      warnings: ["Using CasaHUD sample patterns until listing sources are connected."],
    };
  }
}

function discoveryHeadline(campaign: CasaHudCampaign, candidateCount: number): string {
  return `Prepared ${candidateCount} candidate propert${candidateCount === 1 ? "y" : "ies"} for "${campaign.selectedViralTitle}".`;
}

function providerSummary(providerStatuses: CasaHudListingProviderStatus[]): string {
  const liveReady = providerStatuses.filter((status) => status.provider !== "casahud_sample" && status.configured).map((status) => status.label);
  if (liveReady.length > 0) {
    return `${liveReady.join(" and ")} are connected, but CasaHUD is still using sample patterns until live provider search is enabled in this workspace.`;
  }

  return "Using CasaHUD sample patterns until listing sources are connected.";
}

export async function runCasaHudListingDiscovery(
  campaign: CasaHudCampaign,
  options: RunCasaHudListingDiscoveryOptions = {},
): Promise<{
  listingSearchCriteria: CasaHudListingSearchCriteria;
  listingProviderStatuses: CasaHudListingProviderStatus[];
  listingCandidates: CasaHudListingCandidate[];
  discoverySummary: CasaHudListingDiscoverySummary;
}> {
  const timeoutMs = Math.max(300, options.timeoutMs || DEFAULT_PROVIDER_TIMEOUT_MS);
  const criteria = deriveCasaHudListingSearchCriteria(campaign);
  const providers = [
    new IdealistaListingDiscoveryProvider(),
    new ImmobiliareListingDiscoveryProvider(),
  ];

  const liveResults = await Promise.all(
    providers.map((provider) =>
      withTimeout(
        provider.searchListings({
          campaign,
          criteria,
          credential: provider.provider === "idealista" ? options.idealistaCredential : options.immobiliareCredential,
          timeoutMs,
        }),
        timeoutMs,
        () => ({
          providerStatus: {
            provider: provider.provider,
            label: providerLabel(provider.provider),
            state: "error" as const,
            configured: false,
            used: false,
            candidateCount: 0,
            detail: `${providerLabel(provider.provider)} did not respond in time, so CasaHUD continued without blocking discovery.`,
            warning: "Provider timeout",
          },
          candidates: [],
          warnings: [`${providerLabel(provider.provider)} timed out during listing discovery.`],
        }),
      ),
    ),
  );

  const liveCandidates = liveResults.flatMap((result) => result.candidates);
  const providerStatuses = liveResults.map((result) => result.providerStatus);
  const warnings = liveResults.flatMap((result) => result.warnings);

  const fallbackProvider = new CasaHudSampleListingProvider();
  const fallbackResult =
    liveCandidates.length > 0
      ? null
      : await fallbackProvider.searchListings({
          campaign,
          criteria,
          timeoutMs,
        });

  const listingCandidates = liveCandidates.length > 0 ? liveCandidates : fallbackResult?.candidates || [];
  const listingProviderStatuses = fallbackResult ? [...providerStatuses, fallbackResult.providerStatus] : providerStatuses;
  const discoveredAt = nowIso();

  return {
    listingSearchCriteria: criteria,
    listingProviderStatuses,
    listingCandidates,
    discoverySummary: {
      headline: discoveryHeadline(campaign, listingCandidates.length),
      criteriaSummary: summarizeCasaHudListingCriteria(criteria),
      providerSummary: providerSummary(listingProviderStatuses),
      candidateCount: listingCandidates.length,
      liveCandidateCount: liveCandidates.length,
      fallbackCandidateCount: fallbackResult?.candidates.length || 0,
      fallbackUsed: Boolean(fallbackResult),
      warnings: fallbackResult ? [...warnings, ...fallbackResult.warnings] : warnings,
      discoveredAt,
    },
  };
}
