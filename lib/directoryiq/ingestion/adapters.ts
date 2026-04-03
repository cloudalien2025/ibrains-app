import {
  canonicalizePageUrl,
  extractHtmlTitle,
  normalizeWhitespace,
  parseYoutubeVideoId,
  sha256Hex,
  stripHtmlToText,
  type IngestSourceType,
  type NormalizedIngestItem,
} from "@/lib/directoryiq/ingestion/contracts";
import { fetchYoutubeSourceText } from "@/lib/brain-learning/youtubeIngestSource";

const MAX_FETCH_CHARS = 120_000;

async function fetchUrlText(url: string): Promise<{ title: string; content: string; contentType: string | null }> {
  const res = await fetch(url, {
    method: "GET",
    headers: {
      "User-Agent": "iBrains-DirectoryIQ/1.0",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Unable to fetch URL (${res.status})`);
  }

  const contentType = res.headers.get("content-type");
  const raw = (await res.text()).slice(0, MAX_FETCH_CHARS);

  if (contentType?.includes("text/html") || raw.includes("<html")) {
    const title = extractHtmlTitle(raw);
    return {
      title,
      content: stripHtmlToText(raw),
      contentType,
    };
  }

  return {
    title: "",
    content: normalizeWhitespace(raw),
    contentType,
  };
}

async function discoverWebSearchUrls(query: string, maxResults: number): Promise<string[]> {
  const ddg = new URL("https://duckduckgo.com/html/");
  ddg.searchParams.set("q", query);

  const res = await fetch(ddg.toString(), {
    method: "GET",
    headers: {
      "User-Agent": "iBrains-DirectoryIQ/1.0",
      Accept: "text/html",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Web search unavailable (${res.status})`);
  }

  const html = await res.text();
  const directMatches = [...html.matchAll(/<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"/gi)]
    .map((m) => m[1])
    .filter(Boolean);

  const decoded = directMatches
    .map((href) => {
      try {
        if (href.startsWith("//")) return `https:${href}`;
        const maybe = new URL(href, "https://duckduckgo.com");
        if (maybe.hostname === "duckduckgo.com" && maybe.pathname === "/l/") {
          const uddg = maybe.searchParams.get("uddg");
          if (uddg) return decodeURIComponent(uddg);
        }
        return maybe.toString();
      } catch {
        return null;
      }
    })
    .filter((v): v is string => Boolean(v));

  const uniq = new Set<string>();
  for (const item of decoded) {
    try {
      uniq.add(canonicalizePageUrl(item));
    } catch {
      continue;
    }
    if (uniq.size >= maxResults) break;
  }

  return [...uniq];
}

export async function adaptWebSearch(input: {
  query: string;
  maxCandidates: number;
}): Promise<NormalizedIngestItem[]> {
  const query = input.query.trim();
  if (!query) throw new Error("web_search requires a query");

  const urls = await discoverWebSearchUrls(query, input.maxCandidates);
  const now = new Date().toISOString();
  const items: NormalizedIngestItem[] = [];

  for (const canonicalUrl of urls) {
    try {
      const fetched = await fetchUrlText(canonicalUrl);
      if (!fetched.content) continue;
      const title = fetched.title || canonicalUrl;
      const content = fetched.content;
      items.push({
        source_type: "web_search",
        source_key: canonicalUrl,
        source_locator: canonicalUrl,
        title,
        content,
        metadata: {
          query,
          discovered_via: "duckduckgo_html",
          content_type: fetched.contentType,
        },
        content_hash: sha256Hex(content),
        last_seen_at: now,
      });
    } catch {
      continue;
    }
  }

  return items;
}

function resolveRelative(base: string, href: string): string | null {
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

export async function adaptWebsiteUrl(input: {
  url: string;
  maxPages: number;
  crawlDepth: number;
}): Promise<NormalizedIngestItem[]> {
  const root = canonicalizePageUrl(input.url);
  const rootUrl = new URL(root);
  const maxPages = Math.max(1, Math.min(input.maxPages, 20));
  const crawlDepth = Math.max(0, Math.min(input.crawlDepth, 2));

  const queue: Array<{ url: string; depth: number }> = [{ url: root, depth: 0 }];
  const seen = new Set<string>();
  const out: NormalizedIngestItem[] = [];
  const now = new Date().toISOString();

  while (queue.length > 0 && out.length < maxPages) {
    const current = queue.shift();
    if (!current) break;
    if (seen.has(current.url)) continue;
    seen.add(current.url);

    let rawHtml = "";
    let fetched: { title: string; content: string; contentType: string | null } | null = null;
    try {
      const res = await fetch(current.url, {
        method: "GET",
        headers: {
          "User-Agent": "iBrains-DirectoryIQ/1.0",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        cache: "no-store",
      });
      if (!res.ok) continue;
      const contentType = res.headers.get("content-type");
      rawHtml = (await res.text()).slice(0, MAX_FETCH_CHARS);
      const text = contentType?.includes("text/html") ? stripHtmlToText(rawHtml) : normalizeWhitespace(rawHtml);
      if (!text) continue;
      fetched = {
        title: extractHtmlTitle(rawHtml) || current.url,
        content: text,
        contentType,
      };
    } catch {
      continue;
    }

    if (!fetched) continue;

    out.push({
      source_type: "website_url",
      source_key: canonicalizePageUrl(current.url),
      source_locator: current.url,
      title: fetched.title,
      content: fetched.content,
      metadata: {
        entry_url: root,
        crawl_depth: current.depth,
        content_type: fetched.contentType,
      },
      content_hash: sha256Hex(fetched.content),
      last_seen_at: now,
    });

    if (current.depth >= crawlDepth) continue;
    const hrefs = [...rawHtml.matchAll(/<a[^>]+href="([^"]+)"/gi)].map((m) => m[1]).slice(0, 200);
    for (const href of hrefs) {
      const resolved = resolveRelative(current.url, href);
      if (!resolved) continue;
      let canonical = "";
      try {
        canonical = canonicalizePageUrl(resolved);
      } catch {
        continue;
      }
      const parsed = new URL(canonical);
      if (parsed.hostname !== rootUrl.hostname) continue;
      if (!seen.has(canonical)) {
        queue.push({ url: canonical, depth: current.depth + 1 });
      }
    }
  }

  return out;
}

export async function adaptDocumentUpload(input: {
  file: File;
  title?: string;
}): Promise<NormalizedIngestItem[]> {
  const file = input.file;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const fileHash = sha256Hex(Buffer.from(bytes).toString("base64"));

  const textMime = [
    "text/plain",
    "text/markdown",
    "text/csv",
    "application/json",
    "application/xml",
  ];

  if (file.type && !textMime.includes(file.type)) {
    throw new Error(
      `Unsupported file type '${file.type}'. Supported types: text/plain, text/markdown, text/csv, application/json, application/xml.`
    );
  }

  const text = normalizeWhitespace(await file.text());
  if (!text) throw new Error("Uploaded document was empty after text extraction");

  return [
    {
      source_type: "document_upload",
      source_key: fileHash,
      source_locator: file.name || "uploaded_document",
      title: input.title?.trim() || file.name || "Uploaded document",
      content: text,
      metadata: {
        file_name: file.name,
        file_size: file.size,
        file_type: file.type || null,
      },
      content_hash: sha256Hex(text),
      last_seen_at: new Date().toISOString(),
    },
  ];
}

export async function adaptYoutube(input: {
  url: string;
}): Promise<NormalizedIngestItem[]> {
  const videoId = parseYoutubeVideoId(input.url);
  if (!videoId) throw new Error("Invalid YouTube URL or video ID");

  const text = await fetchYoutubeSourceText(videoId);
  const title = typeof text.contentJson?.snippet === "object" && text.contentJson?.snippet
    ? String((text.contentJson.snippet as Record<string, unknown>).title || `YouTube ${videoId}`)
    : `YouTube ${videoId}`;

  return [
    {
      source_type: "youtube",
      source_key: videoId,
      source_locator: `https://www.youtube.com/watch?v=${videoId}`,
      title,
      content: text.text,
      metadata: {
        provider: "youtube",
        video_id: videoId,
        source_mode: text.source,
        language_code: text.languageCode,
        source_json: text.contentJson,
      },
      content_hash: text.contentSha256,
      last_seen_at: new Date().toISOString(),
    },
  ];
}

export async function runAdapter(params: {
  sourceType: IngestSourceType;
  payload: Record<string, unknown>;
  formData?: FormData;
}): Promise<NormalizedIngestItem[]> {
  switch (params.sourceType) {
    case "web_search": {
      const query = String(params.payload.query ?? params.payload.keyword ?? "");
      const maxCandidates = Number(params.payload.max_candidates ?? params.payload.selected_new ?? 20);
      return adaptWebSearch({ query, maxCandidates: Math.max(1, Math.min(maxCandidates || 20, 50)) });
    }
    case "website_url": {
      const url = String(params.payload.url ?? "").trim();
      const maxPages = Number(params.payload.max_pages ?? 5);
      const crawlDepth = Number(params.payload.crawl_depth ?? 0);
      return adaptWebsiteUrl({ url, maxPages, crawlDepth });
    }
    case "document_upload": {
      const file = (params.formData?.get("file") as File | null) ?? null;
      if (!file) {
        throw new Error("document_upload requires multipart form-data with a 'file' field");
      }
      const title = String(params.formData?.get("title") ?? params.payload.title ?? "").trim();
      return adaptDocumentUpload({ file, title });
    }
    case "youtube": {
      const url = String(params.payload.url ?? params.payload.video_url ?? params.payload.videoId ?? "").trim();
      return adaptYoutube({ url });
    }
    default:
      throw new Error(`Unsupported source type: ${String(params.sourceType)}`);
  }
}
