import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const ensureUser = vi.fn(async () => {});
const resolveUserId = vi.fn(() => "00000000-0000-4000-8000-000000000001");

vi.mock("@/app/api/ecomviper/_utils/user", () => ({
  ensureUser,
  resolveUserId,
}));

const runDirectoryIqFullIngest = vi.fn();
const saveDirectoryIqIntegration = vi.fn(async () => {});
const scheduleSnapshotRefresh = vi.fn(async () => {});
const getBdSite = vi.fn(async () => ({
  id: "site-1",
  user_id: "00000000-0000-4000-8000-000000000001",
  base_url: "https://example.com",
  enabled: true,
  listings_data_id: 75,
  blog_posts_data_id: 14,
  listings_path: "/api/v2/users_portfolio_groups/search",
  blog_posts_path: "/api/v2/data_posts/search",
  secret_ciphertext: "cipher",
}));
const decryptBdSiteKey = vi.fn(async () => "test-key");

vi.mock("@/app/api/directoryiq/_utils/ingest", async () => {
  const actual = await vi.importActual<typeof import("@/app/api/directoryiq/_utils/ingest")>(
    "@/app/api/directoryiq/_utils/ingest"
  );
  return {
    ...actual,
    runDirectoryIqFullIngest,
  };
});

vi.mock("@/app/api/directoryiq/_utils/credentials", () => ({
  saveDirectoryIqIntegration,
}));

vi.mock("@/app/api/_utils/snapshots", () => ({
  scheduleSnapshotRefresh,
}));

vi.mock("@/app/api/directoryiq/_utils/bdSites", () => ({
  getBdSite,
  decryptBdSiteKey,
}));

