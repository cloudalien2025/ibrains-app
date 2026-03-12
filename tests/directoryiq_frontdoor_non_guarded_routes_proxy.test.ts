import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

describe("directoryiq non-guarded routes proxy parity", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    process.env.DIRECTORYIQ_API_BASE = "https://directoryiq-api.ibrains.ai";
  });

  it("proxies sites GET/POST to external DirectoryIQ API", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ sites: [] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true, site: { id: "site-1" } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    const { GET, POST } = await import("@/app/api/directoryiq/sites/route");

    const getReq = new NextRequest("http://localhost/api/directoryiq/sites");
    const getRes = await GET(getReq);
    expect(getRes.status).toBe(200);

    const postReq = new NextRequest("http://localhost/api/directoryiq/sites", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ base_url: "https://example.com" }),
    });
    const postRes = await POST(postReq);
    expect(postRes.status).toBe(200);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://directoryiq-api.ibrains.ai/api/directoryiq/sites");
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).method).toBe("GET");
    expect(fetchMock.mock.calls[1]?.[0]).toBe("https://directoryiq-api.ibrains.ai/api/directoryiq/sites");
    expect((fetchMock.mock.calls[1]?.[1] as RequestInit).method).toBe("POST");
  });

  it("proxies signal-sources GET/POST/DELETE to external DirectoryIQ API", async () => {
    const fetchMock = vi.fn().mockImplementation(
      async () =>
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
    );
    vi.stubGlobal("fetch", fetchMock);

    const { GET, POST, DELETE } = await import("@/app/api/directoryiq/signal-sources/route");

    const getRes = await GET(new NextRequest("http://localhost/api/directoryiq/signal-sources"));
    expect(getRes.status).toBe(200);

    const postRes = await POST(
      new NextRequest("http://localhost/api/directoryiq/signal-sources", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ connector_id: "openai", secret: "sk-test" }),
      })
    );
    expect(postRes.status).toBe(200);

    const deleteRes = await DELETE(
      new NextRequest("http://localhost/api/directoryiq/signal-sources?connector_id=openai", {
        method: "DELETE",
      })
    );
    expect(deleteRes.status).toBe(200);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://directoryiq-api.ibrains.ai/api/directoryiq/signal-sources");
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).method).toBe("GET");
    expect(fetchMock.mock.calls[1]?.[0]).toBe("https://directoryiq-api.ibrains.ai/api/directoryiq/signal-sources");
    expect((fetchMock.mock.calls[1]?.[1] as RequestInit).method).toBe("POST");
    expect(fetchMock.mock.calls[2]?.[0]).toBe(
      "https://directoryiq-api.ibrains.ai/api/directoryiq/signal-sources?connector_id=openai"
    );
    expect((fetchMock.mock.calls[2]?.[1] as RequestInit).method).toBe("DELETE");
  });

  it("proxies ingest runs, graph issues, and ingest run POST", async () => {
    const fetchMock = vi.fn().mockImplementation(
      async () =>
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
    );
    vi.stubGlobal("fetch", fetchMock);

    const ingestRunsRoute = await import("@/app/api/directoryiq/ingest/runs/route");
    const graphIssuesRoute = await import("@/app/api/directoryiq/graph/issues/route");
    const ingestRunRoute = await import("@/app/api/ingest/directoryiq/run/route");

    expect(
      (await ingestRunsRoute.GET(new NextRequest("http://localhost/api/directoryiq/ingest/runs"))).status
    ).toBe(200);
    expect(
      (await graphIssuesRoute.GET(new NextRequest("http://localhost/api/directoryiq/graph/issues"))).status
    ).toBe(200);
    expect(
      (
        await ingestRunRoute.POST(
          new NextRequest("http://localhost/api/ingest/directoryiq/run", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({}),
          })
        )
      ).status
    ).toBe(200);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://directoryiq-api.ibrains.ai/api/directoryiq/ingest/runs");
    expect(fetchMock.mock.calls[1]?.[0]).toBe("https://directoryiq-api.ibrains.ai/api/directoryiq/graph/issues");
    expect(fetchMock.mock.calls[2]?.[0]).toBe("https://directoryiq-api.ibrains.ai/api/ingest/directoryiq/run");
    expect((fetchMock.mock.calls[2]?.[1] as RequestInit).method).toBe("POST");
  });
});
