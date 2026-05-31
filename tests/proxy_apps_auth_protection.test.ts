import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const state = vi.hoisted(() => ({
  clerkProxyCalls: 0,
  denyProtect: false,
  throwAuth: false,
}));
const VALID_SESSION_TOKEN = "header.payload.signature";

function toPathRegex(pattern: string): RegExp {
  const prefix = pattern.replace("(.*)", "");
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escaped}(?:$|/)`);
}

vi.mock("@clerk/nextjs/server", () => ({
  createRouteMatcher: vi.fn((patterns: string[]) => {
    const regexes = patterns.map(toPathRegex);
    return (req: NextRequest) => regexes.some((regex) => regex.test(req.nextUrl.pathname));
  }),
  clerkMiddleware: vi.fn((handler: (auth: (() => Promise<{ userId: string | null }>) & { protect: () => Promise<void> }, req: NextRequest) => Promise<Response>) => {
    return async (req: NextRequest) => {
      state.clerkProxyCalls += 1;
      const authFn = async () => {
        if (state.throwAuth) {
          throw new Error("Auth unavailable");
        }
        if (state.denyProtect) {
          return { userId: null };
        }
        return { userId: "user_test_123" };
      };
      return handler(
        Object.assign(authFn, {
          protect: async () => {
            if (state.denyProtect) {
              throw new Error("Unauthenticated");
            }
          },
        }),
        req
      );
    };
  }),
}));

describe("proxy app/auth protection", () => {
  beforeEach(() => {
    vi.resetModules();
    state.clerkProxyCalls = 0;
    state.denyProtect = false;
    state.throwAuth = false;
    delete process.env.E2E_MOCK_GRAPH;
    delete process.env.ECOMVIPER_SYNC_INTERNAL_TOKEN;
  });

  it("/sign-in and /sign-up stay public without Clerk proxy passthrough", async () => {
    const mod = await import("@/proxy");
    const handler = mod.default as (req: NextRequest) => Promise<Response> | Response;

    const signInResponse = await handler(new NextRequest("https://app.ibrains.ai/sign-in"));
    const signUpResponse = await handler(new NextRequest("https://app.ibrains.ai/sign-up"));

    expect(signInResponse.status).toBe(200);
    expect(signUpResponse.status).toBe(200);
    expect(state.clerkProxyCalls).toBe(0);
  });

  it("/robots.txt stays public without Clerk proxy passthrough", async () => {
    const mod = await import("@/proxy");
    const handler = mod.default as (req: NextRequest) => Promise<Response> | Response;

    const response = await handler(new NextRequest("https://app.ibrains.ai/robots.txt"));

    expect(response.status).toBe(200);
    expect(state.clerkProxyCalls).toBe(0);
  });

  it("redirects unauthenticated users from /optiwal/connect to sign-in with redirect_url", async () => {
    const mod = await import("@/proxy");
    const handler = mod.default as (req: NextRequest) => Promise<Response> | Response;

    const response = await handler(
      new NextRequest("https://app.ibrains.ai/optiwal/connect")
    );

    expect(response.status).toBe(307);
    const location = response.headers.get("location");
    expect(location).toContain("/sign-in");
    expect(location).toContain(
      "redirect_url=%2Foptiwal%2Fconnect"
    );
    expect(state.clerkProxyCalls).toBe(0);
  });

  it("redirects signed-out /brains and /ecomviper without creating cross-route loops", async () => {
    const mod = await import("@/proxy");
    const handler = mod.default as (req: NextRequest) => Promise<Response> | Response;

    const brainsResponse = await handler(new NextRequest("https://app.ibrains.ai/brains"));
    const brainsLocation = brainsResponse.headers.get("location") ?? "";
    expect(brainsResponse.status).toBe(307);
    expect(brainsLocation).toContain("/sign-in");
    expect(brainsLocation).toContain("redirect_url=%2Fbrains");
    expect(brainsLocation).not.toContain("%2Fecomviper");

    const ecomviperResponse = await handler(new NextRequest("https://app.ibrains.ai/ecomviper"));
    const ecomviperLocation = ecomviperResponse.headers.get("location") ?? "";
    expect(ecomviperResponse.status).toBe(307);
    expect(ecomviperLocation).toContain("/sign-in");
    expect(ecomviperLocation).toContain("redirect_url=%2Fecomviper");
    expect(ecomviperLocation).not.toContain("%2Fbrains");
    expect(state.clerkProxyCalls).toBe(0);
  });

  it("keeps /api/ecomviper/walmart/connect/save behind auth checks", async () => {
    const mod = await import("@/proxy");
    const handler = mod.default as (req: NextRequest) => Promise<Response> | Response;

    const response = await handler(new NextRequest("https://app.ibrains.ai/api/ecomviper/walmart/connect/save", { method: "POST" }));

    expect(response.status).toBe(307);
    const location = response.headers.get("location");
    expect(location).toContain("/sign-in");
    expect(location).toContain(
      "redirect_url=%2Fapi%2Fecomviper%2Fwalmart%2Fconnect%2Fsave"
    );
    expect(state.clerkProxyCalls).toBe(0);
  });

  it("allows authenticated users through /api/ecomviper/walmart/connect/save without Clerk self-proxy", async () => {
    const mod = await import("@/proxy");
    const handler = mod.default as (req: NextRequest) => Promise<Response> | Response;

    const response = await handler(
      new NextRequest("https://app.ibrains.ai/api/ecomviper/walmart/connect/save", {
        method: "POST",
        headers: {
          cookie: `__session=${VALID_SESSION_TOKEN}`,
        },
      })
    );

    expect(response.status).toBe(200);
    expect(state.clerkProxyCalls).toBe(0);
  });

  it("passes authenticated /api/ecomviper/settings routes through Clerk context", async () => {
    const mod = await import("@/proxy");
    const handler = mod.default as (req: NextRequest) => Promise<Response> | Response;

    const response = await handler(
      new NextRequest("https://app.ibrains.ai/api/ecomviper/settings/supplier-membership", {
        method: "POST",
        headers: {
          cookie: `__session=${VALID_SESSION_TOKEN}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ membershipTier: "Scale Plan $497/mo" }),
      })
    );

    expect(response.status).toBe(200);
    expect(state.clerkProxyCalls).toBe(1);
  });

  it("allows internal-token sync requests without requiring a session cookie", async () => {
    process.env.ECOMVIPER_SYNC_INTERNAL_TOKEN = "sync_internal_test_token";
    const mod = await import("@/proxy");
    const handler = mod.default as (req: NextRequest) => Promise<Response> | Response;

    const response = await handler(
      new NextRequest("https://app.ibrains.ai/api/ecomviper/supplier-sources/sync", {
        method: "POST",
        headers: {
          authorization: "Bearer sync_internal_test_token",
          "content-type": "application/json",
        },
        body: JSON.stringify({ userId: "__global__" }),
      })
    );

    expect(response.status).toBe(200);
    expect(state.clerkProxyCalls).toBe(0);
  });

  it("rejects invalid internal-token sync requests without opening route access", async () => {
    process.env.ECOMVIPER_SYNC_INTERNAL_TOKEN = "sync_internal_test_token";
    const mod = await import("@/proxy");
    const handler = mod.default as (req: NextRequest) => Promise<Response> | Response;

    const invalidTokenResponse = await handler(
      new NextRequest("https://app.ibrains.ai/api/ecomviper/supplier-sources/sync", {
        method: "POST",
        headers: {
          authorization: "Bearer wrong_token",
          "content-type": "application/json",
        },
        body: JSON.stringify({ userId: "__global__" }),
      })
    );

    const missingTokenResponse = await handler(
      new NextRequest("https://app.ibrains.ai/api/ecomviper/supplier-sources/sync", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ userId: "__global__" }),
      })
    );

    expect(invalidTokenResponse.status).toBe(307);
    expect(invalidTokenResponse.headers.get("location")).toContain("/sign-in");
    expect(missingTokenResponse.status).toBe(307);
    expect(missingTokenResponse.headers.get("location")).toContain("/sign-in");
    expect(state.clerkProxyCalls).toBe(0);
  });

  it("does not bypass auth for other /api/ecomviper routes even with internal token header", async () => {
    process.env.ECOMVIPER_SYNC_INTERNAL_TOKEN = "sync_internal_test_token";
    const mod = await import("@/proxy");
    const handler = mod.default as (req: NextRequest) => Promise<Response> | Response;

    const response = await handler(
      new NextRequest("https://app.ibrains.ai/api/ecomviper/walmart/connect/save", {
        method: "POST",
        headers: {
          authorization: "Bearer sync_internal_test_token",
          "content-type": "application/json",
        },
      })
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/sign-in");
    expect(state.clerkProxyCalls).toBe(0);
  });

  it("allows authenticated users into /optiwal/connect without invoking clerk middleware proxy", async () => {
    const mod = await import("@/proxy");
    const handler = mod.default as (req: NextRequest) => Promise<Response> | Response;

    const response = await handler(
      new NextRequest("https://app.ibrains.ai/optiwal/connect", {
        headers: {
          cookie: `__session=${VALID_SESSION_TOKEN}`,
        },
      })
    );

    expect(response.status).toBe(200);
    expect(state.clerkProxyCalls).toBe(0);
  });

  it("keeps signed-in /brains pass-through at middleware layer to avoid self-proxy rewrites", async () => {
    const mod = await import("@/proxy");
    const handler = mod.default as (req: NextRequest) => Promise<Response> | Response;

    const response = await handler(
      new NextRequest("https://app.ibrains.ai/brains", {
        headers: {
          cookie: `__session=${VALID_SESSION_TOKEN}`,
        },
      })
    );

    expect(response.status).toBe(200);
    expect(state.clerkProxyCalls).toBe(0);
  });

  it("redirects malformed session-cookie requests on protected shell routes", async () => {
    const mod = await import("@/proxy");
    const handler = mod.default as (req: NextRequest) => Promise<Response> | Response;

    const response = await handler(
      new NextRequest("https://app.ibrains.ai/ecomviper", {
        headers: {
          cookie: "__session=not-a-jwt-token",
        },
      })
    );

    expect(response.status).toBe(307);
    const location = response.headers.get("location");
    expect(location).toContain("/sign-in");
    expect(state.clerkProxyCalls).toBe(0);
  });

  it("redirects protected routes to sign-in even when Clerk auth is unavailable", async () => {
    state.throwAuth = true;
    const mod = await import("@/proxy");
    const handler = mod.default as (req: NextRequest) => Promise<Response> | Response;

    const response = await handler(new NextRequest("https://app.ibrains.ai/runs/run_123"));

    expect(response.status).toBe(307);
    const location = response.headers.get("location");
    expect(location).toContain("/sign-in");
    expect(location).toContain("redirect_url=%2Fruns%2Frun_123");
    expect(state.clerkProxyCalls).toBe(0);
  });

  it("keeps deprecated legacy routes hard-404", async () => {
    const mod = await import("@/proxy");
    const handler = mod.default as (req: NextRequest) => Promise<Response> | Response;
    const legacyPaths = ["/apps", "/apps/studio", "/studio", "/siteforge", "/uapforge"];

    for (const path of legacyPaths) {
      const response = await handler(new NextRequest(`https://app.ibrains.ai${path}`));
      expect(response.status).toBe(404);
    }
  });
});
