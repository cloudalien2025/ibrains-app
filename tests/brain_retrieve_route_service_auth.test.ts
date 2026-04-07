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

describe("POST /api/brains/[id]/retrieve service auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.BRAINS_WORKER_API_KEY = "worker_test_key";
    delete process.env.BRAINS_MASTER_KEY;
    delete process.env.BRAINS_X_API_KEY;
    mocks.requireSignedInUser.mockResolvedValue({ unauthorizedResponse: null });
    mocks.resolveBrainId.mockImplementation((id: string) => id);
  });

  it("allows trusted service calls with a matching x-api-key", async () => {
    const { POST } = await import("@/app/api/brains/[id]/retrieve/route");
    const proxied = Response.json({ items: [] }, { status: 200 });
    mocks.proxyToBrains.mockResolvedValueOnce(proxied);

    const req = new NextRequest("http://localhost/api/brains/ipetzo/retrieve", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": "worker_test_key",
        "x-user-id": "service-user",
      },
      body: JSON.stringify({ query: "pet care" }),
    });

    const res = await POST(req, { params: { id: "ipetzo" } });

    expect(res.status).toBe(200);
    expect(mocks.requireSignedInUser).not.toHaveBeenCalled();
    expect(mocks.proxyToBrains).toHaveBeenCalledWith(
      expect.any(NextRequest),
      "/v1/brains/ipetzo/retrieve",
      { requireAuth: true }
    );
  });

  it("keeps Clerk auth for requests without a trusted service key", async () => {
    const { POST } = await import("@/app/api/brains/[id]/retrieve/route");
    const unauthorized = Response.json(
      { error: { code: "UNAUTHORIZED", message: "Sign-in required" } },
      { status: 401 }
    );
    mocks.requireSignedInUser.mockResolvedValueOnce({ unauthorizedResponse: unauthorized });

    const req = new NextRequest("http://localhost/api/brains/ipetzo/retrieve", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ query: "pet care" }),
    });

    const res = await POST(req, { params: { id: "ipetzo" } });

    expect(res.status).toBe(401);
    expect(mocks.requireSignedInUser).toHaveBeenCalledTimes(1);
    expect(mocks.proxyToBrains).not.toHaveBeenCalled();
  });

  it("preserves brilliant_directories id instead of normalizing to a missing slug", async () => {
    const { POST } = await import("@/app/api/brains/[id]/retrieve/route");
    const proxied = Response.json({ items: [] }, { status: 200 });
    mocks.proxyToBrains.mockResolvedValueOnce(proxied);

    const req = new NextRequest("http://localhost/api/brains/brilliant_directories/retrieve", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": "worker_test_key",
      },
      body: JSON.stringify({ query: "directory seo" }),
    });

    const res = await POST(req, { params: { id: "brilliant_directories" } });

    expect(res.status).toBe(200);
    expect(mocks.proxyToBrains).toHaveBeenCalledWith(
      expect.any(NextRequest),
      "/v1/brains/brilliant_directories/retrieve",
      { requireAuth: true }
    );
  });
});
