export type YoutubeIngestMode = "keyword" | "direct_url";

const YOUTUBE_REQUESTED_VIDEOS_MAX = 50;

export function clampYoutubeRequestedVideos(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(YOUTUBE_REQUESTED_VIDEOS_MAX, Math.max(1, Math.floor(value)));
}

export function buildYoutubeKeywordDiscoveryPayload(input: {
  keyword: string;
  requestedVideos: number;
}): Record<string, unknown> {
  const keyword = input.keyword.trim();
  const requestedVideos = clampYoutubeRequestedVideos(input.requestedVideos);
  return {
    keyword,
    selected_new: requestedVideos,
    n_new_videos: requestedVideos,
    youtube_requested_new: requestedVideos,
    max_candidates: requestedVideos,
    youtube_max_candidates: requestedVideos,
    mode: "audio_first",
  };
}

export function buildYoutubeDirectUrlPayload(url: string): Record<string, unknown> {
  return {
    source_type: "youtube",
    url: url.trim(),
  };
}

export function buildYoutubeIngestRequest(input: {
  mode: YoutubeIngestMode;
  keyword: string;
  requestedVideos: number;
  url: string;
}): Record<string, unknown> {
  if (input.mode === "keyword") {
    return buildYoutubeKeywordDiscoveryPayload({
      keyword: input.keyword,
      requestedVideos: input.requestedVideos,
    });
  }
  return buildYoutubeDirectUrlPayload(input.url);
}
