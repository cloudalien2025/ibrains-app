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

function jsonResponse(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("POST /api/brains create contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireSignedInUser.mockResolvedValue({ unauthorizedResponse: null });
  });

  it("rejects invalid payloads", async () => {
    const { POST } = await import("@/app/api/brains/route");
    const req = new NextRequest("http://localhost/api/brains", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "" }),
    });

    const res = await POST(req);
    const body = (await res.json()) as { error: { code: string } };

    expect(res.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(mocks.proxyToBrains).not.toHaveBeenCalled();
  });

  it("rejects duplicate slug before create", async () => {
    const { POST } = await import("@/app/api/brains/route");
    mocks.proxyToBrains.mockResolvedValueOnce(
      jsonResponse(200, {
        brains: [{ slug: "custom-sales" }],
      })
    );

    const req = new NextRequest("http://localhost/api/brains", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Custom Sales",
        slug: "Custom Sales",
        description: "Revenue intelligence",
        domain: "sales",
        agentName: "Atlas",
      }),
    });

    const res = await POST(req);
    const body = (await res.json()) as { error: { code: string; message: string } };

    expect(res.status).toBe(409);
    expect(body.error.code).toBe("DUPLICATE_SLUG");
    expect(body.error.message).toContain("Slug already exists");
    expect(mocks.proxyToBrains).toHaveBeenCalledTimes(1);
  });

  it("forwards normalized payload to upstream create", async () => {
    const { POST } = await import("@/app/api/brains/route");
    const capturedBodies: Array<Record<string, unknown>> = [];

    mocks.proxyToBrains.mockImplementation(async (request: NextRequest, targetPath: string) => {
      if (targetPath === "/v1/brains" && request.method === "GET") {
        return jsonResponse(200, { brains: [] });
      }
      if (targetPath === "/v1/brains" && request.method === "POST") {
        capturedBodies.push((await request.json()) as Record<string, unknown>);
        return jsonResponse(201, { brain_id: "custom-sales", slug: "custom-sales" });
      }
      return jsonResponse(404, { message: "Unexpected call" });
    });

    const req = new NextRequest("http://localhost/api/brains", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Custom Sales",
        slug: "Custom Sales",
        description: "Revenue intelligence",
        domain: "sales",
        agentName: "Atlas",
      }),
    });

    const res = await POST(req);
    const body = (await res.json()) as { brain_id: string; slug: string };

    expect(res.status).toBe(201);
    expect(body.brain_id).toBe("custom-sales");
    expect(body.slug).toBe("custom-sales");
    expect(capturedBodies).toHaveLength(1);
    expect(capturedBodies[0]).toMatchObject({
      name: "Custom Sales",
      description: "Revenue intelligence",
      brain_type: "UAP",
    });
  });

  it("surfaces upstream validation details for 422 responses", async () => {
    const { POST } = await import("@/app/api/brains/route");
    mocks.proxyToBrains.mockImplementation(async (request: NextRequest, targetPath: string) => {
      if (targetPath === "/v1/brains" && request.method === "GET") {
        return jsonResponse(200, { brains: [] });
      }
      if (targetPath === "/v1/brains" && request.method === "POST") {
        return jsonResponse(422, {
          detail: [
            {
              loc: ["body", "brain_type"],
              msg: "String should match pattern '^(BD|UAP)$'",
              type: "string_pattern_mismatch",
            },
          ],
        });
      }
      return jsonResponse(404, { message: "Unexpected call" });
    });

    const req = new NextRequest("http://localhost/api/brains", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Custom Sales",
        slug: "Custom Sales",
        description: "Revenue intelligence",
        domain: "sales",
        agentName: "Atlas",
      }),
    });

    const res = await POST(req);
    const body = (await res.json()) as { error: { code: string; message: string } };

    expect(res.status).toBe(422);
    expect(body.error.code).toBe("UPSTREAM_VALIDATION_ERROR");
    expect(body.error.message).toContain("brain_type");
    expect(body.error.message).toContain("^(BD|UAP)$");
  });
});
