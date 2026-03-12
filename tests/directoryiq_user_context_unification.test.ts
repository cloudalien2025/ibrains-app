import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { resolveUserId } from "@/app/api/ecomviper/_utils/user";

const mocks = vi.hoisted(() => ({
  ensureUserMock: vi.fn(async () => {}),
  listBdSitesMock: vi.fn(async () => []),
  isAdminRequestMock: vi.fn(() => false),
}));

vi.mock("@/app/api/ecomviper/_utils/user", async () => {
  const actual = await vi.importActual<typeof import("@/app/api/ecomviper/_utils/user")>(
    "@/app/api/ecomviper/_utils/user"
  );
  return {
    ...actual,
    ensureUser: mocks.ensureUserMock,
  };
});

vi.mock("@/app/api/directoryiq/_utils/bdSites", () => ({
  listBdSites: mocks.listBdSitesMock,
  createBdSite: vi.fn(),
  isAdminRequest: mocks.isAdminRequestMock,
}));

describe("directoryiq user-context unification", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    mocks.ensureUserMock.mockClear();
    mocks.listBdSitesMock.mockClear();
    mocks.isAdminRequestMock.mockClear();
  });

  it("uses resolveUserId identity for local sites route reads", async () => {
    process.env.DIRECTORYIQ_API_BASE = "http://127.0.0.1";
    const req = new NextRequest("http://127.0.0.1/api/directoryiq/sites", {
      headers: {
        "x-forwarded-host": "127.0.0.1",
        "x-user-email": "owner@app.ibrains.ai",
      },
    });
    const expected = resolveUserId(req);
    const { GET } = await import("@/app/api/directoryiq/sites/route");

    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(mocks.ensureUserMock).toHaveBeenCalledWith(expected);
    expect(mocks.listBdSitesMock).toHaveBeenCalledWith(expected);
  });

  it("uses resolveUserId identity for proxied DirectoryIQ reads", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    process.env.DIRECTORYIQ_API_BASE = "https://directoryiq-api.ibrains.ai";

    const req = new NextRequest("http://localhost/api/directoryiq/listings/3", {
      headers: {
        "x-user-email": "owner@app.ibrains.ai",
      },
    });
    const expected = resolveUserId(req);
    const { GET } = await import("@/app/api/directoryiq/listings/[listingId]/route");

    const res = await GET(req, { params: { listingId: "3" } });

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(headers.get("x-user-id")).toBe(expected);
  });
});
