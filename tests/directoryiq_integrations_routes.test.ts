import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const ensureUser = vi.fn(async () => {});
const resolveUserId = vi.fn(() => "00000000-0000-4000-8000-000000000001");
const saveDirectoryIqIntegration = vi.fn(async () => {});
const getDirectoryIqIntegration = vi.fn(async () => ({
  provider: "openai",
  status: "connected",
  masked: "********1234",
  savedAt: "2026-03-01T00:00:00.000Z",
  meta: {},
}));
const getDirectoryIqIntegrationSecret = vi.fn(async () => ({
  secret: "sk-test",
  meta: {},
}));

vi.mock("@/app/api/ecomviper/_utils/user", () => ({
  ensureUser,
  resolveUserId,
}));

vi.mock("@/app/api/directoryiq/_utils/credentials", async () => {
  const actual = await vi.importActual<typeof import("@/app/api/directoryiq/_utils/credentials")>(
    "@/app/api/directoryiq/_utils/credentials"
  );
  return {
    ...actual,
    saveDirectoryIqIntegration,
    getDirectoryIqIntegration,
    getDirectoryIqIntegrationSecret,
  };
});

describe("directoryiq integrations routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("save route returns masked metadata only", async () => {
    const { POST } = await import("@/app/api/directoryiq/integrations/[provider]/route");
    const req = new NextRequest("http://localhost/api/directoryiq/integrations/openai", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ apiKey: "sk-test-key" }),
    });
    const res = await POST(req, { params: { provider: "openai" } });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.masked).toBe("********1234");
    expect(JSON.stringify(json)).not.toContain("sk-test-key");
    expect(saveDirectoryIqIntegration).toHaveBeenCalledTimes(1);
  });

  it("test route returns structured reqId on not configured", async () => {
    getDirectoryIqIntegrationSecret.mockResolvedValueOnce(
      null as unknown as { secret: string; meta: Record<string, unknown> }
    );
    const { POST } = await import("@/app/api/directoryiq/integrations/[provider]/test/route");
    const req = new NextRequest("http://localhost/api/directoryiq/integrations/openai/test", { method: "POST" });
    const res = await POST(req, { params: { provider: "openai" } });
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error.code).toBe("NOT_CONFIGURED");
    expect(typeof json.error.reqId).toBe("string");
  });
});
