import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const signalSourcesGetMock = vi.fn();

vi.mock("@/app/api/directoryiq/signal-sources/route", () => ({
  GET: signalSourcesGetMock,
}));

describe("directoryiq integrations read route contract", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    delete process.env.E2E_MOCK_GRAPH;
  });

  it("maps canonical Signal Sources connector state for OpenAI and BD", async () => {
    signalSourcesGetMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          connectors: [
            { connector_id: "openai", connected: true },
            { connector_id: "brilliant_directories_api", connected: true },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );

    const { GET } = await import("@/app/api/directoryiq/integrations/route");
    const req = new NextRequest("http://localhost/api/directoryiq/integrations");
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.openaiConfigured).toBe(true);
    expect(json.bdConfigured).toBe(true);
    expect(signalSourcesGetMock).toHaveBeenCalledWith(req);
  });

  it("passes through Signal Sources error responses instead of inventing disconnected state", async () => {
    signalSourcesGetMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: false, error: "upstream failure" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      })
    );

    const { GET } = await import("@/app/api/directoryiq/integrations/route");
    const req = new NextRequest("http://localhost/api/directoryiq/integrations");
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.ok).toBe(false);
    expect(String(json.error)).toContain("upstream failure");
  });

  it("returns mock values when E2E_MOCK_GRAPH is enabled", async () => {
    process.env.E2E_MOCK_GRAPH = "1";
    const { GET } = await import("@/app/api/directoryiq/integrations/route");
    const req = new NextRequest("http://localhost/api/directoryiq/integrations");
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.openaiConfigured).toBe(false);
    expect(json.bdConfigured).toBe(false);
    expect(signalSourcesGetMock).not.toHaveBeenCalled();
  });
});
