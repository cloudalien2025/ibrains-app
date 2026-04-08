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
