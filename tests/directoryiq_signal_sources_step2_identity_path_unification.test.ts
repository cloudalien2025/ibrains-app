import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const ensureUserMock = vi.fn(async () => undefined);
const resolveUserIdMock = vi.fn((req: NextRequest) => {
  const email = req.headers.get("x-user-email") ?? "";
  return email === "owner@app.ibrains.ai" ? "user-owner" : "user-anon";
});
const shouldServeDirectoryIqLocallyMock = vi.fn(() => true);
const listDirectoryIqIntegrationsMock = vi.fn(async () => [
  {
    provider: "openai",
    status: "connected",
    masked: "****open",
    savedAt: "2026-03-12T00:00:00.000Z",
    meta: {},
  },
  {
    provider: "brilliant_directories",
    status: "disconnected",
    masked: "",
    savedAt: null,
    meta: {},
  },
  {
    provider: "serpapi",
    status: "disconnected",
    masked: "",
    savedAt: null,
    meta: {},
  },
  {
    provider: "ga4",
    status: "disconnected",
    masked: "",
    savedAt: null,
    meta: {},
  },
]);
const listBdSitesMock = vi.fn(async () => []);
const resolveListingEvaluationMock = vi.fn(async () => ({
  siteId: "site-1",
  listingEval: {
    listing: {
      source_id: "site-1:321",
      title: "Fixture Listing",
      raw_json: { group_name: "Fixture Listing", group_filename: "fixture-listing" },
    },
    evaluation: {
      totalScore: 44,
      scores: { structure: 40, clarity: 40, trust: 40, authority: 40, actionability: 40 },
    },
  },
}));
const generateUpgradeMock = vi.fn(async ({ userId }: { userId: string }) => ({
  draft: { id: "draft-1", proposedText: "Improved description." },
  reqId: `req-${userId}`,
}));

vi.mock("@/app/api/ecomviper/_utils/user", () => ({
  ensureUser: ensureUserMock,
  resolveUserId: resolveUserIdMock,
}));

vi.mock("@/app/api/directoryiq/_utils/runtimeParity", () => ({
  shouldServeDirectoryIqLocally: shouldServeDirectoryIqLocallyMock,
}));

vi.mock("@/app/api/directoryiq/_utils/externalReadProxy", () => ({
  proxyDirectoryIqRequest: vi.fn(),
}));

vi.mock("@/app/api/directoryiq/_utils/credentials", () => ({
  listDirectoryIqIntegrations: listDirectoryIqIntegrationsMock,
  saveDirectoryIqIntegration: vi.fn(),
  getDirectoryIqIntegration: vi.fn(),
  deleteDirectoryIqIntegration: vi.fn(),
}));

vi.mock("@/app/api/directoryiq/_utils/bdSites", () => ({
  listBdSites: listBdSitesMock,
}));

vi.mock("@/app/api/directoryiq/_utils/listingResolve", () => ({
  resolveListingEvaluation: resolveListingEvaluationMock,
  ListingSiteRequiredError: class ListingSiteRequiredError extends Error {},
}));

vi.mock("@/src/directoryiq/services/upgradeService", () => ({
  generateUpgrade: generateUpgradeMock,
}));

describe("directoryiq signal-sources + step2 identity-path unification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    shouldServeDirectoryIqLocallyMock.mockReturnValue(true);
  });

  it("resolves the same user identity through signal-sources and step2 generate routes", async () => {
    const signalSourcesRoute = await import("@/app/api/directoryiq/signal-sources/route");
    const upgradeGenerateRoute = await import("@/app/api/directoryiq/listings/[listingId]/upgrade/generate/route");

    const signalReq = new NextRequest("http://127.0.0.1/api/directoryiq/signal-sources", {
      headers: { "x-user-email": "owner@app.ibrains.ai" },
    });
    const step2Req = new NextRequest("http://127.0.0.1/api/directoryiq/listings/321/upgrade/generate", {
      method: "POST",
      headers: {
        "x-user-email": "owner@app.ibrains.ai",
        "content-type": "application/json",
      },
      body: JSON.stringify({ mode: "default" }),
    });

    const signalRes = await signalSourcesRoute.GET(signalReq);
    const step2Res = await upgradeGenerateRoute.POST(step2Req, { params: { listingId: "321" } });
    const step2Json = await step2Res.json();

    expect(signalRes.status).toBe(200);
    expect(step2Res.status).toBe(202);
    expect(step2Json.status).toBe("queued");
    expect(step2Json.jobId).toBeTruthy();
    expect(step2Json.statusEndpoint).toContain("/api/directoryiq/jobs/");

    expect(ensureUserMock).toHaveBeenCalledWith("user-owner");
    expect(ensureUserMock).toHaveBeenCalledTimes(2);
    expect(listDirectoryIqIntegrationsMock).toHaveBeenCalledWith("user-owner");
    expect(generateUpgradeMock).toHaveBeenCalledWith({
      userId: "user-owner",
      listingId: "site-1:321",
      mode: "default",
    });
  });
});
