import { beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { isWorkerTargetPath, proxyToBrains } from "@/app/api/_utils/proxy";

describe("isWorkerTargetPath", () => {
  it("classifies exact and nested worker routes", () => {
    expect(isWorkerTargetPath("/v1/runs")).toBe(true);
    expect(isWorkerTargetPath("/v1/runs/abc")).toBe(true);
    expect(isWorkerTargetPath("/v1/brains")).toBe(true);
    expect(isWorkerTargetPath("/v1/brains/foo")).toBe(true);
    expect(isWorkerTargetPath("/v1/brain-packs")).toBe(true);
    expect(isWorkerTargetPath("/v1/brain-packs/x")).toBe(true);
  });

  it("keeps unrelated routes on non-worker auth branch", () => {
    expect(isWorkerTargetPath("/v1/brains-public")).toBe(false);
    expect(isWorkerTargetPath("/v1/internal/status")).toBe(false);
  });
});

describe("proxyToBrains auth branch", () => {
  const request = new NextRequest("http://localhost/api/test");

  beforeEach(() => {
    delete process.env.BRAINS_WORKER_API_KEY;
    delete process.env.BRAINS_MASTER_KEY;
    delete process.env.BRAINS_X_API_KEY;
  });

  it("requires worker key for exact worker collection route /v1/runs", async () => {
    process.env.BRAINS_MASTER_KEY = "master_test_only";

    const res = await proxyToBrains(request, "/v1/runs", { requireAuth: true });
    const body = (await res.json()) as { error?: { code?: string; message?: string } };

    expect(res.status).toBe(500);
    expect(body.error?.code).toBe("BAD_PROXY_AUTH_CONFIG");
    expect(body.error?.message).toContain("BRAINS_WORKER_API_KEY");
  });

  it("requires master/x-api key for non-worker route", async () => {
    process.env.BRAINS_WORKER_API_KEY = "worker_test_only";

    const res = await proxyToBrains(request, "/v1/catalog", { requireAuth: true });
    const body = (await res.json()) as { error?: { code?: string; message?: string } };

    expect(res.status).toBe(500);
    expect(body.error?.code).toBe("BAD_PROXY_AUTH_CONFIG");
    expect(body.error?.message).toContain("BRAINS_MASTER_KEY or BRAINS_X_API_KEY");
  });
});
