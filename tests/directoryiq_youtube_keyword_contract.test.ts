import { describe, expect, it } from "vitest";
import {
  buildYoutubeDirectUrlPayload,
  buildYoutubeIngestRequest,
  buildYoutubeKeywordDiscoveryPayload,
  clampYoutubeRequestedVideos,
} from "@/lib/directoryiq/ingestion/youtubeContracts";

describe("directoryiq youtube keyword discovery contract", () => {
  it("builds worker-compatible keyword payload shape", () => {
    const payload = buildYoutubeKeywordDiscoveryPayload({
      keyword: "brilliant directories seo",
      requestedVideos: 7,
    });

    expect(payload).toMatchObject({
      keyword: "brilliant directories seo",
      selected_new: 7,
      n_new_videos: 7,
      youtube_requested_new: 7,
      max_candidates: 7,
      youtube_max_candidates: 7,
      mode: "audio_first",
    });
    expect(payload).not.toHaveProperty("source_type");
    expect(payload).not.toHaveProperty("url");
  });

  it("builds direct-url payload shape", () => {
    const payload = buildYoutubeDirectUrlPayload("https://www.youtube.com/watch?v=abc123_XYZ");
    expect(payload).toEqual({
      source_type: "youtube",
      url: "https://www.youtube.com/watch?v=abc123_XYZ",
    });
  });

  it("flows requested count through worker fields", () => {
    const payload = buildYoutubeKeywordDiscoveryPayload({
      keyword: "directory software",
      requestedVideos: 13,
    });
    expect(payload.selected_new).toBe(13);
    expect(payload.n_new_videos).toBe(13);
    expect(payload.youtube_requested_new).toBe(13);
    expect(payload.max_candidates).toBe(13);
    expect(payload.youtube_max_candidates).toBe(13);
  });

  it("does not leak stale values across mode switches", () => {
    const keywordMode = buildYoutubeIngestRequest({
      mode: "keyword",
      keyword: "directory keyword",
      requestedVideos: 4,
      url: "https://www.youtube.com/watch?v=stale_url",
    });
    expect(keywordMode).not.toHaveProperty("url");
    expect(keywordMode).not.toHaveProperty("source_type");

    const directMode = buildYoutubeIngestRequest({
      mode: "direct_url",
      keyword: "stale keyword",
      requestedVideos: 99,
      url: "https://www.youtube.com/watch?v=abc123_XYZ",
    });
    expect(directMode).toEqual({
      source_type: "youtube",
      url: "https://www.youtube.com/watch?v=abc123_XYZ",
    });
    expect(directMode).not.toHaveProperty("keyword");
    expect(directMode).not.toHaveProperty("youtube_requested_new");
  });

  it("clamps requested videos to worker discovery bounds", () => {
    expect(clampYoutubeRequestedVideos(0)).toBe(1);
    expect(clampYoutubeRequestedVideos(1000)).toBe(50);
  });
});
