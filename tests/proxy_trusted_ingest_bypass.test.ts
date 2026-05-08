import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  clerkProxyHandler: vi.fn(() => Response.json({ ok: true }, { status: 200 })),
}));

vi.mock("@clerk/nextjs/server", () => ({
  clerkMiddleware: vi.fn(() => mocks.clerkProxyHandler),
  createRouteMatcher: vi.fn(() => () => false),
}));

describe("proxy trusted service bypass", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    delete process.env.E2E_MOCK_GRAPH;
  });

  it("bypasses Clerk middleware for trusted ingest service requests", async () => {
    const mod = await import("@/proxy");
    const handler = mod.default as (req: NextRequest) => Promise<Response> | Response;

    const req = new NextRequest("https://app.ibrains.ai/api/brains/ipetzo/ingest", {
      method: "POST",
      headers: {
        "x-api-key": "worker_test_key",
        "content-type": "application/json",
      },
      body: JSON.stringify({ keyword: "pet care", selected_new: 1 }),
    });

    const res = await handler(req);
    expect(res.status).toBe(200);
    expect(mocks.clerkProxyHandler).not.toHaveBeenCalled();
  });

  it("bypasses Clerk middleware on ingest route even without x-api-key", async () => {
    const mod = await import("@/proxy");
    const handler = mod.default as (req: NextRequest) => Promise<Response> | Response;

    const req = new NextRequest("https://app.ibrains.ai/api/brains/ipetzo/ingest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ keyword: "pet care", selected_new: 1 }),
    });

    const res = await handler(req);
    expect(res.status).toBe(200);
    expect(mocks.clerkProxyHandler).not.toHaveBeenCalled();
  });

  it("bypasses Clerk middleware for trusted retrieve requests", async () => {
    const mod = await import("@/proxy");
    const handler = mod.default as (req: NextRequest) => Promise<Response> | Response;

    const req = new NextRequest("https://app.ibrains.ai/api/brains/ipetzo/retrieve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "pet care", limit: 8 }),
    });

    const res = await handler(req);
    expect(res.status).toBe(200);
    expect(mocks.clerkProxyHandler).not.toHaveBeenCalled();
  });

  it("bypasses Clerk middleware for trusted run-status requests with service key", async () => {
    const mod = await import("@/proxy");
    const handler = mod.default as (req: NextRequest) => Promise<Response> | Response;

    const req = new NextRequest("https://app.ibrains.ai/api/runs/run_123", {
      method: "GET",
      headers: { "x-api-key": "worker_test_key" },
    });

    const res = await handler(req);
    expect(res.status).toBe(200);
    expect(mocks.clerkProxyHandler).not.toHaveBeenCalled();
  });

  it("redirects unauthenticated app launcher requests without invoking Clerk middleware", async () => {
    const mod = await import("@/proxy");
    const handler = mod.default as (req: NextRequest) => Promise<Response> | Response;

    const req = new NextRequest("https://app.ibrains.ai/apps", {
      method: "GET",
    });

    const res = await handler(req);
    expect(res.status).toBe(307);
    expect(mocks.clerkProxyHandler).not.toHaveBeenCalled();
  });

  it("redirects unauthenticated Studio app requests without invoking Clerk middleware", async () => {
    const mod = await import("@/proxy");
    const handler = mod.default as (req: NextRequest) => Promise<Response> | Response;

    const req = new NextRequest("https://app.ibrains.ai/apps/studio", {
      method: "GET",
    });

    const res = await handler(req);
    expect(res.status).toBe(307);
    expect(mocks.clerkProxyHandler).not.toHaveBeenCalled();
  });

  it("bypasses Clerk middleware on Studio API routes so they do not self-proxy", async () => {
    const mod = await import("@/proxy");
    const handler = mod.default as (req: NextRequest) => Promise<Response> | Response;

    const req = new NextRequest("https://app.ibrains.ai/api/studio/domara/integrations/status", {
      method: "GET",
    });

    const res = await handler(req);
    expect(res.status).toBe(200);
    expect(mocks.clerkProxyHandler).not.toHaveBeenCalled();
  });

  it("bypasses Clerk middleware on new Studio campaign discovery routes", async () => {
    const mod = await import("@/proxy");
    const handler = mod.default as (req: NextRequest) => Promise<Response> | Response;

    const req = new NextRequest(
      "https://app.ibrains.ai/api/studio/domara/campaigns/casahud-project-123/discover-listings",
      {
        method: "POST",
      },
    );

    const res = await handler(req);
    expect(res.status).toBe(200);
    expect(mocks.clerkProxyHandler).not.toHaveBeenCalled();
  });

  it("bypasses Clerk middleware on new Studio campaign validation routes", async () => {
    const mod = await import("@/proxy");
    const handler = mod.default as (req: NextRequest) => Promise<Response> | Response;

    const req = new NextRequest(
      "https://app.ibrains.ai/api/studio/domara/campaigns/casahud-project-123/validate-listings",
      {
        method: "POST",
      },
    );

    const res = await handler(req);
    expect(res.status).toBe(200);
    expect(mocks.clerkProxyHandler).not.toHaveBeenCalled();
  });

  it("bypasses Clerk middleware on SiteForge API routes so they do not self-proxy", async () => {
    const mod = await import("@/proxy");
    const handler = mod.default as (req: NextRequest) => Promise<Response> | Response;

    const req = new NextRequest("https://app.ibrains.ai/api/siteforge/admin/summary", {
      method: "GET",
    });

    const res = await handler(req);
    expect(res.status).toBe(200);
    expect(mocks.clerkProxyHandler).not.toHaveBeenCalled();
  });

  it("bypasses Clerk middleware on DirectoryIQ API routes so they do not self-proxy", async () => {
    const mod = await import("@/proxy");
    const handler = mod.default as (req: NextRequest) => Promise<Response> | Response;

    const req = new NextRequest("https://app.ibrains.ai/api/directoryiq/sites", {
      method: "GET",
    });

    const res = await handler(req);
    expect(res.status).toBe(200);
    expect(mocks.clerkProxyHandler).not.toHaveBeenCalled();
  });

  it("returns CORS preflight response for allowed DirectoryIQ origin without Clerk middleware", async () => {
    const mod = await import("@/proxy");
    const handler = mod.default as (req: NextRequest) => Promise<Response> | Response;

    const req = new NextRequest("https://app.ibrains.ai/api/directoryiq/sites", {
      method: "OPTIONS",
      headers: {
        origin: "https://app.ibrains.ai",
        "access-control-request-headers": "content-type, authorization",
      },
    });

    const res = await handler(req);
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("https://app.ibrains.ai");
    expect(res.headers.get("access-control-allow-credentials")).toBe("true");
    expect(mocks.clerkProxyHandler).not.toHaveBeenCalled();
  });

  it("keeps non-bypassed API routes on the Clerk proxy path", async () => {
    const mod = await import("@/proxy");
    const handler = mod.default as (req: NextRequest) => Promise<Response> | Response;

    const req = new NextRequest("https://app.ibrains.ai/api/brains/public", {
      method: "GET",
    });

    const res = await handler(req);
    expect(res.status).toBe(200);
    expect(mocks.clerkProxyHandler).toHaveBeenCalledTimes(1);
  });

  it("bypasses Clerk middleware on release metadata health checks", async () => {
    const mod = await import("@/proxy");
    const handler = mod.default as (req: NextRequest) => Promise<Response> | Response;

    const req = new NextRequest("https://app.ibrains.ai/api/meta/release", {
      method: "GET",
    });

    const res = await handler(req);
    expect(res.status).toBe(200);
    expect(mocks.clerkProxyHandler).not.toHaveBeenCalled();
  });

  it("bypasses Clerk middleware on /api/health", async () => {
    const mod = await import("@/proxy");
    const handler = mod.default as (req: NextRequest) => Promise<Response> | Response;

    const req = new NextRequest("https://app.ibrains.ai/api/health", {
      method: "GET",
    });

    const res = await handler(req);
    expect(res.status).toBe(200);
    expect(mocks.clerkProxyHandler).not.toHaveBeenCalled();
  });

  it("keeps Clerk middleware for run-status requests without service key", async () => {
    const mod = await import("@/proxy");
    const handler = mod.default as (req: NextRequest) => Promise<Response> | Response;

    const req = new NextRequest("https://app.ibrains.ai/api/runs/run_123", {
      method: "GET",
    });

    const res = await handler(req);
    expect(res.status).toBe(200);
    expect(mocks.clerkProxyHandler).toHaveBeenCalledTimes(1);
  });
});
