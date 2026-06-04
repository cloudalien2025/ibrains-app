import { nowIso } from "@/lib/studio/domara/ai-channel-engine/ids";
import {
  getDefaultPreferredMarket,
  resolveCasaHudMarketProfile,
} from "@/lib/studio/domara/opportunity-engine/market-profiles";
import type {
  CasaHudOpportunityProviderStatus,
  CasaHudOpportunityResearchResult,
  CasaHudOpportunityResearchVideo,
} from "@/lib/studio/domara/opportunity-engine/types";

type OpportunityResearchInput = {
  preferredMarket?: string;
};

export interface CasaHudOpportunityResearchProvider {
  research(input: OpportunityResearchInput): Promise<CasaHudOpportunityResearchResult>;
}

type YouTubeSearchItem = {
  id?: { videoId?: string };
  snippet?: {
    title?: string;
    channelTitle?: string;
    publishedAt?: string;
  };
};

type YouTubeVideoStatsItem = {
  id?: string;
  statistics?: {
    viewCount?: string;
    likeCount?: string;
  };
};

function toNumber(value?: string): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function velocityScore(video: CasaHudOpportunityResearchVideo): number | undefined {
  if (video.viewCount === undefined || !video.publishedAt) return undefined;
  const publishedAt = Date.parse(video.publishedAt);
  if (!Number.isFinite(publishedAt)) return undefined;
  const ageDays = Math.max(1, Math.round((Date.now() - publishedAt) / 86_400_000));
  return Math.round(video.viewCount / ageDays);
}

function analyzeCompetitorPatterns(videos: CasaHudOpportunityResearchVideo[]): string[] {
  if (videos.length === 0) {
    return [
      "Budget plus location titles remain the safest repeatable real-estate hook.",
      "Question-led relocation titles can outperform generic tours when the buyer intent is explicit.",
    ];
  }

  const titles = videos.map((video) => video.title.toLowerCase());
  const patterns: string[] = [];

  if (titles.some((title) => /\bunder\b|\bless than\b/.test(title))) {
    patterns.push("Top videos frequently anchor the title with a price ceiling.");
  }
  if (titles.some((title) => /\bhow\b|\bcould you\b|\bcan you\b/.test(title))) {
    patterns.push("Question-led framing appears in competitive relocation videos.");
  }
  if (titles.some((title) => /\binside\b|\btour\b/.test(title))) {
    patterns.push("Single-property showcase titles still compete when the home is highly distinctive.");
  }
  if (titles.some((title) => /\bbest\b|\btop\b|\b\d+\b/.test(title))) {
    patterns.push("List-driven ranking language remains common in high-traffic property discovery videos.");
  }

  return patterns.slice(0, 4);
}

function buildFallbackProviderStatus(detail?: string): CasaHudOpportunityProviderStatus {
  return {
    mode: "casahud_patterns",
    label: "CasaFlix opportunity patterns",
    detail:
      detail || "Using CasaFlix opportunity patterns until YouTube connection is enabled for live competitive research.",
    canImproveWithYouTube: true,
  };
}

function buildFallbackResearch(preferredMarket?: string, detail?: string): CasaHudOpportunityResearchResult {
  const market = preferredMarket?.trim() || getDefaultPreferredMarket();
  const profile = resolveCasaHudMarketProfile(market);

  return {
    generatedAt: nowIso(),
    preferredMarket: market,
    marketLabel: profile.marketLabel,
    searchQuery: profile.searchQuery,
    providerStatus: buildFallbackProviderStatus(detail),
    similarVideos: [],
    researchBrief: {
      summary: `${profile.marketLabel} currently favors specific affordability, relocation, and location-led hooks over generic property tours. CasaFlix is using its internal opportunity patterns to focus on repeatable titles that can still be supported by real listings later.`,
      opportunityCategories: profile.opportunityCategories,
      competitorPatterns: [
        "Specific budgets, regions, and buyer personas outperform broad market-overview titles.",
        "Videos framed around real buyable inventory are easier to repeat than pure luxury inspiration content.",
      ],
      audienceIntent: profile.audienceIntent,
      suggestedTitleDirections: profile.suggestedDirections,
      riskNotes: profile.riskNotes,
    },
  };
}

