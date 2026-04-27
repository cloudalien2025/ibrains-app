import type {
  Campaign,
  CampaignSource,
  DiscoverySource,
  DiscoverySourceCandidateResult,
  DiscoverySourceType,
  DiscoverySourceValidation,
  ListingCandidate,
  ResearchBrief,
} from "@/lib/studio/domara/types";

const SOURCE_TYPE_TO_CAMPAIGN_SOURCE: Record<DiscoverySourceType, CampaignSource> = {
  immobiliare: "immobiliare",
  idealista: "idealista",
  gateaway: "gate_away",
  kyero: "kyero",
  agency_site: "agency_site",
  csv_manual: "csv_manual",
  api_provider: "future_api",
  other: "csv_manual",
};

const PROVIDER_NAME = "mock_discovery_source_provider" as const;

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

function normalizeMarketPath(market: string): string {
  return market.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function titleCase(value: string): string {
  return value
    .split(" ")
    .map((part) => (part ? `${part[0]!.toUpperCase()}${part.slice(1).toLowerCase()}` : part))
    .join(" ");
}

function deterministicIso(seed: string): string {
  const offsetDays = stableHash(seed) % 180;
  const date = new Date(Date.UTC(2026, 0, 1 + offsetDays, 12, 0, 0));
  return date.toISOString();
}

function sourceDomainForType(type: DiscoverySourceType): string {
  if (type === "immobiliare") return "www.immobiliare.it";
  if (type === "idealista") return "www.idealista.it";
  if (type === "gateaway") return "www.gate-away.com";
  if (type === "kyero") return "www.kyero.com";
  if (type === "agency_site") return "www.agency-example.com";
  if (type === "api_provider") return "api.example.com";
  if (type === "csv_manual") return "storage.example.com";
  return "www.example.com";
}

function buildSourceUrl(source: DiscoverySourceType, market: string, budgetMax: number, propertyType: string): string {
  const marketPath = normalizeMarketPath(market || "italy");
  const typePath = normalizeMarketPath(propertyType || "homes");
  if (source === "csv_manual") return `https://storage.example.com/casahud/${marketPath}-${typePath}.csv`;
  if (source === "api_provider") return `https://api.example.com/casahud/search?market=${marketPath}&type=${typePath}&max=${budgetMax}`;
  return `https://${sourceDomainForType(source)}/search/${marketPath}/${typePath}?max=${budgetMax}`;
}

function pickSourceTypes(campaign: Campaign): DiscoverySourceType[] {
  const mapped = campaign.sources.map((source): DiscoverySourceType => {
    if (source === "gate_away") return "gateaway";
    if (source === "future_api") return "api_provider";
    return source as DiscoverySourceType;
  });

  return mapped.length > 0 ? mapped : ["immobiliare", "idealista", "gateaway", "kyero", "agency_site"];
}

export function validateDiscoverySourceUrl(sourceUrl: string): DiscoverySourceValidation {
  const trimmed = sourceUrl.trim();
  const sourceId = stableId("source", trimmed || "empty");
  if (!trimmed) {
    return { sourceId, sourceUrl, valid: false, reason: "URL is required." };
  }

  try {
    const parsed = new URL(trimmed);
    const protocolValid = parsed.protocol === "http:" || parsed.protocol === "https:";
    if (!protocolValid) {
      return { sourceId, sourceUrl, valid: false, reason: "Only http/https source URLs are supported." };
    }
    if (!parsed.hostname || parsed.hostname === "localhost") {
      return { sourceId, sourceUrl, valid: false, reason: "Source URL must use a non-local host." };
    }
    return { sourceId, sourceUrl, valid: true };
  } catch {
    return { sourceId, sourceUrl, valid: false, reason: "Source URL must be a valid URL." };
  }
}

export function buildSuggestedDiscoverySources(campaign: Campaign, brief: ResearchBrief): DiscoverySource[] {
  const sourceTypes = pickSourceTypes(campaign);
  const propertyTypes = brief.propertyTypes.length > 0 ? brief.propertyTypes : campaign.propertyTypes;

  return sourceTypes.slice(0, 8).map((sourceType, index) => {
    const market = brief.markets[index % Math.max(1, brief.markets.length)] || campaign.markets[0] || "Italy";
    const city = brief.cities[index % Math.max(1, brief.cities.length)] || "Palermo";
    const propertyType = propertyTypes[index % Math.max(1, propertyTypes.length)] || "apartment";
    const sourceUrl = buildSourceUrl(sourceType, market, brief.priceMax, propertyType);
    const sourceId = stableId("discovery-source", `${brief.id}-${sourceType}-${market}-${propertyType}-${index}`);
    const confidence = Number((0.84 - index * 0.05).toFixed(2));
    const now = deterministicIso(`${brief.id}-${sourceId}`);

    return {
      id: sourceId,
      campaignId: campaign.id,
      name: `${titleCase(market)} ${titleCase(propertyType)} via ${sourceType.replace(/_/g, " ")}`,
      sourceType,
      sourceUrl,
      marketTags: [market],
      regionTags: [market],
      cityTags: [city],
      propertyTypeTags: [propertyType],
      budgetMin: campaign.budgetMin,
      budgetMax: brief.priceMax,
      currency: campaign.currency,
      buyerPersonaTags: [campaign.buyerPersona],
      poiPriorityTags: brief.poiPriorities,
      status: "ready",
      lastCheckedAt: undefined,
      candidateCount: 0,
      importedCandidateCount: 0,
      rejectedCandidateCount: 0,
      confidence: Math.max(0.3, Math.min(0.97, confidence)),
      notes: "Saved source/search URL for deterministic mock discovery.",
      createdAt: now,
      updatedAt: now,
    };
  });
}

function poolFromSource(source: DiscoverySource): {
  city: string;
  region: string;
  country: string;
  latitude: number;
  longitude: number;
} {
  const pool: Record<string, { city: string; region: string; latitude: number; longitude: number }> = {
    sicily: { city: "Palermo", region: "Sicily", latitude: 38.1157, longitude: 13.3615 },
    puglia: { city: "Bari", region: "Puglia", latitude: 41.1171, longitude: 16.8719 },
    calabria: { city: "Tropea", region: "Calabria", latitude: 38.6746, longitude: 15.8953 },
    liguria: { city: "La Spezia", region: "Liguria", latitude: 44.1025, longitude: 9.8241 },
  };

  const key = (source.regionTags[0] || source.marketTags[0] || "sicily").toLowerCase();
  const matched = pool[key] || pool.sicily;
  return {
    ...matched,
    country: "Italy",
  };
}

function relevanceScore(source: DiscoverySource, brief: ResearchBrief): number {
  const marketBoost = source.marketTags.some((tag) => brief.markets.map((market) => market.toLowerCase()).includes(tag.toLowerCase())) ? 0.16 : -0.1;
  const poiBoost = source.poiPriorityTags.some((tag) => brief.poiPriorities.includes(tag as ResearchBrief["poiPriorities"][number])) ? 0.08 : -0.03;
  const typeBoost =
    source.propertyTypeTags.some((tag) => brief.propertyTypes.map((type) => type.toLowerCase()).includes(tag.toLowerCase())) ? 0.1 : -0.08;
  const budgetMax = source.budgetMax ?? brief.priceMax;
  const budgetBoost = budgetMax <= brief.priceMax * 1.05 ? 0.09 : -0.12;
  return Math.max(0.35, Math.min(0.96, source.confidence + marketBoost + poiBoost + typeBoost + budgetBoost));
}

function describeCandidate(source: DiscoverySource, strong: boolean): string {
  const descriptors = strong
    ? "Walkable coastal framing with restaurants, marina access, and remote-work practicality."
    : "Partial context from source search URL; requires manual follow-up before production.";
  return `${descriptors} Discovery source: ${source.name}.`;
}

export function generateMockCandidatesFromSavedSources(
  campaign: Campaign,
  brief: ResearchBrief,
  sources: DiscoverySource[],
): DiscoverySourceCandidateResult {
  const selectedSources = sources.length > 0 ? sources : buildSuggestedDiscoverySources(campaign, brief);
  const validations = selectedSources.map((source) => ({
    ...validateDiscoverySourceUrl(source.sourceUrl),
    sourceId: source.id,
  }));

  const candidates: ListingCandidate[] = [];
  const batches: DiscoverySourceCandidateResult["batches"] = [];

  for (const source of selectedSources) {
    const validation = validations.find((item) => item.sourceId === source.id);
    const relevantScore = relevanceScore(source, brief);
    const candidateTotal = Math.max(1, 2 + (stableHash(source.id) % 2));
    let imported = 0;

    for (let i = 0; i < candidateTotal; i += 1) {
      const strong = relevantScore >= 0.72 && i < 2;
      const loc = poolFromSource(source);
      const propertyType = source.propertyTypeTags[i % Math.max(1, source.propertyTypeTags.length)] || brief.propertyTypes[0] || "apartment";
      const maxBudget = source.budgetMax ?? brief.priceMax;
      const price = strong ? Math.max((source.budgetMin || campaign.budgetMin) + 18000 + i * 9000, maxBudget - 42000 - i * 4000) : maxBudget + 75000 + i * 14000;
      const confidence = Number((strong ? Math.min(0.95, relevantScore - i * 0.04) : Math.max(0.41, relevantScore - 0.24 - i * 0.03)).toFixed(2));
      const status: ListingCandidate["status"] = strong ? "new" : "needs_review";
      imported += 1;

      const seed = `${brief.id}-${source.id}-${propertyType}-${i}`;
      candidates.push({
        id: stableId("candidate", seed),
        campaignId: campaign.id,
        source: SOURCE_TYPE_TO_CAMPAIGN_SOURCE[source.sourceType],
        sourceUrl: source.sourceUrl,
        listingUrl: `${source.sourceUrl}${source.sourceUrl.includes("?") ? "&" : "?"}mock_listing=${stableHash(seed)
          .toString(16)
          .slice(0, 8)}`,
        title: `${titleCase(loc.city)} ${titleCase(propertyType)} via ${source.sourceType.replace(/_/g, " ")}`,
        price,
        currency: source.currency || campaign.currency,
        locationText: `${loc.city}, ${loc.region}, ${loc.country}`,
        city: loc.city,
        region: loc.region,
        country: loc.country,
        propertyType,
        bedrooms: strong ? 2 + (i % 2) : 1,
        bathrooms: strong ? 2 : 1,
        sqm: strong ? 84 + i * 12 : 54 + i * 6,
        description: describeCandidate(source, strong),
        imageUrls: Array.from({ length: strong ? 10 : 5 }, (_, imageIndex) =>
          `https://images.example.com/discovery/${source.sourceType}/${stableHash(`${seed}-${imageIndex}`).toString(16).slice(0, 8)}.jpg`,
        ),
        thumbnailUrl: `https://images.example.com/discovery/${source.sourceType}/thumb-${stableHash(seed).toString(16).slice(0, 8)}.jpg`,
        agencyName: source.sourceType === "agency_site" ? "Agency Search Feed" : "Marketplace Search Feed",
        status,
        extractionConfidence: confidence,
        discoveredAt: deterministicIso(seed),
        providerMetadata: {
          sourceId: source.id,
          sourceType: source.sourceType,
          sourceName: source.name,
          sourceUrl: source.sourceUrl,
          discoveryMode: "mock",
          complianceNote: "Provider seam only. No live crawling or scraping performed.",
          sourceValidation: validation?.valid ? "valid" : "invalid",
        },
      });
    }

    batches.push({
      sourceId: source.id,
      providerStatus: validation?.valid ? "mock" : "fallback",
      candidateCount: candidateTotal,
      importedCandidateCount: imported,
      confidence: Number(relevantScore.toFixed(2)),
      notes: validation?.valid
        ? ["Deterministic mock discovery generated from saved source URL."]
        : [validation?.reason || "Source URL validation failed. Using fallback mock output."],
    });
  }

  const updatedSources: DiscoverySource[] = selectedSources.map((source) => {
    const batch = batches.find((item) => item.sourceId === source.id);
    const validation = validations.find((item) => item.sourceId === source.id);
    const checkedAt = deterministicIso(`${source.id}-checked`);
    const status: DiscoverySource["status"] = validation?.valid ? "checked" : "needs_review";
    return {
      ...source,
      status,
      candidateCount: batch?.candidateCount || 0,
      importedCandidateCount: batch?.importedCandidateCount || 0,
      rejectedCandidateCount: Math.max(0, (batch?.candidateCount || 0) - (batch?.importedCandidateCount || 0)),
      confidence: batch?.confidence || source.confidence,
      lastCheckedAt: checkedAt,
      updatedAt: checkedAt,
      notes: batch?.notes.join(" ") || source.notes,
    };
  });

  return {
    provider: PROVIDER_NAME,
    sources: updatedSources,
    candidates,
    validations,
    batches,
    generatedAt: deterministicIso(`${brief.id}-${campaign.id}-discovery-generated`),
  };
}
