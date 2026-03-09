import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const DIRECTORYIQ_CORS_ORIGIN = "https://app.ibrains.ai";

export function middleware(req: NextRequest) {
  if (
    req.nextUrl.pathname.startsWith("/api/directoryiq") ||
    req.nextUrl.pathname.startsWith("/api/ingest/directoryiq")
  ) {
    const origin = req.headers.get("origin");
    const isAllowedOrigin = origin === DIRECTORYIQ_CORS_ORIGIN;

    if (isAllowedOrigin && req.method === "OPTIONS") {
      const headers = new Headers();
      headers.set("Access-Control-Allow-Origin", DIRECTORYIQ_CORS_ORIGIN);
      headers.set("Access-Control-Allow-Credentials", "true");
      headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
      headers.set("Access-Control-Allow-Headers", req.headers.get("access-control-request-headers") ?? "Content-Type, Authorization");
      headers.set("Access-Control-Max-Age", "86400");
      headers.set("Vary", "Origin");
      return new NextResponse(null, { status: 204, headers });
    }

    const response = NextResponse.next();
    if (isAllowedOrigin) {
      response.headers.set("Access-Control-Allow-Origin", DIRECTORYIQ_CORS_ORIGIN);
      response.headers.set("Access-Control-Allow-Credentials", "true");
      response.headers.set("Vary", "Origin");
    }
    return response;
  }

  if (req.nextUrl.pathname === "/api/_meta/release") {
    const url = req.nextUrl.clone();
    url.pathname = "/api/meta/release";
    return NextResponse.rewrite(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/api/_meta/release", "/api/directoryiq/:path*", "/api/ingest/directoryiq/:path*"],
};
