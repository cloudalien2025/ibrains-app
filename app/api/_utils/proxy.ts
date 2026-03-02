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

function buildTargetUrl(req: NextRequest, base: string, targetPath: string): string {
  const path = targetPath.startsWith("/") ? targetPath : `/${targetPath}`;
  const url = new URL(`${base}${path}`);

  // Preserve query string
  req.nextUrl.searchParams.forEach((value, key) => url.searchParams.set(key, value));
  return url.toString();
}

function buildHeaders(
  req: NextRequest,
  requireAuth: boolean,
  apiKey?: string,
  userId?: string
): Headers {
  const headers = new Headers();

  // Forward content type if present
  const ct = req.headers.get("content-type");
  if (ct) headers.set("content-type", ct);

  // Always forward accept (helps with JSON)
  const accept = req.headers.get("accept");
  if (accept) headers.set("accept", accept);

  // Auth headers (server-side only)
  if (requireAuth && apiKey) {
    headers.set("X-Api-Key", apiKey);
    headers.set("X-User-Id", userId ?? "user_1");
  }

  return headers;
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
  let requestId: string | undefined;
  let targetUrl: string | undefined;

  try {
    const requireAuth = options.requireAuth ?? false;
    requestId = req.headers.get("x-request-id") ?? undefined;
    if (!requestId) {
      if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
        requestId = crypto.randomUUID();
      } else {
        requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      }
    }
    if (!targetPath || typeof targetPath !== "string") {
      return jsonError(
        "BAD_TARGET_PATH",
        "Target path must be a non-empty string",
        500
      );
    }

    const baseEnv = process.env.BRAINS_API_BASE;
    if (!baseEnv || !baseEnv.trim()) {
      return jsonError(
        "CONFIG_ERROR",
        "BRAINS_API_BASE not configured",
        500
      );
    }

    let baseUrl: URL;
    try {
      baseUrl = new URL(baseEnv);
    } catch {
      return jsonError(
        "CONFIG_ERROR",
        "BRAINS_API_BASE invalid",
        500
      );
    }

    const normalizedBase = baseUrl.toString().replace(/\/+$/, "");
    const normalizedTargetPath = targetPath.startsWith("/")
      ? targetPath
      : `/${targetPath}`;

    try {
      targetUrl = buildTargetUrl(req, normalizedBase, normalizedTargetPath);
    } catch {
      return jsonError(
        "URL_BUILD_FAILED",
        "Failed to build upstream URL",
        500
      );
    }

    let apiKey: string | undefined;
    let userId: string | undefined;
    if (requireAuth) {
      const isWorkerPath =
        normalizedTargetPath.startsWith("/v1/brains/") ||
        normalizedTargetPath.startsWith("/v1/runs/");

      if (isWorkerPath) {
        apiKey = process.env.BRAINS_WORKER_API_KEY;
        if (!apiKey) {
          return jsonError(
            "KEY_MISSING",
            "Worker API key not configured",
            500
          );
        }
      } else {
        apiKey = process.env.BRAINS_MASTER_KEY || process.env.BRAINS_X_API_KEY;
        if (!apiKey) {
          return jsonError(
            "KEY_MISSING",
            "API key not configured",
            500
          );
        }
      }
      userId = process.env.BRAINS_USER_ID ?? "user_1";
    }

    const headers = buildHeaders(req, requireAuth, apiKey, userId);
    headers.delete("content-length");

    const method = req.method.toUpperCase();
    let body: BodyInit | undefined;
    if (method !== "GET" && method !== "HEAD") {
      let raw = "";
      try {
        raw = await req.text();
      } catch {
        raw = "";
      }
      const bodyText = raw && raw.trim().length ? raw : "{}";
      if (!headers.has("content-type")) {
        headers.set("content-type", "application/json");
      }
      body = bodyText;
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
  } catch (e: any) {
    console.error("PROXY_UNEXPECTED_ERROR", {
      method: req.method,
      targetPath,
      requestId,
      upstreamUrl: targetUrl,
      name: e?.name,
      message: e?.message ?? String(e),
      stack: e?.stack,
    });
    return jsonError("PROXY_UNEXPECTED_ERROR", "Unexpected proxy error", 500);
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
    const baseEnv = process.env.BRAINS_API_BASE;
    if (!baseEnv || !baseEnv.trim()) {
      return { upstreamOk: false, upstreamError: "BRAINS_API_BASE not configured" };
    }

    let baseUrl: URL;
    try {
      baseUrl = new URL(baseEnv);
    } catch {
      return { upstreamOk: false, upstreamError: "BRAINS_API_BASE invalid" };
    }

    const normalizedBase = baseUrl.toString().replace(/\/+$/, "");
    const normalizedTargetPath = targetPath.startsWith("/")
      ? targetPath
      : `/${targetPath}`;
    targetUrl = buildTargetUrl(req, normalizedBase, normalizedTargetPath);
  } catch (e: any) {
    return { upstreamOk: false, upstreamError: e?.message ?? "Bad proxy config" };
  }

  let apiKey: string | undefined;
  let userId: string | undefined;
  if (requireAuth) {
    const normalizedTargetPath = targetPath.startsWith("/")
      ? targetPath
      : `/${targetPath}`;
    const isWorkerPath =
      normalizedTargetPath.startsWith("/v1/brains/") ||
      normalizedTargetPath.startsWith("/v1/runs/");
    if (isWorkerPath) {
      apiKey = process.env.BRAINS_WORKER_API_KEY;
      if (!apiKey) {
        return { upstreamOk: false, upstreamError: "Worker API key not configured" };
      }
    } else {
      apiKey = process.env.BRAINS_MASTER_KEY || process.env.BRAINS_X_API_KEY;
      if (!apiKey) {
        return { upstreamOk: false, upstreamError: "API key not configured" };
      }
    }
    userId = process.env.BRAINS_USER_ID ?? "user_1";
  }

  const headers = buildHeaders(req, requireAuth, apiKey, userId);

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
