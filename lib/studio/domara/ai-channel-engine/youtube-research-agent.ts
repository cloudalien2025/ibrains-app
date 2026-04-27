import { nowIso } from "@/lib/studio/domara/ai-channel-engine/ids";
import type { CasaHudYouTubeResearchResult, CasaHudYouTubeResearchVideo } from "@/lib/studio/domara/ai-channel-engine/types";

export interface CasaHudYouTubeResearchProvider {
  providerName: "youtube_data_api" | "heuristic";
  research(query: string): Promise<CasaHudYouTubeResearchResult>;
}

function heuristicPatterns(query: string): string[] {
  const lower = query.toLowerCase();
  const place = lower.includes("italy") ? "Italy" : "European";
  return [
    `Numbered roundup + affordability promise (${place} homes under a clear budget)`,
    "Question-led relocation hook with a specific buyer persona",
    "Comparison framing against a familiar US housing cost",
    "Niche inventory promise with proof language like 'you can actually buy'",
  ];
}

export class HeuristicYouTubeResearchProvider implements CasaHudYouTubeResearchProvider {
  providerName = "heuristic" as const;

  async research(query: string): Promise<CasaHudYouTubeResearchResult> {
    return {
      provider: "heuristic",
      status: "limited",
      credentialRequired: true,
      query,
      opportunitySummary:
        "YouTube API credentials are not connected, so CasaHUD is using built-in real-estate channel strategy heuristics instead of live ranking data.",
      titlePatterns: heuristicPatterns(query),
      nicheGaps: [
        "Affordable coastal homes with real listing proof",
        "Retirement and relocation angles for US buyers",
        "Budget-constrained regional roundups with map context",
      ],
      similarVideos: [],
      generatedAt: nowIso(),
    };
  }
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

function toNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function velocityScore(video: CasaHudYouTubeResearchVideo): number | undefined {
  if (!video.publishedAt || video.viewCount === undefined) return undefined;
  const published = Date.parse(video.publishedAt);
  if (!Number.isFinite(published)) return undefined;
  const ageDays = Math.max(1, Math.floor((Date.now() - published) / 86_400_000));
  return Math.round(video.viewCount / ageDays);
}

export class YouTubeDataApiResearchProvider implements CasaHudYouTubeResearchProvider {
  providerName = "youtube_data_api" as const;

  constructor(private readonly apiKey: string, private readonly fetchImpl: typeof fetch = fetch) {}

  async research(query: string): Promise<CasaHudYouTubeResearchResult> {
    const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
    searchUrl.searchParams.set("part", "snippet");
    searchUrl.searchParams.set("type", "video");
    searchUrl.searchParams.set("maxResults", "8");
    searchUrl.searchParams.set("q", query);
    searchUrl.searchParams.set("key", this.apiKey);

    const searchResponse = await this.fetchImpl(searchUrl);
    if (!searchResponse.ok) {
      throw new Error(`YouTube research failed with HTTP ${searchResponse.status}.`);
    }
    const searchPayload = (await searchResponse.json()) as { items?: YouTubeSearchItem[] };
    const items = searchPayload.items || [];
    const ids = items.map((item) => item.id?.videoId).filter((value): value is string => Boolean(value));
    const statsById = new Map<string, YouTubeVideoStatsItem["statistics"]>();

    if (ids.length > 0) {
      const statsUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
      statsUrl.searchParams.set("part", "statistics");
      statsUrl.searchParams.set("id", ids.join(","));
      statsUrl.searchParams.set("key", this.apiKey);
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
      const video: CasaHudYouTubeResearchVideo = {
        videoId,
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

    const livePatterns = similarVideos
      .slice(0, 5)
      .map((video) => video.title)
      .filter(Boolean);

    return {
      provider: "youtube_data_api",
      status: "live",
      credentialRequired: false,
      query,
      opportunitySummary:
        "CasaHUD used live YouTube search and video statistics to shape title patterns, ranking fit, and niche opportunity scoring.",
      titlePatterns: livePatterns.length > 0 ? livePatterns : heuristicPatterns(query),
      nicheGaps: [
        "Higher proof density than generic real-estate tours",
        "Sharper budget/location specificity than broad luxury showcase videos",
        "Map-led location context that supports retention after the opening hook",
      ],
      similarVideos,
      generatedAt: nowIso(),
    };
  }
}

export function createYouTubeResearchProvider(params: {
  apiKey?: string | null;
  fetchImpl?: typeof fetch;
}): CasaHudYouTubeResearchProvider {
  const key = params.apiKey?.trim();
  if (key) return new YouTubeDataApiResearchProvider(key, params.fetchImpl);
  return new HeuristicYouTubeResearchProvider();
}
