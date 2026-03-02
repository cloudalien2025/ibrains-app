import { fetchTextWithRetry } from "@/lib/ingest/sitemap/http";
import { classifySurfaceType } from "@/lib/ingest/sitemap/classifySurfaceType";
import { extractPageSignals } from "@/lib/ingest/sitemap/extractPageSignals";
import type { CrawlSurfaceResult, SitemapUrlEntry } from "@/lib/ingest/sitemap/types";
import { sameHost } from "@/lib/ingest/sitemap/urlUtils";

type CrawlSurfacesParams = {
  baseUrl: string;
  urls: SitemapUrlEntry[];
  respectRobots: boolean;
  useDecodo?: boolean;
  maxPages?: number;
  concurrency?: number;
  delayMs?: number;
  onProgress?: (done: number, total: number) => Promise<void> | void;
};

type RobotsPolicy = {
  disallow: string[];
};

function normalizeRobotsPath(path: string): string {
  const value = path.trim();
  if (!value) return "";
  if (!value.startsWith("/")) return `/${value}`;
  return value;
}

function parseRobotsPolicy(robotsText: string): RobotsPolicy {
  const lines = robotsText.split(/\r?\n/).map((line) => line.trim());
  let inWildcard = false;
  const disallow: string[] = [];
  for (const line of lines) {
    if (!line || line.startsWith("#")) continue;
    const ua = line.match(/^user-agent:\s*(.+)$/i);
    if (ua) {
      inWildcard = ua[1].trim() === "*";
      continue;
    }
    if (!inWildcard) continue;
    const dis = line.match(/^disallow:\s*(.*)$/i);
    if (dis) {
      const path = normalizeRobotsPath(dis[1]);
      if (path && path !== "/") disallow.push(path);
    }
  }
  return { disallow };
}

function isBlockedByRobots(url: string, policy: RobotsPolicy): boolean {
  try {
    const pathname = new URL(url).pathname;
    return policy.disallow.some((prefix) => pathname.startsWith(prefix));
  } catch {
    return true;
  }
}

async function loadRobotsPolicy(baseUrl: string, useDecodo: boolean): Promise<RobotsPolicy> {
  try {
    const robots = await fetchTextWithRetry(`${baseUrl}/robots.txt`, {
      useDecodo,
      timeoutMs: 10_000,
      retries: 1,
    });
    if (robots.status >= 400) return { disallow: [] };
    return parseRobotsPolicy(robots.body);
  } catch {
    return { disallow: [] };
  }
}

export async function crawlSurfaces(params: CrawlSurfacesParams): Promise<CrawlSurfaceResult[]> {
  const maxPages = params.maxPages ?? 150;
  const concurrency = Math.max(1, Math.min(6, params.concurrency ?? 4));
  const delayMs = Math.max(100, Math.min(1000, params.delayMs ?? 300));
  const useDecodo = params.useDecodo ?? false;

  const robots = params.respectRobots ? await loadRobotsPolicy(params.baseUrl, useDecodo) : { disallow: [] };
  const queue = params.urls
    .filter((row) => sameHost(row.url, params.baseUrl))
    .filter((row) => !params.respectRobots || !isBlockedByRobots(row.url, robots))
    .slice(0, maxPages);

  const results: CrawlSurfaceResult[] = [];
  let cursor = 0;
  let done = 0;

  async function worker(): Promise<void> {
    while (true) {
      const idx = cursor;
      cursor += 1;
      if (idx >= queue.length) return;
      const row = queue[idx];
      try {
        const signals = await extractPageSignals({
          url: row.url,
          baseUrl: params.baseUrl,
          useDecodo,
        });
        const type = classifySurfaceType(row.url, signals?.jsonldBlobs ?? []);
        results.push({
          url: row.url,
          lastmod: row.lastmod,
          type,
          signals,
        });
      } catch {
        results.push({
          url: row.url,
          lastmod: row.lastmod,
          type: classifySurfaceType(row.url, []),
          signals: null,
        });
      } finally {
        done += 1;
        await params.onProgress?.(done, queue.length);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return results;
}
