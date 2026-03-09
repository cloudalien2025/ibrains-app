import { beforeEach, describe, expect, it, vi } from "vitest";

const query = vi.fn(async (sql: string, _params?: unknown[]) => {
  if (sql.includes("INSERT INTO directoryiq_ingest_runs")) {
    return [{ id: "run-1" }];
  }
  return [];
});

vi.mock("@/app/api/ecomviper/_utils/db", () => ({ query }));
const ensureLegacyBdSite = vi.fn(async () => {});
const listBdSiteRows = vi.fn(async () => [
  {
    id: "site-1",
    user_id: "00000000-0000-4000-8000-000000000001",
    label: "Site One",
    base_url: "https://example.com",
    enabled: true,
    listings_data_id: 75,
    blog_posts_data_id: 14,
    listings_path: "/api/v2/users_portfolio_groups/search",
    blog_posts_path: null,
    ingest_checkpoint_json: {},
    secret_ciphertext: "cipher",
    secret_last4: "1234",
    secret_length: 12,
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
  },
]);
const decryptBdSiteKey = vi.fn(async () => "test-key");
const getBdSite = vi.fn(async () => null);

vi.mock("@/app/api/directoryiq/_utils/bdSites", () => ({
  ensureLegacyBdSite,
  listBdSiteRows,
  decryptBdSiteKey,
  getBdSite,
}));

const fetchMock = vi.fn();

