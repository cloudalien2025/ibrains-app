import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/runs/route";

function jsonResponse(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("GET /api/runs route contract", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.BRAINS_API_BASE = "https://brains.example";
    process.env.BRAINS_WORKER_API_KEY = "worker_test_key";
    delete process.env.BRAINS_MASTER_KEY;
    delete process.env.BRAINS_X_API_KEY;
  });

  it("passes through upstream list response when /v1/runs is available", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(200, { runs: [{ run_id: "run_primary" }] }));

    const res = await GET(new NextRequest("http://localhost/api/runs"));
    const body = (await res.json()) as { runs: Array<{ run_id: string }> };

    expect(res.status).toBe(200);
    expect(body.runs[0]?.run_id).toBe("run_primary");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to stats + run detail when /v1/runs returns BRAIN_NOT_FOUND", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof Request
            ? input.url
            : input.toString();
      const pathname = new URL(url).pathname;

      if (pathname === "/v1/runs") {
        return jsonResponse(404, { message: "Not Found" });
      }
      if (pathname === "/v1/brains/brilliant_directories/stats") {
        return jsonResponse(200, { last_run_id: "run_dir_1" });
      }
      if (pathname === "/v1/brains/ecomviper/stats") {
        return jsonResponse(200, { last_run_id: null });
      }
      if (pathname === "/v1/brains/studio/stats") {
        return jsonResponse(404, { message: "Not Found" });
      }
      if (pathname === "/v1/runs/run_dir_1") {
        return jsonResponse(200, {
          run_id: "run_dir_1",
          brain_id: "brilliant_directories",
          status: "completed",
          updated_at: "2026-04-04T14:00:00.000Z",
        });
      }
      return jsonResponse(404, { message: `Unhandled path: ${pathname}` });
    });

    const res = await GET(new NextRequest("http://localhost/api/runs"));
    const body = (await res.json()) as { runs: Array<{ run_id: string; brain_id: string }> };

    expect(res.status).toBe(200);
    expect(body.runs).toHaveLength(1);
    expect(body.runs[0]).toMatchObject({ run_id: "run_dir_1", brain_id: "brilliant_directories" });
    expect(fetchMock).toHaveBeenCalled();
  });
});
