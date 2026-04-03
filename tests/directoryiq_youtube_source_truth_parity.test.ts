import { afterEach, describe, expect, it, vi } from "vitest";
import { parseYoutubeVideoId } from "@/lib/directoryiq/ingestion/contracts";
import { resolveDecision } from "@/lib/directoryiq/ingestion/engine";
import { fetchYoutubeSourceText } from "@/lib/brain-learning/youtubeIngestSource";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("directoryiq youtube source-of-truth parity", () => {
  it("uses canonical video_id identity from URLs", () => {
    expect(parseYoutubeVideoId("https://www.youtube.com/watch?v=abc123_XYZ")).toBe("abc123_XYZ");
    expect(parseYoutubeVideoId("https://youtu.be/abc123_XYZ?t=8")).toBe("abc123_XYZ");
  });

  it("treats unchanged youtube content as skip", () => {
    const current = { id: "doc_1", content_sha256: "same_hash", version_no: 1 };
    expect(resolveDecision("youtube", current, "same_hash")).toBe("skip");
  });

  it("treats changed youtube content as version", () => {
    const current = { id: "doc_1", content_sha256: "old_hash", version_no: 1 };
    expect(resolveDecision("youtube", current, "new_hash")).toBe("version");
  });

  it("uses worker-first transcript path via /transcript audio contract", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          video_id: "abc123_XYZ",
          transcript_source: "audio_local_whisper",
          transcript_text: "Hello from worker transcript",
          diagnostics: { pipeline_stage_attempts: ["audio_first"] },
        }),
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    process.env.BRAINS_API_BASE = "https://api.ibrains.ai";
    process.env.BRAINS_WORKER_API_KEY = "worker_test_key";

    const text = await fetchYoutubeSourceText("abc123_XYZ");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.ibrains.ai/transcript");
    expect(init.method).toBe("POST");
    const body = JSON.parse(String(init.body));
    expect(body.video_id).toBe("abc123_XYZ");
    expect(body.source_id).toBe("yt:abc123_XYZ");
    expect(body.url).toBe("https://www.youtube.com/watch?v=abc123_XYZ");
    expect(body.allow_audio_fallback).toBe(false);

    expect(text.source).toBe("worker_audio_local_whisper");
    expect(text.text).toBe("Hello from worker transcript");
  });

  it("surfaces worker error_code + diagnostics in failure shape", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      text: async () =>
        JSON.stringify({
          error_code: "AUDIO_DOWNLOAD_FAILED",
          error: "yt-dlp blocked",
          diagnostics: { audio_download_status: "failed" },
        }),
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    process.env.BRAINS_API_BASE = "https://api.ibrains.ai";
    process.env.BRAINS_WORKER_API_KEY = "worker_test_key";

    await expect(fetchYoutubeSourceText("abc123_XYZ")).rejects.toThrow(
      /AUDIO_DOWNLOAD_FAILED: yt-dlp blocked/,
    );
  });
});