describe("directoryiq BD ingest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // @ts-expect-error - test override
    global.fetch = fetchMock;
    process.env.NODE_ENV = "production";
    process.env.DIRECTORYIQ_MODE = "";
    process.env.DIRECTORYIQ_LISTINGS_PAGE_DELAY_MS = "0";
    process.env.DIRECTORYIQ_LISTINGS_429_BASE_DELAY_MS = "0";
    process.env.DIRECTORYIQ_LISTINGS_429_MAX_DELAY_MS = "0";
    process.env.DIRECTORYIQ_LISTINGS_429_MAX_RETRIES = "1";
  });

  it("fails preflight when data category is invalid", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => "bad",
      headers: new Headers(),
    });

    const { runDirectoryIqFullIngest } = await import(
      "@/app/api/directoryiq/_utils/ingest"
    );

    await expect(runDirectoryIqFullIngest("00000000-0000-4000-8000-000000000001")).rejects.toMatchObject({
      code: "bd_integration_invalid",
      statusCode: 400,
      endpoint: "/api/v2/users_portfolio_groups/search",
    });
  });

  it("fails preflight when data_type is not multi-image", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ status: "success", message: { data_type: "2" } }),
      headers: new Headers(),
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
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes("/api/v2/users_portfolio_groups/search")) {
        const body =
          init?.body instanceof URLSearchParams
            ? init.body
            : new URLSearchParams((init?.body as string) ?? "");
        const headers = init?.headers as Record<string, string>;
        const page = body.get("page");
        const limit = body.get("limit");
        const action = body.get("action");
        const dataId = body.get("data_id");
        expect(init?.method).toBe("POST");
        expect(headers["X-Api-Key"]).toBe("test-key");
        expect(headers.Authorization).toBeUndefined();
        expect(body.get("output_type")).toBe("array");
        if (limit === "1") {
          return Promise.resolve({
            ok: true,
            status: 200,
            text: async () => JSON.stringify({ status: "success", message: [] }),
            headers: new Headers(),
          });
        }

        expect(action).toBe("search");
        expect(dataId).toBe("75");
        expect(limit).toBe("100");

        if (page === "1") {
          return Promise.resolve({
            ok: true,
            status: 200,
            text: async () =>
              JSON.stringify({ status: "success", message: [{ group_id: "1", group_name: "Alpha" }] }),
            headers: new Headers(),
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ status: "success", message: [] }),
          headers: new Headers(),
        });
      }
      return Promise.resolve({ ok: false, status: 500, text: async () => "unexpected", headers: new Headers() });
    });

    const { runDirectoryIqFullIngest } = await import(
      "@/app/api/directoryiq/_utils/ingest"
    );

    const result = await runDirectoryIqFullIngest("00000000-0000-4000-8000-000000000001");
    expect(result.status).toBe("succeeded");
    expect(result.counts.listings).toBe(1);
  });

  it("does not fall back to fixture when search fails", async () => {
    let searchCalls = 0;
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes("/api/v2/users_portfolio_groups/search")) {
        const body =
          init?.body instanceof URLSearchParams
            ? init.body
            : new URLSearchParams((init?.body as string) ?? "");
        const limit = body.get("limit");
        if (limit === "1") {
          return Promise.resolve({
            ok: true,
            status: 200,
            text: async () => JSON.stringify({ status: "success", message: [] }),
            headers: new Headers(),
          });
        }
        searchCalls += 1;
        if (searchCalls === 1) {
          return Promise.resolve({
            ok: true,
            status: 200,
            text: async () => JSON.stringify({ status: "error", message: "boom" }),
            headers: new Headers(),
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ status: "success", message: [] }),
          headers: new Headers(),
        });
      }
      return Promise.resolve({ ok: false, status: 500, text: async () => "unexpected", headers: new Headers() });
    });

    const { runDirectoryIqFullIngest } = await import(
      "@/app/api/directoryiq/_utils/ingest"
    );

    await expect(runDirectoryIqFullIngest("00000000-0000-4000-8000-000000000001")).rejects.toMatchObject({
      code: "bd_request_failed",
    });
  });

  it("retries on 429 and succeeds", async () => {
    let callCount = 0;
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes("/api/v2/users_portfolio_groups/search")) {
        const body =
          init?.body instanceof URLSearchParams
            ? init.body
            : new URLSearchParams((init?.body as string) ?? "");
        const limit = body.get("limit");
        if (limit === "1") {
          return Promise.resolve({
            ok: true,
            status: 200,
            text: async () => JSON.stringify({ status: "success", message: [] }),
            headers: new Headers(),
          });
        }
        callCount += 1;
        if (callCount === 1) {
          return Promise.resolve({
            ok: false,
            status: 429,
            text: async () => JSON.stringify({ status: "error", message: "Too many API requests per minute" }),
            headers: new Headers(),
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ status: "success", message: [] }),
          headers: new Headers(),
        });
      }
      return Promise.resolve({ ok: false, status: 500, text: async () => "unexpected", headers: new Headers() });
    });

    const { runDirectoryIqFullIngest } = await import(
      "@/app/api/directoryiq/_utils/ingest"
    );

    const result = await runDirectoryIqFullIngest("00000000-0000-4000-8000-000000000001");
    expect(result.status).toBe("succeeded");
  });

  it("fails with bd_rate_limited after retries", async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes("/api/v2/users_portfolio_groups/search")) {
        const body =
          init?.body instanceof URLSearchParams
            ? init.body
            : new URLSearchParams((init?.body as string) ?? "");
        const limit = body.get("limit");
        if (limit === "1") {
          return Promise.resolve({
            ok: true,
            status: 200,
            text: async () => JSON.stringify({ status: "success", message: [] }),
            headers: new Headers(),
          });
        }
        return Promise.resolve({
          ok: false,
          status: 429,
          text: async () => JSON.stringify({ status: "error", message: "Too many API requests per minute" }),
          headers: new Headers(),
        });
      }
      return Promise.resolve({ ok: false, status: 500, text: async () => "unexpected", headers: new Headers() });
    });

    const { runDirectoryIqFullIngest } = await import(
      "@/app/api/directoryiq/_utils/ingest"
    );

    await expect(runDirectoryIqFullIngest("00000000-0000-4000-8000-000000000001")).rejects.toMatchObject({
      code: "bd_rate_limited",
      statusCode: 429,
    });
  });

  it("ingests all sites when requested", async () => {
    listBdSiteRows.mockResolvedValueOnce([
      {
        id: "site-1",
        user_id: "00000000-0000-4000-8000-000000000001",
        label: "Site One",
        base_url: "https://example.com",
        enabled: true,
        listings_data_id: 75,
        blog_posts_data_id: 14,
        listings_path: "/api/v2/users_portfolio_groups/search",
        blog_posts_path: null,
        ingest_checkpoint_json: {},
        secret_ciphertext: "cipher",
        secret_last4: "1234",
        secret_length: 12,
        created_at: "2026-01-01",
        updated_at: "2026-01-01",
      },
      {
        id: "site-2",
        user_id: "00000000-0000-4000-8000-000000000001",
        label: "Site Two",
        base_url: "https://example.org",
        enabled: true,
        listings_data_id: 75,
        blog_posts_data_id: 14,
        listings_path: "/api/v2/users_portfolio_groups/search",
        blog_posts_path: null,
        ingest_checkpoint_json: {},
        secret_ciphertext: "cipher",
        secret_last4: "5678",
        secret_length: 12,
        created_at: "2026-01-01",
        updated_at: "2026-01-01",
      },
    ]);

    let searchCalls = 0;
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes("/api/v2/users_portfolio_groups/search")) {
        const body =
          init?.body instanceof URLSearchParams
            ? init.body
            : new URLSearchParams((init?.body as string) ?? "");
        const limit = body.get("limit");
        if (limit === "1") {
          return Promise.resolve({
            ok: true,
            status: 200,
            text: async () => JSON.stringify({ status: "success", message: [] }),
            headers: new Headers(),
          });
        }
        searchCalls += 1;
        if (searchCalls % 2 === 1) {
          return Promise.resolve({
            ok: true,
            status: 200,
            text: async () =>
              JSON.stringify({ status: "success", message: [{ group_id: `site-${searchCalls}`, group_name: "Alpha" }] }),
            headers: new Headers(),
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ status: "success", message: [] }),
          headers: new Headers(),
        });
      }
      return Promise.resolve({ ok: false, status: 500, text: async () => "unexpected", headers: new Headers() });
    });

    const { runDirectoryIqFullIngest } = await import(
      "@/app/api/directoryiq/_utils/ingest"
    );

    const result = await runDirectoryIqFullIngest("00000000-0000-4000-8000-000000000001", { allSites: true });
    expect(result.status).toBe("succeeded");
    expect(result.counts.listings).toBe(2);
  });
});

