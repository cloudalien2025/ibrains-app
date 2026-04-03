import crypto from "crypto";

type TranscriptSegment = {
  startMs: number | null;
  endMs: number | null;
  text: string;
};

type WorkerTranscriptSuccess = {
  video_id?: string;
  transcript_source?: string;
  transcript_text?: string;
  diagnostics?: Record<string, unknown>;
};

type WorkerTranscriptError = {
  error_code?: string;
  error?: string;
  diagnostics?: Record<string, unknown>;
};

export type YoutubeSourceText = {
  text: string;
  languageCode: string | null;
  source: "worker_audio_local_whisper";
  contentJson: Record<string, unknown>;
  contentSha256: string;
  segments: TranscriptSegment[];
};

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function workerTranscriptBaseUrl(): string {
  return (process.env.BRAINS_API_BASE ?? "https://api.ibrains.ai").replace(/\/+$/, "");
}

function workerTranscriptHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  const workerKey = process.env.BRAINS_WORKER_API_KEY?.trim();
  if (workerKey) {
    headers["X-Api-Key"] = workerKey;
    return headers;
  }

  const fallbackKey =
    process.env.BRAINS_MASTER_KEY?.trim() || process.env.BRAINS_X_API_KEY?.trim();
  if (fallbackKey) {
    headers["X-Api-Key"] = fallbackKey;
  }
  return headers;
}

export async function fetchYoutubeSourceText(videoId: string): Promise<YoutubeSourceText> {
  const canonicalUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const res = await fetch(`${workerTranscriptBaseUrl()}/transcript`, {
    method: "POST",
    headers: workerTranscriptHeaders(),
    body: JSON.stringify({
      video_id: videoId,
      source_id: `yt:${videoId}`,
      url: canonicalUrl,
      allow_audio_fallback: false,
    }),
    cache: "no-store",
  });

  const payloadText = await res.text().catch(() => "");
  let payload: WorkerTranscriptSuccess | WorkerTranscriptError | null = null;
  try {
    payload = payloadText ? JSON.parse(payloadText) : null;
  } catch {
    payload = null;
  }

  if (!res.ok) {
    const errPayload = (payload ?? {}) as WorkerTranscriptError;
    const errCode = errPayload.error_code || "WORKER_TRANSCRIPT_FAILED";
    const errMessage =
      errPayload.error ||
      `Worker transcript request failed with HTTP ${res.status}`;
    const diagnostics = errPayload.diagnostics
      ? ` diagnostics=${JSON.stringify(errPayload.diagnostics)}`
      : "";
    throw new Error(`${errCode}: ${errMessage}${diagnostics}`);
  }

  const okPayload = (payload ?? {}) as WorkerTranscriptSuccess;
  const transcriptText = normalizeWhitespace(String(okPayload.transcript_text || ""));
  if (!transcriptText) {
    throw new Error("WORKER_TRANSCRIPT_EMPTY: Worker returned empty transcript_text");
  }

  return {
    text: transcriptText,
    languageCode: null,
    source: "worker_audio_local_whisper",
    contentJson: {
      provider: "youtube",
      transcript_source: okPayload.transcript_source || "audio_local_whisper",
      worker_video_id: okPayload.video_id || videoId,
      diagnostics: okPayload.diagnostics || {},
    },
    contentSha256: sha256(transcriptText),
    segments: [],
  };
}
