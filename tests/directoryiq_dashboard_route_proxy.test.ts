import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

describe("directoryiq dashboard route proxy", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    delete process.env.DIRECTORYIQ_API_BASE;
    delete process.env.NEXT_PUBLIC_DIRECTORYIQ_API_BASE;
  });

  it("proxies dashboard GET to the external DirectoryIQ API", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ connected: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    process.env.DIRECTORYIQ_API_BASE = "https://directoryiq-api.ibrains.ai";

    const { GET } = await import("@/app/api/directoryiq/dashboard/route");
    const req = new NextRequest("http://localhost/api/directoryiq/dashboard", {
      headers: { "x-user-id": "00000000-0000-4000-8000-000000000001" },
    });

    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.connected).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://directoryiq-api.ibrains.ai/api/directoryiq/dashboard");
    expect(init.method).toBe("GET");
    const headers = new Headers(init.headers);
    expect(headers.get("x-user-id")).toBe("00000000-0000-4000-8000-000000000001");
  });

  it("proxies dashboard POST to the external DirectoryIQ API", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ connected: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    process.env.DIRECTORYIQ_API_BASE = "https://directoryiq-api.ibrains.ai";

    const { POST } = await import("@/app/api/directoryiq/dashboard/route");
    const req = new NextRequest("http://localhost/api/directoryiq/dashboard", {
      method: "POST",
      headers: { "x-user-id": "00000000-0000-4000-8000-000000000001" },
    });

    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://directoryiq-api.ibrains.ai/api/directoryiq/dashboard");
    expect(init.method).toBe("POST");
  });
});
