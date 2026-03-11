import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

describe("directoryiq dashboard route user context", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    delete process.env.DIRECTORYIQ_API_BASE;
    delete process.env.NEXT_PUBLIC_DIRECTORYIQ_API_BASE;
    delete process.env.DIRECTORYIQ_CANONICAL_USER_ID;
  });

  it("uses canonical DirectoryIQ user context when only email header is present", async () => {
    process.env.DIRECTORYIQ_API_BASE = "http://127.0.0.1:3001";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          connected: true,
          last_analyzed_at: "2026-03-11T00:00:00.000Z",
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const { GET } = await import("@/app/api/directoryiq/dashboard/route");
    const req = new NextRequest("http://localhost/api/directoryiq/dashboard", {
      headers: {
        "x-user-email": "owner@app.ibrains.ai",
      },
    });

    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.connected).toBe(true);
    expect(json.last_analyzed_at).not.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://127.0.0.1:3001/api/directoryiq/dashboard");
    const headers = new Headers(init.headers);
    expect(headers.get("x-user-email")).toBe("owner@app.ibrains.ai");
    expect(headers.get("x-user-id")).toBe("00000000-0000-4000-8000-000000000001");
  });
});
