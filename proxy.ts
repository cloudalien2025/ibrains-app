import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextFetchEvent, NextRequest } from "next/server";
import {
  buildClerkProductionConfigError,
  resolveClerkRouteContract,
  resolveClerkRuntimeContract,
} from "@/lib/auth/clerkEnvContract";

const DIRECTORYIQ_CORS_ORIGIN = "https://app.ibrains.ai";
const APP_BASE_URL_FALLBACK = "https://app.ibrains.ai";

const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/tasks(.*)",
  "/reports(.*)",
  "/add-brain(.*)",
  "/settings(.*)",
  "/billing(.*)",
  "/ecomviper(.*)",
  "/optibay(.*)",
  "/optiwal(.*)",
  "/optizon(.*)",
  "/directoryiq(.*)",
  "/casaflix(.*)",
  "/pagebolt(.*)",
  "/reelify(.*)",
  "/ipetzo(.*)",
  "/api/ecomviper(.*)",
  "/brains(.*)",
  "/runs(.*)",
  "/mission-control(.*)",
]);

const e2eMockGraph = process.env.E2E_MOCK_GRAPH === "1";
const clerkRuntimeContract = resolveClerkRuntimeContract();
const clerkRouteContract = resolveClerkRouteContract();
const isClerkConfigured = clerkRuntimeContract.configuredForProxy;
const trustedIngestPathRegex = /^\/api\/brains\/[^/]+\/ingest$/;
const trustedRetrievePathRegex = /^\/api\/brains\/[^/]+\/retrieve$/;
const trustedRunStatusPathRegex = /^\/api\/runs\/[^/]+$/;
const deprecatedLegacyRouteRegex = /^\/(?:apps(?:\/.*)?|studio(?:\/.*)?|siteforge(?:\/.*)?|uapforge(?:\/.*)?)$/;

function resolveAppBaseUrlOrigin(): string {
  const configured = process.env.APP_BASE_URL?.trim();
  if (!configured) return APP_BASE_URL_FALLBACK;

  try {
    return new URL(configured).origin;
  } catch {
    return APP_BASE_URL_FALLBACK;
  }
}

function isPublicClerkPassthroughRoute(req: NextRequest): boolean {
  const pathname = req.nextUrl.pathname;
  return (
    pathname === "/" ||
    pathname === "/sign-in" ||
    pathname.startsWith("/sign-in/") ||
    pathname === "/sign-up" ||
    pathname.startsWith("/sign-up/") ||
    pathname === "/api/health" ||
    pathname === "/api/meta/release" ||
    pathname === "/api/_meta/release" ||
    pathname.startsWith("/api/studio/domara/")
  );
}

function isDirectoryIqApiRoute(req: NextRequest): boolean {
  return (
    req.nextUrl.pathname.startsWith("/api/directoryiq") ||
    req.nextUrl.pathname.startsWith("/api/ingest/directoryiq")
  );
}

function isSiteforgeApiRoute(req: NextRequest): boolean {
  return req.nextUrl.pathname.startsWith("/api/siteforge");
}

function buildSignInRedirect(req: NextRequest): NextResponse {
  const appBaseUrl = resolveAppBaseUrlOrigin();
  const signInUrl = new URL(clerkRouteContract.signInUrl, appBaseUrl);
  const redirectUrl = new URL(`${req.nextUrl.pathname}${req.nextUrl.search}`, appBaseUrl);
  signInUrl.searchParams.set("redirect_url", redirectUrl.toString());
  return NextResponse.redirect(signInUrl);
}

