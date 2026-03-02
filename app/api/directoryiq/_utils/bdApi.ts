import { URL } from "url";

export class BdApiError extends Error {}

export function normalizeBdBaseUrl(baseUrl: string): string {
  const raw = String(baseUrl ?? "").trim();
  if (!raw) throw new BdApiError("Base URL is required");

  const withProtocol = raw.includes("://") ? raw : `https://${raw}`;
  const parsed = new URL(withProtocol);
  const netloc = parsed.host.toLowerCase();
  if (!netloc || (netloc.includes("none") && netloc.endsWith("none"))) {
    throw new BdApiError("Base URL appears malformed (possible concatenation bug)");
  }

  parsed.hash = "";
  parsed.search = "";
  parsed.pathname = parsed.pathname.replace(/\/$/, "");
  return parsed.toString().replace(/\/$/, "");
}

export function buildBdApiUrl(baseUrl: string, path: string): string {
  const normalizedBase = normalizeBdBaseUrl(baseUrl);
  const normalizedPath = `/${String(path ?? "").replace(/^\/+/, "")}`;
  return new URL(normalizedPath, `${normalizedBase}/`).toString();
}

export function bdAuthHeaders(apiKey: string, isForm = false): Record<string, string> {
  const headers: Record<string, string> = {
    "X-Api-Key": apiKey,
    Accept: "application/json",
  };
  if (isForm) headers["Content-Type"] = "application/x-www-form-urlencoded";
  return headers;
}

export function parseBdRecords(payload: unknown): Array<Record<string, unknown>> {
  if (!payload) return [];
  if (Array.isArray(payload)) {
    return payload.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"));
  }
  if (typeof payload !== "object") return [];

  const candidate = payload as Record<string, unknown>;
  const message = candidate.message;
  if (Array.isArray(message)) {
    return message.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"));
  }

  const data = candidate.data;
  if (Array.isArray(data)) {
    return data.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"));
  }

  const records = candidate.records;
  if (Array.isArray(records)) {
    return records.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"));
  }

  return [];
}

export function parseBdTotals(payload: unknown): { totalPages: number | null; totalPosts: number | null; status: string } {
  if (!payload || typeof payload !== "object") {
    return { totalPages: null, totalPosts: null, status: "" };
  }
  const candidate = payload as Record<string, unknown>;
  const status = typeof candidate.status === "string" ? candidate.status.toLowerCase() : "";
  const totalPagesRaw = Number(candidate.total_pages ?? candidate.totalPages ?? null);
  const totalPostsRaw = Number(candidate.total_posts ?? candidate.totalPosts ?? null);

  return {
    status,
    totalPages: Number.isFinite(totalPagesRaw) && totalPagesRaw > 0 ? totalPagesRaw : null,
    totalPosts: Number.isFinite(totalPostsRaw) && totalPostsRaw >= 0 ? totalPostsRaw : null,
  };
}

function formEncode(body: Record<string, unknown>): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(body)) {
    if (value == null) continue;
    params.set(key, String(value));
  }
  return params;
}

export async function bdRequestForm(params: {
  baseUrl: string;
  apiKey: string;
  method: "POST" | "PUT";
  path: string;
  form: Record<string, unknown>;
  timeoutMs?: number;
}): Promise<{ ok: boolean; status: number; json: Record<string, unknown> | null; text: string }> {
  const timeoutMs = params.timeoutMs ?? 20000;
  const url = buildBdApiUrl(params.baseUrl, params.path);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: params.method,
      headers: bdAuthHeaders(params.apiKey, true),
      body: formEncode(params.form),
      cache: "no-store",
      signal: controller.signal,
    });

    const text = await response.text();
    let json: Record<string, unknown> | null = null;
    try {
      json = text ? (JSON.parse(text) as Record<string, unknown>) : null;
    } catch {
      json = null;
    }

    return {
      ok: response.ok,
      status: response.status,
      json,
      text,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function bdRequestGet(params: {
  baseUrl: string;
  apiKey: string;
  path: string;
  timeoutMs?: number;
}): Promise<{ ok: boolean; status: number; json: Record<string, unknown> | null; text: string }> {
  const timeoutMs = params.timeoutMs ?? 20000;
  const url = buildBdApiUrl(params.baseUrl, params.path);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: bdAuthHeaders(params.apiKey, false),
      cache: "no-store",
      signal: controller.signal,
    });

    const text = await response.text();
    let json: Record<string, unknown> | null = null;
    try {
      json = text ? (JSON.parse(text) as Record<string, unknown>) : null;
    } catch {
      json = null;
    }

    return {
      ok: response.ok,
      status: response.status,
      json,
      text,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function bdRequestWithRetry(
  fn: () => Promise<{ ok: boolean; status: number; json: Record<string, unknown> | null; text: string }>,
  maxAttempts = 2
): Promise<{ ok: boolean; status: number; json: Record<string, unknown> | null; text: string }> {
  let attempt = 0;
  let last: { ok: boolean; status: number; json: Record<string, unknown> | null; text: string } | null = null;
  while (attempt < maxAttempts) {
    attempt += 1;
    const result = await fn();
    last = result;
    const shouldRetry = result.status === 429 || (result.status >= 500 && result.status <= 599);
    if (!shouldRetry || attempt >= maxAttempts) return result;
    await new Promise((resolve) => setTimeout(resolve, 600 * attempt));
  }
  if (!last) throw new BdApiError("No response received from BD API");
  return last;
}
