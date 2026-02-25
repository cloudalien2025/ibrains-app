// app/api/_utils/proxy.ts
import { NextRequest, NextResponse } from "next/server";

type ProxyOptions = {
  requireAuth?: boolean;
};

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
    return NextResponse.json(
      { status: "error", message: e?.message ?? "Bad proxy config" },
      { status: 500 }
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
    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
      // NOTE: NextRequest has already been parsed; we don't forward cookies
      redirect: "manual",
      cache: "no-store",
    });

    // Pass through JSON if possible; otherwise return text
    const upstreamContentType = upstream.headers.get("content-type") ?? "";
    const status = upstream.status;

    if (upstreamContentType.includes("application/json")) {
      const data = await upstream.json().catch(() => null);
      return NextResponse.json(data ?? { status: "error", message: "Invalid JSON from upstream" }, {
        status,
      });
    }

    const text = await upstream.text().catch(() => "");
    return new NextResponse(text, {
      status,
      headers: {
        "content-type": upstreamContentType || "text/plain; charset=utf-8",
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { status: "error", message: e?.message ?? "Upstream fetch failed" },
      { status: 502 }
    );
  }
}