import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const state = vi.hoisted(() => ({
  clerkProxyCalls: 0,
  denyProtect: false,
  throwAuth: false,
}));

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
      "redirect_url=https%3A%2F%2Fapp.ibrains.ai%2Foptiwal%2Fconnect"
    );
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
      "redirect_url=https%3A%2F%2Fapp.ibrains.ai%2Fapi%2Fecomviper%2Fwalmart%2Fconnect%2Fsave"
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
          cookie: "__session=valid_cookie",
        },
      })
    );

    expect(response.status).toBe(200);
    expect(state.clerkProxyCalls).toBe(0);
  });

  it("allows authenticated users into /optiwal/connect without invoking clerk middleware proxy", async () => {
    const mod = await import("@/proxy");
    const handler = mod.default as (req: NextRequest) => Promise<Response> | Response;

    const response = await handler(
      new NextRequest("https://app.ibrains.ai/optiwal/connect", {
        headers: {
          cookie: "__session=valid_cookie",
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
          cookie: "__session=valid_cookie",
        },
      })
    );

    expect(response.status).toBe(200);
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
    expect(location).toContain("redirect_url=https%3A%2F%2Fapp.ibrains.ai%2Fruns%2Frun_123");
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
