import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireSignedInUser: vi.fn(),
  proxyToBrains: vi.fn(),
}));

vi.mock("@/lib/auth/requireSignedInUser", () => ({
  requireSignedInUser: mocks.requireSignedInUser,
}));

vi.mock("@/app/api/_utils/proxy", () => ({
  proxyToBrains: mocks.proxyToBrains,
  jsonError: (code: string, message: string, status: number, details?: unknown) =>
    Response.json({ error: { code, message, ...(details ? { details } : {}) } }, { status }),
  unexpectedErrorResponse: () =>
    Response.json({ error: { code: "UNEXPECTED", message: "Unexpected error" } }, { status: 500 }),
}));

describe("brains API auth contract", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.requireSignedInUser.mockResolvedValue({
      userId: null,
      unauthorizedResponse: Response.json(
        { error: { code: "UNAUTHORIZED", message: "Sign-in required" } },
        { status: 401 }
      ),
    });
  });

  it("returns non-500 auth response for signed-out GET /api/brains", async () => {
    const { GET } = await import("@/app/api/brains/route");

    const req = new NextRequest("http://localhost/api/brains", {
      method: "GET",
      headers: { accept: "application/json" },
    });

    const res = await GET(req);

    expect(res.status).toBe(401);
    expect(mocks.proxyToBrains).not.toHaveBeenCalled();
  });

  it("returns non-500 auth response for signed-out GET /api/brains/:id/stats", async () => {
    const { GET } = await import("@/app/api/brains/[id]/stats/route");

    const req = new NextRequest("http://localhost/api/brains/ecomviper/stats", {
      method: "GET",
      headers: { accept: "application/json" },
    });

    const res = await GET(req, { params: { id: "ecomviper" } });

    expect(res.status).toBe(401);
    expect(mocks.proxyToBrains).not.toHaveBeenCalled();
  });
});
