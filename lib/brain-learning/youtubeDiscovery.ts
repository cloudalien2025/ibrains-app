import crypto from "crypto";

export type YoutubeWatchMode = "youtube_channel" | "youtube_playlist" | "youtube_keyword";

export type YoutubeDiscoveredVideo = {
  canonicalIdentity: string;
  sourceItemId: string;
  sourceUrl: string;
  title: string | null;
  channelId: string | null;
  channelTitle: string | null;
  publishedAt: string | null;
  languageCode: string | null;
  raw: Record<string, unknown>;
};

type YouTubeSearchItem = {
  id?: { videoId?: string };
  snippet?: {
    title?: string;
    channelId?: string;
    channelTitle?: string;
    publishedAt?: string;
    defaultLanguage?: string;
    defaultAudioLanguage?: string;
  };
};

type YouTubePlaylistItem = {
  contentDetails?: { videoId?: string; videoPublishedAt?: string };
  snippet?: {
    title?: string;
    channelId?: string;
    channelTitle?: string;
    publishedAt?: string;
    defaultLanguage?: string;
    defaultAudioLanguage?: string;
    resourceId?: { videoId?: string };
  };
};

function parseIso(value: string | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function normalizeSearchItem(item: YouTubeSearchItem): YoutubeDiscoveredVideo | null {
  const videoId = item.id?.videoId?.trim();
  if (!videoId) return null;
  const snippet = item.snippet || {};
  return {
    canonicalIdentity: videoId,
    sourceItemId: videoId,
    sourceUrl: `https://www.youtube.com/watch?v=${videoId}`,
    title: snippet.title?.trim() || null,
    channelId: snippet.channelId?.trim() || null,
    channelTitle: snippet.channelTitle?.trim() || null,
    publishedAt: parseIso(snippet.publishedAt),
    languageCode: snippet.defaultLanguage || snippet.defaultAudioLanguage || null,
    raw: item as unknown as Record<string, unknown>,
  };
}

function normalizePlaylistItem(item: YouTubePlaylistItem): YoutubeDiscoveredVideo | null {
  const videoId =
    item.contentDetails?.videoId?.trim() ||
    item.snippet?.resourceId?.videoId?.trim();
  if (!videoId) return null;
  const snippet = item.snippet || {};
  return {
    canonicalIdentity: videoId,
    sourceItemId: videoId,
    sourceUrl: `https://www.youtube.com/watch?v=${videoId}`,
    title: snippet.title?.trim() || null,
    channelId: snippet.channelId?.trim() || null,
    channelTitle: snippet.channelTitle?.trim() || null,
    publishedAt: parseIso(item.contentDetails?.videoPublishedAt || snippet.publishedAt),
    languageCode: snippet.defaultLanguage || snippet.defaultAudioLanguage || null,
    raw: item as unknown as Record<string, unknown>,
  };
}

async function callYouTube(path: string, params: Record<string, string>): Promise<any> {
  const apiKey = process.env.YOUTUBE_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Missing required env var: YOUTUBE_API_KEY");
  }
  const url = new URL(`https://www.googleapis.com/youtube/v3/${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }
  url.searchParams.set("key", apiKey);

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  const text = await res.text();
  let payload: any = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = {};
  }

  if (!res.ok) {
    const msg =
      payload?.error?.message ||
      payload?.message ||
      `YouTube API request failed with HTTP ${res.status}`;
    throw new Error(msg);
  }

  return payload;
}

export function parseChannelId(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  if (/^UC[a-zA-Z0-9_-]{10,}$/.test(v)) return v;
  try {
    const u = new URL(v);
    const m = u.pathname.match(/\/channel\/(UC[a-zA-Z0-9_-]+)/);
    return m?.[1] || null;
  } catch {
    return null;
  }
}

export function parsePlaylistId(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  if (/^[A-Za-z0-9_-]{10,}$/.test(v) && (v.startsWith("PL") || v.startsWith("UU") || v.startsWith("OL"))) {
    return v;
  }
  try {
    const u = new URL(v);
    const list = u.searchParams.get("list");
    return list?.trim() || null;
  } catch {
    return null;
  }
}

export function stableJsonHash(payload: unknown): string {
  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export async function discoverYoutubeVideos(params: {
  mode: YoutubeWatchMode;
  externalRef: string;
  canonicalRef: string;
  discoveryQuery: string | null;
  maxResults: number;
}): Promise<YoutubeDiscoveredVideo[]> {
  const maxResults = Math.max(1, Math.min(params.maxResults, 50));
  if (params.mode === "youtube_channel") {
    const channelId = parseChannelId(params.canonicalRef || params.externalRef);
    if (!channelId) throw new Error("Invalid channel watch reference");
    const payload = await callYouTube("search", {
      part: "snippet",
      type: "video",
      order: "date",
      channelId,
      maxResults: String(maxResults),
    });
    const items = Array.isArray(payload?.items) ? payload.items : [];
    return items.map((item: YouTubeSearchItem) => normalizeSearchItem(item)).filter(Boolean) as YoutubeDiscoveredVideo[];
  }

  if (params.mode === "youtube_playlist") {
    const playlistId = parsePlaylistId(params.canonicalRef || params.externalRef);
    if (!playlistId) throw new Error("Invalid playlist watch reference");
    const payload = await callYouTube("playlistItems", {
      part: "snippet,contentDetails",
      playlistId,
      maxResults: String(maxResults),
    });
    const items = Array.isArray(payload?.items) ? payload.items : [];
    return items.map((item: YouTubePlaylistItem) => normalizePlaylistItem(item)).filter(Boolean) as YoutubeDiscoveredVideo[];
  }

  const query = (params.discoveryQuery || params.canonicalRef || params.externalRef || "").trim();
  if (!query) throw new Error("Missing keyword query for youtube_keyword watch");
  const payload = await callYouTube("search", {
    part: "snippet",
    type: "video",
    order: "date",
    q: query,
    maxResults: String(maxResults),
  });
  const items = Array.isArray(payload?.items) ? payload.items : [];
  return items.map((item: YouTubeSearchItem) => normalizeSearchItem(item)).filter(Boolean) as YoutubeDiscoveredVideo[];
}