describe("directoryiq ingest route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // @ts-expect-error test override
    global.fetch = vi.fn();
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

  it("connect route does not silently persist universal 75/14 defaults", async () => {
    const { POST } = await import("@/app/api/directoryiq/connect/route");
    const req = new NextRequest("http://localhost/api/directoryiq/connect", {
      method: "POST",
      headers: { "content-type": "application/json", "x-user-id": "00000000-0000-4000-8000-000000000001" },
      body: JSON.stringify({
        base_url: "https://example.com",
        api_key: "test-key",
      }),
    });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(saveDirectoryIqIntegration).toHaveBeenCalledTimes(1);
    expect(saveDirectoryIqIntegration.mock.calls[0][0].meta.listingsDataId).toBeNull();
    expect(saveDirectoryIqIntegration.mock.calls[0][0].meta.blogPostsDataId).toBeNull();
    expect(json.data_ids.listings.configured).toBeNull();
    expect(json.data_ids.blog_posts.configured).toBeNull();
  });

  it("site test route verifies listings and blog data ids with canonical evidence", async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url.includes("/api/v2/data_categories/get/75")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ status: "success", message: { data_type: "5" } }),
        });
      }
      if (url.includes("/api/v2/users_portfolio_groups/search")) {
        const body =
          init?.body instanceof URLSearchParams
            ? init.body
            : new URLSearchParams((init?.body as string) ?? "");
        expect(body.get("action")).toBe("search");
        expect(body.get("output_type")).toBe("array");
        return Promise.resolve({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ status: "success", message: [{ group_id: "10", group_name: "Alpha" }] }),
        });
      }
      if (url.includes("/api/v2/data_posts/search")) {
        const body =
          init?.body instanceof URLSearchParams
            ? init.body
            : new URLSearchParams((init?.body as string) ?? "");
        expect(body.get("action")).toBe("search");
        expect(body.get("output_type")).toBe("array");
        return Promise.resolve({
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({ status: "success", message: [{ post_id: "900", post_title: "Guide", post_filename: "guide" }] }),
        });
      }
      return Promise.resolve({ ok: false, status: 500, text: async () => "unexpected" });
    });
    // @ts-expect-error test override
    global.fetch = fetchMock;

    const { POST } = await import("@/app/api/directoryiq/sites/[siteId]/test/route");
    const req = new NextRequest("http://localhost/api/directoryiq/sites/site-1/test", {
      method: "POST",
      headers: { "x-user-id": "00000000-0000-4000-8000-000000000001" },
    });
    const res = await POST(req, { params: { siteId: "site-1" } });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.verification.listings.status).toBe("verified");
    expect(json.verification.blog_posts.status).toBe("verified");
  });

  it("site test route verifies listings when rows are nested under message.posts", async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url.includes("/api/v2/data_categories/get/75")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ status: "success", message: { data_type: "4" } }),
        });
      }
      if (url.includes("/api/v2/users_portfolio_groups/search")) {
        const body =
          init?.body instanceof URLSearchParams
            ? init.body
            : new URLSearchParams((init?.body as string) ?? "");
        expect(body.get("action")).toBe("search");
        expect(body.get("output_type")).toBe("array");
        return Promise.resolve({
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({ status: "success", message: { posts: [{ group_id: "12", group_name: "Nested Listing" }] } }),
        });
      }
      if (url.includes("/api/v2/data_posts/search")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ status: "success", message: [{ post_id: "900", post_title: "Guide" }] }),
        });
      }
      return Promise.resolve({ ok: false, status: 500, text: async () => "unexpected" });
    });
    // @ts-expect-error test override
    global.fetch = fetchMock;

    const { POST } = await import("@/app/api/directoryiq/sites/[siteId]/test/route");
    const req = new NextRequest("http://localhost/api/directoryiq/sites/site-1/test", {
      method: "POST",
      headers: { "x-user-id": "00000000-0000-4000-8000-000000000001" },
    });
    const res = await POST(req, { params: { siteId: "site-1" } });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.verification.listings.status).toBe("verified");
  });

  it("site test route does not treat wrapper success without listing-like rows as verified", async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url.includes("/api/v2/data_categories/get/75")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ status: "success", message: { data_type: "4" } }),
        });
      }
      if (url.includes("/api/v2/users_portfolio_groups/search")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ status: "success", message: [{ post_id: "900", post_title: "Blog Row" }] }),
        });
      }
      return Promise.resolve({ ok: false, status: 500, text: async () => "unexpected" });
    });
    // @ts-expect-error test override
    global.fetch = fetchMock;

    const { POST } = await import("@/app/api/directoryiq/sites/[siteId]/test/route");
    const req = new NextRequest("http://localhost/api/directoryiq/sites/site-1/test", {
      method: "POST",
      headers: { "x-user-id": "00000000-0000-4000-8000-000000000001" },
    });
    const res = await POST(req, { params: { siteId: "site-1" } });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.verification.listings.status).toBe("unresolved");
  });

  it("site test route returns unresolved status when verification fails", async () => {
    getBdSite.mockResolvedValueOnce({
      id: "site-1",
      user_id: "00000000-0000-4000-8000-000000000001",
      base_url: "https://example.com",
      enabled: true,
      listings_data_id: 75,
      blog_posts_data_id: null,
      listings_path: "/api/v2/users_portfolio_groups/search",
      blog_posts_path: "/api/v2/data_posts/search",
      secret_ciphertext: "cipher",
    });
    const fetchMock = vi.fn((url: string) => {
      if (url.includes("/api/v2/data_categories/get/75")) {
        return Promise.resolve({ ok: false, status: 404, text: async () => JSON.stringify({ status: "error" }) });
      }
      if (url.includes("/api/v2/users_portfolio_groups/search")) {
        return Promise.resolve({ ok: true, status: 200, text: async () => JSON.stringify({ status: "success", message: [] }) });
      }
      return Promise.resolve({ ok: false, status: 500, text: async () => "unexpected" });
    });
    // @ts-expect-error test override
    global.fetch = fetchMock;

    const { POST } = await import("@/app/api/directoryiq/sites/[siteId]/test/route");
    const req = new NextRequest("http://localhost/api/directoryiq/sites/site-1/test", {
      method: "POST",
      headers: { "x-user-id": "00000000-0000-4000-8000-000000000001" },
    });
    const res = await POST(req, { params: { siteId: "site-1" } });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(false);
    expect(json.verification.listings.status).toBe("unresolved");
    expect(json.verification.blog_posts.status).toBe("unresolved");
  });
});
