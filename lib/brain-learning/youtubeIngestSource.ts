import crypto from "crypto";

type TranscriptSegment = {
  startMs: number | null;
  endMs: number | null;
  text: string;
};

export type YoutubeSourceText = {
  text: string;
  languageCode: string | null;
  source: "timedtext" | "youtube_snippet";
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

function parseJson3Transcript(payload: any): TranscriptSegment[] {
  const events = Array.isArray(payload?.events) ? payload.events : [];
  const segments: TranscriptSegment[] = [];
  for (const ev of events) {
    const segs = Array.isArray(ev?.segs) ? ev.segs : [];
    const text = normalizeWhitespace(
      segs
        .map((s: any) => (typeof s?.utf8 === "string" ? s.utf8 : ""))
        .join(" ")
    );
    if (!text) continue;
    const startMs =
      typeof ev?.tStartMs === "number" ? Number(ev.tStartMs) : null;
    const durMs = typeof ev?.dDurationMs === "number" ? Number(ev.dDurationMs) : null;
    const endMs = startMs !== null && durMs !== null ? startMs + durMs : null;
    segments.push({ startMs, endMs, text });
  }
  return segments;
}

async function fetchTimedText(videoId: string): Promise<YoutubeSourceText | null> {
  const languageCsv = process.env.BRAIN_INGEST_TRANSCRIPT_LANGS || "en,en-US";
  const languages = languageCsv
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

  for (const lang of languages) {
    const url = new URL("https://www.youtube.com/api/timedtext");
    url.searchParams.set("v", videoId);
    url.searchParams.set("lang", lang);
    url.searchParams.set("fmt", "json3");
    const res = await fetch(url.toString(), {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) continue;
    const text = await res.text();
    if (!text || text.trim() === "") continue;

    let payload: any = null;
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
    if (!payload) continue;
    const segments = parseJson3Transcript(payload);
    if (!segments.length) continue;
    const joined = normalizeWhitespace(segments.map((s) => s.text).join(" "));
    if (!joined) continue;
    return {
      text: joined,
      languageCode: lang,
      source: "timedtext",
      contentJson: {
        provider: "youtube",
        transcript_format: "json3",
        transcript_lang: lang,
      },
      contentSha256: sha256(joined),
      segments,
    };
  }
  return null;
}

async function fetchVideoSnippet(videoId: string): Promise<YoutubeSourceText | null> {
  const apiKey = process.env.YOUTUBE_API_KEY?.trim();
  if (!apiKey) return null;

  const url = new URL("https://www.googleapis.com/youtube/v3/videos");
  url.searchParams.set("part", "snippet");
  url.searchParams.set("id", videoId);
  url.searchParams.set("key", apiKey);
  const res = await fetch(url.toString(), {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) return null;

  const text = await res.text();
  let payload: any = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = {};
  }

  const item = Array.isArray(payload?.items) ? payload.items[0] : null;
  const snippet = item?.snippet || {};
  const title = normalizeWhitespace(String(snippet?.title || ""));
  const description = normalizeWhitespace(String(snippet?.description || ""));
  const combined = normalizeWhitespace([title, description].filter(Boolean).join("\n\n"));
  if (!combined) return null;

  return {
    text: combined,
    languageCode:
      (typeof snippet?.defaultLanguage === "string" && snippet.defaultLanguage) ||
      (typeof snippet?.defaultAudioLanguage === "string" && snippet.defaultAudioLanguage) ||
      null,
    source: "youtube_snippet",
    contentJson: {
      provider: "youtube",
      snippet: {
        title: snippet?.title || null,
        description: snippet?.description || null,
        channelId: snippet?.channelId || null,
        channelTitle: snippet?.channelTitle || null,
        publishedAt: snippet?.publishedAt || null,
      },
    },
    contentSha256: sha256(combined),
    segments: [],
  };
}

export async function fetchYoutubeSourceText(videoId: string): Promise<YoutubeSourceText> {
  const transcript = await fetchTimedText(videoId);
  if (transcript) return transcript;

  const snippet = await fetchVideoSnippet(videoId);
  if (snippet) return snippet;

  throw new Error(
    "No source-derived text available for video. Check transcript availability or YOUTUBE_API_KEY."
  );
}
