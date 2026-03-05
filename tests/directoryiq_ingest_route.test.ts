import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const ensureUser = vi.fn(async () => {});
const resolveUserId = vi.fn(() => "00000000-0000-4000-8000-000000000001");

vi.mock("@/app/api/ecomviper/_utils/user", () => ({
  ensureUser,
  resolveUserId,
}));

vi.mock("@/app/api/directoryiq/_utils/ingest", async () => {
  const actual = await vi.importActual<typeof import("@/app/api/directoryiq/_utils/ingest")>(
    "@/app/api/directoryiq/_utils/ingest"
  );
  return {
    ...actual,
    runDirectoryIqFullIngest: vi.fn(async () => {
      throw new actual.BdIngestError({
        code: "bd_request_failed",
        baseUrlPresent: true,
        apiKeyPresent: true,
        listingsPathPresent: true,
        listingsDataIdPresent: true,
        listingsDataIdValue: 75,
        statusCode: 400,
        endpoint: "/api/v2/users_portfolio_groups/search",
        page: 1,
      });
    }),
  };
});

describe("directoryiq ingest route", () => {
  it("returns structured BD errors", async () => {
    const { POST } = await import("@/app/api/ingest/directoryiq/run/route");
    const req = new NextRequest("http://localhost/api/ingest/directoryiq/run", {
      headers: { "x-user-id": "00000000-0000-4000-8000-000000000001" },
    });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("bd_request_failed");
    expect(json.status_code).toBe(400);
    expect(json.endpoint).toBe("/api/v2/users_portfolio_groups/search");
  });
});
