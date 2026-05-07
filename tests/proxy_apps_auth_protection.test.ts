import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const state = vi.hoisted(() => ({
  clerkProxyCalls: 0,
  denyProtect: false,
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
  clerkMiddleware: vi.fn((handler: (auth: { protect: () => Promise<void> }, req: NextRequest) => Promise<Response>) => {
    return async (req: NextRequest) => {
      state.clerkProxyCalls += 1;
      return handler(
        {
          protect: async () => {
            if (state.denyProtect) {
              throw new Error("Unauthenticated");
            }
          },
        },
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
    delete process.env.E2E_MOCK_GRAPH;
  });

  it("/sign-in and /sign-up stay public", async () => {
    const mod = await import("@/proxy");
    const handler = mod.default as (req: NextRequest) => Promise<Response> | Response;

    const signInResponse = await handler(new NextRequest("https://app.ibrains.ai/sign-in"));
    const signUpResponse = await handler(new NextRequest("https://app.ibrains.ai/sign-up"));

    expect(signInResponse.status).toBe(200);
    expect(signUpResponse.status).toBe(200);
    expect(state.clerkProxyCalls).toBe(0);
  });

  it("redirects unauthenticated users from /apps/ecomviper/walmart/connect to sign-in with redirect_url", async () => {
    state.denyProtect = true;
    const mod = await import("@/proxy");
    const handler = mod.default as (req: NextRequest) => Promise<Response> | Response;

    const response = await handler(
      new NextRequest("https://app.ibrains.ai/apps/ecomviper/walmart/connect")
    );

    expect(response.status).toBe(307);
    const location = response.headers.get("location");
    expect(location).toContain("/sign-in");
    expect(location).toContain("redirect_url=%2Fapps%2Fecomviper%2Fwalmart%2Fconnect");
    expect(state.clerkProxyCalls).toBe(1);
  });

  it("keeps /api/ecomviper/walmart/connect/save behind auth checks", async () => {
    state.denyProtect = true;
    const mod = await import("@/proxy");
    const handler = mod.default as (req: NextRequest) => Promise<Response> | Response;

    const response = await handler(new NextRequest("https://app.ibrains.ai/api/ecomviper/walmart/connect/save", { method: "POST" }));

    expect(response.status).toBe(307);
    const location = response.headers.get("location");
    expect(location).toContain("/sign-in");
    expect(location).toContain("redirect_url=%2Fapi%2Fecomviper%2Fwalmart%2Fconnect%2Fsave");
    expect(state.clerkProxyCalls).toBe(1);
  });

  it("allows authenticated users into /apps/ecomviper/walmart/connect", async () => {
    state.denyProtect = false;
    const mod = await import("@/proxy");
    const handler = mod.default as (req: NextRequest) => Promise<Response> | Response;

    const response = await handler(new NextRequest("https://app.ibrains.ai/apps/ecomviper/walmart/connect"));

    expect(response.status).toBe(200);
    expect(state.clerkProxyCalls).toBe(1);
  });
});
