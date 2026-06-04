import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export type FirecrawlResultSource = "live" | "cache" | "fixture";

export interface FirecrawlClientConfig {
  apiKey?: string;
  enabled?: boolean;
  apiBaseUrl?: string;
  timeoutMs?: number;
  retries?: number;
  cacheDir?: string;
  fixtureDir?: string;
  allowLiveRequests?: boolean;
}

export interface FirecrawlJsonFormat {
  type: "json";
  prompt?: string;
  schema?: Record<string, unknown>;
}

export type FirecrawlFormat = "markdown" | "html" | FirecrawlJsonFormat;

export interface FirecrawlScrapeOptions {
  url: string;
  formats: FirecrawlFormat[];
  timeoutMs?: number;
  useCache?: boolean;
  useFixture?: boolean;
  parsers?: Array<"pdf">;
  onlyMainContent?: boolean;
}

export interface FirecrawlMapOptions {
  url: string;
  search?: string;
  limit?: number;
  useCache?: boolean;
  useFixture?: boolean;
}

export interface FirecrawlScrapeResponse {
  source: FirecrawlResultSource;
  url: string;
  markdown: string | null;
  html: string | null;
  json: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  fetchedAt: string;
}

export interface FirecrawlMapResponse {
  source: FirecrawlResultSource;
  url: string;
  links: string[];
  fetchedAt: string;
}

interface FirecrawlApiEnvelope {
  success?: boolean;
  data?: Record<string, unknown>;
  error?: unknown;
}

const DEFAULT_API_BASE = "https://api.firecrawl.dev/v2";
const DEFAULT_TIMEOUT_MS = 30_000;

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error || "Unknown error");
}

function sanitizeForKey(input: string): string {
  return input.trim().toLowerCase();
}

function stableJson(value: unknown): string {
  if (value == null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((entry) => stableJson(entry)).join(",")}]`;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`;
}

