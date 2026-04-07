import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireSignedInUser: vi.fn(),
  resolveBrainId: vi.fn(),
  proxyToBrains: vi.fn(),
}));

vi.mock("@/lib/auth/requireSignedInUser", () => ({
  requireSignedInUser: mocks.requireSignedInUser,
}));

vi.mock("@/lib/brains/resolveBrainId", () => ({
  resolveBrainId: mocks.resolveBrainId,
}));

vi.mock("@/app/api/_utils/proxy", () => ({
  proxyToBrains: mocks.proxyToBrains,
  unexpectedErrorResponse: vi.fn(() => Response.json({ error: "unexpected" }, { status: 500 })),
}));

describe("POST /api/brains/[id]/answer-orchestrate service auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.BRAINS_WORKER_API_KEY = "worker_test_key";
    delete process.env.BRAINS_MASTER_KEY;
    delete process.env.BRAINS_X_API_KEY;
    mocks.requireSignedInUser.mockResolvedValue({ unauthorizedResponse: null });
    mocks.resolveBrainId.mockImplementation((id: string) => id);
  });

  it("preserves brilliant_directories id for answer orchestration", async () => {
    const { POST } = await import("@/app/api/brains/[id]/answer-orchestrate/route");
    const proxied = Response.json({ ok: true }, { status: 200 });
    mocks.proxyToBrains.mockResolvedValueOnce(proxied);

    const req = new NextRequest(
      "http://localhost/api/brains/brilliant_directories/answer-orchestrate",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": "worker_test_key",
        },
        body: JSON.stringify({ query: "directory seo" }),
      }
    );

    const res = await POST(req, { params: { id: "brilliant_directories" } });

    expect(res.status).toBe(200);
    expect(mocks.proxyToBrains).toHaveBeenCalledWith(
      expect.any(NextRequest),
      "/v1/brains/brilliant_directories/answer-orchestrate",
      { requireAuth: true }
    );
  });
});
