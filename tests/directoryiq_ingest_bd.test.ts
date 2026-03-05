import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const query = vi.fn(async (sql: string) => {
  if (sql.includes("FROM integrations_credentials")) {
    return [
      {
        id: "integration-1",
        user_id: "00000000-0000-4000-8000-000000000001",
        secret_ciphertext: "cipher",
        meta_json: {
          baseUrl: "https://example.com",
          listingsPath: "/api/v2/users_portfolio_groups/search",
          listingsDataId: 75,
          listingsLimit: 2,
        },
        saved_at: "2026-01-01",
      },
    ];
  }
  if (sql.includes("INSERT INTO directoryiq_ingest_runs")) {
    return [{ id: "run-1" }];
  }
  return [];
});

vi.mock("@/app/api/ecomviper/_utils/db", () => ({ query }));
vi.mock("@/app/api/ecomviper/_utils/crypto", () => ({
  decryptSecret: vi.fn(() => "test-key"),
}));

const fetchMock = vi.fn();

describe("directoryiq BD ingest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // @ts-expect-error - test override
    global.fetch = fetchMock;
    process.env.NODE_ENV = "production";
    process.env.DIRECTORYIQ_MODE = "";
  });

  it("fails preflight when data category is invalid", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => "bad",
    });

    const { runDirectoryIqFullIngest } = await import(
      "@/app/api/directoryiq/_utils/ingest"
    );

    await expect(runDirectoryIqFullIngest("00000000-0000-4000-8000-000000000001")).rejects.toMatchObject({
      code: "bd_integration_invalid",
      statusCode: 400,
      endpoint: "/api/v2/data_categories/get/75",
    });
  });

  it("fails preflight when data_type is not multi-image", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ status: "success", message: { data_type: "2" } }),
    });

    const { runDirectoryIqFullIngest } = await import(
      "@/app/api/directoryiq/_utils/ingest"
    );

    await expect(runDirectoryIqFullIngest("00000000-0000-4000-8000-000000000001")).rejects.toMatchObject({
      code: "bd_post_type_invalid",
      dataTypeObserved: "2",
    });
  });

  it("uses vacayrank request shape and paginates", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ status: "success", message: { data_type: "4" } }),
    });

    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes("/api/v2/users_portfolio_groups/search")) {
        const body =
          init?.body instanceof URLSearchParams
            ? init.body
            : new URLSearchParams((init?.body as string) ?? "");
        const headers = init?.headers as Record<string, string>;
        const page = body.get("page");
        const limit = body.get("limit");
        expect(init?.method).toBe("POST");
        expect(headers["X-Api-Key"]).toBe("test-key");
        expect(headers.Authorization).toBeUndefined();
        expect(body.get("action")).toBe("search");
        expect(body.get("output_type")).toBe("array");
        expect(body.get("data_id")).toBe("75");
        expect(limit).toBe("2");
        if (page === "1") {
          return Promise.resolve({
            ok: true,
            status: 200,
            text: async () =>
              JSON.stringify({ status: "success", message: [{ group_id: "1", group_name: "Alpha" }] }),
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ status: "success", message: [] }),
        });
      }
      return Promise.resolve({ ok: false, status: 500, text: async () => "unexpected" });
    });

    const { runDirectoryIqFullIngest } = await import(
      "@/app/api/directoryiq/_utils/ingest"
    );

    const result = await runDirectoryIqFullIngest("00000000-0000-4000-8000-000000000001");
    expect(result.status).toBe("succeeded");
    expect(result.counts.listings).toBe(1);
  });

  it("does not fall back to fixture when search fails", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ status: "success", message: { data_type: "4" } }),
    });

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ status: "error", message: "boom" }),
    });

    const { runDirectoryIqFullIngest } = await import(
      "@/app/api/directoryiq/_utils/ingest"
    );

    await expect(runDirectoryIqFullIngest("00000000-0000-4000-8000-000000000001")).rejects.toMatchObject({
      code: "bd_request_failed",
    });
  });
});