function sha(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function cachePathFromKey(cacheDir: string, key: string): string {
  return path.join(cacheDir, `${key}.json`);
}

async function readJsonIfExists<T>(absolutePath: string): Promise<T | null> {
  try {
    const body = await fs.readFile(absolutePath, "utf8");
    return JSON.parse(body) as T;
  } catch {
    return null;
  }
}

function requireApiKey(config: FirecrawlClientConfig): string {
  const key = config.apiKey || process.env.FIRECRAWL_API_KEY || "";
  if (!key.trim()) {
    throw new Error("FIRECRAWL_API_KEY is required for live Firecrawl requests.");
  }
  return key.trim();
}

async function withTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function requestWithRetry(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  retries: number
): Promise<Response> {
  let attempt = 0;
  let lastError: unknown = null;
  while (attempt <= retries) {
    try {
      const response = await withTimeout(url, init, timeoutMs);
      if (response.status === 429 || response.status >= 500) {
        if (attempt >= retries) return response;
        const backoff = 250 * (attempt + 1);
        await new Promise((resolve) => setTimeout(resolve, backoff));
        attempt += 1;
        continue;
      }
      return response;
    } catch (error) {
      lastError = error;
      if (attempt >= retries) {
        throw error;
      }
      const backoff = 250 * (attempt + 1);
      await new Promise((resolve) => setTimeout(resolve, backoff));
      attempt += 1;
    }
  }

  throw new Error(`Firecrawl request failed: ${toErrorMessage(lastError)}`);
}

export function createFirecrawlCacheKey(input: {
  mode: "scrape" | "map";
  url: string;
  formats?: FirecrawlFormat[];
  parsers?: string[];
  schema?: Record<string, unknown> | null;
  search?: string;
  limit?: number;
}): string {
  const seed = stableJson({
    mode: input.mode,
    url: sanitizeForKey(input.url),
    formats: input.formats || [],
    parsers: input.parsers || [],
    schema: input.schema || null,
    search: input.search || null,
    limit: input.limit || null,
  });
  return sha(seed);
}

export class FirecrawlClient {
  private readonly config: Required<Omit<FirecrawlClientConfig, "apiKey">> & { apiKey?: string };

  constructor(config: FirecrawlClientConfig = {}) {
    this.config = {
      apiKey: config.apiKey,
      enabled: config.enabled ?? process.env.ECOMVIPER_SUPPLIER_FIRECRAWL_ENABLED !== "0",
      apiBaseUrl: (config.apiBaseUrl || DEFAULT_API_BASE).replace(/\/+$/, ""),
      timeoutMs: config.timeoutMs ?? Number.parseInt(process.env.ECOMVIPER_SUPPLIER_FIRECRAWL_TIMEOUT_MS || "30000", 10),
      retries: config.retries ?? 2,
      cacheDir:
        config.cacheDir
        || process.env.ECOMVIPER_SUPPLIER_FIRECRAWL_CACHE_DIR
        || path.join(process.cwd(), ".cache/firecrawl"),
      fixtureDir: config.fixtureDir || path.join(process.cwd(), "data/ecomviper/suppliers/rocktomic/fixtures/firecrawl"),
      allowLiveRequests: config.allowLiveRequests ?? false,
    };
  }

  async scrape(options: FirecrawlScrapeOptions): Promise<FirecrawlScrapeResponse> {
    const cacheKey = createFirecrawlCacheKey({
      mode: "scrape",
      url: options.url,
      formats: options.formats,
      parsers: options.parsers,
      schema: (options.formats.find((entry) => typeof entry === "object" && entry.type === "json") as FirecrawlJsonFormat | undefined)?.schema || null,
    });

    const useCache = options.useCache ?? true;
    if (useCache) {
      const cached = await this.readFromCache<FirecrawlScrapeResponse>(cacheKey);
      if (cached) return { ...cached, source: "cache" };
    }

    if (options.useFixture) {
      const fixture = await this.readFixture<FirecrawlScrapeResponse>(cacheKey);
      if (!fixture) {
        throw new Error(`Firecrawl fixture not found for scrape key ${cacheKey}`);
      }
      return { ...fixture, source: "fixture" };
    }

    if (!this.config.enabled || !this.config.allowLiveRequests) {
      throw new Error("Firecrawl live requests are disabled. Enable via ECOMVIPER_SUPPLIER_FIRECRAWL_ENABLED and live mode.");
    }

    const apiKey = requireApiKey(this.config);
    const response = await requestWithRetry(
      `${this.config.apiBaseUrl}/scrape`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          url: options.url,
          formats: options.formats,
          timeout: options.timeoutMs ?? this.config.timeoutMs,
          parsers: options.parsers,
          onlyMainContent: options.onlyMainContent ?? true,
          storeInCache: true,
        }),
      },
      options.timeoutMs ?? this.config.timeoutMs,
      this.config.retries
    );

    if (!response.ok) {
      throw new Error(`Firecrawl scrape failed (${response.status})`);
    }

    const payload = (await response.json()) as FirecrawlApiEnvelope;
    if (!payload?.data || payload.success === false) {
      throw new Error(`Firecrawl scrape returned no data: ${stableJson(payload?.error || payload)}`);
    }

    const data = payload.data;
    const result: FirecrawlScrapeResponse = {
      source: "live",
      url: options.url,
      markdown: typeof data.markdown === "string" ? data.markdown : null,
      html: typeof data.html === "string" ? data.html : null,
      json: typeof data.json === "object" && data.json && !Array.isArray(data.json) ? data.json as Record<string, unknown> : null,
      metadata: typeof data.metadata === "object" && data.metadata && !Array.isArray(data.metadata) ? data.metadata as Record<string, unknown> : {},
      fetchedAt: new Date().toISOString(),
    };

    if (useCache) await this.writeToCache(cacheKey, result);
    return result;
  }

  async map(options: FirecrawlMapOptions): Promise<FirecrawlMapResponse> {
    const cacheKey = createFirecrawlCacheKey({
      mode: "map",
      url: options.url,
      search: options.search,
      limit: options.limit,
    });

    const useCache = options.useCache ?? true;
    if (useCache) {
      const cached = await this.readFromCache<FirecrawlMapResponse>(cacheKey);
      if (cached) return { ...cached, source: "cache" };
    }

    if (options.useFixture) {
      const fixture = await this.readFixture<FirecrawlMapResponse>(cacheKey);
      if (!fixture) {
        throw new Error(`Firecrawl fixture not found for map key ${cacheKey}`);
      }
      return { ...fixture, source: "fixture" };
    }

    if (!this.config.enabled || !this.config.allowLiveRequests) {
      throw new Error("Firecrawl live requests are disabled. Enable via ECOMVIPER_SUPPLIER_FIRECRAWL_ENABLED and live mode.");
    }

    const apiKey = requireApiKey(this.config);
    const response = await requestWithRetry(
      `${this.config.apiBaseUrl}/map`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          url: options.url,
          search: options.search,
          limit: options.limit,
        }),
      },
      this.config.timeoutMs,
      this.config.retries
    );

    if (!response.ok) {
      throw new Error(`Firecrawl map failed (${response.status})`);
    }

    const payload = (await response.json()) as FirecrawlApiEnvelope;
    const data = payload.data || {};
    const links = Array.isArray(data.links)
      ? data.links.filter((entry): entry is string => typeof entry === "string")
      : [];

    const result: FirecrawlMapResponse = {
      source: "live",
      url: options.url,
      links,
      fetchedAt: new Date().toISOString(),
    };

    if (useCache) await this.writeToCache(cacheKey, result);
    return result;
  }

  private async readFromCache<T>(cacheKey: string): Promise<T | null> {
    const cachePath = cachePathFromKey(this.config.cacheDir, cacheKey);
    return await readJsonIfExists<T>(cachePath);
  }

  private async writeToCache<T>(cacheKey: string, payload: T): Promise<void> {
    await fs.mkdir(this.config.cacheDir, { recursive: true });
    const cachePath = cachePathFromKey(this.config.cacheDir, cacheKey);
    await fs.writeFile(cachePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  }

  private async readFixture<T>(cacheKey: string): Promise<T | null> {
    const fixturePath = path.join(this.config.fixtureDir, `${cacheKey}.json`);
    return await readJsonIfExists<T>(fixturePath);
  }
}
