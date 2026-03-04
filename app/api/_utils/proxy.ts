// app/api/_utils/proxy.ts
import { NextRequest, NextResponse } from "next/server";

type ProxyOptions = {
  requireAuth?: boolean;
};

type NormalizedError = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

const DEFAULT_TIMEOUT_MS = 8000;

function env(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function buildTargetUrl(req: NextRequest, targetPath: string): string {
  const base = (process.env.BRAINS_API_BASE ?? "https://api.ibrains.ai").replace(/\/+$/, "");
  const path = targetPath.startsWith("/") ? targetPath : `/${targetPath}`;
  const url = new URL(`${base}${path}`);

  // Preserve query string
  req.nextUrl.searchParams.forEach((value, key) => url.searchParams.set(key, value));
  return url.toString();
}

function buildHeaders(req: NextRequest, requireAuth: boolean): Headers {
  const headers = new Headers();

  // Forward content type if present
  const ct = req.headers.get("content-type");
  if (ct) headers.set("content-type", ct);

  // Always forward accept (helps with JSON)
  const accept = req.headers.get("accept");
  if (accept) headers.set("accept", accept);

  // Auth headers (server-side only)
  if (requireAuth) {
    const apiKey = env("BRAINS_X_API_KEY");
    const userId = process.env.BRAINS_USER_ID ?? "user_1";
    headers.set("X-Api-Key", apiKey);
    headers.set("X-User-Id", userId);
  }

  return headers;
}

async function readBody(req: NextRequest): Promise<BodyInit | undefined> {
  // GET/HEAD have no body
  if (req.method === "GET" || req.method === "HEAD") return undefined;

  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const json = await req.json().catch(() => null);
    return json ? JSON.stringify(json) : undefined;
  }

  // For form bodies or anything else, pass through raw bytes
  const buf = await req.arrayBuffer().catch(() => null);
  return buf ? Buffer.from(buf) : undefined;
}

function buildError(code: string, message: string, details?: unknown): NormalizedError {
  return { error: { code, message, ...(details ? { details } : {}) } };
}

export function jsonError(
  code: string,
  message: string,
  status: number,
  details?: unknown
): NextResponse {
  return NextResponse.json(buildError(code, message, details), { status });
}

function withTimeout(ms: number): { signal: AbortSignal; cancel: () => void } {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort("timeout"), ms);
  return {
    signal: controller.signal,
    cancel: () => clearTimeout(id),
  };
}

async function readUpstreamBody(upstream: Response): Promise<unknown> {
  const upstreamContentType = upstream.headers.get("content-type") ?? "";
  if (upstreamContentType.includes("application/json")) {
    return upstream.json().catch(() => null);
  }
  const text = await upstream.text().catch(() => "");
  return text ? text.slice(0, 2000) : "";
}

export async function proxyToBrains(
  req: NextRequest,
  targetPath: string,
  options: ProxyOptions = {}
): Promise<NextResponse> {
  const requireAuth = options.requireAuth ?? false;

  let targetUrl: string;
  try {
    targetUrl = buildTargetUrl(req, targetPath);
  } catch (e: any) {
    return jsonError(
      "BAD_PROXY_CONFIG",
      e?.message ?? "Bad proxy config",
      500
    );
  }

  const headers = buildHeaders(req, requireAuth);

  let body: BodyInit | undefined;
  try {
    body = await readBody(req);
  } catch {
    // ignore body parse errors; backend will respond accordingly
    body = undefined;
  }

  try {
    const { signal, cancel } = withTimeout(DEFAULT_TIMEOUT_MS);
    let upstream: Response;
    try {
      upstream = await fetch(targetUrl, {
        method: req.method,
        headers,
        body,
        // NOTE: NextRequest has already been parsed; we don't forward cookies
        redirect: "manual",
        cache: "no-store",
        signal,
      });
    } finally {
      cancel();
    }

    // Pass through JSON if possible; otherwise return text
    const upstreamContentType = upstream.headers.get("content-type") ?? "";
    const status = upstream.status;

    if (!upstream.ok) {
      const bodyPayload = await readUpstreamBody(upstream);
      return jsonError(
        "UPSTREAM_ERROR",
        `Upstream responded with ${status}`,
        status,
        {
          status,
          statusText: upstream.statusText,
          body: bodyPayload,
          requestId: upstream.headers.get("x-request-id") ?? undefined,
        }
      );
    }

    if (upstreamContentType.includes("application/json")) {
      const data = await upstream.json().catch(() => null);
      if (!data) {
        return jsonError(
          "UPSTREAM_INVALID_JSON",
          "Invalid JSON from upstream",
          502
        );
      }
      return NextResponse.json(data, { status });
    }

    const text = await upstream.text().catch(() => "");
    return new NextResponse(text, {
      status,
      headers: {
        "content-type": upstreamContentType || "text/plain; charset=utf-8",
      },
    });
  } catch (e: any) {
    if (e?.name === "AbortError") {
      return jsonError(
        "UPSTREAM_TIMEOUT",
        "Upstream request timed out",
        504
      );
    }
    return jsonError(
      "UPSTREAM_FETCH_FAILED",
      e?.message ?? "Upstream fetch failed",
      502
    );
  }
}

export async function probeBrains(
  req: NextRequest,
  targetPath: string,
  options: ProxyOptions = {}
): Promise<{ upstreamOk: boolean; upstreamError?: string; requestId?: string }> {
  const requireAuth = options.requireAuth ?? false;

  let targetUrl: string;
  try {
    targetUrl = buildTargetUrl(req, targetPath);
  } catch (e: any) {
    return { upstreamOk: false, upstreamError: e?.message ?? "Bad proxy config" };
  }

  const headers = buildHeaders(req, requireAuth);

  try {
    const { signal, cancel } = withTimeout(DEFAULT_TIMEOUT_MS);
    let upstream: Response;
    try {
      upstream = await fetch(targetUrl, {
        method: "GET",
        headers,
        redirect: "manual",
        cache: "no-store",
        signal,
      });
    } finally {
      cancel();
    }

    if (upstream.ok) {
      return {
        upstreamOk: true,
        requestId: upstream.headers.get("x-request-id") ?? undefined,
      };
    }

    const bodyPayload = await readUpstreamBody(upstream);
    const bodyText =
      typeof bodyPayload === "string" ? bodyPayload : JSON.stringify(bodyPayload);
    return {
      upstreamOk: false,
      upstreamError: bodyText
        ? `HTTP ${upstream.status}: ${bodyText.slice(0, 500)}`
        : `HTTP ${upstream.status}`,
      requestId: upstream.headers.get("x-request-id") ?? undefined,
    };
  } catch (e: any) {
    if (e?.name === "AbortError") {
      return { upstreamOk: false, upstreamError: "Upstream request timed out" };
    }
    return {
      upstreamOk: false,
      upstreamError: e?.message ?? "Upstream fetch failed",
    };
  }
}

export function unexpectedErrorResponse(): NextResponse {
  return jsonError("UNHANDLED_ERROR", "Unexpected server error", 500);
}
