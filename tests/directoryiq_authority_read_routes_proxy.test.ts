import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

describe("directoryiq authority read routes proxy", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    delete process.env.DIRECTORYIQ_API_BASE;
    delete process.env.NEXT_PUBLIC_DIRECTORYIQ_API_BASE;
  });

  it("proxies authority listings reads to external DirectoryIQ API", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, listings: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    process.env.DIRECTORYIQ_API_BASE = "https://directoryiq-api.ibrains.ai";

    const { GET } = await import("@/app/api/directoryiq/authority/listings/route");
    const req = new NextRequest("http://localhost/api/directoryiq/authority/listings");
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe("https://directoryiq-api.ibrains.ai/api/directoryiq/authority/listings");
  });

  it("proxies authority blogs reads to external DirectoryIQ API", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, blogs: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    process.env.DIRECTORYIQ_API_BASE = "https://directoryiq-api.ibrains.ai";

    const { GET } = await import("@/app/api/directoryiq/authority/blogs/route");
    const req = new NextRequest("http://localhost/api/directoryiq/authority/blogs");
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe("https://directoryiq-api.ibrains.ai/api/directoryiq/authority/blogs");
  });

  it("proxies authority overview reads to external DirectoryIQ API", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, overview: {} }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    process.env.DIRECTORYIQ_API_BASE = "https://directoryiq-api.ibrains.ai";

    const { GET } = await import("@/app/api/directoryiq/authority/overview/route");
    const req = new NextRequest("http://localhost/api/directoryiq/authority/overview");
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe("https://directoryiq-api.ibrains.ai/api/directoryiq/authority/overview");
  });
});
