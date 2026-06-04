import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  probeBrains: vi.fn(),
}));

vi.mock("@/app/api/_utils/proxy", () => ({
  probeBrains: mocks.probeBrains,
}));

describe("GET /api/health", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns ok=true and upstream_ok=true when the worker probe succeeds", async () => {
    mocks.probeBrains.mockResolvedValue({
      upstreamOk: true,
      requestId: "req_123",
    });

    const { GET } = await import("@/app/api/health/route");
    const response = await GET(new NextRequest("https://app.ibrains.ai/api/health"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      ok: true,
      upstream_ok: true,
      request_id: "req_123",
    });
  });

  it("returns ok=true with upstream details when the worker probe is degraded", async () => {
    process.env.BRAINS_API_BASE = "http://127.0.0.1:8000";
    process.env.BRAINS_X_API_KEY = "x_test_key";
    mocks.probeBrains.mockResolvedValue({
      upstreamOk: false,
      upstreamError: "HTTP 503: service unavailable",
    });

    const { GET } = await import("@/app/api/health/route");
    const response = await GET(new NextRequest("https://app.ibrains.ai/api/health"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      ok: true,
      worker_base_url_present: true,
      brains_x_api_key_present: true,
      upstream_ok: false,
      upstream_error: "HTTP 503: service unavailable",
    });
  });

  it("falls back to a degraded payload when the worker probe throws", async () => {
    mocks.probeBrains.mockRejectedValue(new Error("boom"));

    const { GET } = await import("@/app/api/health/route");
    const response = await GET(new NextRequest("https://app.ibrains.ai/api/health"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      ok: true,
      upstream_ok: false,
      upstream_error: "Health probe failed",
    });
  });
});
