import { fetchTextWithRetry } from "@/lib/ingest/sitemap/http";
import { parseSitemap } from "@/lib/ingest/sitemap/parseSitemap";
import type { SitemapUrlEntry } from "@/lib/ingest/sitemap/types";
import { normalizeAbsoluteUrl, normalizeBaseUrl, toAbsoluteUrl } from "@/lib/ingest/sitemap/urlUtils";

type ResolveSitemapsParams = {
  baseUrl: string;
  sitemapOverride?: string | null;
  useDecodo?: boolean;
  maxUrls?: number;
  maxSitemaps?: number;
};

export type SitemapResolution = {
  baseUrl: string;
  robotsTxtUrl: string;
  sitemapUrlsUsed: string[];
  urls: SitemapUrlEntry[];
};

function parseRobotsSitemapUrls(robotsText: string, baseUrl: string): string[] {
  const lines = robotsText.split(/\r?\n/);
  const urls: string[] = [];
  for (const line of lines) {
    const match = line.match(/^\s*Sitemap:\s*(.+)\s*$/i);
    if (!match) continue;
    const absolute = toAbsoluteUrl(match[1], baseUrl);
    if (absolute) urls.push(absolute);
  }
  return urls;
}

async function fetchRobotsSitemaps(baseUrl: string, useDecodo: boolean): Promise<{ robotsTxtUrl: string; sitemapUrls: string[] }> {
  const robotsTxtUrl = `${baseUrl}/robots.txt`;
  try {
    const robots = await fetchTextWithRetry(robotsTxtUrl, {
      useDecodo,
      timeoutMs: 10_000,
      retries: 1,
      userAgent: "iBrainsBot/1.0 (+https://ibrains.ai; sitemap discovery)",
    });
    if (robots.status >= 400) {
      return { robotsTxtUrl, sitemapUrls: [] };
    }
    return { robotsTxtUrl, sitemapUrls: parseRobotsSitemapUrls(robots.body, baseUrl) };
  } catch {
    return { robotsTxtUrl, sitemapUrls: [] };
  }
}

async function probeCommonSitemaps(baseUrl: string, useDecodo: boolean): Promise<string[]> {
  const candidates = [
    "/sitemap.xml",
    "/sitemap_index.xml",
    "/sitemap-index.xml",
    "/sitemap/sitemap.xml",
  ];
  const found: string[] = [];
  for (const path of candidates) {
    const candidate = `${baseUrl}${path}`;
    try {
      const res = await fetchTextWithRetry(candidate, {
        useDecodo,
        timeoutMs: 8_000,
        retries: 1,
      });
      if (res.status < 400 && /<(?:urlset|sitemapindex)[\s>]/i.test(res.body)) {
        found.push(candidate);
      }
    } catch {
      // Ignore single probe failures.
    }
  }
  return found;
}

export async function resolveSitemaps(params: ResolveSitemapsParams): Promise<SitemapResolution> {
  const maxUrls = params.maxUrls ?? 5000;
  const maxSitemaps = params.maxSitemaps ?? 20;
  const useDecodo = params.useDecodo ?? false;
  const baseUrl = normalizeBaseUrl(params.baseUrl);

  const { robotsTxtUrl, sitemapUrls: robotsSitemaps } = await fetchRobotsSitemaps(baseUrl, useDecodo);
  const override = params.sitemapOverride ? normalizeAbsoluteUrl(params.sitemapOverride) : null;
  const probed = override ? [] : await probeCommonSitemaps(baseUrl, useDecodo);

  const queue = Array.from(
    new Set<string>([
      ...(override ? [override] : []),
      ...robotsSitemaps,
      ...probed,
    ])
  ).slice(0, maxSitemaps);

  if (!queue.length) {
    throw new Error("No sitemap discovered from robots.txt or common sitemap paths");
  }

  const visitedSitemaps = new Set<string>();
  const surfaces = new Map<string, SitemapUrlEntry>();
  let index = 0;
  while (index < queue.length && visitedSitemaps.size < maxSitemaps && surfaces.size < maxUrls) {
    const sitemapUrl = queue[index];
    index += 1;
    if (visitedSitemaps.has(sitemapUrl)) continue;
    visitedSitemaps.add(sitemapUrl);

    try {
      const parsed = await parseSitemap({
        sitemapUrl,
        useDecodo,
        maxUrls,
      });
      if (parsed.kind === "sitemapindex") {
        for (const nested of parsed.nestedSitemaps) {
          if (!visitedSitemaps.has(nested) && queue.length < maxSitemaps) queue.push(nested);
        }
      } else {
        for (const row of parsed.urls) {
          if (!surfaces.has(row.url)) surfaces.set(row.url, row);
          if (surfaces.size >= maxUrls) break;
        }
      }
    } catch {
      // Ignore malformed/failed sitemap URLs and continue with others.
    }
  }

  return {
    baseUrl,
    robotsTxtUrl,
    sitemapUrlsUsed: Array.from(visitedSitemaps),
    urls: Array.from(surfaces.values()),
  };
}
