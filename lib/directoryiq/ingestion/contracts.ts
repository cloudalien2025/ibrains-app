import crypto from "crypto";

export type IngestSourceType = "web_search" | "website_url" | "document_upload" | "youtube";

export type DedupeDecision = "create" | "skip" | "update" | "version";

export type NormalizedIngestItem = {
  source_type: IngestSourceType;
  source_key: string;
  source_locator: string;
  title: string;
  content: string;
  metadata: Record<string, unknown>;
  content_hash: string;
  last_seen_at: string;
};

export function sha256Hex(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function stripHtmlToText(html: string): string {
  const withoutScripts = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ");
  const text = withoutScripts
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
  return normalizeWhitespace(text);
}

export function extractHtmlTitle(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!match?.[1]) return "";
  return normalizeWhitespace(stripHtmlToText(match[1]));
}

const TRACKING_QUERY_KEYS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "gclid",
  "fbclid",
  "mc_cid",
  "mc_eid",
  "igshid",
  "ref",
]);

export function canonicalizePageUrl(raw: string): string {
  const url = new URL(raw);
  url.hash = "";
  url.protocol = url.protocol.toLowerCase();
  url.hostname = url.hostname.toLowerCase();

  const kept = new URLSearchParams();
  for (const [key, value] of url.searchParams.entries()) {
    const lowered = key.toLowerCase();
    if (TRACKING_QUERY_KEYS.has(lowered) || lowered.startsWith("utm_")) continue;
    kept.append(key, value);
  }
  url.search = kept.toString() ? `?${kept.toString()}` : "";

  if (url.pathname !== "/") {
    url.pathname = url.pathname.replace(/\/+$/, "");
    if (!url.pathname.startsWith("/")) url.pathname = `/${url.pathname}`;
  }

  return url.toString();
}

export function parseYoutubeVideoId(input: string): string | null {
  try {
    const url = new URL(input);
    if (url.hostname === "youtu.be") {
      const candidate = url.pathname.replace(/^\//, "").trim();
      return candidate || null;
    }
    if (url.hostname.endsWith("youtube.com")) {
      if (url.pathname === "/watch") {
        const v = url.searchParams.get("v")?.trim();
        return v || null;
      }
      if (url.pathname.startsWith("/shorts/")) {
        const candidate = url.pathname.split("/")[2]?.trim();
        return candidate || null;
      }
      if (url.pathname.startsWith("/embed/")) {
        const candidate = url.pathname.split("/")[2]?.trim();
        return candidate || null;
      }
    }
  } catch {
    const trimmed = input.trim();
    if (/^[A-Za-z0-9_-]{8,20}$/.test(trimmed)) return trimmed;
  }
  return null;
}