describe("directoryiq BD helper auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // @ts-expect-error - test override
    global.fetch = fetchMock;
  });

  it("uses X-Api-Key and does not send bearer authorization", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ status: "success", message: [] }),
    });

    const { bdRequestForm } = await import("@/app/api/directoryiq/_utils/bdApi");
    await bdRequestForm({
      baseUrl: "https://example.com",
      apiKey: "api-key-1",
      method: "POST",
      path: "/api/v2/data_posts/search",
      form: { action: "search", output_type: "array" },
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = (init?.headers ?? {}) as Record<string, string>;
    expect(headers["X-Api-Key"]).toBe("api-key-1");
    expect(headers.Authorization).toBeUndefined();
    expect(headers.Accept).toBe("application/json");
    expect(headers["Content-Type"]).toBe("application/x-www-form-urlencoded");
  });
});

describe("directoryiq identity + true post resolution hardening", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // @ts-expect-error - test override
    global.fetch = fetchMock;
    process.env.NODE_ENV = "production";
    process.env.DIRECTORYIQ_MODE = "";
    process.env.DIRECTORYIQ_LISTINGS_PAGE_DELAY_MS = "0";
    process.env.DIRECTORYIQ_LISTINGS_429_BASE_DELAY_MS = "0";
    process.env.DIRECTORYIQ_LISTINGS_429_MAX_DELAY_MS = "0";
    process.env.DIRECTORYIQ_LISTINGS_429_MAX_RETRIES = "1";
  });

  it("uses group_id for listing source identity and post_id for blog source identity", async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes("/api/v2/users_portfolio_groups/search")) {
        const body = init?.body instanceof URLSearchParams ? init.body : new URLSearchParams((init?.body as string) ?? "");
        const dataId = body.get("data_id");
        const page = body.get("page");
        const limit = body.get("limit");
        if (dataId === "75" && limit === "1") {
          return Promise.resolve({
            ok: true,
            status: 200,
            text: async () => JSON.stringify({ status: "success", message: [{ data_type: "4" }] }),
            headers: new Headers(),
          });
        }
        if (dataId === "75" && page === "1") {
          return Promise.resolve({
            ok: true,
            status: 200,
            text: async () =>
              JSON.stringify({
                status: "success",
                message: [{ group_id: "listing-group-1", post_id: "wrong-post", id: "wrong-id", group_name: "Alpha" }],
              }),
            headers: new Headers(),
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ status: "success", message: [] }),
          headers: new Headers(),
        });
      }
      if (url.includes("/api/v2/data_posts/search")) {
        const body = init?.body instanceof URLSearchParams ? init.body : new URLSearchParams((init?.body as string) ?? "");
        const dataId = body.get("data_id");
        if (dataId === "14") {
          return Promise.resolve({
            ok: true,
            status: 200,
            text: async () =>
              JSON.stringify({
                status: "success",
                data: [{ post_id: "blog-post-9", group_id: "wrong-group", id: "wrong-id", post_title: "Guide 1" }],
              }),
            headers: new Headers(),
          });
        }
      }
      return Promise.resolve({ ok: false, status: 500, text: async () => "unexpected", headers: new Headers() });
    });

    const { runDirectoryIqFullIngest } = await import("@/app/api/directoryiq/_utils/ingest");
    const result = await runDirectoryIqFullIngest("00000000-0000-4000-8000-000000000001");
    expect(result.status).toBe("succeeded");

    const nodeInserts = query.mock.calls.filter(
      ([sql]) => typeof sql === "string" && sql.includes("INSERT INTO directoryiq_nodes")
    ) as Array<[string, unknown[]]>;
    const listingInsert = nodeInserts.find(([, params]) => params?.[1] === "listing");
    const blogInsert = nodeInserts.find(([, params]) => params?.[1] === "blog_post");
    expect(listingInsert?.[1]?.[2]).toBe("site-1:listing-group-1");
    expect(blogInsert?.[1]?.[2]).toBe("site-1:blog-post-9");
  });

  it("refuses group_id as a true_post_id substitute", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/api/v2/data_posts/search")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              status: "success",
              data: [{ group_id: "g-1", post_title: "Fixture Listing", post_filename: "fixture-listing" }],
            }),
        });
      }
      return Promise.resolve({ ok: false, status: 500, text: async () => "unexpected" });
    });

    const { resolveTruePostIdForListing } = await import("@/app/api/directoryiq/_utils/integrations");
    const resolved = await resolveTruePostIdForListing({
      baseUrl: "https://example.com",
      apiKey: "test-key",
      dataPostsSearchPath: "/api/v2/data_posts/search",
      listingsDataId: 75,
      listingId: "321",
      listingSlug: "fixture-listing",
      listingTitle: "Fixture Listing",
    });

    expect(resolved).toEqual({ truePostId: null, mappingKey: "unresolved" });
  });

  it("returns unresolved on ambiguous mapping", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/api/v2/data_posts/search")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              status: "success",
              data: [
                { post_id: "11", post_filename: "same-slug", post_title: "Fixture Listing" },
                { post_id: "12", post_filename: "same-slug", post_title: "Fixture Listing" },
              ],
            }),
        });
      }
      return Promise.resolve({ ok: false, status: 500, text: async () => "unexpected" });
    });

    const { resolveTruePostIdForListing } = await import("@/app/api/directoryiq/_utils/integrations");
    const resolved = await resolveTruePostIdForListing({
      baseUrl: "https://example.com",
      apiKey: "test-key",
      dataPostsSearchPath: "/api/v2/data_posts/search",
      listingsDataId: 75,
      listingId: "321",
      listingSlug: "same-slug",
      listingTitle: "Fixture Listing",
    });

    expect(resolved).toEqual({ truePostId: null, mappingKey: "unresolved" });
  });

  it("returns unresolved when data_posts/get confirmation is missing", async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes("/api/v2/data_posts/search")) {
        const body = init?.body instanceof URLSearchParams ? init.body : new URLSearchParams((init?.body as string) ?? "");
        expect(body.get("action")).toBe("search");
        return Promise.resolve({
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              status: "success",
              data: [{ post_id: "99", post_filename: "fixture-listing", post_title: "Fixture Listing" }],
            }),
        });
      }
      if (url.includes("/api/v2/data_posts/get/99")) {
        return Promise.resolve({
          ok: false,
          status: 404,
          text: async () => JSON.stringify({ status: "error", message: "not found" }),
        });
      }
      return Promise.resolve({ ok: false, status: 500, text: async () => "unexpected" });
    });

    const { resolveTruePostIdForListing } = await import("@/app/api/directoryiq/_utils/integrations");
    const resolved = await resolveTruePostIdForListing({
      baseUrl: "https://example.com",
      apiKey: "test-key",
      dataPostsSearchPath: "/api/v2/data_posts/search",
      listingsDataId: 75,
      listingId: "321",
      listingSlug: "fixture-listing",
      listingTitle: "Fixture Listing",
    });

    expect(resolved).toEqual({ truePostId: null, mappingKey: "unresolved" });
  });
});