export class CasaHudYouTubeOpportunityProvider implements CasaHudOpportunityResearchProvider {
  constructor(private readonly apiKey?: string | null, private readonly fetchImpl: typeof fetch = fetch) {}

  async research(input: OpportunityResearchInput): Promise<CasaHudOpportunityResearchResult> {
    const market = input.preferredMarket?.trim() || getDefaultPreferredMarket();
    const profile = resolveCasaHudMarketProfile(market);
    const key = this.apiKey?.trim();

    if (!key) {
      return buildFallbackResearch(market);
    }

    try {
      const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
      searchUrl.searchParams.set("part", "snippet");
      searchUrl.searchParams.set("type", "video");
      searchUrl.searchParams.set("maxResults", "8");
      searchUrl.searchParams.set("order", "relevance");
      searchUrl.searchParams.set("q", profile.searchQuery);
      searchUrl.searchParams.set("key", key);

      const searchResponse = await this.fetchImpl(searchUrl);
      if (!searchResponse.ok) {
        throw new Error(`YouTube search failed with HTTP ${searchResponse.status}`);
      }

      const searchPayload = (await searchResponse.json()) as { items?: YouTubeSearchItem[] };
      const items = searchPayload.items || [];
      const ids = items.map((item) => item.id?.videoId).filter((value): value is string => Boolean(value));
      const statsById = new Map<string, YouTubeVideoStatsItem["statistics"]>();

      if (ids.length > 0) {
        const statsUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
        statsUrl.searchParams.set("part", "statistics");
        statsUrl.searchParams.set("id", ids.join(","));
        statsUrl.searchParams.set("key", key);

        const statsResponse = await this.fetchImpl(statsUrl);
        if (statsResponse.ok) {
          const statsPayload = (await statsResponse.json()) as { items?: YouTubeVideoStatsItem[] };
          for (const item of statsPayload.items || []) {
            if (item.id) statsById.set(item.id, item.statistics);
          }
        }
      }

      const similarVideos = items.map((item) => {
        const videoId = item.id?.videoId;
        const stats = videoId ? statsById.get(videoId) : undefined;
        const video: CasaHudOpportunityResearchVideo = {
          title: item.snippet?.title || "Untitled video",
          channelTitle: item.snippet?.channelTitle,
          publishedAt: item.snippet?.publishedAt,
          viewCount: toNumber(stats?.viewCount),
          likeCount: toNumber(stats?.likeCount),
          sourceUrl: videoId ? `https://www.youtube.com/watch?v=${videoId}` : undefined,
        };
        return {
          ...video,
          velocityScore: velocityScore(video),
        };
      });

      return {
        generatedAt: nowIso(),
        preferredMarket: market,
        marketLabel: profile.marketLabel,
        searchQuery: profile.searchQuery,
        providerStatus: {
          mode: "live_youtube",
          label: "Live YouTube research",
          detail: "Using live YouTube search results and recent video statistics to shape title opportunities.",
          canImproveWithYouTube: false,
        },
        similarVideos,
        researchBrief: {
          summary: `${profile.marketLabel} is showing repeatable demand for titles that pair clear geography with affordability, relocation, or inventory-backed specificity. CasaFlix used live competitive results to sharpen the title mix and reduce weak generic directions.`,
          opportunityCategories: profile.opportunityCategories,
          competitorPatterns: analyzeCompetitorPatterns(similarVideos),
          audienceIntent: profile.audienceIntent,
          suggestedTitleDirections: profile.suggestedDirections,
          riskNotes: profile.riskNotes,
        },
      };
    } catch {
      return buildFallbackResearch(
        market,
        "Using CasaFlix opportunity patterns while live YouTube research is temporarily unavailable.",
      );
    }
  }
}

export function createCasaHudOpportunityResearchProvider(params: {
  apiKey?: string | null;
  fetchImpl?: typeof fetch;
}): CasaHudOpportunityResearchProvider {
  return new CasaHudYouTubeOpportunityProvider(params.apiKey, params.fetchImpl);
}
