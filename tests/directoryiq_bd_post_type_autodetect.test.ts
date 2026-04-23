import { afterEach, describe, expect, it, vi } from "vitest";
import { detectBdPostTypeIds } from "@/app/api/directoryiq/_utils/bdPostTypeDetection";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function readDataId(init?: RequestInit): string {
  const body = init?.body;
  if (!(body instanceof URLSearchParams)) return "";
  return body.get("data_id") ?? "";
}

describe("directoryiq bd post type autodetect", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("auto-detects listings and blog IDs from deterministic API probes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();
        if (url.endsWith("/api/v2/data_categories/search")) {
          return jsonResponse({
            status: "success",
            data: [
              { data_id: 75, data_type: 4, name: "Business Listing" },
              { data_id: 14, data_type: 7, name: "Website Blog Article" },
            ],
          });
        }
        if (url.endsWith("/api/v2/users_portfolio_groups/search")) {
          const dataId = readDataId(init);
          if (!dataId) return jsonResponse({ status: "success", data: [] });
          if (dataId === "75") {
            return jsonResponse({
              status: "success",
              data: [{ group_id: "abc", group_name: "Summit Home Services", group_filename: "summit-home-services" }],
            });
          }
          return jsonResponse({ status: "error", message: "invalid data_id" }, 200);
        }
        if (url.endsWith("/api/v2/data_posts/search")) {
          const dataId = readDataId(init);
          if (!dataId) return jsonResponse({ status: "success", data: [] });
          if (dataId === "14") {
            return jsonResponse({
              status: "success",
              data: [{ post_id: "14-1", post_title: "Spring Cleaning Checklist", post_filename: "spring-cleaning-checklist" }],
            });
          }
          return jsonResponse({ status: "error", message: "invalid data_id" }, 200);
        }
        if (url.endsWith("/api/v2/data_categories/get/75")) {
          return jsonResponse({ status: "success", data: { data_type: 4 } });
        }
        if (url.endsWith("/api/v2/data_categories/get/14")) {
          return jsonResponse({ status: "success", data: { data_type: 7 } });
        }
        return jsonResponse({ status: "error" }, 404);
      })
    );

    const detected = await detectBdPostTypeIds({
      baseUrl: "https://example.com",
      apiKey: "secret",
      listingsPath: "/api/v2/users_portfolio_groups/search",
      blogPostsPath: "/api/v2/data_posts/search",
      configuredListingsDataId: null,
      configuredBlogPostsDataId: null,
    });

    expect(detected.listings.status).toBe("verified");
    expect(detected.listings.effectiveDataId).toBe(75);
    expect(detected.listings.autoDetected).toBe(true);
    expect(detected.blogPosts.status).toBe("verified");
    expect(detected.blogPosts.effectiveDataId).toBe(14);
    expect(detected.blogPosts.autoDetected).toBe(true);
  });

  it("preserves manual override when configured IDs verify", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();
        if (url.endsWith("/api/v2/data_categories/search")) {
          return jsonResponse({
            status: "success",
            data: [{ data_id: 75, data_type: 4, name: "Business Listing" }],
          });
        }
        if (url.endsWith("/api/v2/users_portfolio_groups/search")) {
          const dataId = readDataId(init);
          if (!dataId) return jsonResponse({ status: "success", data: [] });
          if (dataId === "80") {
            return jsonResponse({
              status: "success",
              data: [{ group_id: "80-1", group_name: "Configured Listing", group_filename: "configured-listing" }],
            });
          }
          return jsonResponse({ status: "error" }, 200);
        }
        if (url.endsWith("/api/v2/data_posts/search")) {
          const dataId = readDataId(init);
          if (dataId === "14") {
            return jsonResponse({
              status: "success",
              data: [{ post_id: "14-1", post_title: "Configured Blog", post_filename: "configured-blog" }],
            });
          }
          return jsonResponse({ status: "error" }, 200);
        }
        if (url.endsWith("/api/v2/data_categories/get/80")) {
          return jsonResponse({ status: "success", data: { data_type: 4 } });
        }
        if (url.endsWith("/api/v2/data_categories/get/14")) {
          return jsonResponse({ status: "success", data: { data_type: 7 } });
        }
        return jsonResponse({ status: "error" }, 404);
      })
    );

    const detected = await detectBdPostTypeIds({
      baseUrl: "https://example.com",
      apiKey: "secret",
      listingsPath: "/api/v2/users_portfolio_groups/search",
      blogPostsPath: "/api/v2/data_posts/search",
      configuredListingsDataId: 80,
      configuredBlogPostsDataId: 14,
    });

    expect(detected.listings.status).toBe("verified");
    expect(detected.listings.effectiveDataId).toBe(80);
    expect(detected.listings.autoDetected).toBe(false);
    expect(detected.blogPosts.status).toBe("verified");
    expect(detected.blogPosts.effectiveDataId).toBe(14);
    expect(detected.blogPosts.autoDetected).toBe(false);
  });

  it("marks configured valid IDs as verified_empty when endpoint is accepted but rows are empty", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();
        if (url.endsWith("/api/v2/data_categories/search")) {
          return jsonResponse({
            status: "success",
            data: [
              { data_id: 75, data_type: 4, name: "Business Listing" },
              { data_id: 14, data_type: 7, name: "Website Blog Article" },
            ],
          });
        }
        if (url.endsWith("/api/v2/data_categories/get/75")) {
          return jsonResponse({ status: "success", data: { data_type: 4 } });
        }
        if (url.endsWith("/api/v2/data_categories/get/14")) {
          return jsonResponse({ status: "success", data: { data_type: 7 } });
        }
        if (url.endsWith("/api/v2/users_portfolio_groups/search")) {
          return jsonResponse({ status: "success", data: [] });
        }
        if (url.endsWith("/api/v2/data_posts/search")) {
          const dataId = readDataId(init);
          if (!dataId) return jsonResponse({ status: "success", data: [] });
          return jsonResponse({ status: "success", data: [] });
        }
        if (
          url.endsWith("/api/v2/data_post/search") ||
          url.endsWith("/api/v2/posts/search") ||
          url.endsWith("/api/v2/data_posts/list")
        ) {
          return jsonResponse({ status: "error" }, 404);
        }
        return jsonResponse({ status: "error" }, 404);
      })
    );

    const detected = await detectBdPostTypeIds({
      baseUrl: "https://example.com",
      apiKey: "secret",
      listingsPath: "/api/v2/users_portfolio_groups/search",
      blogPostsPath: "/api/v2/data_posts/search",
      configuredListingsDataId: 75,
      configuredBlogPostsDataId: 14,
    });

    expect(detected.listings.status).toBe("verified_empty");
    expect(detected.listings.reason).toBe("listings_verified_empty");
    expect(detected.listings.effectiveDataId).toBe(75);
    expect(detected.blogPosts.status).toBe("verified_empty");
    expect(detected.blogPosts.reason).toBe("blog_posts_verified_empty");
    expect(detected.blogPosts.effectiveDataId).toBe(14);
  });

  it("marks listings/blog as invalid when path is 404", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : input.toString();
        if (url.endsWith("/api/v2/data_categories/search")) {
          return jsonResponse({
            status: "success",
            data: [
              { data_id: 75, data_type: 4, name: "Business Listing" },
              { data_id: 14, data_type: 7, name: "Website Blog Article" },
            ],
          });
        }
        if (url.endsWith("/api/v2/data_categories/get/75")) {
          return jsonResponse({ status: "success", data: { data_type: 4 } });
        }
        if (url.endsWith("/api/v2/data_categories/get/14")) {
          return jsonResponse({ status: "success", data: { data_type: 7 } });
        }
        if (url.endsWith("/api/v2/users_portfolio_groups/search")) {
          return jsonResponse({ status: "error", message: "not found" }, 404);
        }
        if (
          url.endsWith("/api/v2/data_posts/search") ||
          url.endsWith("/api/v2/data_post/search") ||
          url.endsWith("/api/v2/posts/search") ||
          url.endsWith("/api/v2/data_posts/list")
        ) {
          return jsonResponse({ status: "error", message: "not found" }, 404);
        }
        return jsonResponse({ status: "error" }, 404);
      })
    );

    const detected = await detectBdPostTypeIds({
      baseUrl: "https://example.com",
      apiKey: "secret",
      listingsPath: "/api/v2/users_portfolio_groups/search",
      blogPostsPath: "/api/v2/data_posts/search",
      configuredListingsDataId: 75,
      configuredBlogPostsDataId: 14,
    });

    expect(detected.listings.status).toBe("invalid");
    expect(detected.listings.reason).toBe("listings_path_not_found");
    expect(detected.blogPosts.status).toBe("invalid");
    expect(detected.blogPosts.reason).toBe("blog_posts_path_not_found");
  });

  it("returns unresolved with specific reason when IDs cannot be verified", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return jsonResponse({ status: "error", message: "invalid key or data_id" }, 200);
      })
    );

    const detected = await detectBdPostTypeIds({
      baseUrl: "https://example.com",
      apiKey: "secret",
      listingsPath: "/api/v2/users_portfolio_groups/search",
      blogPostsPath: "/api/v2/data_posts/search",
      configuredListingsDataId: 999,
      configuredBlogPostsDataId: 888,
    });

    expect(detected.listings.status).toBe("unresolved");
    expect(detected.listings.reason).toBe("listings_data_id_unverified");
    expect(detected.blogPosts.status).toBe("unresolved");
    expect(detected.blogPosts.reason).toBe("blog_posts_data_id_unverified");
  });
});
