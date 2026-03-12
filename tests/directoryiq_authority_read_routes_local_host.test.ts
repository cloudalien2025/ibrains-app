import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const ensureUserMock = vi.fn().mockResolvedValue(undefined);
const resolveUserIdMock = vi.fn().mockReturnValue("00000000-0000-4000-8000-000000000001");
const getAuthorityOverviewMock = vi.fn().mockResolvedValue({
  totalNodes: 1,
  totalEdges: 2,
  totalEvidence: 3,
  blogNodes: 4,
  listingNodes: 5,
  lastIngestionRunAt: null,
  lastGraphRunAt: null,
  lastGraphRunStatus: null,
});
const getAuthorityBlogsMock = vi.fn().mockResolvedValue([]);
const getAuthorityListingsMock = vi.fn().mockResolvedValue([]);

vi.mock("@/app/api/ecomviper/_utils/user", () => ({
  ensureUser: ensureUserMock,
  resolveUserId: resolveUserIdMock,
}));

vi.mock("@/src/directoryiq/graph/graphService", () => ({
  getAuthorityOverview: getAuthorityOverviewMock,
  getAuthorityBlogs: getAuthorityBlogsMock,
  getAuthorityListings: getAuthorityListingsMock,
}));

describe("directoryiq authority read routes local host parity", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    ensureUserMock.mockClear();
    resolveUserIdMock.mockClear();
    getAuthorityOverviewMock.mockClear();
    getAuthorityBlogsMock.mockClear();
    getAuthorityListingsMock.mockClear();
    delete process.env.DIRECTORYIQ_API_BASE;
    delete process.env.NEXT_PUBLIC_DIRECTORYIQ_API_BASE;
    process.env.DIRECTORYIQ_API_BASE = "http://127.0.0.1";
  });

  it("serves authority overview locally on api host and avoids proxy fetch recursion", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { GET } = await import("@/app/api/directoryiq/authority/overview/route");
    const req = new NextRequest("http://127.0.0.1/api/directoryiq/authority/overview", {
      headers: { "x-forwarded-host": "127.0.0.1" },
    });
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.overview.totalNodes).toBe(1);
    expect(getAuthorityOverviewMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("serves authority blogs locally on api host and avoids proxy fetch recursion", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { GET } = await import("@/app/api/directoryiq/authority/blogs/route");
    const req = new NextRequest("http://127.0.0.1/api/directoryiq/authority/blogs", {
      headers: { "x-forwarded-host": "127.0.0.1" },
    });
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(Array.isArray(json.blogs)).toBe(true);
    expect(getAuthorityBlogsMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("serves authority listings locally on api host and avoids proxy fetch recursion", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { GET } = await import("@/app/api/directoryiq/authority/listings/route");
    const req = new NextRequest("http://127.0.0.1/api/directoryiq/authority/listings", {
      headers: { "x-forwarded-host": "127.0.0.1" },
    });
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(Array.isArray(json.listings)).toBe(true);
    expect(getAuthorityListingsMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
