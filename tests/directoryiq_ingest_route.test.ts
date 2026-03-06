import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const ensureUser = vi.fn(async () => {});
const resolveUserId = vi.fn(() => "00000000-0000-4000-8000-000000000001");

vi.mock("@/app/api/ecomviper/_utils/user", () => ({
  ensureUser,
  resolveUserId,
}));

const runDirectoryIqFullIngest = vi.fn();

vi.mock("@/app/api/directoryiq/_utils/ingest", async () => {
  const actual = await vi.importActual<typeof import("@/app/api/directoryiq/_utils/ingest")>(
    "@/app/api/directoryiq/_utils/ingest"
  );
  return {
    ...actual,
    runDirectoryIqFullIngest,
  };
});

describe("directoryiq ingest route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns structured BD errors", async () => {
    const actual = await import("@/app/api/directoryiq/_utils/ingest");
    runDirectoryIqFullIngest.mockImplementationOnce(async () => {
      throw new actual.BdIngestError({
        code: "bd_rate_limited",
        baseUrlPresent: true,
        apiKeyPresent: true,
        listingsPathPresent: true,
        listingsDataIdPresent: true,
        listingsDataIdValue: 75,
        statusCode: 400,
        endpoint: "/api/v2/users_portfolio_groups/search",
        page: 1,
        retryAttempts: 6,
        nextRetryDelayMs: 8000,
      });
    });
    const { POST } = await import("@/app/api/ingest/directoryiq/run/route");
    const req = new NextRequest("http://localhost/api/ingest/directoryiq/run", {
      headers: { "x-user-id": "00000000-0000-4000-8000-000000000001" },
    });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("bd_rate_limited");
    expect(json.status_code).toBe(400);
    expect(json.endpoint).toBe("/api/v2/users_portfolio_groups/search");
    expect(json.retry_attempts).toBe(6);
  });

  it("passes site selection params through", async () => {
    runDirectoryIqFullIngest.mockResolvedValueOnce({
      runId: "run-1",
      status: "succeeded",
      counts: { listings: 1, blogPosts: 0 },
    });
    const { POST } = await import("@/app/api/ingest/directoryiq/run/route");
    const req = new NextRequest("http://localhost/api/ingest/directoryiq/run?site_id=site-1", {
      headers: { "x-user-id": "00000000-0000-4000-8000-000000000001" },
    });
    await POST(req);
    expect(runDirectoryIqFullIngest).toHaveBeenCalledWith("00000000-0000-4000-8000-000000000001", {
      siteId: "site-1",
      allSites: false,
    });
  });
});