function maybeHandleDirectoryIqCors(req: NextRequest): NextResponse | null {
  if (!isDirectoryIqApiRoute(req)) return null;

  const origin = req.headers.get("origin");
  const isAllowedOrigin = origin === DIRECTORYIQ_CORS_ORIGIN;
  if (isAllowedOrigin && req.method === "OPTIONS") {
    const headers = new Headers();
    headers.set("Access-Control-Allow-Origin", DIRECTORYIQ_CORS_ORIGIN);
    headers.set("Access-Control-Allow-Credentials", "true");
    headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    headers.set(
      "Access-Control-Allow-Headers",
      req.headers.get("access-control-request-headers") ?? "Content-Type, Authorization"
    );
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

function hasClerkSessionCookie(req: NextRequest): boolean {
  return Boolean(req.cookies.get("__session")?.value?.trim());
}

function isEcomviperApiRoute(req: NextRequest): boolean {
  return req.nextUrl.pathname.startsWith("/api/ecomviper");
}

function isBrainsApiRoute(req: NextRequest): boolean {
  return req.nextUrl.pathname.startsWith("/api/brains");
}

function isTrustedIngestServiceRequest(req: NextRequest): boolean {
  if (req.method !== "POST") return false;
  if (!trustedIngestPathRegex.test(req.nextUrl.pathname)) return false;
  return true;
}

function hasServiceApiKey(req: NextRequest): boolean {
  return Boolean(req.headers.get("x-api-key")?.trim());
}

function isTrustedRetrieveServiceRequest(req: NextRequest): boolean {
  if (req.method !== "POST") return false;
  if (!trustedRetrievePathRegex.test(req.nextUrl.pathname)) return false;
  return true;
}

function isTrustedRunStatusServiceRequest(req: NextRequest): boolean {
  if (req.method !== "GET") return false;
  if (!trustedRunStatusPathRegex.test(req.nextUrl.pathname)) return false;
  return hasServiceApiKey(req);
}

function isDeprecatedLegacyRoute(req: NextRequest): boolean {
  return deprecatedLegacyRouteRegex.test(req.nextUrl.pathname);
}

const clerkProxy = clerkMiddleware(async (auth, req) => {
  if (req.nextUrl.pathname === "/api/_meta/release") {
    const url = req.nextUrl.clone();
    url.pathname = "/api/meta/release";
    return NextResponse.rewrite(url);
  }

  if (isProtectedRoute(req)) {
    const authState = await auth();
    if (!authState.userId) {
      return buildSignInRedirect(req);
    }
  }

  return NextResponse.next();
}, {
  frontendApiProxy: { enabled: true },
});

export default e2eMockGraph
  ? function e2eProxyBypass() {
      return NextResponse.next();
    }
  : async function proxy(req: NextRequest, event: NextFetchEvent) {
      if (clerkRuntimeContract.hasProductionConfigError) {
        return new NextResponse(buildClerkProductionConfigError(clerkRuntimeContract), {
          status: 503,
          headers: {
            "cache-control": "no-store",
            "content-type": "text/plain; charset=utf-8",
            "x-ibrains-auth-status": "misconfigured",
          },
        });
      }
      if (isDeprecatedLegacyRoute(req)) {
        return new NextResponse("Not Found", {
          status: 404,
          headers: {
            "cache-control": "no-store",
            "content-type": "text/plain; charset=utf-8",
          },
        });
      }
      if (!isClerkConfigured) {
        if (isProtectedRoute(req)) {
          return buildSignInRedirect(req);
        }
        return NextResponse.next();
      }
      const directoryIqCorsResponse = maybeHandleDirectoryIqCors(req);
      if (directoryIqCorsResponse) return directoryIqCorsResponse;
      if (isSiteforgeApiRoute(req)) return NextResponse.next();
      if (isEcomviperApiRoute(req)) {
        if (!hasClerkSessionCookie(req)) {
          return buildSignInRedirect(req);
        }
        return NextResponse.next();
      }
      if (isBrainsApiRoute(req)) return NextResponse.next();
      if (isPublicClerkPassthroughRoute(req)) return NextResponse.next();
      if (isTrustedIngestServiceRequest(req)) return NextResponse.next();
      if (isTrustedRetrieveServiceRequest(req)) return NextResponse.next();
      if (isTrustedRunStatusServiceRequest(req)) return NextResponse.next();
      try {
        return await clerkProxy(req, event);
      } catch {
        if (isProtectedRoute(req)) {
          return buildSignInRedirect(req);
        }
        return NextResponse.next();
      }
    };

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc|__clerk)(.*)",
  ],
};
