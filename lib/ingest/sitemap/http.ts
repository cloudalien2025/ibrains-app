import { setTimeout as sleep } from "timers/promises";

type FetchTextOptions = {
  timeoutMs?: number;
  retries?: number;
  useDecodo?: boolean;
  userAgent?: string;
};

const DEFAULT_UA =
  "iBrainsBot/1.0 (+https://ibrains.ai; AI discovery snapshot)";

let decodoDispatcherPromise: Promise<unknown | null> | null = null;

async function getDecodoDispatcher(): Promise<unknown | null> {
  if (!process.env.DECODO_PROXY_URL) return null;
  if (!decodoDispatcherPromise) {
    decodoDispatcherPromise = (async () => {
      try {
        const req = (0, eval)("require") as (id: string) => any;
        const undici = req("undici");
        return new undici.ProxyAgent(process.env.DECODO_PROXY_URL as string);
      } catch {
        return null;
      }
    })();
  }
  return decodoDispatcherPromise;
}

export async function fetchTextWithRetry(url: string, options: FetchTextOptions = {}): Promise<{ status: number; body: string; finalUrl: string }> {
  const timeoutMs = options.timeoutMs ?? 15_000;
  const retries = options.retries ?? 2;
  const userAgent = options.userAgent ?? DEFAULT_UA;
  const useDecodo = options.useDecodo ?? false;

  let lastError: unknown = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const dispatcher =
        useDecodo || process.env.DECODO_ENABLED_DEFAULT === "true"
          ? await getDecodoDispatcher()
          : null;
      const res = await fetch(url, {
        method: "GET",
        redirect: "follow",
        signal: controller.signal,
        headers: {
          "user-agent": userAgent,
          accept: "text/html,application/xml,text/plain;q=0.9,*/*;q=0.8",
        },
        ...(dispatcher ? ({ dispatcher } as { dispatcher: unknown }) : {}),
      });
      const body = await res.text();
      clearTimeout(timer);
      return {
        status: res.status,
        body,
        finalUrl: res.url,
      };
    } catch (error) {
      clearTimeout(timer);
      lastError = error;
      if (attempt < retries) {
        await sleep((attempt + 1) * 300);
        continue;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("fetch failed");
}

export async function fetchBufferWithRetry(url: string, options: FetchTextOptions = {}): Promise<{ status: number; body: Buffer; finalUrl: string }> {
  const timeoutMs = options.timeoutMs ?? 15_000;
  const retries = options.retries ?? 2;
  const userAgent = options.userAgent ?? DEFAULT_UA;
  const useDecodo = options.useDecodo ?? false;

  let lastError: unknown = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const dispatcher =
        useDecodo || process.env.DECODO_ENABLED_DEFAULT === "true"
          ? await getDecodoDispatcher()
          : null;
      const res = await fetch(url, {
        method: "GET",
        redirect: "follow",
        signal: controller.signal,
        headers: {
          "user-agent": userAgent,
          accept: "application/xml,text/xml,text/plain,*/*",
        },
        ...(dispatcher ? ({ dispatcher } as { dispatcher: unknown }) : {}),
      });
      const body = Buffer.from(await res.arrayBuffer());
      clearTimeout(timer);
      return { status: res.status, body, finalUrl: res.url };
    } catch (error) {
      clearTimeout(timer);
      lastError = error;
      if (attempt < retries) {
        await sleep((attempt + 1) * 300);
        continue;
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error("fetch failed");
}
