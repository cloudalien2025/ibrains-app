import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const ensureUserMock = vi.fn(async () => {});
const resolveUserIdMock = vi.fn(() => "00000000-0000-4000-8000-000000000001");
const resolveDirectoryIqUserIdMock = vi.fn(() => "00000000-0000-4000-8000-000000000001");
const listBdSitesMock = vi.fn(async () => []);
const isAdminRequestMock = vi.fn(() => false);
const listDirectoryIqIntegrationsMock = vi.fn(async () => []);
const queryMock = vi.fn(async () => []);
const getIssuesMock = vi.fn(async () => ({ orphans: [], mentions_without_links: [], weak_anchors: [], lastRun: null }));
const runDirectoryIqFullIngestMock = vi.fn(async () => ({
  runId: "run-1",
  status: "succeeded",
  counts: { listings: 0, blogPosts: 0 },
  siteResults: null,
  errorMessage: null,
}));

vi.mock("@/app/api/ecomviper/_utils/user", () => ({
  ensureUser: ensureUserMock,
  resolveUserId: resolveUserIdMock,
}));

vi.mock("@/app/api/directoryiq/_utils/userContext", () => ({
  resolveDirectoryIqUserId: resolveDirectoryIqUserIdMock,
}));

vi.mock("@/app/api/directoryiq/_utils/bdSites", () => ({
  listBdSites: listBdSitesMock,
  isAdminRequest: isAdminRequestMock,
  createBdSite: vi.fn(),
}));

vi.mock("@/app/api/directoryiq/_utils/credentials", () => ({
  listDirectoryIqIntegrations: listDirectoryIqIntegrationsMock,
  saveDirectoryIqIntegration: vi.fn(),
  getDirectoryIqIntegration: vi.fn(),
  deleteDirectoryIqIntegration: vi.fn(),
}));

vi.mock("@/app/api/ecomviper/_utils/db", () => ({
  query: queryMock,
}));

vi.mock("@/src/directoryiq/graph/graphService", () => ({
  getIssues: getIssuesMock,
}));

vi.mock("@/app/api/directoryiq/_utils/ingest", () => ({
  BdIngestError: class BdIngestError extends Error {},
  runDirectoryIqFullIngest: runDirectoryIqFullIngestMock,
}));

describe("directoryiq non-guarded routes local host parity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    process.env.DIRECTORYIQ_API_BASE = "http://127.0.0.1";
  });

  it("serves sites/signal-sources/ingest-runs/graph-issues locally on api host", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const sitesRoute = await import("@/app/api/directoryiq/sites/route");
    const signalSourcesRoute = await import("@/app/api/directoryiq/signal-sources/route");
    const ingestRunsRoute = await import("@/app/api/directoryiq/ingest/runs/route");
    const graphIssuesRoute = await import("@/app/api/directoryiq/graph/issues/route");

    const localHeaders = { "x-forwarded-host": "127.0.0.1" };

    expect((await sitesRoute.GET(new NextRequest("http://127.0.0.1/api/directoryiq/sites", { headers: localHeaders }))).status).toBe(200);
    expect(
      (
        await signalSourcesRoute.GET(
          new NextRequest("http://127.0.0.1/api/directoryiq/signal-sources", { headers: localHeaders })
        )
      ).status
    ).toBe(200);
    expect(
      (
        await ingestRunsRoute.GET(
          new NextRequest("http://127.0.0.1/api/directoryiq/ingest/runs", { headers: localHeaders })
        )
      ).status
    ).toBe(200);
    expect(
      (
        await graphIssuesRoute.GET(
          new NextRequest("http://127.0.0.1/api/directoryiq/graph/issues", { headers: localHeaders })
        )
      ).status
    ).toBe(200);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(listBdSitesMock).toHaveBeenCalledTimes(1);
    expect(listDirectoryIqIntegrationsMock).toHaveBeenCalledTimes(1);
    expect(queryMock).toHaveBeenCalledTimes(1);
    expect(getIssuesMock).toHaveBeenCalledTimes(1);
  });

  it("serves ingest run POST locally on api host", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const ingestRunRoute = await import("@/app/api/ingest/directoryiq/run/route");
    const res = await ingestRunRoute.POST(
      new NextRequest("http://127.0.0.1/api/ingest/directoryiq/run", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-host": "127.0.0.1" },
        body: JSON.stringify({}),
      })
    );

    expect(res.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(runDirectoryIqFullIngestMock).toHaveBeenCalledTimes(1);
  });
});
